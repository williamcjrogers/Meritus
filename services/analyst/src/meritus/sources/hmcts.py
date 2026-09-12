"""Authenticated HMCTS publication receiver and parser."""

from __future__ import annotations

import json
import re
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

from sqlalchemy import select

from meritus.config import contains_secret_values
from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.models import Source, SourceRecord
from meritus.repository.sources import source_dict
from meritus.sources.common import source_date
from meritus.sources.extraction import extract_document
from meritus.sources.policy import SourceBlocked, require_permission

_PUBLICATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$")
_HOSTS = {
    "court-tribunal-hearings.service.gov.uk",
    "www.court-tribunal-hearings.service.gov.uk",
}


def _aware_now(now: datetime | None) -> datetime:
    value = now or datetime.now(UTC)
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("now must include a UTC offset")
    return value.astimezone(UTC)


def _public_grant(source: dict, now: datetime) -> None:
    require_permission(source, "retrieve", now)
    require_permission(source, "analyse", now)
    if not source.get("enabled"):
        raise SourceBlocked("hmcts", "retrieve", "the receiver source is disabled")
    scope = (source.get("permissions") or {}).get("scope")
    sensitivities = scope.get("sensitivity") if isinstance(scope, dict) else None
    if not isinstance(sensitivities, list) or "PUBLIC" not in {
        str(value).upper() for value in sensitivities
    }:
        raise SourceBlocked("hmcts", "import", "the grant does not name PUBLIC sensitivity")


def _entities(payload: dict) -> list[EntityInput]:
    values = payload.get("entities", [])
    if not isinstance(values, list):
        raise ValueError("HMCTS publication entities must be a list.")
    return [EntityInput.model_validate(item) for item in values]


