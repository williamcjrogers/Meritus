"""Meritus local operations command line."""

from __future__ import annotations

import json
from datetime import UTC, datetime, time, timedelta
from pathlib import Path
from typing import Annotated
from zoneinfo import ZoneInfo

import typer
import uvicorn

from meritus.api import create_app
from meritus.backup import REPLACE_CONFIRMATION, create_backup, restore_backup
from meritus.config import Settings, mask_secrets
from meritus.db import create_engine_for_url, initialise_database
from meritus.demo import create_demo
from meritus.jobs import enqueue_job
from meritus.repository import Repository
from meritus.retention import purge_expired
from meritus.search import SearchIndex
from meritus.sources.registry import get_adapter
from meritus.sources.runner import check_access, run_source
from meritus.worker import run_worker

app = typer.Typer(
    name="meritus",
    no_args_is_help=True,
    help="Operate the private Meritus analyst desk.",
)


def _runtime(settings: Settings | None = None) -> tuple[Settings, Repository]:
    settings = settings or Settings()
    engine = create_engine_for_url(settings.database_url)
    initialise_database(engine)
    return settings, Repository(engine)


def _emit(value) -> None:
    typer.echo(json.dumps(mask_secrets(value), sort_keys=True, default=str))


def _fail(error: Exception, *, code: int = 1) -> None:
    typer.echo(f"Error: {mask_secrets(str(error))}")
    raise typer.Exit(code)


def _enqueue_weekly(repo, now: datetime | None = None):
    current = now or datetime.now(UTC)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Weekly scheduling time must include a UTC offset")
    local = current.astimezone(ZoneInfo("Europe/London"))
    monday = local.date() - timedelta(days=local.weekday())
    scheduled_for = datetime.combine(monday, time(7), local.tzinfo)
    if scheduled_for > local:
        monday -= timedelta(days=7)
        scheduled_for = datetime.combine(monday, time(7), local.tzinfo)
    return enqueue_job(
        repo,
        "weekly",
        payload={"scheduled_week": str(monday)},
        dedupe_key=f"weekly:{monday}",
        scheduled_for=scheduled_for,
    )


@app.command("init")
def initialise() -> None:
    """Create the database schema and reviewed source catalogue."""
    try:
        settings, _repo = _runtime()
        _emit({"status": "initialised", "database": settings.database_url})
    except Exception as error:
        _fail(error)


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="Listening address.")] = "0.0.0.0",
    port: Annotated[int, typer.Option(min=1, max=65535, help="Listening port.")] = 8088,
) -> None:
    """Serve the authenticated API and installed analyst desk."""
    try:
        settings, repo = _runtime()
        uvicorn.run(create_app(settings=settings, repository=repo), host=host, port=port)
    except Exception as error:
        _fail(error)


@app.command("worker")
def worker_command() -> None:
    """Run the durable background worker."""
    try:
        _settings, repo = _runtime()
        run_worker(repo)
    except KeyboardInterrupt:
        return
    except Exception as error:
        _fail(error)


@app.command("source-test")
def source_test(source_id: str) -> None:
    """Check configured access and adapter availability without fetching."""
    try:
        settings, repo = _runtime()
        source = repo.get_source(source_id)
        get_adapter(source_id)
        check_access(source, settings, datetime.now(UTC))
        _emit({"source_id": source_id, "status": "available", "network_request": False})
    except Exception as error:
        _emit(
            {
                "source_id": source_id,
                "status": "blocked",
                "network_request": False,
                "reason": mask_secrets(str(error)),
            }
        )
        raise typer.Exit(2) from None


@app.command("run-source")
def run_source_command(source_id: str) -> None:
    """Run a configured source against its real adapter."""
    try:
        _settings, repo = _runtime()
        result = run_source(repo, source_id)
        _emit(result)
        if result.get("status") not in {"success", "partial"}:
            raise typer.Exit(2)
    except typer.Exit:
        raise
    except Exception as error:
        _fail(error)


@app.command()
def weekly() -> None:
    """Queue the weekly scoring and evidence snapshot workflow."""
    try:
        _settings, repo = _runtime()
        _emit(_enqueue_weekly(repo))
    except Exception as error:
        _fail(error)


@app.command("backup")
def backup_command(
    destination: Annotated[
        Path | None,
        typer.Option(help="Archive path inside the managed data directory."),
    ] = None,
) -> None:
    """Create a private, retention-managed portable backup."""
    try:
        settings, repo = _runtime()
        destination = destination or (
            settings.data_dir
            / "backups"
            / f"meritus-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.mvbackup"
        )
        _emit(create_backup(repo, destination, managed_root=settings.data_dir))
    except Exception as error:
        _fail(error)


@app.command("restore")
def restore_command(
    archive: Annotated[Path, typer.Argument(help="Archive inside the managed data directory.")],
    replace: Annotated[
        bool, typer.Option("--replace", help="Replace an existing non-empty database.")
    ] = False,
    confirm_replace: Annotated[
        str | None,
        typer.Option(
            "--confirm-replace",
            help=f'Type "{REPLACE_CONFIRMATION}" when using --replace.',
        ),
    ] = None,
) -> None:
    """Restore an archive and enforce retention before returning."""
    try:
        settings, repo = _runtime()
        _emit(
            restore_backup(
                archive,
                repo,
                managed_root=settings.data_dir,
                replace=replace,
                confirmation=confirm_replace,
            )
        )
    except Exception as error:
        _fail(error)


@app.command()
def reindex() -> None:
    """Build fresh OpenSearch indices and swap their aliases."""
    search = None
    try:
        settings, repo = _runtime()
        search = SearchIndex(settings)
        _emit(search.reindex(repo))
    except Exception as error:
        _fail(error)
    finally:
        if search is not None:
            search.close()


@app.command()
def purge() -> None:
    """Apply source expiry and durable erasure rules now."""
    try:
        settings, repo = _runtime()
        _emit(purge_expired(repo, datetime.now(UTC), settings.data_dir))
    except Exception as error:
        _fail(error)


@app.command("demo")
def demo_command(
    database_url: Annotated[
        str | None, typer.Option(help="Dedicated file-backed SQLite URL.")
    ] = None,
    data_dir: Annotated[Path | None, typer.Option(help="Dedicated demo data directory.")] = None,
    serve_demo: Annotated[
        bool, typer.Option("--serve/--no-serve", help="Serve the demo after creating it.")
    ] = True,
    host: Annotated[str, typer.Option(help="Listening address.")] = "127.0.0.1",
    port: Annotated[int, typer.Option(min=1, max=65535, help="Listening port.")] = 8088,
) -> None:
    """Create and optionally serve an isolated fictional demonstration."""
    try:
        live = Settings()
        data_dir = data_dir or (Path(live.data_dir).absolute().parent / "meritus-demo-data")
        database_url = database_url or f"sqlite:///{data_dir / 'meritus-demo.db'}"
        settings = create_demo(live, database_url=database_url, data_dir=data_dir)
        _emit(
            {
                "status": "demo_ready",
                "demo_mode": True,
                "database": settings.database_url,
                "data_dir": str(settings.data_dir),
            }
        )
        if serve_demo:
            _settings, repo = _runtime(settings)
            uvicorn.run(create_app(settings=settings, repository=repo), host=host, port=port)
    except Exception as error:
        _fail(error)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
