from datetime import timedelta

import pytest

from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.workflow.relationships import add_reviewed_relationship, validate_relationship
from meritus.workflow.reviews import merge_entities, reject_identity_match


def _entities(repo, now):
    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="entities",
                    source_url="https://example.org/entities",
                    title="Entities",
                    published_at=now,
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:00000001",
                            name="One",
                            scheme="GB-COH",
                            identifier="00000001",
                        ),
                        EntityInput(
                            key="GB-COH:00000002",
                            name="Two",
                            scheme="GB-COH",
                            identifier="00000002",
                        ),
                    ],
                )
            ]
        ),
        now,
    )
    return repo.list_entities()


def _source_record_id(repo):
    return repo.list_records()[0]["id"]


def test_rejected_alias_is_audited_without_merging(repo, now):
    one, two = _entities(repo, now)
    decision = reject_identity_match(repo, one["id"], two["id"], "Different companies", "WR")
    assert decision["target_type"] == "identity_match"
    assert repo.get_entity(one["id"])["properties"] == {}


def test_rejected_alias_persists_normalised_identity_ids(repo, now):
    one, two = _entities(repo, now)

    decision = reject_identity_match(
        repo,
        f"  {one['id']}  ",
        f"  {two['id']}  ",
        "Different companies",
        "WR",
    )

    assert decision["target_id"] == one["id"]
    assert decision["payload"]["proposed_entity_id"] == two["id"]


def test_accepted_identity_merge_has_durable_audit(repo, now):
    one, two = _entities(repo, now)
    decision = merge_entities(repo, one["id"], two["id"], "Same legal entity", "WR")
    assert decision["action"] == "merge"
    assert repo.get_entity(one["id"])["properties"]["merged_into_entity_id"] == two["id"]


def test_professional_role_requires_matter_specific_provenance():
    with pytest.raises(ValueError, match="specific matter"):
        validate_relationship(
            {
                "from_entity_id": "person-1",
                "to_entity_id": "company-1",
                "role": "expert",
                "evidence_pointer": "paragraph 9",
            }
        )


def test_relationship_requires_effective_from_date():
    with pytest.raises(ValueError, match="valid_from is required"):
        validate_relationship(
            {
                "from_entity_id": "company-1",
                "to_entity_id": "company-2",
                "role": "owner_of",
                "evidence_pointer": "register entry",
            }
        )


def test_multiple_owners_over_time_are_preserved(repo, now):
    one, two = _entities(repo, now)
    source_record_id = _source_record_id(repo)
    first = add_reviewed_relationship(
        repo,
        {
            "from_entity_id": one["id"],
            "to_entity_id": two["id"],
            "role": "owner_of",
            "evidence_pointer": "register entry 1",
            "valid_from": (now - timedelta(days=100)).isoformat(),
            "valid_to": (now - timedelta(days=1)).isoformat(),
            "source_record_id": source_record_id,
        },
        "WR",
        "Register reviewed",
    )
    second = add_reviewed_relationship(
        repo,
        {
            "from_entity_id": two["id"],
            "to_entity_id": one["id"],
            "role": "owner_of",
            "evidence_pointer": "register entry 2",
            "valid_from": now.isoformat(),
            "source_record_id": source_record_id,
        },
        "WR",
        "Register reviewed",
    )
    assert first["valid_to"] != second["valid_from"]
    assert len(repo.list_relationships()) == 2


def test_reviewed_relationship_persists_enforceable_record_lineage(repo, now):
    one, two = _entities(repo, now)
    record = repo.list_records()[0]

    relationship = add_reviewed_relationship(
        repo,
        {
            "from_entity_id": one["id"],
            "to_entity_id": two["id"],
            "role": "owner_of",
            "evidence_pointer": "register entry",
            "valid_from": now.isoformat(),
            "source_record_id": record["id"],
        },
        "WR",
        "Register reviewed",
    )

    assert relationship["record_id"] == record["id"]
    assert relationship["attributes"]["source_url"] == record["source_url"]


def test_reviewed_relationship_rejects_ambiguous_url_without_record_id(repo, now):
    one, two = _entities(repo, now)
    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="same-url-second",
                    source_url="https://example.org/entities",
                    title="Second source row",
                    published_at=now,
                    payload={},
                )
            ]
        ),
        now,
    )

    with pytest.raises(ValueError, match="ambiguous"):
        add_reviewed_relationship(
            repo,
            {
                "from_entity_id": one["id"],
                "to_entity_id": two["id"],
                "role": "owner_of",
                "evidence_pointer": "register entry",
                "valid_from": now.isoformat(),
                "source_url": "https://example.org/entities",
            },
            "WR",
            "Register reviewed",
        )
