import json
import os
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url

from meritus.config import Settings
from meritus.db import create_engine_for_url, initialise_database, session_scope
from meritus.domain import (
    EntityInput,
    FetchBatch,
    ObservationInput,
    ParsedDocument,
    RelationshipInput,
)
from meritus.models import Entity, IngestionRun, Outbox, Review, Source, SourceRecord
from meritus.repository import Repository


def payment_document(now: datetime, *, days: int = 75, withdrawn: bool = False):
    return ParsedDocument(
        external_id="report-1",
        source_url="https://example.org/report/1?api_key=do-not-store",
        title="Payment report",
        published_at=now,
        payload={"days": days, "original_url": "https://u:p@example.org/raw?token=secret"},
        entities=[
            EntityInput(
                key="GB-COH:08834019",
                name="Example Ltd",
                scheme="GB-COH",
                identifier="08834019",
                verified=True,
            )
        ],
        observations=[]
        if withdrawn
        else [
            ObservationInput(
                subject_key="GB-COH:08834019",
                kind="payment_report",
                event_key="payment:08834019:2026-06-30",
                headline=f"{days} average payment days",
                detail="Reported period",
                occurred_at=now,
                state="verified",
                value=days,
            )
        ],
        withdrawn=withdrawn,
    )


def test_replay_does_not_duplicate_observations(repo, now):
    doc = payment_document(now)
    batch = FetchBatch(documents=[doc], cursor="page-2")
    repo.ingest_batch("payment_practices", batch, now)
    repo.ingest_batch("payment_practices", batch, now + timedelta(hours=1))

    assert len(repo.list_observations()) == 1
    assert repo.get_source("payment_practices")["cursor"] == "page-2"
    with session_scope(repo.engine) as session:
        assert session.scalar(select(func.count()).select_from(SourceRecord)) == 1
        assert session.scalar(select(func.count()).select_from(Outbox)) == 1
        record = session.scalar(select(SourceRecord))
        assert record.observed_at == now.replace(tzinfo=None)


def test_changed_payload_deactivates_previous_revision(repo, now):
    repo.ingest_batch(
        "payment_practices", FetchBatch(documents=[payment_document(now)], cursor="one"), now
    )
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[payment_document(now, days=90)], cursor="two"),
        now + timedelta(days=1),
    )

    current = repo.list_observations()
    history = repo.list_observations(active_only=False)
    records = repo.list_records()
    assert len(current) == 1
    assert current[0]["value"] == 90
    assert [(item["revision"], item["active"]) for item in records] == [(2, True), (1, False)]
    assert len(history) == 2
    assert {item["active"] for item in history} == {True, False}


def test_stale_digest_stays_inactive_and_restoration_requires_new_version(repo, now):
    original = payment_document(now)
    correction = payment_document(now, days=90)
    repo.ingest_batch("payment_practices", FetchBatch(documents=[original], cursor="original"), now)
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[correction], cursor="correction"),
        now + timedelta(days=1),
    )

    stale = repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[original], cursor="stale-replay"),
        now + timedelta(days=2),
    )

    assert stale["replayed"] == 1
    assert repo.list_observations()[0]["value"] == 90
    assert [(record["revision"], record["active"]) for record in repo.list_records()] == [
        (2, True),
        (1, False),
    ]

    restored = original.model_copy(
        update={
            "payload": {
                **original.payload,
                "source_version": "restoration-3",
                "updated_at": (now + timedelta(days=3)).isoformat(),
            }
        }
    )
    result = repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[restored], cursor="restored"),
        now + timedelta(days=3),
    )

    assert result["updated"] == 1
    assert repo.list_observations()[0]["value"] == 75
    assert repo.list_records()[0]["revision"] == 3


def test_withdrawn_record_removes_active_observations(repo, now):
    repo.ingest_batch("payment_practices", FetchBatch(documents=[payment_document(now)]), now)
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[payment_document(now, withdrawn=True)]),
        now + timedelta(days=1),
    )

    assert repo.list_observations() == []
    assert len(repo.list_observations(active_only=False)) == 1
    latest = repo.list_records()[0]
    assert latest["withdrawn"] is True
    assert latest["active"] is True


