from datetime import timedelta

import pytest
from sqlalchemy import select

from meritus.db import session_scope
from meritus.domain import (
    EntityInput,
    FetchBatch,
    ObservationInput,
    ParsedDocument,
    RelationshipInput,
)
from meritus.models import CalendarEntry, ImportPreview, Outbox, Relationship, SourceRecord
from meritus.retention import _chunks, purge_expired, register_managed_artifact, sanitise_snapshot
from meritus.workflow.calendar import create_calendar_entry
from meritus.workflow.relationships import add_reviewed_relationship


def evidence(repo, now, *, expired=True, external_id="sensitive"):
    entity = EntityInput(
        key="GB-COH:09999999",
        name="Synthetic Restricted Limited",
        scheme="GB-COH",
        identifier="09999999",
        verified=True,
    )
    doc = ParsedDocument(
        external_id=external_id,
        source_url="https://example.org/source",
        title="Sensitive source title",
        published_at=now - timedelta(days=2),
        expires_at=now - timedelta(seconds=1) if expired else now + timedelta(days=1),
        raw_text="PROHIBITED CONTENT",
        payload={"text": "PROHIBITED CONTENT"},
        entities=[entity],
        observations=[
            ObservationInput(
                subject_key=entity.key,
                kind="project_delay",
                event_key=external_id,
                headline="PROHIBITED CONTENT",
                detail="PROHIBITED CONTENT",
                state="verified",
            )
        ],
        relationships=[
            RelationshipInput(
                from_key=entity.key,
                to_key=entity.key,
                role="adviser",
                evidence_pointer="PROHIBITED CONTENT",
            )
        ],
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[doc]), now)
    return repo.list_records()[0]


def test_expiry_erases_canonical_snapshot_and_managed_files_but_reports_pending_search(
    repo, now, tmp_path
):
    record = evidence(repo, now)
    snapshot = repo.save_snapshot(
        "weekly",
        now,
        "test",
        {
            "items": [
                {
                    "entity_id": record["observations"][0]["entity_id"],
                    "name": "Sensitive source title",
                    "contributions": [
                        {
                            "record_id": record["id"],
                            "observation_id": record["observations"][0]["id"],
                        }
                    ],
                }
            ],
            "source_records": [record],
            "observations": record["observations"],
        },
    )
    export = tmp_path / "exports" / "sensitive.csv"
    export.parent.mkdir()
    export.write_text("PROHIBITED CONTENT")
    register_managed_artifact(export, [record["id"]], "export", managed_root=tmp_path)
    result = purge_expired(repo, now, tmp_path)
    stored = repo.list_records()[0]
    assert (
        stored["raw_text"] is None and stored["payload"]["erasure"]["reason"] == "retention_expired"
    )
    assert stored["observations"] == [] and repo.list_relationships() == []
    assert "PROHIBITED CONTENT" not in str(repo.get_snapshot(snapshot["id"]))
    assert not export.exists()
    assert result["records_erased"] == 1 and result["pending_search_deletions"] == 1
    assert result["complete"] is False
    with session_scope(repo.engine) as session:
        actions = session.scalars(select(Outbox).where(Outbox.processed_at.is_(None))).all()
        assert [item.operation for item in actions] == ["delete"]
    again = purge_expired(repo, now, tmp_path)
    assert again["records_erased"] == 0 and again["pending_search_deletions"] == 1
    assert again["snapshots_redacted"] == 0


def test_unexpired_and_open_licence_records_remain(repo, now, tmp_path):
    record = evidence(repo, now, expired=False)
    assert purge_expired(repo, now, tmp_path)["records_erased"] == 0
    assert repo.list_records()[0]["raw_text"] == "PROHIBITED CONTENT"
    with session_scope(repo.engine) as session:
        session.get(SourceRecord, record["id"]).expires_at = None
    assert purge_expired(repo, now + timedelta(days=100), tmp_path)["records_erased"] == 0


def test_managed_artifact_rejects_traversal_and_replaced_files(repo, now, tmp_path):
    root = tmp_path / "managed"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("USER FILE")
    with pytest.raises(ValueError):
        register_managed_artifact(outside, ["a"], "export", managed_root=root)
    linked = root / "link.txt"
    linked.symlink_to(outside)
    with pytest.raises(ValueError):
        register_managed_artifact(linked, ["a"], "export", managed_root=root)
    record = evidence(repo, now)
    target = root / "export.csv"
    target.write_text("PROHIBITED CONTENT")
    register_managed_artifact(target, [record["id"]], "export", managed_root=root)
    target.write_text("REPLACED USER FILE")
    result = purge_expired(repo, now, root)
    assert target.read_text() == "REPLACED USER FILE" and outside.read_text() == "USER FILE"
    assert result["unresolved_artifacts"] and result["complete"] is False


