"""Regression coverage for editable source access and evidenced relationship dates."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import SecretStr


def test_source_readiness_uses_current_grant_without_overwriting_run_status(authenticated, repo):
    client, csrf = authenticated
    repo.update_source(
        "find_case_law", {"enabled": True, "permissions": {"reference": "Old review"}}
    )
    incomplete = next(
        item for item in client.get("/api/sources").json()["items"] if item["id"] == "find_case_law"
    )
    assert incomplete["readiness"]["can_run"] is False
    assert incomplete["readiness"]["operations"]["retrieve"] is False
    grant = {
        "reference": "Licence 2026-4",
        "scope": "Reviewed judgments for the claims research team",
        "reviewed_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat(),
        "operations": ["retrieve", "analyse"],
        "retention_days": 30,
        "retain_full_text": False,
    }
    changed = client.patch(
        "/api/sources/find_case_law", json={"permissions": grant}, headers={"X-CSRF-Token": csrf}
    )
    assert changed.status_code == 200
    item = changed.json()
    assert item["permissions"] == grant
    assert item["status"] == incomplete["status"]
    assert item["readiness"]["can_run"] is True
    assert item["readiness"]["operations"] == {
        "retrieve": True,
        "import": False,
        "analyse": True,
        "export": False,
    }
    expired = client.patch(
        "/api/sources/find_case_law",
        json={
            "permissions": {"expires_at": (datetime.now(UTC) - timedelta(seconds=1)).isoformat()}
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert expired.json()["readiness"]["can_run"] is False


def test_source_readiness_exposes_presence_without_credential_or_contact_values(
    authenticated, repo, api_settings
):
    client, csrf = authenticated
    api_settings.companies_house_api_key = SecretStr("never-return-this-rest-key")
    api_settings.companies_house_stream_key = SecretStr("never-return-this-stream-key")
    response = client.patch(
        "/api/sources/companies_house",
        json={"enabled": True, "config": {"company_numbers": ["01234567"]}},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200
    assert response.json()["readiness"]["can_run"] is True
    assert all(item["configured"] for item in response.json()["readiness"]["credentials"])
    assert "never-return" not in response.text
    api_settings.organisational_contact = None
    gazette = client.patch(
        "/api/sources/gazette", json={"enabled": True}, headers={"X-CSRF-Token": csrf}
    )
    assert gazette.json()["readiness"]["can_run"] is False
    assert gazette.json()["readiness"]["contact"] == {"required": True, "configured": False}
    api_settings.organisational_contact = "private-contact@example.test"
    ready = client.get("/api/sources")
    item = next(item for item in ready.json()["items"] if item["id"] == "gazette")
    assert item["readiness"]["can_run"] is True
    assert "private-contact" not in ready.text
    disabled = client.patch(
        "/api/sources/gazette", json={"enabled": False}, headers={"X-CSRF-Token": csrf}
    )
    assert disabled.json()["readiness"]["can_run"] is False


def test_source_queue_rechecks_current_permission_before_enqueuing(authenticated, repo):
    client, csrf = authenticated
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    response = client.post("/api/sources/find_tender/run", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 403
    assert "grant" in response.json()["detail"]


@pytest.mark.parametrize(
    "date_fields",
    [
        {},
        {"valid_from": None},
        {"valid_from": ""},
        {"valid_from": "2026-02-30T00:00:00Z"},
        {"valid_from": "2026-09-12"},
        {"valid_from": "2026-09-12T00:00:00Z", "valid_to": "2026-09-11T00:00:00Z"},
    ],
)
def test_relationship_requires_explicit_valid_evidence_dates(authenticated, date_fields):
    client, csrf = authenticated
    response = client.post(
        "/api/relationships",
        json={
            "from_entity_id": "missing-first",
            "to_entity_id": "missing-second",
            "role": "contractor",
            "evidence_pointer": "Contract paragraph 4",
            **date_fields,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 400
    assert "valid_" in response.json()["detail"]
    assert client.get("/api/relationships").json()["items"] == []


@pytest.mark.parametrize("numbers", ["01234567", ["invented"], ["123456789"], ["01234567"] * 201])
def test_company_watchlist_rejects_invalid_or_unbounded_values(authenticated, numbers):
    client, csrf = authenticated
    response = client.patch(
        "/api/sources/companies_house",
        json={"config": {"company_numbers": numbers}},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 400


def test_company_watchlist_preserves_other_configuration_and_normalises_numbers(
    authenticated, repo
):
    client, csrf = authenticated
    repo.update_source("companies_house", {"config": {"max_pages": 2}})
    response = client.patch(
        "/api/sources/companies_house",
        json={"config": {"company_numbers": ["1234567", "sc123456"]}},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200
    assert response.json()["config"]["company_numbers"] == ["01234567", "SC123456"]
    assert response.json()["config"]["max_pages"] == 2
