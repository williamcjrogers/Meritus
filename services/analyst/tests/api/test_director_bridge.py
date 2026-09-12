import base64
import hashlib
import hmac
import json
from uuid import NAMESPACE_URL, uuid5

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import func, select

from meritus.api import create_app
from meritus.api.dependencies import MutationOperatorDep, OperatorDep
from meritus.api.director_bridge import BRIDGE_HEADER
from meritus.config import Settings
from meritus.db import session_scope
from meritus.models import Operator, Session
from meritus.repository import Repository

SECRET = "bridge-test-secret-that-is-at-least-32-characters"
NOW = 1_789_200_000


def _encode(payload, secret=SECRET):
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return encoded + "." + signature


def _payload(path="/api/auth/me", method="GET", body=b"", **overrides):
    return {
        "v": 1,
        "sub": "user_directorA",
        "iat": NOW,
        "method": method,
        "path": path,
        "body_sha256": hashlib.sha256(body).hexdigest(),
        **overrides,
    }


def _headers(path="/api/auth/me", method="GET", body=b"", **overrides):
    return {BRIDGE_HEADER: _encode(_payload(path, method, body, **overrides))}


@pytest.fixture
def bridge_client(engine, api_settings, monkeypatch):
    monkeypatch.setattr("meritus.api.director_bridge.time.time", lambda: NOW)
    settings = api_settings.model_copy(
        update={"portal_bridge_secret": SecretStr(SECRET), "portal_bridge_required": True}
    )
    app = create_app(settings=settings, repository=Repository(engine))

    @app.get("/api/bridge-test")
    @app.get("/api/bridge-test/{name:path}")
    def read_actor(operator: OperatorDep):
        return {
            "id": operator.id,
            "username": operator.username,
            "session": operator.session_id,
            "auth_mode": operator.auth_mode,
        }

    @app.post("/api/bridge-test")
    async def mutation(request: Request, operator: MutationOperatorDep):
        return {"actor": operator.username, "data": (await request.body()).decode()}

    with TestClient(app) as client:
        yield client


def test_director_proof_authenticates_without_password_accounts(bridge_client, engine):
    response = bridge_client.get("/api/auth/me", headers=_headers())
    assert response.status_code == 200
    assert response.json() == {
        "username": "user_directorA",
        "csrf_token": "",
        "demo_mode": False,
        "auth_mode": "director",
    }
    assert "set-cookie" not in response.headers
    assert bridge_client.get(
        "/api/auth/setup-status", headers=_headers("/api/auth/setup-status")
    ).json() == {"needs_setup": False}
    with session_scope(engine) as database:
        assert database.scalar(select(func.count()).select_from(Operator)) == 0
        assert database.scalar(select(func.count()).select_from(Session)) == 0


def test_distinct_directors_have_stable_separate_audit_identities(bridge_client):
    first = bridge_client.get(
        "/api/bridge-test",
        headers={**_headers("/api/bridge-test"), "X-User": "local-admin", "X-Role": "admin"},
    ).json()
    again = bridge_client.get("/api/bridge-test", headers=_headers("/api/bridge-test")).json()
    second = bridge_client.get(
        "/api/bridge-test", headers=_headers("/api/bridge-test", sub="user_directorB")
    ).json()
    assert first == again
    assert first["id"] == str(uuid5(NAMESPACE_URL, "meritus:director:user_directorA"))
    assert first["id"] != second["id"]
    assert first["username"] == "user_directorA"
    assert second["username"] == "user_directorB"
    assert first["session"] == "director:user_directorA"


@pytest.mark.parametrize(
    "changes",
    [
        {"v": 2},
        {"v": True},
        {"iat": True},
        {"iat": NOW - 31},
        {"iat": NOW + 6},
        {"iat": str(NOW)},
        {"iat": 1e300},
        {"sub": ""},
        {"sub": "a" * 257},
        {"sub": "director\nadmin"},
        {"sub": "a@example.com"},
        {"method": "get"},
        {"method": "POST"},
        {"path": "/api/evidence"},
        {"path": "/api/auth/me?admin=1"},
        {"path": "/api/auth/me#fragment"},
        {"path": "/" + "a" * 8192},
        {"body_sha256": "0" * 64},
        {"body_sha256": "bad"},
        {"role": "director"},
    ],
)
def test_invalid_claims_are_rejected(bridge_client, changes):
    response = bridge_client.get("/api/auth/me", headers=_headers(**changes))
    assert response.status_code == 401
    assert response.json() == {"detail": "A valid Directors Workspace request is required"}


