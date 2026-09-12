import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import func, select

from meritus.db import session_scope
from meritus.models import Entity, ImportPreview
from meritus.repository import Repository
from meritus.workflow.imports import ImportService


def test_invalid_calendar_preview_has_no_token(repo):
    result = ImportService(repo).preview(
        "calendar",
        [
            {
                "entity_id": "co-1",
                "kind": "limitation",
                "date": "2030-01-01",
                "status": "confirmed",
                "basis": "",
            }
        ],
        "https://example.org/contract",
        None,
    )
    assert result["valid"] is False
    assert result["token"] is None


def test_company_and_project_imports_are_validated_and_durable(repo, engine, now):
    service = ImportService(repo, clock=lambda: now)
    company = service.preview(
        "organisations",
        [{"name": "Example Ltd", "company_number": "1234567"}],
        "",
        None,
    )
    assert company["preview"][0]["entity"]["key"] == "GB-COH:01234567"
    assert service.commit(company["token"], "analyst")["inserted"] == 1

    project = service.preview(
        "projects",
        [{"name": "Bridge A", "ocid": "ocds-a"}],
        "",
        None,
    )
    service.commit(project["token"], "analyst")
    recreated = Repository(engine)
    assert {item["kind"] for item in recreated.list_entities()} == {"organisation", "project"}


def test_preview_token_is_hashed_expiring_and_single_use(repo, now):
    service = ImportService(repo, clock=lambda: now)
    preview = service.preview(
        "organisations", [{"name": "One Ltd", "company_number": "1"}], "", None
    )
    with session_scope(repo.engine) as session:
        stored = session.scalar(select(ImportPreview))
        assert stored.token_hash == hashlib.sha256(preview["token"].encode()).hexdigest()
        assert preview["token"] not in str(stored.payload)
    service.commit(preview["token"], "WR")
    with pytest.raises(ValueError, match="already"):
        service.commit(preview["token"], "WR")


def test_concurrent_commit_claims_preview_once(repo, now):
    preview = ImportService(repo, clock=lambda: now).preview(
        "organisations", [{"name": "Concurrent Ltd", "company_number": "3"}], "", None
    )

    def commit():
        try:
            return ImportService(repo, clock=lambda: now).commit(preview["token"], "WR")
        except ValueError as exc:
            return str(exc)

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(lambda _: commit(), range(2)))
    assert sum(isinstance(item, dict) for item in outcomes) == 1
    assert sum("already" in item for item in outcomes if isinstance(item, str)) == 1
    assert len(repo.list_entities()) == 1


def test_expired_preview_cannot_commit(repo, now):
    service = ImportService(repo, token_ttl=timedelta(seconds=1), clock=lambda: now)
    preview = service.preview(
        "organisations", [{"name": "One Ltd", "company_number": "1"}], "", None
    )
    late = ImportService(repo, clock=lambda: now + timedelta(seconds=2))
    with pytest.raises(ValueError, match="expired"):
        late.commit(preview["token"], "WR")
    with session_scope(repo.engine) as session:
        assert session.scalar(select(func.count()).select_from(Entity)) == 0


def test_known_restricted_source_needs_actual_recorded_grant(repo, now):
    grant = {
        "reference": "rns-contract-1",
        "scope": "Meritus analysis",
        "reviewed_at": (now - timedelta(days=1)).isoformat(),
        "operations": ["import", "analyse", "export"],
        "expires_at": (now + timedelta(days=30)).isoformat(),
        "retention_days": 30,
    }
    repo.update_source("rns", {"permissions": grant})
    row = {
        "external_id": "announcement-1",
        "title": "Announcement",
        "published_at": now.isoformat(),
        "payload": {"field": "value"},
    }
    rejected = ImportService(repo, clock=lambda: now).preview(
        "documents",
        [row],
        "https://www.londonstockexchange.com/news/announcement-1",
        "wrong-grant",
    )
    accepted = ImportService(repo, clock=lambda: now).preview(
        "documents",
        [row],
        "https://www.londonstockexchange.com/news/announcement-1",
        "rns-contract-1",
    )
    assert not rejected["valid"]
    assert accepted["valid"]


