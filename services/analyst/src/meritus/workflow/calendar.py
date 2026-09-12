"""Calendar rules that keep evidence, forecasts and legal dates distinct."""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime
from typing import Any

_LEGAL_KINDS = {
    "legal_deadline",
    "limitation",
    "limitation_expiry",
    "legal_review",
    "warranty",
    "warranty_expiry",
}
_PRACTICAL_COMPLETION_KINDS = {"practical_completion", "certified_practical_completion"}
_PRECISIONS = {"day", "month", "year", "approximate"}
_STATUSES = {"confirmed", "illustrative", "pending", "provisional", "rejected", "uncertain"}


def _date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date must be an ISO date") from exc
    raise ValueError("date must be an ISO date")


def _add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(
        value.day,
        (date(year + (month == 12), month % 12 + 1, 1) - date.resolution).day,
    )
    return date(year, month, day)


def validate_calendar_entry(data: dict[str, Any]) -> dict[str, Any]:
    """Return a normalised calendar row or raise a specific validation error."""
    required = {"entity_id", "kind", "date"}
    missing = [field for field in sorted(required) if not data.get(field)]
    if missing:
        raise ValueError(f"Missing calendar fields: {', '.join(missing)}")
    result = deepcopy(data)
    result["date"] = _date(data["date"]).isoformat()
    result["kind"] = str(data["kind"]).strip()
    result["title"] = str(data.get("title") or result["kind"].replace("_", " ").title())
    result["precision"] = str(data.get("precision") or "day")
    result["status"] = str(data.get("status") or "pending").casefold()
    if result["precision"] not in _PRECISIONS:
        raise ValueError("Calendar precision must be day, month, year or approximate")
    if result["status"] not in _STATUSES:
        raise ValueError("Calendar status is not recognised")
    result["source_url"] = str(data.get("source_url") or "").strip()
    result["evidence"] = deepcopy(data.get("evidence") or {})
    result["jurisdiction"] = str(data.get("jurisdiction") or "").strip()
    result["basis"] = str(data.get("basis") or "").strip()
    result["reviewer"] = str(data.get("reviewer") or "").strip()

    if result["status"] == "confirmed":
        if (
            not result["source_url"]
            and not result["evidence"]
            and not result.get("source_record_id")
        ):
            raise ValueError("A confirmed calendar date requires source evidence")
        if result["kind"] in _LEGAL_KINDS and not result["basis"]:
            raise ValueError("A confirmed legal or warranty date requires its reviewed basis")
        if result["kind"] in _LEGAL_KINDS and not result["reviewer"]:
            raise ValueError("A confirmed legal or warranty date requires a reviewer")
    if result["kind"] in _LEGAL_KINDS and result["status"] != "confirmed":
        result["status"] = "provisional"
    return result


def actionable_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Exclude provisional and uncertain dates from the actionable calendar."""
    result = []
    for item in entries:
        try:
            validated = validate_calendar_entry(item)
        except (TypeError, ValueError):
            continue
        if validated["status"] == "confirmed":
            result.append(validated)
    return result


def create_calendar_entry(repo, data: dict[str, Any]) -> dict[str, Any]:
    """Validate the workflow rules before using repository persistence."""
    return repo.add_calendar_entry(validate_calendar_entry(data))


def post_completion_timing(entry: dict[str, Any]) -> dict[str, Any]:
    """Describe the 12-to-24 month window only for evidenced practical completion."""
    item = validate_calendar_entry(entry)
    if item["kind"] not in _PRACTICAL_COMPLETION_KINDS or item["status"] != "confirmed":
        raise ValueError("Post-completion timing requires confirmed practical completion")
    completed = _date(item["date"])

    return {
        "basis_kind": item["kind"],
        "basis_date": item["date"],
        "window_start": _add_months(completed, 12).isoformat(),
        "window_end": _add_months(completed, 24).isoformat(),
        "status": "derived_from_confirmed_practical_completion",
    }


def illustrative_accrual_timing(
    accrual_date: str | date | datetime,
    period_years: int,
    *,
    input_basis: str,
    reviewer: str | None = None,
    entity_id: str = "illustrative",
) -> dict[str, Any]:
    """Return a provisional review date from an entered accrual date and selected period."""
    if (
        isinstance(period_years, bool)
        or not isinstance(period_years, int)
        or not 1 <= period_years <= 100
    ):
        raise ValueError("period_years must be a positive whole number no greater than 100")
    basis = str(input_basis or "").strip()
    if not basis:
        raise ValueError("An illustrative accrual calculation requires its input basis")
    entity = str(entity_id or "").strip()
    if not entity:
        raise ValueError("entity_id is required")
    accrued = _date(accrual_date)
    calculated = _add_months(accrued, period_years * 12)
    result = validate_calendar_entry(
        {
            "entity_id": entity,
            "kind": "legal_review",
            "title": "Illustrative accrual-plus-period review date",
            "date": calculated,
            "precision": "day",
            "status": "provisional",
            "basis": basis,
            "reviewer": str(reviewer or "").strip(),
        }
    )
    result.update(
        calculation={
            "basis_date_type": "entered_accrual_date",
            "accrual_date": accrued.isoformat(),
            "selected_period_years": period_years,
            "result_type": "illustrative_review_date",
        },
        legal_conclusion=False,
        review_required=True,
    )
    return result


__all__ = [
    "actionable_entries",
    "create_calendar_entry",
    "illustrative_accrual_timing",
    "post_completion_timing",
    "validate_calendar_entry",
]
