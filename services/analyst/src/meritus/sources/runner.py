"""Access-first source runs and transactional checkpoints."""

import json
from datetime import UTC, datetime

import httpx

from meritus.alerts import emit_source_failure_alert
from meritus.config import Settings
from meritus.intelligence.rules import RULE_VERSION
from meritus.retention import purge_expired
from meritus.sources.http import FetchError, RateLimited
from meritus.sources.policy import SourceBlocked, require_permission
from meritus.sources.registry import get_adapter


def required_credentials(source, *, stream=False):
    """Credential names for this operation; REST and streams use separate keys."""
    if source["id"] == "companies_house":
        return [
            "MERITUS_COMPANIES_HOUSE_STREAM_KEY" if stream else "MERITUS_COMPANIES_HOUSE_API_KEY"
        ]
    return source.get("credential_names", [])


def check_access(source, settings, now, *, stream=False):
    source_id = source["id"]
    require_permission(source, "retrieve", now)
    require_permission(source, "analyse", now)
    if not source.get("enabled"):
        raise SourceBlocked(source_id, "retrieve", "the source is disabled")
    for name in required_credentials(source, stream=stream):
        value = getattr(settings, name.removeprefix("MERITUS_").lower(), None)
        if hasattr(value, "get_secret_value"):
            value = value.get_secret_value()
        if not value or not str(value).strip():
            variable = name if name.startswith("MERITUS_") else f"MERITUS_{name.upper()}"
            raise SourceBlocked(source_id, "retrieve", f"configure {variable}")
    if source_id == "companies_house":
        from meritus.sources.catalogue import company_key

        config = source.get("config") or {}
        watched = (
            config.get("company_keys")
            or config.get("company_numbers")
            or config.get("watchlist")
            or []
        )
        if not isinstance(watched, list) or not watched or len(watched) > 200:
            raise SourceBlocked(
                source_id, "retrieve", "configure 1 to 200 approved company identities"
            )
        for value in watched:
            company_key(str(value).removeprefix("GB-COH:"))
    if source_id == "gazette" and not (settings.organisational_contact or "").strip():
        raise SourceBlocked(source_id, "retrieve", "configure an organisational contact")


def _error_message(error):
    if isinstance(error, (SourceBlocked, FetchError)):
        return str(error)
    if isinstance(error, ValueError):
        return "Source response or configuration validation failed; no checkpoint was advanced."
    return f"Source run failed ({type(error).__name__}); no checkpoint was advanced."


def _source_batches(repo, source, adapter, client, now):
    """Commit retained-case checks before collecting more licensed judgments."""
    if (
        source["id"] == "find_case_law"
        and (source.get("permissions") or {}).get("current_version_only") is True
    ):
        from meritus.sources.caselaw import revalidate_retained_cases

        checked = revalidate_retained_cases(repo, source, client, now)
        yield checked
        checkpoint = json.loads(checked.cursor or "{}")
        if checkpoint.get("current_records", {}).get("stop_reason") in {
            "rate_limit",
            "check_failed",
        }:
            return
        source = repo.get_source(source["id"])
    yield adapter.fetch(source, client, now)


def run_source(repo, source_id, now=None, client=None):
    fixed_clock = now is not None
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Run time must include a UTC offset.")
    source = repo.get_source(source_id)
    try:
        run_id = repo.begin_run(source_id)
    except ValueError:
        running = next(
            (run for run in repo.list_runs(source_id, limit=1) if run["status"] == "running"),
            None,
        )
        emit_source_failure_alert(
            repo,
            source_id=source_id,
            status="blocked",
            event_version=str(running["id"] if running else "active-run"),
            rule_version=RULE_VERSION,
            now=now,
        )
        return {
            "source_id": source_id,
            "status": "blocked",
            "error": "A source run is already active; the existing run remains unchanged.",
        }
    source = repo.get_source(source_id)
    owned_client = client is None
    batch = None
    committed = False
    counts = None
    try:
        settings = Settings()
        check_access(source, settings, now)
        adapter = get_adapter(source_id)
        if client is None:
            client = httpx.Client(timeout=30, headers={"User-Agent": "MeritusVia/0.1"})
        complete = True
        warnings = []
        document_warnings = 0
        retention = None
        for batch in _source_batches(repo, source, adapter, client, now):
            observed_at = now if fixed_clock else datetime.now(UTC)
            current_source = repo.get_source(source_id)
            check_access(current_source, settings, observed_at)
            saved = repo.ingest_batch(source_id, batch, observed_at=observed_at, run_id=run_id)
            if counts is None:
                counts = saved
            else:
                counts = {
                    **saved,
                    **{
                        key: counts[key] + saved[key]
                        for key in ("fetched", "inserted", "updated", "replayed")
                    },
                }
            committed = True
            complete = complete and batch.complete
            warnings.extend(batch.warnings)
            document_warnings += sum(bool(document.warnings) for document in batch.documents)
            if (
                source_id == "find_case_law"
                and current_source["permissions"].get("current_version_only") is True
            ):
                retention = purge_expired(repo, observed_at, settings.data_dir)
                if retention["unresolved_artifacts"]:
                    raise FetchError("Licensed judgment erasure requires managed-file recovery.")
                if not retention["complete"]:
                    complete = False
                    warnings.append("Judgment removal is awaiting search-index acknowledgement.")
        status = "success" if complete else "partial"
        detail = {
            "complete": complete,
            "warnings": list(dict.fromkeys(warnings)),
            "documents_requiring_review": document_warnings,
            "observed_at": observed_at.isoformat(),
        }
        if retention is not None:
            detail["retention"] = retention
        repo.finish_run(run_id, status, detail=detail)
        return {"run_id": run_id, "status": status, **counts, **detail}
    except Exception as error:
        status = "blocked" if isinstance(error, SourceBlocked) else "failed"
        message = _error_message(error)
        if committed:
            message = (
                "A completed batch was committed before the source run stopped "
                f"({type(error).__name__}); its checkpoint was retained."
            )
        detail = {
            "complete": False,
            "source_url": source["home_url"],
            "failure_type": type(error).__name__,
        }
        if isinstance(error, RateLimited):
            detail["retry_after_seconds"] = error.retry_after
        if batch is not None and not committed:
            detail["fetched"] = len(batch.documents)
            detail["rejected"] = len(batch.documents)
            detail["rejected_records"] = [
                {
                    "external_id": document.external_id,
                    "source_url": document.source_url,
                    "reason": message,
                }
                for document in batch.documents
            ]
        repo.finish_run(run_id, status, error=message, detail=detail)
        emit_source_failure_alert(
            repo,
            source_id=source_id,
            status=status,
            event_version=run_id,
            rule_version=RULE_VERSION,
            now=now,
        )
        return {
            "run_id": run_id,
            "source_id": source_id,
            "status": status,
            "error": message,
            **detail,
        }
    finally:
        if owned_client and client is not None:
            client.close()
