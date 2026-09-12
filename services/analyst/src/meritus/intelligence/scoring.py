"""Deterministic, pure entity scoring from frozen observation dictionaries."""

from copy import deepcopy
from datetime import UTC, datetime
from math import inf
from typing import Any

from meritus.intelligence.events import group_observations, independent_event_count
from meritus.intelligence.rules import DEFAULT_RULES

_CONTEXT_FAMILY = "context_amplifiers"
_EVIDENCE_ONLY_FAMILY = "evidence_only"
_SCORING_PROCEEDING_ROLES = {
    "bsa_live_proceeding": {"applicant", "respondent"},
    "adjudication_enforcement": {
        "applicant",
        "respondent",
        "claimant",
        "defendant",
        "referring_party",
        "responding_party",
    },
    "construction_decision": {
        "applicant",
        "respondent",
        "claimant",
        "defendant",
        "appellant",
        "employer",
        "contractor",
        "referring_party",
        "responding_party",
    },
}


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


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _context_condition_met(kind: str, observation: dict) -> bool:
    attributes = observation.get("attributes") or {}
    value = observation.get("value")
    unit = str(observation.get("unit") or "").casefold()
    if kind == "contract_value_context":
        value = attributes.get("contract_value_gbp", value)
        if value is None:
            return False
        multiplier = 1_000_000 if unit in {"gbp_million", "gbp million", "£m"} else 1
        return unit in {"gbp", "sterling", "£", "gbp_million", "gbp million", "£m"} and (
            float(value) * multiplier >= 5_000_000
        )
    if kind == "contract_duration_context":
        value = attributes.get("contract_duration_months", value)
        if value is None:
            return False
        multiplier = 12 if unit in {"year", "years"} else 1
        return unit in {"month", "months", "year", "years"} and float(value) * multiplier >= 24
    if kind == "fixed_price_context":
        return value is True or value == 1 or attributes.get("fixed_price") is True
    if kind == "timing_context":
        return attributes.get("active_timing_window") is True
    return True


def _role_exclusion(kind: str, observation: dict) -> str | None:
    scoring_roles = _SCORING_PROCEEDING_ROLES.get(kind)
    if scoring_roles is None:
        return None
    role = str((observation.get("attributes") or {}).get("party_role") or "").casefold()
    if role not in scoring_roles:
        return "subject_role_not_scoring"
    return None


def _exclusion_reason(
    entity: dict,
    observation: dict,
    rule: dict | None,
    as_of: datetime,
) -> tuple[str | None, datetime | None]:
    if rule is None:
        return "unsupported_kind", None
    if not entity.get("verified"):
        return "unverified_subject", None
    state = observation.get("state")
    if state != "verified":
        return f"evidence_{state or 'unreviewed'}", None
    if observation.get("active") is not True:
        return "inactive_record", None
    if observation.get("withdrawn") is True:
        return "withdrawn_record", None
    expiry = _datetime(observation.get("expires_at"))
    if observation.get("expires_at") and expiry is None:
        return "invalid_expires_at", None
    if expiry and expiry <= as_of:
        return "expired_record", None
    for field, missing_reason, future_reason in (
        ("published_at", "missing_published_at", "published_after_cutoff"),
        ("observed_at", "missing_observed_at", "observed_after_cutoff"),
    ):
        value = _datetime(observation.get(field))
        if value is None:
            return missing_reason, None
        if value > as_of:
            return future_reason, None
    event_time = _datetime(observation.get("occurred_at")) or _datetime(
        observation.get("period_end")
    )
    if event_time is None:
        return "missing_event_date", None
    if event_time > as_of:
        return "event_after_cutoff", event_time
    if rule["family"] == _EVIDENCE_ONLY_FAMILY or rule["weight"] == 0:
        return "evidence_only", event_time
    role_reason = _role_exclusion(str(observation.get("kind")), observation)
    if role_reason:
        return role_reason, event_time
    if rule["family"] == _CONTEXT_FAMILY and not _context_condition_met(
        str(observation.get("kind")), observation
    ):
        return "context_condition_not_met", event_time
    return None, event_time


