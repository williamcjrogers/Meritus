from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from meritus.db import session_scope
from meritus.jobs import claim_job, enqueue_job, finish_job, recover_expired_jobs, schedule_due_jobs
from meritus.models import Job


def test_enqueue_deduplicates_and_claim_is_atomic(repo, now):
    a = enqueue_job(repo, "source", source_id="find_tender", dedupe_key="one", scheduled_for=now)
    b = enqueue_job(repo, "source", source_id="find_tender", dedupe_key="one", scheduled_for=now)
    assert a["id"] == b["id"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        claimed = list(pool.map(lambda _: claim_job(repo, now), range(2)))
    assert sum(item is not None for item in claimed) == 1
    assert next(item for item in claimed if item)["attempts"] == 1


def test_expired_lease_recovers_with_bounded_attempts_and_stale_owner_cannot_finish(repo, now):
    job = enqueue_job(repo, "score", scheduled_for=now)
    claim = claim_job(repo, now)
    assert claim["id"] == job["id"]
    recover_expired_jobs(repo, now + timedelta(minutes=31))
    replacement = claim_job(repo, now + timedelta(minutes=31))
    with pytest.raises(ValueError, match="lease"):
        finish_job(repo, claim, "success", {}, now + timedelta(minutes=31))
    finish_job(repo, replacement, "success", {}, now + timedelta(minutes=31))
    assert claim_job(repo, now + timedelta(minutes=32)) is None


def test_daily_catchup_and_weekly_dependencies_deduplicate_across_dst(repo):
    # Monday following autumn clock change:02:00GMT is02:00UTC.
    now = datetime(2026, 10, 26, 9, tzinfo=UTC)
    first = schedule_due_jobs(repo, now)
    second = schedule_due_jobs(repo, now)
    with session_scope(repo.engine) as session:
        jobs = session.scalars(select(Job)).all()
    assert len(first) == len(second) == len(jobs)
    weekly = [job for job in jobs if job.kind == "weekly"]
    assert len(weekly) == 1 and weekly[0].scheduled_for.hour == 7
    score = next(job for job in jobs if job.kind == "score")
    assert score.id in weekly[0].payload["depends_on"]
    source = next(job for job in jobs if job.kind == "source")
    assert source.scheduled_for.hour == 2
    assert source.id in score.payload["depends_on"]


def test_pending_dependency_prevents_snapshot_claim(repo, now):
    source = enqueue_job(repo, "source", source_id="find_tender", scheduled_for=now)
    enqueue_job(repo, "weekly", payload={"depends_on": [source["id"]]}, scheduled_for=now)
    claimed = claim_job(repo, now)
    assert claimed["id"] == source["id"]
    assert claim_job(repo, now) is None
    finish_job(repo, claimed, "partial", {"complete": False}, now)
    assert claim_job(repo, now)["kind"] == "weekly"


def test_job_payload_cannot_store_credentials(repo):
    with pytest.raises(ValueError, match="credential"):
        enqueue_job(repo, "source", source_id="find_tender", payload={"api_key": "secret"})


def test_snapshot_job_replay_reuses_one_durable_snapshot(repo, now, monkeypatch):
    from meritus.worker import execute_job

    job = enqueue_job(repo, "weekly", scheduled_for=now)
    first = execute_job(repo, {**job, "attempts": 1}, now)
    second = execute_job(repo, {**job, "attempts": 2}, now + timedelta(minutes=1))
    assert first["snapshot_id"] == second["snapshot_id"]
    assert len(repo.list_snapshots()) == 1


def test_worker_source_failure_is_saved_and_other_job_can_continue(repo, now, monkeypatch):
    from meritus.worker import run_worker_once

    monkeypatch.setattr(
        "meritus.worker.run_source",
        lambda *a, **k: {"status": "failed", "error": "Synthetic source failure"},
    )
    enqueue_job(repo, "source", source_id="find_tender", scheduled_for=now)
    outcome = run_worker_once(repo, now)
    assert outcome["status"] == "queued" and outcome["attempts"] == 1
    with session_scope(repo.engine) as session:
        row = session.scalar(select(Job))
        assert row.error == "Synthetic source failure"


def test_score_worker_runs_durable_alert_generation(repo, now, monkeypatch):
    from meritus.worker import execute_job

    item = {"entity_id": "synthetic", "score": 25, "eligible": False, "contributions": []}
    seen = []

    class Service:
        def __init__(self, supplied_repo):
            assert supplied_repo is repo

        def watchlist(self, supplied_now):
            assert supplied_now == now
            return {
                "items": [item],
                "as_of": now.isoformat(),
                "coverage": {"complete": True},
            }

    monkeypatch.setattr("meritus.worker.IntelligenceService", Service)
    monkeypatch.setattr(
        "meritus.worker.generate_scoring_alerts",
        lambda supplied_repo, items, rule_version, supplied_now: (
            seen.append((supplied_repo, items, rule_version, supplied_now)) or {"created": 2}
        ),
    )

    result = execute_job(repo, {"kind": "score"}, now)

    assert result["alerts"] == {"created": 2}
    assert seen and seen[0][0] is repo and seen[0][1] == [item] and seen[0][3] == now


def test_spring_schedule_and_fortnightly_digest_use_local_clock(repo):
    now = datetime(2026, 3, 30, 8, tzinfo=UTC)
    jobs = schedule_due_jobs(repo, now)
    daily = next(job for job in jobs if job["kind"] == "score")
    assert datetime.fromisoformat(daily["scheduled_for"]).hour == 1
    digest = next(job for job in jobs if job["kind"] == "digest")
    assert datetime.fromisoformat(digest["scheduled_for"]).weekday() == 0
    assert datetime.fromisoformat(digest["scheduled_for"]).hour == 6
    assert daily["id"] in digest["payload"]["depends_on"]


def test_retry_budget_exhaustion_is_terminal(repo, now):
    enqueue_job(repo, "score", scheduled_for=now)
    for attempt in range(3):
        instant = now + timedelta(hours=attempt)
        claim = claim_job(repo, instant)
        assert claim["attempts"] == attempt + 1
        result = finish_job(repo, claim, "failed", {}, instant, error="Synthetic failure")
    assert result["status"] == "failed"
    assert claim_job(repo, now + timedelta(hours=4)) is None


def test_unknown_dependency_is_rejected_before_queueing(repo, now):
    with pytest.raises(ValueError, match="dependenc"):
        enqueue_job(repo, "weekly", payload={"depends_on": ["missing"]}, scheduled_for=now)


def test_exhausted_score_dependency_blocks_weekly_snapshot(repo, now):
    score = enqueue_job(repo, "score", scheduled_for=now)
    weekly = enqueue_job(repo, "weekly", payload={"depends_on": [score["id"]]}, scheduled_for=now)
    with session_scope(repo.engine) as session:
        row = session.get(Job, score["id"])
        row.status = "failed"
        row.attempts = 3
    assert claim_job(repo, now) is None
    with session_scope(repo.engine) as session:
        row = session.get(Job, weekly["id"])
        assert row.status == "blocked" and "dependency" in row.error


def test_failed_source_dependency_still_allows_score_to_report_incomplete_coverage(repo, now):
    source = enqueue_job(repo, "source", source_id="find_tender", scheduled_for=now)
    score = enqueue_job(repo, "score", payload={"depends_on": [source["id"]]}, scheduled_for=now)
    with session_scope(repo.engine) as session:
        session.get(Job, source["id"]).status = "failed"
    assert claim_job(repo, now)["id"] == score["id"]
