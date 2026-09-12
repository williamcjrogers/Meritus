from datetime import UTC, datetime

from sqlalchemy import select

from meritus.alerts import emit_alert, emit_source_failure_alert
from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.models import Alert, Entity, SourceRecord


def _ingest(repo, source_id: str, external_id: str, *, name: str, now: datetime):
    repo.ingest_batch(
        source_id,
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id=external_id,
                    source_url=f"https://example.invalid/{external_id}",
                    title=f"{name} evidence",
                    published_at=now,
                    payload={"synthetic": True},
                    entities=[
                        EntityInput(
                            key="TEST:MIXED-ALERT",
                            name=name,
                            scheme="TEST",
                            identifier="MIXED-ALERT",
                            verified=True,
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    with session_scope(repo.engine) as session:
        record = session.scalar(
            select(SourceRecord).where(
                SourceRecord.source_id == source_id,
                SourceRecord.external_id == external_id,
            )
        )
        entity = session.scalar(select(Entity).where(Entity.key == "TEST:MIXED-ALERT"))
        return record.id, entity.id


def test_mixed_source_alert_hides_when_its_own_lineage_is_denied(authenticated, repo):
    client, csrf = authenticated
    now = datetime.now(UTC)
    public_record_id, entity_id = _ingest(
        repo, "find_tender", "public-alert-support", name="Public entity name", now=now
    )
    private_record_id, _ = _ingest(
        repo,
        "payment_practices",
        "private-alert-support",
        name="Private entity name",
        now=now,
    )
    alert = emit_alert(
        repo,
        dedupe_key="mixed-private-alert",
        entity_id=entity_id,
        category="qualifying_event",
        title="Private derived alert title",
        body="Private derived alert body",
        record_ids=[public_record_id, private_record_id],
        generation_kind="qualifying_event",
        rule_version="test-v1",
        now=now,
    )
    assert client.get("/api/alerts").json()["total"] == 1

    repo.update_source("payment_practices", {"permissions": {"denied": True}})

    assert client.get("/api/entities").json()["total"] == 1
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert "Private derived" not in response.text
    assert (
        client.post(f"/api/alerts/{alert['id']}/read", headers={"X-CSRF-Token": csrf}).status_code
        == 404
    )
    with session_scope(repo.engine) as session:
        stored = session.get(Alert, alert["id"])
        assert stored.title == "Private derived alert title"
        assert stored.read_at is None


def test_legacy_arbitrary_alerts_fail_closed_but_explicit_generic_failure_is_visible(
    authenticated, repo
):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    _record_id, sourced_entity_id = _ingest(
        repo, "find_tender", "legacy-alert-support", name="Public source entity", now=now
    )
    with session_scope(repo.engine) as session:
        analyst_entity = Entity(
            key="ANALYST:ALERT",
            kind="organisation",
            name="Analyst entity",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        session.add(analyst_entity)
        session.flush()
        session.add_all(
            [
                Alert(
                    dedupe_key="legacy-sourced-alert",
                    entity_id=sourced_entity_id,
                    category="evidence",
                    title="Unlineaged source alert",
                    body="Potentially private source content",
                    created_at=now,
                ),
                Alert(
                    dedupe_key="legacy-entityless-alert",
                    category="system",
                    title="Arbitrary system title",
                    body="Arbitrary system body",
                    created_at=now,
                ),
                Alert(
                    dedupe_key="analyst-only-alert",
                    entity_id=analyst_entity.id,
                    category="analyst",
                    title="Analyst note",
                    body="Analyst-authored note",
                    created_at=now,
                ),
            ]
        )
    failure = emit_source_failure_alert(
        repo,
        source_id="find_tender",
        status="failed",
        event_version="run-123",
        rule_version="test-v1",
        now=now,
    )
    replay = emit_source_failure_alert(
        repo,
        source_id="find_tender",
        status="failed",
        event_version="run-123",
        rule_version="test-v1",
        now=now,
    )
    assert replay["id"] == failure["id"]

    payload = client.get("/api/alerts").json()
    assert payload["total"] == 2
    assert {item["dedupe_key"] for item in payload["items"]} == {
        "analyst-only-alert",
        failure["dedupe_key"],
    }
    assert payload["items"][0]["title"] != "Arbitrary system title"
