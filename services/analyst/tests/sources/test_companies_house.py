import json
from datetime import UTC, datetime

import httpx
import pytest

from meritus.sources.companies_house import (
    CompaniesHouseAdapter,
    parse_company_snapshot,
    parse_stream_event,
    parse_stream_line,
    parse_stream_lines,
    stream_connection_slot,
)
from meritus.sources.http import RateLimited


def test_heartbeat_is_not_a_document():
    assert parse_stream_line("") is None
    assert parse_stream_line("  \n") is None


def test_deletion_without_data_is_a_withdrawal_and_advances_valid_timepoint():
    batch = parse_stream_lines(
        [
            json.dumps(
                {
                    "event": {"type": "deleted", "timepoint": "8123"},
                    "resource_id": "filing-7",
                    "resource_uri": "/company/08834019/filing-history/filing-7",
                }
            )
        ],
        watched_company_keys={"GB-COH:08834019"},
        cursor="8100",
    )
    assert batch.cursor == "8123"
    assert len(batch.documents) == 1
    assert batch.documents[0].withdrawn is True
    assert batch.documents[0].payload["event"]["type"] == "deleted"


def test_invalid_timepoint_requires_reconciliation_and_does_not_advance_cursor():
    batch = parse_stream_lines(
        [
            json.dumps(
                {
                    "event": {"type": "changed", "timepoint": "not-a-timepoint"},
                    "resource_id": "08834019",
                    "resource_uri": "/company/08834019",
                    "data": {"company_number": "08834019", "company_name": "Synthetic Ltd"},
                }
            )
        ],
        watched_company_keys={"GB-COH:08834019"},
        cursor="8100",
    )
    assert batch.cursor == "8100"
    assert batch.complete is False
    assert any("reconciliation" in warning.lower() for warning in batch.warnings)


def test_stream_416_is_visible_and_keeps_checkpoint():
    batch = parse_stream_lines([], cursor="8100", status_code=416)
    assert batch.cursor == "8100"
    assert batch.complete is False
    assert any("416" in warning for warning in batch.warnings)


def test_officer_departure_does_not_infer_a_finance_role():
    doc = parse_stream_event(
        {
            "event": {"type": "changed", "timepoint": "8124", "published_at": "2026-09-01"},
            "resource_id": "officer-1",
            "resource_uri": "/company/08834019/officers/officer-1",
            "data": {
                "company_number": "08834019",
                "name": "Example Person",
                "officer_role": "director",
                "resigned_on": "2026-08-31",
                "occupation": "Finance director",
            },
        }
    )
    assert [observation.kind for observation in doc.observations] == ["director_departure"]
    assert doc.observations[0].attributes["officer_role"] == "director"
    assert "finance_role" not in doc.observations[0].attributes


def test_only_approved_watched_company_events_are_retained():
    line = json.dumps(
        {
            "event": {"type": "changed", "timepoint": "9000"},
            "resource_id": "09999999",
            "resource_uri": "/company/09999999",
            "data": {"company_number": "09999999", "company_name": "Not Watched Ltd"},
        }
    )
    batch = parse_stream_lines([line], watched_company_keys={"GB-COH:08834019"}, cursor="8000")
    assert batch.documents == []
    assert batch.cursor == "9000"


def test_snapshot_maps_profile_accounts_filings_charges_and_insolvency_without_guessing():
    doc = parse_company_snapshot(
        "08834019",
        {
            "profile": {
                "company_number": "08834019",
                "company_name": "Synthetic Ltd",
                "accounts": {"next_due": "2026-12-31", "overdue": True},
            },
            "filings": {"items": [{"transaction_id": "f1", "type": "AA", "date": "2026-07-01"}]},
            "officers": {"items": []},
            "charges": {"items": [{"charge_code": "c1", "created_on": "2026-08-01"}]},
            "insolvency": {"cases": [{"case_number": "1", "type": "liquidation"}]},
        },
    )
    assert doc.entities[0].key == "GB-COH:08834019"
    assert {item.kind for item in doc.observations} == {
        "accounts_overdue",
        "new_charge",
        "insolvency_event",
    }
    assert not any(item.kind == "auditor_resignation" for item in doc.observations)


