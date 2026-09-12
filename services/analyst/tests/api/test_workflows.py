from datetime import UTC, datetime

from meritus.db import session_scope
from meritus.domain import FetchBatch, ParsedDocument
from meritus.intelligence.service import IntelligenceService
from meritus.models import Entity


def test_all_lists_use_complete_pagination_envelopes(authenticated):
    client, _ = authenticated
    for path in (
        "/api/entities",
        "/api/evidence",
        "/api/sources",
        "/api/runs",
        "/api/reviews",
        "/api/calendar",
        "/api/pipeline",
        "/api/relationships",
        "/api/snapshots",
        "/api/alerts",
    ):
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
        assert set(response.json()) >= {"items", "total", "page", "page_size"}


def test_entity_pagination_reports_the_database_total(authenticated, engine):
    client, _ = authenticated
    now = datetime.now(UTC)
    with session_scope(engine) as database:
        database.add_all(
            [
                Entity(
                    key=f"unresolved:test:{index}",
                    kind="organisation",
                    name=f"Entity {index:04d}",
                    scheme=None,
                    identifier=None,
                    verified=False,
                    properties={},
                    created_at=now,
                    updated_at=now,
                )
                for index in range(1001)
            ]
        )
    response = client.get("/api/entities?page=11&page_size=100")
    assert response.status_code == 200
    assert response.json()["total"] == 1001
    assert len(response.json()["items"]) == 1


def test_snapshot_creation_persists_and_exports_safely(authenticated, repo):
    client, csrf = authenticated
    snapshot = IntelligenceService(repo).create_snapshot(
        as_of=datetime(2026, 9, 12, 10, tzinfo=UTC)
    )
    response = client.get(f"/api/exports/{snapshot['id']}.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    html = client.get(f"/api/exports/{snapshot['id']}.html")
    assert html.status_code == 200
    assert html.headers["content-type"].startswith("text/html")

    created = client.post(
        "/api/snapshots",
        json={"kind": "weekly"},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 200
    assert client.get("/api/snapshots").json()["total"] >= 2


def test_export_never_broadens_frozen_or_current_source_rights(authenticated, repo):
    client, _ = authenticated
    now = datetime(2026, 9, 12, 10, tzinfo=UTC)
    row = {
        "entity_id": "entity-1",
        "name": "Restricted row",
        "kind": "organisation",
        "score": 41,
        "eligible": True,
        "independent_events": 2,
        "source_ids": ["find_tender"],
        "contributions": [],
    }
    frozen_denial = repo.save_snapshot(
        "weekly",
        now,
        "test",
        {"items": [row], "export_policy": {"find_tender": False}, "coverage": {"complete": True}},
    )
    assert "Restricted row" not in client.get(f"/api/exports/{frozen_denial['id']}.csv").text

    frozen_grant = repo.save_snapshot(
        "weekly",
        now,
        "test",
        {"items": [row], "export_policy": {"find_tender": True}, "coverage": {"complete": True}},
    )
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    assert "Restricted row" not in client.get(f"/api/exports/{frozen_grant['id']}.csv").text


def test_review_calendar_pipeline_and_relationship_fail_cleanly(authenticated):
    client, csrf = authenticated
    for path, payload in (
        (
            "/api/reviews",
            {
                "target_type": "entity",
                "target_id": "missing",
                "action": "accept",
                "reason": "Reviewed",
            },
        ),
        ("/api/calendar", {"entity_id": "missing", "kind": "meeting", "date": "2026-09-12"}),
        ("/api/pipeline", {"entity_id": "missing", "stage": "review", "note": "Reviewed"}),
        (
            "/api/relationships",
            {
                "from_entity_id": "missing-1",
                "to_entity_id": "missing-2",
                "role": "contractor",
                "evidence_pointer": "page 1",
                "valid_from": "2026-09-12T00:00:00Z",
                "reason": "Reviewed",
            },
        ),
    ):
        response = client.post(path, json=payload, headers={"X-CSRF-Token": csrf})
        assert response.status_code in {400, 404}, (path, response.text)
        assert "traceback" not in response.text.lower()


def test_workflow_fields_have_server_side_bounds(authenticated):
    client, csrf = authenticated
    response = client.post(
        "/api/pipeline",
        json={"entity_id": "missing", "stage": "review", "note": "x" * 10_001},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 400
    assert "too long" in response.json()["detail"].lower()
    invalid_stage = client.post(
        "/api/pipeline",
        json={"entity_id": "missing", "stage": "invented", "note": "Reviewed"},
        headers={"X-CSRF-Token": csrf},
    )
    assert invalid_stage.status_code == 400
    assert "stage" in invalid_stage.json()["detail"].lower()


def test_frontend_workflow_payloads_persist_with_actor_and_display_names(
    authenticated, engine, repo
):
    client, csrf = authenticated
    now = datetime.now(UTC)
    with session_scope(engine) as database:
        first = Entity(
            key="GB-COH:01234567",
            kind="organisation",
            name="First Ltd",
            scheme="GB-COH",
            identifier="01234567",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        second = Entity(
            key="project:reviewed:test",
            kind="project",
            name="Project Test",
            scheme=None,
            identifier=None,
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        database.add_all([first, second])
        database.flush()
        first_id, second_id = first.id, second.id

    pipeline = client.post(
        "/api/pipeline",
        json={"entity_id": first_id, "stage": "review", "note": "Partner review"},
        headers={"X-CSRF-Token": csrf},
    )
    assert pipeline.status_code == 200
    assert pipeline.json()["actor"] == "analyst"

    calendar = client.post(
        "/api/calendar",
        json={
            "entity_id": first_id,
            "title": "Review date",
            "date": "2026-10-01",
            "kind": "review",
            "status": "provisional",
            "precision": "day",
            "basis": "",
            "source_url": "",
            "evidence": "",
            "jurisdiction": "England and Wales",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert calendar.status_code == 200

    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="contract-1",
                    source_url="https://example.test/contract",
                    title="Reviewed contract",
                    published_at=now,
                    payload={"clause": "Main contractor"},
                )
            ]
        ),
        observed_at=now,
    )
    source_record_id = repo.list_records()[0]["id"]
    relationship = client.post(
        "/api/relationships",
        json={
            "from_entity_id": first_id,
            "to_entity_id": second_id,
            "role": "main contractor",
            "source_record_id": source_record_id,
            "evidence_pointer": "Reviewed contract page 2",
            "valid_from": "2026-09-01T00:00:00Z",
            "valid_to": "2027-08-31T00:00:00Z",
            "source_url": "https://example.test/contract",
            "state": "verified",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert relationship.status_code == 200, relationship.text
    assert relationship.json()["record_id"] == source_record_id

    saved_review = client.post(
        "/api/reviews",
        json={
            "target_type": "entity",
            "target_id": first_id,
            "action": "update",
            "reason": "Corrected reviewed name",
            "payload": {"name": "First Construction Ltd"},
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert saved_review.status_code == 200
    assert saved_review.json()["actor"] == "analyst"
    assert client.get("/api/calendar").json()["items"][0]["entity_name"] == "First Construction Ltd"
    saved_relationship = client.get("/api/relationships").json()["items"][0]
    assert saved_relationship["from_name"] == "First Construction Ltd"
    assert saved_relationship["to_name"] == "Project Test"
    assert saved_relationship["valid_from"].startswith("2026-09-01T00:00:00")
    assert saved_relationship["valid_to"].startswith("2027-08-31T00:00:00")
