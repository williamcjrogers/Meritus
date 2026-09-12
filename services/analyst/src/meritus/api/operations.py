"""Operational health, sources, durable jobs, alerts and receiver routes."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text

from meritus.api.access import alert_access_clause
from meritus.api.dependencies import (
    MutationOperatorDep,
    OperatorDep,
    RepositoryDep,
    SettingsDep,
    list_envelope,
    pagination,
)
from meritus.db import session_scope
from meritus.models import Alert, IngestionRun, StreamCheckpoint
from meritus.repository.evidence import model_dict
from meritus.security import secure_equal
from meritus.sources.catalogue import company_key
from meritus.sources.policy import permission_allows
from meritus.sources.registry import get_adapter
from meritus.sources.runner import check_access, required_credentials

router = APIRouter(prefix="/api", tags=["operations"])
PageDep = Annotated[tuple[int, int], Depends(pagination)]


class SourceChanges(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    config: dict[str, Any] | None = None
    permissions: dict[str, Any] | None = None


def _source_readiness(source: dict[str, Any], settings) -> dict[str, Any]:
    """Report current access checks without mutating historical run status or exposing secrets."""
    now = datetime.now(UTC)
    credentials = []
    for name in source.get("credential_names", []):
        value = getattr(settings, name.removeprefix("MERITUS_").lower(), None)
        if hasattr(value, "get_secret_value"):
            value = value.get_secret_value()
        credentials.append(
            {
                "name": name,
                "configured": bool(value and str(value).strip()),
                "required_for_run": name in required_credentials(source),
            }
        )
    reasons = []
    try:
        check_access(source, settings, now)
        get_adapter(source["id"])
    except (PermissionError, ValueError) as exc:
        reasons.append(str(exc))
    return {
        **source,
        "readiness": {
            "can_run": not reasons,
            "reasons": reasons,
            "checked_at": now.isoformat(),
            "configuration_scope": "api_process",
            "operations": {
                operation: permission_allows(source, operation, now)
                for operation in ("retrieve", "import", "analyse", "export")
            },
            "credentials": credentials,
            "contact": {
                "required": source["id"] == "gazette",
                "configured": bool(
                    settings.organisational_contact and settings.organisational_contact.strip()
                ),
            },
        },
    }


@router.get("/health")
def health(repo: RepositoryDep, settings: SettingsDep):
    database_state = "ok"
    try:
        with repo.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_state = "unavailable"
    search_state = "unavailable"
    try:
        response = httpx.get(settings.opensearch_url, timeout=1.0)
        if response.is_success:
            search_state = "ok"
    except httpx.HTTPError:
        pass
    return {
        "status": "ok" if database_state == search_state == "ok" else "degraded",
        "database": database_state,
        "search": search_state,
    }


@router.get("/sources")
def sources(repo: RepositoryDep, operator: OperatorDep, paging: PageDep, settings: SettingsDep):
    del operator
    with session_scope(repo.engine) as database:
        streams: dict[str, list[dict[str, Any]]] = {}
        for checkpoint in database.scalars(
            select(StreamCheckpoint).order_by(
                StreamCheckpoint.source_id, StreamCheckpoint.stream_name
            )
        ):
            streams.setdefault(checkpoint.source_id, []).append(model_dict(checkpoint))
    items = []
    for source in repo.list_sources():
        item = _source_readiness(source, settings)
        item["streams"] = streams.get(source["id"], [])
        items.append(item)
    return list_envelope(items, *paging)


@router.patch("/sources/{source_id}")
def update_source(
    source_id: str,
    changes: SourceChanges,
    repo: RepositoryDep,
    operator: MutationOperatorDep,
    settings: SettingsDep,
):
    del operator
    supplied = changes.model_dump(exclude_none=True)
    if not supplied:
        raise ValueError("At least one source change is required")
    if source_id == "companies_house" and "company_numbers" in supplied.get("config", {}):
        numbers = supplied["config"]["company_numbers"]
        if not isinstance(numbers, list) or len(numbers) > 200:
            raise ValueError("Company watchlist must be a list of at most 200 company numbers")
        if any(not isinstance(number, str) for number in numbers):
            raise ValueError("Company watchlist entries must be company number strings")
        supplied["config"]["company_numbers"] = list(
            dict.fromkeys(company_key(number).removeprefix("GB-COH:") for number in numbers)
        )
        # Clear older aliases so the explicitly saved watchlist is the one the runner uses.
        supplied["config"].update(company_keys=[], watchlist=[])
    return _source_readiness(repo.update_source(source_id, supplied), settings)


@router.post("/sources/{source_id}/run")
def queue_source(
    source_id: str, repo: RepositoryDep, operator: MutationOperatorDep, settings: SettingsDep
):
    del operator
    source = _source_readiness(repo.get_source(source_id), settings)
    if not source["readiness"]["can_run"]:
        raise HTTPException(status_code=403, detail="; ".join(source["readiness"]["reasons"]))
    try:
        from meritus.jobs import enqueue_job
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Durable job queue is unavailable") from exc
    job = enqueue_job(repo, "source", source_id=source_id)
    return {"job_id": job["id"], "status": "queued"}


@router.get("/runs")
def runs(
    repo: RepositoryDep,
    operator: OperatorDep,
    paging: PageDep,
    source_id: Annotated[str | None, Query(max_length=64)] = None,
):
    del operator
    page, page_size = paging
    filters = [IngestionRun.source_id == source_id] if source_id else []
    with session_scope(repo.engine) as database:
        total = database.scalar(select(func.count()).select_from(IngestionRun).where(*filters)) or 0
        items = [
            model_dict(item)
            for item in database.scalars(
                select(IngestionRun)
                .where(*filters)
                .order_by(IngestionRun.started_at.desc(), IngestionRun.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).all()
        ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/alerts")
def alerts(repo: RepositoryDep, operator: OperatorDep, paging: PageDep):
    del operator
    page, page_size = paging
    with session_scope(repo.engine) as database:
        access = alert_access_clause(database, Alert)
        total = database.scalar(select(func.count()).select_from(Alert).where(access)) or 0
        items = [
            model_dict(item)
            for item in database.scalars(
                select(Alert)
                .where(access)
                .order_by(Alert.created_at.desc(), Alert.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).all()
        ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/alerts/{alert_id}/read")
def read_alert(alert_id: str, repo: RepositoryDep, operator: MutationOperatorDep):
    del operator
    with session_scope(repo.engine) as database:
        alert = database.scalar(
            select(Alert).where(
                Alert.id == alert_id,
                alert_access_clause(database, Alert, now=datetime.now(UTC)),
            )
        )
        if alert is None:
            raise KeyError(f"Unknown alert: {alert_id}")
        alert.read_at = datetime.now(UTC)
    return {"ok": True}


def receiver_authorised(request: Request, repo, settings) -> None:
    configured = settings.hmcts_receiver_token
    expected = configured.get_secret_value() if configured else ""
    supplied = request.headers.get("authorization", "")
    if (
        not expected
        or not supplied.startswith("Bearer ")
        or not secure_equal(supplied[7:], expected)
    ):
        raise HTTPException(status_code=401, detail="Receiver authentication failed")
    source = repo.get_source("hmcts")
    now = datetime.now(UTC)
    if (
        not source.get("enabled")
        or not permission_allows(source, "retrieve", now)
        or not permission_allows(source, "analyse", now)
    ):
        raise HTTPException(status_code=403, detail="HMCTS receiver permission is not active")


@router.api_route("/receivers/hmcts/{publication_id}", methods=["POST", "PUT", "DELETE"])
async def hmcts_receiver(
    publication_id: str, request: Request, repo: RepositoryDep, settings: SettingsDep
):
    receiver_authorised(request, repo, settings)
    body = await request.body()
    if not body and request.method == "DELETE":
        payload = {}
    else:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Request body must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object")
    try:
        from meritus.sources.hmcts import receive_publication
    except ImportError as exc:
        raise HTTPException(
            status_code=503, detail="HMCTS receiver service is unavailable"
        ) from exc
    return receive_publication(repo, publication_id, request.method, payload, now=datetime.now(UTC))


__all__ = ["router"]
