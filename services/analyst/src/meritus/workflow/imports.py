"""Typed, durable import previews with atomic single-use commits."""

from __future__ import annotations

import hashlib
import json
import secrets
from collections.abc import Callable
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select, update

from meritus.db import session_scope, utc_now
from meritus.models import (
    CalendarEntry,
    Entity,
    ImportPreview,
    Observation,
    Outbox,
    Relationship,
    Review,
    Source,
    SourceRecord,
)
from meritus.repository.evidence import (
    _sanitise_payload,
    _sanitise_raw_text,
    sanitise_url,
)
from meritus.repository.sources import source_dict
from meritus.sources.catalogue import company_key
from meritus.sources.policy import (
    SourceBlocked,
    permission_allows,
    resolve_source_for_url,
)
from meritus.workflow.calendar import validate_calendar_entry
from meritus.workflow.lineage import attach_calendar_lineage, attach_relationship_lineage
from meritus.workflow.relationships import validate_relationship

_KINDS = {
    "organisation": "organisations",
    "organisations": "organisations",
    "company": "organisations",
    "companies": "organisations",
    "project": "projects",
    "projects": "projects",
    "calendar": "calendar",
    "relationship": "relationships",
    "relationships": "relationships",
    "metric": "metrics",
    "metrics": "metrics",
    "document": "documents",
    "documents": "documents",
}


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _parse_datetime(value: Any, field: str, *, required: bool = False) -> datetime | None:
    if value is None or value == "":
        if required:
            raise ValueError(f"{field} is required")
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        value = datetime.combine(value, datetime.min.time(), tzinfo=UTC)
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"{field} must be an ISO datetime") from exc
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must include a UTC offset")
    return value.astimezone(UTC)


def _required_text(row: dict[str, Any], field: str) -> str:
    value = str(row.get(field) or "").strip()
    if not value:
        raise ValueError(f"{field} is required")
    return value


def _stable_id(prefix: str, value: Any) -> str:
    digest = hashlib.sha256(str(value).strip().casefold().encode()).hexdigest()[:24]
    return f"{prefix}:{digest}"


def _json_ready(value: Any) -> Any:
    if isinstance(value, datetime):
        return _aware(value).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    return deepcopy(value)


