from datetime import timedelta

import pytest

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.models import Source, SourceRecord
from meritus.workflow.relationships import add_reviewed_relationship


def _fixture(repo, now):
    repo.ingest_batch(
        "reviewed_import",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="lineage",
                    source_url="https://example.org/lineage",
                    title="Retained note",
                    published_at=now,
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:00000001",
                            name="One",
                            scheme="GB-COH",
                            identifier="00000001",
                        )
                    ],
                )
            ]
        ),
        now,
    )
    entity = repo.list_entities()[0]
    return repo.list_records()[0], {
        "from_entity_id": entity["id"],
        "to_entity_id": entity["id"],
        "role": "owner_of",
        "evidence_pointer": "Interview note paragraph 3",
        "valid_from": now.isoformat(),
    }


def test_human_interview_relationship_has_no_fabricated_source_lineage(repo, now):
    _, data = _fixture(repo, now)
    saved = add_reviewed_relationship(
        repo,
        {
            **data,
            "evidence_mode": "human",
            "human_basis": "Interview with the project director on 12 September 2026",
        },
        "WR",
        "Confirmed against my contemporaneous interview note",
    )
    assert saved["record_id"] is None
    assert saved["attributes"]["evidence_mode"] == "human"
    assert saved["attributes"]["human_basis"].startswith("Interview")
    assert repo.list_reviews()[0]["reason"] == "Confirmed against my contemporaneous interview note"


@pytest.mark.parametrize(
    "field,value",
    [
        ("human_basis", "https://caselaw.nationalarchives.gov.uk/test"),
        ("evidence_pointer", "See www.theconstructionindex.co.uk/news"),
        ("human_basis", "caselaw.nationalarchives.gov.uk/test"),
    ],
)
def test_human_mode_cannot_disguise_publisher_urls(repo, now, field, value):
    _, data = _fixture(repo, now)
    with pytest.raises(ValueError, match="retained source"):
        add_reviewed_relationship(
            repo,
            {**data, "evidence_mode": "human", "human_basis": "Interview notes", field: value},
            "WR",
            "Reviewed interview",
        )


@pytest.mark.parametrize("reference", ["source_record_id", "source_url"])
@pytest.mark.parametrize(
    "condition",
    ["inactive", "withdrawn", "expired", "permission_denied", "content_expired", "erased"],
)
def test_relationship_refuses_unreadable_evidence_before_mutation(
    repo, now, monkeypatch, reference, condition
):
    record, data = _fixture(repo, now)
    monkeypatch.setattr("meritus.workflow.lineage.utc_now", lambda: now, raising=False)
    with session_scope(repo.engine) as session:
        stored = session.get(SourceRecord, record["id"])
        if condition == "inactive":
            stored.active = False
        elif condition == "withdrawn":
            stored.withdrawn = True
        elif condition == "expired":
            stored.expires_at = now - timedelta(seconds=1)
        elif condition == "permission_denied":
            session.get(Source, "reviewed_import").permissions = {"denied": True}
        elif condition == "content_expired":
            stored.payload = {
                "import_permission": {
                    "content_expires_at": (now - timedelta(seconds=1)).isoformat()
                }
            }
        else:
            stored.payload = {"erasure": {"reason": "expired"}}
    supplied = record["id"] if reference == "source_record_id" else record["source_url"]
    with pytest.raises(ValueError):
        add_reviewed_relationship(repo, {**data, reference: supplied}, "WR", "Review attempted")
    assert not repo.list_reviews()
