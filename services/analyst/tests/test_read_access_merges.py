from datetime import timedelta

from sqlalchemy import select

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.service import IntelligenceService
from meritus.models import Entity, SourceRecord
from meritus.read_access import entity_projection_map


def _source_alias(repo, now, *, external_id: str, key: str, name: str):
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id=external_id,
                    source_url=f"https://example.test/{external_id}",
                    title=name,
                    published_at=now - timedelta(days=1),
                    payload={},
                    entities=[
                        EntityInput(
                            key=key,
                            name=name,
                            scheme="GB-COH",
                            identifier=key.removeprefix("GB-COH:"),
                            verified=True,
                            properties={"sector": "construction"},
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key=key,
                            kind="accounts_overdue",
                            event_key=f"accounts:{external_id}",
                            headline=f"Signal for {name}",
                            detail="Source signal",
                            occurred_at=now - timedelta(days=2),
                            state="verified",
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    with session_scope(repo.engine) as database:
        entity = database.scalar(select(Entity).where(Entity.key == key))
        record = database.scalar(
            select(SourceRecord).where(SourceRecord.external_id == external_id)
        )
        return entity.id, record.id


def test_merged_alias_is_excluded_and_destination_only_exposes_readable_alias_metadata(
    repo, engine, now, monkeypatch
):
    monkeypatch.setattr("meritus.repository.workflow.utc_now", lambda: now)
    readable_id, _ = _source_alias(
        repo,
        now,
        external_id="readable-alias",
        key="GB-COH:00001001",
        name="Readable Alias Ltd",
    )
    restricted_id, restricted_record_id = _source_alias(
        repo,
        now,
        external_id="restricted-alias",
        key="GB-COH:00001002",
        name="Restricted Alias Ltd",
    )
    with session_scope(engine) as database:
        destination = Entity(
            key="GB-COH:00001003",
            kind="organisation",
            name="Canonical Destination Ltd",
            scheme="GB-COH",
            identifier="00001003",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        database.add(destination)
        database.flush()
        destination_id = destination.id

    repo.record_review(
        "entity",
        readable_id,
        "merge",
        "Resolved readable alias",
        "WR",
        {"into_entity_id": destination_id},
    )
    repo.record_review(
        "entity",
        restricted_id,
        "merge",
        "Resolved restricted alias",
        "WR",
        {"into_entity_id": destination_id},
    )
    with session_scope(engine) as database:
        restricted_record = database.get(SourceRecord, restricted_record_id)
        restricted_record.expires_at = now - timedelta(seconds=1)

    with session_scope(engine) as database:
        destination = entity_projection_map(database, [destination_id], now=now)[destination_id]
        aliases = destination["properties"]["source_identities"]
        assert [item["name"] for item in aliases] == ["Readable Alias Ltd"]
        assert {item["entity_id"] for item in aliases} == {readable_id}
        assert "Restricted Alias Ltd" not in str(destination)

    inputs = IntelligenceService(repo)._frozen_inputs(now)
    assert [item["id"] for item in inputs["entities"]] == [destination_id]
    watchlist = IntelligenceService(repo).watchlist(now)
    assert {item["entity_id"] for item in watchlist["items"]} == {destination_id}
    assert "Restricted Alias Ltd" not in str(watchlist)


def test_projected_merged_source_keeps_audited_redirect_marker(repo, engine, now):
    source_id, _ = _source_alias(
        repo,
        now,
        external_id="redirected-alias",
        key="GB-COH:00002001",
        name="Redirected Alias Ltd",
    )
    with session_scope(engine) as database:
        destination = Entity(
            key="GB-COH:00002002",
            kind="organisation",
            name="Redirect Destination Ltd",
            scheme="GB-COH",
            identifier="00002002",
            verified=True,
            properties={},
            created_at=now,
            updated_at=now,
        )
        database.add(destination)
        database.flush()
        destination_id = destination.id
    decision = repo.record_review(
        "entity",
        source_id,
        "merge",
        "Resolved alias",
        "WR",
        {"into_entity_id": destination_id},
    )

    with session_scope(engine) as database:
        projected = entity_projection_map(database, [source_id], now=now)[source_id]
    assert projected["properties"]["merged_into_entity_id"] == destination_id
    assert projected["properties"]["merge_review_id"] == decision["id"]