def test_transaction_rollback_leaves_cursor_and_records_unchanged(repo, now, monkeypatch):
    repo.ingest_batch("payment_practices", FetchBatch(cursor="before"), now)
    original = repo._ingest_document
    calls = 0

    def fail_on_second(session, source_id, document, digest, observed_at):
        nonlocal calls
        calls += 1
        result = original(session, source_id, document, digest, observed_at)
        if calls == 2:
            raise RuntimeError("synthetic second-document failure")
        return result

    monkeypatch.setattr(repo, "_ingest_document", fail_on_second)
    first = payment_document(now)
    second = payment_document(now, days=80).model_copy(update={"external_id": "report-2"})

    with pytest.raises(RuntimeError, match="second-document"):
        repo.ingest_batch(
            "payment_practices", FetchBatch(documents=[first, second], cursor="after"), now
        )

    assert repo.get_source("payment_practices")["cursor"] == "before"
    assert repo.list_records() == []
    assert repo.list_entities() == []


def test_unknown_subject_rejects_whole_batch(repo, now):
    document = payment_document(now)
    document.observations.append(
        ObservationInput(
            subject_key="GB-COH:09999999",
            kind="payment_report",
            event_key="unknown",
            headline="Unknown",
            detail="Must reject",
            occurred_at=now,
        )
    )

    with pytest.raises(ValueError, match="Unknown observation subject"):
        repo.ingest_batch(
            "payment_practices", FetchBatch(documents=[document], cursor="must-not-advance"), now
        )

    assert repo.get_source("payment_practices")["cursor"] is None
    assert repo.list_records() == []
    assert repo.list_entities() == []


def test_repository_contract_sources_runs_and_evidence(repo, now):
    source_ids = {source["id"] for source in repo.list_sources()}
    assert source_ids == {
        "companies_house",
        "gazette",
        "find_tender",
        "contracts_finder",
        "payment_practices",
        "bsr_gateway",
        "ras_members",
        "ras_prohibitions",
        "developer_remediation",
        "debarment",
        "hmcts",
        "find_case_law",
        "rns",
        "adzuna",
        "construction_index",
        "reviewed_import",
    }
    source = repo.update_source(
        "payment_practices", {"config": {"page_limit": 3}, "permissions": {"reference": "OGL-3"}}
    )
    assert source["config"]["page_limit"] == 3
    assert source["permissions"] == {"reference": "OGL-3"}
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source("payment_practices", {"config": {"api_key": "forbidden"}})
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source("payment_practices", {"config": {"stream_key": "forbidden"}})
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source("payment_practices", {"config": {"rns_user": "forbidden"}})
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source("payment_practices", {"config": {"adzuna_app_id": "forbidden"}})
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source(
            "payment_practices", {"config": {"base_url": "https://user:pass@example.org"}}
        )
    with pytest.raises(ValueError, match="Secrets"):
        repo.update_source(
            "payment_practices",
            {"config": {"download_url": "https://example.org/file?X-Amz-Signature=signed"}},
        )
    safe_anchor = repo.update_source(
        "payment_practices", {"config": {"documentation_url": "https://example.org/help#limits"}}
    )
    assert safe_anchor["config"]["documentation_url"].endswith("#limits")
    with session_scope(repo.engine) as session:
        stored_source = session.get(Source, "payment_practices")
        stored_source.config = {"rns_user": "legacy-user", "adzuna_app_id": "legacy-id"}
    masked_source = repo.get_source("payment_practices")
    assert masked_source["config"]["rns_user"] == "********"
    assert masked_source["config"]["adzuna_app_id"] == "********"

    run_id = repo.begin_run("payment_practices")
    with pytest.raises(ValueError, match="active ingestion run"):
        repo.begin_run("payment_practices")
    result = repo.ingest_batch(
        "payment_practices",
        FetchBatch(documents=[payment_document(now)], cursor="done"),
        now,
        run_id,
    )
    repo.finish_run(run_id, "success", detail={"coverage": "complete"})

    assert result == {
        "source_id": "payment_practices",
        "fetched": 1,
        "inserted": 1,
        "updated": 0,
        "replayed": 0,
        "cursor": "done",
    }
    entity = repo.list_entities(query="example", kind="organisation", limit=1)[0]
    assert repo.get_entity(entity["id"])["key"] == "GB-COH:08834019"
    observation = repo.list_observations(entity["id"])[0]
    assert observation["source_id"] == "payment_practices"
    assert "api_key" not in observation["source_url"]
    record = repo.list_records(entity["id"])[0]
    assert record["observations"][0]["id"] == observation["id"]
    assert record["source_licence_url"]
    assert "token" not in str(record["payload"])
    assert "u:p@" not in str(record["payload"])
    assert "do-not-store" not in observation["source_url"]
    with session_scope(repo.engine) as session:
        run = session.get(IngestionRun, run_id)
        assert run.status == "success"
        assert run.fetched == 1
        assert run.inserted == 1
        assert run.detail == {"coverage": "complete"}


