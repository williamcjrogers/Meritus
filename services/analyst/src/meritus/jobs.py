"""Durable, leased jobs and Europe/London collection schedules."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, time, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from meritus.config import contains_secret_values
from meritus.db import session_scope, utc_now
from meritus.models import IngestionRun, Job, Source
from meritus.repository.evidence import model_dict

KINDS = {"source", "score", "weekly", "digest", "purge", "reindex"}
TERMINAL = {"success", "partial", "failed", "blocked"}
LEASE = timedelta(minutes=30)
MAX_ATTEMPTS = 3


def _aware(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def enqueue_job(repo, kind, source_id=None, payload=None, dedupe_key=None, *, scheduled_for=None):
    if kind not in KINDS:
        raise ValueError("Unknown job kind")
    if kind == "source" and not source_id:
        raise ValueError("A source job requires a source identifier")
    if source_id:
        repo.get_source(source_id)
    payload = {} if payload is None else payload
    if not isinstance(payload, dict) or contains_secret_values(payload):
        raise ValueError("Job payload must be an object without credentials")
    if len(json.dumps(payload)) > 64_000:
        raise ValueError("Job payload exceeds 64 KB")
    dependencies = payload.get("depends_on", [])
    if not isinstance(dependencies, list) or any(
        not isinstance(item, str) for item in dependencies
    ):
        raise ValueError("Job dependencies must be identifiers")
    if len(dependencies) > 1000:
        raise ValueError("At most 1000 job dependencies are allowed")
    with session_scope(repo.engine) as session:
        known = set(session.scalars(select(Job.id).where(Job.id.in_(dependencies))))
        if set(dependencies) - known:
            raise ValueError("Unknown job dependency")
    now = utc_now()
    scheduled_for = scheduled_for or now
    if scheduled_for.tzinfo is None:
        raise ValueError("Job schedule must include a UTC offset")
    scheduled_for = scheduled_for.astimezone(UTC)
    key = dedupe_key or f"manual:{uuid4()}"
    if not isinstance(key, str) or not key or len(key) > 512:
        raise ValueError("Invalid job deduplication key")
    try:
        with session_scope(repo.engine) as session:
            existing = session.scalar(select(Job).where(Job.dedupe_key == key))
            if existing:
                return model_dict(existing)
            job = Job(
                kind=kind,
                source_id=source_id,
                scheduled_for=scheduled_for,
                status="queued",
                payload=payload,
                created_at=now,
                dedupe_key=key,
            )
            session.add(job)
            session.flush()
            return model_dict(job)
    except IntegrityError:
        with session_scope(repo.engine) as session:
            existing = session.scalar(select(Job).where(Job.dedupe_key == key))
            if existing:
                return model_dict(existing)
        raise


def recover_expired_jobs(repo, now=None):
    now = _aware(now or utc_now())
    recovered = []
    with session_scope(repo.engine) as session:
        jobs = session.scalars(
            select(Job)
            .where(Job.status == "running", Job.lease_until <= now)
            .with_for_update(skip_locked=True)
        ).all()
        for job in jobs:
            job.status = "failed" if job.attempts >= MAX_ATTEMPTS else "queued"
            job.error = (
                "Worker lease expired; retry budget exhausted"
                if job.status == "failed"
                else "Worker lease expired; queued for recovery"
            )
            job.lease_until = None
            if job.status == "failed":
                job.finished_at = now
            # Only repair a run explicitly owned by this job, never a separate manual run.
            active_run_id = job.payload.get("active_run_id")
            run = session.get(IngestionRun, active_run_id) if active_run_id else None
            if run and run.status == "running" and run.source_id == job.source_id:
                run.status = "failed"
                run.finished_at = now
                run.error = "Owning worker lease expired; checkpoint retained"
                source = session.get(Source, run.source_id)
                source.status = "failed"
                source.last_error = run.error
            recovered.append(job.id)
    return recovered


def claim_job(repo, now=None):
    now = _aware(now or utc_now())
    recover_expired_jobs(repo, now)
    with session_scope(repo.engine) as session:
        statement = (
            select(Job)
            .where(Job.status == "queued", Job.scheduled_for <= now)
            .order_by(Job.scheduled_for, Job.created_at, Job.id)
            .with_for_update(skip_locked=True)
        )
        for job in session.scalars(statement):
            dependencies = job.payload.get("depends_on", [])
            if dependencies:
                states = dict(
                    session.execute(
                        select(Job.id, Job.status).where(Job.id.in_(dependencies))
                    ).all()
                )
                missing = [identifier for identifier in dependencies if identifier not in states]
                failed = [
                    identifier
                    for identifier, state in states.items()
                    if state in {"failed", "blocked"}
                ]
                if missing or (failed and job.kind != "score"):
                    job.status = "blocked"
                    job.error = (
                        "Required dependency failed or is unavailable; snapshot was not created"
                    )
                    job.finished_at = now
                    job.payload = {**job.payload, "dependency_states": states}
                    continue
                if any(states.get(identifier) not in TERMINAL for identifier in dependencies):
                    continue
                job.payload = {**job.payload, "dependency_states": states}
            # This conditional update also provides an atomic claim under SQLite tests.
            claimed = session.execute(
                update(Job)
                .where(Job.id == job.id, Job.status == "queued")
                .values(
                    status="running", attempts=Job.attempts + 1, lease_until=now + LEASE, error=None
                )
                .execution_options(synchronize_session=False)
            )
            if claimed.rowcount:
                session.refresh(job)
                return model_dict(job)
    return None


def renew_lease(repo, claimed, now=None):
    now = _aware(now or utc_now())
    with session_scope(repo.engine) as session:
        result = session.execute(
            update(Job)
            .where(
                Job.id == claimed["id"],
                Job.status == "running",
                Job.attempts == claimed["attempts"],
                Job.lease_until > now,
            )
            .values(lease_until=now + LEASE)
        )
        return result.rowcount == 1


def finish_job(repo, claimed, status, result, now=None, *, error=None, retry_after=None):
    now = _aware(now or utc_now())
    if status not in TERMINAL:
        raise ValueError("Invalid terminal job state")
    if contains_secret_values(result):
        raise ValueError("Job results must not contain credentials")
    with session_scope(repo.engine) as session:
        job = session.scalar(select(Job).where(Job.id == claimed["id"]).with_for_update())
        if (
            not job
            or job.status != "running"
            or job.attempts != claimed["attempts"]
            or _aware(job.lease_until) <= now
        ):
            raise ValueError("Job lease no longer belongs to this worker")
        job.payload = {**job.payload, "result": result}
        job.error = error
        job.lease_until = None
        if status == "failed" and job.attempts < MAX_ATTEMPTS:
            job.status = "queued"
            job.scheduled_for = now + timedelta(
                seconds=max(30, min(3600, retry_after or 60 * job.attempts))
            )
        else:
            job.status = status
            job.finished_at = now
        return model_dict(job)


def schedule_due_jobs(repo, now):
    if now.tzinfo is None:
        raise ValueError("Scheduler time must include a UTC offset")
    local = now.astimezone(ZoneInfo("Europe/London"))
    day = local.date()
    daily = datetime.combine(day, time(2), local.tzinfo)
    if daily > local:
        day -= timedelta(days=1)
        daily = datetime.combine(day, time(2), local.tzinfo)
    scheduled = []
    source_jobs = []
    for source in repo.list_sources():
        if source["enabled"] and source["id"] not in {"reviewed_import", "hmcts"}:
            job = enqueue_job(
                repo,
                "source",
                source["id"],
                dedupe_key=f"daily:{day}:{source['id']}",
                scheduled_for=daily,
            )
            source_jobs.append(job["id"])
            scheduled.append(job)
    score = enqueue_job(
        repo,
        "score",
        payload={"depends_on": source_jobs},
        dedupe_key=f"daily:{day}:score",
        scheduled_for=daily,
    )
    scheduled.append(score)
    monday = local.date() - timedelta(days=local.weekday())
    weekly = datetime.combine(monday, time(7), local.tzinfo)
    if weekly > local:
        monday -= timedelta(days=7)
        weekly = datetime.combine(monday, time(7), local.tzinfo)
    scheduled.append(
        enqueue_job(
            repo,
            "weekly",
            payload={"depends_on": [score["id"]], "scheduled_week": str(monday)},
            dedupe_key=f"weekly:{monday}",
            scheduled_for=weekly,
        )
    )
    fortnight = monday - timedelta(days=((monday - date(1970, 1, 5)).days % 14))
    scheduled.append(
        enqueue_job(
            repo,
            "digest",
            payload={"depends_on": [score["id"]]},
            dedupe_key=f"fortnightly:{fortnight}",
            scheduled_for=datetime.combine(fortnight, time(7), local.tzinfo),
        )
    )
    scheduled.append(
        enqueue_job(repo, "purge", dedupe_key=f"daily:{day}:purge", scheduled_for=daily)
    )
    return scheduled
