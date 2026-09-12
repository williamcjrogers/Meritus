"""Safe CSV and printable HTML renderers tied to frozen snapshot payloads."""

from __future__ import annotations

import csv
import html
import io
import json
from copy import deepcopy
from datetime import UTC, datetime
from math import isfinite
from typing import Any

from meritus.intelligence.events import independent_event_count

_FIELDS = (
    "rank",
    "subject",
    "name",
    "kind",
    "score",
    "eligible",
    "independent_events",
    "sector",
    "geography",
    "lead_time_band",
    "reviewer",
    "review_state",
    "pipeline_stage",
    "change_since_previous",
    "suggested_review_route",
    "latest_evidence_at",
    "reasons",
    "evidence_links",
    "source_ids",
    "gaps",
    "permitted_retention_conditions",
    "permitted_distribution_conditions",
)
_RESTRICTED_BY_DEFAULT = {
    "hmcts",
    "find_case_law",
    "rns",
    "adzuna",
    "construction_index",
}


def _export_allowed(source_id: str, policy: dict[str, Any]) -> bool:
    if source_id in policy:
        return policy[source_id] is True
    return source_id not in _RESTRICTED_BY_DEFAULT


def _payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    payload = snapshot.get("payload") or {}
    if not isinstance(payload, dict):
        raise ValueError("Snapshot payload must be an object")
    return payload


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
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(UTC)


# Legacy snapshots of this exact release predate embedded parameters. Keep
# these values fixed when a future release changes the active scoring rules.
_LEGACY_RULES = {
    "meritus-v1": {
        "recommendation_threshold": 40.0,
        "independence_window_days": 180,
        "family_cap": 45.0,
        "context_cap": 10.0,
        "total_cap": 100.0,
    }
}


def _frozen_rules(payload):
    rules = payload.get("applied_rules")
    if rules is None:
        rules = _LEGACY_RULES.get(payload.get("rule_version") or "meritus-v1")
    if not isinstance(rules, dict):
        raise ValueError("Snapshot scoring rules are unavailable; cannot recalculate export")
    required = _LEGACY_RULES["meritus-v1"].keys()
    if any(
        not isinstance(rules.get(key), (int, float))
        or isinstance(rules.get(key), bool)
        or not isfinite(rules[key])
        or rules[key] <= 0
        for key in required
    ):
        raise ValueError("Snapshot scoring parameters are invalid")
    return rules


def _recent(contribution: dict[str, Any], payload: dict[str, Any], rules) -> bool:
    cutoff = _datetime(payload.get("knowledge_cutoff") or payload.get("as_of"))
    event_at = _datetime(contribution.get("event_at"))
    if cutoff and event_at:
        return (cutoff - event_at).total_seconds() / 86400 <= float(
            rules["independence_window_days"]
        )
    age_days = contribution.get("age_days")
    return age_days is not None and float(age_days) <= float(rules["independence_window_days"])


def _recomputed_points(
    contributions: list[dict[str, Any]], rules
) -> tuple[float, dict[int, float]]:
    # Re-select event winners after the rights filter. A permitted duplicate may
    # have lost to a source which can no longer appear in this export.
    groups: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for index, contribution in enumerate(contributions):
        reason = contribution.get("exclusion_reason")
        if reason is not None and not str(reason).startswith("duplicate_event:"):
            continue
        key = str(
            contribution.get("event_group_key")
            or contribution.get("event_key")
            or f"observation:{contribution.get('observation_id', index)}"
        )
        groups.setdefault(key, []).append((index, contribution))
    candidates = []
    for group in groups.values():
        winner = min(
            group,
            key=lambda pair: (
                -float(pair[1].get("points") or pair[1].get("applied_points") or 0),
                str(pair[1].get("observation_id") or ""),
            ),
        )
        candidates.append(winner)
        for index, contribution in group:
            contribution["exclusion_reason"] = (
                None
                if index == winner[0]
                else (f"duplicate_event: selected observation {winner[1].get('observation_id')}")
            )
    candidates.sort(
        key=lambda pair: (
            -float(pair[1].get("points") or pair[1].get("applied_points") or 0),
            str(pair[1].get("event_group_key") or ""),
        )
    )
    remaining_by_family: dict[str, float] = {}
    applied: dict[int, float] = {}
    for index, contribution in candidates:
        family = str(contribution.get("family") or "")
        cap = float(rules["context_cap"] if family == "context_amplifiers" else rules["family_cap"])
        remaining = remaining_by_family.setdefault(family, cap)
        points = float(contribution.get("points") or contribution.get("applied_points") or 0)
        applied[index] = min(points, remaining)
        remaining_by_family[family] = max(remaining - points, 0)
    total_remaining = float(rules["total_cap"])
    for index in list(applied):
        value = min(applied[index], total_remaining)
        applied[index] = value
        total_remaining -= value
    return min(sum(applied.values()), float(rules["total_cap"])), applied


