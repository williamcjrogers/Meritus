"""FastAPI application factory for the local analyst desk."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from sqlalchemy.exc import IntegrityError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from meritus.api import auth, evidence, intelligence, operations, opportunities, workflow
from meritus.api.dependencies import authenticate_request, validate_mutation, validate_origin
from meritus.api.director_bridge import BRIDGE_HEADER, verify_director_request
from meritus.config import Settings, mask_secrets
from meritus.db import create_engine_for_url, initialise_database
from meritus.repository import Repository
from meritus.sources.policy import SourceBlocked

_MAX_BODY = 1_000_000
_ROBOTS_POLICY = "noindex, nofollow, noarchive"


def _error_text(error: Exception) -> str:
    value = str(error)
    if isinstance(error, KeyError) and len(value) >= 2 and value[0] == value[-1] == "'":
        value = value[1:-1]
    masked = mask_secrets(value)
    return str(masked)[:2000]


def create_app(settings: Settings | None = None, repository: Repository | None = None) -> FastAPI:
    settings = settings or Settings()
    if repository is None:
        engine = create_engine_for_url(settings.database_url)
        initialise_database(engine)
        repository = Repository(engine)

    app = FastAPI(title="Meritus", version="1.0")
    app.state.settings = settings
    app.state.repository = repository
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.api_allowed_hosts)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
    )

    @app.middleware("http")
    async def request_access_boundary(request: Request, call_next):
        mutation = request.method not in {"GET", "HEAD", "OPTIONS"}
        api_mutation = mutation and request.url.path.startswith("/api/")
        public_probe = request.method in {"GET", "HEAD"} and request.url.path in {
            "/api/health",
            "/robots.txt",
        }
        signed = BRIDGE_HEADER in request.headers
        needs_bridge = signed or (settings.portal_bridge_required and not public_probe)
        try:
            if needs_bridge:
                # Validate origin before reading any bytes, including setup requests.
                validate_origin(request, settings)
                if not signed or settings.portal_bridge_secret is None:
                    raise HTTPException(
                        status_code=401, detail="A valid Directors Workspace request is required"
                    )
            elif api_mutation:
                receiver = request.url.path.startswith("/api/receivers/")
                if not receiver:
                    validate_origin(request, settings)
                if receiver:
                    operations.receiver_authorised(request, repository, settings)
                elif request.url.path == "/api/auth/setup":
                    if not auth.setup_client_allowed(request, settings):
                        raise HTTPException(
                            status_code=403,
                            detail="Initial setup is available only on an approved local peer",
                        )
                elif request.url.path != "/api/auth/login":
                    operator = authenticate_request(request, repository, settings)
                    validate_mutation(request, operator, settings)

            length = request.headers.get("content-length")
            if length is not None:
                try:
                    parsed_length = int(length)
                    if parsed_length < 0:
                        raise ValueError
                except ValueError as error:
                    raise HTTPException(
                        status_code=400, detail="Invalid Content-Length header"
                    ) from error
                if parsed_length > _MAX_BODY:
                    raise HTTPException(status_code=413, detail="Request body is too large")
            if needs_bridge or api_mutation:
                received = 0
                chunks = []
                async for chunk in request.stream():
                    received += len(chunk)
                    if received > _MAX_BODY:
                        raise HTTPException(status_code=413, detail="Request body is too large")
                    chunks.append(chunk)
                request._body = b"".join(chunks)
            if needs_bridge:
                request.state.verified_director = verify_director_request(
                    request, settings, request._body
                )
                if request.url.path in {"/api/auth/setup", "/api/auth/login"}:
                    raise HTTPException(
                        status_code=403, detail="Use your Directors Workspace sign-in"
                    )
                if api_mutation:
                    operator = authenticate_request(request, repository, settings)
                    validate_mutation(request, operator, settings)
        except HTTPException as error:
            return JSONResponse({"detail": error.detail}, status_code=error.status_code)
        return await call_next(request)

    @app.middleware("http")
    async def prevent_crawling(request: Request, call_next):
        # These publisher controls supplement the operator authentication boundary.
        response = await call_next(request)
        response.headers["X-Robots-Tag"] = _ROBOTS_POLICY
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        first = error.errors()[0] if error.errors() else {}
        location = ".".join(str(item) for item in first.get("loc", ()) if item != "body")
        message = str(first.get("msg") or "Invalid input")
        detail = f"{location}: {message}" if location else message
        return JSONResponse({"detail": detail[:1000]}, status_code=400)

    @app.exception_handler(SourceBlocked)
    async def source_blocked(_request: Request, error: SourceBlocked):
        return JSONResponse({"detail": _error_text(error)}, status_code=403)

    @app.exception_handler(KeyError)
    async def absent(_request: Request, error: KeyError):
        return JSONResponse({"detail": _error_text(error)}, status_code=404)

    @app.exception_handler(ValueError)
    async def invalid(_request: Request, error: ValueError):
        return JSONResponse({"detail": _error_text(error)}, status_code=400)

    @app.exception_handler(IntegrityError)
    async def conflict(_request: Request, _error: IntegrityError):
        return JSONResponse({"detail": "The request conflicts with existing data"}, status_code=409)

    @app.exception_handler(Exception)
    async def unexpected(_request: Request, _error: Exception):
        # ServerErrorMiddleware handles this outside the user middleware stack.
        return JSONResponse(
            {"detail": "The request could not be completed"},
            status_code=500,
            headers={"X-Robots-Tag": _ROBOTS_POLICY},
        )

    @app.api_route("/robots.txt", methods=["GET", "HEAD"], include_in_schema=False)
    def robots():
        return PlainTextResponse("User-agent: *\nDisallow: /\n")

    app.include_router(auth.router)
    app.include_router(operations.router)
    app.include_router(evidence.router)
    app.include_router(intelligence.router)
    app.include_router(workflow.router)
    app.include_router(opportunities.router)

    static_dir = Path(settings.api_static_dir).resolve() if settings.api_static_dir else None
    if static_dir and static_dir.is_dir():

        @app.get("/{asset_path:path}", include_in_schema=False)
        def spa(asset_path: str):
            if asset_path == "api" or asset_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
            candidate = (static_dir / asset_path).resolve()
            if candidate != static_dir and static_dir not in candidate.parents:
                raise HTTPException(status_code=404, detail="Not Found")
            if candidate.is_file():
                return FileResponse(candidate)
            index = static_dir / "index.html"
            if index.is_file():
                return FileResponse(index)
            raise HTTPException(status_code=404, detail="Not Found")

    return app


__all__ = ["create_app"]
