from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from meritus.db import session_scope
from meritus.models import (
    Alert,
    Entity,
    EntityProvenance,
    Observation,
    PipelineAction,
    Review,
    SourceRecord,
)


def _entity(database, *, key: str, name: str, identifier: str | None = None) -> Entity:
    now = datetime.now(UTC)
    entity = Entity(
        key=key,
        kind="organisation",
        name=name,
        scheme="GB-COH" if identifier else None,
        identifier=identifier,
        verified=identifier is not None,
        properties={},
        created_at=now,
        updated_at=now,
    )
    database.add(entity)
    database.flush()
    return entity


def _import_unresolved(client, csrf: str, name: str) -> str:
    preview = client.post(
        "/api/imports/preview",
        json={
            "kind": "organisations",
            "rows": [{"name": name}],
            "source_url": "",
            "permission_reference": None,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["valid"] is True
    committed = client.post(
        "/api/imports/commit",
        json={"token": preview.json()["token"]},
        headers={"X-CSRF-Token": csrf},
    )
    assert committed.status_code == 200, committed.text
    listing = client.get(f"/api/entities?q={name}")
    assert listing.status_code == 200
    return listing.json()["items"][0]["id"]


@pytest.mark.parametrize("decision, expected_state", [("merge", "merged"), ("reject", "rejected")])
def test_generated_identity_review_is_actionable_and_historical_pending_is_resolved(
    authenticated, engine, decision, expected_state
):
    client, csrf = authenticated
    with session_scope(engine) as database:
        destination = _entity(
            database,
            key=f"GB-COH:{'01234567' if decision == 'merge' else '07654321'}",
            name=f"Canonical {decision.title()} Ltd",
            identifier="01234567" if decision == "merge" else "07654321",
        )
        destination_id = destination.id

    unresolved_id = _import_unresolved(client, csrf, f"Unresolved {decision.title()} Ltd")
    queue = client.get("/api/reviews?page_size=100")
    assert queue.status_code == 200
    pending = next(item for item in queue.json()["items"] if item["target_id"] == unresolved_id)
    assert pending["review_type"] == "identity"
    assert pending["state"] == "pending"
    assert pending["headline"] == f"Identity review: Unresolved {decision.title()} Ltd"
    assert pending["target"] == {
        "id": unresolved_id,
        "type": "entity",
        "name": f"Unresolved {decision.title()} Ltd",
        "kind": "organisation",
        "scheme": None,
        "identifier": None,
        "verified": False,
    }
    assert pending["allowed_actions"] == ["merge", "reject", "update"]

    payload = {"into_entity_id": destination_id} if decision == "merge" else {}
    saved = client.post(
        "/api/reviews",
        json={
            "target_type": "entity",
            "target_id": unresolved_id,
            "action": decision,
            "reason": f"Analyst chose to {decision}",
            "payload": payload,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert saved.status_code == 200, saved.text

    history = client.get("/api/reviews?page_size=100").json()["items"]
    target_history = [item for item in history if item["target_id"] == unresolved_id]
    assert len(target_history) == 2
    assert {item["state"] for item in target_history} == {expected_state}
    assert all(item["allowed_actions"] == [] for item in target_history)


def test_historical_review_actions_have_explicit_non_pending_state(authenticated, engine):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    with session_scope(engine) as database:
        entity = _entity(
            database, key="GB-COH:00000042", name="Reviewed Ltd", identifier="00000042"
        )
        database.add(
            Review(
                target_type="entity",
                target_id=entity.id,
                action="update",
                actor="analyst",
                reason="Corrected display name",
                payload={"changes": {"name": "Reviewed Construction Ltd"}},
                created_at=now,
            )
        )

    item = client.get("/api/reviews").json()["items"][0]
    assert item["state"] == "updated"
    assert item["review_type"] == "entity"
    assert item["allowed_actions"] == []


def test_entity_name_edit_is_audited_and_identifier_change_must_match_canonical_key(
    authenticated, engine
):
    client, csrf = authenticated
    with session_scope(engine) as database:
        entity = _entity(
            database, key="GB-COH:00000084", name="Original Ltd", identifier="00000084"
        )
        entity_id = entity.id

    accepted = client.post(
        "/api/reviews",
        json={
            "target_type": "entity",
            "target_id": entity_id,
            "action": "update",
            "reason": "Corrected registered display name",
            "payload": {"changes": {"name": "Corrected Ltd", "identifier": "00000084"}},
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["actor"] == "analyst"

    rejected = client.post(
        "/api/reviews",
        json={
            "target_type": "entity",
            "target_id": entity_id,
            "action": "update",
            "reason": "Unsafe identity rewrite",
            "payload": {"changes": {"identifier": "99999999"}},
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert rejected.status_code == 400
    assert "does not match key" in rejected.json()["detail"]
    with session_scope(engine) as database:
        saved = database.get(Entity, entity_id)
        assert saved.name == "Corrected Ltd"
        assert saved.identifier == "00000084"
        assert len(database.scalars(select(Review)).all()) == 1


def test_pipeline_accepts_eight_canonical_stages_and_metrics_count_real_outcomes(
    authenticated, engine
):
    client, csrf = authenticated
    with session_scope(engine) as database:
        entity = _entity(
            database, key="GB-COH:00000123", name="Pipeline Ltd", identifier="00000123"
        )
        entity_id = entity.id
        database.add(
            PipelineAction(
                entity_id=entity_id,
                stage="triage",
                note="Historical stage",
                actor="legacy",
                occurred_at=datetime.now(UTC) - timedelta(days=1),
            )
        )

    canonical = (
        "review",
        "shortlisted",
        "introduction_considered",
        "contacted",
        "conversation",
        "instruction",
        "dismissed",
        "snoozed",
    )
    for stage in canonical:
        response = client.post(
            "/api/pipeline",
            json={"entity_id": entity_id, "stage": stage, "note": stage},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200, (stage, response.text)
        assert response.json()["stage"] == stage

    rejected = client.post(
        "/api/pipeline",
        json={"entity_id": entity_id, "stage": "triage", "note": "new legacy value"},
        headers={"X-CSRF-Token": csrf},
    )
    assert rejected.status_code == 400
    assert "triage" in {item["stage"] for item in client.get("/api/pipeline").json()["items"]}

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["counts"] == {
        "reviewed_recommendations": 1,
        "contacted_opportunities": 1,
        "conversations": 1,
        "instructions": 1,
    }
    assert metrics.json()["conversation_rate_from_reviewed"] == 1.0
    assert metrics.json()["conversation_rate_from_contacted"] == 1.0


def test_expired_source_entity_cannot_be_mutated_through_workflow_or_alert_routes(
    authenticated, engine
):
    client, csrf = authenticated
    now = datetime.now(UTC)
    with session_scope(engine) as database:
        expired = _entity(
            database, key="GB-COH:00000456", name="Expired Ltd", identifier="00000456"
        )
        local = _entity(database, key="GB-COH:00000789", name="Local Ltd", identifier="00000789")
        other_local = _entity(
            database, key="GB-COH:00000987", name="Other Local Ltd", identifier="00000987"
        )
        record = SourceRecord(
            source_id="find_tender",
            external_id="expired-workflow",
            revision=1,
            content_hash="e" * 64,
            source_url="https://example.test/expired-workflow",
            title="Expired workflow evidence",
            published_at=now - timedelta(days=2),
            observed_at=now - timedelta(days=2),
            expires_at=now - timedelta(seconds=1),
            active=True,
            withdrawn=False,
            media_type="application/json",
            payload={},
        )
        database.add(record)
        database.flush()
        observation = Observation(
            record_id=record.id,
            entity_id=local.id,
            kind="review_signal",
            event_key="expired-workflow-observation",
            headline="Expired observation",
            detail="No longer readable",
            state="pending",
            evidence_pointer="record",
            attributes={},
            created_at=now,
        )
        database.add(observation)
        database.add(
            EntityProvenance(
                entity_id=expired.id,
                record_id=record.id,
                name=expired.name,
                properties={},
                verified=True,
                observed_at=record.observed_at,
            )
        )
        alert = Alert(
            dedupe_key="expired-alert",
            entity_id=expired.id,
            category="review",
            title="Expired alert",
            body="Must remain unread",
            created_at=now,
        )
        database.add(alert)
        database.flush()
        expired_id = expired.id
        local_id = local.id
        other_local_id = other_local.id
        record_id = record.id
        observation_id = observation.id
        alert_id = alert.id

    attempts = (
        (
            "/api/reviews",
            {
                "target_type": "entity",
                "target_id": expired_id,
                "action": "update",
                "reason": "Should be hidden",
                "payload": {"changes": {"name": "Mutated Ltd"}},
            },
        ),
        ("/api/pipeline", {"entity_id": expired_id, "stage": "review", "note": "hidden"}),
        (
            "/api/calendar",
            {
                "entity_id": expired_id,
                "kind": "review",
                "title": "Hidden date",
                "date": now.date().isoformat(),
                "status": "provisional",
            },
        ),
        (
            "/api/relationships",
            {
                "from_entity_id": expired_id,
                "to_entity_id": local_id,
                "role": "contractor",
                "evidence_mode": "human",
                "human_basis": "Direct analyst knowledge",
                "evidence_pointer": "Interview note",
                "valid_from": now.isoformat(),
                "reason": "Reviewed human evidence",
            },
        ),
        (
            "/api/reviews",
            {
                "target_type": "source_record",
                "target_id": record_id,
                "action": "withdraw",
                "reason": "Should be hidden",
                "payload": {},
            },
        ),
        (
            "/api/reviews",
            {
                "target_type": "observation",
                "target_id": observation_id,
                "action": "accept",
                "reason": "Should be hidden",
                "payload": {},
            },
        ),
        (
            "/api/calendar",
            {
                "entity_id": local_id,
                "kind": "review",
                "title": "Hidden evidence date",
                "date": now.date().isoformat(),
                "status": "provisional",
                "source_record_id": record_id,
            },
        ),
        (
            "/api/relationships",
            {
                "from_entity_id": local_id,
                "to_entity_id": other_local_id,
                "role": "contractor",
                "evidence_mode": "source",
                "source_record_id": record_id,
                "evidence_pointer": "Expired record",
                "valid_from": now.isoformat(),
                "reason": "Reviewed source evidence",
            },
        ),
        (
            "/api/relationships",
            {
                "from_entity_id": local_id,
                "to_entity_id": other_local_id,
                "role": "adviser",
                "evidence_mode": "human",
                "human_basis": "Direct analyst knowledge",
                "evidence_pointer": "Interview note",
                "valid_from": now.isoformat(),
                "attributes": {"matter_entity_id": expired_id},
                "reason": "Reviewed human evidence",
            },
        ),
    )
    for path, payload in attempts:
        response = client.post(path, json=payload, headers={"X-CSRF-Token": csrf})
        assert response.status_code == 404, (path, response.text)

    alert_response = client.post(f"/api/alerts/{alert_id}/read", headers={"X-CSRF-Token": csrf})
    assert alert_response.status_code == 404
    with session_scope(engine) as database:
        assert database.get(Entity, expired_id).name == "Expired Ltd"
        assert database.get(SourceRecord, record_id).active is True
        assert database.get(Alert, alert_id).read_at is None
        assert (
            database.scalar(select(PipelineAction).where(PipelineAction.entity_id == expired_id))
            is None
        )
