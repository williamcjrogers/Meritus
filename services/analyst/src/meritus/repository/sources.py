"""Source policy, checkpoint and ingestion-run repository operations."""

from copy import deepcopy
from typing import Any

from sqlalchemy import select

from meritus.config import contains_secret_values, mask_secrets
from meritus.db import session_scope, utc_now
from meritus.models import IngestionRun, Job, Outbox, Source, SourceRecord
from meritus.repository.evidence import model_dict

_MUTABLE_SOURCE_FIELDS = {"enabled", "config", "permissions"}
_RUN_STATUSES = {"running", "success", "partial", "blocked", "failed"}
_MAX_RUN_COUNT = 2**31 - 1
_REJECTED_RECORD_FIELDS = {"external_id", "source_url", "reason"}


def _failed_run_accounting(status: str, detail: dict[str, Any]) -> tuple[int, int] | None:
    if status not in {"failed", "blocked"}:
        return None
    supplied_counts = {field for field in ("fetched", "rejected") if field in detail}
    has_records = "rejected_records" in detail
    if not supplied_counts and not has_records:
        return None
    if supplied_counts != {"fetched", "rejected"}:
        raise ValueError("Failed run fetched and rejected counts must be supplied together")

    counts = {}
    for field in ("fetched", "rejected"):
        value = detail[field]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"Failed run {field} must be a non-negative integer")
        if value > _MAX_RUN_COUNT:
            raise ValueError(f"Failed run {field} must fit a signed 32-bit integer")
        counts[field] = value
    if counts["rejected"] > counts["fetched"]:
        raise ValueError("Failed run rejected count cannot exceed fetched count")

    rejected_records = detail.get("rejected_records", [])
    if not isinstance(rejected_records, list):
        raise ValueError("Failed run rejected_records must be a list")
    if len(rejected_records) > counts["rejected"]:
        raise ValueError("Failed run rejected_records cannot exceed the rejected count")
    for record in rejected_records:
        if not isinstance(record, dict) or set(record) != _REJECTED_RECORD_FIELDS:
            raise ValueError(
                "Failed run rejected records must contain exactly "
                "external_id, source_url and reason"
            )
        if any(not isinstance(record[field], str) or not record[field].strip() for field in record):
            raise ValueError("Failed run rejected record values must be non-empty strings")
    return counts["fetched"], counts["rejected"]


def source_dict(source: Source) -> dict[str, Any]:
    data = model_dict(source)
    data["config"] = mask_secrets(source.config)
    data["permissions"] = mask_secrets(source.permissions)
    return data


