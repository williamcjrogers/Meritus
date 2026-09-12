"""Resolve analyst workflow evidence to durable source records."""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from meritus.access import record_allows
from meritus.db import utc_now
from meritus.models import SourceRecord
from meritus.repository.evidence import sanitise_url


def _record_id(data: dict[str, Any]) -> str:
    evidence = data.get("evidence") if isinstance(data.get("evidence"), dict) else {}
    value = (
        data.get("source_record_id") or data.get("record_id") or evidence.get("source_record_id")
    )
    return str(value or "").strip()


def _source_url(data: dict[str, Any]) -> str:
    attributes = data.get("attributes") if isinstance(data.get("attributes"), dict) else {}
    return sanitise_url(str(data.get("source_url") or attributes.get("source_url") or "").strip())


def resolve_source_record(
    session: Session,
    data: dict[str, Any],
    *,
    required: bool,
) -> SourceRecord | None:
    """Resolve an explicit ID, or an exact URL only when it has one active match."""
    source_record_id = _record_id(data)
    source_url = _source_url(data)
    now = utc_now()
    if source_record_id:
        record = session.get(SourceRecord, source_record_id)
        if record is None:
            raise ValueError("Unknown source_record_id")
        if not record_allows(record, record.source, now):
            raise ValueError("The source_record_id refers to evidence that is not readable")
        if data.get("source_id") and data["source_id"] != record.source_id:
            raise ValueError("source_record_id belongs to a different source")
        if source_url and source_url != record.source_url:
            raise ValueError("source_url does not match source_record_id")
        return record
    if not source_url:
        if required:
            raise ValueError("An evidenced workflow item requires source_record_id")
        return None
    matches = [
        record
        for record in session.scalars(
            select(SourceRecord).where(
                SourceRecord.source_url == source_url,
                SourceRecord.active.is_(True),
                SourceRecord.withdrawn.is_(False),
                *((SourceRecord.source_id == data["source_id"],) if data.get("source_id") else ()),
            )
        )
        if record_allows(record, record.source, now)
    ]
    if not matches:
        raise ValueError("source_url has no readable source record; supply source_record_id")
    if len(matches) != 1:
        raise ValueError("source_url is ambiguous; supply source_record_id")
    return matches[0]


def attach_calendar_lineage(session: Session, data: dict[str, Any]) -> dict[str, Any]:
    item = deepcopy(data)
    required = bool(
        item.get("status") == "confirmed"
        or item.get("source_record_id")
        or item.get("source_url")
        or item.get("evidence")
    )
    record = resolve_source_record(session, item, required=required)
    if record is None:
        return item
    item["source_record_id"] = record.id
    item["source_url"] = record.source_url
    item["evidence"] = {**deepcopy(item.get("evidence") or {}), "source_record_id": record.id}
    return item


def attach_relationship_lineage(session: Session, data: dict[str, Any]) -> dict[str, Any]:
    item = deepcopy(data)
    has_source = bool(_record_id(item) or _source_url(item) or item.get("source_id"))
    mode = item.get("evidence_mode") or ("source" if has_source else "human")
    if mode not in {"source", "human"}:
        raise ValueError("Relationship evidence_mode must be source or human")
    if mode == "human":
        basis = str(item.get("human_basis") or "").strip()
        if not basis:
            raise ValueError("A human relationship requires its human_basis")
        web_reference = re.compile(
            r"https?://|www\.|\b(?:[a-z0-9-]+\.)+(?:com|org|net|uk|gov|io)\b", re.IGNORECASE
        )
        human_text = " ".join(
            str(item.get(field) or "")
            for field in ("human_basis", "evidence_pointer", "review_reason", "attributes")
        )
        if has_source or web_reference.search(human_text):
            raise ValueError("Web references require the retained source evidence mode")
        item["source_record_id"] = None
        item["attributes"] = {
            **deepcopy(item.get("attributes") or {}),
            "evidence_mode": "human",
            "human_basis": basis,
        }
        return item
    record = resolve_source_record(session, item, required=True)
    assert record is not None
    item["source_record_id"] = record.id
    item["source_url"] = record.source_url
    item["attributes"] = {
        **deepcopy(item.get("attributes") or {}),
        "evidence_mode": "source",
        "source_url": record.source_url,
    }
    return item


__all__ = ["attach_calendar_lineage", "attach_relationship_lineage", "resolve_source_record"]