def _contribution(
    entity: dict,
    observation: dict,
    as_of: datetime,
    kinds: dict,
) -> dict:
    kind = str(observation.get("kind") or "")
    rule = kinds.get(kind)
    reason, event_time = _exclusion_reason(entity, observation, rule, as_of)
    base_weight = float(rule["weight"]) if rule else 0.0
    family = rule["family"] if rule else None
    age_days = (as_of - event_time).total_seconds() / 86400 if event_time else None
    half_life = rule.get("half_life_days") if rule else None
    decay = 1.0
    if age_days is not None and half_life:
        decay = 2 ** (-age_days / half_life)
    raw_points = base_weight * decay if reason is None else 0.0
    return {
        "observation_id": observation.get("id"),
        "record_id": observation.get("record_id"),
        "event_key": observation.get("event_key"),
        "event_group_key": None,
        "family": family,
        "kind": kind,
        "base_weight": base_weight,
        "event_at": _iso(event_time),
        "published_at": _iso(_datetime(observation.get("published_at"))),
        "observed_at": _iso(_datetime(observation.get("observed_at"))),
        "age_days": round(age_days, 1) if age_days is not None else None,
        "decay": round(decay, 6) if reason is None else 0.0,
        "points": round(raw_points, 1),
        "applied_points": 0.0,
        "cap_reduction": 0.0,
        "evidence_url": observation.get("source_url"),
        "source_id": observation.get("source_id"),
        "exclusion_reason": reason,
        "qualifies": bool(rule and rule.get("qualifies")),
        "substantive": bool(rule and (rule.get("substantive") or rule.get("live_dispute"))),
        "attributes": observation.get("attributes") or {},
        "_raw_points": raw_points,
        "_age_days": age_days,
        "_event_time": event_time,
    }


def _apply_event_deduplication(contributions: list[dict]) -> list[int]:
    eligible_indices = [
        index
        for index, contribution in enumerate(contributions)
        if not contribution["exclusion_reason"]
    ]
    observations = [
        {
            "id": contributions[index]["observation_id"],
            "event_key": contributions[index]["event_key"],
            "attributes": contributions[index]["attributes"],
            "_index": index,
        }
        for index in eligible_indices
    ]
    selected: list[int] = []
    for group_key, group in group_observations(observations).items():
        indices = [item["_index"] for item in group]
        winner = min(
            indices,
            key=lambda index: (
                -contributions[index]["_raw_points"],
                str(contributions[index]["observation_id"] or ""),
            ),
        )
        selected.append(winner)
        for index in indices:
            contributions[index]["event_group_key"] = group_key
            if index != winner:
                contributions[index]["exclusion_reason"] = (
                    f"duplicate_event: selected observation "
                    f"{contributions[winner]['observation_id']}"
                )
    return selected


def _apply_caps(contributions: list[dict], selected: list[int], rules: dict) -> float:
    family_cap = float(rules["family_cap"])
    context_cap = float(rules["context_cap"])
    total_cap = float(rules["total_cap"])
    family_remaining: dict[str, float] = {}
    family_applied: dict[int, float] = {}
    ordered = sorted(
        selected,
        key=lambda index: (
            -contributions[index]["_raw_points"],
            str(contributions[index]["event_group_key"]),
        ),
    )
    for index in ordered:
        contribution = contributions[index]
        family = contribution["family"]
        cap = context_cap if family == _CONTEXT_FAMILY else family_cap
        remaining = family_remaining.setdefault(family, cap)
        applied = min(contribution["_raw_points"], remaining)
        family_applied[index] = applied
        family_remaining[family] = remaining - applied

    total_remaining = total_cap
    for index in ordered:
        applied = min(family_applied[index], total_remaining)
        total_remaining -= applied
        contribution = contributions[index]
        contribution["applied_points"] = round(applied, 1)
        contribution["cap_reduction"] = round(contribution["_raw_points"] - applied, 1)
    return min(sum(family_applied.values()), total_cap)


