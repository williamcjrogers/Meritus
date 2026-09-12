"""Pure, source-backed commercial exposure and relationship review prompts."""

from __future__ import annotations

from datetime import UTC, datetime
from itertools import combinations
from typing import Any

_INSOLVENCY_KINDS = {"insolvency_event", "insolvency_petition"}
_PROFESSIONAL_ROLES = {
    "adviser",
    "barrister",
    "counsel",
    "expert",
    "funder",
    "introduction_route",
    "practitioner",
    "solicitor",
}


def _entities(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(item.get("id")): item for item in items if item.get("id")}


def _brief(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "key": item.get("key"),
        "name": item.get("name"),
        "kind": item.get("kind"),
    }


def _record_id(item: dict[str, Any]) -> str:
    return str(item.get("record_id") or item.get("source_record_id") or "").strip()


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


def _observation_lineage(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "observation_id": item.get("id") or item.get("observation_id"),
        "record_id": _record_id(item),
        "source_id": item.get("source_id"),
        "source_url": item.get("source_url"),
    }


def _relationship_lineage(item: dict[str, Any]) -> dict[str, Any]:
    attributes = item.get("attributes") or {}
    return {
        "relationship_id": item.get("id") or item.get("relationship_id"),
        "record_id": _record_id(item),
        "source_id": item.get("source_id"),
        "source_url": item.get("source_url"),
        "evidence_pointer": item.get("evidence_pointer"),
        "evidence_mode": attributes.get("evidence_mode"),
        "human_basis": attributes.get("human_basis"),
        "valid_from": item.get("valid_from"),
        "valid_to": item.get("valid_to"),
    }


def _has_relationship_lineage(item: dict[str, Any]) -> bool:
    if _record_id(item):
        return True
    attributes = item.get("attributes") or {}
    return (
        attributes.get("evidence_mode") == "human"
        and bool(str(attributes.get("human_basis") or "").strip())
        and bool(str(item.get("evidence_pointer") or "").strip())
        and _datetime(item.get("valid_from")) is not None
    )


def project_exposures(
    entities: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    relationships: list[dict[str, Any]],
    *,
    result_limit: int | None = None,
) -> list[dict[str, Any]]:
    """Link supplier insolvency to a documented project role without transferring distress."""
    by_id = _entities(entities)
    insolvencies: dict[str, list[dict[str, Any]]] = {}
    for observation in observations:
        entity_id = str(observation.get("entity_id") or "")
        if (
            observation.get("kind") in _INSOLVENCY_KINDS
            and observation.get("state") == "verified"
            and _record_id(observation)
            and _datetime(observation.get("occurred_at")) is not None
            and entity_id in by_id
        ):
            insolvencies.setdefault(entity_id, []).append(observation)

    results = []
    for relationship in relationships:
        supplier_id = str(relationship.get("from_entity_id") or "")
        project_id = str(relationship.get("to_entity_id") or "")
        project = by_id.get(project_id)
        supplier = by_id.get(supplier_id)
        if (
            relationship.get("role") != "supplier"
            or relationship.get("state") != "verified"
            or not _record_id(relationship)
            or _datetime(relationship.get("valid_from")) is None
            or project is None
            or project.get("kind") != "project"
            or project.get("verified") is not True
            or supplier is None
            or supplier.get("verified") is not True
        ):
            continue
        for observation in insolvencies.get(supplier_id, []):
            event_at = _datetime(observation.get("occurred_at"))
            valid_from = _datetime(relationship.get("valid_from"))
            valid_to = _datetime(relationship.get("valid_to"))
            assert event_at is not None and valid_from is not None
            attributes = relationship.get("attributes") or {}
            if valid_from > event_at:
                continue
            if (
                valid_to
                and valid_to < event_at
                and not str(attributes.get("past_contract_exposure_basis") or "").strip()
            ):
                continue
            results.append(
                {
                    "kind": "possible_commercial_exposure",
                    "supplier": _brief(supplier),
                    "project": _brief(project),
                    "relationship_id": relationship.get("id"),
                    "relationship_role": "supplier",
                    "contract_id": attributes.get("contract_id"),
                    "past_contract_exposure_basis": attributes.get("past_contract_exposure_basis"),
                    "status": "review_required",
                    "commercial_relevance": (
                        "A verified supplier insolvency is linked to a documented project or "
                        "contract role; review the possible commercial consequences."
                    ),
                    "no_main_contractor_attribution": True,
                    "lineage": {
                        "insolvency": _observation_lineage(observation),
                        "project_role": _relationship_lineage(relationship),
                    },
                }
            )
            if result_limit is not None and len(results) >= result_limit:
                break
        if result_limit is not None and len(results) >= result_limit:
            break
    return sorted(
        results,
        key=lambda item: (
            str(item["project"].get("name") or ""),
            str(item["supplier"].get("name") or ""),
            str(item["lineage"]["insolvency"].get("observation_id") or ""),
        ),
    )


