"""Verify the final local release without writing to the live evidence database.

The live checks are read-only. The interruption check creates a short-lived,
isolated PostgreSQL database and runs the final worker image against synthetic
evidence in that database. It never indexes the synthetic evidence into the live
OpenSearch indices.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.engine import make_url

from meritus.alerts import generate_scoring_alerts
from meritus.config import Settings
from meritus.db import create_engine_for_url, initialise_database, session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.rules import RULE_VERSION
from meritus.intelligence.service import IntelligenceService
from meritus.jobs import enqueue_job
from meritus.models import (
    Alert,
    AlertGeneration,
    AlertLineage,
    Entity,
    Job,
    Operator,
    Outbox,
    Snapshot,
    Source,
    SourceRecord,
    StreamCheckpoint,
)
from meritus.repository import Repository
from meritus.worker import execute_job, run_worker_once

_DATABASE_NAME = re.compile(r"^meritus_runtime_[a-f0-9]{24}$")
_SAFE_BASE_URLS = {"http://127.0.0.1:8088", "http://localhost:8088"}


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


def _write_json(value: dict[str, Any]) -> None:
    print(json.dumps(value, sort_keys=True, default=_json_default), flush=True)


def _runtime_engine(database_name: str | None = None):
    settings = Settings()
    url = make_url(settings.database_url)
    if database_name is not None:
        if not _DATABASE_NAME.fullmatch(database_name):
            raise ValueError("Invalid isolated database name")
        url = url.set(database=database_name)
    return create_engine_for_url(url.render_as_string(hide_password=False))


def _database_counts(engine) -> dict[str, Any]:
    with session_scope(engine) as session:
        sources = [
            {
                "id": source.id,
                "enabled": source.enabled,
                "status": source.status,
                "last_attempt_at": source.last_attempt_at,
                "last_success_at": source.last_success_at,
                "records": record_count,
            }
            for source, record_count in session.execute(
                select(Source, func.count(SourceRecord.id))
                .outerjoin(SourceRecord)
                .group_by(Source.id)
                .order_by(Source.id)
            )
        ]
        streams = [
            {
                "source_id": row.source_id,
                "stream_name": row.stream_name,
                "status": row.status,
                "last_event_at": row.last_event_at,
            }
            for row in session.scalars(
                select(StreamCheckpoint).order_by(
                    StreamCheckpoint.source_id, StreamCheckpoint.stream_name
                )
            )
        ]
        jobs = dict(session.execute(select(Job.status, func.count()).group_by(Job.status)).all())
        due_queued_jobs = (
            session.scalar(
                select(func.count())
                .select_from(Job)
                .where(Job.status == "queued", Job.scheduled_for <= datetime.now(UTC))
            )
            or 0
        )
        running_jobs = [
            {
                "kind": row.kind,
                "source_id": row.source_id,
                "attempts": row.attempts,
                "scheduled_for": row.scheduled_for,
                "lease_until": row.lease_until,
            }
            for row in session.scalars(
                select(Job).where(Job.status == "running").order_by(Job.scheduled_for, Job.id)
            )
        ]
        return {
            "operators": session.scalar(select(func.count()).select_from(Operator)) or 0,
            "records": session.scalar(select(func.count()).select_from(SourceRecord)) or 0,
            "active_records": session.scalar(
                select(func.count())
                .select_from(SourceRecord)
                .where(SourceRecord.active.is_(True), SourceRecord.withdrawn.is_(False))
            )
            or 0,
            "entities": session.scalar(select(func.count()).select_from(Entity)) or 0,
            "snapshots": session.scalar(select(func.count()).select_from(Snapshot)) or 0,
            "alerts": session.scalar(select(func.count()).select_from(Alert)) or 0,
            "alert_lineage": session.scalar(select(func.count()).select_from(AlertLineage)) or 0,
            "outbox_pending": session.scalar(
                select(func.count()).select_from(Outbox).where(Outbox.processed_at.is_(None))
            )
            or 0,
            "jobs": jobs,
            "due_queued_jobs": due_queued_jobs,
            "running_jobs": running_jobs,
            "sources": sources,
            "streams": streams,
        }


def _search_counts() -> dict[str, Any]:
    import httpx

    base = Settings().opensearch_url.rstrip("/")
    with httpx.Client(timeout=15) as client:
        health_response = client.get(f"{base}/_cluster/health")
        health_response.raise_for_status()
        health = health_response.json()
        counts: dict[str, Any] = {
            "cluster_status": health.get("status"),
            "timed_out": health.get("timed_out"),
        }
        for index in ("meritus-evidence", "meritus-entities"):
            response = client.get(f"{base}/{index}/_count")
            response.raise_for_status()
            counts[index] = response.json().get("count")
        return counts


def _inside_live() -> None:
    engine = _runtime_engine()
    try:
        _write_json({"database": _database_counts(engine), "search": _search_counts()})
    finally:
        engine.dispose()


def _synthetic_document(run_id: str, number: int, published_at: datetime) -> ParsedDocument:
    return ParsedDocument(
        external_id=f"SYNTHETIC-RUNTIME-{run_id}-{number}",
        source_url=f"https://example.invalid/runtime/{run_id}/{number}",
        title="SYNTHETIC worker restart evidence",
        published_at=published_at,
        payload={"synthetic": True, "runtime_run": run_id, "number": number},
        entities=[
            EntityInput(
                key=f"TEST:RUNTIME:{run_id}",
                name="SYNTHETIC runtime acceptance entity",
                scheme="TEST",
                identifier=f"RUNTIME:{run_id}",
                verified=True,
            )
        ],
        observations=[
            ObservationInput(
                subject_key=f"TEST:RUNTIME:{run_id}",
                kind="insolvency_event",
                event_key=f"synthetic-runtime-event:{run_id}:{number}",
                headline="SYNTHETIC qualifying event",
                detail="Synthetic evidence used only for isolated restart verification.",
                occurred_at=published_at,
                state="verified",
            )
        ],
    )


def _inside_initialise(database_name: str, run_id: str) -> None:
    engine = _runtime_engine(database_name)
    try:
        initialise_database(engine)
        repo = Repository(engine)
        with session_scope(engine) as session:
            for source in session.scalars(select(Source)):
                source.enabled = False
        now = datetime.now(UTC)
        first_at = now - timedelta(minutes=3)
        repo.ingest_batch(
            "find_tender",
            FetchBatch(documents=[_synthetic_document(run_id, 1, first_at)]),
            first_at,
        )
        baseline = IntelligenceService(repo).watchlist(now - timedelta(minutes=2))
        baseline_result = generate_scoring_alerts(
            repo, baseline["items"], RULE_VERSION, now - timedelta(minutes=2)
        )
        if baseline_result["created"] != 0 or len(baseline["items"]) != 1:
            raise RuntimeError("Synthetic scoring baseline was not deterministic")
        second_at = now - timedelta(minutes=1)
        repo.ingest_batch(
            "find_tender",
            FetchBatch(documents=[_synthetic_document(run_id, 2, second_at)]),
            second_at,
        )
        job = enqueue_job(
            repo,
            "weekly",
            dedupe_key=f"runtime-acceptance:{run_id}",
            scheduled_for=now,
        )
        _write_json(
            {
                "job_id": job["id"],
                "dedupe_key": job["dedupe_key"],
                "baseline_entities": len(baseline["items"]),
                "baseline_alerts_created": baseline_result["created"],
            }
        )
    finally:
        engine.dispose()


def _isolated_job(session, run_id: str) -> Job:
    job = session.scalar(select(Job).where(Job.dedupe_key == f"runtime-acceptance:{run_id}"))
    if job is None:
        raise RuntimeError("Isolated acceptance job is unavailable")
    return job


def _inside_status(database_name: str, run_id: str) -> None:
    engine = _runtime_engine(database_name)
    try:
        with session_scope(engine) as session:
            job = _isolated_job(session, run_id)
            _write_json(
                {
                    "job_id": job.id,
                    "job_status": job.status,
                    "attempts": job.attempts,
                    "lease_until": job.lease_until,
                    "snapshots_for_job": session.scalar(
                        select(func.count()).select_from(Snapshot).where(Snapshot.id == job.id)
                    )
                    or 0,
                    "alerts": session.scalar(select(func.count()).select_from(Alert)) or 0,
                    "alert_generations": session.scalar(
                        select(func.count()).select_from(AlertGeneration)
                    )
                    or 0,
                    "alert_lineage": session.scalar(select(func.count()).select_from(AlertLineage))
                    or 0,
                }
            )
    finally:
        engine.dispose()


def _inside_execute_then_wait(database_name: str, run_id: str, sleep_seconds: int) -> None:
    engine = _runtime_engine(database_name)
    try:
        repo = Repository(engine)
        from meritus.jobs import claim_job

        claimed = claim_job(repo)
        if claimed is None or claimed["dedupe_key"] != f"runtime-acceptance:{run_id}":
            raise RuntimeError("Synthetic job was not claimed")
        result = execute_job(repo, claimed)
        _write_json(
            {
                "job_id": claimed["id"],
                "attempts": claimed["attempts"],
                "snapshot_id": result.get("snapshot_id"),
                "alerts": result.get("alerts"),
                "waiting_before_finish": True,
            }
        )
        time.sleep(sleep_seconds)
    finally:
        engine.dispose()


def _inside_expire(database_name: str, run_id: str) -> None:
    engine = _runtime_engine(database_name)
    try:
        with session_scope(engine) as session:
            job = _isolated_job(session, run_id)
            if job.status != "running" or job.attempts != 1:
                raise RuntimeError("Interrupted job was not on its first running lease")
            job.lease_until = datetime.now(UTC) - timedelta(seconds=1)
            _write_json({"job_id": job.id, "expired_attempt": job.attempts})
    finally:
        engine.dispose()


def _inside_recover(database_name: str, run_id: str) -> None:
    engine = _runtime_engine(database_name)
    try:
        repo = Repository(engine)
        result = run_worker_once(repo)
        if result.get("dedupe_key") != f"runtime-acceptance:{run_id}":
            raise RuntimeError("Recovery worker did not finish the isolated acceptance job")
        _write_json(
            {
                "job_id": result["id"],
                "job_status": result["status"],
                "attempts": result["attempts"],
            }
        )
    finally:
        engine.dispose()


def _command(base: list[str], *arguments: str, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(
        [*base, *arguments],
        check=False,
        capture_output=True,
        text=True,
        timeout=180,
    )
    if check and result.returncode:
        raise RuntimeError(f"Command failed during {arguments[0] if arguments else 'verification'}")
    return result


def _last_json(output: str) -> dict[str, Any]:
    for line in reversed(output.splitlines()):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise RuntimeError("Verification command returned no JSON result")


def _inside_command(
    compose: list[str], script: Path, mode: str, *, database_name: str | None = None, run_id: str
) -> dict[str, Any]:
    arguments = [
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "-v",
        f"{script}:/verify_release_runtime.py:ro",
    ]
    if database_name is not None:
        arguments.extend(["-e", f"MERITUS_RUNTIME_DATABASE={database_name}"])
    arguments.extend(
        ["worker", "python", "/verify_release_runtime.py", "--inside", mode, "--run-id", run_id]
    )
    return _last_json(_command(compose, *arguments).stdout)


def _http_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={"Accept": "application/json"})
    with urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError("Runtime HTTP check did not return 200")
        result = json.load(response)
    if not isinstance(result, dict):
        raise RuntimeError("Runtime HTTP check returned an invalid payload")
    return result


def _compose_services(compose: list[str]) -> dict[str, Any]:
    result = _command(compose, "ps", "--format", "json")
    services: dict[str, Any] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        service = item.get("Service")
        if service:
            container_id = item.get("ID")
            if not container_id:
                raise RuntimeError(f"Release service {service} has no container identifier")
            inspected = _command(
                ["docker"], "inspect", "--format", "{{.Image}}", container_id
            ).stdout.strip()
            services[service] = {
                "state": item.get("State"),
                "health": item.get("Health"),
                "image": item.get("Image"),
                "image_id": inspected,
            }
    required = {"postgres", "opensearch", "app", "worker"}
    if set(services) < required:
        raise RuntimeError("One or more release services are absent")
    for name in required:
        if services[name]["state"] != "running":
            raise RuntimeError(f"Release service {name} is not running")
    for name in {"postgres", "opensearch", "app"}:
        if services[name]["health"] != "healthy":
            raise RuntimeError(f"Release service {name} is not healthy")
    if services["app"]["image_id"] != services["worker"]["image_id"]:
        raise RuntimeError("App and worker are not using the same image")
    return services


def _create_database(compose: list[str], database_name: str) -> None:
    _command(compose, "exec", "-T", "postgres", "createdb", "-U", "meritus", database_name)


def _drop_database(compose: list[str], database_name: str) -> None:
    _command(
        compose,
        "exec",
        "-T",
        "postgres",
        "dropdb",
        "--if-exists",
        "--force",
        "-U",
        "meritus",
        database_name,
        check=False,
    )


def _start_interrupted_worker(
    compose: list[str], script: Path, database_name: str, run_id: str, container_name: str
) -> None:
    result = _command(
        compose,
        "run",
        "-d",
        "--no-deps",
        "--name",
        container_name,
        "-v",
        f"{script}:/verify_release_runtime.py:ro",
        "-e",
        f"MERITUS_RUNTIME_DATABASE={database_name}",
        "worker",
        "python",
        "/verify_release_runtime.py",
        "--inside",
        "execute-then-wait",
        "--run-id",
        run_id,
        "--sleep-seconds",
        "600",
    )
    if not result.stdout.strip():
        raise RuntimeError("Interrupted worker container did not start")


def _stop_container(container_name: str) -> None:
    subprocess.run(
        ["docker", "stop", "-t", "1", container_name],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    subprocess.run(
        ["docker", "rm", "-f", container_name],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def _verify_live(
    compose: list[str], script: Path, base_url: str, run_id: str, minimums: dict[str, int]
) -> dict[str, Any]:
    health = _http_json(f"{base_url}/api/health")
    setup = _http_json(f"{base_url}/api/auth/setup-status")
    services = _compose_services(compose)
    live = _inside_command(compose, script, "live", run_id=run_id)
    database = live["database"]
    search = live["search"]
    if health != {"status": "ok", "database": "ok", "search": "ok"}:
        raise RuntimeError("Application health did not confirm database and search")
    if setup.get("needs_setup") is not True or database["operators"] != 0:
        raise RuntimeError("The final first-operator setup boundary is no longer pending")
    if database["records"] < minimums["records"]:
        raise RuntimeError("Live source record count is below the approved release baseline")
    if database["entities"] < minimums["entities"]:
        raise RuntimeError("Live entity count is below the approved release baseline")
    if search["cluster_status"] not in {"green", "yellow"} or search["timed_out"] is True:
        raise RuntimeError("OpenSearch cluster health is unacceptable")
    if search["meritus-evidence"] > database["active_records"]:
        raise RuntimeError("OpenSearch contains more evidence documents than active records")
    return {
        "http_health": health,
        "setup_status": setup,
        "services": services,
        **live,
        "search_matches_active_records": search["meritus-evidence"] == database["active_records"],
    }


def _verify_interruption(compose: list[str], script: Path, run_id: str) -> dict[str, Any]:
    database_name = f"meritus_runtime_{run_id}"
    container_name = f"meritus-runtime-{run_id[:12]}"
    configured = json.loads(_command(compose, "config", "--format", "json").stdout)
    worker_image = configured["services"]["worker"]["image"]
    worker_image_id = _command(
        ["docker"], "image", "inspect", "--format", "{{.Id}}", worker_image
    ).stdout.strip()
    _create_database(compose, database_name)
    try:
        initialised = _inside_command(
            compose, script, "initialise", database_name=database_name, run_id=run_id
        )
        _start_interrupted_worker(compose, script, database_name, run_id, container_name)
        before_stop = None
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            candidate = _inside_command(
                compose, script, "status", database_name=database_name, run_id=run_id
            )
            if (
                candidate["job_status"] == "running"
                and candidate["attempts"] == 1
                and candidate["snapshots_for_job"] == 1
                and candidate["alerts"] >= 1
            ):
                before_stop = candidate
                break
            time.sleep(2)
        if before_stop is None:
            raise RuntimeError("Worker did not reach the durable pre-finish interruption point")
        _stop_container(container_name)
        expired = _inside_command(
            compose, script, "expire", database_name=database_name, run_id=run_id
        )
        recovered = _inside_command(
            compose, script, "recover", database_name=database_name, run_id=run_id
        )
        final = _inside_command(
            compose, script, "status", database_name=database_name, run_id=run_id
        )
        if final["job_status"] != "success" or final["attempts"] != 2:
            raise RuntimeError("Expired running job did not recover exactly once")
        if final["snapshots_for_job"] != 1:
            raise RuntimeError("Recovered job did not preserve a single snapshot")
        for field in ("alerts", "alert_generations", "alert_lineage"):
            if final[field] != before_stop[field]:
                raise RuntimeError("Recovered job duplicated scoring alert state")
        repeated = _inside_command(
            compose, script, "status", database_name=database_name, run_id=run_id
        )
        if repeated != final:
            raise RuntimeError("Terminal job state changed after verification replay")
        return {
            "database": "isolated PostgreSQL database, removed after verification",
            "synthetic_evidence": True,
            "worker_image": worker_image,
            "worker_image_id": worker_image_id,
            "initialised": initialised,
            "before_interruption": before_stop,
            "expired_lease": expired,
            "recovered": recovered,
            "final": final,
            "duplicate_snapshots": 0,
            "duplicate_scoring_alerts": 0,
        }
    finally:
        _stop_container(container_name)
        _drop_database(compose, database_name)


def _verify_final_restart(
    compose: list[str],
    script: Path,
    base_url: str,
    run_id: str,
    minimums: dict[str, int],
    before: dict[str, Any],
) -> dict[str, Any]:
    database_before = before["database"]
    if database_before["running_jobs"] or database_before["due_queued_jobs"]:
        raise RuntimeError("Final worker is not settled for a graceful restart")
    if database_before["outbox_pending"]:
        raise RuntimeError("Search outbox is not settled for a graceful restart")
    configured = json.loads(_command(compose, "config", "--format", "json").stdout)
    worker_image = configured["services"]["worker"]["image"]
    configured_image_id = _command(
        ["docker"], "image", "inspect", "--format", "{{.Id}}", worker_image
    ).stdout.strip()
    _command(compose, "up", "-d", "--force-recreate", "app", "worker")
    after = None
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            after = _verify_live(compose, script, base_url, run_id, minimums)
            break
        except (OSError, RuntimeError, URLError):
            time.sleep(2)
    if after is None:
        raise RuntimeError("Final services did not become healthy after restart")
    durable_fields = ("records", "active_records", "entities", "snapshots", "alerts")
    for field in durable_fields:
        if after["database"][field] != database_before[field]:
            raise RuntimeError("Final database counts changed across the settled restart")
    for field in ("meritus-evidence", "meritus-entities"):
        if after["search"][field] != before["search"][field]:
            raise RuntimeError("Final search counts changed across the settled restart")
    before_image_id = before["services"]["app"]["image_id"]
    after_image_id = after["services"]["app"]["image_id"]
    if after_image_id != configured_image_id:
        raise RuntimeError("Final services did not adopt the configured image")
    if after_image_id == before_image_id:
        raise RuntimeError("Final image upgrade did not replace the previous image")
    return {
        "status": "passed",
        "worker_image": worker_image,
        "before_image_id": before_image_id,
        "after_image_id": after_image_id,
        "database_counts_persisted": {field: database_before[field] for field in durable_fields},
        "search_counts_persisted": {
            field: before["search"][field] for field in ("meritus-evidence", "meritus-entities")
        },
        "setup_pending_after_restart": after["setup_status"]["needs_setup"],
        "services": after["services"],
    }


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8088")
    parser.add_argument("--compose-file", type=Path, default=Path("compose.yaml"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--minimum-records", type=int, default=115_127)
    parser.add_argument("--minimum-entities", type=int, default=10_678)
    parser.add_argument("--execute-isolated-restart", action="store_true")
    parser.add_argument("--verify-final-restart", action="store_true")
    parser.add_argument(
        "--inside",
        choices=("live", "initialise", "status", "execute-then-wait", "expire", "recover"),
    )
    parser.add_argument("--run-id")
    parser.add_argument("--sleep-seconds", type=int, default=600)
    return parser.parse_args()


def main() -> None:
    arguments = _arguments()
    if arguments.inside:
        database_name = None
        if arguments.inside != "live":
            database_name = os.environ.get("MERITUS_RUNTIME_DATABASE")
            if not database_name:
                raise SystemExit("An isolated database is required")
        if not arguments.run_id or not re.fullmatch(r"[a-f0-9]{24}", arguments.run_id):
            raise SystemExit("A valid run identifier is required")
        actions = {
            "live": lambda: _inside_live(),
            "initialise": lambda: _inside_initialise(database_name, arguments.run_id),
            "status": lambda: _inside_status(database_name, arguments.run_id),
            "execute-then-wait": lambda: _inside_execute_then_wait(
                database_name, arguments.run_id, arguments.sleep_seconds
            ),
            "expire": lambda: _inside_expire(database_name, arguments.run_id),
            "recover": lambda: _inside_recover(database_name, arguments.run_id),
        }
        actions[arguments.inside]()
        return

    if arguments.base_url.rstrip("/") not in _SAFE_BASE_URLS:
        raise SystemExit("The verifier accepts only the final loopback 8088 endpoint")
    if arguments.minimum_records < 0 or arguments.minimum_entities < 0:
        raise SystemExit("Count baselines cannot be negative")
    root = Path(__file__).resolve().parents[1]
    compose_file = arguments.compose_file.resolve()
    if not compose_file.is_file():
        raise SystemExit("Compose file is unavailable")
    script = Path(__file__).resolve()
    run_id = uuid4().hex[:24]
    output = arguments.output or (
        root / "data/verification/release-runtime" / run_id / "report.json"
    )
    output = output.resolve()
    verification_root = (root / "data/verification").resolve()
    if verification_root not in output.parents:
        raise SystemExit("Verification output must remain under data/verification")
    compose = ["docker", "compose", "-f", str(compose_file)]
    report: dict[str, Any] = {
        "run_id": run_id,
        "verified_at": datetime.now(UTC).isoformat(),
        "release_endpoint": arguments.base_url.rstrip("/"),
        "live_database_mutated": False,
        "status": "failed",
    }
    step = "live checks"
    try:
        report["live"] = _verify_live(
            compose,
            script,
            arguments.base_url.rstrip("/"),
            run_id,
            {"records": arguments.minimum_records, "entities": arguments.minimum_entities},
        )
        if arguments.execute_isolated_restart:
            step = "isolated worker interruption and recovery"
            report["worker_recovery"] = _verify_interruption(compose, script, run_id)
        else:
            report["worker_recovery"] = {"status": "not_run", "reason": "flag not supplied"}
        if arguments.verify_final_restart:
            step = "settled final service restart"
            report["final_restart"] = _verify_final_restart(
                compose,
                script,
                arguments.base_url.rstrip("/"),
                run_id,
                {"records": arguments.minimum_records, "entities": arguments.minimum_entities},
                report["live"],
            )
        else:
            report["final_restart"] = {"status": "not_run", "reason": "flag not supplied"}
        report["status"] = "passed"
    except Exception as error:
        report["failure"] = {"step": step, "error_type": type(error).__name__}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, default=_json_default) + "\n")
    _write_json(report)
    if report["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
