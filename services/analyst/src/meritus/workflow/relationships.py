"""Reviewed, matter-specific relationship persistence."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from meritus.access import project_entity
from meritus.db import session_scope, utc_now
from meritus.models import Entity, Relationship, Review
from meritus.repository.evidence import model_dict
from meritus.workflow.lineage import attach_relationship_lineage

_PROFESSIONAL_ROLES = {
    "adviser",
    "barrister",
    "counsel",
    "expert",
    "funder",
    "introduction_route",
    "practitioner",
    "solicitor",
}


def _datetime(value: Any, field: str) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"{field} must be an ISO datetime") from exc
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must include a UTC offset")
    return value.astimezone(UTC)


def validate_relationship(data: dict[str, Any]) -> dict[str, Any]:
    required = {"from_entity_id", "to_entity_id", "role", "evidence_pointer"}
    missing = [field for field in sorted(required) if not str(data.get(field) or "").strip()]
    if missing:
        raise ValueError(f"Missing relationship fields: {', '.join(missing)}")
    result = deepcopy(data)
    result["role"] = str(data["role"]).strip().casefold()
    result["state"] = str(data.get("state") or "verified").casefold()
    if result["state"] not in {"pending", "verified", "rejected"}:
        raise ValueError("Relationship state must be pending, verified or rejected")
    result["attributes"] = deepcopy(data.get("attributes") or {})
    result["source_record_id"] = str(
        data.get("source_record_id") or data.get("record_id") or ""
    ).strip()
    result["source_url"] = str(
        data.get("source_url") or result["attributes"].get("source_url") or ""
    ).strip()
    result["valid_from"] = _datetime(data.get("valid_from"), "valid_from")
    result["valid_to"] = _datetime(data.get("valid_to"), "valid_to")
    if result["valid_from"] and result["valid_to"] and result["valid_to"] < result["valid_from"]:
        raise ValueError("valid_to cannot precede valid_from")
    if result["role"] in _PROFESSIONAL_ROLES:
        matter = result["attributes"].get("matter_entity_id") or result["attributes"].get(
            "matter_reference"
        )
        if not matter:
            raise ValueError("A professional-person role must identify its specific matter")
    if result["valid_from"] is None:
        raise ValueError("valid_from is required for an evidenced relationship")
    return result


def add_reviewed_relationship(
    repo, data: dict[str, Any], actor: str, reason: str
) -> dict[str, Any]:
    """Persist a human relationship and its review in one transaction."""
    item = validate_relationship(data)
    if not str(actor or "").strip() or not str(reason or "").strip():
        raise ValueError("A relationship review requires actor and reason")
    with session_scope(repo.engine) as session:
        item = attach_relationship_lineage(session, {**item, "review_reason": reason})
        for entity_id in (item["from_entity_id"], item["to_entity_id"]):
            entity = session.get(Entity, entity_id)
            if entity is None or project_entity(session, entity, now=utc_now()) is None:
                raise KeyError(f"Unknown entity: {entity_id}")
        matter_entity_id = item["attributes"].get("matter_entity_id")
        if matter_entity_id:
            matter = session.get(Entity, matter_entity_id)
            if matter is None or project_entity(session, matter, now=utc_now()) is None:
                raise KeyError(f"Unknown matter entity: {matter_entity_id}")
        now = utc_now()
        relationship = Relationship(
            record_id=item["source_record_id"],
            from_entity_id=item["from_entity_id"],
            to_entity_id=item["to_entity_id"],
            role=item["role"],
            evidence_pointer=item["evidence_pointer"],
            valid_from=item["valid_from"],
            valid_to=item["valid_to"],
            state=item["state"],
            attributes=item["attributes"],
            created_at=now,
        )
        session.add(relationship)
        session.flush()
        session.add(
            Review(
                target_type="relationship",
                target_id=relationship.id,
                action=item["state"],
                actor=str(actor).strip(),
                reason=str(reason).strip(),
                payload={"matter_specific": bool(item["attributes"].get("matter_entity_id"))},
                created_at=now,
            )
        )
        session.flush()
        return model_dict(relationship)


create_relationship = add_reviewed_relationship


__all__ = ["add_reviewed_relationship", "create_relationship", "validate_relationship"]
