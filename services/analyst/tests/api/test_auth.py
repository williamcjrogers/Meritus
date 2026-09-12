from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from meritus.db import session_scope
from meritus.models import Operator, Session


def _setup(client: TestClient, username: str = "analyst"):
    return client.post(
        "/api/auth/setup",
        json={"username": username, "password": "a-long-test-password"},
        headers={"Origin": "http://testserver"},
    )


def test_unauthenticated_evidence_is_private(client):
    assert client.get("/api/evidence").status_code == 401


def test_setup_creates_hashed_operator_and_cookie_session(client, engine):
    response = _setup(client)
    assert response.status_code == 200
    assert response.json()["username"] == "analyst"
    assert response.json()["csrf_token"]
    cookie = response.cookies.get("meritus_session")
    assert cookie and "a-long-test-password" not in cookie
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    with session_scope(engine) as session:
        operator = session.scalar(select(Operator))
        saved_session = session.scalar(select(Session))
        assert operator.password_hash != "a-long-test-password"
        assert cookie not in saved_session.token_hash
        assert saved_session.expires_at - saved_session.created_at == timedelta(hours=8)


def test_setup_is_once_only_and_bad_login_is_generic(client):
    assert _setup(client).status_code == 200
    assert _setup(client, "second").status_code == 409
    client.cookies.clear()
    response = client.post(
        "/api/auth/login",
        json={"username": "analyst", "password": "wrong-password"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid username or password"}
    unknown = client.post(
        "/api/auth/login",
        json={"username": "unknown", "password": "wrong-password"},
        headers={"Origin": "http://testserver"},
    )
    assert unknown.status_code == 401
    assert unknown.json() == response.json()


def test_setup_rejects_a_blank_operator_name(client):
    response = client.post(
        "/api/auth/setup",
        json={"username": "   ", "password": "a-long-test-password"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 400


def test_concurrent_setup_creates_exactly_one_operator(client, engine):
    def request(username):
        with TestClient(client.app) as concurrent_client:
            return _setup(concurrent_client, username).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(request, ["first", "second"]))
    assert statuses == [200, 409]
    with session_scope(engine) as session:
        assert session.scalar(select(func.count()).select_from(Operator)) == 1


def test_csrf_origin_host_expiry_and_logout_are_enforced(client, engine):
    response = _setup(client)
    csrf = response.json()["csrf_token"]
    assert client.post("/api/snapshots", json={"kind": "weekly"}).status_code == 403
    assert (
        client.post(
            "/api/snapshots",
            json={"kind": "weekly"},
            headers={"X-CSRF-Token": csrf, "Origin": "https://attacker.example"},
        ).status_code
        == 403
    )
    assert client.get("/api/auth/me", headers={"Host": "attacker.example"}).status_code == 400
    with session_scope(engine) as session:
        saved = session.scalar(select(Session))
        saved.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert client.get("/api/auth/me").status_code == 401


def test_csrf_is_checked_before_a_mutation_body_is_parsed(client):
    _setup(client)
    response = client.post(
        "/api/snapshots",
        content=b"{not-json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 403

    logged_in = client.post(
        "/api/auth/login",
        json={"username": "analyst", "password": "a-long-test-password"},
        headers={"Origin": "http://testserver"},
    )
    csrf = logged_in.json()["csrf_token"]
    assert client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_unknown_api_route_stays_json_404(authenticated):
    client, _ = authenticated
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_session_survives_a_new_application_instance(client, engine, api_settings):
    from meritus.api import create_app
    from meritus.repository import Repository

    response = _setup(client)
    cookie = response.cookies.get("meritus_session")
    with TestClient(create_app(settings=api_settings, repository=Repository(engine))) as recreated:
        recreated.cookies.set("meritus_session", cookie)
        assert recreated.get("/api/auth/me").json()["username"] == "analyst"


def test_setup_uses_only_the_direct_peer_allowlist(client, api_settings):
    with TestClient(client.app, client=("172.30.88.1", 50_000)) as proxied:
        denied = proxied.post(
            "/api/auth/setup",
            json={"username": "analyst", "password": "a-long-test-password"},
            headers={
                "Origin": "http://testserver",
                "X-Forwarded-For": "127.0.0.1",
            },
        )
        assert denied.status_code == 403
        api_settings.api_setup_trusted_proxies = ["172.30.88.1"]
        assert _setup(proxied).status_code == 200


def test_static_fallback_never_shadows_unknown_api_paths(engine, api_settings, tmp_path):
    from meritus.api import create_app
    from meritus.repository import Repository

    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<h1>Analyst desk</h1>")
    settings = api_settings.model_copy(update={"api_static_dir": static})
    with TestClient(create_app(settings=settings, repository=Repository(engine))) as static_client:
        assert "Analyst desk" in static_client.get("/watchlist").text
        api_response = static_client.get("/api/unknown")
        assert api_response.status_code == 404
        assert api_response.json() == {"detail": "Not Found"}


def test_https_configuration_forces_a_secure_session_cookie(engine, api_settings):
    from meritus.api import create_app
    from meritus.repository import Repository

    settings = api_settings.model_copy(
        update={
            "api_allowed_hosts": ["meritus.local"],
            "api_allowed_origins": ["https://meritus.local"],
        }
    )
    with TestClient(
        create_app(settings=settings, repository=Repository(engine)),
        base_url="https://meritus.local",
    ) as secure_client:
        response = secure_client.post(
            "/api/auth/setup",
            json={"username": "analyst", "password": "a-long-test-password"},
            headers={"Origin": "https://meritus.local"},
        )
    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]


def test_chunked_body_limit_counts_received_bytes_before_parsing(client):
    def oversized_chunks():
        yield b'{"username":"analyst","password":"'
        yield b"x" * 1_000_001
        yield b'"}'

    response = client.post(
        "/api/auth/login",
        content=oversized_chunks(),
        headers={"Content-Type": "application/json", "Origin": "http://testserver"},
    )
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large"}


def test_login_throttle_has_a_host_bucket_and_bounded_cache(client):
    from meritus.api import auth

    with auth._attempt_lock:
        auth._attempts.clear()
    for index in range(auth._HOST_ATTEMPT_LIMIT):
        response = client.post(
            "/api/auth/login",
            json={"username": f"rotated-{index}", "password": "a-long-wrong-password"},
            headers={"Origin": "http://testserver"},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/auth/login",
        json={"username": "another-name", "password": "a-long-wrong-password"},
        headers={"Origin": "http://testserver"},
    )
    assert blocked.status_code == 429

    with auth._attempt_lock:
        auth._attempts.clear()
    for index in range(auth._MAX_RATE_KEYS + 50):
        auth._rate_limited(f"198.51.100.{index}", f"user-{index}", failed=True)
    assert len(auth._attempts) <= auth._MAX_RATE_KEYS