def test_runtime_defaults_to_postgresql_and_masks_connection_credentials():
    settings = Settings()
    settings_with_password = Settings(
        database_url="postgresql+psycopg://meritus:database-secret@localhost:5432/meritus"
    )

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert "database-secret" not in settings_with_password.masked()["database_url"]


def test_failed_run_preserves_validated_adapter_accounting(repo):
    run_id = repo.begin_run("find_tender")
    detail = {
        "fetched": 2,
        "rejected": 1,
        "rejected_records": [
            {
                "external_id": "notice086578-2026",
                "source_url": "https://example.org/notices/notice086578-2026",
                "reason": "Non-finite source value requires normalisation",
            }
        ],
    }

    repo.finish_run(run_id, "failed", error="Batch validation failed", detail=detail)

    failed = repo.list_runs("find_tender")[0]
    assert failed["fetched"] == 2
    assert failed["rejected"] == 1
    assert failed["detail"] == detail


@pytest.mark.parametrize(
    ("detail", "message"),
    [
        ({"fetched": -1, "rejected": 0}, "non-negative integer"),
        ({"fetched": True, "rejected": 0}, "non-negative integer"),
        ({"fetched": 2**31, "rejected": 0}, "32-bit integer"),
        ({"fetched": 1, "rejected": 2}, "cannot exceed fetched"),
        ({"fetched": 1}, "supplied together"),
        (
            {
                "fetched": 1,
                "rejected": 1,
                "rejected_records": [
                    {
                        "external_id": "notice-1",
                        "source_url": "https://example.org/notices/1",
                        "reason": "Invalid record",
                        "payload": "must not be retained",
                    }
                ],
            },
            "exactly external_id, source_url and reason",
        ),
    ],
)
def test_failed_run_rejects_invalid_adapter_accounting(repo, detail, message):
    run_id = repo.begin_run("find_tender")

    with pytest.raises(ValueError, match=message):
        repo.finish_run(run_id, "failed", detail=detail)

    run = repo.list_runs("find_tender")[0]
    assert run["status"] == "running"
    assert run["fetched"] == 0
    assert run["rejected"] == 0


def test_relationships_and_entity_merge_are_durable(repo, now):
    document = ParsedDocument(
        external_id="relationship-1",
        source_url="https://example.org/relationship",
        title="Group relationship",
        published_at=now,
        payload={},
        entities=[
            EntityInput(
                key="GB-COH:01111111", name="Parent", scheme="GB-COH", identifier="01111111"
            ),
            EntityInput(
                key="GB-COH:02222222", name="Subsidiary", scheme="GB-COH", identifier="02222222"
            ),
        ],
        observations=[
            ObservationInput(
                subject_key="GB-COH:02222222",
                kind="group_change",
                event_key="group:1",
                headline="Changed group",
                detail="Evidence",
                occurred_at=now,
            )
        ],
        relationships=[
            RelationshipInput(
                from_key="GB-COH:02222222",
                to_key="GB-COH:01111111",
                role="subsidiary_of",
                evidence_pointer="page 1",
                valid_from=now,
            )
        ],
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[document]), now)
    parent = repo.list_entities(query="Parent")[0]
    subsidiary = repo.list_entities(query="Subsidiary")[0]

    decision = repo.record_review(
        "entity",
        subsidiary["id"],
        "merge",
        "Confirmed duplicate legal entity",
        "analyst",
        {"into_entity_id": parent["id"]},
    )

    assert decision["action"] == "merge"
    assert repo.list_observations()[0]["entity_id"] == parent["id"]
    relationship = repo.list_relationships(parent["id"])[0]
    assert relationship["from_entity_id"] == parent["id"]
    assert relationship["to_entity_id"] == parent["id"]
    retained = repo.get_entity(subsidiary["id"])
    assert retained["properties"]["merged_into_entity_id"] == parent["id"]
    assert (
        repo.list_reviews(target_type="entity", target_id=subsidiary["id"])[0]["id"]
        == decision["id"]
    )

    changed = document.model_copy(
        update={
            "payload": {"revision": 2},
            "observations": [
                document.observations[0].model_copy(update={"headline": "Later source evidence"})
            ],
        }
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[changed]), now + timedelta(days=1))
    assert repo.list_observations()[0]["entity_id"] == parent["id"]