def test_snapshot_redaction_preserves_unaffected_rows_and_clears_derived_metadata():
    snapshot = {
        "payload": {
            "items": [
                {"name": "unaffected", "contributions": [{"record_id": "b"}]},
                {"name": "secret", "score": 42, "contributions": [{"record_id": "a"}]},
            ],
            "source_records": [{"id": "a", "raw_text": "secret"}, {"id": "b", "title": "public"}],
            "observations": [{"id": "obs-a", "record_id": "a", "detail": "secret"}],
            "coverage": {"score": 42},
        }
    }
    result = sanitise_snapshot(
        snapshot, {"a"}, {"observation_ids": {"obs-a"}, "now": "2026-09-12T00:00:00+00:00"}
    )
    assert result["payload"]["items"] == [
        {"name": "unaffected", "contributions": [{"record_id": "b"}]}
    ]
    assert "secret" not in str(result)
    assert result["payload"]["coverage"]["complete"] is False
    assert snapshot["payload"]["items"][1]["name"] == "secret"


def test_retention_identifier_queries_stay_below_postgres_bind_limit():
    identifiers = {f"record-{index:05d}" for index in range(70_000)}

    batches = list(_chunks(identifiers))

    assert max(map(len, batches)) == 5_000
    assert set().union(*map(set, batches)) == identifiers


def test_restore_erasure_ledger_prevents_same_record_from_reappearing(repo, now, tmp_path):
    record = evidence(repo, now)
    purge_expired(repo, now, tmp_path)
    # Simulate restoring a pre-erasure row without its old expiry date.
    with session_scope(repo.engine) as session:
        row = session.get(SourceRecord, record["id"])
        row.raw_text = "PROHIBITED CONTENT"
        row.payload = {"text": "PROHIBITED CONTENT"}
        row.expires_at = None
        row.active = True
    result = purge_expired(repo, now, tmp_path)
    assert result["records_erased"] == 1 and repo.list_records()[0]["raw_text"] is None


def test_expired_import_previews_are_erased_even_without_records(repo, now, tmp_path):
    with session_scope(repo.engine) as session:
        session.add(
            ImportPreview(
                kind="documents",
                token_hash="a" * 64,
                payload={"text": "PROHIBITED CONTENT"},
                created_at=now - timedelta(hours=1),
                expires_at=now - timedelta(minutes=1),
            )
        )
    result = purge_expired(repo, now, tmp_path)
    with session_scope(repo.engine) as session:
        assert session.scalar(select(ImportPreview)).payload == {}
    assert result["previews_erased"] == 1


def test_late_restored_snapshot_is_redacted_from_durable_ledger(repo, now, tmp_path):
    record = evidence(repo, now)
    observation = record["observations"][0]
    purge_expired(repo, now, tmp_path)
    snapshot = repo.save_snapshot(
        "weekly",
        now,
        "test",
        {
            "items": [
                {
                    "name": "PROHIBITED CONTENT",
                    "contributions": [{"observation_id": observation["id"]}],
                }
            ]
        },
    )
    result = purge_expired(repo, now, tmp_path)
    assert result["snapshots_redacted"] == 1
    assert "PROHIBITED CONTENT" not in str(repo.get_snapshot(snapshot["id"]))


def test_late_restored_preview_is_erased_from_durable_ledger(repo, now, tmp_path):
    record = evidence(repo, now)
    observation_id = record["observations"][0]["id"]
    purge_expired(repo, now, tmp_path)
    with session_scope(repo.engine) as session:
        session.add(
            ImportPreview(
                kind="documents",
                token_hash="b" * 64,
                payload={"observation_id": observation_id, "text": "PROHIBITED CONTENT"},
                result={"observation_id": observation_id, "text": "PROHIBITED CONTENT"},
                created_at=now,
                expires_at=now + timedelta(days=1),
            )
        )

    result = purge_expired(repo, now, tmp_path)

    with session_scope(repo.engine) as session:
        preview = session.scalar(select(ImportPreview))
        assert preview.payload == {} and preview.result is None
    assert result["previews_erased"] == 1


def test_shared_entity_is_recomputed_from_surviving_source_contributions(repo, now, tmp_path):
    key = "GB-COH:09999999"

    def document(external_id, name, properties, expires_at):
        return ParsedDocument(
            external_id=external_id,
            source_url=f"https://example.org/{external_id}",
            title=name,
            published_at=now,
            expires_at=expires_at,
            payload={},
            entities=[
                EntityInput(
                    key=key,
                    name=name,
                    scheme="GB-COH",
                    identifier="09999999",
                    verified=True,
                    properties=properties,
                )
            ],
            observations=[
                ObservationInput(
                    subject_key=key,
                    kind="project_delay",
                    event_key=external_id,
                    headline=name,
                    detail=name,
                    state="verified",
                )
            ],
        )

    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                document("public", "Public Company Limited", {"public_field": "public"}, None)
            ]
        ),
        now - timedelta(minutes=1),
    )
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(
            documents=[
                document(
                    "private",
                    "PROHIBITED PRIVATE NAME",
                    {"private_field": "PROHIBITED CONTENT", "public_field": "overwritten"},
                    now - timedelta(seconds=1),
                )
            ]
        ),
        now,
    )
    assert repo.list_entities()[0]["name"] == "PROHIBITED PRIVATE NAME"

    purge_expired(repo, now, tmp_path)

    entity = repo.list_entities()[0]
    assert entity["name"] == "Public Company Limited"
    assert entity["properties"] == {"public_field": "public"}
    assert entity["verified"] is True
    assert "PROHIBITED" not in str(entity)


