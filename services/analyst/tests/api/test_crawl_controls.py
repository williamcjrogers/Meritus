import pytest
from fastapi.testclient import TestClient

from meritus.api import create_app

ROBOTS_POLICY = "noindex, nofollow, noarchive"


@pytest.mark.parametrize(
    ("path", "status"),
    [("/api/auth/setup-status", 200), ("/api/evidence", 401), ("/api/missing", 404)],
)
def test_crawl_header_covers_public_private_and_missing_routes(client, path, status):
    response = client.get(path)
    assert response.status_code == status
    assert response.headers["x-robots-tag"] == ROBOTS_POLICY


def test_crawl_header_covers_early_mutation_rejections(client):
    response = client.post("/api/snapshots", json={"kind": "weekly"})
    assert response.status_code == 401
    assert response.headers["x-robots-tag"] == ROBOTS_POLICY


def test_robots_policy_precedes_the_spa_fallback_and_keeps_evidence_private(
    repo, api_settings, tmp_path
):
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text("<h1>Meritus</h1>")
    (static / "bundle.js").write_text("console.log('Meritus');")
    settings = api_settings.model_copy(update={"api_static_dir": static})
    with TestClient(create_app(settings=settings, repository=repo)) as client:
        response = client.get("/robots.txt")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert response.text == "User-agent: *\nDisallow: /\n"
        assert client.head("/robots.txt").status_code == 200
        for path in ("/robots.txt", "/evidence", "/bundle.js", "/api/evidence"):
            assert client.get(path).headers["x-robots-tag"] == ROBOTS_POLICY
        assert client.get("/api/evidence").status_code == 401


def test_unexpected_errors_also_prohibit_crawling(repo, api_settings):
    app = create_app(settings=api_settings, repository=repo)

    @app.get("/failure-fixture")
    def fail():
        raise RuntimeError("Synthetic unhandled failure")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/failure-fixture")
    assert response.status_code == 500
    assert response.headers["x-robots-tag"] == ROBOTS_POLICY