def test_chained_merge_redirects_all_source_identities(repo, now):
    document = ParsedDocument(
        external_id="merge-chain",
        source_url="https://example.org/merge-chain",
        title="Merge candidates",
        published_at=now,
        payload={},
        entities=[
            EntityInput(
                key="GB-COH:01111111", name="First", scheme="GB-COH", identifier="01111111"
            ),
            EntityInput(
                key="GB-COH:02222222", name="Second", scheme="GB-COH", identifier="02222222"
            ),
            EntityInput(
                key="GB-COH:03333333", name="Canonical", scheme="GB-COH", identifier="03333333"
            ),
        ],
        observations=[
            ObservationInput(
                subject_key="GB-COH:01111111",
                kind="group_change",
                event_key="merge-chain:1",
                headline="Candidate evidence",
                detail="Evidence",
                occurred_at=now,
            )
        ],
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[document]), now)
    entities = {item["name"]: item for item in repo.list_entities()}

    repo.record_review(
        "entity",
        entities["First"]["id"],
        "merge",
        "First merge",
        "analyst",
        {"into_entity_id": entities["Second"]["id"]},
    )
    repo.record_review(
        "entity",
        entities["Second"]["id"],
        "merge",
        "Canonical merge",
        "analyst",
        {"into_entity_id": entities["Canonical"]["id"]},
    )

    first = repo.get_entity(entities["First"]["id"])
    second = repo.get_entity(entities["Second"]["id"])
    canonical = repo.get_entity(entities["Canonical"]["id"])
    assert first["properties"]["merged_into_entity_id"] == canonical["id"]
    assert second["properties"]["merged_into_entity_id"] == canonical["id"]
    assert {identity["key"] for identity in canonical["properties"]["source_identities"]} == {
        first["key"],
        second["key"],
    }
    assert repo.list_observations()[0]["entity_id"] == canonical["id"]
    with pytest.raises(ValueError, match="canonical entity"):
        repo.record_review("entity", first["id"], "accept", "Stale alias", "analyst")

    later = document.model_copy(
        update={
            "payload": {"source_version": 2},
            "observations": [
                document.observations[0].model_copy(update={"headline": "Later evidence"})
            ],
        }
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[later]), now + timedelta(days=1))
    assert repo.list_observations()[0]["entity_id"] == canonical["id"]


