"""Continuous watched-company streams with transactional timepoints and gap reconciliation."""

from __future__ import annotations

import fcntl
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
from sqlalchemy import select

from meritus.config import Settings
from meritus.db import session_scope, utc_now
from meritus.jobs import enqueue_job
from meritus.models import IngestionRun, Job, Source, StreamCheckpoint
from meritus.repository.evidence import model_dict
from meritus.sources.catalogue import company_key
from meritus.sources.companies_house import (
    parse_stream_lines,
    stream_connection_slot,
    stream_headers,
)
from meritus.sources.http import FetchError, RateLimited
from meritus.sources.runner import check_access

STREAMS = ("companies", "filings")
MAX_LINE_BYTES = 2_000_000


@contextmanager
def _channel_slot(settings, channel):
    root = settings.data_dir / "source-rate-limits"
    root.mkdir(parents=True, exist_ok=True)
    with (root / f"companies-house-channel-{channel}.lock").open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RateLimited(5) from error
        try:
            with stream_connection_slot(settings.data_dir):
                yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def _state(repo, channel, **updates):
    with session_scope(repo.engine) as session:
        row = session.get(StreamCheckpoint, ("companies_house", channel))
        if row is None:
            row = StreamCheckpoint(
                source_id="companies_house", stream_name=channel, status="connecting"
            )
            session.add(row)
        for key, value in updates.items():
            setattr(row, key, value)
        session.flush()
        return model_dict(row)


def _watchlist(source):
    config = source.get("config") or {}
    values = (
        config.get("company_keys") or config.get("company_numbers") or config.get("watchlist") or []
    )
    if not isinstance(values, list) or not values or len(values) > 200:
        raise FetchError(
            "Configure between 1 and 200 approved Companies House watchlist identities."
        )
    return {company_key(str(value).removeprefix("GB-COH:")) for value in values}


def consume_stream(repo, channel, *, settings=None, client=None, stop_event=None):
    """Read a single connection; reconnect orchestration owns backoff and shutdown."""
    if channel not in STREAMS:
        raise ValueError("Unknown Companies House stream")
    settings = settings or Settings()
    stop_event = stop_event or threading.Event()
    state = _state(repo, channel)
    owned = client is None
    try:
        source = repo.get_source("companies_house")
        check_access(source, settings, utc_now(), stream=True)
        watched = _watchlist(source)
    except (PermissionError, ValueError, FetchError) as error:
        return _state(repo, channel, status="blocked", last_error=str(error))
    client = client or httpx.Client(timeout=httpx.Timeout(60, connect=15), follow_redirects=False)
    try:
        with _channel_slot(settings, channel):
            params = {"timepoint": state["timepoint"]} if state["timepoint"] else {}
            with client.stream(
                "GET",
                f"https://stream.companieshouse.gov.uk/{channel}",
                params=params,
                headers=stream_headers(settings),
            ) as response:
                if response.status_code == 416:
                    return _state(
                        repo,
                        channel,
                        timepoint=None,
                        status="gap",
                        last_error=(
                            "Expired upstream timepoint; anchor a new stream "
                            "and reconcile the watchlist."
                        ),
                        detail={
                            "gap_since": utc_now().isoformat(),
                            "gap_id": uuid4().hex,
                            "expired_timepoint": state["timepoint"],
                        },
                    )
                if response.status_code != 200:
                    raise FetchError(
                        f"Companies House stream returned HTTP {response.status_code}."
                    )
                buffer = b""
                for chunk in response.iter_bytes(chunk_size=8192):
                    if stop_event.is_set():
                        break
                    buffer += chunk
                    if len(buffer) > MAX_LINE_BYTES and b"\n" not in buffer:
                        raise FetchError("Companies House stream line exceeds 2 MB.")
                    while b"\n" in buffer:
                        line, buffer = buffer.split(b"\n", 1)
                        if len(line) > MAX_LINE_BYTES:
                            raise FetchError("Companies House stream line exceeds 2 MB.")
                        if not line.strip():
                            continue
                        source = repo.get_source("companies_house")
                        check_access(source, settings, utc_now(), stream=True)
                        watched = _watchlist(source)
                        batch = parse_stream_lines(
                            [line], watched_company_keys=watched, cursor=state["timepoint"]
                        )
                        if not batch.complete:
                            raise FetchError(
                                "Invalid stream event; last committed checkpoint retained."
                            )
                        repo.ingest_batch("companies_house", batch, utc_now(), stream_name=channel)
                        detail = state.get("detail") or {}
                        if not state["timepoint"] and not detail.get("gap_id"):
                            detail = {
                                "gap_id": uuid4().hex,
                                "gap_since": utc_now().isoformat(),
                                "initial_bootstrap": True,
                            }
                        status = (
                            "reconciling"
                            if detail.get("gap_id") and not detail.get("reconciled_at")
                            else "live"
                        )
                        state = _state(repo, channel, status=status, last_error=None, detail=detail)
                if buffer.strip() and not stop_event.is_set():
                    raise FetchError("Truncated stream event; last committed checkpoint retained.")
                return _state(repo, channel)
    except RateLimited as error:
        return {**_state(repo, channel), "retry_after_seconds": error.retry_after}
    except Exception as error:
        message = (
            str(error)
            if isinstance(error, (FetchError, PermissionError))
            else f"Stream interrupted ({type(error).__name__}); checkpoint retained."
        )
        return _state(repo, channel, status="failed", last_error=message)
    finally:
        if owned:
            client.close()


