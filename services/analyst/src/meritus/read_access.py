"""Rights-aware SQL projections for services and browser-facing reads."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import aliased

from meritus.access import permitted_source_ids, record_access_clause, review_lineage_clause
from meritus.models import (
    Alert,
    AlertGeneration,
    AlertLineage,
    CalendarEntry,
    Entity,
    EntityProvenance,
    Observation,
    PipelineAction,
    Relationship,
    Review,
    SourceRecord,
)
from meritus.repository.evidence import model_dict

_MERGE_MARKERS = {
    "merge_redirect_review_id",
    "merge_review_id",
    "merged_into_entity_id",
}


def _apply_entity_reviews(
    item: dict[str, Any], reviews: list[Review], allowed_sources: set[str]
) -> None:
    for review in reviews:
        payload = review.payload or {}
        if payload.get("source_id") and payload.get("source_id") not in allowed_sources:
            continue
        if review.action == "update":
            changes = payload.get("changes", payload)
            if "name" in changes:
                item["name"] = changes["name"]
            if "scheme" in changes:
                item["scheme"] = changes["scheme"]
            if "identifier" in changes:
                item["identifier"] = changes["identifier"]
            if isinstance(changes.get("properties"), dict):
                item["properties"].update(deepcopy(changes["properties"]))
            if "verified" in changes:
                item["verified"] = bool(changes["verified"])
        elif review.action == "verified":
            item["verified"] = True
        elif review.action in {"rejected", "pending"}:
            item["verified"] = False


def _entity_provenance_exists(entity_model=Entity):
    provenance = aliased(EntityProvenance)
    return exists(select(1).where(provenance.entity_id == entity_model.id))


def entity_access_clause(session, entity_model=Entity, *, now: datetime | None = None):
    """Allow analyst-only entities and source entities with a permitted contribution."""
    provenance = aliased(EntityProvenance)
    record = aliased(SourceRecord)
    permitted = exists(
        select(1)
        .select_from(provenance)
        .join(record, record.id == provenance.record_id)
        .where(
            provenance.entity_id == entity_model.id,
            record_access_clause(session, record, now=now),
        )
    )
    return or_(~_entity_provenance_exists(entity_model), permitted)


def projected_entity_name(session, entity_model=Entity, *, now: datetime | None = None):
    provenance = aliased(EntityProvenance)
    record = aliased(SourceRecord)
    latest = (
        select(provenance.name)
        .join(record, record.id == provenance.record_id)
        .where(
            provenance.entity_id == entity_model.id,
            record_access_clause(session, record, now=now),
        )
        .order_by(provenance.observed_at.desc(), provenance.id.desc())
        .limit(1)
        .correlate(entity_model)
        .scalar_subquery()
    )
    return func.coalesce(latest, entity_model.name)


def project_entities(
    session,
    entities: list[Entity],
    *,
    now: datetime | None = None,
    record_filter=None,
    provenance_rows=None,
    sourced_ids=None,
    allowed_sources: set[str] | None = None,
    review_filter=None,
):
    if not entities:
        return []
    identifiers = [entity.id for entity in entities]
    alias_ids = {
        str(identity.get("entity_id"))
        for entity in entities
        for identity in (entity.properties or {}).get("source_identities", [])
        if isinstance(identity, dict) and identity.get("entity_id")
    }
    alias_entities = {
        entity.id: entity
        for entity in session.scalars(select(Entity).where(Entity.id.in_(alias_ids))).all()
    }
    if provenance_rows is None:
        rows = session.scalars(
            select(EntityProvenance)
            .join(SourceRecord, SourceRecord.id == EntityProvenance.record_id)
            .where(
                EntityProvenance.entity_id.in_(identifiers),
                record_filter
                if record_filter is not None
                else record_access_clause(session, SourceRecord, now=now),
            )
            .order_by(EntityProvenance.observed_at, EntityProvenance.id)
        ).all()
    else:
        rows = provenance_rows
    contributions: dict[str, list[EntityProvenance]] = {}
    for row in rows:
        contributions.setdefault(row.entity_id, []).append(row)
    alias_rows = session.scalars(
        select(EntityProvenance)
        .join(SourceRecord, SourceRecord.id == EntityProvenance.record_id)
        .where(
            EntityProvenance.entity_id.in_(alias_ids),
            record_filter
            if record_filter is not None
            else record_access_clause(session, SourceRecord, now=now),
        )
        .order_by(EntityProvenance.observed_at, EntityProvenance.id)
    ).all()
    alias_contributions: dict[str, list[EntityProvenance]] = {}
    for row in alias_rows:
        alias_contributions.setdefault(row.entity_id, []).append(row)
    if sourced_ids is None:
        sourced_ids = set(
            session.scalars(
                select(EntityProvenance.entity_id)
                .where(EntityProvenance.entity_id.in_([*identifiers, *alias_ids]))
                .distinct()
            )
        )
    if allowed_sources is None:
        allowed_sources = set(permitted_source_ids(session, now or datetime.now(UTC)))
    reviews: dict[str, list[Review]] = {}
    review_conditions = [
        Review.target_type == "entity",
        Review.target_id.in_([*identifiers, *alias_ids]),
        review_lineage_clause(session, Review, now=now),
    ]
    if review_filter is not None:
        review_conditions.append(review_filter)
    for row in session.scalars(
        select(Review).where(*review_conditions).order_by(Review.created_at, Review.id)
    ):
        reviews.setdefault(row.target_id, []).append(row)
    projected = []
    for entity in entities:
        item = model_dict(entity)
        source_rows = contributions.get(entity.id, [])
        item["provenance_record_ids"] = [row.record_id for row in source_rows]
        if entity.id in sourced_ids and not source_rows:
            continue
        if source_rows:
            properties: dict[str, Any] = {}
            for row in source_rows:
                properties.update(deepcopy(row.properties or {}))
            item.update(
                name=source_rows[-1].name,
                properties=properties,
                verified=any(row.verified for row in source_rows),
            )
        _apply_entity_reviews(item, reviews.get(entity.id, []), allowed_sources)
        raw_properties = entity.properties or {}
        item["properties"].pop("source_identities", None)
        item["properties"].update(
            {key: raw_properties[key] for key in _MERGE_MARKERS if key in raw_properties}
        )
        safe_aliases = []
        for identity in raw_properties.get("source_identities", []):
            if not isinstance(identity, dict):
                continue
            alias_id = str(identity.get("entity_id") or "")
            alias = alias_entities.get(alias_id)
            alias_source_rows = alias_contributions.get(alias_id, [])
            if alias is None or (alias_id in sourced_ids and not alias_source_rows):
                continue
            alias_item = model_dict(alias)
            if alias_source_rows:
                alias_item.update(
                    name=alias_source_rows[-1].name,
                    properties={},
                    verified=any(row.verified for row in alias_source_rows),
                )
            _apply_entity_reviews(alias_item, reviews.get(alias_id, []), allowed_sources)
            safe_aliases.append(
                {
                    "entity_id": alias.id,
                    "key": alias.key,
                    "name": alias_item["name"],
                    "scheme": alias_item["scheme"],
                    "identifier": alias_item["identifier"],
                }
            )
        if safe_aliases:
            item["properties"]["source_identities"] = safe_aliases
        projected.append(item)
    return projected


def entity_projection_map(
    session,
    entity_ids,
    *,
    now: datetime | None = None,
    record_filter=None,
    allowed_sources: set[str] | None = None,
    review_filter=None,
):
    identifiers = {str(identifier) for identifier in entity_ids if identifier}
    if not identifiers:
        return {}
    rows = session.scalars(
        select(Entity).where(
            Entity.id.in_(identifiers), entity_access_clause(session, Entity, now=now)
        )
    ).all()
    return {
        item["id"]: item
        for item in project_entities(
            session,
            rows,
            now=now,
            record_filter=record_filter,
            allowed_sources=allowed_sources,
            review_filter=review_filter,
        )
    }


def relationship_access_clause(
    session, relationship_model=Relationship, *, now: datetime | None = None
):
    record = aliased(SourceRecord)
    source_allowed = or_(
        relationship_model.record_id.is_(None),
        exists(
            select(1).where(
                record.id == relationship_model.record_id,
                record_access_clause(session, record, now=now),
            )
        ),
    )
    from_entity = aliased(Entity)
    to_entity = aliased(Entity)
    matter_entity = aliased(Entity)
    matter_id = relationship_model.attributes["matter_entity_id"].as_string()
    return and_(
        source_allowed,
        or_(
            matter_id.is_(None),
            matter_id == "",
            exists(
                select(1).where(
                    matter_entity.id == matter_id,
                    entity_access_clause(session, matter_entity, now=now),
                )
            ),
        ),
        exists(
            select(1).where(
                from_entity.id == relationship_model.from_entity_id,
                entity_access_clause(session, from_entity, now=now),
            )
        ),
        exists(
            select(1).where(
                to_entity.id == relationship_model.to_entity_id,
                entity_access_clause(session, to_entity, now=now),
            )
        ),
    )


def calendar_access_clause(session, calendar_model=CalendarEntry, *, now=None):
    entity = aliased(Entity)
    record = aliased(SourceRecord)
    record_id = calendar_model.evidence["source_record_id"].as_string()
    return and_(
        exists(
            select(1).where(
                entity.id == calendar_model.entity_id,
                entity_access_clause(session, entity, now=now),
            )
        ),
        or_(
            record_id.is_(None),
            exists(
                select(1).where(
                    record.id == record_id,
                    record_access_clause(session, record, now=now),
                )
            ),
        ),
    )


def pipeline_access_clause(session, pipeline_model=PipelineAction, *, now=None):
    entity = aliased(Entity)
    return exists(
        select(1).where(
            entity.id == pipeline_model.entity_id,
            entity_access_clause(session, entity, now=now),
        )
    )


def alert_access_clause(session, alert_model=Alert, *, now=None):
    entity = aliased(Entity)
    provenance = aliased(EntityProvenance)
    lineage = aliased(AlertLineage)
    record = aliased(SourceRecord)
    generation = aliased(AlertGeneration)
    has_lineage = exists(select(1).where(lineage.alert_id == alert_model.id))
    inaccessible_lineage = exists(
        select(1).where(
            lineage.alert_id == alert_model.id,
            ~exists(
                select(1).where(
                    record.id == lineage.record_id,
                    record_access_clause(session, record, now=now),
                )
            ),
        )
    )
    safe_source_failure = exists(
        select(1).where(
            generation.alert_id == alert_model.id,
            generation.kind == "source_failure",
            generation.source_id.is_not(None),
        )
    )
    entity_allowed = exists(
        select(1).where(
            entity.id == alert_model.entity_id,
            entity_access_clause(session, entity, now=now),
        )
    )
    analyst_only = ~exists(select(1).where(provenance.entity_id == alert_model.entity_id))
    return or_(
        and_(
            alert_model.entity_id.is_(None),
            ~has_lineage,
            safe_source_failure,
        ),
        and_(
            alert_model.entity_id.is_not(None),
            entity_allowed,
            or_(
                and_(has_lineage, ~inaccessible_lineage),
                and_(~has_lineage, analyst_only),
            ),
        ),
    )


def review_access_clause(session, review_model=Review, *, now=None):
    entity = aliased(Entity)
    proposed = aliased(Entity)
    observation = aliased(Observation)
    observation_record = aliased(SourceRecord)
    relationship = aliased(Relationship)
    source_record = aliased(SourceRecord)
    payload_source = review_model.payload["source_id"].as_string()
    source_ids = permitted_source_ids(session, now or datetime.now(UTC))
    source_payload_allowed = or_(payload_source.is_(None), payload_source.in_(source_ids))
    return and_(
        source_payload_allowed,
        review_lineage_clause(session, review_model, now=now),
        or_(
            and_(
                review_model.target_type == "entity",
                exists(
                    select(1).where(
                        entity.id == review_model.target_id,
                        entity_access_clause(session, entity, now=now),
                    )
                ),
            ),
            and_(
                review_model.target_type == "identity_match",
                exists(
                    select(1).where(
                        entity.id == review_model.target_id,
                        entity_access_clause(session, entity, now=now),
                    )
                ),
                exists(
                    select(1).where(
                        proposed.id == review_model.payload["proposed_entity_id"].as_string(),
                        entity_access_clause(session, proposed, now=now),
                    )
                ),
            ),
            and_(
                review_model.target_type == "observation",
                exists(
                    select(1)
                    .select_from(observation)
                    .join(observation_record, observation_record.id == observation.record_id)
                    .where(
                        observation.id == review_model.target_id,
                        record_access_clause(session, observation_record, now=now),
                    )
                ),
            ),
            and_(
                review_model.target_type == "relationship",
                exists(
                    select(1).where(
                        relationship.id == review_model.target_id,
                        relationship_access_clause(session, relationship, now=now),
                    )
                ),
            ),
            and_(
                review_model.target_type == "source_record",
                exists(
                    select(1).where(
                        source_record.id == review_model.target_id,
                        record_access_clause(session, source_record, now=now),
                    )
                ),
            ),
        ),
    )


def accessible_record_ids(
    session, identifiers, *, now=None, active_only=True, source_ids=None
) -> set[str]:
    values = sorted({str(identifier) for identifier in identifiers if identifier})
    permitted = set()
    for offset in range(0, len(values), 5000):
        conditions = [
            SourceRecord.id.in_(values[offset : offset + 5000]),
            record_access_clause(session, SourceRecord, now=now, active_only=active_only),
        ]
        if source_ids is not None:
            conditions.append(SourceRecord.source_id.in_(source_ids))
        permitted.update(session.scalars(select(SourceRecord.id).where(*conditions)))
    return permitted


def _review_source_filter(session, allowed_sources: set[str], now: datetime, *, active_only: bool):
    """Constrain source-linked review values to records usable for this projection."""
    payload = Review.payload
    source_id = payload["source_id"].as_string()
    record_id = func.coalesce(
        payload["source_record_id"].as_string(), payload["record_id"].as_string()
    )
    source_url = payload["source_url"].as_string()
    id_record = SourceRecord.__table__.alias("projection_review_id_record")
    url_record = SourceRecord.__table__.alias("projection_review_url_record")
    any_url_record = SourceRecord.__table__.alias("projection_review_any_url_record")

    def record_allowed(record):
        return and_(
            record.c.source_id.in_(allowed_sources),
            record_access_clause(session, record.c, now=now, active_only=active_only),
        )

    id_access = or_(
        record_id.is_(None),
        record_id == "",
        select(1)
        .select_from(id_record)
        .where(id_record.c.id == record_id, record_allowed(id_record))
        .exists(),
    )
    accessible_url = (
        select(1)
        .select_from(url_record)
        .where(url_record.c.source_url == source_url, record_allowed(url_record))
        .exists()
    )
    url_exists = (
        select(1)
        .select_from(any_url_record)
        .where(any_url_record.c.source_url == source_url)
        .exists()
    )
    return and_(
        or_(source_id.is_(None), source_id == "", source_id.in_(allowed_sources)),
        id_access,
        or_(
            source_url.is_(None),
            source_url == "",
            accessible_url,
            and_(~url_exists, source_id.in_(allowed_sources)),
        ),
    )


def sanitise_ranked_items(
    session,
    items,
    *,
    rule_version=None,
    knowledge_cutoff=None,
    now=None,
    applied_rules=None,
    frozen_inputs=None,
    export_policy=None,
):
    from meritus.outputs.reports import _permitted_items

    now = now or datetime.now(UTC)
    original = deepcopy(list(items or []))
    frozen_entities = {item["id"]: item for item in (frozen_inputs or {}).get("entities", [])}
    record_ids = {
        contribution.get("record_id")
        for item in original
        for contribution in item.get("contributions") or []
        if contribution.get("record_id")
    }
    record_ids.update(
        identifier
        for entity in frozen_entities.values()
        for identifier in entity.get("provenance_record_ids", [])
    )
    analysis_sources = set(permitted_source_ids(session, now))
    if export_policy is None:
        allowed_sources = analysis_sources
        effective_policy = {source_id: True for source_id in allowed_sources}
        record_filter = None
        review_filter = None
    else:
        allowed_sources = {
            source_id
            for source_id, permitted in export_policy.items()
            if permitted is True and source_id in analysis_sources
        }
        effective_policy = {
            source_id: permitted is True and source_id in allowed_sources
            for source_id, permitted in export_policy.items()
        }
        active_only = frozen_inputs is None
        record_filter = and_(
            SourceRecord.source_id.in_(allowed_sources),
            record_access_clause(session, SourceRecord, now=now, active_only=active_only),
        )
        review_filter = _review_source_filter(
            session, allowed_sources, now, active_only=active_only
        )
    allowed_records = accessible_record_ids(
        session,
        record_ids,
        now=now,
        active_only=frozen_inputs is None,
        source_ids=allowed_sources,
    )
    for item in original:
        for contribution in item.get("contributions") or []:
            record_id = contribution.get("record_id")
            contribution["export_permitted"] = (
                not record_id or record_id in allowed_records
            ) and contribution.get("source_id") in allowed_sources
    payload = {
        "items": original,
        "rule_version": rule_version or "meritus-v1",
        "knowledge_cutoff": knowledge_cutoff or now.isoformat(),
        "export_policy": effective_policy,
    }
    if applied_rules:
        payload["applied_rules"] = applied_rules
    permitted = _permitted_items({"rule_version": rule_version, "payload": payload})
    frozen_review_ids_by_entity: dict[str, set[str]] = {}
    for row in (frozen_inputs or {}).get("reviews", []):
        if (
            isinstance(row, dict)
            and row.get("id")
            and row.get("target_type") == "entity"
            and row.get("target_id")
        ):
            frozen_review_ids_by_entity.setdefault(str(row["target_id"]), set()).add(str(row["id"]))
    frozen_review_ids = {
        identifier
        for identifiers in frozen_review_ids_by_entity.values()
        for identifier in identifiers
    }
    review_conditions = [review_access_clause(session, Review, now=now)]
    if review_filter is not None:
        review_conditions.append(review_filter)
    allowed_review_ids = (
        set(
            session.scalars(
                select(Review.id).where(Review.id.in_(frozen_review_ids), *review_conditions)
            )
        )
        if frozen_review_ids
        else set()
    )
    fallback_entity_ids = set()
    preserve_by_entity: dict[str, bool] = {}
    for item in permitted:
        entity_id = str(item.get("entity_id"))
        frozen = frozen_entities.get(entity_id, {})
        preserve_frozen = (
            "provenance_record_ids" in frozen
            and set(frozen["provenance_record_ids"]) <= allowed_records
            and frozen_review_ids_by_entity.get(entity_id, set()) <= allowed_review_ids
        )
        preserve_by_entity[entity_id] = preserve_frozen
        if not preserve_frozen:
            fallback_entity_ids.add(item.get("entity_id"))
    projections = (
        entity_projection_map(
            session,
            fallback_entity_ids,
            now=now,
            record_filter=record_filter,
            allowed_sources=allowed_sources,
            review_filter=review_filter,
        )
        if fallback_entity_ids
        else {}
    )
    fallback_reviews = (
        list(
            session.scalars(
                select(Review)
                .where(
                    Review.target_type == "entity",
                    Review.target_id.in_(fallback_entity_ids),
                    *review_conditions,
                )
                .order_by(Review.created_at, Review.id)
            )
        )
        if fallback_entity_ids
        else []
    )
    latest_review = {row.target_id: row for row in fallback_reviews}
    result = []
    for item in permitted:
        entity_id = str(item.get("entity_id"))
        preserve_frozen = preserve_by_entity[entity_id]
        if preserve_frozen:
            result.append(item)
            continue
        entity = projections.get(entity_id)
        if entity is None:
            continue
        item["name"] = entity["name"]
        item["subject"] = entity["name"]
        properties = entity.get("properties") or {}
        for field in ("sector", "geography", "lead_time_band", "suggested_review_route"):
            item[field] = properties.get(field)
        review = latest_review.get(entity_id)
        item["reviewer"] = review.actor if review else properties.get("reviewer")
        item["review_state"] = (
            "merged"
            if review and review.action == "merge"
            else "rejected"
            if review and review.action in {"reject", "rejected"}
            else "pending"
            if review and review.action in {"pending", "reset"}
            else "verified"
            if entity.get("verified")
            else "pending"
        )
        if frozen_inputs is not None:
            item["change_since_previous"] = None
        result.append(item)
    return result


__all__ = [
    "accessible_record_ids",
    "alert_access_clause",
    "calendar_access_clause",
    "entity_access_clause",
    "entity_projection_map",
    "pipeline_access_clause",
    "project_entities",
    "projected_entity_name",
    "record_access_clause",
    "relationship_access_clause",
    "review_access_clause",
    "sanitise_ranked_items",
]