def test_review_actions_validate_targets_identity_and_event_decisions(repo, now):
    repo.ingest_batch("payment_practices", FetchBatch(documents=[payment_document(now)]), now)
    entity = repo.list_entities()[0]
    observation = repo.list_observations()[0]

    with pytest.raises(KeyError, match="Unknown entity"):
        repo.record_review("entity", "missing", "accept", "Invalid target", "analyst")
    with pytest.raises(ValueError, match="Unsupported review target"):
        repo.record_review("unknown", entity["id"], "accept", "Invalid type", "analyst")
    with pytest.raises(ValueError, match="Unsupported review action"):
        repo.record_review("observation", observation["id"], "publish", "Invalid", "analyst")
    with pytest.raises(ValueError, match="dedicated review action"):
        repo.record_review(
            "observation",
            observation["id"],
            "update",
            "Invalid independence metadata",
            "analyst",
            {"changes": {"attributes": {"independence_confirmed": True}}},
        )
    with pytest.raises(ValueError, match="identifier"):
        repo.record_review(
            "entity",
            entity["id"],
            "update",
            "Invalid identity",
            "analyst",
            {"changes": {"identifier": "09999999"}},
        )
    assert repo.list_reviews() == []

    accepted = repo.record_review(
        "observation", observation["id"], "accept", "Confirmed evidence", "analyst"
    )
    assert accepted["action"] == "verified"
    assert repo.list_observations()[0]["state"] == "verified"
    rejected = repo.record_review(
        "observation", observation["id"], "rejected", "Rejected evidence", "analyst"
    )
    pending = repo.record_review(
        "observation", observation["id"], "reset", "Return to queue", "analyst"
    )
    entity_verified = repo.record_review(
        "entity", entity["id"], "accept", "Exact identifier", "analyst"
    )
    assert rejected["action"] == "rejected"
    assert pending["action"] == "pending"
    assert entity_verified["action"] == "verified"
    assert repo.list_observations()[0]["state"] == "pending"

    grouped = repo.record_review(
        "observation",
        observation["id"],
        "group_event",
        "Same underlying event",
        "analyst",
        {"event_group_key": "payment-event:2026-06-30"},
    )
    independent = repo.record_review(
        "observation",
        observation["id"],
        "confirm_independence",
        "Independent factual basis",
        "analyst",
    )
    updated = repo.list_observations()[0]
    assert updated["attributes"]["event_group_key"] == "payment-event:2026-06-30"
    assert updated["attributes"]["event_group_review_reference"] == grouped["id"]
    assert updated["attributes"]["independence_confirmed"] is True
    assert updated["attributes"]["independence_review_reference"] == independent["id"]

    record = repo.list_records()[0]
    with pytest.raises(ValueError, match="Unsupported review action"):
        repo.record_review("source_record", record["id"], "restore", "Stale restoration", "analyst")
    withdrawn = repo.record_review(
        "source_record", record["id"], "withdraw", "Publisher withdrawal", "analyst"
    )
    assert withdrawn["action"] == "withdraw"
    assert repo.list_observations() == []
    with session_scope(repo.engine) as session:
        delete_operations = session.scalar(
            select(func.count()).select_from(Outbox).where(Outbox.operation == "delete")
        )
        assert delete_operations == 1


def test_unresolved_identity_cannot_be_verified_by_review(repo, now):
    document = ParsedDocument(
        external_id="unresolved-review",
        source_url="https://example.org/unresolved",
        title="Unresolved organisation",
        published_at=now,
        payload={},
        entities=[EntityInput(key="unresolved:reviewed_import:one", name="Example")],
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[document]), now)
    entity = repo.list_entities()[0]

    with pytest.raises(ValueError, match="Unresolved identities cannot be verified"):
        repo.record_review("entity", entity["id"], "accept", "Name alone", "analyst")
    with pytest.raises(ValueError, match="Unresolved identities cannot be verified"):
        repo.record_review(
            "entity",
            entity["id"],
            "update",
            "Name alone",
            "analyst",
            {"changes": {"verified": True}},
        )
    assert repo.list_reviews() == []


def test_cross_source_unresolved_reference_rejects_batch(repo, now):
    unresolved = ParsedDocument(
        external_id="unresolved-source",
        source_url="https://example.org/unresolved",
        title="Unresolved",
        published_at=now,
        payload={},
        entities=[EntityInput(key="unresolved:reviewed_import:one", name="Example")],
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[unresolved]), now)
    foreign_reference = ParsedDocument(
        external_id="foreign-reference",
        source_url="https://example.org/foreign",
        title="Foreign unresolved reference",
        published_at=now,
        payload={},
        observations=[
            ObservationInput(
                subject_key="unresolved:reviewed_import:one",
                kind="payment_report",
                event_key="foreign:1",
                headline="Must not cross sources",
                detail="Unresolved",
                occurred_at=now,
            )
        ],
    )

    with pytest.raises(ValueError, match="Cross-source unresolved reference"):
        repo.ingest_batch("payment_practices", FetchBatch(documents=[foreign_reference]), now)
    assert repo.get_source("payment_practices")["cursor"] is None


