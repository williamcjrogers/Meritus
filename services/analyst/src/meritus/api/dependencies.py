"""Shared API state, authentication dependencies and response helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy import select

from meritus.api.director_bridge import BRIDGE_HEADER, director_for_request
from meritus.config import Settings
from meritus.db import session_scope
from meritus.models import Operator, Session
from meritus.repository import Repository
from meritus.security import hash_token, secure_equal


@dataclass(frozen=True)
class CurrentOperator:
    id: str
    username: str
    csrf_token: str
    session_id: str
    auth_mode: str = "local"


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def validate_origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in {
        item.rstrip("/") for item in settings.api_allowed_origins
    }:
        raise HTTPException(status_code=403, detail="Origin is not allowed")


def get_current_operator(
    request: Request,
    repo: Annotated[Repository, Depends(get_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentOperator:
    return authenticate_request(request, repo, settings)


def authenticate_request(request: Request, repo: Repository, settings: Settings) -> CurrentOperator:
    if BRIDGE_HEADER in request.headers or settings.portal_bridge_required:
        director = director_for_request(request)
        return CurrentOperator(
            director.actor_id, director.subject, "", "director:" + director.subject, "director"
        )
    token = request.cookies.get(settings.api_session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        saved = database.scalar(select(Session).where(Session.token_hash == hash_token(token)))
        expires_at = saved.expires_at if saved else None
        if expires_at is not None and (expires_at.tzinfo is None or expires_at.utcoffset() is None):
            expires_at = expires_at.replace(tzinfo=UTC)
        if saved is None or expires_at <= now:
            if saved is not None:
                database.delete(saved)
            raise HTTPException(status_code=401, detail="Authentication required")
        operator = database.get(Operator, saved.operator_id)
        if operator is None:
            database.delete(saved)
            raise HTTPException(status_code=401, detail="Authentication required")
        return CurrentOperator(operator.id, operator.username, saved.csrf_token, saved.id)


def require_csrf(
    request: Request,
    operator: Annotated[CurrentOperator, Depends(get_current_operator)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentOperator:
    validate_mutation(request, operator, settings)
    return operator


def validate_mutation(request: Request, operator: CurrentOperator, settings: Settings) -> None:
    validate_origin(request, settings)
    if operator.auth_mode == "director":
        director = director_for_request(request)
        if operator.id != director.actor_id or operator.username != director.subject:
            raise HTTPException(status_code=401, detail="Director identity does not match request")
        return
    supplied = request.headers.get("X-CSRF-Token", "")
    if not supplied or not secure_equal(supplied, operator.csrf_token):
        raise HTTPException(status_code=403, detail="A valid CSRF token is required")


def pagination(
    page: Annotated[int, Query(ge=1, le=1_000_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 100,
) -> tuple[int, int]:
    return page, page_size


def list_envelope(
    items: list[dict[str, Any]], page: int, page_size: int, *, truncated: bool = False
) -> dict[str, Any]:
    total = len(items)
    start = (page - 1) * page_size
    return {
        "items": items[start : start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "truncated": truncated,
    }


RepositoryDep = Annotated[Repository, Depends(get_repository)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
OperatorDep = Annotated[CurrentOperator, Depends(get_current_operator)]
MutationOperatorDep = Annotated[CurrentOperator, Depends(require_csrf)]