@pytest.mark.parametrize("age", [-5, 0, 30])
def test_timestamp_accepts_only_short_explicit_window(bridge_client, age):
    assert bridge_client.get("/api/auth/me", headers=_headers(iat=NOW - age)).status_code == 200


@pytest.mark.parametrize("header", ["", "bad", "e30.bad", "a" * 16_385])
def test_malformed_header_is_rejected(bridge_client, header):
    assert bridge_client.get("/api/auth/me", headers={BRIDGE_HEADER: header}).status_code == 401


def test_header_signature_tampering_and_duplicate_header_are_rejected(bridge_client):
    proof = _headers()[BRIDGE_HEADER]
    encoded, signature = proof.split(".")
    wrong_signature = ("a" if signature[0] != "a" else "b") + signature[1:]
    for header in [encoded + "." + wrong_signature, "x" + proof, _encode(_payload(), "wrong-key")]:
        assert bridge_client.get("/api/auth/me", headers={BRIDGE_HEADER: header}).status_code == 401
    assert (
        bridge_client.get(
            "/api/auth/me", headers=[(BRIDGE_HEADER, proof), (BRIDGE_HEADER, proof)]
        ).status_code
        == 401
    )


def test_duplicate_json_claims_are_rejected(bridge_client):
    payload = json.dumps(_payload())[:-1] + ',"sub":"user_directorB"}'
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = hmac.new(SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    assert (
        bridge_client.get(
            "/api/auth/me", headers={BRIDGE_HEADER: encoded + "." + signature}
        ).status_code
        == 401
    )


def test_method_query_order_and_raw_encoding_are_bound(bridge_client):
    signed_path = "/api/bridge-test/%C3%A9?value=%2f&second=1"
    assert bridge_client.get(signed_path, headers=_headers(signed_path)).status_code == 200
    for actual in [
        "/api/bridge-test/%C3%A9?second=1&value=%2f",
        "/api/bridge-test/%C3%A9?value=%2F&second=1",
        "/api/bridge-test/%C3%A9?value=%2f&second=2",
    ]:
        assert bridge_client.get(actual, headers=_headers(signed_path)).status_code == 401
    assert (
        bridge_client.post("/api/bridge-test", headers=_headers("/api/bridge-test")).status_code
        == 401
    )


def test_signed_mutation_uses_exact_body_and_checks_origin(bridge_client):
    body = b'{"value": 1}'
    headers = _headers("/api/bridge-test", "POST", body)
    valid = bridge_client.post("/api/bridge-test", content=body, headers=headers)
    assert valid.status_code == 200
    assert valid.json() == {"actor": "user_directorA", "data": body.decode()}
    assert (
        bridge_client.post("/api/bridge-test", content=b'{"value":1}', headers=headers).status_code
        == 401
    )
    assert (
        bridge_client.post(
            "/api/bridge-test",
            content=body,
            headers={**headers, "Origin": "https://attacker.example"},
        ).status_code
        == 403
    )


def test_get_body_is_also_bound_and_bounded(bridge_client):
    assert (
        bridge_client.request(
            "GET", "/api/auth/me", content=b"unexpected body", headers=_headers()
        ).status_code
        == 401
    )
    assert (
        bridge_client.request(
            "GET", "/api/auth/me", content=b"x" * 1_000_001, headers=_headers()
        ).status_code
        == 413
    )


def test_streamed_mutation_limit_precedes_proof_validation(bridge_client):
    def chunks():
        yield b"x" * 500_000
        yield b"x" * 500_001

    response = bridge_client.post(
        "/api/bridge-test", content=chunks(), headers=_headers("/api/bridge-test", "POST")
    )
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large"}


@pytest.mark.parametrize("length", ["-1", "invalid", ""])
def test_invalid_content_length_is_rejected(bridge_client, length):
    response = bridge_client.get("/api/auth/me", headers={**_headers(), "Content-Length": length})
    assert response.status_code == 400


def test_verified_proof_is_reused_within_request(bridge_client, monkeypatch):
    from meritus.api import app

    calls = []
    original = app.verify_director_request

    def verify(*args):
        calls.append(1)
        return original(*args)

    monkeypatch.setattr(app, "verify_director_request", verify)
    assert (
        bridge_client.post(
            "/api/bridge-test", headers=_headers("/api/bridge-test", "POST")
        ).status_code
        == 200
    )
    assert len(calls) == 1


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/sources",
        "/assets/private.js",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/auth/me",
        "/api/auth/setup-status",
        "/api/evidence",
        "/api/unknown",
    ],
)
def test_required_mode_protects_entire_backend(bridge_client, path):
    assert bridge_client.get(path).status_code == 401


