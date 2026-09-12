"""Evidence-led exposure, relationship review and illustrative timing tools."""

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, StrictInt
from sqlalchemy import func, or_, select

from meritus.api.dependencies import (
    MutationOperatorDep,
    OperatorDep,
    RepositoryDep,
    pagination,
)
from meritus.db import session_scope
from meritus.models import CalendarEntry, Entity, Observation, Relationship, SourceRecord
from meritus.read_access import (
    calendar_access_clause,
    entity_access_clause,
    entity_projection_map,
    record_access_clause,
    relationship_access_clause,
)
from meritus.repository.evidence import _json_value, model_dict
from meritus.workflow.calendar import illustrative_accrual_timing, post_completion_timing
from meritus.workflow.opportunities import (
    possible_introduction_routes,
    project_exposures,
    relationship_review_prompts,
)

router = APIRouter(prefix="/api", tags=["opportunities"])
PageDep = Annotated[tuple[int, int], Depends(pagination)]
INPUT_LIMIT = 5000
RESULT_LIMIT = 10000


@router.get("/opportunities")
def opportunities(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    entity_id: Annotated[str | None, Query(max_length=36)] = None,
):
    del operator
    now = datetime.now(UTC)
    with session_scope(repo.engine) as session:
        relation_query = (
            select(
                *Relationship.__table__.columns,
                SourceRecord.source_id,
                SourceRecord.source_url,
            )
            .outerjoin(SourceRecord, SourceRecord.id == Relationship.record_id)
            .where(
                Relationship.state == "verified",
                Relationship.created_at <= now,
                relationship_access_clause(session, Relationship, now=now),
            )
        )
        if entity_id:
            related_professionals = select(Relationship.from_entity_id).where(
                Relationship.to_entity_id == entity_id
            )
            relation_query = relation_query.where(
                or_(
                    Relationship.from_entity_id == entity_id,
                    Relationship.to_entity_id == entity_id,
                    Relationship.from_entity_id.in_(related_professionals),
                )
            )
        relation_rows = list(
            session.execute(relation_query.order_by(Relationship.id).limit(INPUT_LIMIT + 1))
        )
        inputs_truncated = len(relation_rows) > INPUT_LIMIT
        relations = [
            {key: _json_value(value) for key, value in row._mapping.items()}
            for row in relation_rows[:INPUT_LIMIT]
        ]
        ids = {
            identifier
            for item in relations
            for identifier in (item["from_entity_id"], item["to_entity_id"])
        }
        entities = entity_projection_map(session, ids, now=now)
        observation_rows = list(
            session.execute(
                select(
                    *Observation.__table__.columns, SourceRecord.source_id, SourceRecord.source_url
                )
                .join(SourceRecord, SourceRecord.id == Observation.record_id)
                .where(
                    Observation.entity_id.in_(ids),
                    Observation.kind.in_(["insolvency_event", "insolvency_petition"]),
                    Observation.state == "verified",
                    Observation.occurred_at <= now,
                    SourceRecord.published_at <= now,
                    SourceRecord.observed_at <= now,
                    record_access_clause(session, SourceRecord, now=now),
                )
                .order_by(Observation.id)
                .limit(INPUT_LIMIT + 1)
            )
        )
        inputs_truncated = inputs_truncated or len(observation_rows) > INPUT_LIMIT
        observations = [
            {key: _json_value(value) for key, value in row._mapping.items()}
            for row in observation_rows[:INPUT_LIMIT]
        ]
    values = list(entities.values())
    data = {
        "project_exposures": project_exposures(
            values, observations, relations, result_limit=RESULT_LIMIT + 1
        ),
        "introduction_routes": possible_introduction_routes(values, relations),
        "conflict_review_prompts": relationship_review_prompts(
            values, relations, result_limit=RESULT_LIMIT + 1
        ),
    }
    results_truncated = any(len(items) > RESULT_LIMIT for items in data.values())
    data = {key: items[:RESULT_LIMIT] for key, items in data.items()}
    if entity_id:

        def involves(item):
            participants = [
                item.get(key) or {} for key in ("supplier", "project", "professional", "party")
            ]
            participants.extend(item.get("parties") or [])
            return any(participant.get("id") == entity_id for participant in participants)

        data = {key: [item for item in items if involves(item)] for key, items in data.items()}
    page, size = paging
    start = (page - 1) * size
    return {
        **{key: items[start : start + size] for key, items in data.items()},
        "totals": {key: len(items) for key, items in data.items()},
        "truncated": inputs_truncated or results_truncated,
        "totals_complete": not (inputs_truncated or results_truncated),
        "has_more": {key: start + size < len(items) for key, items in data.items()},
        "page": page,
        "page_size": size,
        "as_of": now.isoformat(),
        "coverage": (
            (
                "Calculation limit reached; totals are lower bounds. "
                "Select an entity to narrow the evidence. "
                if inputs_truncated or results_truncated
                else ""
            )
            + "Only currently readable, verified evidence and documented roles are considered. "
            "These are review prompts, not findings of liability, availability or conflict."
        ),
    }


class TimingInput(BaseModel):
    entity_id: str = Field(min_length=1, max_length=36)
    accrual_date: date
    period_years: StrictInt = Field(ge=1, le=100)
    input_basis: str = Field(min_length=1, max_length=4000)


@router.post("/calendar/timing")
def timing(data: TimingInput, repo: RepositoryDep, operator: MutationOperatorDep):
    with session_scope(repo.engine) as session:
        if (
            session.scalar(
                select(Entity.id).where(
                    Entity.id == data.entity_id, entity_access_clause(session, Entity)
                )
            )
            is None
        ):
            raise KeyError("Unknown entity")
    return {
        "preview": illustrative_accrual_timing(
            data.accrual_date,
            data.period_years,
            input_basis=data.input_basis,
            reviewer=operator.username,
            entity_id=data.entity_id,
        ),
        "persisted": False,
        "actionable": False,
    }


@router.get("/calendar/actionable")
def actionable(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    now = datetime.now(UTC)
    page, size = paging
    with session_scope(repo.engine) as session:
        filters = [
            CalendarEntry.status == "confirmed",
            calendar_access_clause(session, CalendarEntry, now=now),
        ]
        total = session.scalar(select(func.count()).select_from(CalendarEntry).where(*filters)) or 0
        rows = list(
            session.scalars(
                select(CalendarEntry)
                .where(*filters)
                .order_by(CalendarEntry.date, CalendarEntry.id)
                .offset((page - 1) * size)
                .limit(size)
            )
        )
        names = entity_projection_map(session, [row.entity_id for row in rows], now=now)
        items = [
            {**model_dict(row), "entity_name": names[row.entity_id]["name"]}
            for row in rows
            if row.entity_id in names
        ]
    return {"items": items, "total": total, "page": page, "page_size": size}


@router.get("/calendar/{entry_id}/post-completion-window")
def completion_window(entry_id: str, repo: RepositoryDep, operator: OperatorDep):
    del operator
    with session_scope(repo.engine) as session:
        row = session.scalar(
            select(CalendarEntry).where(
                CalendarEntry.id == entry_id, calendar_access_clause(session, CalendarEntry)
            )
        )
        if row is None:
            raise KeyError("Unknown calendar entry")
        return post_completion_timing(model_dict(row))