def test_rights_are_rechecked_inside_atomic_commit(repo, now):
    grant = {
        "reference": "rns-contract-1",
        "scope": "Meritus analysis",
        "reviewed_at": (now - timedelta(days=1)).isoformat(),
        "operations": ["import", "analyse", "export"],
        "retention_days": 30,
    }
    repo.update_source("rns", {"permissions": grant})
    preview = ImportService(repo, clock=lambda: now).preview(
        "documents",
        [
            {
                "external_id": "announcement-atomic",
                "title": "Announcement",
                "published_at": now.isoformat(),
                "payload": {},
            }
        ],
        "https://www.londonstockexchange.com/news/announcement-atomic",
        "rns-contract-1",
    )
    repo.update_source("rns", {"permissions": {"denied": True}})
    with pytest.raises(PermissionError, match="blocked"):
        ImportService(repo, clock=lambda: now).commit(preview["token"], "WR")
    with session_scope(repo.engine) as session:
        stored = session.scalar(select(ImportPreview))
        assert stored.committed_at is None
    assert repo.list_records() == []

    repo.update_source("rns", {"permissions": {"denied": False}})
    result = ImportService(repo, clock=lambda: now).commit(preview["token"], "WR")
    assert result["inserted"] == 1


def test_unknown_structured_fact_does_not_need_publisher_licence(repo, now):
    preview = ImportService(repo, clock=lambda: now).preview(
        "organisations",
        [{"name": "Supplied Company", "company_number": "22"}],
        "https://client.example/evidence.csv",
        None,
    )
    assert preview["valid"]


def test_import_rejects_scheme_less_known_publisher_url(repo, now):
    result = ImportService(repo, clock=lambda: now).preview(
        "organisations",
        [{"name": "Supplied Company", "company_number": "22"}],
        "www.londonstockexchange.com/news/example",
        None,
    )

    assert result["valid"] is False
    assert "absolute HTTP(S)" in result["errors"][0]["message"]


def test_metric_import_preserves_category_window_unit_and_source(repo, now):
    service = ImportService(repo, clock=lambda: now)
    company = service.preview(
        "organisations", [{"name": "Metric Subject", "company_number": "44"}], "", None
    )
    service.commit(company["token"], "WR")
    entity = repo.list_entities()[0]
    metric = service.preview(
        "metrics",
        [
            {
                "entity_id": entity["id"],
                "kind": "gateway_metric",
                "category": "major",
                "value": 18,
                "unit": "days",
                "period_start": (now - timedelta(days=90)).isoformat(),
                "period_end": now.isoformat(),
                "published_at": now.isoformat(),
                "window": "2026-Q3",
            }
        ],
        "https://www.gov.uk/government/publications/building-safety-regulator-gateway-data",
        None,
    )
    assert metric["valid"]
    assert service.commit(metric["token"], "WR")["kind"] == "metrics"
    observation = repo.list_observations()[0]
    assert (
        observation["source_id"],
        observation["attributes"]["metric"],
        observation["attributes"]["window"],
        observation["unit"],
    ) == ("bsr_gateway", "major", "2026-Q3", "days")


def test_unknown_full_document_requires_permission_reference(repo, now):
    result = ImportService(repo, clock=lambda: now).preview(
        "documents",
        [
            {
                "external_id": "doc-1",
                "title": "Publisher report",
                "published_at": now.isoformat(),
                "payload": {},
            }
        ],
        "https://publisher.example/report.pdf",
        None,
    )
    assert not result["valid"]
    assert "permission reference" in result["errors"][0]["message"]


def test_unknown_full_document_accepts_scoped_bounded_permission(repo, now):
    result = ImportService(repo, clock=lambda: now).preview(
        "documents",
        [
            {
                "external_id": "doc-2",
                "title": "Publisher report",
                "published_at": now.isoformat(),
                "payload": {},
                "permission_scope": "Internal commercial analysis and export",
                "permission_reviewed_at": (now - timedelta(days=1)).isoformat(),
                "permission_operations": ["import", "analyse", "export"],
                "permission_retention_days": 30,
            }
        ],
        "https://publisher.example/report.pdf",
        "publisher-grant-2",
    )
    assert result["valid"]
    assert ImportService(repo, clock=lambda: now).commit(result["token"], "WR")["inserted"] == 1
