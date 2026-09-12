"""Underlying-event grouping and conservative independence decisions."""

from collections.abc import Iterable


def reviewed_event_key(observation: dict) -> str:
    """Return an explicitly reviewed event override, otherwise the source event key."""
    attributes = observation.get("attributes") or {}
    override = attributes.get("event_group_key") or attributes.get("reviewed_event_key")
    review_reference = attributes.get("event_group_review_reference")
    if override and review_reference:
        return str(override)
    return str(observation.get("event_key") or f"observation:{observation.get('id', '')}")


def group_observations(observations: Iterable[dict]) -> dict[str, list[dict]]:
    """Group reports about the same factual occurrence in stable input order."""
    groups: dict[str, list[dict]] = {}
    for observation in observations:
        groups.setdefault(reviewed_event_key(observation), []).append(observation)
    return groups


def has_reviewed_independence(observation: dict) -> bool:
    attributes = observation.get("attributes") or {}
    return attributes.get("independence_confirmed") is True and bool(
        attributes.get("independence_review_reference")
    )


def independent_event_count(events: Iterable[dict]) -> int:
    """Count events that satisfy the approved record and family independence rule."""
    accepted: list[dict] = []
    ordered = sorted(
        events,
        key=lambda event: (
            has_reviewed_independence(event),
            str(event.get("family") or ""),
            str(event.get("record_id") or ""),
            str(event.get("event_key") or ""),
            str(event.get("id") or ""),
        ),
    )
    for event in ordered:
        reviewed = has_reviewed_independence(event)
        record_id = event.get("record_id")
        repeats_record = bool(record_id) and any(
            accepted_event.get("record_id") == record_id for accepted_event in accepted
        )
        repeats_family = any(
            accepted_event.get("family") == event.get("family") for accepted_event in accepted
        )
        if accepted and (repeats_record or repeats_family) and not reviewed:
            continue
        accepted.append(event)
    return len(accepted)
