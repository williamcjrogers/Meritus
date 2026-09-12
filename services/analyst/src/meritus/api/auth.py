"""Single-operator setup, login and session invalidation routes."""

from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from meritus.api.dependencies import (
    MutationOperatorDep,
    OperatorDep,
    RepositoryDep,
    SettingsDep,
    validate_origin,
)
from meritus.api.director_bridge import BRIDGE_HEADER, director_for_request
from meritus.db import session_scope
from meritus.models import Operator, Session
from meritus.security import hash_password, hash_token, new_session_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["authentication"])
_INITIAL_OPERATOR_ID = "00000000-0000-0000-0000-000000000001"
_attempts: dict[str, deque[float]] = {}
_attempt_lock = Lock()
_setup_lock = Lock()
_DUMMY_PASSWORD_HASH = hash_password("not-the-real-operator-password")
_RATE_WINDOW_SECONDS = 15 * 60
_USERNAME_ATTEMPT_LIMIT = 5
_HOST_ATTEMPT_LIMIT = 20
_MAX_RATE_KEYS = 2048


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=256, pattern=r"^[^\x00-\x1f\x7f]+$")
    password: str = Field(min_length=12, max_length=1024)

    @field_validator("username")
    @classmethod
    def username_is_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("username cannot be blank")
        return value


def setup_client_allowed(request: Request, settings) -> bool:
    allowed = {"127.0.0.1", "::1", "testclient", *settings.api_setup_trusted_proxies}
    return bool(request.client and request.client.host in allowed)


def _session_response(response: Response, operator: Operator, repo, settings) -> dict:
    raw_token = new_session_token()
    now = datetime.now(UTC)
    saved = Session(
        token_hash=hash_token(raw_token),
        operator_id=operator.id,
        csrf_token=new_session_token(),
        expires_at=now + timedelta(hours=8),
        created_at=now,
    )
    with session_scope(repo.engine) as database:
        database.add(saved)
        database.flush()
    response.set_cookie(
        settings.api_session_cookie_name,
        raw_token,
        max_age=8 * 60 * 60,
        httponly=True,
        secure=settings.api_cookie_secure
        or any(origin.casefold().startswith("https://") for origin in settings.api_allowed_origins),
        samesite="strict",
        path="/",
    )
    return {
        "username": operator.username,
        "csrf_token": saved.csrf_token,
        "demo_mode": settings.demo_mode,
    }


def _prune_attempts(now: float) -> None:
    for key, recent in list(_attempts.items()):
        while recent and recent[0] < now - _RATE_WINDOW_SECONDS:
            recent.popleft()
        if not recent:
            _attempts.pop(key, None)
    excess = len(_attempts) - _MAX_RATE_KEYS
    if excess > 0:
        oldest = sorted(_attempts, key=lambda key: _attempts[key][-1])[:excess]
        for key in oldest:
            _attempts.pop(key, None)


def _rate_limited(host: str, username: str, *, failed: bool = False) -> bool:
    now = monotonic()
    host_key = f"host:{host}"
    username_key = f"user:{host}:{username.casefold()}"
    with _attempt_lock:
        _prune_attempts(now)
        host_attempts = _attempts.get(host_key, deque())
        username_attempts = _attempts.get(username_key, deque())
        limited = (
            len(host_attempts) >= _HOST_ATTEMPT_LIMIT
            or len(username_attempts) >= _USERNAME_ATTEMPT_LIMIT
        )
        if failed and not limited:
            _attempts.setdefault(host_key, deque()).append(now)
            _attempts.setdefault(username_key, deque()).append(now)
            _prune_attempts(now)
        return limited


@router.get("/setup-status")
def setup_status(request: Request, repo: RepositoryDep, settings: SettingsDep):
    if settings.portal_bridge_required or BRIDGE_HEADER in request.headers:
        director_for_request(request)
        return {"needs_setup": False}
    with session_scope(repo.engine) as database:
        return {"needs_setup": database.scalar(select(func.count()).select_from(Operator)) == 0}


@router.post("/setup")
def setup(
    credentials: Credentials,
    request: Request,
    response: Response,
    repo: RepositoryDep,
    settings: SettingsDep,
):
    validate_origin(request, settings)
    if settings.portal_bridge_required or BRIDGE_HEADER in request.headers:
        raise HTTPException(status_code=403, detail="Use your Directors Workspace sign-in")
    if not setup_client_allowed(request, settings):
        raise HTTPException(status_code=403, detail="Initial setup is available only on loopback")
    now = datetime.now(UTC)
    try:
        with _setup_lock, session_scope(repo.engine) as database:
            if database.bind.dialect.name == "postgresql":
                database.execute(text("SELECT pg_advisory_xact_lock(719118641)"))
            if database.scalar(select(func.count()).select_from(Operator)):
                raise HTTPException(status_code=409, detail="Initial setup is already complete")
            operator = Operator(
                id=_INITIAL_OPERATOR_ID,
                username=credentials.username.strip(),
                password_hash=hash_password(credentials.password),
                created_at=now,
            )
            database.add(operator)
            database.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Initial setup is already complete") from exc
    return _session_response(response, operator, repo, settings)


@router.post("/login")
def login(
    credentials: Credentials,
    request: Request,
    response: Response,
    repo: RepositoryDep,
    settings: SettingsDep,
):
    validate_origin(request, settings)
    if settings.portal_bridge_required or BRIDGE_HEADER in request.headers:
        raise HTTPException(status_code=403, detail="Use your Directors Workspace sign-in")
    host = request.client.host if request.client else "unknown"
    if _rate_limited(host, credentials.username):
        raise HTTPException(status_code=429, detail="Too many login attempts; try again later")
    with session_scope(repo.engine) as database:
        operator = database.scalar(
            select(Operator).where(Operator.username == credentials.username.strip())
        )
        password_hash = operator.password_hash if operator else _DUMMY_PASSWORD_HASH
        password_matches = verify_password(credentials.password, password_hash)
        valid = bool(operator and password_matches)
    if not valid:
        _rate_limited(host, credentials.username, failed=True)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    with _attempt_lock:
        _attempts.pop(f"user:{host}:{credentials.username.casefold()}", None)
    return _session_response(response, operator, repo, settings)


@router.get("/me")
def me(operator: OperatorDep, settings: SettingsDep):
    return {
        "username": operator.username,
        "csrf_token": operator.csrf_token,
        "demo_mode": settings.demo_mode,
        "auth_mode": operator.auth_mode,
    }


@router.post("/logout")
def logout(
    response: Response, operator: MutationOperatorDep, repo: RepositoryDep, settings: SettingsDep
):
    if operator.auth_mode == "director":
        return {"ok": True}
    with session_scope(repo.engine) as database:
        saved = database.get(Session, operator.session_id)
        if saved is not None:
            database.delete(saved)
    response.delete_cookie(settings.api_session_cookie_name, path="/")
    return {"ok": True}
