"""Rankings, snapshots, metrics and retained export routes."""

from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from meritus.api.access import (
    alert_access_clause,
    entity_access_clause,
    entity_projection_map,
    pipeline_access_clause,
    record_access_clause,
    review_access_clause,
    sanitise_ranked_items,
)
from meritus.api.dependencies import (
    MutationOperatorDep,
    OperatorDep,
    RepositoryDep,
    SettingsDep,
    list_envelope,
    pagination,
)
from meritus.db import session_scope
from meritus.intelligence.cache import materialise
from meritus.intelligence.service import IntelligenceService
from meritus.models import (
    Alert,
    Entity,
    PipelineAction,
    Review,
    Snapshot,
    SourceRecord,
)
from meritus.outputs.metrics import build_metrics
from meritus.outputs.reports import render_csv, render_html
from meritus.repository.evidence import model_dict
from meritus.retention import purge_expired
from meritus.sources.policy import permission_allows

router = APIRouter(prefix="/api", tags=["intelligence"])
PageDep = Annotated[tuple[int, int], Depends(pagination)]
_INTELLIGENCE_LOCK = Lock()


class SnapshotInput(BaseModel):
    kind: Literal["weekly", "digest"]


@router.get("/dashboard")
def dashboard(repo: RepositoryDep, operator: OperatorDep):
    del operator
    with _INTELLIGENCE_LOCK:
        data = materialise(repo, "dashboard", lambda: IntelligenceService(repo).dashboard())
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        record_counts = dict(
            database.execute(
                select(SourceRecord.source_id, func.count())
                .where(record_access_clause(database, SourceRecord, now=now))
                .group_by(SourceRecord.source_id)
            ).all()
        )
        allowed_reviews = set(
            database.scalars(
                select(Review.id).where(review_access_clause(database, Review, now=now))
            )
        )
        allowed_pipeline = set(
            database.scalars(
                select(PipelineAction.id).where(
                    pipeline_access_clause(database, PipelineAction, now=now)
                )
            )
        )
        data["recent_activity"] = [
            item
            for item in data.get("recent_activity", [])
            if (item.get("type") == "review" and item.get("id") in allowed_reviews)
            or (item.get("type") == "pipeline" and item.get("id") in allowed_pipeline)
        ]
        allowed_alerts = set(
            database.scalars(select(Alert.id).where(alert_access_clause(database, Alert, now=now)))
        )
        data["alerts"] = [
            item for item in data.get("alerts", []) if item.get("id") in allowed_alerts
        ]
        permitted_entities = (
            database.scalar(
                select(func.count())
                .select_from(Entity)
                .where(entity_access_clause(database, Entity, now=now))
            )
            or 0
        )
    for source in data.get("source_health", []):
        source["record_count_at_cutoff"] = record_counts.get(source.get("source_id"), 0)
    data["summary"].update(
        entities=permitted_entities,
        ranked=len(data["watchlist"]),
        eligible=sum(bool(item.get("eligible")) for item in data["watchlist"]),
    )
    return data


@router.get("/watchlist")
def watchlist(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    q: Annotated[str | None, Query(max_length=256)] = None,
    kind: Annotated[str | None, Query(max_length=32)] = None,
    stage: Annotated[str | None, Query(max_length=64)] = None,
    source: Annotated[str | None, Query(max_length=64)] = None,
    eligible: bool | None = None,
    sector: Annotated[str | None, Query(max_length=256)] = None,
    geography: Annotated[str | None, Query(max_length=256)] = None,
    lead_time_band: Annotated[str | None, Query(max_length=64)] = None,
    reviewer: Annotated[str | None, Query(max_length=256)] = None,
    review_state: Annotated[str | None, Query(max_length=64)] = None,
    signal_family: Annotated[str | None, Query(max_length=64)] = None,
    change_since_previous: Annotated[str | None, Query(max_length=64)] = None,
):
    del operator
    service = IntelligenceService(repo)
    with _INTELLIGENCE_LOCK:
        data = service.watchlist(
            q=q,
            kind=kind,
            stage=stage,
            source=source,
            eligible=eligible,
            sector=sector,
            geography=geography,
            lead_time_band=lead_time_band,
            reviewer=reviewer,
            review_state=review_state,
            signal_family=signal_family,
        )
    items = data["items"]
    if change_since_previous:
        if change_since_previous == "material":
            items = [
                item for item in items if item.get("change_since_previous") not in {None, 0, "none"}
            ]
        elif change_since_previous == "none":
            items = [
                item for item in items if item.get("change_since_previous") in {None, 0, "none"}
            ]
        else:
            raise ValueError("change_since_previous must be material or none")
    envelope = list_envelope(items, *paging)
    envelope.update(
        as_of=data["as_of"], rule_version=data["rule_version"], coverage=data.get("coverage")
    )
    return envelope


