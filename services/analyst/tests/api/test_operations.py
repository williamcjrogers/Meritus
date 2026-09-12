from datetime import UTC, datetime, timedelta

from pydantic import SecretStr
from sqlalchemy import select

from meritus.db import session_scope
from meritus.models import Job


def test_source_run_is_a_durable_job(authenticated, engine):
    client, csrf = authenticated
    response = client.post("/api/sources/find_tender/run", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert response.json()["status"] == "queued"
    with session_scope(engine) as session:
        job = session.scalar(select(Job).where(Job.id == response.json()["job_id"]))
        assert job.kind == "source"
        assert job.source_id == "find_tender"
        assert job.status == "queued"


def test_source_update_rejects_credentials_and_masks_existing_values(authenticated, repo):
    client, csrf = authenticated
    denied = client.patch(
        "/api/sources/find_tender",
        json={"config": {"api_key": "should-never-persist"}},
        headers={"X-CSRF-Token": csrf},
    )
    assert denied.status_code == 400
    assert "should-never-persist" not in denied.text

    response = client.get("/api/sources")
    assert response.status_code == 200
    assert set(response.json()) >= {"items", "total", "page", "page_size"}
    assert "should-never-persist" not in response.text


def test_health_reports_database_and_search_separately(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"
    assert response.json()["search"] == "unavailable"
    assert response.json()["status"] == "degraded"


def test_hmcts_denial_precedes_json_parsing(client, repo, api_settings):
    source = repo.get_source("hmcts")
    permissions = {
        "reference": "LIC-2026-1",
        "scope": ["retrieve", "analyse"],
        "granted_at": datetime.now(UTC).isoformat(),
        "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
    }
    repo.update_source(source["id"], {"enabled": True, "permissions": permissions})
    response = client.put(
        "/api/receivers/hmcts/publication-1",
        content=b"{not-json",
        headers={"Content-Type": "application/json", "Authorization": "Bearer wrong"},
    )
    assert response.status_code == 401
    assert "json" not in response.text.lower()


def test_hmcts_permission_gate_and_receiver_persist_publications(client, repo, api_settings):
    now = datetime.now(UTC)
    api_settings.hmcts_receiver_token = SecretStr("dedicated-receiver-token")
    malformed = client.post(
        "/api/receivers/hmcts/publication-2",
        content=b"{not-json",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer dedicated-receiver-token",
        },
    )
    assert malformed.status_code == 403

    repo.update_source(
        "hmcts",
        {
            "enabled": True,
            "permissions": {
                "reference": "LIC-2026-1",
                "scope": {
                    "retrieve": True,
                    "analyse": True,
                    "sensitivity": ["PUBLIC"],
                },
                "reviewed_at": now.isoformat(),
                "operations": ["retrieve", "analyse"],
            },
        },
    )
    payload = {
        "version": 1,
        "sensitivity": "PUBLIC",
        "title": "Synthetic hearing publication",
        "published_at": (now - timedelta(hours=1)).isoformat(),
        "expires_at": (now + timedelta(days=1)).isoformat(),
        "source_url": "https://www.court-tribunal-hearings.service.gov.uk/publication-2",
        "content": "A public hearing listing for Example Limited.",
        "media_type": "text/plain",
    }
    created = client.post(
        "/api/receivers/hmcts/publication-2",
        json=payload,
        headers={"Authorization": "Bearer dedicated-receiver-token"},
    )
    assert created.status_code == 200
    assert created.json()["status"] == "created"
    withdrawn = client.delete(
        "/api/receivers/hmcts/publication-2",
        headers={"Authorization": "Bearer dedicated-receiver-token"},
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"


def test_hmcts_receiver_counts_chunked_body_after_authentication(client, repo, api_settings):
    now = datetime.now(UTC)
    api_settings.hmcts_receiver_token = SecretStr("dedicated-receiver-token")
    repo.update_source(
        "hmcts",
        {
            "enabled": True,
            "permissions": {
                "reference": "LIC-2026-1",
                "scope": {
                    "retrieve": True,
                    "analyse": True,
                    "sensitivity": ["PUBLIC"],
                },
                "reviewed_at": now.isoformat(),
                "operations": ["retrieve", "analyse"],
            },
        },
    )

    def oversized_chunks():
        yield b'{"version":1,"content":"'
        yield b"x" * 1_000_001
        yield b'"}'

    response = client.post(
        "/api/receivers/hmcts/oversized-publication",
        content=oversized_chunks(),
        headers={"Authorization": "Bearer dedicated-receiver-token"},
    )
    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large"}


def test_import_preview_rejects_urls_with_credentials(authenticated):
    client, csrf = authenticated
    response = client.post(
        "/api/imports/preview",
        json={
            "kind": "organisations",
            "rows": [{"name": "Example Ltd", "company_number": "01234567"}],
            "source_url": "https://user:password@example.test/file.csv",
            "permission_reference": "reviewed",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 400
    assert "password" not in response.text
