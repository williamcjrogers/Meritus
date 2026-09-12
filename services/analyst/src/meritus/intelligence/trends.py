"""Derive reproducible payment deterioration events from successive reports."""

from collections import defaultdict
from datetime import UTC, datetime
from itertools import pairwise
from typing import Any


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def _report_metrics(report: dict) -> dict[str, float]:
    attributes = report.get("attributes") or {}
    metrics = {}
    for metric in ("average_payment_days", "percent_paid_outside_terms"):
        value = attributes.get(metric)
        if isinstance(value, int | float) and not isinstance(value, bool):
            metrics[metric] = float(value)
    generic_metric = attributes.get("metric") or attributes.get("category")
    generic_value = report.get("value")
    unit = str(report.get("unit") or "").casefold()
    compatible_units = {
        "average_payment_days": {"day", "days"},
        "percent_paid_outside_terms": {"percent", "percentage_points", "percentage points", "%"},
    }
    if (
        generic_metric in compatible_units
        and isinstance(generic_value, int | float)
        and not isinstance(generic_value, bool)
        and unit in compatible_units[generic_metric]
    ):
        metrics[str(generic_metric)] = float(generic_value)
    return metrics


def _eligible_report(report: dict, as_of: datetime) -> bool:
    if report.get("kind") != "payment_report":
        return False
    if report.get("state") != "verified" or report.get("active") is not True:
        return False
    if report.get("withdrawn") is True:
        return False
    expiry = _datetime(report.get("expires_at"))
    if report.get("expires_at") and expiry is None:
        return False
    if expiry and expiry <= as_of:
        return False
    for field in ("published_at", "observed_at"):
        value = _datetime(report.get(field))
        if value is None or value > as_of:
            return False
    period_end = _datetime(report.get("period_end"))
    period_start = _datetime((report.get("attributes") or {}).get("period_start"))
    return bool(period_start and period_end and period_start <= period_end <= as_of)


def _revision_key(report: dict) -> tuple[int, float, str]:
    observed_at = _datetime(report.get("observed_at"))
    try:
        revision = int(report.get("revision") or 0)
    except (TypeError, ValueError):
        revision = 0
    return revision, observed_at.timestamp() if observed_at else 0, str(report.get("id") or "")


def _correction_identity(report: dict) -> tuple[str, str, str]:
    attributes = report.get("attributes") or {}
    subject = str(report.get("entity_id") or report.get("entity_key") or "")
    regime = str(attributes.get("reporting_regime") or attributes.get("regime") or "")
    event = str(report.get("event_key") or report.get("id") or "")
    return subject, regime, event


def _deduplicate_corrections(reports: list[dict]) -> list[dict]:
    current: dict[tuple[str, str, str], dict] = {}
    for report in reports:
        identity = _correction_identity(report)
        if identity not in current or _revision_key(report) > _revision_key(current[identity]):
            current[identity] = report
    return list(current.values())


def _event_key(previous: dict, current: dict, regime: str) -> str:
    entity = current.get("entity_key") or current.get("entity_id") or "unknown"
    return (
        f"payment_deterioration:{entity}:{regime}:"
        f"{previous.get('event_key')}:{current.get('event_key')}"
    )


def _trend(previous: dict, current: dict, regime: str) -> dict | None:
    previous_end = _datetime(previous.get("period_end"))
    current_end = _datetime(current.get("period_end"))
    current_start = _datetime((current.get("attributes") or {}).get("period_start"))
    if not previous_end or not current_end or not current_start or current_start <= previous_end:
        return None
    previous_metrics = _report_metrics(previous)
    current_metrics = _report_metrics(current)
    common_metrics = sorted(previous_metrics.keys() & current_metrics.keys())
    changes = {
        metric: current_metrics[metric] - previous_metrics[metric] for metric in common_metrics
    }
    trigger_metrics = [metric for metric in common_metrics if changes[metric] >= 10]
    if not trigger_metrics:
        return None
    event_key = _event_key(previous, current, regime)
    attributes = {
        "reporting_regime": regime,
        "previous_observation_id": previous.get("id"),
        "current_observation_id": current.get("id"),
        "previous_record_id": previous.get("record_id"),
        "current_record_id": current.get("record_id"),
        "previous_event_key": previous.get("event_key"),
        "current_event_key": current.get("event_key"),
        "previous_source_url": previous.get("source_url"),
        "current_source_url": current.get("source_url"),
        "previous_period_end": previous_end.isoformat(),
        "current_period_end": current_end.isoformat(),
        "trigger_metrics": trigger_metrics,
    }
    for metric in common_metrics:
        attributes[f"previous_{metric}"] = previous_metrics[metric]
        attributes[f"current_{metric}"] = current_metrics[metric]
        attributes[f"{metric}_change"] = round(changes[metric], 6)
    metric_text = ", ".join(
        f"{metric} increased by {changes[metric]:g}" for metric in trigger_metrics
    )
    return {
        "id": event_key,
        "record_id": current.get("record_id"),
        "entity_id": current.get("entity_id"),
        "entity_key": current.get("entity_key"),
        "kind": "payment_deterioration",
        "event_key": event_key,
        "headline": "Payment performance deteriorated",
        "detail": f"Comparable successive payment reports show {metric_text}.",
        "state": "verified",
        "occurred_at": current_end.isoformat(),
        "period_end": current_end.isoformat(),
        "published_at": current.get("published_at"),
        "observed_at": current.get("observed_at"),
        "expires_at": current.get("expires_at"),
        "active": True,
        "withdrawn": False,
        "source_id": current.get("source_id"),
        "source_url": current.get("source_url"),
        "evidence_pointer": f"{previous.get('id')} -> {current.get('id')}",
        "attributes": attributes,
    }


def derive_payment_trends(observations: list[dict], as_of: datetime) -> list[dict]:
    """Return threshold-crossing trends from comparable adjacent payment reports."""
    cutoff = _datetime(as_of)
    if cutoff is None:
        raise ValueError("as_of must be a timezone-aware datetime")
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    eligible = [report for report in observations if _eligible_report(report, cutoff)]
    for report in _deduplicate_corrections(eligible):
        attributes = report.get("attributes") or {}
        entity = str(report.get("entity_id") or report.get("entity_key") or "")
        regime = str(attributes.get("reporting_regime") or attributes.get("regime") or "")
        if entity and regime:
            grouped[(entity, regime)].append(report)
    trends = []
    for (_, regime), reports in sorted(grouped.items()):
        ordered = sorted(
            reports,
            key=lambda report: (
                _datetime(report.get("period_end")),
                str(report.get("event_key") or ""),
            ),
        )
        for previous, current in pairwise(ordered):
            trend = _trend(previous, current, regime)
            if trend:
                trends.append(trend)
    return sorted(trends, key=lambda item: (item["occurred_at"], item["event_key"]))
