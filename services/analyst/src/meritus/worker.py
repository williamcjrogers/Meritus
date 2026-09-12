"""Execute durable jobs, preserving leases, run ownership and snapshot idempotence."""

from __future__ import annotations

import threading
from contextlib import suppress
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError

from meritus.alerts import generate_scoring_alerts
from meritus.config import Settings
from meritus.db import session_scope, utc_now
from meritus.intelligence.rules import RULE_VERSION
from meritus.intelligence.service import IntelligenceService
from meritus.jobs import claim_job, finish_job, renew_lease, schedule_due_jobs
from meritus.models import Snapshot
from meritus.repository.evidence import model_dict
from meritus.retention import purge_expired
from meritus.sources.runner import run_source


class _JobRepository:
    def __init__(self, repo, job):
        self.repo, self.job = repo, job

    def __getattr__(self, name):
        return getattr(self.repo, name)

    def begin_run(self, source_id):
        return self.repo.begin_run(
            source_id, job_id=self.job["id"], job_attempts=self.job["attempts"]
        )

    def save_snapshot(self, kind, as_of, rule_version, payload):
        try:
            with session_scope(self.repo.engine) as session:
                existing = session.get(Snapshot, self.job["id"])
                if existing:
                    return model_dict(existing)
                snapshot = Snapshot(
                    id=self.job["id"],
                    kind=kind,
                    as_of=as_of,
                    rule_version=rule_version,
                    payload={**payload, "job_id": self.job["id"]},
                    created_at=utc_now(),
                )
                session.add(snapshot)
                session.flush()
                return model_dict(snapshot)
        except IntegrityError:
            return self.repo.get_snapshot(self.job["id"])


def execute_job(repo, job, now=None):
    now = now or utc_now()
    settings = Settings()
    kind = job["kind"]
    if kind == "source":
        return run_source(_JobRepository(repo, job), job["source_id"])
    if kind in {"weekly", "digest"}:
        try:
            snapshot = repo.get_snapshot(job["id"])
        except KeyError:
            snapshot = IntelligenceService(_JobRepository(repo, job)).create_snapshot(kind, now)
        alerts = generate_scoring_alerts(
            repo,
            snapshot["payload"].get("items", []),
            snapshot.get("rule_version") or RULE_VERSION,
            now,
        )
        return {
            "status": "success",
            "snapshot_id": snapshot["id"],
            "as_of": snapshot["as_of"],
            "alerts": alerts,
        }
    if kind == "score":
        result = IntelligenceService(repo).watchlist(now)
        alerts = generate_scoring_alerts(repo, result["items"], RULE_VERSION, now)
        return {
            "status": "success",
            "entities_ranked": len(result["items"]),
            "as_of": result["as_of"],
            "coverage": result["coverage"],
            "alerts": alerts,
        }
    if kind == "purge":
        result = purge_expired(repo, now, settings.data_dir)
        return {"status": "success" if result["complete"] else "partial", **result}
    if kind == "reindex":
        from meritus.search import SearchIndex

        return {"status": "success", **SearchIndex(settings).reindex(repo)}
    raise ValueError("Unsupported worker job kind")


def run_worker_once(repo, now=None):
    fixed_clock = now is not None
    now = now or utc_now()
    if now.tzinfo is None:
        raise ValueError("Worker time must include a UTC offset")
    job = claim_job(repo, now)
    if job is None:
        return {"status": "idle"}
    done = threading.Event()
    lease_lost = threading.Event()

    def heartbeat():
        while not done.wait(30):
            try:
                if not renew_lease(repo, job):
                    lease_lost.set()
                    return
            except Exception:
                lease_lost.set()
                return

    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        result = execute_job(repo, job, now)
        if lease_lost.is_set():
            return {"status": "lease_lost", "job_id": job["id"]}
        return finish_job(
            repo,
            job,
            result.get("status", "success"),
            result,
            now if fixed_clock else utc_now(),
            error=result.get("error"),
            retry_after=result.get("retry_after_seconds"),
        )
    except Exception as error:
        message = f"Worker operation failed ({type(error).__name__}); see job and source status."
        try:
            return finish_job(
                repo,
                job,
                "failed",
                {"status": "failed", "error": message},
                now if fixed_clock else utc_now(),
                error=message,
            )
        except ValueError:
            return {"status": "lease_lost", "job_id": job["id"]}
    finally:
        done.set()
        thread.join(timeout=1)


def run_worker(repo, stop_event=None):
    from meritus.search import SearchIndex

    stop_event = stop_event or threading.Event()
    search = SearchIndex(Settings())
    from meritus.sources.streams import reconcile_streams, run_streams

    run_streams(repo, stop_event)
    while not stop_event.is_set():
        now = datetime.now(UTC)
        schedule_due_jobs(repo, now)
        reconcile_streams(repo)
        run_worker_once(repo)
        # Individual outbox failures remain durable and visible for the next iteration.
        with suppress(Exception):
            search.drain_outbox(repo)
        stop_event.wait(2)
