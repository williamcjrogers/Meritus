"""Explicit, isolated fictional demonstration data."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote

from sqlalchemy import func, select
from sqlalchemy.engine import make_url

from meritus.config import Settings
from meritus.db import create_engine_for_url, initialise_database
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.models import SourceRecord
from meritus.repository import Repository

DEMO_MARKER = "demo-marker.json"


def _sqlite_path(database_url: str) -> Path:
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ValueError("Demo mode requires a dedicated file-backed SQLite database")
    return Path(unquote(url.database)).absolute().resolve()


def _write_marker(path: Path, content: dict) -> None:
    descriptor = os.open(
        path,
        os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(content, stream, sort_keys=True)
        stream.flush()
        os.fsync(stream.fileno())


def _marker_content(database: Path) -> dict:
    return {
        "format": "meritus-demo",
        "version": 1,
        "demo_mode": True,
        "database_path_sha256": hashlib.sha256(str(database).encode()).hexdigest(),
    }


def _valid_existing_demo(marker: Path, database: Path) -> bool:
    if not marker.is_file() or marker.is_symlink() or not database.is_file():
        return False
    try:
        return json.loads(marker.read_text()) == _marker_content(database)
    except (OSError, json.JSONDecodeError):
        return False


def _seed(repo: Repository) -> None:
    observed = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="demo-northbridge-framework",
                    source_url="https://example.invalid/meritus-demo/northbridge",
                    title="Fictional Northbridge civic works framework",
                    published_at=observed - timedelta(days=10),
                    payload={
                        "demo": True,
                        "notice_type": "fictional award",
                        "value_gbp": 12_400_000,
                    },
                    entities=[
                        EntityInput(
                            key="DEMO:ORG:NORTHBRIDGE",
                            name="Northbridge Civic Construction Ltd (Fictional)",
                            scheme="DEMO",
                            identifier="ORG:NORTHBRIDGE",
                            verified=True,
                            properties={"demo": True},
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="DEMO:ORG:NORTHBRIDGE",
                            kind="contract_award",
                            event_key="demo-award-001",
                            headline="Fictional civic works framework awarded",
                            detail=(
                                "Demonstration evidence only. No real organisation is represented."
                            ),
                            occurred_at=observed - timedelta(days=10),
                            state="verified",
                            evidence_pointer="demo:notice:001",
                            value=12_400_000,
                            unit="GBP",
                            attributes={"demo": True},
                        )
                    ],
                ),
                ParsedDocument(
                    external_id="demo-redmere-payment",
                    source_url="https://example.invalid/meritus-demo/redmere",
                    title="Fictional Redmere payment-practice filing",
                    published_at=observed - timedelta(days=3),
                    payload={"demo": True, "average_days_to_pay": 54},
                    entities=[
                        EntityInput(
                            key="DEMO:ORG:REDMERE",
                            name="Redmere Building Group plc (Fictional)",
                            scheme="DEMO",
                            identifier="ORG:REDMERE",
                            verified=True,
                            properties={"demo": True},
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="DEMO:ORG:REDMERE",
                            kind="payment_practice",
                            event_key="demo-payment-001",
                            headline="Fictional average payment period reported",
                            detail="Demonstration evidence only. The figures are invented.",
                            occurred_at=observed - timedelta(days=3),
                            state="verified",
                            evidence_pointer="demo:payment:001",
                            value=54,
                            unit="days",
                            attributes={"demo": True},
                        )
                    ],
                ),
            ]
        ),
        observed_at=observed,
    )


def create_demo(
    live_settings: Settings,
    *,
    database_url: str,
    data_dir: str | Path,
) -> Settings:
    """Create or reopen an explicitly marked, isolated fictional demo database."""
    database = _sqlite_path(database_url)
    demo_root = Path(data_dir).absolute().resolve()
    live_database = (
        _sqlite_path(live_settings.database_url)
        if live_settings.database_url.startswith("sqlite")
        else None
    )
    if live_database is not None and database == live_database:
        raise ValueError("Demo mode refuses to use the configured live database")
    if demo_root == Path(live_settings.data_dir).absolute().resolve():
        raise ValueError("Demo mode refuses to use the configured live data directory")
    marker = demo_root / DEMO_MARKER
    if _valid_existing_demo(marker, database):
        settings = live_settings.model_copy(
            update={"database_url": database_url, "data_dir": demo_root, "demo_mode": True}
        )
        engine = create_engine_for_url(settings.database_url)
        try:
            with engine.connect() as connection:
                count = connection.scalar(select(func.count()).select_from(SourceRecord)) or 0
            if count == 0:
                raise ValueError("The marked demo database contains no demonstration records")
        finally:
            engine.dispose()
        return settings
    if marker.exists():
        raise ValueError("The demo marker is invalid; refusing to overwrite existing state")
    if database.exists() and database.stat().st_size:
        raise ValueError("Demo mode refuses to overwrite a non-empty database")

    database.parent.mkdir(parents=True, exist_ok=True)
    demo_root.mkdir(parents=True, exist_ok=True)
    settings = live_settings.model_copy(
        update={"database_url": database_url, "data_dir": demo_root, "demo_mode": True}
    )
    engine = create_engine_for_url(settings.database_url)
    try:
        initialise_database(engine)
        _seed(Repository(engine))
        _write_marker(marker, _marker_content(database))
    except Exception:
        engine.dispose()
        if database.exists() and not marker.exists():
            database.unlink()
        raise
    engine.dispose()
    return settings


__all__ = ["DEMO_MARKER", "create_demo"]