def reconcile_streams(repo):
    """Anchor first, then complete bounded REST pages while streams keep receiving."""
    for channel in STREAMS:
        state = _state(repo, channel)
        detail = state.get("detail") or {}
        if not state["timepoint"] or not detail.get("gap_id") or detail.get("reconciled_at"):
            continue
        job_id = detail.get("reconciliation_job_id")
        with session_scope(repo.engine) as session:
            job = session.get(Job, job_id) if job_id else None
            status = job.status if job else None
            if status in {"queued", "running"}:
                continue
            if status == "success":
                _state(
                    repo,
                    channel,
                    status="live",
                    detail={**detail, "reconciled_at": utc_now().isoformat()},
                    last_error=None,
                )
                continue
            if status in {"failed", "blocked"}:
                now = utc_now()
                retry_at = detail.get("retry_at")
                if not retry_at:
                    detail = {**detail, "retry_at": (now + timedelta(hours=1)).isoformat()}
                    _state(
                        repo,
                        channel,
                        status="reconciliation_failed",
                        detail=detail,
                        last_error="Reconciliation failed; bounded recovery retry is scheduled.",
                    )
                    continue
                if datetime.fromisoformat(retry_at) > now:
                    continue
                try:
                    check_access(repo.get_source("companies_house"), Settings(), now)
                except (PermissionError, ValueError):
                    continue
                detail = {key: value for key, value in detail.items() if key != "retry_at"}
                detail["recovery_retries"] = int(detail.get("recovery_retries", 0)) + 1
            if not job:
                # Serialise with begin_run so a running REST checkpoint is never reset.
                source = session.scalar(
                    select(Source).where(Source.id == "companies_house").with_for_update()
                )
                active = session.scalar(
                    select(IngestionRun.id)
                    .where(
                        IngestionRun.source_id == "companies_house",
                        IngestionRun.status == "running",
                    )
                    .limit(1)
                )
                if active:
                    continue
                source.cursor = None
        job = enqueue_job(
            repo,
            "source",
            "companies_house",
            payload={"stream_reconciliation": channel, "gap_id": detail["gap_id"]},
            dedupe_key=f"stream-reconcile:{channel}:{detail['gap_id']}:{job_id or 'start'}",
        )
        _state(
            repo,
            channel,
            status="reconciling",
            detail={**detail, "reconciliation_job_id": job["id"]},
        )


def run_streams(repo, stop_event):
    """Two process-shared connection slots, one per approved default channel."""

    def run(channel):
        while not stop_event.is_set():
            outcome = consume_stream(repo, channel, stop_event=stop_event)
            stop_event.wait(max(5, min(300, outcome.get("retry_after_seconds") or 30)))

    threads = [threading.Thread(target=run, args=(channel,), daemon=True) for channel in STREAMS]
    for thread in threads:
        thread.start()
    return threads
