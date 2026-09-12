import gzip
import hashlib
import json
import os
from contextlib import contextmanager
from datetime import UTC, timedelta

import pytest

from meritus.backup import create_backup, restore_backup
from meritus.db import create_engine_for_url, initialise_database, session_scope
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.models import Entity, SourceRecord
from meritus.repository import Repository
from meritus.retention import merge_erasure_ledger, read_erasure_ledger


class SearchProbe:
    def __init__(self, *, reindex_error=None, inspect=None):
        self.events = []
        self.reindex_error = reindex_error
        self.inspect = inspect

    @contextmanager
    def exclusive(self):
        self.events.append("locked")
        try:
            yield
        finally:
            self.events.append("unlocked")

    def invalidate(self):
        self.events.append("invalidated")
        return {"indices_removed": 2}

    def reindex(self, repo):
        self.events.append("reindexed")
        if self.inspect:
            self.inspect(repo)
        if self.reindex_error:
            raise self.reindex_error
        return {"records_indexed": len(repo.list_records()), "complete": True}


@pytest.fixture
def search_index():
    return SearchProbe()


def _seed_record(repo, now, *, external_id="demo-record", expires_at=None, payload=None):
    result = repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id=external_id,
                    source_url=f"https://example.invalid/{external_id}",
                    title="Fictional public works notice",
                    published_at=now,
                    expires_at=expires_at,
                    payload=payload or {"reference": external_id},
                    entities=[
                        EntityInput(
                            key=f"demo:{external_id}",
                            name="Fictional Northbridge Construction Ltd",
                            scheme="demo",
                            identifier=external_id,
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    assert result["inserted"] == 1
    with session_scope(repo.engine) as session:
        return session.query(SourceRecord).filter_by(external_id=external_id).one().id


def _rewrite_archive(path, mutate):
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        archive = json.load(stream)
    mutate(archive["payload"])
    serialised = json.dumps(
        archive["payload"], sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    archive["sha256"] = hashlib.sha256(serialised).hexdigest()
    with gzip.open(path, "wt", encoding="utf-8") as stream:
        json.dump(archive, stream, sort_keys=True, separators=(",", ":"))


def test_backup_is_private_versioned_and_registered(repo, tmp_path, now):
    record_id = _seed_record(repo, now)
    root = tmp_path / "managed"
    destination = root / "backups" / "daily.mvbackup"

    result = create_backup(repo, destination, managed_root=root, now=now)

    assert result["record_count"] == 1
    assert result["registered"] is True
    assert os.stat(destination).st_mode & 0o777 == 0o600
    with gzip.open(destination, "rt", encoding="utf-8") as stream:
        archive = json.load(stream)
    assert archive["payload"]["format"] == "meritus-private-backup"
    assert archive["payload"]["version"] == 1
    assert "artifacts" not in archive["payload"]["erasure_ledger"]
    state = json.loads((root / ".retention-state.json").read_text())
    assert state["artifacts"]["backups/daily.mvbackup"]["record_ids"] == [record_id]
    with pytest.raises(ValueError, match="overwrite"):
        create_backup(repo, destination, managed_root=root, now=now)


def test_restore_preserves_ids_and_times_in_empty_seeded_database(
    repo, tmp_path, now, search_index
):
    record_id = _seed_record(repo, now, payload={"$datetime": "literal source value"})
    source_entity = repo.list_entities()[0]
    source_updated_at = source_entity["updated_at"]
    source_root = tmp_path / "source"
    archive = source_root / "backups" / "portable.mvbackup"
    create_backup(repo, archive, managed_root=source_root, now=now)

    target_engine = create_engine_for_url(f"sqlite:///{tmp_path / 'restored.db'}")
    initialise_database(target_engine)
    target_repo = Repository(target_engine)
    target_root = tmp_path / "target"
    target_root.mkdir()
    local_archive = target_root / archive.name
    local_archive.write_bytes(archive.read_bytes())
    local_archive.chmod(0o644)
    assert os.stat(local_archive).st_mode & 0o777 == 0o644
    result = restore_backup(
        local_archive,
        target_repo,
        managed_root=target_root,
        now=now,
        search_index=search_index,
    )

    assert result["record_count"] == 1
    with session_scope(target_engine) as session:
        restored_record = session.get(SourceRecord, record_id)
        restored_entity = session.get(Entity, source_entity["id"])
        assert restored_record is not None
        assert restored_record.payload == {"$datetime": "literal source value"}
        assert restored_entity is not None
        restored_time = restored_entity.updated_at
        if restored_time.tzinfo is None:
            restored_time = restored_time.replace(tzinfo=UTC)
        assert restored_time.isoformat() == source_updated_at
    assert os.stat(local_archive).st_mode & 0o777 == 0o600
    state = json.loads((target_root / ".retention-state.json").read_text())
    assert state["artifacts"][local_archive.name]["record_ids"] == [record_id]
    assert search_index.events == ["locked", "invalidated", "reindexed", "unlocked"]


def test_restore_accepts_version_one_archive_before_alert_lineage_tables(
    repo, tmp_path, now, search_index
):
    record_id = _seed_record(repo, now)
    source_root = tmp_path / "source"
    archive = source_root / "pre-alert-lineage.mvbackup"
    create_backup(repo, archive, managed_root=source_root, now=now)
    _rewrite_archive(
        archive,
        lambda payload: [
            payload["database"]["tables"].pop(name)
            for name in ("alert_generation", "alert_lineage", "alert_score_state")
        ],
    )

    target_root = tmp_path / "target"
    target_root.mkdir()
    target_archive = target_root / archive.name
    target_archive.write_bytes(archive.read_bytes())
    target_engine = create_engine_for_url(f"sqlite:///{tmp_path / 'target.db'}")
    initialise_database(target_engine)

    result = restore_backup(
        target_archive,
        Repository(target_engine),
        managed_root=target_root,
        now=now,
        search_index=search_index,
    )

    assert result["record_count"] == 1
    with session_scope(target_engine) as session:
        assert session.get(SourceRecord, record_id) is not None


def test_restore_rejects_external_archive_and_traversal_member(repo, tmp_path, now):
    _seed_record(repo, now)
    source_root = tmp_path / "source"
    archive = source_root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=source_root, now=now)
    target_repo = Repository(create_engine_for_url(f"sqlite:///{tmp_path / 'target.db'}"))
    initialise_database(target_repo.engine)

    with pytest.raises(ValueError, match="inside the managed data directory"):
        restore_backup(archive, target_repo, managed_root=tmp_path / "target", now=now)

    target_root = tmp_path / "target"
    target_root.mkdir(exist_ok=True)
    internal = target_root / "malicious.mvbackup"
    internal.write_bytes(archive.read_bytes())
    _rewrite_archive(internal, lambda payload: payload.update(files=[{"path": "../outside"}]))
    with pytest.raises(ValueError, match="unsafe archive member"):
        restore_backup(internal, target_repo, managed_root=target_root, now=now)


def test_restore_requires_explicit_replace_and_confirmation(repo, tmp_path, now, search_index):
    _seed_record(repo, now)
    root = tmp_path / "managed"
    archive = root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=root, now=now)

    target_engine = create_engine_for_url(f"sqlite:///{tmp_path / 'target.db'}")
    initialise_database(target_engine)
    target_repo = Repository(target_engine)
    _seed_record(target_repo, now, external_id="existing")
    with pytest.raises(ValueError, match="not empty"):
        restore_backup(archive, target_repo, managed_root=root, now=now)
    with pytest.raises(ValueError, match="confirmation"):
        restore_backup(archive, target_repo, managed_root=root, now=now, replace=True)

    result = restore_backup(
        archive,
        target_repo,
        managed_root=root,
        now=now,
        replace=True,
        confirmation="REPLACE",
        search_index=search_index,
    )
    assert result["record_count"] == 1
    assert [item["name"] for item in target_repo.list_entities()] == [
        "Fictional Northbridge Construction Ltd"
    ]


def test_restore_merges_local_erasure_history_and_purges_before_return(
    repo, tmp_path, now, search_index
):
    expired_id = _seed_record(repo, now, expires_at=now + timedelta(hours=1))
    source_root = tmp_path / "source"
    source_marker = {
        "at": now.isoformat(),
        "reason": "source deletion",
        "lineage_key": "source:record",
        "observation_ids": [],
        "relationship_ids": [],
        "entity_ids": [],
        "review_ids": [],
    }
    merge_erasure_ledger({"version": 1, "erasures": {"source-record": source_marker}}, source_root)
    archive = source_root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=source_root, now=now)

    target_root = tmp_path / "target"
    target_root.mkdir()
    internal = target_root / "backup.mvbackup"
    internal.write_bytes(archive.read_bytes())
    local_marker = {
        "at": now.isoformat(),
        "reason": "local deletion",
        "lineage_key": "local:record",
        "observation_ids": [],
        "relationship_ids": [],
        "entity_ids": [],
        "review_ids": [],
    }
    merge_erasure_ledger({"version": 1, "erasures": {"local-record": local_marker}}, target_root)
    target_engine = create_engine_for_url(f"sqlite:///{tmp_path / 'target.db'}")
    initialise_database(target_engine)
    target_repo = Repository(target_engine)

    result = restore_backup(
        internal,
        target_repo,
        managed_root=target_root,
        now=now + timedelta(hours=2),
        search_index=search_index,
    )

    assert result["purge"]["records_erased"] == 1
    with session_scope(target_engine) as session:
        assert session.get(SourceRecord, expired_id).payload["erasure"]["reason"] == (
            "retention_expired"
        )
    ledger = read_erasure_ledger(target_root)["erasures"]
    assert {"local-record", "source-record", expired_id} <= set(ledger)
    assert not internal.exists()