class SourceRepositoryMixin:
    def list_sources(self) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            sources = session.scalars(select(Source).order_by(Source.name)).all()
            return [source_dict(source) for source in sources]

    def get_source(self, source_id: str) -> dict[str, Any]:
        with session_scope(self.engine) as session:
            source = session.get(Source, source_id)
            if source is None:
                raise KeyError(f"Unknown source: {source_id}")
            return source_dict(source)

    def update_source(self, source_id: str, changes: dict) -> dict[str, Any]:
        unknown = set(changes) - _MUTABLE_SOURCE_FIELDS
        if unknown:
            raise ValueError(f"Source fields cannot be changed: {', '.join(sorted(unknown))}")
        if "config" in changes and contains_secret_values(changes["config"]):
            raise ValueError("Secrets must be supplied through process environment variables")
        if "permissions" in changes and contains_secret_values(changes["permissions"]):
            raise ValueError("Secrets must not be stored in source permission records")
        if "config" in changes and not isinstance(changes["config"], dict):
            raise ValueError("Source config must be an object")
        if "permissions" in changes and not isinstance(changes["permissions"], dict):
            raise ValueError("Source permissions must be an object")
        if "enabled" in changes and not isinstance(changes["enabled"], bool):
            raise ValueError("Source enabled must be a boolean")

        with session_scope(self.engine) as session:
            source = session.scalar(select(Source).where(Source.id == source_id).with_for_update())
            if source is None:
                raise KeyError(f"Unknown source: {source_id}")
            previous_permissions = deepcopy(source.permissions)
            if "config" in changes:
                source.config = {**source.config, **deepcopy(changes["config"])}
            if "permissions" in changes:
                source.permissions = {**source.permissions, **deepcopy(changes["permissions"])}
            if "enabled" in changes:
                source.enabled = changes["enabled"]
            if source.permissions != previous_permissions:
                # Projection work is generated at the common mutation boundary,
                # including CLI/internal callers, even if old rows were acknowledged.
                for queued, record_id in enumerate(
                    session.scalars(
                        select(SourceRecord.id)
                        .where(
                            SourceRecord.source_id == source_id,
                            SourceRecord.active.is_(True),
                        )
                        .execution_options(yield_per=500)
                    ),
                    start=1,
                ):
                    session.add(Outbox(record_id=record_id, operation="index", payload={}))
                    if queued % 500 == 0:
                        session.flush()
            session.flush()
            return source_dict(source)

    def begin_run(
        self, source_id: str, *, job_id: str | None = None, job_attempts: int | None = None
    ) -> str:
        now = utc_now()
        with session_scope(self.engine) as session:
            source = session.scalar(select(Source).where(Source.id == source_id).with_for_update())
            if source is None:
                raise KeyError(f"Unknown source: {source_id}")
            active_run = session.scalar(
                select(IngestionRun.id).where(
                    IngestionRun.source_id == source_id,
                    IngestionRun.status == "running",
                )
            )
            if active_run is not None:
                raise ValueError(f"Source already has an active ingestion run: {source_id}")
            run = IngestionRun(
                source_id=source_id,
                status="running",
                started_at=now,
                cursor=source.cursor,
                detail={},
            )
            session.add(run)
            source.last_attempt_at = now
            source.status = "running"
            source.last_error = None
            session.flush()
            if job_id:
                job = session.scalar(select(Job).where(Job.id == job_id).with_for_update())
                if (
                    job is None
                    or job.status != "running"
                    or job.attempts != job_attempts
                    or job.lease_until is None
                    or job.lease_until.replace(tzinfo=now.tzinfo) <= now
                ):
                    raise ValueError("Source job lease is no longer current")
                job.payload = {**job.payload, "active_run_id": run.id}
            return run.id

    def finish_run(
        self,
        run_id: str,
        status: str,
        error: str | None = None,
        detail: dict | None = None,
    ) -> None:
        if status not in _RUN_STATUSES - {"running"}:
            raise ValueError(f"Invalid finished run status: {status}")
        if detail is not None and not isinstance(detail, dict):
            raise ValueError("Run detail must be an object")
        stored_detail = deepcopy(detail or {})
        failed_accounting = _failed_run_accounting(status, stored_detail)
        now = utc_now()
        with session_scope(self.engine) as session:
            run = session.get(IngestionRun, run_id)
            if run is None:
                raise KeyError(f"Unknown ingestion run: {run_id}")
            if run.status != "running":
                raise ValueError("The ingestion run is already finished")
            source = session.get(Source, run.source_id)
            run.status = status
            run.finished_at = now
            run.error = error
            run.detail = stored_detail
            if failed_accounting is not None:
                run.fetched, run.rejected = failed_accounting
            source.status = "healthy" if status == "success" else status
            source.last_error = error
            if status in {"success", "partial"}:
                source.last_success_at = now

    def list_runs(self, source_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if not 1 <= limit <= 1000:
            raise ValueError("limit must be between 1 and 1000")
        with session_scope(self.engine) as session:
            statement = select(IngestionRun)
            if source_id:
                statement = statement.where(IngestionRun.source_id == source_id)
            statement = statement.order_by(IngestionRun.started_at.desc()).limit(limit)
            return [model_dict(run) for run in session.scalars(statement)]