def test_expiry_erases_reviewed_relationship_and_calendar_by_record_lineage(repo, now, tmp_path):
    record = evidence(repo, now, expired=False)
    entity_id = record["observations"][0]["entity_id"]
    relationship = add_reviewed_relationship(
        repo,
        {
            "from_entity_id": entity_id,
            "to_entity_id": entity_id,
            "role": "owner_of",
            "evidence_pointer": "PROHIBITED RELATIONSHIP",
            "valid_from": now.isoformat(),
            "source_record_id": record["id"],
        },
        "WR",
        "PROHIBITED REVIEW",
    )
    calendar = create_calendar_entry(
        repo,
        {
            "entity_id": entity_id,
            "kind": "retention_release",
            "date": "2027-03-31",
            "status": "confirmed",
            "title": "PROHIBITED DATE",
            "source_record_id": record["id"],
        },
    )
    with session_scope(repo.engine) as session:
        session.get(SourceRecord, record["id"]).expires_at = now - timedelta(seconds=1)

    purge_expired(repo, now, tmp_path)

    assert repo.list_relationships() == []
    stored_calendar = repo.list_calendar_entries()[0]
    assert stored_calendar["title"] == "Supporting evidence erased"
    assert stored_calendar["evidence"] == {"erased": True}
    assert relationship["record_id"] == record["id"]
    assert calendar["evidence"]["source_record_id"] == record["id"]
    assert "PROHIBITED" not in str(repo.list_reviews())


def test_purge_safely_resolves_legacy_exact_url_lineage(repo, now, tmp_path):
    record = evidence(repo, now)
    entity_id = record["observations"][0]["entity_id"]
    with session_scope(repo.engine) as session:
        session.add(
            Relationship(
                record_id=None,
                from_entity_id=entity_id,
                to_entity_id=entity_id,
                role="owner_of",
                evidence_pointer="PROHIBITED LEGACY RELATIONSHIP",
                valid_from=now,
                valid_to=None,
                state="verified",
                attributes={"source_url": record["source_url"]},
                created_at=now,
            )
        )
        session.add(
            CalendarEntry(
                entity_id=entity_id,
                kind="retention_release",
                title="PROHIBITED LEGACY DATE",
                date=(now + timedelta(days=30)).date(),
                precision="day",
                source_url=record["source_url"],
                evidence={"page": 7},
                status="confirmed",
                jurisdiction="",
                basis="",
                reviewer="",
                created_at=now,
            )
        )

    purge_expired(repo, now, tmp_path)

    assert repo.list_relationships() == []
    assert repo.list_calendar_entries()[0]["evidence"] == {"erased": True}


def test_permission_expiry_and_explicit_retention_exception(repo, now, tmp_path):
    evidence(repo, now, expired=False)
    repo.update_source(
        "reviewed_import",
        {
            "permissions": {
                "expires_at": (now - timedelta(seconds=1)).isoformat(),
                "retain_after_permission_expiry": True,
            }
        },
    )
    assert purge_expired(repo, now, tmp_path)["records_erased"] == 0
    repo.update_source(
        "reviewed_import", {"permissions": {"retain_after_permission_expiry": False}}
    )
    assert purge_expired(repo, now, tmp_path)["records_erased"] == 1
    assert repo.list_records()[0]["payload"]["erasure"]["reason"] == "permission_expired"


def test_raw_and_backup_artifacts_erased_unmanaged_file_preserved(repo, now, tmp_path):
    record = evidence(repo, now)
    for kind in ["raw", "backup"]:
        target = tmp_path / f"{kind}.bin"
        target.write_bytes(b"PROHIBITED CONTENT")
        register_managed_artifact(target, [record["id"]], kind, managed_root=tmp_path)
    unmanaged = tmp_path / "unmanaged.txt"
    unmanaged.write_text("USER FILE")
    assert purge_expired(repo, now, tmp_path)["artifacts_removed"] == 2
    assert unmanaged.read_text() == "USER FILE"


def test_restore_merges_current_erasure_markers_without_restoring_artifact_paths(
    repo, now, tmp_path
):
    from meritus.retention import merge_erasure_ledger, read_erasure_ledger

    record = evidence(repo, now)
    purge_expired(repo, now, tmp_path)
    current = read_erasure_ledger(tmp_path)
    assert record["id"] in current["erasures"] and "artifacts" not in current
    merge_erasure_ledger({"version": 1, "erasures": {}}, tmp_path)
    assert read_erasure_ledger(tmp_path) == current
    with pytest.raises(ValueError):
        merge_erasure_ledger(
            {"version": 1, "erasures": {}, "artifacts": {"../outside": {}}}, tmp_path
        )
