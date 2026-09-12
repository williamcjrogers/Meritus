from datetime import datetime

import pytest
from pydantic import ValidationError

from meritus.domain import EntityInput, ParsedDocument
from meritus.repository import Repository
from meritus.sources.catalogue import company_key


def test_numeric_company_ids_preserve_leading_zeroes():
    assert company_key("8834019") == "GB-COH:08834019"
    assert company_key("SC123456") == "GB-COH:SC123456"


@pytest.mark.parametrize("number", ["", "123456789", "SC12345", "XX123456", "12-3456"])
def test_invalid_company_ids_are_rejected(number):
    with pytest.raises(ValueError):
        company_key(number)


def test_domain_rejects_naive_datetimes():
    with pytest.raises(ValidationError):
        ParsedDocument(
            external_id="naive",
            source_url="https://example.org",
            title="Naive",
            published_at=datetime(2026, 9, 12),
            payload={},
        )


def test_scheme_mismatch_rejects_the_batch(repo: Repository, now: datetime):
    document = ParsedDocument(
        external_id="mismatch",
        source_url="https://example.org/mismatch",
        title="Mismatch",
        published_at=now,
        payload={},
        entities=[
            EntityInput(
                key="GB-COH:08834019",
                name="Example Ltd",
                scheme="GB-COH",
                identifier="09999999",
                verified=True,
            )
        ],
    )

    with pytest.raises(ValueError, match="identifier"):
        repo.ingest_batch("payment_practices", {"documents": [document]}, now)


def test_two_name_only_organisations_remain_separate(repo: Repository, now: datetime):
    from meritus.domain import FetchBatch

    document = ParsedDocument(
        external_id="names",
        source_url="https://example.org/names",
        title="Similar names",
        published_at=now,
        payload={},
        entities=[
            EntityInput(key="unresolved:reviewed_import:alpha", name="Acme", verified=True),
            EntityInput(key="unresolved:reviewed_import:beta", name="ACME Ltd", verified=True),
        ],
    )

    repo.ingest_batch("reviewed_import", FetchBatch(documents=[document]), now)

    entities = repo.list_entities()
    assert {entity["key"] for entity in entities} == {
        "unresolved:reviewed_import:alpha",
        "unresolved:reviewed_import:beta",
    }
    assert all(entity["verified"] is False for entity in entities)
