import json
from datetime import UTC, datetime

from sqlalchemy import select
from typer.testing import CliRunner

from meritus.cli import _enqueue_weekly, app
from meritus.config import Settings
from meritus.db import create_engine_for_url, initialise_database, session_scope
from meritus.demo import create_demo
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.jobs import schedule_due_jobs
from meritus.models import Job
from meritus.repository import Repository

runner = CliRunner()


def test_cli_exposes_operational_commands():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for command in (
        "init",
        "serve",
        "worker",
        "source-test",
        "run-source",
        "weekly",
        "backup",
        "restore",
        "reindex",
        "purge",
        "demo",
    ):
        assert command in result.stdout


def test_weekly_cli_and_scheduler_share_london_week_dedupe(repo):
    now = datetime(2026, 10, 25, 12, tzinfo=UTC)

    first = _enqueue_weekly(repo, now)
    second = _enqueue_weekly(repo, now)
    schedule_due_jobs(repo, now)

    with session_scope(repo.engine) as session:
        weekly_jobs = session.scalars(select(Job).where(Job.kind == "weekly")).all()
    assert first["id"] == second["id"] == weekly_jobs[0].id
    assert len(weekly_jobs) == 1
    assert weekly_jobs[0].dedupe_key == "weekly:2026-10-19"
    assert weekly_jobs[0].payload["scheduled_week"] == "2026-10-19"


def test_source_test_checks_policy_without_fetching(monkeypatch, tmp_path):
    database = tmp_path / "cli.db"
    monkeypatch.setenv("MERITUS_DATABASE_URL", f"sqlite:///{database}")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path / "data"))
    fetched = False

    def forbidden_fetch(*_args, **_kwargs):
        nonlocal fetched
        fetched = True
        raise AssertionError("source-test must not fetch")

    monkeypatch.setattr("meritus.sources.runner.run_source", forbidden_fetch)
    result = runner.invoke(app, ["source-test", "companies_house"])

    assert result.exit_code == 2
    assert "blocked" in result.stdout.lower()
    assert fetched is False


def test_run_source_dispatches_real_runner(monkeypatch, tmp_path):
    database = tmp_path / "cli.db"
    monkeypatch.setenv("MERITUS_DATABASE_URL", f"sqlite:///{database}")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path / "data"))
    calls = []

    def fake_run(repo, source_id):
        calls.append((repo, source_id))
        return {"source_id": source_id, "status": "success"}

    monkeypatch.setattr("meritus.cli.run_source", fake_run)
    result = runner.invoke(app, ["run-source", "find_tender"])

    assert result.exit_code == 0
    assert calls[0][1] == "find_tender"
    assert json.loads(result.stdout)["status"] == "success"


def test_demo_uses_separate_marked_database_and_refuses_overwrite(tmp_path):
    live_database = tmp_path / "live.db"
    live = Settings(
        database_url=f"sqlite:///{live_database}",
        data_dir=tmp_path / "live-data",
    )
    demo_database = tmp_path / "demo" / "demo.db"
    demo_data = tmp_path / "demo" / "data"

    settings = create_demo(
        live,
        database_url=f"sqlite:///{demo_database}",
        data_dir=demo_data,
    )

    assert settings.demo_mode is True
    assert settings.database_url != live.database_url
    marker = json.loads((demo_data / "demo-marker.json").read_text())
    assert marker["demo_mode"] is True
    assert len(Repository(create_engine_for_url(settings.database_url)).list_entities()) > 0
    second = create_demo(
        live,
        database_url=f"sqlite:///{demo_database}",
        data_dir=demo_data,
    )
    assert second.database_url == settings.database_url

    initialise_database(create_engine_for_url(f"sqlite:///{tmp_path / 'occupied.db'}"))
    occupied_repo = Repository(create_engine_for_url(f"sqlite:///{tmp_path / 'occupied.db'}"))
    occupied_repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="occupied",
                    source_url="https://example.invalid/occupied",
                    title="Occupied",
                    published_at=None,
                    payload={},
                    entities=[
                        EntityInput(
                            key="DEMO:OCCUPIED",
                            name="Occupied",
                            scheme="DEMO",
                            identifier="OCCUPIED",
                        )
                    ],
                )
            ]
        ),
        observed_at=datetime.now(UTC),
    )
    try:
        create_demo(
            live,
            database_url=f"sqlite:///{tmp_path / 'occupied.db'}",
            data_dir=tmp_path / "occupied-data",
        )
    except ValueError as error:
        assert "non-empty" in str(error)
    else:
        raise AssertionError("non-empty demo database was overwritten")


def test_demo_refuses_live_database(tmp_path):
    live = Settings(
        database_url=f"sqlite:///{tmp_path / 'live.db'}", data_dir=tmp_path / "live-data"
    )
    result = runner.invoke(
        app,
        [
            "demo",
            "--database-url",
            live.database_url,
            "--data-dir",
            str(tmp_path / "demo-data"),
            "--no-serve",
        ],
        env={"MERITUS_DATABASE_URL": live.database_url, "MERITUS_DATA_DIR": str(live.data_dir)},
    )
    assert result.exit_code == 1
    assert "live database" in result.stdout.lower()
