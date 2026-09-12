from datetime import timedelta

import pytest
from sqlalchemy import select

from meritus.access import record_access_clause
from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.service import IntelligenceService
from meritus.models import Entity, SourceRecord
from meritus.retention import purge_expired, register_managed_artifact


def _grant(repo, now, *, source_id="find_case_law", current_version_only=True):
    repo.update_source(
        source_id,
        {
            "permissions": {
                "reference": "Synthetic current-version licence",
                "scope": "Synthetic regression evidence",
                "reviewed_at": (now - timedelta(days=1)).isoformat(),
                "expires_at": (now + timedelta(days=365 * 5)).isoformat(),
                "operations": ["retrieve", "analyse", "export"],
                "current_version_only": current_version_only,
            }
        },
    )


def _document(now, text, *, withdrawn=False):
    return ParsedDocument(
        external_id="ewhc/tcc/2026/synthetic",
        source_url="https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/synthetic",
        title=text,
        published_at=now - timedelta(days=1),
        raw_text=text,
        payload={"quote": text},
        withdrawn=withdrawn,
        entities=[
            EntityInput(
                key="UK-JUDGMENT:ewhc/tcc/2026/synthetic",
                name=text,
                scheme="UK-JUDGMENT",
                identifier="ewhc/tcc/2026/synthetic",
                kind="proceeding",
                verified=True,
                properties={"judgment_summary": text},
            )
        ],
        observations=[
            ObservationInput(
                subject_key="UK-JUDGMENT:ewhc/tcc/2026/synthetic",
                kind="construction_decision",
                event_key="synthetic-decision",
                headline=text,
                detail=text,
                evidence_pointer="paragraph:1",
                state="pending",
            )
        ],
    )


def _ingest(repo, now, document, *, source_id="find_case_law"):
    return repo.ingest_batch(source_id, FetchBatch(documents=[document]), now)


@pytest.mark.parametrize(
    ("source_id", "current_version_only", "expected_count"),
    [
        ("find_case_law", True, 1),
        ("find_case_law", False, 2),
        ("find_case_law", "true", 2),
        ("find_case_law", "not-a-boolean", 2),
        ("find_tender", True, 2),
    ],
)
def test_historical_reads_apply_only_the_fcl_current_version_policy(
    repo, now, source_id, current_version_only, expected_count
):
    _grant(repo, now, source_id=source_id, current_version_only=current_version_only)
    _ingest(repo, now, _document(now, "OLD JUDGMENT"), source_id=source_id)
    _ingest(
        repo,
        now + timedelta(minutes=1),
        _document(now, "CURRENT JUDGMENT"),
        source_id=source_id,
    )

    with session_scope(repo.engine) as database:
        retained = database.scalars(
            select(SourceRecord).where(record_access_clause(database, now=now, active_only=False))
        ).all()
        assert len(retained) == expected_count
        if current_version_only is True and source_id == "find_case_law":
            assert retained[0].raw_text == "CURRENT JUDGMENT"
        # Immediate denial must work before the physical retention worker runs.
        assert (
            database.scalar(select(SourceRecord.raw_text).where(SourceRecord.revision == 1))
            == "OLD JUDGMENT"
        )


