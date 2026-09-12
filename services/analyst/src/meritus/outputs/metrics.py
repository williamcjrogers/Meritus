"""Pipeline outcome metrics with explicit cohorts, windows and denominators."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        parsed = datetime.combine(value, datetime.min.time(), tzinfo=UTC)
    elif isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        # Date-only cohort filters use UTC calendar boundaries.
        if isinstance(value, str) and "T" not in value and " " not in value:
            parsed = parsed.replace(tzinfo=UTC)
        else:
            return None
    return parsed.astimezone(UTC)


def _cohort(item: dict[str, Any]) -> Any:
    return item.get("cohort") or (item.get("payload") or {}).get("cohort")


def _filter_boundary(value: Any, *, end: bool = False) -> datetime | None:
    date_only = isinstance(value, date) and not isinstance(value, datetime)
    date_only = date_only or (isinstance(value, str) and "T" not in value and " " not in value)
    if not date_only:
        return _datetime(value)
    try:
        day = value if isinstance(value, date) else date.fromisoformat(value)
    except ValueError:
        return None
    if end:
        day += timedelta(days=1)
    boundary = datetime.combine(day, datetime.min.time(), tzinfo=ZoneInfo("Europe/London"))
    return boundary.astimezone(UTC) - (timedelta(microseconds=1) if end else timedelta())


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 4) if denominator else None


def build_metrics(
    actions: list[dict[str, Any]],
    reviews: list[dict[str, Any]],
    as_of: datetime,
    *,
    cohort: str | None = None,
    date_from: datetime | str | None = None,
    date_to: datetime | str | None = None,
) -> dict[str, Any]:
    """Build distinct-subject funnel counts and both conversation rates."""
    cutoff = _datetime(as_of)
    if cutoff is None:
        raise ValueError("as_of must include a UTC offset")
    start = _filter_boundary(date_from) if date_from else None
    end = _filter_boundary(date_to, end=True) if date_to else cutoff
    if date_from and start is None:
        raise ValueError("date_from must include a UTC offset")
    if date_to and end is None:
        raise ValueError("date_to must include a UTC offset")
    if end > cutoff:
        end = cutoff
    if start and start > end:
        raise ValueError("date_from cannot be after date_to")

    def included_in_cohort(item: dict[str, Any], field: str) -> bool:
        when = _datetime(item.get(field))
        if when is None or when > end or (start and when < start):
            return False
        return cohort is None or _cohort(item) == cohort

    cohort_starts: dict[str, datetime] = {}
    for item in reviews:
        if not included_in_cohort(item, "created_at"):
            continue
        if item.get("target_type") != "entity" or item.get("action") not in {
            "accept",
            "accepted",
            "recommend",
            "shortlist",
            "verified",
        }:
            continue
        entity_id = str(item.get("target_id") or "")
        when = _datetime(item.get("created_at"))
        if entity_id and when and when < cohort_starts.get(entity_id, cutoff):
            cohort_starts[entity_id] = when
    for item in actions:
        if not included_in_cohort(item, "occurred_at") or item.get("stage") not in {
            "review",
            "shortlisted",
        }:
            continue
        entity_id = str(item.get("entity_id") or "")
        when = _datetime(item.get("occurred_at"))
        if entity_id and when and when < cohort_starts.get(entity_id, cutoff):
            cohort_starts[entity_id] = when

    later_actions = []
    for item in actions:
        entity_id = str(item.get("entity_id") or "")
        when = _datetime(item.get("occurred_at"))
        cohort_start = cohort_starts.get(entity_id)
        if cohort_start is not None and when is not None and cohort_start <= when <= cutoff:
            later_actions.append(item)

    reviewed = set(cohort_starts)
    contacted = {
        str(item.get("entity_id"))
        for item in later_actions
        if item.get("stage") in {"contacted", "conversation", "instruction"}
    }
    conversations = {
        str(item.get("entity_id"))
        for item in later_actions
        if item.get("stage") in {"conversation", "instruction"}
    }
    instructions = {
        str(item.get("entity_id")) for item in later_actions if item.get("stage") == "instruction"
    }
    earliest_cohort = min(cohort_starts.values(), default=None)
    observation_span = cutoff - earliest_cohort if earliest_cohort else None
    return {
        "as_of": cutoff.isoformat(),
        "filters": {
            "cohort": cohort,
            "date_from": start.isoformat() if start else None,
            "date_to": end.isoformat(),
            "follow_up_through": cutoff.isoformat(),
            "date_timezone": "Europe/London",
        },
        "denominator_scope": {
            "reviewed_recommendations": "distinct entity recommendations reviewed in scope",
            "contacted_opportunities": "distinct entities reaching contacted or a later stage",
        },
        "denominators": {
            "conversation_rate_reviewed": len(reviewed),
            "conversation_rate_contacted": len(contacted),
        },
        "counts": {
            "reviewed_recommendations": len(reviewed),
            "contacted_opportunities": len(contacted),
            "conversations": len(conversations),
            "instructions": len(instructions),
        },
        "conversation_rate_reviewed": _rate(len(conversations), len(reviewed)),
        "conversation_rate_contacted": _rate(len(conversations), len(contacted)),
        "conversation_rate_from_reviewed": _rate(len(conversations), len(reviewed)),
        "conversation_rate_from_contacted": _rate(len(conversations), len(contacted)),
        "instruction_rate_reviewed": _rate(len(instructions), len(reviewed)),
        "benchmark_assessment": (
            "insufficient_observation_time"
            if observation_span is None or observation_span < timedelta(days=182)
            else "observation_window_available"
        ),
    }


__all__ = ["build_metrics"]
