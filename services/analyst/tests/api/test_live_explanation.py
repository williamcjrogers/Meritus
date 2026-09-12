from datetime import UTC, datetime, timedelta

from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.service import IntelligenceService


def test_entity_explanation_is_live_before_and_after_a_weekly_snapshot(authenticated, repo):
    client, _ = authenticated
    now = datetime.now(UTC) - timedelta(seconds=1)
    document = ParsedDocument(
        external_id="live-explanation",
        source_url="https://example.test/live-explanation",
        title="Current source evidence",
        payload={"accounts_overdue": True},
        published_at=now,
        entities=[
            EntityInput(
                key="TEST:LIVE",
                name="Synthetic explanation company",
                scheme="TEST",
                identifier="LIVE",
                verified=True,
            )
        ],
        observations=[
            ObservationInput(
                subject_key="TEST:LIVE",
                kind="accounts_overdue",
                event_key="current-event",
                headline="Accounts overdue",
                detail="Synthetic structured accounts status",
                occurred_at=now,
                state="verified",
            )
        ],
    )
    repo.ingest_batch("payment_practices", FetchBatch(documents=[document]), now)
    entity = repo.list_entities()[0]
    response = client.get(f"/api/entities/{entity['id']}")
    assert response.status_code == 200
    first = response.json()["score"]
    assert first["score"] > 0
    assert first["contributions"][0]["record_id"]
    assert first["snapshot_id"] is None

    snapshot = IntelligenceService(repo).create_snapshot("weekly")
    observation = repo.list_observations()[0]
    repo.record_review("observation", observation["id"], "reject", "Corrected finding", "analyst")
    response = client.get(f"/api/entities/{entity['id']}")
    assert response.status_code == 200
    current = response.json()["score"]
    assert current["score"] == 0
    assert current["snapshot_id"] is None
    assert repo.get_snapshot(snapshot["id"])["payload"]["items"][0]["score"] > 0