def test_cross_source_project_reference_requires_durable_resolution(repo, now):
    source_project = ParsedDocument(
        external_id="project-source",
        source_url="https://example.org/project-source",
        title="Source project",
        published_at=now,
        payload={},
        entities=[
            EntityInput(key="project:find_tender:ocid-1", kind="project", name="Project One")
        ],
    )
    repo.ingest_batch("find_tender", FetchBatch(documents=[source_project]), now)
    foreign_reference = ParsedDocument(
        external_id="project-reference",
        source_url="https://example.org/project-reference",
        title="Foreign project reference",
        published_at=now,
        payload={},
        observations=[
            ObservationInput(
                subject_key="project:find_tender:ocid-1",
                kind="timing_context",
                event_key="project:foreign:1",
                headline="Cross-source project",
                detail="Requires reviewed resolution",
                occurred_at=now,
            )
        ],
    )

    with pytest.raises(ValueError, match="Cross-source project reference"):
        repo.ingest_batch("contracts_finder", FetchBatch(documents=[foreign_reference]), now)

    canonical_project = source_project.model_copy(
        update={
            "external_id": "canonical-project",
            "entities": [
                EntityInput(
                    key="project:reviewed_import:canonical-1",
                    kind="project",
                    name="Canonical Project",
                )
            ],
        }
    )
    repo.ingest_batch("reviewed_import", FetchBatch(documents=[canonical_project]), now)
    projects = {entity["key"]: entity for entity in repo.list_entities(kind="project")}
    repo.record_review(
        "entity",
        projects["project:find_tender:ocid-1"]["id"],
        "merge",
        "Confirmed cross-process project",
        "analyst",
        {"into_entity_id": projects["project:reviewed_import:canonical-1"]["id"]},
    )

    repo.ingest_batch("contracts_finder", FetchBatch(documents=[foreign_reference]), now)
    assert (
        repo.list_observations()[0]["entity_id"]
        == projects["project:reviewed_import:canonical-1"]["id"]
    )


def test_signed_urls_and_fragments_are_removed_before_persistence(repo, now):
    document = payment_document(now).model_copy(
        update={
            "external_id": "https://example.org/source?id=1&sig=external-signature#token=value",
            "source_url": (
                "https://user:pass@example.org/report?safe=1&"
                "X-Amz-Credential=credential&X-Amz-Signature=signature#access_token=fragment"
            ),
            "payload": {
                "download": "https://blob.example.org/report?sv=1&sig=signed-value#token=value"
            },
            "raw_text": (
                "Download https://blob.example.org/report?X-Goog-Signature=signed#credential=value"
            ),
            "observations": [
                payment_document(now)
                .observations[0]
                .model_copy(
                    update={
                        "evidence_pointer": (
                            "https://evidence.example.org/item?GoogleAccessId=user&safe=1#secret=value"
                        )
                    }
                )
            ],
        }
    )
    repo.ingest_batch("payment_practices", FetchBatch(documents=[document]), now)

    observation = repo.list_observations()[0]
    record = repo.list_records()[0]
    assert observation["source_url"] == "https://example.org/report?safe=1"
    assert observation["evidence_pointer"] == "https://evidence.example.org/item?safe=1"
    assert record["payload"]["download"] == "https://blob.example.org/report?sv=1"
    assert record["raw_text"] == "Download https://blob.example.org/report"
    assert record["external_id"] == "https://example.org/source?id=1"


def test_safe_url_fragments_are_preserved_and_keep_external_ids_distinct(repo, now):
    first = payment_document(now).model_copy(
        update={
            "external_id": "https://example.org/report.pdf#page=41",
            "source_url": "https://example.org/report.pdf#page=42",
        }
    )
    second = first.model_copy(
        update={
            "external_id": "https://example.org/report.pdf#page=43",
            "payload": {"page": 43},
        }
    )

    repo.ingest_batch("payment_practices", FetchBatch(documents=[first, second]), now)

    records = repo.list_records()
    assert {record["external_id"] for record in records} == {
        "https://example.org/report.pdf#page=41",
        "https://example.org/report.pdf#page=43",
    }
    assert {record["source_url"] for record in records} == {
        "https://example.org/report.pdf#page=42"
    }


