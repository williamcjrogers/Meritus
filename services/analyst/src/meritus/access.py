"""Immediate read-boundary predicates for retained source evidence."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import DateTime, Float, Integer, and_, case, cast, func, literal, or_, select

from meritus.models import Entity, EntityProvenance, Review, Source, SourceRecord
from meritus.sources.policy import permission_allows


def _aware(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _source_dict(source: Source | dict[str, Any]) -> dict[str, Any]:
    if isinstance(source, dict):
        return source
    return {
        "id": source.id,
        "permissions": source.permissions or {},
        "requires_permission": source.requires_permission,
    }


def record_allows(record: SourceRecord, source: Source | dict[str, Any], now: datetime) -> bool:
    """Return whether a record may be read now, independently of physical purge."""
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a UTC offset")
    now = _aware(now)
    assert now is not None
    if (
        not record.active
        or record.withdrawn
        or not permission_allows(_source_dict(source), "analyse", now)
    ):
        return False
    expiry = _aware(record.expires_at)
    if record.expires_at is not None and (expiry is None or expiry <= now):
        return False
    payload = record.payload or {}
    if payload.get("erasure"):
        return False
    grant = payload.get("import_permission") or {}
    if not isinstance(grant, dict) or grant.get("denied") is True:
        return False
    content_expiry = grant.get("content_expires_at")
    parsed_content_expiry = _aware(content_expiry)
    if content_expiry not in (None, "") and (
        parsed_content_expiry is None or parsed_content_expiry <= now
    ):
        return False
    permission_expiry = grant.get("expires_at")
    parsed_permission_expiry = _aware(permission_expiry)
    if permission_expiry not in (None, "") and (
        parsed_permission_expiry is None or parsed_permission_expiry <= now
    ):
        return False
    retention_days = grant.get("retention_days")
    observed_at = _aware(record.observed_at)
    retained_past_limit = (
        isinstance(retention_days, int)
        and not isinstance(retention_days, bool)
        and retention_days > 0
        and observed_at is not None
        and observed_at + timedelta(days=retention_days) <= now
    )
    return not retained_past_limit


def permitted_source_ids(session, now: datetime) -> tuple[str, ...]:
    """Return the small reviewed source catalogue currently permitted for analysis."""
    return tuple(
        source.id
        for source in session.scalars(select(Source)).all()
        if permission_allows(_source_dict(source), "analyse", now)
    )


def _json_expiry_after(session, value, now: datetime):
    if session.bind.dialect.name == "sqlite":
        return func.julianday(value) > func.julianday(now.isoformat())
    if session.bind.dialect.name == "postgresql":
        parsed = case(
            (
                func.pg_input_is_valid(value, literal("timestamp with time zone")),
                cast(value, DateTime(timezone=True)),
            ),
            else_=None,
        )
        return parsed > now
    return value > now.isoformat()


def record_access_clause(
    session, record_model=SourceRecord, *, now: datetime | None = None, active_only: bool = True
):
    """Build the SQL equivalent of :func:`record_allows` for API and search queries."""
    now = _aware(now or datetime.now(UTC))
    if now is None:
        raise ValueError("now must include a UTC offset")
    permitted = permitted_source_ids(session, now)
    payload = record_model.payload
    grant = payload["import_permission"]
    content_expiry = grant["content_expires_at"].as_string()
    permission_expiry = grant["expires_at"].as_string()
    retention_days = grant["retention_days"].as_integer()
    if session.bind.dialect.name == "sqlite":
        retained_until = func.julianday(record_model.observed_at) + cast(retention_days, Float)
        retained = retained_until > func.julianday(now.isoformat())
    elif session.bind.dialect.name == "postgresql":
        observed_days = func.extract("epoch", record_model.observed_at) / literal(86400.0)
        now_days = func.extract("epoch", literal(now, type_=DateTime(timezone=True))) / literal(
            86400.0
        )
        retained = observed_days + cast(retention_days, Float) > now_days
    else:
        retained = literal(True)
    # Frozen snapshots may retain older revisions for other sources. The
    # signed Find Case Law grant instead requires the current judgment only.
    current_version_sources = ()
    if not active_only:
        source_grant = session.scalar(
            select(Source.permissions).where(Source.id == "find_case_law")
        )
        if (source_grant or {}).get("current_version_only") is True:
            current_version_sources = ("find_case_law",)
    return and_(
        record_model.source_id.in_(permitted),
        record_model.active.is_(True)
        if active_only
        else or_(
            record_model.active.is_(True),
            record_model.source_id.not_in(current_version_sources),
        ),
        record_model.withdrawn.is_(False),
        or_(record_model.expires_at.is_(None), record_model.expires_at > now),
        payload["erasure"].as_string().is_(None),
        grant["denied"].as_boolean().is_not(True),
        or_(content_expiry.is_(None), _json_expiry_after(session, content_expiry, now)),
        or_(
            permission_expiry.is_(None),
            _json_expiry_after(session, permission_expiry, now),
        ),
        or_(
            retention_days.is_(None),
            cast(retention_days, Integer) <= 0,
            retained,
        ),
    )


def review_lineage_clause(session, review_model=Review, *, now: datetime | None = None):
    """Require source-linked review values to retain readable supporting evidence."""
    now = _aware(now or datetime.now(UTC))
    if now is None:
        raise ValueError("now must include a UTC offset")
    payload = review_model.payload
    record_id = func.coalesce(
        payload["source_record_id"].as_string(), payload["record_id"].as_string()
    )
    source_url = payload["source_url"].as_string()
    source_id = payload["source_id"].as_string()
    permitted = permitted_source_ids(session, now)
    id_record = SourceRecord.__table__.alias("review_id_record")
    url_record = SourceRecord.__table__.alias("review_url_record")
    any_url_record = SourceRecord.__table__.alias("review_any_url_record")
    id_access = or_(
        record_id.is_(None),
        record_id == "",
        select(1)
        .select_from(id_record)
        .where(
            id_record.c.id == record_id,
            record_access_clause(session, id_record.c, now=now),
        )
        .exists(),
    )
    accessible_url = (
        select(1)
        .select_from(url_record)
        .where(
            url_record.c.source_url == source_url,
            record_access_clause(session, url_record.c, now=now),
        )
        .exists()
    )
    url_exists = (
        select(1)
        .select_from(any_url_record)
        .where(any_url_record.c.source_url == source_url)
        .exists()
    )
    url_access = or_(
        source_url.is_(None),
        source_url == "",
        accessible_url,
        and_(~url_exists, source_id.in_(permitted)),
    )
    return and_(
        or_(source_id.is_(None), source_id == "", source_id.in_(permitted)),
        id_access,
        url_access,
    )


def project_entity(session, entity: Entity, *, now: datetime | None = None) -> dict | None:
    """Recompose source-derived entity fields only from evidence readable now."""
    provenance_count = (
        session.scalar(
            select(func.count())
            .select_from(EntityProvenance)
            .where(EntityProvenance.entity_id == entity.id)
        )
        or 0
    )
    rows = session.scalars(
        select(EntityProvenance)
        .join(SourceRecord, SourceRecord.id == EntityProvenance.record_id)
        .where(
            EntityProvenance.entity_id == entity.id,
            record_access_clause(session, SourceRecord, now=now),
        )
        .order_by(EntityProvenance.observed_at, EntityProvenance.id)
    ).all()
    if provenance_count and not rows:
        return None
    properties = deepcopy(entity.properties or {})
    name = entity.name
    verified = entity.verified
    if rows:
        properties = {}
        for row in rows:
            properties.update(deepcopy(row.properties or {}))
        name = rows[-1].name
        verified = any(row.verified for row in rows)
    allowed_sources = set(permitted_source_ids(session, now or datetime.now(UTC)))
    reviews = session.scalars(
        select(Review)
        .where(
            Review.target_type == "entity",
            Review.target_id == entity.id,
            review_lineage_clause(session, Review, now=now),
        )
        .order_by(Review.created_at, Review.id)
    ).all()
    for review in reviews:
        payload = review.payload or {}
        if payload.get("source_id") and payload.get("source_id") not in allowed_sources:
            continue
        if review.action == "update":
            changes = payload.get("changes", payload)
            if "name" in changes:
                name = changes["name"]
            if isinstance(changes.get("properties"), dict):
                properties.update(deepcopy(changes["properties"]))
            if "verified" in changes:
                verified = bool(changes["verified"])
        elif review.action == "verified":
            verified = True
        elif review.action in {"rejected", "pending"}:
            verified = False
    return {
        "id": entity.id,
        "key": entity.key,
        "kind": entity.kind,
        "name": name,
        "scheme": entity.scheme,
        "identifier": entity.identifier,
        "verified": verified,
        "properties": properties,
        "created_at": entity.created_at,
        "updated_at": entity.updated_at,
    }


__all__ = [
    "permitted_source_ids",
    "project_entity",
    "record_access_clause",
    "record_allows",
    "review_lineage_clause",
]