def test_restore_rolls_back_database_when_retention_fails(
    repo, tmp_path, now, monkeypatch, search_index
):
    _seed_record(repo, now, external_id="archive-record")
    root = tmp_path / "managed"
    archive = root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=root, now=now)
    _seed_record(repo, now, external_id="target-only")

    def fail_purge(*_args, **_kwargs):
        raise RuntimeError("synthetic purge failure")

    monkeypatch.setattr("meritus.backup.purge_expired", fail_purge)
    with pytest.raises(RuntimeError, match="synthetic purge failure"):
        restore_backup(
            archive,
            repo,
            managed_root=root,
            now=now,
            replace=True,
            confirmation="REPLACE",
            search_index=search_index,
        )

    assert {item["external_id"] for item in repo.list_records()} == {
        "archive-record",
        "target-only",
    }
    assert search_index.events == ["locked", "invalidated", "unlocked"]


def test_restore_reindexes_only_after_expired_rows_are_sanitised(repo, tmp_path, now):
    expired_id = _seed_record(repo, now, expires_at=now + timedelta(hours=1))
    root = tmp_path / "managed"
    archive = root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=root, now=now)

    def inspect(restored_repo):
        with session_scope(restored_repo.engine) as session:
            record = session.get(SourceRecord, expired_id)
            assert record.raw_text is None
            assert record.payload["erasure"]["reason"] == "retention_expired"

    search = SearchProbe(inspect=inspect)
    restore_backup(
        archive,
        repo,
        managed_root=root,
        now=now + timedelta(hours=2),
        replace=True,
        confirmation="REPLACE",
        search_index=search,
    )
    assert search.events == ["locked", "invalidated", "reindexed", "unlocked"]


def test_restore_search_failure_reports_incomplete_after_sanitised_commit(repo, tmp_path, now):
    _seed_record(repo, now, external_id="archive-record")
    root = tmp_path / "managed"
    archive = root / "backup.mvbackup"
    create_backup(repo, archive, managed_root=root, now=now)
    _seed_record(repo, now, external_id="target-only")
    search = SearchProbe(reindex_error=RuntimeError("synthetic search failure"))

    with pytest.raises(RuntimeError, match="search rebuild is incomplete"):
        restore_backup(
            archive,
            repo,
            managed_root=root,
            now=now,
            replace=True,
            confirmation="REPLACE",
            search_index=search,
        )

    assert [item["external_id"] for item in repo.list_records()] == ["archive-record"]
    assert search.events == ["locked", "invalidated", "reindexed", "unlocked"]
