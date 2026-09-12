import json

import httpx
import pytest

from meritus.config import Settings
from meritus.db import session_scope
from meritus.models import StreamCheckpoint
from meritus.sources.streams import consume_stream


def event(number="09999999", timepoint=10):
    return (
        json.dumps(
            {
                "resource_uri": f"/company/{number}",
                "resource_id": number,
                "data": {"company_number": number, "company_name": "Synthetic Stream Ltd"},
                "event": {
                    "type": "changed",
                    "timepoint": timepoint,
                    "published_at": "2026-09-12T09:00:00Z",
                },
            }
        ).encode()
        + b"\n"
    )


def configured(repo, tmp_path):
    repo.update_source(
        "companies_house", {"enabled": True, "config": {"company_numbers": ["09999999"]}}
    )
    return Settings(companies_house_stream_key="synthetic-stream-key", data_dir=tmp_path)


def test_stream_filters_watchlist_and_commits_own_cursor_without_overwriting_rest(repo, tmp_path):
    settings = configured(repo, tmp_path)
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, content=event("08888888", 9) + event())

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        outcome = consume_stream(repo, "companies", settings=settings, client=client)
    assert outcome["timepoint"] == "10"
    assert len(repo.list_records()) == 1
    assert repo.list_entities()[0]["key"] == "GB-COH:09999999"
    assert repo.get_source("companies_house")["cursor"] is None
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        consume_stream(repo, "companies", settings=settings, client=client)
    assert seen[-1].url.params["timepoint"] == "10"
    assert len(repo.list_records()) == 1


def test_stream_416_preserves_gap_and_requires_reconciliation(repo, tmp_path):
    settings = configured(repo, tmp_path)
    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(416))) as client:
        outcome = consume_stream(repo, "companies", settings=settings, client=client)
    assert outcome["status"] == "gap"
    with session_scope(repo.engine) as session:
        row = session.get(StreamCheckpoint, ("companies_house", "companies"))
        assert row.timepoint is None and row.detail["gap_since"]


def test_stream_invalid_event_never_skips_checkpoint(repo, tmp_path):
    settings = configured(repo, tmp_path)
    with httpx.Client(
        transport=httpx.MockTransport(
            lambda r: httpx.Response(200, content=event(timepoint="bad") + event(timepoint=11))
        )
    ) as client:
        outcome = consume_stream(repo, "companies", settings=settings, client=client)
    assert outcome["status"] == "failed"
    with session_scope(repo.engine) as session:
        assert session.get(StreamCheckpoint, ("companies_house", "companies")).timepoint is None
    assert repo.list_records() == []


def test_empty_watchlist_blocks_before_network(repo, tmp_path):
    settings = configured(repo, tmp_path)
    repo.update_source("companies_house", {"config": {"company_numbers": []}})
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: pytest.fail("No request allowed"))
    ) as client:
        assert (
            consume_stream(repo, "companies", settings=settings, client=client)["status"]
            == "blocked"
        )


def test_stream_ingest_failure_does_not_advance_checkpoint(repo, tmp_path, monkeypatch):
    settings = configured(repo, tmp_path)

    def fail(*args, **kwargs):
        raise ValueError("Synthetic transaction failure")

    monkeypatch.setattr(repo, "ingest_batch", fail)
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=event()))
    ) as client:
        assert (
            consume_stream(repo, "companies", settings=settings, client=client)["status"]
            == "failed"
        )
    with session_scope(repo.engine) as session:
        assert session.get(StreamCheckpoint, ("companies_house", "companies")).timepoint is None


def test_reconciliation_anchors_before_queue_and_waits_for_rest_completion(repo, tmp_path):
    from meritus.jobs import claim_job, finish_job
    from meritus.sources.streams import reconcile_streams

    settings = configured(repo, tmp_path)
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=event()))
    ) as client:
        consume_stream(repo, "companies", settings=settings, client=client)
    reconcile_streams(repo)
    with session_scope(repo.engine) as session:
        checkpoint = session.get(StreamCheckpoint, ("companies_house", "companies"))
        assert checkpoint.status == "reconciling"
        assert checkpoint.timepoint == "10"
        job_id = checkpoint.detail["reconciliation_job_id"]
    claim = claim_job(repo)
    assert claim["id"] == job_id
    finish_job(repo, claim, "partial", {})
    reconcile_streams(repo)
    second = claim_job(repo)
    assert second["id"] != job_id
    finish_job(repo, second, "success", {})
    reconcile_streams(repo)
    with session_scope(repo.engine) as session:
        checkpoint = session.get(StreamCheckpoint, ("companies_house", "companies"))
        assert checkpoint.status == "live" and checkpoint.detail["reconciled_at"]


def test_failed_reconciliation_can_retry_after_access_recovers(repo, tmp_path, monkeypatch):
    from datetime import UTC, datetime, timedelta

    from meritus.jobs import claim_job
    from meritus.models import Job
    from meritus.sources.streams import reconcile_streams

    settings = configured(repo, tmp_path)
    clock = datetime.now(UTC)
    monkeypatch.setattr("meritus.sources.streams.utc_now", lambda: clock)
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "synthetic-rest")
    with httpx.Client(
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=event()))
    ) as client:
        consume_stream(repo, "companies", settings=settings, client=client)
    reconcile_streams(repo)
    first = claim_job(repo)
    with session_scope(repo.engine) as session:
        session.get(Job, first["id"]).status = "failed"
    reconcile_streams(repo)
    assert claim_job(repo) is None
    clock += timedelta(hours=2)
    reconcile_streams(repo)
    replacement = claim_job(repo)
    assert replacement and replacement["id"] != first["id"]