@router.get("/snapshots")
def snapshots(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    page, page_size = paging
    with session_scope(repo.engine) as database:
        visible = Snapshot.redacted_at.is_(None)
        total = database.scalar(select(func.count()).select_from(Snapshot).where(visible)) or 0
        rows = database.execute(
            select(
                Snapshot.id,
                Snapshot.kind,
                Snapshot.as_of,
                Snapshot.rule_version,
                Snapshot.created_at,
                Snapshot.redacted_at,
            )
            .where(visible)
            .order_by(Snapshot.as_of.desc(), Snapshot.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        items = [
            {
                "id": row.id,
                "kind": row.kind,
                "as_of": row.as_of.isoformat(),
                "rule_version": row.rule_version,
                "created_at": row.created_at.isoformat(),
                "redacted_at": row.redacted_at.isoformat() if row.redacted_at else None,
            }
            for row in rows
        ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/snapshots")
def create_snapshot(data: SnapshotInput, repo: RepositoryDep, operator: MutationOperatorDep):
    del operator
    with _INTELLIGENCE_LOCK:
        snapshot = IntelligenceService(repo).create_snapshot(data.kind)
    return {
        field: snapshot.get(field)
        for field in ("id", "kind", "as_of", "rule_version", "created_at", "redacted_at")
    }


def _current_export_snapshot(repo, settings, snapshot_id: str) -> dict:
    purge_expired(repo, datetime.now(UTC), settings.data_dir)
    # Repository results are already detached deep copies. Avoid duplicating
    # the full frozen evidence collection again for every download.
    snapshot = repo.get_snapshot(snapshot_id)
    payload = snapshot.get("payload") or {}
    frozen = payload.get("export_policy") or {}
    now = datetime.now(UTC)
    current = {source["id"]: source for source in repo.list_sources()}
    payload["export_policy"] = {
        source_id: frozen.get(source_id) is True
        and source_id in current
        and permission_allows(current[source_id], "export", now)
        for source_id in set(frozen) | set(current)
    }
    with session_scope(repo.engine) as database:
        payload["items"] = sanitise_ranked_items(
            database,
            payload.get("items", payload.get("rankings", [])),
            rule_version=snapshot.get("rule_version"),
            knowledge_cutoff=payload.get("knowledge_cutoff"),
            applied_rules=payload.get("applied_rules"),
            frozen_inputs=payload,
            export_policy=payload["export_policy"],
            now=now,
        )
    payload["current_permissions"] = {
        key: source.get("permissions") or {} for key, source in current.items()
    }
    snapshot["payload"] = payload
    return snapshot


@router.get("/exports/{snapshot_id}.csv")
def export_csv(snapshot_id: str, repo: RepositoryDep, settings: SettingsDep, operator: OperatorDep):
    del operator
    with _INTELLIGENCE_LOCK:
        snapshot = _current_export_snapshot(repo, settings, snapshot_id)
        content = render_csv(snapshot)
    return Response(
        content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="meritus-{snapshot_id}.csv"'},
    )


@router.get("/exports/{snapshot_id}.html")
def export_html(
    snapshot_id: str, repo: RepositoryDep, settings: SettingsDep, operator: OperatorDep
):
    del operator
    with _INTELLIGENCE_LOCK:
        snapshot = _current_export_snapshot(repo, settings, snapshot_id)
        content = render_html(snapshot)
    return Response(
        content,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="meritus-{snapshot_id}.html"'},
    )


@router.get("/indices")
def indices(repo: RepositoryDep, operator: OperatorDep):
    del operator
    return IntelligenceService(repo).indices()


@router.get("/metrics")
def metrics(
    repo: RepositoryDep,
    operator: OperatorDep,
    cohort: Annotated[str | None, Query(max_length=256)] = None,
    date_from: Annotated[str | None, Query(max_length=64)] = None,
    date_to: Annotated[str | None, Query(max_length=64)] = None,
):
    del operator
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        action_rows = database.scalars(
            select(PipelineAction).where(pipeline_access_clause(database, PipelineAction, now=now))
        ).all()
        review_rows = database.scalars(
            select(Review).where(review_access_clause(database, Review, now=now))
        ).all()
        entity_ids = {item.entity_id for item in action_rows} | {
            item.target_id for item in review_rows if item.target_type == "entity"
        }
        entities = entity_projection_map(database, entity_ids, now=now)
        actions = []
        for row in action_rows:
            item = model_dict(row)
            item["cohort"] = (entities.get(row.entity_id, {}).get("properties") or {}).get("cohort")
            actions.append(item)
        reviews = []
        for row in review_rows:
            item = model_dict(row)
            if row.target_type == "entity":
                item["cohort"] = (entities.get(row.target_id, {}).get("properties") or {}).get(
                    "cohort"
                )
            reviews.append(item)
    return build_metrics(
        actions,
        reviews,
        now,
        cohort=cohort,
        date_from=date_from,
        date_to=date_to,
    )