@pytest.mark.parametrize("path", ["/api/auth/setup", "/api/auth/login"])
def test_required_mode_disables_local_setup_and_login(bridge_client, path):
    body = b'{"username":"analyst","password":"a-long-test-password"}'
    assert bridge_client.post(path, content=body).status_code == 401
    response = bridge_client.post(path, content=body, headers=_headers(path, "POST", body))
    assert response.status_code == 403
    assert response.json() == {"detail": "Use your Directors Workspace sign-in"}
    assert (
        bridge_client.post(
            path,
            content=body,
            headers={**_headers(path, "POST", body), "Origin": "https://evil.test"},
        ).status_code
        == 403
    )


def test_public_probes_reveal_only_minimal_health_and_robots(bridge_client):
    health = bridge_client.get("/api/health")
    assert health.status_code == 200
    assert set(health.json()) == {"status", "database", "search"}
    assert bridge_client.get("/robots.txt").text == "User-agent: *\nDisallow: /\n"
    assert (
        bridge_client.get("/robots.txt").headers["X-Robots-Tag"] == "noindex, nofollow, noarchive"
    )
    assert bridge_client.post("/api/health").status_code == 401
    assert bridge_client.post("/api/receivers/hmcts").status_code == 401


def test_required_mode_ignores_local_cookie_and_director_logout_keeps_it(
    authenticated, api_settings, monkeypatch
):
    client, csrf = authenticated
    api_settings.portal_bridge_secret = SecretStr(SECRET)
    monkeypatch.setattr("meritus.api.director_bridge.time.time", lambda: NOW)
    assert (
        client.post("/api/auth/logout", headers=_headers("/api/auth/logout", "POST")).status_code
        == 200
    )
    assert client.get("/api/auth/me").json()["username"] == "analyst"
    api_settings.portal_bridge_required = True
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 401
    assert client.get("/api/auth/me", headers=_headers()).json()["username"] == "user_directorA"


def test_optional_mode_never_falls_back_to_cookie_on_invalid_or_unconfigured_proof(
    authenticated, api_settings, monkeypatch
):
    client, _ = authenticated
    assert client.get("/api/auth/me", headers=_headers()).status_code == 401
    api_settings.portal_bridge_secret = SecretStr(SECRET)
    monkeypatch.setattr("meritus.api.director_bridge.time.time", lambda: NOW)
    assert client.get("/api/auth/me", headers={BRIDGE_HEADER: "invalid"}).status_code == 401
    assert client.get("/api/auth/me", headers=_headers()).json()["auth_mode"] == "director"
    assert client.get("/api/auth/me").json()["auth_mode"] == "local"


def test_bridge_settings_require_strong_secret_and_fail_closed():
    with pytest.raises(ValidationError, match="at least 32"):
        Settings(_env_file=None, portal_bridge_secret="short")
    with pytest.raises(ValidationError, match="secret is required"):
        Settings(_env_file=None, portal_bridge_required=True)
    settings = Settings(_env_file=None, portal_bridge_secret=SECRET, portal_bridge_required=True)
    assert settings.masked()["portal_bridge_secret"] == "********"
    assert SECRET not in repr(settings)
