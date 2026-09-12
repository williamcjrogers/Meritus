from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from meritus.db import session_scope
from meritus.domain import (
    EntityInput,
    FetchBatch,
    ObservationInput,
    ParsedDocument,
    RelationshipInput,
)
from meritus.models import (
    Alert,
    CalendarEntry,
    Entity,
    EntityProvenance,
    IngestionRun,
    PipelineAction,
    Relationship,
    Review,
    SourceRecord,
)


def _ingest_private_lineage(repo, now):
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="private-lineage",
                    source_url="https://example.test/private-lineage",
                    title="Restricted evidence title",
                    published_at=now - timedelta(days=2),
                    payload={"private_detail": "Restricted payload value"},
                    entities=[
                        EntityInput(
                            key="TEST:PRIVATE",
                            name="Restricted Entity Name",
                            scheme="TEST",
                            identifier="PRIVATE",
                            verified=True,
                            properties={"sector": "Restricted sector"},
                        ),
                        EntityInput(
                            key="TEST:COUNTERPARTY",
                            name="Restricted Counterparty Name",
                            scheme="TEST",
                            identifier="COUNTERPARTY",
                            verified=True,
                        ),
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="TEST:PRIVATE",
                            kind="insolvency",
                            event_key="restricted-event",
                            headline="Restricted evidence headline",
                            detail="Restricted evidence detail",
                            occurred_at=now - timedelta(days=1),
                            state="verified",
                            evidence_pointer="restricted:1",
                        )
                    ],
                    relationships=[
                        RelationshipInput(
                            from_key="TEST:PRIVATE",
                            to_key="TEST:COUNTERPARTY",
                            role="restricted role",
                            evidence_pointer="restricted:2",
                            state="verified",
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    with session_scope(repo.engine) as database:
        record = database.scalar(
            select(SourceRecord).where(SourceRecord.external_id == "private-lineage")
        )
        entity = database.scalar(select(Entity).where(Entity.key == "TEST:PRIVATE"))
        observation = record.observations[0]
        database.add_all(
            [
                CalendarEntry(
                    entity_id=entity.id,
                    kind="hearing",
                    title="Restricted calendar title",
                    date=now.date(),
                    precision="day",
                    source_url=record.source_url,
                    evidence={"source_record_id": record.id},
                    status="confirmed",
                    jurisdiction="England and Wales",
                    basis="Restricted basis",
                    reviewer="analyst",
                    created_at=now,
                ),
                PipelineAction(
                    entity_id=entity.id,
                    stage="triage",
                    note="Restricted pipeline note",
                    actor="analyst",
                    occurred_at=now,
                ),
                Review(
                    target_type="observation",
                    target_id=observation.id,
                    action="verified",
                    actor="analyst",
                    reason="Restricted review reason",
                    payload={},
                    created_at=now,
                ),
                Alert(
                    dedupe_key="restricted-alert",
                    entity_id=entity.id,
                    category="evidence",
                    title="Restricted alert title",
                    body="Restricted alert body",
                    created_at=now,
                ),
                Review(
                    target_type="entity",
                    target_id=entity.id,
                    action="update",
                    actor="source-review",
                    reason="Restricted review reason",
                    payload={
                        "changes": {
                            "name": "Restricted review name",
                            "properties": {"review_secret": "restricted"},
                        },
                        "source_url": record.source_url,
                    },
                    created_at=now,
                ),
            ]
        )
        return record.id, entity.id


def test_denied_lineage_is_absent_from_every_api_read(authenticated, repo):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    record_id, entity_id = _ingest_private_lineage(repo, now)
    repo.save_snapshot(
        "weekly",
        now,
        "meritus-v1",
        {
            "items": [
                {
                    "entity_id": entity_id,
                    "name": "Restricted Entity Name",
                    "score": 25,
                    "source_ids": ["find_tender"],
                    "contributions": [
                        {
                            "record_id": record_id,
                            "source_id": "find_tender",
                            "points": 25,
                            "applied_points": 25,
                        }
                    ],
                }
            ],
            "rule_version": "meritus-v1",
            "knowledge_cutoff": now.isoformat(),
            "export_policy": {"find_tender": True},
        },
    )
    repo.update_source("find_tender", {"permissions": {"denied": True}})

    for path in (
        "/api/entities",
        "/api/evidence",
        "/api/relationships",
        "/api/calendar",
        "/api/pipeline",
        "/api/reviews",
        "/api/alerts",
        "/api/watchlist",
        "/api/dashboard",
        "/api/indices",
        "/api/metrics",
    ):
        response = client.get(path)
        assert response.status_code == 200, (path, response.text)
        assert "Restricted" not in response.text, path
    assert client.get(f"/api/entities/{entity_id}").status_code == 404

    with session_scope(repo.engine) as database:
        record = database.get(SourceRecord, record_id)
        assert record.raw_text is None
        assert record.payload["private_detail"] == "Restricted payload value"


def test_expired_import_permission_is_an_immediate_read_boundary(authenticated, repo):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    record_id, entity_id = _ingest_private_lineage(repo, now)
    with session_scope(repo.engine) as database:
        record = database.get(SourceRecord, record_id)
        record.expires_at = None
        record.payload = {
            **record.payload,
            "import_permission": {
                "expires_at": (now - timedelta(seconds=1)).isoformat(),
                "retain_after_permission_expiry": True,
            },
        }

    assert client.get("/api/evidence").json()["total"] == 0
    assert client.get("/api/entities").json()["total"] == 0
    assert client.get(f"/api/entities/{entity_id}").status_code == 404
    with session_scope(repo.engine) as database:
        assert database.get(SourceRecord, record_id).payload["private_detail"] == (
            "Restricted payload value"
        )
        record = database.get(SourceRecord, record_id)
        record.payload = {
            **record.payload,
            "import_permission": {"expires_at": "not-a-valid-date"},
        }
    assert client.get("/api/evidence").json()["total"] == 0


def test_entity_projection_never_falls_back_to_a_denied_canonical_value(authenticated, repo):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    with session_scope(repo.engine) as database:
        entity = Entity(
            key="TEST:MIXED",
            kind="organisation",
            name="Restricted canonical name",
            scheme="TEST",
            identifier="MIXED",
            verified=True,
            properties={"sector": "Restricted canonical sector", "secret": "restricted"},
            created_at=now - timedelta(days=2),
            updated_at=now,
        )
        permitted_record = SourceRecord(
            source_id="find_tender",
            external_id="mixed-public",
            revision=1,
            content_hash="a" * 64,
            source_url="https://example.test/mixed-public",
            title="Public record",
            published_at=now - timedelta(days=2),
            observed_at=now - timedelta(days=2),
            active=True,
            withdrawn=False,
            media_type="application/json",
            payload={},
        )
        denied_record = SourceRecord(
            source_id="hmcts",
            external_id="mixed-restricted",
            revision=1,
            content_hash="b" * 64,
            source_url="https://example.test/mixed-restricted",
            title="Restricted record",
            published_at=now - timedelta(days=1),
            observed_at=now - timedelta(days=1),
            active=True,
            withdrawn=False,
            media_type="application/json",
            payload={},
        )
        database.add_all([entity, permitted_record, denied_record])
        database.flush()
        database.add_all(
            [
                EntityProvenance(
                    entity_id=entity.id,
                    record_id=permitted_record.id,
                    name="Permitted projected name",
                    properties={"sector": "Permitted sector"},
                    verified=True,
                    observed_at=permitted_record.observed_at,
                ),
                EntityProvenance(
                    entity_id=entity.id,
                    record_id=denied_record.id,
                    name="Restricted canonical name",
                    properties={"sector": "Restricted canonical sector", "secret": "restricted"},
                    verified=True,
                    observed_at=denied_record.observed_at,
                ),
                Review(
                    target_type="entity",
                    target_id=entity.id,
                    action="update",
                    actor="source-review",
                    reason="Restricted review reason",
                    payload={
                        "changes": {
                            "name": "Restricted review name",
                            "properties": {"review_secret": "restricted"},
                        },
                        "source_url": denied_record.source_url,
                    },
                    created_at=now,
                ),
            ]
        )
        entity_id = entity.id

    listing = client.get("/api/entities?q=Permitted projected name")
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    item = listing.json()["items"][0]
    assert item["name"] == "Permitted projected name"
    assert item["properties"] == {"sector": "Permitted sector"}
    assert "Restricted" not in listing.text
    assert "secret" not in listing.text

    detail = client.get(f"/api/entities/{entity_id}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "Permitted projected name"
    assert "Restricted" not in detail.text
    assert "secret" not in detail.text
    reviews = client.get("/api/reviews")
    assert reviews.status_code == 200
    assert "Restricted review" not in reviews.text


def test_list_routes_use_query_pagination_instead_of_repository_materialisation(
    authenticated, repo, engine, monkeypatch
):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    with session_scope(engine) as database:
        first = Entity(
            key="TEST:PAGE:FIRST",
            kind="organisation",
            name="First page entity",
            scheme="TEST",
            identifier="PAGE:FIRST",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        second = Entity(
            key="TEST:PAGE:SECOND",
            kind="organisation",
            name="Second page entity",
            scheme="TEST",
            identifier="PAGE:SECOND",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        database.add_all([first, second])
        database.flush()
        database.add_all(
            [
                Relationship(
                    from_entity_id=first.id,
                    to_entity_id=second.id,
                    role="analyst route",
                    evidence_pointer="analyst",
                    state="verified",
                    attributes={},
                    created_at=now,
                ),
                CalendarEntry(
                    entity_id=first.id,
                    kind="review",
                    title="Review date",
                    date=now.date(),
                    precision="day",
                    source_url="",
                    evidence={},
                    status="provisional",
                    jurisdiction="",
                    basis="",
                    reviewer="analyst",
                    created_at=now,
                ),
                PipelineAction(
                    entity_id=first.id,
                    stage="triage",
                    note="Review",
                    actor="analyst",
                    occurred_at=now,
                ),
                Review(
                    target_type="entity",
                    target_id=first.id,
                    action="verified",
                    actor="analyst",
                    reason="Reviewed",
                    payload={},
                    created_at=now,
                ),
                IngestionRun(
                    source_id="find_tender",
                    status="success",
                    started_at=now,
                    finished_at=now,
                    fetched=0,
                    inserted=0,
                    updated=0,
                    rejected=0,
                    detail={},
                ),
            ]
        )

    def materialised(*_args, **_kwargs):
        raise AssertionError("route used a full repository list")

    for name in (
        "list_relationships",
        "list_calendar_entries",
        "list_pipeline_actions",
        "list_reviews",
        "list_runs",
    ):
        monkeypatch.setattr(repo, name, materialised)
    for path in ("relationships", "calendar", "pipeline", "reviews", "runs"):
        response = client.get(f"/api/{path}?page=1&page_size=1")
        assert response.status_code == 200, (path, response.text)
        assert response.json()["total"] == 1
        assert len(response.json()["items"]) == 1
