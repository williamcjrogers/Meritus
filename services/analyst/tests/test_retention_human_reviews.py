from datetime import timedelta

import pytest

from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.retention import purge_expired


def _source(repo, now, external_id, name, *, expires_at=None):
    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id=external_id,
                    source_url=f"https://example.org/{external_id}",
                    title=name,
                    published_at=now,
                    expires_at=expires_at,
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:00000001",
                            name=name,
                            scheme="GB-COH",
                            identifier="00000001",
                            verified=True,
                            properties={"sector": f"Source {external_id}"},
                        )
                    ],
                )
            ]
        ),
        now,
    )
    return next(item for item in repo.list_records() if item["external_id"] == external_id)


def test_purge_preserves_analyst_name_verification_and_overlapping_properties(repo, now, tmp_path):
    _source(repo, now - timedelta(minutes=1), "public", "Public name")
    _source(repo, now, "private", "PRIVATE SOURCE NAME", expires_at=now - timedelta(seconds=1))
    entity = repo.list_entities()[0]
    repo.record_review(
        "entity",
        entity["id"],
        "update",
        "Corrected from independent analyst knowledge",
        "WR",
        {
            "name": "Analyst corrected name",
            "properties": {
                "sector": "Analyst sector",
                "analyst_note": "Retain this independent note",
            },
        },
    )
    repo.record_review("entity", entity["id"], "reject", "Identity still needs investigation", "WR")
    purge_expired(repo, now, tmp_path)
    result = repo.get_entity(entity["id"])
    assert result["name"] == "Analyst corrected name"
    assert result["verified"] is False
    assert result["properties"]["sector"] == "Analyst sector"
    assert result["properties"]["analyst_note"] == "Retain this independent note"


@pytest.mark.parametrize("lineage", ["source_record_id", "source_url"])
def test_purge_never_replays_erased_source_linked_review_values(repo, now, tmp_path, lineage):
    _source(repo, now - timedelta(minutes=1), "public", "Public name")
    private = _source(
        repo, now, "private", "PRIVATE SOURCE NAME", expires_at=now - timedelta(seconds=1)
    )
    entity = repo.list_entities()[0]
    repo.record_review(
        "entity",
        entity["id"],
        "update",
        "Independent correction",
        "WR",
        {"name": "Analyst corrected name", "properties": {"sector": "Analyst sector"}},
    )
    private_review = repo.record_review(
        "entity",
        entity["id"],
        "update",
        "PRIVATE REVIEW REASON",
        "WR",
        {
            "changes": {
                "name": "PRIVATE REVIEW NAME",
                "properties": {"private_only": "PRIVATE REVIEW VALUE", "sector": "PRIVATE SECTOR"},
            },
            lineage: private["id"] if lineage == "source_record_id" else private["source_url"],
        },
    )
    purge_expired(repo, now, tmp_path)
    result = repo.get_entity(entity["id"])
    assert result["name"] == "Analyst corrected name"
    assert result["properties"]["sector"] == "Analyst sector"
    assert "private_only" not in result["properties"]
    assert "PRIVATE" not in str(result)
    review = next(item for item in repo.list_reviews() if item["id"] == private_review["id"])
    assert review["payload"] == {"erased": True}


def test_independent_human_review_survives_when_last_source_is_erased(
    repo, now, tmp_path, monkeypatch
):
    monkeypatch.setattr("meritus.repository.workflow.utc_now", lambda: now)
    _source(repo, now, "private", "PRIVATE SOURCE NAME", expires_at=now + timedelta(seconds=1))
    entity = repo.list_entities()[0]
    review = repo.record_review(
        "entity",
        entity["id"],
        "update",
        "Independent identification by interview",
        "WR",
        {"name": "Human identified company", "verified": True},
    )
    purge_expired(repo, now + timedelta(seconds=2), tmp_path)
    result = repo.get_entity(entity["id"])
    assert result["name"] == "Human identified company"
    assert result["verified"] is True
    saved = next(item for item in repo.list_reviews() if item["id"] == review["id"])
    assert not saved["payload"].get("erased")