@pytest.mark.parametrize("withdrawn", [False, True])
def test_fcl_supersession_or_withdrawal_erases_content_from_all_managed_stores(
    repo, now, tmp_path, withdrawn
):
    _grant(repo, now)
    original = _document(now, "OLD JUDGMENT QUOTATION")
    _ingest(repo, now, original)
    record = repo.list_records()[0]
    snapshot = repo.save_snapshot(
        "weekly",
        now,
        "meritus-v1",
        {
            "items": [
                {
                    "name": original.title,
                    "contributions": [{"record_id": record["id"]}],
                }
            ],
            "source_records": [record],
            "observations": record["observations"],
        },
    )
    for kind in ("raw", "backup", "export"):
        path = tmp_path / f"{kind}.txt"
        path.write_text(original.raw_text)
        register_managed_artifact(path, [record["id"]], kind, managed_root=tmp_path)
    replacement = _document(now, "CURRENT JUDGMENT", withdrawn=withdrawn)
    _ingest(repo, now + timedelta(minutes=1), replacement)

    result = purge_expired(repo, now + timedelta(minutes=2), tmp_path)

    assert result["records_erased"] == (2 if withdrawn else 1)
    assert result["artifacts_removed"] == 3
    assert result["snapshots_redacted"] == 1
    assert "OLD JUDGMENT" not in str(repo.get_snapshot(snapshot["id"]))
    assert "OLD JUDGMENT" not in str(repo.list_records())
    assert "OLD JUDGMENT" not in str(repo.list_entities())
    assert not any((tmp_path / f"{kind}.txt").exists() for kind in ("raw", "backup", "export"))
    with session_scope(repo.engine) as database:
        old = database.get(SourceRecord, record["id"])
        assert old.payload["erasure"]["reason"] == "publisher_superseded"
        assert old.raw_text is None
        assert old.observations == []
        current = database.scalar(select(SourceRecord).where(SourceRecord.revision == 2))
        if withdrawn:
            assert current.raw_text is None
            assert current.payload["erasure"]["reason"] == "publisher_withdrawn"
        else:
            assert current.raw_text == "CURRENT JUDGMENT"
            assert current.active is True
    # Replaying an erased judgment must not restore its body or canonical name/summary.
    replay = _ingest(repo, now + timedelta(minutes=3), original)
    assert replay["replayed"] == 1
    assert "OLD JUDGMENT" not in str(repo.list_entities())
    assert "OLD JUDGMENT" not in str(repo.list_records())
    assert purge_expired(repo, now + timedelta(minutes=4), tmp_path)["records_erased"] == 0


def test_other_sources_keep_permitted_history_and_current_fcl_has_no_arbitrary_expiry(
    repo, now, tmp_path
):
    _grant(repo, now)
    _grant(repo, now, source_id="find_tender")
    for source_id in ("find_case_law", "find_tender"):
        _ingest(repo, now, _document(now, "OLD JUDGMENT"), source_id=source_id)
        _ingest(
            repo,
            now + timedelta(minutes=1),
            _document(now, "CURRENT JUDGMENT"),
            source_id=source_id,
        )
    result = purge_expired(repo, now + timedelta(days=365), tmp_path)
    assert result["records_erased"] == 1
    with session_scope(repo.engine) as database:
        other_old = database.scalar(
            select(SourceRecord).where(
                SourceRecord.source_id == "find_tender", SourceRecord.revision == 1
            )
        )
        assert other_old.raw_text == "OLD JUDGMENT"
        current_fcl = database.scalar(
            select(SourceRecord).where(
                SourceRecord.source_id == "find_case_law", SourceRecord.revision == 2
            )
        )
        assert current_fcl.raw_text == "CURRENT JUDGMENT"
        assert current_fcl.active is True
        assert database.scalar(select(Entity)).name == "CURRENT JUDGMENT"


@pytest.mark.parametrize("withdrawn", [False, True])
def test_current_version_read_boundary_covers_frozen_api_exports_before_purge(
    repo, now, authenticated, monkeypatch, withdrawn
):
    client, _csrf = authenticated
    _grant(repo, now)
    _ingest(repo, now, _document(now, "OLD JUDGMENT QUOTATION"))
    snapshot = IntelligenceService(repo).create_snapshot("weekly", now)
    assert "OLD JUDGMENT QUOTATION" in str(snapshot["payload"])
    entity_id = repo.list_entities()[0]["id"]
    # Prove that immediate export filtering works independently of erasure.
    monkeypatch.setattr("meritus.api.intelligence.purge_expired", lambda *_args: None)
    before = client.get(f"/api/exports/{snapshot['id']}.csv")
    assert before.status_code == 200
    assert "OLD JUDGMENT QUOTATION" in before.text
    _ingest(
        repo,
        now + timedelta(minutes=1),
        _document(now, "CURRENT JUDGMENT", withdrawn=withdrawn),
    )

    for path in (
        "/api/evidence",
        "/api/entities",
        f"/api/exports/{snapshot['id']}.csv",
        f"/api/exports/{snapshot['id']}.html",
    ):
        response = client.get(path)
        assert response.status_code == 200, response.text
        assert "OLD JUDGMENT QUOTATION" not in response.text, path
    detail = client.get(f"/api/entities/{entity_id}")
    assert detail.status_code == (404 if withdrawn else 200)
    assert "OLD JUDGMENT QUOTATION" not in detail.text
    with session_scope(repo.engine) as database:
        assert (
            database.scalar(select(SourceRecord.raw_text).where(SourceRecord.revision == 1))
            == "OLD JUDGMENT QUOTATION"
        )
