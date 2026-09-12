"""Durable, rights-linked alert generation."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from meritus.access import record_access_clause
from meritus.db import session_scope
from meritus.models import (
    Alert,
    AlertGeneration,
    AlertLineage,
    AlertScoreState,
    Entity,
    EntityProvenance,
    Observation,
    Relationship,
    Source,
    SourceRecord,
)
from meritus.read_access import entity_access_clause
from meritus.repository.evidence import model_dict

MATERIAL_SCORE_CHANGE = 10.0
_GENERATION_KINDS = {"material_change", "qualifying_event", "source_failure"}
_FAILURE_STATES = {"blocked", "failed"}
_BIND_CHUNK = 5_000


def _aware(value: datetime | None) -> datetime:
    value = value or datetime.now(UTC)
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Alert time must include a UTC offset")
    return value.astimezone(UTC)


def _chunks(values: set[str]):
    ordered = sorted(values)
    for offset in range(0, len(ordered), _BIND_CHUNK):
        yield ordered[offset : offset + _BIND_CHUNK]


def _validated_text(value: str, field: str, maximum: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"Invalid alert {field}")
    return value.strip()


def _linked_records(session, record_ids: set[str], access) -> dict[str, Any]:
    records: dict[str, Any] = {}
    for chunk in _chunks(record_ids):
        records.update(
            {
                record.id: record
                for record in session.execute(
                    select(
                        SourceRecord.id,
                        SourceRecord.revision,
                        SourceRecord.source_id,
                    ).where(
                        SourceRecord.id.in_(chunk),
                        access,
                    )
                )
            }
        )
    return records


def _accessible_entity_ids(session, entity_ids: set[str], access) -> set[str]:
    accessible: set[str] = set()
    for chunk in _chunks(entity_ids):
        accessible.update(
            session.scalars(
                select(Entity.id).where(
                    Entity.id.in_(chunk),
                    access,
                )
            )
        )
    return accessible


def _entity_provenance_records(session, entity_ids: set[str], access) -> dict[str, set[str]]:
    result: dict[str, set[str]] = {}
    for chunk in _chunks(entity_ids):
        rows = session.execute(
            select(EntityProvenance.entity_id, EntityProvenance.record_id)
            .join(SourceRecord, SourceRecord.id == EntityProvenance.record_id)
            .where(
                EntityProvenance.entity_id.in_(chunk),
                access,
            )
        )
        for entity_id, record_id in rows:
            result.setdefault(entity_id, set()).add(record_id)
    return result


def _lineage_supports_entity(session, entity_id: str, record_ids: set[str]) -> bool:
    supported: set[str] = set()
    for chunk in _chunks(record_ids):
        supported.update(
            session.scalars(
                select(EntityProvenance.record_id).where(
                    EntityProvenance.entity_id == entity_id,
                    EntityProvenance.record_id.in_(chunk),
                )
            )
        )
        supported.update(
            session.scalars(
                select(Observation.record_id).where(
                    Observation.entity_id == entity_id,
                    Observation.record_id.in_(chunk),
                )
            )
        )
        supported.update(
            session.scalars(
                select(Relationship.record_id).where(
                    Relationship.record_id.in_(chunk),
                    or_(
                        Relationship.from_entity_id == entity_id,
                        Relationship.to_entity_id == entity_id,
                    ),
                )
            )
        )
    return supported == record_ids


def _insert_alert(
    session,
    *,
    dedupe_key: str,
    entity_id: str | None,
    category: str,
    title: str,
    body: str,
    record_ids: set[str],
    generation_kind: str,
    rule_version: str,
    source_id: str | None,
    now: datetime,
) -> tuple[Alert, bool]:
    existing = session.scalar(select(Alert).where(Alert.dedupe_key == dedupe_key))
    if existing is not None:
        return existing, False
    alert = Alert(
        dedupe_key=dedupe_key,
        entity_id=entity_id,
        category=category,
        title=title,
        body=body,
        created_at=now,
    )
    session.add(alert)
    session.flush()
    session.add(
        AlertGeneration(
            alert_id=alert.id,
            kind=generation_kind,
            rule_version=rule_version,
            source_id=source_id,
            created_at=now,
        )
    )
    session.add_all(
        AlertLineage(alert_id=alert.id, record_id=record_id) for record_id in sorted(record_ids)
    )
    return alert, True


def emit_alert(
    repo,
    *,
    dedupe_key: str,
    category: str,
    title: str,
    body: str,
    record_ids: list[str] | tuple[str, ...] | set[str],
    generation_kind: str,
    rule_version: str,
    entity_id: str | None = None,
    source_id: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Store one generated alert only with readable supporting evidence."""
    now = _aware(now)
    dedupe_key = _validated_text(dedupe_key, "deduplication key", 512)
    category = _validated_text(category, "category", 128)
    title = _validated_text(title, "title", 512)
    body = _validated_text(body, "body", 4_000)
    rule_version = _validated_text(rule_version, "rule version", 128)
    if generation_kind not in _GENERATION_KINDS:
        raise ValueError("Invalid alert generation kind")
    identifiers = set(record_ids)
    if any(not isinstance(item, str) or not item for item in identifiers):
        raise ValueError("Alert record identifiers must be non-empty strings")
    if len(identifiers) > 1_000:
        raise ValueError("An alert cannot cite more than 1,000 evidence records")
    if generation_kind == "source_failure":
        if entity_id is not None or identifiers or source_id is None:
            raise ValueError("Source failure alerts must use the generic source form")
        expected_bodies = {
            f"Source {source_id} ended with status {status}. Review source health before retrying."
            for status in _FAILURE_STATES
        }
        if (
            category != "source_failure"
            or title != "Source collection needs attention"
            or body not in expected_bodies
        ):
            raise ValueError("Source failure alerts must use fixed generic text")
    elif entity_id is None or not identifiers:
        raise ValueError("Evidence alerts require an entity and record lineage")
    elif category != generation_kind:
        raise ValueError("Evidence alert category must match its generation kind")

    try:
        with session_scope(repo.engine) as session:
            if source_id is not None and session.get(Source, source_id) is None:
                raise KeyError(f"Unknown source: {source_id}")
            if entity_id is not None:
                entity = session.scalar(
                    select(Entity).where(
                        Entity.id == entity_id,
                        entity_access_clause(session, Entity, now=now),
                    )
                )
                if entity is None:
                    raise KeyError(f"Unknown entity: {entity_id}")
            records = _linked_records(
                session,
                identifiers,
                record_access_clause(session, SourceRecord, now=now),
            )
            if set(records) != identifiers:
                raise KeyError("Alert evidence is unavailable")
            if entity_id is not None and not _lineage_supports_entity(
                session, entity_id, identifiers
            ):
                raise ValueError("Alert evidence does not support its entity")
            alert, _created = _insert_alert(
                session,
                dedupe_key=dedupe_key,
                entity_id=entity_id,
                category=category,
                title=title,
                body=body,
                record_ids=identifiers,
                generation_kind=generation_kind,
                rule_version=rule_version,
                source_id=source_id,
                now=now,
            )
            session.flush()
            return model_dict(alert)
    except IntegrityError:
        with session_scope(repo.engine) as session:
            existing = session.scalar(select(Alert).where(Alert.dedupe_key == dedupe_key))
            if existing is not None:
                return model_dict(existing)
        raise