class ImportService:
    """Validate imports before storing a server-side, expiring commit payload."""

    def __init__(
        self,
        repo,
        *,
        token_ttl: timedelta = timedelta(minutes=20),
        clock: Callable[[], datetime] = utc_now,
    ):
        self.repo = repo
        self.token_ttl = token_ttl
        self.clock = clock

    def preview(
        self,
        kind: str,
        rows: list[dict[str, Any]],
        source_url: str,
        permission_reference: str | None,
    ) -> dict[str, Any]:
        canonical_kind = _KINDS.get(str(kind).strip().casefold())
        errors: list[dict[str, Any]] = []
        preview_rows: list[dict[str, Any]] = []
        if canonical_kind is None:
            errors.append({"row": None, "message": f"Unsupported import kind: {kind}"})
        if not isinstance(rows, list) or not rows:
            errors.append({"row": None, "message": "At least one import row is required"})
        elif len(rows) > 1000:
            errors.append({"row": None, "message": "An import preview is limited to 1000 rows"})
        now = _aware(self.clock())
        if canonical_kind and isinstance(rows, list):
            for index, row in enumerate(rows, start=1):
                try:
                    if not isinstance(row, dict):
                        raise ValueError("row must be an object")
                    preview_rows.append(
                        self._validate_row(
                            canonical_kind,
                            row,
                            source_url,
                            permission_reference,
                            now,
                        )
                    )
                except (KeyError, TypeError, ValueError, SourceBlocked) as exc:
                    errors.append({"row": index, "message": str(exc)})
        if errors:
            return {"valid": False, "errors": errors, "preview": preview_rows, "token": None}

        preview_rows = _json_ready(preview_rows)
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        payload = {
            "kind": canonical_kind,
            "rows": preview_rows,
            "source_url": sanitise_url(str(source_url or "")),
            "permission_reference": str(permission_reference or "").strip() or None,
        }
        with session_scope(self.repo.engine) as session:
            session.add(
                ImportPreview(
                    token_hash=token_hash,
                    kind=canonical_kind,
                    payload=payload,
                    created_at=now,
                    expires_at=now + self.token_ttl,
                )
            )
        return {"valid": True, "errors": [], "preview": preview_rows, "token": token}

    def _validate_row(
        self,
        kind: str,
        source: dict[str, Any],
        source_url: str,
        permission_reference: str | None,
        now: datetime,
    ) -> dict[str, Any]:
        original_row_url = str(source.get("source_url") or source_url or "")
        row = _sanitise_payload(deepcopy(source))
        declared_source_id = row.get("source_id")
        policy_source = resolve_source_for_url(self.repo, original_row_url, declared_source_id)
        row_url = sanitise_url(original_row_url)
        row["source_url"] = row_url
        row["source_id"] = policy_source["id"]
        reference = str(row.get("permission_reference") or permission_reference or "").strip()
        import_permission = {
            "scope": row.get("permission_scope"),
            "reviewed_at": row.get("permission_reviewed_at"),
            "operations": row.get("permission_operations"),
            "expires_at": row.get("permission_expires_at"),
            "retention_days": row.get("permission_retention_days"),
            "content_expires_at": row.get("expires_at"),
            "retain_full_text": row.get("permission_retain_full_text"),
            "has_raw_text": bool(row.get("raw_text")),
        }
        self._validate_rights(kind, row_url, policy_source, reference, now, import_permission)
        row["permission_reference"] = reference or None

        validator = {
            "organisations": self._organisation,
            "projects": self._project,
            "calendar": self._calendar,
            "relationships": self._relationship,
            "metrics": self._metric,
            "documents": self._document,
        }[kind]
        result = validator(row)
        result["source_id"] = row["source_id"]
        result["source_url"] = row_url
        result["permission_reference"] = row["permission_reference"]
        result["import_permission"] = _json_ready(import_permission)
        return result

    @staticmethod
    def _validate_rights(
        kind: str,
        source_url: str,
        source: dict[str, Any],
        supplied_reference: str,
        now: datetime,
        import_permission: dict[str, Any] | None = None,
    ) -> None:
        source_id = source["id"]
        full_document = kind == "documents"
        recorded_permission = source.get("permissions") or {}
        if recorded_permission.get("denied") is True:
            raise SourceBlocked(source_id, "import", "source permission is explicitly denied")
        if source_id == "reviewed_import":
            if full_document and source_url:
                grant = import_permission or {}
                reviewed_at = _parse_datetime(grant.get("reviewed_at"), "permission_reviewed_at")
                expiry_value = grant.get("expires_at")
                expires_at = _parse_datetime(expiry_value, "permission_expires_at")
                content_expiry = _parse_datetime(grant.get("content_expires_at"), "expires_at")
                operations = grant.get("operations")
                scope = grant.get("scope")
                retention_days = grant.get("retention_days")
                retention_is_bounded = (isinstance(retention_days, int) and retention_days > 0) or (
                    content_expiry is not None and content_expiry > now
                )
                if (
                    not supplied_reference
                    or not isinstance(scope, (str, dict, list))
                    or not scope
                    or reviewed_at is None
                    or reviewed_at > now
                    or (expiry_value is not None and expiry_value != "" and expires_at is None)
                    or (expires_at is not None and expires_at <= now)
                    or not isinstance(operations, list)
                    or not {"import", "analyse", "export"}.issubset(operations)
                    or not retention_is_bounded
                    or (grant.get("has_raw_text") and grant.get("retain_full_text") is not True)
                ):
                    raise SourceBlocked(
                        source_id,
                        "import",
                        "publisher documents require a current permission reference, scope, "
                        "review date, bounded retention and explicit import/analyse/export "
                        "operations; grant expiry is checked when supplied",
                    )
            return
        if not permission_allows(source, "import", now):
            raise SourceBlocked(source_id, "import", "source rights do not permit this import")
        if full_document and not permission_allows(source, "analyse", now):
            raise SourceBlocked(source_id, "analyse", "source rights do not permit analysis")
        recorded = recorded_permission
        if full_document:
            retention_days = recorded.get("retention_days")
            content_expiry = _parse_datetime(
                (import_permission or {}).get("content_expires_at"), "expires_at"
            )
            if not (
                (isinstance(retention_days, int) and retention_days > 0)
                or (content_expiry is not None and content_expiry > now)
            ):
                raise SourceBlocked(
                    source_id,
                    "import",
                    "publisher document import requires bounded retention or source expiry",
                )
            if (import_permission or {}).get("has_raw_text") and not (
                recorded.get("retain_full_text") is True
                or (import_permission or {}).get("retain_full_text") is True
            ):
                raise SourceBlocked(
                    source_id,
                    "import",
                    "publisher full text retention is not explicitly permitted",
                )
        actual_reference = recorded.get("reference") or recorded.get("permission_reference")
        if (
            source.get("requires_permission")
            or source_id
            in {
                "hmcts",
                "find_case_law",
                "rns",
                "adzuna",
                "construction_index",
            }
        ) and supplied_reference != actual_reference:
            raise SourceBlocked(
                source_id,
                "import",
                "the supplied permission reference does not match the recorded grant",
            )

    @staticmethod
    def _organisation(row: dict[str, Any]) -> dict[str, Any]:
        name = _required_text(row, "name")
        company_number = row.get("company_number")
        scheme = row.get("scheme")
        identifier = row.get("identifier")
        if company_number:
            key = company_key(str(company_number))
            scheme, identifier = key.split(":", 1)
            verified = True
        elif scheme and identifier:
            scheme, identifier = str(scheme).strip(), str(identifier).strip()
            key = f"{scheme}:{identifier}"
            verified = bool(row.get("verified", True))
        else:
            key = _stable_id("unresolved:reviewed_import", name)
            scheme = identifier = None
            verified = False
        return {
            "operation": "entity",
            "entity": {
                "key": key,
                "kind": "organisation",
                "name": name,
                "scheme": scheme,
                "identifier": identifier,
                "verified": verified,
                "properties": deepcopy(row.get("properties") or {}),
            },
        }

    @staticmethod
    def _project(row: dict[str, Any]) -> dict[str, Any]:
        name = _required_text(row, "name")
        identifier = str(row.get("identifier") or row.get("ocid") or "").strip()
        if not identifier:
            raise ValueError("identifier or ocid is required")
        source_id = str(row.get("source_id") or "reviewed_import")
        expected_key = f"project:{source_id}:{identifier}"
        key = str(row.get("key") or expected_key).strip()
        if key != expected_key:
            raise ValueError(f"Project key must be {expected_key}")
        identifier_scheme = str(row.get("scheme") or "source-project-id").strip()
        return {
            "operation": "entity",
            "entity": {
                "key": key,
                "kind": "project",
                "name": name,
                "scheme": None,
                "identifier": None,
                "verified": bool(row.get("verified", True)),
                "properties": {
                    **deepcopy(row.get("properties") or {}),
                    "source_project_identifier": identifier,
                    "source_project_identifier_scheme": identifier_scheme,
                },
            },
        }

    def _calendar(self, row: dict[str, Any]) -> dict[str, Any]:
        item = validate_calendar_entry(row)
        self.repo.get_entity(item["entity_id"])
        with session_scope(self.repo.engine) as session:
            item = attach_calendar_lineage(session, item)
        return {"operation": "calendar", "calendar": item}

    def _relationship(self, row: dict[str, Any]) -> dict[str, Any]:
        item = validate_relationship(row)
        self.repo.get_entity(item["from_entity_id"])
        self.repo.get_entity(item["to_entity_id"])
        if matter_entity_id := item["attributes"].get("matter_entity_id"):
            self.repo.get_entity(matter_entity_id)
        with session_scope(self.repo.engine) as session:
            item = attach_relationship_lineage(session, item)
        return {"operation": "relationship", "relationship": item}

    def _metric(self, row: dict[str, Any]) -> dict[str, Any]:
        entity_id = _required_text(row, "entity_id")
        self.repo.get_entity(entity_id)
        _required_text(row, "source_url")
        category = str(row.get("category") or row.get("metric") or "").strip()
        if not category:
            raise ValueError("category or metric is required")
        if row.get("value") is None:
            raise ValueError("value is required")
        unit = _required_text(row, "unit")
        published_at = _parse_datetime(row.get("published_at"), "published_at", required=True)
        period_end = _parse_datetime(row.get("period_end"), "period_end", required=True)
        return {
            "operation": "metric",
            "metric": {
                "entity_id": entity_id,
                "kind": str(row.get("kind") or "gateway_metric"),
                "category": category,
                "value": float(row["value"]),
                "unit": unit,
                "period_start": _parse_datetime(row.get("period_start"), "period_start"),
                "period_end": period_end,
                "published_at": published_at,
                "external_id": str(
                    row.get("external_id")
                    or _stable_id("metric", f"{entity_id}:{category}:{period_end.isoformat()}")
                ),
                "window": str(row.get("window") or "").strip() or None,
                "suppressed": bool(row.get("suppressed", False)),
                "suppression_reason": str(row.get("suppression_reason") or "").strip() or None,
                "evidence_pointer": str(row.get("evidence_pointer") or "").strip(),
            },
        }

    @staticmethod
    def _document(row: dict[str, Any]) -> dict[str, Any]:
        _required_text(row, "source_url")
        published_at = _parse_datetime(row.get("published_at"), "published_at", required=True)
        payload = deepcopy(row.get("payload") or {})
        raw_text = row.get("raw_text")
        if raw_text is not None and not isinstance(raw_text, str):
            raise ValueError("raw_text must be text")
        return {
            "operation": "document",
            "document": {
                "external_id": _required_text(row, "external_id"),
                "title": _required_text(row, "title"),
                "published_at": published_at,
                "expires_at": _parse_datetime(row.get("expires_at"), "expires_at"),
                "media_type": str(row.get("media_type") or "application/json"),
                "payload": payload,
                "raw_text": _sanitise_raw_text(raw_text),
            },
        }

    def commit(self, token: str, actor: str) -> dict[str, Any]:
        actor = str(actor or "").strip()
        if not actor:
            raise ValueError("actor is required")
        token_hash = hashlib.sha256(str(token or "").encode()).hexdigest()
        now = _aware(self.clock())
        with session_scope(self.repo.engine) as session:
            preview = session.scalar(
                select(ImportPreview).where(ImportPreview.token_hash == token_hash)
            )
            if preview is None:
                raise KeyError("Unknown import preview token")
            if preview.committed_at is not None:
                raise ValueError("The import preview has already been committed")
            if _aware(preview.expires_at) <= now:
                raise ValueError("The import preview has expired")

            claimed = session.execute(
                update(ImportPreview)
                .where(ImportPreview.id == preview.id, ImportPreview.committed_at.is_(None))
                .values(committed_at=now)
            )
            if claimed.rowcount != 1:
                raise ValueError("The import preview has already been committed")
            payload = deepcopy(preview.payload)
            self._recheck_rights(session, payload, now)
            result = self._commit_rows(session, payload["rows"], actor, now, payload["kind"])
            preview.result = result
            preview.committed_at = now
            session.flush()
            return deepcopy(result)

    @staticmethod
    def _recheck_rights(session, payload: dict[str, Any], now: datetime) -> None:
        for row in payload["rows"]:
            source = session.get(Source, row["source_id"])
            if source is None:
                raise SourceBlocked(row["source_id"], "import", "source is no longer configured")
            data = source_dict(source)
            ImportService._validate_rights(
                payload["kind"],
                row.get("source_url") or "",
                data,
                row.get("permission_reference") or "",
                now,
                row.get("import_permission"),
            )

    def _commit_rows(
        self,
        session,
        rows: list[dict[str, Any]],
        actor: str,
        now: datetime,
        kind: str,
    ) -> dict[str, Any]:
        counts = {
            "kind": kind,
            "rows": len(rows),
            "inserted": 0,
            "updated": 0,
            "replayed": 0,
            "reviews": 0,
        }
        for row in rows:
            operation = row["operation"]
            if operation == "entity":
                outcome, entity = self._commit_entity(session, row["entity"], now)
                counts[outcome] += 1
                session.add(
                    Review(
                        target_type="entity",
                        target_id=entity.id,
                        action="verified" if entity.verified else "pending",
                        actor=actor,
                        reason="Committed reviewed import",
                        payload={"source_id": row["source_id"], "source_url": row["source_url"]},
                        created_at=now,
                    )
                )
                counts["reviews"] += 1
            elif operation == "calendar":
                calendar = attach_calendar_lineage(session, row["calendar"])
                session.add(self._calendar_model(calendar, now))
                counts["inserted"] += 1
            elif operation == "relationship":
                relationship_data = attach_relationship_lineage(session, row["relationship"])
                relationship = self._relationship_model(relationship_data, now)
                session.add(relationship)
                session.flush()
                session.add(
                    Review(
                        target_type="relationship",
                        target_id=relationship.id,
                        action=relationship.state,
                        actor=actor,
                        reason="Committed reviewed relationship import",
                        payload={"source_url": row["source_url"]},
                        created_at=now,
                    )
                )
                counts["inserted"] += 1
                counts["reviews"] += 1
            else:
                outcome = self._commit_record(session, row, actor, now)
                counts[outcome] += 1
        return counts

    @staticmethod
    def _commit_entity(session, data: dict[str, Any], now: datetime):
        entity = session.scalar(select(Entity).where(Entity.key == data["key"]))
        if entity is None:
            entity = Entity(**data, created_at=now, updated_at=now)
            session.add(entity)
            session.flush()
            return "inserted", entity
        if (
            entity.kind != data["kind"]
            or entity.scheme != data["scheme"]
            or entity.identifier != data["identifier"]
        ):
            raise ValueError("Imported entity identity conflicts with the canonical entity")
        entity.name = data["name"]
        entity.verified = entity.verified or data["verified"]
        entity.properties = {**entity.properties, **data["properties"]}
        entity.updated_at = now
        session.flush()
        return "updated", entity

    @staticmethod
    def _calendar_model(data: dict[str, Any], now: datetime) -> CalendarEntry:
        return CalendarEntry(
            entity_id=data["entity_id"],
            kind=data["kind"],
            title=data["title"],
            date=date.fromisoformat(data["date"]),
            precision=data["precision"],
            source_url=sanitise_url(data["source_url"]),
            evidence=deepcopy(data["evidence"]),
            status=data["status"],
            jurisdiction=data["jurisdiction"],
            basis=data["basis"],
            reviewer=data["reviewer"],
            created_at=now,
        )

    @staticmethod
    def _relationship_model(data: dict[str, Any], now: datetime) -> Relationship:
        return Relationship(
            record_id=data["source_record_id"],
            from_entity_id=data["from_entity_id"],
            to_entity_id=data["to_entity_id"],
            role=data["role"],
            evidence_pointer=data["evidence_pointer"],
            valid_from=_parse_datetime(data.get("valid_from"), "valid_from"),
            valid_to=_parse_datetime(data.get("valid_to"), "valid_to"),
            state=data["state"],
            attributes=deepcopy(data["attributes"]),
            created_at=now,
        )

    @staticmethod
    def _commit_record(session, row: dict[str, Any], actor: str, now: datetime) -> str:
        source_id = row["source_id"]
        source_url = sanitise_url(row["source_url"])
        if row["operation"] == "metric":
            metric = row["metric"]
            external_id = metric["external_id"]
            published_at = _parse_datetime(metric["published_at"], "published_at", required=True)
            expires_at = None
            raw_text = None
            title = f"{metric['category']} metric"
            payload = {
                "category": metric["category"],
                "period_start": metric["period_start"],
                "period_end": metric["period_end"],
                "window": metric["window"],
                "unit": metric["unit"],
                "permission_reference": row["permission_reference"],
            }
            observation_data = metric
            media_type = "application/json"
        else:
            document = row["document"]
            external_id = document["external_id"]
            published_at = _parse_datetime(document["published_at"], "published_at", required=True)
            expires_at = _parse_datetime(document.get("expires_at"), "expires_at")
            permission = row.get("import_permission") or {}
            source_permission = source_dict(session.get(Source, source_id)).get("permissions") or {}
            retention_days = permission.get("retention_days") or source_permission.get(
                "retention_days"
            )
            if expires_at is None and isinstance(retention_days, int) and retention_days > 0:
                expires_at = now + timedelta(days=retention_days)
            raw_text = document.get("raw_text")
            title = document["title"]
            payload = {
                **deepcopy(document["payload"]),
                "permission_reference": row["permission_reference"],
                "import_permission": permission,
            }
            observation_data = None
            media_type = document["media_type"]
        digest_input = {
            "source_url": source_url,
            "title": title,
            "published_at": published_at.isoformat(),
            "payload": payload,
            "raw_text": raw_text,
            "observation": observation_data,
        }
        digest = hashlib.sha256(
            json.dumps(digest_input, sort_keys=True, default=str).encode()
        ).hexdigest()
        replay = session.scalar(
            select(SourceRecord).where(
                SourceRecord.source_id == source_id,
                SourceRecord.external_id == external_id,
                SourceRecord.content_hash == digest,
            )
        )
        if replay is not None:
            return "replayed"
        priors = session.scalars(
            select(SourceRecord).where(
                SourceRecord.source_id == source_id,
                SourceRecord.external_id == external_id,
            )
        ).all()
        for prior in priors:
            prior.active = False
        record = SourceRecord(
            source_id=source_id,
            external_id=external_id,
            revision=max((item.revision for item in priors), default=0) + 1,
            content_hash=digest,
            source_url=source_url,
            title=title,
            published_at=published_at,
            observed_at=now,
            expires_at=expires_at,
            active=True,
            withdrawn=False,
            media_type=media_type,
            payload=_sanitise_payload(payload),
            raw_text=raw_text,
            raw_text_hash=hashlib.sha256(raw_text.encode()).hexdigest() if raw_text else None,
            parser_version="reviewed-import-v1",
        )
        session.add(record)
        session.flush()
        if observation_data:
            attributes = {
                "metric": observation_data["category"],
                "period_start": observation_data["period_start"],
                "window": observation_data["window"],
                "suppressed": observation_data["suppressed"],
                "suppression_reason": observation_data["suppression_reason"],
                "review_actor": actor,
            }
            session.add(
                Observation(
                    record_id=record.id,
                    entity_id=observation_data["entity_id"],
                    kind=observation_data["kind"],
                    event_key=f"{observation_data['kind']}:{external_id}",
                    headline=title,
                    detail="Reviewed structured metric import",
                    occurred_at=None,
                    period_end=_parse_datetime(
                        observation_data["period_end"], "period_end", required=True
                    ),
                    state="verified",
                    evidence_pointer=observation_data["evidence_pointer"],
                    value=observation_data["value"],
                    unit=observation_data["unit"],
                    attributes=attributes,
                    created_at=now,
                )
            )
        session.add(
            Outbox(
                operation="index_source_record",
                record_id=record.id,
                payload={"record_id": record.id, "source_id": source_id},
            )
        )
        return "updated" if priors else "inserted"


__all__ = ["ImportService"]
