"""Canonical evidence-envelope validation."""

from datetime import UTC, datetime
from decimal import Decimal
from math import inf, nan

import pytest
from pydantic import ValidationError

from meritus.domain import (
    EntityInput,
    FetchBatch,
    ObservationInput,
    ParsedDocument,
    RelationshipInput,
)

NOW = datetime(2026, 9, 12, tzinfo=UTC)


def document(**changes) -> ParsedDocument:
    values = {
        "external_id": "notice-1",
        "source_url": "https://example.org/notices/1",
        "title": "Notice",
        "published_at": NOW,
        "payload": {},
    }
    values.update(changes)
    return ParsedDocument(**values)


@pytest.mark.parametrize(
    ("factory", "path", "label"),
    [
        (
            lambda: document(
                payload={"release": {"tender": {"lotDetails": {"maximumLotsBidPerSupplier": inf}}}}
            ),
            "payload.release.tender.lotDetails.maximumLotsBidPerSupplier",
            "Infinity",
        ),
        (
            lambda: EntityInput(
                key="unresolved:find_tender:builder",
                name="Builder",
                properties={"confidence": nan},
            ),
            "properties.confidence",
            "NaN",
        ),
        (
            lambda: document(payload={"decimal": Decimal("-Infinity")}),
            "payload.decimal",
            "-Infinity",
        ),
        (
            lambda: ObservationInput(
                subject_key="GB-COH:01234567",
                kind="metric",
                event_key="metric:1",
                headline="Metric",
                detail="Non-finite typed value",
                value="Infinity",
            ),
            "value",
            "Infinity",
        ),
        (
            lambda: ObservationInput(
                subject_key="GB-COH:01234567",
                kind="metric",
                event_key="metric:2",
                headline="Metric",
                detail="Non-finite attribute",
                attributes={"range": [1, -inf]},
            ),
            "attributes.range.1",
            "-Infinity",
        ),
        (
            lambda: RelationshipInput(
                from_key="GB-COH:01234567",
                to_key="GB-COH:07654321",
                role="contractor",
                evidence_pointer="lot/1",
                attributes={"weight": nan},
            ),
            "attributes.weight",
            "NaN",
        ),
    ],
)
def test_envelopes_reject_non_finite_numbers(factory, path, label):
    with pytest.raises(ValidationError) as error:
        factory()

    message = str(error.value)
    assert "non-finite numeric value" in message
    assert path in message
    assert label in message


def test_fetch_batch_revalidates_constructed_documents_before_ingestion():
    unsafe = ParsedDocument.model_construct(
        external_id="notice-unsafe",
        source_url="https://example.org/notices/unsafe",
        title="Unsafe notice",
        published_at=NOW,
        payload={"maximumLotsBidPerSupplier": inf},
        entities=[],
        observations=[],
        relationships=[],
        warnings=[],
        withdrawn=False,
        expires_at=None,
        media_type="application/json",
        raw_text=None,
    )

    with pytest.raises(ValidationError, match=r"payload\.maximumLotsBidPerSupplier"):
        FetchBatch(documents=[unsafe])


def test_none_and_finite_json_values_are_preserved_without_coercion():
    payload = {
        "missing": None,
        "zero": 0.0,
        "values": [1.25, -2, True, "NaN", "Infinity"],
        "nested": {"ratio": 4.5},
    }

    parsed = document(payload=payload)

    assert parsed.payload == payload
    assert parsed.payload["missing"] is None