def _public_contribution(contribution: dict) -> dict:
    return {key: value for key, value in contribution.items() if not key.startswith("_")}


def _belongs_to(entity: dict, observation: dict) -> bool:
    if observation.get("entity_id") is not None:
        return observation.get("entity_id") == entity.get("id")
    return bool(observation.get("entity_key")) and (
        observation.get("entity_key") == entity.get("key")
    )


def _score_entity(entity: dict, observations: list[dict], as_of: datetime, rules: dict) -> dict:
    contributions = [
        _contribution(entity, observation, as_of, rules["kinds"])
        for observation in observations
        if _belongs_to(entity, observation)
    ]
    selected = _apply_event_deduplication(contributions)
    raw_score = _apply_caps(contributions, selected, rules)
    independence_window = float(rules["independence_window_days"])
    qualifying_events = []
    has_substantive = False
    latest_time: datetime | None = None
    source_ids: set[str] = set()
    for index, contribution in enumerate(contributions):
        is_eligible_evidence = contribution["exclusion_reason"] is None or str(
            contribution["exclusion_reason"]
        ).startswith("duplicate_event:")
        if is_eligible_evidence:
            event_time = contribution["_event_time"]
            latest_time = max(latest_time or event_time, event_time)
            if contribution["source_id"]:
                source_ids.add(str(contribution["source_id"]))
        if index not in selected:
            continue
        if (
            contribution["qualifies"]
            and contribution["_age_days"] is not None
            and contribution["_age_days"] <= independence_window
        ):
            qualifying_events.append(
                {
                    "record_id": contribution["record_id"],
                    "event_key": contribution["event_group_key"],
                    "family": contribution["family"],
                    "attributes": contribution["attributes"],
                }
            )
            has_substantive = has_substantive or contribution["substantive"]
    independent_events = independent_event_count(qualifying_events)
    threshold = float(rules["recommendation_threshold"])
    eligible = bool(
        entity.get("verified")
        and raw_score >= threshold
        and independent_events >= 2
        and has_substantive
    )
    gaps: list[str] = []
    if not entity.get("verified"):
        gaps.append("subject_identity_unconfirmed")
    if raw_score < threshold:
        gaps.append("score_below_recommendation_threshold")
    if independent_events < 2:
        gaps.append("fewer_than_two_independent_recent_events")
    if not has_substantive:
        gaps.append("no_recent_substantive_adverse_or_live_dispute_event")
    reasons = [
        (
            f"{contribution['kind']} contributed "
            f"{contribution['applied_points']:.1f} points from {contribution['event_group_key']}"
        )
        for index, contribution in enumerate(contributions)
        if index in selected and contribution["applied_points"] > 0
    ]
    return {
        "entity_id": entity.get("id"),
        "key": entity.get("key"),
        "name": entity.get("name"),
        "kind": entity.get("kind"),
        "score": round(raw_score, 1),
        "eligible": eligible,
        "independent_events": independent_events,
        "reasons": reasons,
        "contributions": [_public_contribution(item) for item in contributions],
        "latest_evidence_at": _iso(latest_time),
        "source_ids": sorted(source_ids),
        "gaps": gaps,
    }


def score_entities(
    entities: list[dict],
    observations: list[dict],
    as_of: datetime,
    rules: dict | None = None,
) -> list[dict]:
    """Score entities at a frozen knowledge cut-off without external state."""
    cutoff = _datetime(as_of)
    if cutoff is None:
        raise ValueError("as_of must be a timezone-aware datetime")
    active_rules = deepcopy(rules or DEFAULT_RULES)
    rows = [_score_entity(entity, observations, cutoff, active_rules) for entity in entities]
    return sorted(
        rows,
        key=lambda row: (
            -row["score"],
            -(
                _datetime(row["latest_evidence_at"]).timestamp()
                if row["latest_evidence_at"]
                else -inf
            ),
            str(row["key"] or ""),
        ),
    )