def emit_source_failure_alert(
    repo,
    *,
    source_id: str,
    status: str,
    event_version: str,
    rule_version: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Emit a generic operational alert without copying an upstream error or response."""
    source_id = _validated_text(source_id, "source identifier", 64)
    event_version = _validated_text(event_version, "event version", 128)
    if status not in _FAILURE_STATES:
        raise ValueError("Source failure status must be blocked or failed")
    key = f"source-failure:{source_id}:{status}:{event_version}:{rule_version}"
    return emit_alert(
        repo,
        dedupe_key=key,
        category="source_failure",
        title="Source collection needs attention",
        body=(
            f"Source {source_id} ended with status {status}. Review source health before retrying."
        ),
        record_ids=[],
        generation_kind="source_failure",
        rule_version=rule_version,
        source_id=source_id,
        now=now,
    )


def _fingerprint(event_key: str, record: Any) -> str:
    material = json.dumps(
        [event_key, record.id, record.revision], separators=(",", ":"), ensure_ascii=True
    )
    return hashlib.sha256(material.encode()).hexdigest()


def _alert_key(prefix: str, entity_id: str, signature: Any, rule_version: str) -> str:
    digest = hashlib.sha256(
        json.dumps(signature, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()
    return f"{prefix}:{entity_id}:{digest}:{rule_version}"


def generate_scoring_alerts(
    repo,
    items: list[dict[str, Any]],
    rule_version: str,
    now: datetime | None = None,
) -> dict[str, int]:
    """Compare a complete scored cohort with durable state and emit bounded rule alerts."""
    now = _aware(now)
    rule_version = _validated_text(rule_version, "rule version", 128)
    if not isinstance(items, list):
        raise ValueError("Scored alert input must be a list")
    entity_ids = {
        str(item.get("entity_id"))
        for item in items
        if isinstance(item, dict) and item.get("entity_id")
    }
    if len(entity_ids) != len(items):
        raise ValueError("Each scored alert item requires a unique entity identifier")
    candidate_record_ids = {
        str(contribution.get("record_id"))
        for item in items
        for contribution in (item.get("contributions") or [])
        if isinstance(contribution, dict) and contribution.get("record_id")
    }
    created = qualifying_events = material_changes = 0
    with session_scope(repo.engine) as session:
        current_record_access = record_access_clause(session, SourceRecord, now=now)
        current_entity_access = entity_access_clause(session, Entity, now=now)
        baseline = (session.scalar(select(func.count()).select_from(AlertScoreState)) or 0) == 0
        states = {
            state.entity_id: state
            for state in session.scalars(
                select(AlertScoreState)
                .where(AlertScoreState.entity_id.in_(entity_ids))
                .with_for_update()
            )
        }
        provenance_records = _entity_provenance_records(session, entity_ids, current_record_access)
        candidate_record_ids.update(
            record_id for record_ids in provenance_records.values() for record_id in record_ids
        )
        candidate_record_ids.update(
            record_id
            for state in states.values()
            for record_id in (state.record_ids or [])
            if isinstance(record_id, str) and record_id
        )
        records = _linked_records(session, candidate_record_ids, current_record_access)
        accessible_entities = _accessible_entity_ids(session, entity_ids, current_entity_access)
        for item in items:
            entity_id = str(item["entity_id"])
            contributions = [
                contribution
                for contribution in (item.get("contributions") or [])
                if isinstance(contribution, dict) and contribution.get("record_id")
            ]
            current_record_ids = {
                str(contribution["record_id"]) for contribution in contributions
            } | provenance_records.get(entity_id, set())
            if entity_id not in accessible_entities or not current_record_ids <= records.keys():
                continue
            event_versions = {}
            for contribution in contributions:
                if contribution.get("qualifies") is not True:
                    continue
                if contribution.get("exclusion_reason") not in (None, ""):
                    continue
                record_id = str(contribution["record_id"])
                event_key = str(contribution.get("event_key") or "")
                if not event_key:
                    continue
                event_versions[_fingerprint(event_key, records[record_id])] = contribution

            previous = states.get(entity_id)
            previous_events = set(previous.event_versions or []) if previous else set()
            if not baseline:
                for version in sorted(set(event_versions) - previous_events):
                    contribution = event_versions[version]
                    record_id = str(contribution["record_id"])
                    _alert, inserted = _insert_alert(
                        session,
                        dedupe_key=_alert_key("qualifying-event", entity_id, version, rule_version),
                        entity_id=entity_id,
                        category="qualifying_event",
                        title="New qualifying event",
                        body=(
                            f"A newly qualifying {contribution.get('kind') or 'evidence'} event "
                            "requires analyst review."
                        ),
                        record_ids={record_id},
                        generation_kind="qualifying_event",
                        rule_version=rule_version,
                        source_id=records[record_id].source_id,
                        now=now,
                    )
                    created += int(inserted)
                    qualifying_events += int(inserted)

            score = float(item.get("score") or 0.0)
            eligible = item.get("eligible") is True
            materially_changed = previous is not None and (
                abs(score - previous.score) >= MATERIAL_SCORE_CHANGE
                or eligible != previous.eligible
            )
            previous_record_ids = set(previous.record_ids or []) if previous else set()
            material_lineage = current_record_ids | previous_record_ids
            if materially_changed and material_lineage and material_lineage <= records.keys():
                signature = {
                    "from_score": previous.score,
                    "to_score": score,
                    "from_eligible": previous.eligible,
                    "to_eligible": eligible,
                    "events": sorted(event_versions),
                }
                _alert, inserted = _insert_alert(
                    session,
                    dedupe_key=_alert_key("material-change", entity_id, signature, rule_version),
                    entity_id=entity_id,
                    category="material_change",
                    title="Material watchlist change",
                    body=(
                        f"The watchlist score changed from {previous.score:.1f} to "
                        f"{score:.1f} points; eligibility is "
                        f"{'met' if eligible else 'not met'}."
                    ),
                    record_ids=material_lineage,
                    generation_kind="material_change",
                    rule_version=rule_version,
                    source_id=None,
                    now=now,
                )
                created += int(inserted)
                material_changes += int(inserted)

            if previous is None:
                session.add(
                    AlertScoreState(
                        entity_id=entity_id,
                        score=score,
                        eligible=eligible,
                        event_versions=sorted(event_versions),
                        record_ids=sorted(current_record_ids),
                        rule_version=rule_version,
                        updated_at=now,
                    )
                )
            else:
                previous.score = score
                previous.eligible = eligible
                previous.event_versions = sorted(event_versions)
                previous.record_ids = sorted(current_record_ids)
                previous.rule_version = rule_version
                previous.updated_at = now
    return {
        "created": created,
        "qualifying_events": qualifying_events,
        "material_changes": material_changes,
    }


__all__ = [
    "MATERIAL_SCORE_CHANGE",
    "emit_alert",
    "emit_source_failure_alert",
    "generate_scoring_alerts",
]
