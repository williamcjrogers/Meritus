"""Rights-aware evidence, entity and relationship read routes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from meritus.api.access import (
    calendar_access_clause,
    entity_access_clause,
    entity_projection_map,
    pipeline_access_clause,
    project_entities,
    projected_entity_name,
    record_access_clause,
    relationship_access_clause,
)
from meritus.api.dependencies import OperatorDep, RepositoryDep, pagination
from meritus.db import session_scope
from meritus.intelligence.service import IntelligenceService
from meritus.models import (
    CalendarEntry,
    Entity,
    Observation,
    PipelineAction,
    Relationship,
    SourceRecord,
)
from meritus.repository.evidence import model_dict

router = APIRouter(prefix="/api", tags=["evidence"])
PageDep = Annotated[tuple[int, int], Depends(pagination)]


def _observation_items(database, repo, statement, now):
    rows = database.scalars(statement).all()
    projections = entity_projection_map(database, (item.entity_id for item in rows), now=now)
    notices = {}
    items = []
    for row in rows:
        entity = projections.get(row.entity_id)
        if entity:
            item = repo._observation_dict(row)
            item.update(entity_name=entity["name"], entity_verified=entity["verified"])
            source = row.record.source
            if source.id not in notices:
                notices[source.id] = {
                    key: source.permissions[key]
                    for key in (
                        "attribution",
                        "distribution_conditions",
                        "redistribution_conditions",
                    )
                    if key in (source.permissions or {})
                }
            item.update(source_name=source.name, source_permissions=notices[source.id])
            items.append(item)
    return items


def _relationship_items(database, repo, statement, now):
    rows = database.scalars(statement).all()
    projections = entity_projection_map(
        database,
        (identifier for row in rows for identifier in (row.from_entity_id, row.to_entity_id)),
        now=now,
    )
    items = []
    for row in rows:
        from_entity = projections.get(row.from_entity_id)
        to_entity = projections.get(row.to_entity_id)
        if from_entity and to_entity:
            item = repo._relationship_dict(row)
            item.update(
                from_entity_name=from_entity["name"],
                from_name=from_entity["name"],
                to_entity_name=to_entity["name"],
                to_name=to_entity["name"],
            )
            items.append(item)
    return items


@router.get("/entities")
def entities(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    q: Annotated[str, Query(max_length=256)] = "",
    kind: Annotated[str | None, Query(max_length=32)] = None,
):
    del operator
    page, page_size = paging
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        name = projected_entity_name(database, Entity, now=now)
        filters = [entity_access_clause(database, Entity, now=now)]
        if q:
            filters.append(or_(name.ilike(f"%{q.strip()}%"), Entity.key.ilike(f"%{q.strip()}%")))
        if kind:
            filters.append(Entity.kind == kind)
        total = database.scalar(select(func.count()).select_from(Entity).where(*filters)) or 0
        rows = database.scalars(
            select(Entity)
            .where(*filters)
            .order_by(name, Entity.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        items = project_entities(database, rows, now=now)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/entities/{entity_id}")
def entity_detail(entity_id: str, repo: RepositoryDep, operator: OperatorDep):
    del operator
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        saved = database.scalar(
            select(Entity).where(
                Entity.id == entity_id, entity_access_clause(database, Entity, now=now)
            )
        )
        if saved is None:
            raise KeyError(f"Unknown entity: {entity_id}")
        entity = project_entities(database, [saved], now=now)[0]
        observations = _observation_items(
            database,
            repo,
            select(Observation)
            .join(SourceRecord, SourceRecord.id == Observation.record_id)
            .options(
                selectinload(Observation.record).selectinload(SourceRecord.source),
                selectinload(Observation.entity),
            )
            .where(
                Observation.entity_id == entity_id,
                record_access_clause(database, SourceRecord, now=now),
            )
            .order_by(SourceRecord.observed_at.desc(), Observation.created_at.desc()),
            now,
        )
        observation_records = select(Observation.record_id).where(
            Observation.entity_id == entity_id
        )
        relationship_records = select(Relationship.record_id).where(
            or_(Relationship.from_entity_id == entity_id, Relationship.to_entity_id == entity_id)
        )
        saved_records = database.scalars(
            select(SourceRecord)
            .options(
                selectinload(SourceRecord.source),
                selectinload(SourceRecord.observations).selectinload(Observation.entity),
            )
            .where(
                SourceRecord.id.in_(observation_records.union(relationship_records)),
                record_access_clause(database, SourceRecord, now=now),
            )
            .order_by(SourceRecord.observed_at.desc(), SourceRecord.revision.desc())
        ).all()
        nested = entity_projection_map(
            database,
            (item.entity_id for record in saved_records for item in record.observations),
            now=now,
        )
        records = []
        for record in saved_records:
            item = repo._record_dict(record)
            for observation in item["observations"]:
                projection = nested.get(observation["entity_id"])
                if projection:
                    observation.update(
                        entity_name=projection["name"], entity_verified=projection["verified"]
                    )
            records.append(item)
        relationships = _relationship_items(
            database,
            repo,
            select(Relationship)
            .options(
                selectinload(Relationship.record).selectinload(SourceRecord.source),
                selectinload(Relationship.from_entity),
                selectinload(Relationship.to_entity),
            )
            .where(
                or_(
                    Relationship.from_entity_id == entity_id,
                    Relationship.to_entity_id == entity_id,
                ),
                relationship_access_clause(database, Relationship, now=now),
            )
            .order_by(Relationship.created_at.desc(), Relationship.id.desc()),
            now,
        )
        calendar = [
            model_dict(item)
            for item in database.scalars(
                select(CalendarEntry)
                .where(
                    CalendarEntry.entity_id == entity_id,
                    calendar_access_clause(database, CalendarEntry, now=now),
                )
                .order_by(CalendarEntry.date, CalendarEntry.id)
            ).all()
        ]
        pipeline = [
            model_dict(item)
            for item in database.scalars(
                select(PipelineAction)
                .where(
                    PipelineAction.entity_id == entity_id,
                    pipeline_access_clause(database, PipelineAction, now=now),
                )
                .order_by(PipelineAction.occurred_at.desc(), PipelineAction.id.desc())
            ).all()
        ]
    # The detail explanation must describe the same current evidence as the live
    # watchlist, including before the first weekly snapshot has been generated.
    watchlist = IntelligenceService(repo).watchlist()
    score = next((item for item in watchlist["items"] if item["entity_id"] == entity_id), None)
    if score:
        score.update(score_as_of=watchlist["as_of"], snapshot_id=None)
    entity.update(
        observations=observations,
        records=records,
        relationships=relationships,
        calendar=calendar,
        pipeline=pipeline,
        score=score,
    )
    return entity


@router.get("/evidence")
def evidence(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    entity_id: Annotated[str | None, Query(max_length=36)] = None,
):
    del operator
    page, page_size = paging
    now = datetime.now(UTC)
    filters = [Observation.entity_id == entity_id] if entity_id else []
    with session_scope(repo.engine) as database:
        access = record_access_clause(database, SourceRecord, now=now)
        total = (
            database.scalar(
                select(func.count())
                .select_from(Observation)
                .join(SourceRecord, SourceRecord.id == Observation.record_id)
                .where(*filters, access)
            )
            or 0
        )
        statement = (
            select(Observation)
            .join(SourceRecord, SourceRecord.id == Observation.record_id)
            .options(
                selectinload(Observation.record).selectinload(SourceRecord.source),
                selectinload(Observation.entity),
            )
            .where(*filters, access)
            .order_by(SourceRecord.observed_at.desc(), Observation.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = _observation_items(database, repo, statement, now)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/relationships")
def relationships(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    entity_id: Annotated[str | None, Query(max_length=36)] = None,
):
    del operator
    page, page_size = paging
    now = datetime.now(UTC)
    filters = (
        [
            or_(
                Relationship.from_entity_id == entity_id,
                Relationship.to_entity_id == entity_id,
            )
        ]
        if entity_id
        else []
    )
    with session_scope(repo.engine) as database:
        access = relationship_access_clause(database, Relationship, now=now)
        total = (
            database.scalar(select(func.count()).select_from(Relationship).where(*filters, access))
            or 0
        )
        statement = (
            select(Relationship)
            .options(
                selectinload(Relationship.record).selectinload(SourceRecord.source),
                selectinload(Relationship.from_entity),
                selectinload(Relationship.to_entity),
            )
            .where(*filters, access)
            .order_by(Relationship.created_at.desc(), Relationship.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = _relationship_items(database, repo, statement, now)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