def _recompute_evidence_fields(
    item: dict[str, Any], contributions: list[dict[str, Any]], payload: dict[str, Any]
) -> None:
    rules = _frozen_rules(payload)
    score, applied = _recomputed_points(contributions, rules)
    qualifying = [
        contribution
        for contribution in contributions
        if contribution.get("exclusion_reason") is None
        and contribution.get("qualifies") is True
        and _recent(contribution, payload, rules)
    ]
    independent_events = independent_event_count(
        {
            "record_id": contribution.get("record_id"),
            "event_key": contribution.get("event_group_key") or contribution.get("event_key"),
            "family": contribution.get("family"),
            "attributes": contribution.get("attributes") or {},
        }
        for contribution in qualifying
    )
    has_substantive = any(contribution.get("substantive") is True for contribution in qualifying)
    evidence_dates = [
        _datetime(contribution.get("event_at"))
        for contribution in contributions
        if contribution.get("exclusion_reason") is None
        or str(contribution.get("exclusion_reason")).startswith("duplicate_event:")
    ]
    latest = max((value for value in evidence_dates if value), default=None)
    threshold = float(rules["recommendation_threshold"])
    item["score"] = round(score, 1)
    item["independent_events"] = independent_events
    item["latest_evidence_at"] = latest.isoformat() if latest else None
    item["change_since_previous"] = None
    item["eligible"] = (
        score >= threshold
        and independent_events >= 2
        and has_substantive
        and "subject_identity_unconfirmed" not in (item.get("gaps") or [])
    )
    item["reasons"] = [
        (
            f"{contribution.get('kind')} contributed {applied[index]:.1f} "
            f"points from {contribution.get('event_group_key')}"
        )
        for index, contribution in enumerate(contributions)
        if applied.get(index, 0) > 0
    ]
    gate_gaps = {
        "score_below_recommendation_threshold",
        "fewer_than_two_independent_recent_events",
        "no_recent_substantive_adverse_or_live_dispute_event",
    }
    gaps = set(item.get("gaps") or []) - gate_gaps
    gaps.add("restricted_evidence_omitted")
    if score < threshold:
        gaps.add("score_below_recommendation_threshold")
    if independent_events < 2:
        gaps.add("fewer_than_two_independent_recent_events")
    if not has_substantive:
        gaps.add("no_recent_substantive_adverse_or_live_dispute_event")
    item["gaps"] = sorted(gaps)


