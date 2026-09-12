from datetime import UTC, datetime, timedelta

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.models import CalendarEntry, Entity, Relationship


def seed(repo):
    now = datetime.now(UTC)
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="timing-source",
                    source_url="https://example.test/timing",
                    title="Synthetic timing source",
                    published_at=now - timedelta(days=1),
                    payload={},
                    entities=[
                        EntityInput(
                            key="TEST:TIMING",
                            name="Synthetic timing entity",
                            scheme="TEST",
                            identifier="TIMING",
                            verified=True,
                        )
                    ],
                )
            ]
        ),
        now,
    )
    return repo.list_entities()[0]["id"], repo.list_records()[0]["id"]


def test_illustrative_timing_is_never_saved_or_actionable(authenticated, repo):
    client, csrf = authenticated
    entity_id, _record_id = seed(repo)
    response = client.post(
        "/api/calendar/timing",
        json={
            "entity_id": entity_id,
            "accrual_date": "2024-02-29",
            "period_years": 6,
            "input_basis": "Synthetic entered date and selected period; no legal conclusion",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["preview"]["date"] == "2030-02-28"
    assert body["preview"]["status"] == "provisional"
    assert body["persisted"] is False and body["actionable"] is False
    assert client.get("/api/calendar/actionable").json()["items"] == []
    assert repo.list_calendar_entries() == []


def test_expired_entity_cannot_be_used_for_timing_preview(authenticated, repo):
    client, csrf = authenticated
    entity_id, _record_id = seed(repo)
    repo.update_source("payment_practices", {"permissions": {"denied": True}})
    result = client.post(
        "/api/calendar/timing",
        json={
            "entity_id": entity_id,
            "accrual_date": "2024-02-29",
            "period_years": 6,
            "input_basis": "Synthetic basis",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert result.status_code == 404
    assert client.get("/api/opportunities").json()["project_exposures"] == []


def test_post_completion_window_requires_confirmed_practical_completion(authenticated, repo):
    client, _csrf = authenticated
    entity_id, record_id = seed(repo)
    with session_scope(repo.engine) as session:
        row = CalendarEntry(
            entity_id=entity_id,
            kind="practical_completion",
            title="Synthetic certified completion",
            date=datetime(2024, 2, 29).date(),
            precision="day",
            source_url="https://example.test/timing",
            evidence={"source_record_id": record_id},
            status="confirmed",
            jurisdiction="",
            basis="Synthetic certificate",
            reviewer="analyst",
            created_at=datetime.now(UTC),
        )
        session.add(row)
        session.flush()
        entry_id = row.id
    result = client.get(f"/api/calendar/{entry_id}/post-completion-window")
    assert result.status_code == 200, result.text
    assert result.json()["window_start"] == "2025-02-28"
    assert result.json()["window_end"] == "2026-02-28"
    assert client.get("/api/calendar/actionable").json()["total"] == 1
    with session_scope(repo.engine) as session:
        session.get(CalendarEntry, entry_id).kind = "forecast_completion"
    assert client.get(f"/api/calendar/{entry_id}/post-completion-window").status_code == 400


def test_opportunity_paging_distinguishes_more_pages_from_incomplete_inputs(
    authenticated, repo, monkeypatch
):
    client, _ = authenticated
    entity_id, record_id = seed(repo)
    now = datetime.now(UTC)
    with session_scope(repo.engine) as session:
        professional = Entity(
            key="TEST:PROFESSIONAL",
            scheme="TEST",
            identifier="PROFESSIONAL",
            name="Synthetic professional",
            kind="person",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        session.add(professional)
        session.flush()
        for number in range(2):
            session.add(
                Relationship(
                    record_id=record_id,
                    from_entity_id=professional.id,
                    to_entity_id=entity_id,
                    role="solicitor",
                    evidence_pointer=f"synthetic:matter:{number}",
                    valid_from=now - timedelta(days=1),
                    state="verified",
                    attributes={"matter_reference": f"SYNTHETIC-{number}"},
                    created_at=now,
                )
            )
    first = client.get("/api/opportunities?page_size=1").json()
    assert first["totals"]["introduction_routes"] == 2
    assert first["has_more"]["introduction_routes"] is True
    assert first["totals_complete"] is True and first["truncated"] is False
    second = client.get("/api/opportunities?page=2&page_size=1").json()
    assert (
        second["introduction_routes"][0]["relationship_id"]
        != first["introduction_routes"][0]["relationship_id"]
    )
    monkeypatch.setattr("meritus.api.opportunities.INPUT_LIMIT", 1)
    limited = client.get("/api/opportunities?page_size=1").json()
    assert limited["truncated"] is True and limited["totals_complete"] is False
    assert "lower bounds" in limited["coverage"]
