from datetime import UTC, datetime

from meritus.domain import EntityInput
from meritus.sources.extraction import extract_document


def test_extraction_preserves_locations_context_and_review_state():
    entity = EntityInput(
        key="unresolved:reviewed_import:example",
        name="Example Construction Limited",
    )
    document = extract_document(
        "The 2024 contract did not include a fixed price.\f"
        "In London, completion slipped by 12 weeks during August 2026. "
        "The company is hiring a claims manager.",
        "https://example.test/report.pdf",
        datetime(2026, 9, 1, tzinfo=UTC),
        [entity],
    )

    assert {item.kind for item in document.observations} == {
        "contract_provision",
        "project_delay",
        "claims_hiring",
    }
    assert all(item.state == "pending" for item in document.observations)
    provision = next(item for item in document.observations if item.kind == "contract_provision")
    assert provision.attributes["negated"] is True
    assert provision.attributes["historical"] is True
    assert provision.evidence_pointer == "page:1:sentence:1"
    delay = next(item for item in document.observations if item.kind == "project_delay")
    assert delay.value == 12
    assert delay.unit == "weeks"
    assert delay.attributes["geography"] == "London"
    assert delay.evidence_pointer == "page:2:sentence:1"
    assert document.payload["locations"][0]["sentence"] == provision.detail