def parse_publication(publication_id: str, payload: dict) -> ParsedDocument:
    if not _PUBLICATION_ID.fullmatch(publication_id):
        raise ValueError("HMCTS publication identifier is invalid.")
    if not isinstance(payload, dict):
        raise ValueError("HMCTS publication payload must be an object.")
    if contains_secret_values(payload):
        raise ValueError("HMCTS publication payload contains credential-like data.")
    try:
        version = int(payload["version"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("HMCTS publication version must be a positive integer.") from exc
    if version < 1 or isinstance(payload.get("version"), bool):
        raise ValueError("HMCTS publication version must be a positive integer.")
    sensitivity = str(payload.get("sensitivity") or "").upper()
    if sensitivity != "PUBLIC":
        raise SourceBlocked("hmcts", "import", "only granted PUBLIC publications are accepted")
    source_url = str(payload.get("source_url") or "")
    parts = urlsplit(source_url)
    if (
        parts.scheme != "https"
        or parts.hostname not in _HOSTS
        or parts.port not in (None, 443)
        or parts.username
        or parts.password
    ):
        raise ValueError("HMCTS publication URL is not an approved official HTTPS URL.")
    published = source_date(payload.get("published_at"))
    if published is None:
        raise ValueError("HMCTS publication date is missing or invalid.")
    expires = source_date(payload.get("expires_at"))
    if payload.get("expires_at") and expires is None:
        raise ValueError("HMCTS publication expiry is invalid.")
    content = payload.get("content")
    media_type = str(payload.get("media_type") or "application/json")
    if isinstance(content, str):
        raw_text = content
    elif isinstance(content, dict):
        raw_text = json.dumps(content, sort_keys=True, ensure_ascii=False)
    else:
        raise ValueError("HMCTS publication content must be text or an object.")
    entities = _entities(payload)
    extracted = extract_document(raw_text, source_url, published, entities)
    return ParsedDocument(
        external_id=publication_id,
        source_url=source_url,
        title=str(payload.get("title") or publication_id),
        published_at=published,
        expires_at=expires,
        payload={
            "original_url": source_url,
            "publication_id": publication_id,
            "publication_version": version,
            "sensitivity": sensitivity,
            "replacement_id": payload.get("replacement_id"),
            "locations": extracted.payload["locations"],
        },
        entities=entities,
        observations=extracted.observations,
        warnings=["HMCTS extracted propositions require analyst review."]
        if extracted.observations
        else [],
        media_type=media_type,
        raw_text=raw_text,
    )


def _current_record(database, publication_id: str) -> dict | None:
    record = database.scalar(
        select(SourceRecord)
        .where(
            SourceRecord.source_id == "hmcts",
            SourceRecord.external_id == publication_id,
            SourceRecord.active.is_(True),
        )
        .order_by(SourceRecord.revision.desc())
    )
    if record is None:
        return None
    return {
        "title": record.title,
        "source_url": record.source_url,
        "published_at": record.published_at.replace(tzinfo=UTC)
        if record.published_at and record.published_at.tzinfo is None
        else record.published_at,
        "media_type": record.media_type,
        "publication_version": int(record.payload.get("publication_version") or 0),
    }


@contextmanager
def _receiver_transaction(engine):
    connection = engine.connect()
    try:
        if connection.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        else:
            connection.begin()
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _apply_retention(document: ParsedDocument, permissions: dict, received_at: datetime):
    retention_days = permissions.get("retention_days")
    if retention_days is not None and (
        isinstance(retention_days, bool)
        or not isinstance(retention_days, int)
        or retention_days <= 0
    ):
        raise ValueError("HMCTS grant retention_days must be a positive integer.")
    grant_expiry = (
        received_at + timedelta(days=retention_days) if retention_days is not None else None
    )
    publication_expiry = document.expires_at
    if publication_expiry is None and grant_expiry is None:
        raise ValueError("HMCTS content requires a publication expiry or grant retention_days.")
    effective_expiry = min(
        expiry for expiry in (publication_expiry, grant_expiry) if expiry is not None
    )
    if effective_expiry <= received_at:
        raise ValueError("HMCTS publication expiry must be in the future.")
    return document.model_copy(update={"expires_at": effective_expiry})


def receive_publication(
    repo,
    publication_id: str,
    method: str,
    payload: dict,
    now: datetime | None = None,
) -> dict:
    """Apply one authorised receiver write with immutable replacement history."""
    received_at = _aware_now(now)
    with _receiver_transaction(repo.engine) as connection:
        from meritus.repository import Repository

        transactional_repo = Repository(connection)
        with session_scope(connection) as database:
            source_model = database.scalar(
                select(Source).where(Source.id == "hmcts").with_for_update(of=Source)
            )
            if source_model is None:
                raise KeyError("Unknown source: hmcts")
            source = source_dict(source_model)
            _public_grant(source, received_at)
            if not _PUBLICATION_ID.fullmatch(publication_id):
                raise ValueError("HMCTS publication identifier is invalid.")
            method = method.upper()
            if method not in {"POST", "PUT", "DELETE"}:
                raise ValueError("HMCTS receiver method is not supported.")
            if not isinstance(payload, dict):
                raise ValueError("HMCTS publication payload must be an object.")
            if contains_secret_values(payload):
                raise ValueError("HMCTS publication payload contains credential-like data.")
            current = _current_record(database, publication_id)
        if method == "POST" and current is not None:
            raise ValueError("HMCTS publication already exists; use PUT for a replacement.")
        if method in {"PUT", "DELETE"} and current is None:
            raise KeyError(f"Unknown HMCTS publication: {publication_id}")

        if method == "DELETE":
            supplied_version = payload.get("version") if isinstance(payload, dict) else None
            version = (
                int(supplied_version)
                if supplied_version is not None
                else current["publication_version"] + 1
            )
            if version <= current["publication_version"]:
                raise ValueError("HMCTS deletion version must be newer than the active version.")
            document = ParsedDocument(
                external_id=publication_id,
                source_url=current["source_url"],
                title=current["title"],
                published_at=current["published_at"],
                expires_at=received_at,
                withdrawn=True,
                payload={
                    "original_url": current["source_url"],
                    "publication_id": publication_id,
                    "publication_version": version,
                    "sensitivity": "PUBLIC",
                    "withdrawn_at": received_at.isoformat(),
                    "reason": "withdrawn_by_publisher",
                },
                media_type=current["media_type"],
            )
            status = "withdrawn"
        else:
            document = parse_publication(publication_id, payload)
            document = _apply_retention(document, source.get("permissions") or {}, received_at)
            version = int(document.payload["publication_version"])
            if current is not None and version <= current["publication_version"]:
                raise ValueError("HMCTS replacement version must be newer than the active version.")
            status = "created" if method == "POST" else "replaced"
        counts = transactional_repo.ingest_batch(
            "hmcts", FetchBatch(documents=[document]), observed_at=received_at
        )
        return {
            "status": status,
            "publication_id": publication_id,
            "version": version,
            **counts,
        }


class HMCTSAdapter:
    def fetch(self, source, client, now):
        del source, client, now
        raise SourceBlocked("hmcts", "retrieve", "HMCTS is a receiver source, not a pull feed")


__all__ = ["HMCTSAdapter", "parse_publication", "receive_publication"]
