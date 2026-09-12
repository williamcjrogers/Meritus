"""Exercise expiry during restore using isolated PostgreSQL schemas and real OpenSearch.

Run with the private PostgreSQL test configuration path as the sole argument.
The dedicated OpenSearch instance must be on loopback port 19289. It must contain
no user data. All generated evidence is explicitly synthetic.
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import select, text

from meritus.backup import create_backup, restore_backup
from meritus.config import Settings
from meritus.db import create_engine_for_url, initialise_database, session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.models import SourceRecord
from meritus.repository import Repository
from meritus.retention import read_erasure_ledger
from meritus.search import SearchIndex


def main() -> None:
    config = json.loads(Path(sys.argv[1]).read_text())
    engine = create_engine_for_url(config["url"])
    assert engine.dialect.name == "postgresql"
    run_id = uuid4().hex
    schemas = [f"meritus_restore_{run_id}_{suffix}" for suffix in ("source", "target")]
    root = Path(__file__).resolve().parents[1] / "data/verification/restore-erasure" / run_id
    source_root, target_root = root / "source", root / "target"
    source_root.mkdir(parents=True)
    target_root.mkdir(parents=True)
    search_url = "http://127.0.0.1:19289"
    with httpx.Client(timeout=15) as client:
        health = client.get(f"{search_url}/_cluster/health")
        health.raise_for_status()
        assert health.json()["status"] in {"green", "yellow"}
    with engine.begin() as connection:
        for schema in schemas:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        repositories = []
        for schema in schemas:
            scoped = engine.execution_options(schema_translate_map={None: schema})
            initialise_database(scoped)
            repositories.append(Repository(scoped))
        source, target = repositories
        now = datetime.now(UTC)
        document = ParsedDocument(
            external_id=f"SYNTHETIC-ERASURE-{run_id}",
            source_url=f"https://example.invalid/synthetic-erasure/{run_id}",
            title="SYNTHETIC restore erasure acceptance evidence",
            published_at=now,
            expires_at=now + timedelta(minutes=1),
            payload={"synthetic_secret": run_id},
            raw_text=f"SYNTHETIC expiring passage {run_id}",
            entities=[
                EntityInput(
                    key=f"TEST:{run_id}",
                    name="SYNTHETIC restore acceptance company",
                    scheme="TEST",
                    identifier=run_id,
                    verified=True,
                )
            ],
            observations=[
                ObservationInput(
                    subject_key=f"TEST:{run_id}",
                    kind="accounts_overdue",
                    event_key=run_id,
                    headline="SYNTHETIC accounts status",
                    detail=f"SYNTHETIC expiring finding {run_id}",
                    occurred_at=now,
                    state="verified",
                )
            ],
        )
        source.ingest_batch("find_tender", FetchBatch(documents=[document]), now)
        record_id = source.list_records()[0]["id"]
        source_search = SearchIndex(Settings(data_dir=source_root, opensearch_url=search_url))
        try:
            before = source_search.reindex(source)
        finally:
            source_search.close()
        assert before["records_indexed"] == 1
        archive = source_root / "backups/acceptance.mvbackup"
        backup = create_backup(source, archive, managed_root=source_root, now=now)
        target_archive = target_root / "acceptance.mvbackup"
        shutil.copyfile(archive, target_archive)
        target_search = SearchIndex(Settings(data_dir=target_root, opensearch_url=search_url))
        try:
            restored = restore_backup(
                target_archive,
                target,
                managed_root=target_root,
                now=now + timedelta(minutes=2),
                search_index=target_search,
            )
        finally:
            target_search.close()
        with session_scope(target.engine) as session:
            record = session.scalar(select(SourceRecord).where(SourceRecord.id == record_id))
            assert record.payload["erasure"]["reason"] == "retention_expired"
            assert run_id not in json.dumps(record.payload)
            assert record.raw_text in {None, ""}
        assert record_id in read_erasure_ledger(target_root)["erasures"]
        assert restored["purge"]["records_erased"] == 1
        assert restored["search"]["reindex"]["records_indexed"] == 0
        assert restored["search"]["reindex"]["complete"] is True
        assert not target_archive.exists()
        with httpx.Client(timeout=15) as client:
            client.post(f"{search_url}/_refresh").raise_for_status()
            response = client.get(f"{search_url}/meritus-evidence/_count")
            response.raise_for_status()
            assert response.json()["count"] == 0
        report = {
            "run_id": run_id,
            "verified_at": datetime.now(UTC).isoformat(),
            "database": "PostgreSQL, isolated schemas",
            "search": "OpenSearch, dedicated loopback 19289",
            "clock": "Explicit restore cutoff two minutes after capture",
            "synthetic_evidence": True,
            "backup": backup,
            "restore": restored,
            "verified_search_count": 0,
            "erasure_marker_retained": True,
            "expired_archive_removed": True,
        }
        (root / "report.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    finally:
        with engine.begin() as connection:
            for schema in schemas:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


if __name__ == "__main__":
    main()
