from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.cache import generation
from meritus.intelligence.service import IntelligenceService
from meritus.models import Alert


def _seed(repo, now):
    document = ParsedDocument(
        external_id="source-rights-probe",
        source_url="https://example.invalid/rights",
        title="Public source finding",
        published_at=now,
        payload={"synthetic": True},
        entities=[
            EntityInput(
                key="TEST:RIGHTS",
                name="Synthetic public name",
                scheme="TEST",
                identifier="RIGHTS",
                verified=True,
            )
        ],
        observations=[
            ObservationInput(
                subject_key="TEST:RIGHTS",
                kind="accounts_overdue",
                event_key="public-event",
                headline="Synthetic accounts finding",
                detail="Synthetic evidence",
                occurred_at=now,
                state="verified",
            )
        ],
    )
    repo.ingest_batch("payment_practices", FetchBatch(documents=[document]), now)
    return document


def test_historical_cutoff_never_revives_expired_source_rights(repo):
    current = datetime.now(UTC)
    cutoff = current - timedelta(days=5)
    document = _seed(repo, cutoff)
    repo.update_source(
        "hmcts",
        {
            "permissions": {
                "reference": "Synthetic expired grant",
                "scope": "Synthetic tests only",
                "operations": ["retrieve", "analyse", "export"],
                "reviewed_at": (cutoff - timedelta(days=1)).isoformat(),
                "expires_at": (current - timedelta(days=1)).isoformat(),
            }
        },
    )
    private = document.model_copy(
        update={
            "external_id": "expired-private-record",
            "title": "Expired secret title",
            "entities": [document.entities[0].model_copy(update={"name": "Expired secret name"})],
            "observations": [
                document.observations[0].model_copy(
                    update={"detail": "Expired secret passage", "event_key": "private-event"}
                )
            ],
        }
    )
    repo.ingest_batch("hmcts", FetchBatch(documents=[private]), cutoff)
    service = IntelligenceService(repo)
    snapshot = service.create_snapshot("retrospective_research", cutoff)
    assert "Expired secret" not in str(snapshot["payload"])
    assert snapshot["payload"]["export_policy"]["hmcts"] is False
    assert {row["source_id"] for row in snapshot["payload"]["source_records"]} == {
        "payment_practices"
    }
    assert service.watchlist(cutoff, q="Expired secret")["items"] == []


def test_direct_service_metrics_obey_current_entity_access(repo):
    current = datetime.now(UTC)
    _seed(repo, current - timedelta(seconds=1))
    entity_id = repo.list_entities()[0]["id"]
    repo.add_pipeline_action(
        {
            "entity_id": entity_id,
            "stage": "review",
            "actor": "analyst",
            "note": "Synthetic",
            "occurred_at": current,
        }
    )
    assert IntelligenceService(repo).metrics()["counts"]["reviewed_recommendations"] == 1
    repo.update_source("payment_practices", {"permissions": {"denied": True}})
    assert IntelligenceService(repo).metrics()["counts"]["reviewed_recommendations"] == 0


def test_alert_creation_and_read_state_invalidate_materialisation(repo):
    current = datetime.now(UTC)
    first = generation(repo, current)
    with session_scope(repo.engine) as session:
        session.add(
            Alert(
                dedupe_key="synthetic-cache-alert",
                category="system",
                title="Synthetic cache test",
                body="Synthetic body",
                created_at=current,
            )
        )
    created = generation(repo, current)
    assert created != first
    with session_scope(repo.engine) as session:
        session.scalar(select(Alert)).read_at = current
    assert generation(repo, current) != created


def test_indices_use_only_verified_current_readable_metric_evidence(repo):
    now = datetime.now(UTC) - timedelta(seconds=1)
    ordinary = _seed(repo, now)
    metric = ordinary.observations[0].model_copy(
        update={
            "kind": "gateway_metric",
            "event_key": "gateway-verified",
            "value": 22,
            "unit": "weeks",
            "attributes": {"category": "new_build_median", "window": "2026-Q2"},
        }
    )
    document = ordinary.model_copy(
        update={
            "external_id": "index-metrics",
            "observations": [
                metric,
                metric.model_copy(
                    update={
                        "event_key": "gateway-pending",
                        "state": "pending",
                        "value": 99,
                        "attributes": {"category": "unreviewed", "window": "2026-Q2"},
                    }
                ),
            ],
        }
    )
    repo.ingest_batch("find_tender", FetchBatch(documents=[document]), now)
    service = IntelligenceService(repo)
    result = service.indices()
    assert len(result["series"]) == 1
    assert result["series"][0]["points"][0]["value"] == 22
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    assert service.indices()["series"] == []
