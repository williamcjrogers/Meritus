"""Source-backed index series with category/window provenance and suppression."""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any

_INDEX_KINDS = {"gateway_metric", "adjudication_metric"}


def build_indices(observations: list[dict[str, Any]]) -> dict[str, Any]:
    latest: dict[tuple[Any, ...], dict[str, Any]] = {}
    for item in observations:
        if item.get("kind") not in _INDEX_KINDS:
            continue
        attributes = item.get("attributes") or {}
        category = attributes.get("category") or attributes.get("metric")
        window = (
            attributes.get("window")
            or attributes.get("period")
            or item.get("period_end")
            or item.get("occurred_at")
        )
        source_id = item.get("source_id")
        unit = item.get("unit")
        if not all((source_id, category, window)):
            continue
        if not unit and attributes.get("suppressed") is not True:
            continue
        key = (item.get("kind"), source_id, category, window, unit, item.get("entity_id"))
        current = latest.get(key)
        if current is None or int(item.get("revision") or 0) > int(current.get("revision") or 0):
            latest[key] = item

    grouped: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    suppressed = []
    for item in latest.values():
        attributes = item.get("attributes") or {}
        if item.get("active") is False or item.get("withdrawn") is True:
            continue
        if attributes.get("suppressed") is True:
            suppressed.append(
                {
                    "source_id": str(item["source_id"]),
                    "kind": str(item["kind"]),
                    "category": str(attributes.get("category") or attributes.get("metric")),
                    "window": str(
                        attributes.get("window")
                        or attributes.get("period")
                        or item.get("period_end")
                        or item.get("occurred_at")
                    ),
                    "unit": str(item["unit"]) if item.get("unit") else None,
                    "reason": str(attributes.get("suppression_reason") or "suppressed"),
                    "record_id": item.get("record_id"),
                    "observation_id": item.get("id"),
                    "revision": item.get("revision"),
                }
            )
            continue
        category = str(attributes.get("category") or attributes.get("metric"))
        window = str(
            attributes.get("window")
            or attributes.get("period")
            or item.get("period_end")
            or item.get("occurred_at")
        )
        grouped[(str(item["kind"]), str(item["source_id"]), category, str(item["unit"]))].append(
            {
                "window": window,
                "period_start": attributes.get("period_start"),
                "period_end": item.get("period_end"),
                "value": item.get("value"),
                "published_at": item.get("published_at"),
                "observed_at": item.get("observed_at"),
                "source_url": item.get("source_url"),
                "record_id": item.get("record_id"),
                "observation_id": item.get("id"),
                "revision": item.get("revision"),
            }
        )
    series = []
    coverage = []
    for (kind, source_id, category, unit), points in sorted(grouped.items()):
        points.sort(key=lambda point: (str(point["window"]), str(point["observation_id"])))
        series.append(
            {
                "source_id": source_id,
                "kind": kind,
                "category": category,
                "unit": unit,
                "scope": "observed_published_activity"
                if kind == "adjudication_metric"
                else "published_gateway_measure",
                "points": deepcopy(points),
            }
        )
        coverage.append(
            {
                "source_id": source_id,
                "kind": kind,
                "category": category,
                "unit": unit,
                "windows": [point["window"] for point in points],
                "first_window": points[0]["window"],
                "last_window": points[-1]["window"],
                "point_count": len(points),
            }
        )
    return {
        "series": series,
        "coverage": coverage,
        "suppressed_points": len(suppressed),
        "suppressed": sorted(
            suppressed,
            key=lambda item: (
                item["source_id"],
                item["kind"],
                item["category"],
                item["window"],
                str(item["observation_id"]),
            ),
        ),
        "methodology": (
            "Series show source-backed published measures within the listed windows. "
            "Adjudication listings and judgments describe observed publication activity, "
            "not total national adjudications. Missing windows remain missing."
        ),
    }


__all__ = ["build_indices"]
