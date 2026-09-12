"""Audited analyst decisions for evidence and identity matches."""

from typing import Any

from meritus.db import session_scope, utc_now
from meritus.models import Review
from meritus.repository.evidence import model_dict


def _decision_text(value: str, field: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field} is required")
    return text


def accept_observation(repo, observation_id: str, reason: str, actor: str) -> dict[str, Any]:
    return repo.record_review(
        "observation",
        _decision_text(observation_id, "observation_id"),
        "verified",
        _decision_text(reason, "reason"),
        _decision_text(actor, "actor"),
    )


def reject_observation(repo, observation_id: str, reason: str, actor: str) -> dict[str, Any]:
    return repo.record_review(
        "observation",
        _decision_text(observation_id, "observation_id"),
        "rejected",
        _decision_text(reason, "reason"),
        _decision_text(actor, "actor"),
    )


def review_observation(
    repo, observation_id: str, action: str, reason: str, actor: str
) -> dict[str, Any]:
    action = str(action or "").strip().casefold()
    if action in {"accept", "accepted", "verify", "verified"}:
        return accept_observation(repo, observation_id, reason, actor)
    if action in {"reject", "rejected"}:
        return reject_observation(repo, observation_id, reason, actor)
    raise ValueError("Observation review action must accept or reject")


def merge_entities(
    repo,
    candidate_entity_id: str,
    into_entity_id: str,
    reason: str,
    actor: str,
) -> dict[str, Any]:
    """Approve an identity match through the repository's audited merge operation."""
    return repo.record_review(
        "entity",
        _decision_text(candidate_entity_id, "candidate_entity_id"),
        "merge",
        _decision_text(reason, "reason"),
        _decision_text(actor, "actor"),
        {"into_entity_id": _decision_text(into_entity_id, "into_entity_id")},
    )


def reject_identity_match(
    repo,
    candidate_entity_id: str,
    proposed_entity_id: str,
    reason: str,
    actor: str,
) -> dict[str, Any]:
    """Record a rejected alias proposal without changing either canonical entity."""
    candidate_id = _decision_text(candidate_entity_id, "candidate_entity_id")
    proposed_id = _decision_text(proposed_entity_id, "proposed_entity_id")
    repo.get_entity(candidate_id)
    repo.get_entity(proposed_id)
    with session_scope(repo.engine) as session:
        decision = Review(
            target_type="identity_match",
            target_id=candidate_id,
            action="rejected",
            actor=_decision_text(actor, "actor"),
            reason=_decision_text(reason, "reason"),
            payload={"proposed_entity_id": proposed_id},
            created_at=utc_now(),
        )
        session.add(decision)
        session.flush()
        return model_dict(decision)


def review_identity_match(
    repo,
    candidate_entity_id: str,
    proposed_entity_id: str,
    action: str,
    reason: str,
    actor: str,
) -> dict[str, Any]:
    action = str(action or "").strip().casefold()
    if action in {"accept", "accepted", "merge"}:
        return merge_entities(repo, candidate_entity_id, proposed_entity_id, reason, actor)
    if action in {"reject", "rejected"}:
        return reject_identity_match(repo, candidate_entity_id, proposed_entity_id, reason, actor)
    raise ValueError("Identity-match review action must accept or reject")


__all__ = [
    "accept_observation",
    "merge_entities",
    "reject_identity_match",
    "reject_observation",
    "review_identity_match",
    "review_observation",
]
