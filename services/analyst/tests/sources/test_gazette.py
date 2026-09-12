from datetime import UTC, datetime

import httpx
import pytest

from meritus.sources.gazette import GazetteAdapter, gazette_window_open, parse_feed, parse_notice


def notice(notice_id="4900001", code="2450"):
    return {
        "@id": f"https://www.thegazette.co.uk/notice/{notice_id}",
        "@type": "Notice",
        "hasNoticeID": notice_id,
        "hasNoticeCode": code,
        "datePublished": "2026-08-31",
        "isAbout": {
            "name": "Synthetic Construction Limited",
            "companyNumber": "08834019",
        },
        "caseNumber": "CR-2026-001",
    }


@pytest.mark.parametrize(
    ("instant", "expected"),
    [
        (datetime(2026, 1, 15, 20, 59, tzinfo=UTC), False),
        (datetime(2026, 1, 15, 21, 0, tzinfo=UTC), True),
        (datetime(2026, 7, 15, 19, 59, tzinfo=UTC), False),
        (datetime(2026, 7, 15, 20, 0, tzinfo=UTC), True),
        (datetime(2026, 7, 16, 5, 59, tzinfo=UTC), True),
        (datetime(2026, 7, 16, 6, 0, tzinfo=UTC), False),
    ],
)
def test_gazette_window_uses_europe_london_in_gmt_and_bst(instant, expected):
    assert gazette_window_open(instant) is expected


def test_malformed_notice_id_is_rejected():
    with pytest.raises(ValueError, match="notice ID"):
        parse_notice(notice("../bad"))


def test_taxonomy_id_drives_petition_classification_and_duplicate_notices_collapse():
    docs = parse_feed({"entry": [notice(), notice()]})
    assert len(docs) == 1
    observation = docs[0].observations[0]
    assert observation.kind == "insolvency_petition"
    assert observation.subject_key == "GB-COH:08834019"
    assert observation.attributes["notice_code"] == "2450"


def test_official_edition_issue_notice_identifier_is_accepted():
    doc = parse_notice(notice(notice_id="L-60768-1986497"))
    assert doc.external_id == "L-60768-1986497"


def test_unrecognised_taxonomy_does_not_become_adverse_from_words():
    item = notice(code="9999")
    item["description"] = "petition to wind up the company"
    doc = parse_notice(item)
    assert doc.observations == []
    assert any("taxonomy" in warning.lower() for warning in doc.warnings)


@pytest.mark.parametrize(
    "literal",
    [False, "false", "FALSE", {"@value": False}, {"@value": "false"}],
)
def test_false_withdrawal_literals_do_not_withdraw_notice(literal):
    item = notice()
    item["isWithdrawn"] = literal
    assert parse_notice(item).withdrawn is False


def test_unsupported_structured_withdrawal_literal_is_rejected():
    item = notice()
    item["isWithdrawn"] = {"value": "false"}
    with pytest.raises(ValueError, match="isWithdrawn"):
        parse_notice(item)


def test_adapter_resolves_feed_entry_through_official_jsonld(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_ORGANISATIONAL_CONTACT", "evidence@example.test")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.path.endswith("data.jsonld"):
            return httpx.Response(200, json=notice(notice_id="L-60768-1986497"))
        return httpx.Response(
            200,
            json={
                "link": [
                    {
                        "@href": "https://www.thegazette.co.uk/insolvency/notice/"
                        "data.json?results-page=2",
                        "@rel": "next",
                    }
                ],
                "entry": [
                    {
                        "id": "https://www.thegazette.co.uk/id/notice/L-60768-1986497",
                        "f:notice-code": "2450",
                        "published": "2026-08-31T07:43:53Z",
                        "link": [
                            {
                                "@href": "https://www.thegazette.co.uk/notice/"
                                "L-60768-1986497/data.jsonld",
                                "@rel": "alternate",
                                "@type": "application/json",
                                "@title": "JSON-LD",
                            }
                        ],
                    }
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    batch = GazetteAdapter().fetch(
        {"config": {"page_limit": 10}, "cursor": None},
        client,
        datetime(2026, 1, 15, 22, 0, tzinfo=UTC),
    )
    assert batch.documents[0].entities[0].key == "GB-COH:08834019"
    assert batch.documents[0].observations[0].kind == "insolvency_petition"
    assert len(requests) == 2
    assert batch.complete is False
    assert '"page": 2' in batch.cursor
    assert "evidence@example.test" in requests[0].headers["user-agent"]