def test_official_filing_description_ids_map_account_date_and_auditor_events():
    doc = parse_company_snapshot(
        "08834019",
        {
            "profile": {"company_number": "08834019", "company_name": "Synthetic Ltd"},
            "filings": {
                "items": [
                    {
                        "transaction_id": "date-1",
                        "description": "change-account-reference-date-company-current-shortened",
                        "date": "2026-07-01",
                    },
                    {
                        "transaction_id": "audit-1",
                        "description": "auditors-resignation-company",
                        "date": "2026-08-01",
                    },
                ]
            },
        },
    )
    assert {item.kind for item in doc.observations} == {
        "accounting_date_change",
        "auditor_resignation",
    }


def test_stream_rejects_malformed_json():
    with pytest.raises(ValueError, match="JSON"):
        parse_stream_line("{broken")


def test_stream_connection_budget_is_shared_through_lock_files(tmp_path):
    with (
        stream_connection_slot(tmp_path),
        stream_connection_slot(tmp_path),
        pytest.raises(RateLimited),
        stream_connection_slot(tmp_path),
    ):
        pass


def test_bootstrap_uses_rest_key_and_treats_absent_optional_collections_as_empty(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-only-key")
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_STREAM_KEY", "different-stream-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.path.endswith("/insolvency"):
            return httpx.Response(404)
        if request.url.path == "/company/08834019":
            return httpx.Response(
                200, json={"company_number": "08834019", "company_name": "Synthetic Ltd"}
            )
        return httpx.Response(200, json={"items": []})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    batch = CompaniesHouseAdapter().fetch(
        {"config": {"company_numbers": ["08834019"]}, "cursor": None},
        client,
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert len(batch.documents) == 1
    assert batch.documents[0].payload["insolvency"] == {}
    assert len(requests) == 5
    assert all("cmVzdC1vbmx5LWtleTo=" in request.headers["authorization"] for request in requests)


def test_bootstrap_dates_each_scoring_record_from_the_evidenced_resource_date(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))

    def handler(request):
        if request.url.path == "/company/08834019":
            return httpx.Response(
                200,
                json={
                    "company_number": "08834019",
                    "company_name": "Synthetic Ltd",
                    "accounts": {"overdue": True, "next_due": "2026-06-30"},
                },
            )
        if request.url.path.endswith("/filing-history"):
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "transaction_id": "audit-1",
                            "description": "auditors-resignation-company",
                            "date": "2026-07-01",
                        }
                    ],
                    "total_count": 1,
                },
            )
        if request.url.path.endswith("/charges"):
            return httpx.Response(
                200,
                json={"items": [{"charge_code": "charge-1", "created_on": "2026-08-01"}]},
            )
        if request.url.path.endswith("/insolvency"):
            return httpx.Response(
                200,
                json={
                    "cases": [
                        {
                            "case_number": "case-1",
                            "type": "liquidation",
                            "dates": [{"date": "2026-09-01"}],
                        }
                    ]
                },
            )
        return httpx.Response(200, json={"items": [], "total_results": 0})

    batch = CompaniesHouseAdapter().fetch(
        {"config": {"company_numbers": ["08834019"]}, "cursor": None},
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )

    evidence = [document for document in batch.documents if document.observations]
    assert {item.observations[0].kind for item in evidence} == {
        "accounts_overdue",
        "auditor_resignation",
        "new_charge",
        "insolvency_event",
    }
    assert all(item.published_at == item.observations[0].occurred_at for item in evidence)
    assert all(item.published_at.date().isoformat() != "2026-09-12" for item in evidence)


def test_bootstrap_paginates_collection_resources(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    filing_starts = []

    def handler(request):
        if request.url.path == "/company/08834019":
            return httpx.Response(
                200, json={"company_number": "08834019", "company_name": "Synthetic Ltd"}
            )
        if request.url.path.endswith("/filing-history"):
            start = int(request.url.params.get("start_index", "0"))
            filing_starts.append(start)
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "transaction_id": f"audit-{start}",
                            "description": "auditors-resignation-company",
                            "date": f"2026-08-0{start + 1}",
                        }
                    ],
                    "start_index": start,
                    "items_per_page": 1,
                    "total_count": 2,
                },
            )
        if request.url.path.endswith("/insolvency"):
            return httpx.Response(404)
        return httpx.Response(200, json={"items": [], "total_count": 0})

    batch = CompaniesHouseAdapter().fetch(
        {"config": {"company_numbers": ["08834019"], "page_size": 1}, "cursor": None},
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )

    assert batch.complete is True
    assert filing_starts == [0, 1]
    assert {
        observation.event_key
        for document in batch.documents
        for observation in document.observations
        if observation.kind == "auditor_resignation"
    } == {
        "companies-house:08834019:filing:audit-0",
        "companies-house:08834019:filing:audit-1",
    }


