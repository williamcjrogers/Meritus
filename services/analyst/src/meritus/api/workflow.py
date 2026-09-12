"""Human review, calendar, pipeline, relationship and import workflows."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, or_, select

from meritus.api.access import (
    calendar_access_clause,
    entity_projection_map,
    pipeline_access_clause,
    review_access_clause,
)
from meritus.api.dependencies import (
    MutationOperatorDep,
    OperatorDep,
    RepositoryDep,
    pagination,
)
from meritus.db import session_scope
from meritus.models import (
    CalendarEntry,
    Observation,
    PipelineAction,
    Relationship,
    Review,
    SourceRecord,
)
from meritus.repository.evidence import model_dict
from meritus.workflow.calendar import create_calendar_entry
from meritus.workflow.imports import ImportService
from meritus.workflow.relationships import add_reviewed_relationship, validate_relationship

router = APIRouter(prefix="/api", tags=["workflow"])
PageDep = Annotated[tuple[int, int], Depends(pagination)]
_PIPELINE_STAGES = {
    "review",
    "shortlisted",
    "introduction_considered",
    "contacted",
    "conversation",
    "instruction",
    "dismissed",
    "snoozed",
}
_DECISIVE_REVIEW_ACTIONS = {
    "accept",
    "verified",
    "reject",
    "rejected",
    "merge",
    "confirm_independence",
    "group_event",
    "withdraw",
}
_REVIEW_STATES = {
    "accept": "verified",
    "verified": "verified",
    "reject": "rejected",
    "rejected": "rejected",
    "merge": "merged",
    "update": "updated",
    "confirm_independence": "confirmed",
    "group_event": "grouped",
    "withdraw": "withdrawn",
    "pending": "pending",
    "reset": "pending",
}


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_type: str = Field(min_length=1, max_length=64)
    target_id: str = Field(min_length=1, max_length=64)
    action: str = Field(min_length=1, max_length=64)
    reason: str = Field(min_length=1, max_length=4000)
    payload: dict[str, Any] = Field(default_factory=dict)


class SnapshotInput(BaseModel):
    kind: Literal["weekly", "digest"]


class ImportPreviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str = Field(min_length=1, max_length=64)
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=1000)
    source_url: str = Field(default="", max_length=4096)
    permission_reference: str | None = Field(default=None, max_length=1000)


class ImportCommitInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=32, max_length=256)


def _review_type(review: Review, entity: dict[str, Any] | None) -> str:
    if review.target_type == "identity_match" or (
        review.target_type == "entity"
        and entity is not None
        and str(entity.get("key") or "").startswith("unresolved:")
    ):
        return "identity"
    if review.target_type == "observation" and review.action in {
        "confirm_independence",
        "group_event",
    }:
        return "independence"
    return review.target_type


def _review_state(database, review: Review, access) -> str:
    state = _REVIEW_STATES.get(review.action, review.action)
    if state != "pending":
        return state
    later = database.scalar(
        select(Review)
        .where(
            access,
            Review.target_type == review.target_type,
            Review.target_id == review.target_id,
            Review.action.in_(_DECISIVE_REVIEW_ACTIONS),
            or_(
                Review.created_at > review.created_at,
                and_(Review.created_at == review.created_at, Review.id > review.id),
            ),
        )
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(1)
    )
    return _REVIEW_STATES.get(later.action, later.action) if later is not None else "pending"


def _target_shape(
    review: Review,
    entities: dict[str, dict[str, Any]],
    observations: dict[str, Observation],
    relationships: dict[str, Relationship],
    records: dict[str, SourceRecord],
) -> tuple[dict[str, Any], str]:
    if review.target_type in {"entity", "identity_match"}:
        entity = entities.get(review.target_id)
        target = {
            "id": review.target_id,
            "type": "entity",
            "name": (entity or {}).get("name"),
            "kind": (entity or {}).get("kind"),
            "scheme": (entity or {}).get("scheme"),
            "identifier": (entity or {}).get("identifier"),
            "verified": bool((entity or {}).get("verified")),
        }
        label = target["name"] or "Unknown entity"
        if review.target_type == "identity_match":
            proposed_id = (review.payload or {}).get("proposed_entity_id")
            proposed = entities.get(str(proposed_id)) if proposed_id else None
            target["proposed_entity"] = (
                {
                    "id": proposed["id"],
                    "name": proposed["name"],
                    "kind": proposed["kind"],
                    "scheme": proposed["scheme"],
                    "identifier": proposed["identifier"],
                    "verified": proposed["verified"],
                }
                if proposed
                else None
            )
            proposed_label = (proposed or {}).get("name") or "unknown proposed identity"
            return target, f"Possible identity match: {label} and {proposed_label}"
        prefix = (
            "Identity review" if _review_type(review, entity) == "identity" else "Entity review"
        )
        return target, f"{prefix}: {label}"
    if review.target_type == "observation":
        observation = observations.get(review.target_id)
        target = {
            "id": review.target_id,
            "type": "observation",
            "kind": observation.kind if observation else None,
            "state": observation.state if observation else None,
        }
        return target, observation.headline if observation else "Observation review"
    if review.target_type == "relationship":
        relationship = relationships.get(review.target_id)
        target = {
            "id": review.target_id,
            "type": "relationship",
            "role": relationship.role if relationship else None,
            "state": relationship.state if relationship else None,
        }
        return target, f"Relationship review: {target['role'] or 'relationship'}"
    record = records.get(review.target_id)
    target = {
        "id": review.target_id,
        "type": "source_record",
        "title": record.title if record else None,
    }
    return target, f"Evidence review: {target['title'] or 'source record'}"


def _allowed_review_actions(review_type: str, target_type: str, state: str) -> list[str]:
    if state != "pending":
        return []
    if review_type == "identity":
        return ["merge", "reject", "update"]
    if review_type == "independence":
        return ["confirm_independence", "reject"]
    return {
        "entity": ["accept", "reject", "update"],
        "observation": ["accept", "reject", "update"],
        "relationship": ["accept", "reject", "update"],
        "source_record": ["withdraw"],
    }.get(target_type, [])


def _raise_hidden_record(exc: ValueError) -> None:
    message = str(exc)
    if "source_record_id" in message or "no readable source record" in message:
        raise KeyError("Unknown source record") from exc
    raise exc


@router.get("/reviews")
def reviews(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    page, page_size = paging
    with session_scope(repo.engine) as database:
        access = review_access_clause(database, Review)
        total = database.scalar(select(func.count()).select_from(Review).where(access)) or 0
        rows = database.scalars(
            select(Review)
            .where(access)
            .order_by(Review.created_at.desc(), Review.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        entity_ids = {
            identifier
            for item in rows
            for identifier in (item.target_id, (item.payload or {}).get("proposed_entity_id"))
            if item.target_type in {"entity", "identity_match"} and identifier
        }
        entities = entity_projection_map(database, entity_ids)
        observation_ids = [item.target_id for item in rows if item.target_type == "observation"]
        relationship_ids = [item.target_id for item in rows if item.target_type == "relationship"]
        record_ids = [item.target_id for item in rows if item.target_type == "source_record"]
        observations = {
            item.id: item
            for item in database.scalars(
                select(Observation).where(Observation.id.in_(observation_ids))
            ).all()
        }
        relationships = {
            item.id: item
            for item in database.scalars(
                select(Relationship).where(Relationship.id.in_(relationship_ids))
            ).all()
        }
        records = {
            item.id: item
            for item in database.scalars(
                select(SourceRecord).where(SourceRecord.id.in_(record_ids))
            ).all()
        }
        items = []
        for row in rows:
            entity = entities.get(row.target_id)
            review_type = _review_type(row, entity)
            state = _review_state(database, row, access)
            target, headline = _target_shape(row, entities, observations, relationships, records)
            items.append(
                {
                    **model_dict(row),
                    "review_type": review_type,
                    "state": state,
                    "headline": headline,
                    "target": target,
                    "allowed_actions": _allowed_review_actions(review_type, row.target_type, state),
                }
            )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/reviews")
def save_review(data: ReviewInput, repo: RepositoryDep, operator: MutationOperatorDep):
    return repo.record_review(
        data.target_type,
        data.target_id,
        data.action,
        data.reason,
        operator.username,
        data.payload,
    )


@router.get("/calendar")
def calendar(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    page, page_size = paging
    with session_scope(repo.engine) as database:
        access = calendar_access_clause(database, CalendarEntry)
        total = database.scalar(select(func.count()).select_from(CalendarEntry).where(access)) or 0
        rows = database.scalars(
            select(CalendarEntry)
            .where(access)
            .order_by(CalendarEntry.date, CalendarEntry.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        entities = entity_projection_map(database, (item.entity_id for item in rows))
        items = [
            {**model_dict(item), "entity_name": entities[item.entity_id]["name"]} for item in rows
        ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/calendar")
def save_calendar(data: dict[str, Any], repo: RepositoryDep, operator: MutationOperatorDep):
    if len(str(data)) > 100_000:
        raise ValueError("Calendar input is too large")
    try:
        return create_calendar_entry(repo, {**data, "reviewer": operator.username})
    except ValueError as exc:
        _raise_hidden_record(exc)


@router.get("/pipeline")
def pipeline(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    page, page_size = paging
    with session_scope(repo.engine) as database:
        access = pipeline_access_clause(database, PipelineAction)
        total = database.scalar(select(func.count()).select_from(PipelineAction).where(access)) or 0
        rows = database.scalars(
            select(PipelineAction)
            .where(access)
            .order_by(PipelineAction.occurred_at.desc(), PipelineAction.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        entities = entity_projection_map(database, (item.entity_id for item in rows))
        items = [
            {**model_dict(item), "entity_name": entities[item.entity_id]["name"]} for item in rows
        ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/pipeline")
def save_pipeline(data: dict[str, Any], repo: RepositoryDep, operator: MutationOperatorDep):
    allowed = {"entity_id", "stage", "note"}
    unknown = set(data) - allowed
    if unknown:
        raise ValueError(f"Unknown pipeline fields: {', '.join(sorted(unknown))}")
    if not str(data.get("entity_id") or "").strip() or not str(data.get("stage") or "").strip():
        raise ValueError("Pipeline entity and stage are required")
    if data["stage"] not in _PIPELINE_STAGES:
        raise ValueError("Pipeline stage is not recognised")
    if len(str(data.get("note") or "")) > 10_000:
        raise ValueError("Pipeline note is too long")
    return repo.add_pipeline_action(
        {
            **data,
            "actor": operator.username,
            "occurred_at": datetime.now(UTC),
        }
    )


@router.post("/relationships")
def save_relationship(data: dict[str, Any], repo: RepositoryDep, operator: MutationOperatorDep):
    payload = dict(data)
    supplied_reason = str(payload.pop("reason", "") or "").strip()
    validate_relationship(payload)
    source_evidence = bool(
        payload.get("evidence_mode") == "source"
        or payload.get("source_record_id")
        or payload.get("source_url")
    )
    if not source_evidence and not supplied_reason:
        raise ValueError("A human-evidenced relationship requires a review reason")
    reason = supplied_reason or "Relationship recorded with cited evidence"
    try:
        return add_reviewed_relationship(repo, payload, operator.username, reason)
    except ValueError as exc:
        _raise_hidden_record(exc)


@router.post("/imports/preview")
def preview_import(data: ImportPreviewInput, repo: RepositoryDep, operator: MutationOperatorDep):
    del operator
    try:
        parsed = urlsplit(data.source_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Import source URL is invalid") from exc
    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=400, detail="Import source URL contains prohibited credentials"
        )
    result = ImportService(repo).preview(
        data.kind, data.rows, data.source_url, data.permission_reference
    )
    return result


@router.post("/imports/commit")
def commit_import(data: ImportCommitInput, repo: RepositoryDep, operator: MutationOperatorDep):
    return ImportService(repo).commit(data.token, operator.username)