def _professional_routes(
    entities: list[dict[str, Any]], relationships: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    by_id = _entities(entities)
    routes = []
    for relationship in relationships:
        attributes = relationship.get("attributes") or {}
        matter_entity_id = attributes.get("matter_entity_id")
        matter_reference = attributes.get("matter_reference")
        professional_id = str(relationship.get("from_entity_id") or "")
        party_id = str(relationship.get("to_entity_id") or "")
        if (
            relationship.get("role") not in _PROFESSIONAL_ROLES
            or relationship.get("state") != "verified"
            or not _has_relationship_lineage(relationship)
            or not (matter_entity_id or matter_reference)
            or professional_id not in by_id
            or party_id not in by_id
            or by_id[professional_id].get("verified") is not True
            or by_id[party_id].get("verified") is not True
        ):
            continue
        routes.append(
            {
                "kind": "possible_introduction_route",
                "relationship_id": relationship.get("id"),
                "professional": _brief(by_id[professional_id]),
                "party": _brief(by_id[party_id]),
                "professional_role": relationship.get("role"),
                "valid_from": relationship.get("valid_from"),
                "valid_to": relationship.get("valid_to"),
                "matter": {
                    "entity_id": matter_entity_id,
                    "reference": matter_reference,
                },
                "status": "review_required",
                "availability_inferred": False,
                "reason": (
                    "This source-backed matter role may provide an introduction route; "
                    "availability and willingness require human review."
                ),
                "lineage": _relationship_lineage(relationship),
            }
        )
    return sorted(routes, key=lambda item: str(item.get("relationship_id") or ""))


def possible_introduction_routes(
    entities: list[dict[str, Any]], relationships: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Offer matter-specific professional links as reviewable introduction routes."""
    return _professional_routes(entities, relationships)


def relationship_review_prompts(
    entities: list[dict[str, Any]],
    relationships: list[dict[str, Any]],
    *,
    result_limit: int | None = None,
) -> list[dict[str, Any]]:
    """Flag overlapping professional relationships for human conflict clearance."""
    routes = _professional_routes(entities, relationships)
    by_professional: dict[str, list[dict[str, Any]]] = {}
    for route in routes:
        by_professional.setdefault(str(route["professional"]["id"]), []).append(route)
    prompts = []
    seen_pairs: set[tuple[str, str]] = set()
    stop = False
    for professional_id in sorted(by_professional):
        professional_routes = by_professional[professional_id]
        by_matter: dict[tuple[str, str], list[dict[str, Any]]] = {}
        by_party: dict[str, list[dict[str, Any]]] = {}
        for route in professional_routes:
            matter = route["matter"]
            matter_key = (
                str(matter.get("entity_id") or ""),
                str(matter.get("reference") or ""),
            )
            by_matter.setdefault(matter_key, []).append(route)
            by_party.setdefault(str(route["party"]["id"]), []).append(route)
        grouped_routes = [
            *(bucket for _key, bucket in sorted(by_matter.items())),
            *(bucket for _key, bucket in sorted(by_party.items())),
        ]
        for bucket in grouped_routes:
            for left, right in combinations(bucket, 2):
                pair = tuple(sorted((str(left["relationship_id"]), str(right["relationship_id"]))))
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                same_matter = left["matter"] == right["matter"]
                parties = {str(route["party"]["id"]): route["party"] for route in (left, right)}
                matters = []
                for route in (left, right):
                    if route["matter"] not in matters:
                        matters.append(route["matter"])
                prompts.append(
                    {
                        "kind": "potential_conflict_review_prompt",
                        "professional": left["professional"],
                        "matter": left["matter"] if same_matter else None,
                        "matters": matters,
                        "parties": sorted(
                            parties.values(), key=lambda item: str(item.get("id") or "")
                        ),
                        "overlap": "same_matter" if same_matter else "same_party",
                        "relationship_ids": list(pair),
                        "status": "human_clearance_required",
                        "conflict_conclusion": None,
                        "prompt": (
                            "Review the overlapping matter-specific professional relationships. "
                            "Complete internal conflict clearance. Prior representation alone is "
                            "not a conflict conclusion."
                        ),
                        "lineages": [left["lineage"], right["lineage"]],
                    }
                )
                if result_limit is not None and len(prompts) >= result_limit:
                    stop = True
                    break
            if stop:
                break
        if stop:
            break
    return sorted(
        prompts,
        key=lambda item: (
            str(item["professional"].get("id") or ""),
            tuple(item["relationship_ids"]),
        ),
    )


__all__ = [
    "possible_introduction_routes",
    "project_exposures",
    "relationship_review_prompts",
]