def test_concurrent_postgres_ingestion_serialises_source_revisions(now):
    config_path = os.environ.get("MERITUS_FOUNDATION_POSTGRES_CONFIG")
    if not config_path:
        pytest.skip("private PostgreSQL verification configuration not supplied")
    database_url = json.loads(Path(config_path).read_text())["url"]
    schema = f"meritus_foundation_{uuid4().hex}"
    admin_engine = create_engine_for_url(database_url)
    with admin_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    schema_url = make_url(database_url).update_query_dict({"options": f"-csearch_path={schema}"})
    postgres_engine = create_engine_for_url(schema_url.render_as_string(hide_password=False))
    try:
        initialise_database(postgres_engine)
        postgres_repo = Repository(postgres_engine)
        barrier = Barrier(2)

        def ingest(days):
            barrier.wait()
            return postgres_repo.ingest_batch(
                "payment_practices",
                FetchBatch(documents=[payment_document(now, days=days)], cursor=f"days-{days}"),
                now,
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(ingest, (75, 90)))

        records = postgres_repo.list_records()
        assert sorted(record["revision"] for record in records) == [1, 2]
        assert sum(record["active"] for record in records) == 1
        assert {result["inserted"] for result in results} == {0, 1}
        assert {result["updated"] for result in results} == {0, 1}
    finally:
        postgres_engine.dispose()
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


def test_workflow_dates_decisions_and_snapshot_payload_are_preserved(repo, now):
    repo.ingest_batch("payment_practices", FetchBatch(documents=[payment_document(now)]), now)
    entity = repo.list_entities()[0]
    source_record = repo.list_records()[0]
    calendar = repo.add_calendar_entry(
        {
            "entity_id": entity["id"],
            "kind": "retention_release",
            "title": "Retention release",
            "date": date(2027, 3, 31),
            "precision": "day",
            "source_url": source_record["source_url"],
            "source_record_id": source_record["id"],
            "evidence": {"page": 7},
            "status": "confirmed",
            "jurisdiction": "England and Wales",
            "basis": "Contract appendix",
            "reviewer": "WR",
        }
    )
    pipeline = repo.add_pipeline_action(
        {
            "entity_id": entity["id"],
            "stage": "shortlisted",
            "note": "Review at Monday meeting",
            "actor": "WR",
            "occurred_at": now,
        }
    )
    review = repo.record_review(
        "entity",
        entity["id"],
        "update",
        "Confirmed registered name",
        "WR",
        {"changes": {"name": "Example Holdings Ltd", "verified": True}},
    )
    payload = {
        "rankings": [{"entity_id": entity["id"], "score": 41}],
        "decision_ids": [review["id"]],
    }
    expected = deepcopy(payload)
    snapshot = repo.save_snapshot("weekly", now, "v1", payload)
    payload["rankings"][0]["score"] = 99

    assert repo.list_calendar_entries()[0]["date"] == "2027-03-31"
    assert repo.list_pipeline_actions()[0]["occurred_at"] == now.isoformat()
    assert repo.get_entity(entity["id"])["name"] == "Example Holdings Ltd"
    assert repo.list_reviews()[0]["reason"] == "Confirmed registered name"
    assert repo.get_snapshot(snapshot["id"])["payload"] == expected
    assert repo.list_snapshots("weekly")[0]["as_of"] == now.isoformat()
    assert calendar["entity_id"] == pipeline["entity_id"]


def test_relationship_reference_validation_is_atomic(repo, now):
    document = payment_document(now).model_copy(
        update={
            "relationships": [
                RelationshipInput(
                    from_key="GB-COH:08834019",
                    to_key="GB-COH:07777777",
                    role="connected_to",
                    evidence_pointer="paragraph 2",
                )
            ]
        }
    )

    with pytest.raises(ValueError, match="Unknown relationship target"):
        repo.ingest_batch("payment_practices", FetchBatch(documents=[document]), now)

    with session_scope(repo.engine) as session:
        assert session.scalar(select(func.count()).select_from(Entity)) == 0
        assert session.scalar(select(func.count()).select_from(Review)) == 0