def test_request_cap_returns_resource_level_resume_cursor(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))

    filing_starts = []

    def handler(request):
        if request.url.path == "/company/08834019":
            return httpx.Response(
                200, json={"company_number": "08834019", "company_name": "Synthetic Ltd"}
            )
        start = int(request.url.params.get("start_index", "0"))
        filing_starts.append(start)
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "transaction_id": f"audit-{start}",
                        "description": "auditors-resignation-company",
                        "date": "2026-08-01",
                    }
                ],
                "start_index": start,
                "items_per_page": 1,
                "total_count": 3,
            },
        )

    batch = CompaniesHouseAdapter().fetch(
        {
            "config": {
                "company_numbers": ["08834019"],
                "page_size": 1,
                "max_requests": 1,
            },
            "cursor": None,
        },
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )

    assert batch.complete is False
    cursor = json.loads(batch.cursor)
    assert cursor["company_index"] == 0
    assert cursor["resource"] == "filings"
    assert cursor["start_index"] == 0
    assert cursor["profile"]["company_name"] == "Synthetic Ltd"

    resumed = CompaniesHouseAdapter().fetch(
        {
            "config": {
                "company_numbers": ["08834019"],
                "page_size": 1,
                "max_requests": 1,
            },
            "cursor": batch.cursor,
        },
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert filing_starts == [0]
    assert json.loads(resumed.cursor)["start_index"] == 1


def test_shared_rest_budget_returns_partial_resource_cursor(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    calls = 0

    def budget(_data_dir):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RateLimited(17)

    monkeypatch.setattr("meritus.sources.companies_house._acquire_rest_budget", budget)

    def handler(request):
        return httpx.Response(
            200, json={"company_number": "08834019", "company_name": "Synthetic Ltd"}
        )

    batch = CompaniesHouseAdapter().fetch(
        {"config": {"company_numbers": ["08834019"]}, "cursor": None},
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )

    assert batch.complete is False
    assert json.loads(batch.cursor)["resource"] == "filings"
    assert any("17 seconds" in warning for warning in batch.warnings)


def test_request_cap_is_checked_before_next_company_profile(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "rest-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    requests = []

    def handler(request):
        requests.append(str(request.url))
        if request.url.path.endswith("/insolvency"):
            return httpx.Response(404)
        if request.url.path.count("/") == 2:
            number = request.url.path.rsplit("/", 1)[-1]
            return httpx.Response(
                200, json={"company_number": number, "company_name": f"Company {number}"}
            )
        return httpx.Response(200, json={"items": [], "total_count": 0})

    batch = CompaniesHouseAdapter().fetch(
        {
            "config": {
                "company_numbers": ["08834019", "09999999"],
                "max_requests": 5,
            },
            "cursor": None,
        },
        httpx.Client(transport=httpx.MockTransport(handler)),
        datetime(2026, 9, 12, tzinfo=UTC),
    )

    assert len(requests) == 5
    assert batch.complete is False
    assert json.loads(batch.cursor)["company_index"] == 1


def test_changed_watchlist_restarts_without_reusing_another_company_profile(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_COMPANIES_HOUSE_API_KEY", "synthetic-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    requested = []

    def handler(request):
        requested.append(request.url.path)
        number = request.url.path.split("/")[2]
        return httpx.Response(
            200, json={"company_number": number, "company_name": f"Synthetic {number}"}
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        first = CompaniesHouseAdapter().fetch(
            {"config": {"company_numbers": ["09999999"], "max_requests": 1}},
            client,
            datetime(2026, 9, 12, tzinfo=UTC),
        )
        second = CompaniesHouseAdapter().fetch(
            {
                "config": {"company_numbers": ["08888888"], "max_requests": 1},
                "cursor": first.cursor,
            },
            client,
            datetime(2026, 9, 12, tzinfo=UTC),
        )
    assert requested == ["/company/09999999", "/company/08888888"]
    assert all(
        entity.name == "Synthetic 08888888" for doc in second.documents for entity in doc.entities
    )
    assert any("watchlist" in warning.lower() for warning in second.warnings)