def _permitted_items(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    payload = {**_payload(snapshot)}
    payload.setdefault("rule_version", snapshot.get("rule_version"))
    items = payload.get("items", payload.get("rankings", []))
    if not isinstance(items, list):
        raise ValueError("Snapshot items must be a list")
    export_policy = payload.get("export_policy") or {}
    permitted: list[dict[str, Any]] = []
    for rank, original in enumerate(items, start=1):
        item = deepcopy(original)
        original_sources = set(item.get("source_ids") or [])
        allowed_sources = {
            source_id for source_id in original_sources if _export_allowed(source_id, export_policy)
        }
        if original_sources and not allowed_sources:
            continue
        original_contributions = item.get("contributions") or []
        contributions = []
        for contribution in original_contributions:
            source_id = contribution.get("source_id")
            if source_id and (
                contribution.get("export_permitted") is False
                or not _export_allowed(source_id, export_policy)
            ):
                continue
            contributions.append(contribution)
        if original_contributions and not contributions:
            continue
        mixed_rights = allowed_sources != original_sources or len(contributions) != len(
            original_contributions
        )
        if mixed_rights and not original_contributions:
            continue
        item["contributions"] = contributions
        item["source_ids"] = sorted(
            {
                contribution.get("source_id")
                for contribution in contributions
                if contribution.get("source_id")
            }
            or {
                source_id
                for source_id in item.get("source_ids") or []
                if _export_allowed(source_id, export_policy)
            }
        )
        item["evidence_links"] = sorted(
            {
                contribution.get("evidence_url")
                for contribution in contributions
                if contribution.get("evidence_url")
            }
        )
        if mixed_rights:
            _recompute_evidence_fields(item, contributions, payload)
        item["rank"] = original.get("rank", rank)
        item["subject"] = original.get("subject") or original.get("name")
        permitted.append(item)
    for rank, item in enumerate(permitted, start=1):
        item["rank"] = rank
    return permitted


def _cell(value: Any) -> str:
    if value is None:
        text = ""
    elif isinstance(value, bool):
        text = "true" if value else "false"
    elif isinstance(value, (dict, list, tuple)):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    else:
        text = str(value)
    if text.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def _conditions_from_grant(grant: dict[str, Any], label: str) -> tuple[list[str], list[str]]:
    if not isinstance(grant, dict):
        return [], []
    retention = []
    distribution = []
    retention_days = grant.get("retention_days")
    if (
        isinstance(retention_days, int)
        and not isinstance(retention_days, bool)
        and retention_days > 0
    ):
        retention.append(f"{label}: retain for up to {retention_days} days")
    for key, description in (
        ("content_expires_at", "content expires"),
        ("expires_at", "permission expires"),
    ):
        if value := grant.get(key):
            retention.append(f"{label}: {description} {value}")
    if condition := grant.get("retention_conditions"):
        retention.append(f"{label}: {condition}")
    if grant.get("retain_after_permission_expiry") is True:
        retention.append(f"{label}: retention is permitted after permission expiry")
    if scope := grant.get("scope"):
        distribution.append(f"{label} scope: {scope}")
    for key in ("distribution_conditions", "redistribution_conditions", "attribution"):
        if condition := grant.get(key):
            distribution.append(f"{label}: {condition}")
    operations = grant.get("operations")
    if isinstance(operations, list):
        permitted = sorted(
            {str(operation).strip() for operation in operations if str(operation).strip()}
        )
        if permitted:
            distribution.append(f"{label} permitted operations: {', '.join(permitted)}")
    return retention, distribution


def _condition_context(snapshot: dict[str, Any]) -> dict[str, Any]:
    payload = _payload(snapshot)
    records_by_id: dict[str, dict[str, Any]] = {}
    records_by_source: dict[str, list[dict[str, Any]]] = {}
    for record in payload.get("source_records") or []:
        if not isinstance(record, dict):
            continue
        source_id = record.get("source_id")
        if source_id:
            records_by_source.setdefault(str(source_id), []).append(record)
        if record.get("id"):
            records_by_id[str(record["id"])] = record
    return {
        "records_by_id": records_by_id,
        "records_by_source": records_by_source,
        "saved_permissions": payload.get("source_permissions") or {},
        "current_permissions": (
            snapshot.get("current_permissions")
            or payload.get("current_permissions")
            or snapshot.get("current_source_permissions")
            or payload.get("current_source_permissions")
            or {}
        ),
    }


def export_conditions(
    snapshot: dict[str, Any],
    items: list[dict[str, Any]] | None = None,
    *,
    _context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Describe only the retention and distribution terms of permitted export evidence."""
    permitted = _permitted_items(snapshot) if items is None else items
    context = _context or _condition_context(snapshot)
    source_ids = sorted(
        {
            str(source_id)
            for item in permitted
            for source_id in item.get("source_ids") or []
            if source_id
        }
    )
    used_record_ids = {
        str(contribution.get("record_id"))
        for item in permitted
        for contribution in item.get("contributions") or []
        if contribution.get("record_id")
    }
    records_by_id = context["records_by_id"]
    records_by_source = context["records_by_source"]
    saved_permissions = context["saved_permissions"]
    current_permissions = context["current_permissions"]
    sources = []
    for source_id in source_ids:
        retention = []
        distribution = []
        for grant, label in (
            (saved_permissions.get(source_id), "snapshot source permission"),
            (current_permissions.get(source_id), "current source permission"),
        ):
            grant_retention, grant_distribution = _conditions_from_grant(grant, label)
            retention.extend(grant_retention)
            distribution.extend(grant_distribution)
        if used_record_ids:
            source_records = [
                records_by_id[record_id]
                for record_id in sorted(used_record_ids)
                if record_id in records_by_id
                and records_by_id[record_id].get("source_id") == source_id
            ]
        else:
            source_records = records_by_source.get(source_id, [])
        for record in source_records:
            record_label = f"frozen record {record.get('id')}"
            if expires_at := record.get("expires_at"):
                retention.append(f"{record_label}: content expires {expires_at}")
            grant_retention, grant_distribution = _conditions_from_grant(
                record.get("import_permission") or {}, record_label
            )
            retention.extend(grant_retention)
            distribution.extend(grant_distribution)
        sources.append(
            {
                "source_id": source_id,
                "record_ids": sorted(
                    str(record.get("id")) for record in source_records if record.get("id")
                ),
                "retention_conditions": list(dict.fromkeys(retention)),
                "distribution_conditions": list(dict.fromkeys(distribution)),
            }
        )
    retention_conditions = [
        f"{source['source_id']}: {condition}"
        for source in sources
        for condition in source["retention_conditions"]
    ] or ["No explicit retention condition is recorded in the permitted snapshot metadata."]
    distribution_conditions = [
        f"{source['source_id']}: {condition}"
        for source in sources
        for condition in source["distribution_conditions"]
    ] or [
        "No external distribution is authorised automatically; check current source terms "
        "before sharing."
    ]
    return {
        "retention_conditions": retention_conditions,
        "distribution_conditions": distribution_conditions,
        "sources": sources,
    }


def _report_row(item: dict[str, Any], conditions: dict[str, Any]) -> dict[str, str]:
    values = {
        **item,
        "permitted_retention_conditions": conditions["retention_conditions"],
        "permitted_distribution_conditions": conditions["distribution_conditions"],
    }
    return {field: _cell(values.get(field)) for field in _FIELDS}


def render_csv(snapshot: dict[str, Any]) -> str:
    """Render exactly the frozen ranking, neutralising spreadsheet formulas."""
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=_FIELDS, lineterminator="\n")
    writer.writeheader()
    context = _condition_context(snapshot)
    for item in _permitted_items(snapshot):
        writer.writerow(_report_row(item, export_conditions(snapshot, [item], _context=context)))
    return output.getvalue()


def render_html(snapshot: dict[str, Any]) -> str:
    """Render an escaped, printable report with methodology and scope."""
    payload = _payload(snapshot)
    items = _permitted_items(snapshot)
    conditions = export_conditions(snapshot, items, _context=_condition_context(snapshot))
    as_of = snapshot.get("as_of") or payload.get("as_of") or payload.get("cutoff") or "unknown"
    rule_version = snapshot.get("rule_version") or payload.get("rule_version") or "unknown"
    coverage = payload.get("coverage") or {}
    incomplete = coverage.get("complete") is not True
    rows = []
    for item in items:
        cells = "".join(f"<td>{html.escape(_cell(item.get(field)))}</td>" for field in _FIELDS)
        rows.append(f"<tr>{cells}</tr>")
    headings = "".join(
        f"<th>{html.escape(field.replace('_', ' ').title())}</th>" for field in _FIELDS
    )
    scope = (
        "Coverage is incomplete; rankings describe collected evidence only."
        if incomplete
        else "Coverage reflects the sources and records frozen in this snapshot."
    )
    kind = snapshot.get("kind") or payload.get("kind") or "weekly"
    report_title = "Meritus fortnightly digest" if kind == "digest" else "Meritus weekly watchlist"
    condition_section = (
        "<h2>Permitted retention and distribution</h2>"
        "<h3>Retention conditions</h3><ul>"
        + "".join(
            f"<li>{html.escape(condition)}</li>" for condition in conditions["retention_conditions"]
        )
        + "</ul><h3>Distribution conditions</h3><ul>"
        + "".join(
            f"<li>{html.escape(condition)}</li>"
            for condition in conditions["distribution_conditions"]
        )
        + "</ul>"
    )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>{html.escape(report_title)}</title>"
        "<style>body{font-family:system-ui,sans-serif;margin:2rem}"
        "table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{border:1px solid #bbb;"
        "padding:.4rem;text-align:left;vertical-align:top}th{background:#eee}</style></head><body>"
        f"<h1>{html.escape(report_title)}</h1>"
        f"<p>Knowledge cutoff: {html.escape(str(as_of))}. Rule version: "
        f"{html.escape(str(rule_version))}.</p><p>{html.escape(scope)}</p>"
        "<p>Scores are explainable review priorities, not probabilities, findings of wrongdoing "
        "or legal conclusions. Restricted source text is omitted.</p>"
        f"{condition_section}"
        f"<table><thead><tr>{headings}</tr></thead><tbody>{''.join(rows)}</tbody></table>"
        "</body></html>"
    )


__all__ = ["export_conditions", "render_csv", "render_html"]
