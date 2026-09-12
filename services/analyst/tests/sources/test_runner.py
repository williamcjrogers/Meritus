import json

import httpx

from meritus.domain import FetchBatch, ObservationInput, ParsedDocument
from meritus.sources.runner import run_source


def test_rejected_batch_records_fetched_count_and_source_reference(repo, now, monkeypatch):
    class BrokenAdapter:
        def fetch(self, source, client, cutoff):
            return FetchBatch(
                documents=[
                    ParsedDocument(
                        external_id="malformed-adapter-record",
                        source_url="https://example.org/evidence",
                        title="Synthetic malformed adapter output",
                        published_at=cutoff,
                        payload={},
                        observations=[
                            ObservationInput(
                                subject_key="GB-COH:09999999",
                                kind="payment_report",
                                event_key="missing-subject",
                                headline="Missing subject",
                                detail="Test only",
                            )
                        ],
                    )
                ]
            )

    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: BrokenAdapter())
    result = run_source(repo, "find_tender", now)
    assert result["status"] == "failed" and result["rejected"] == 1
    run = repo.list_runs()[0]
    assert run["fetched"] == run["rejected"] == 1
    assert run["detail"]["rejected_records"][0]["external_id"] == "malformed-adapter-record"
    assert repo.list_records() == []
    assert repo.get_source("find_tender")["cursor"] is None


def test_permission_precedes_requests_or_adapter_lookup(repo, now):
    seen = []
    with httpx.Client(
        transport=httpx.MockTransport(lambda request: seen.append(request))
    ) as client:
        result = run_source(repo, "find_case_law", now, client)
    assert result["status"] == "blocked"
    assert seen == []
    assert repo.get_source("find_case_law")["cursor"] is None


def test_page_cap_and_replay_checkpoint(repo, now):
    repo.update_source("find_tender", {"config": {"max_pages": 1, "page_size": 1}})
    release = {
        "id": "sample",
        "ocid": "sample-process",
        "date": now.isoformat(),
        "tender": {"title": "Synthetic test procurement", "mainProcurementCategory": "works"},
    }

    def handler(request):
        assert "stages" not in request.url.params
        return httpx.Response(
            200,
            json={
                "releases": [release],
                "links": {
                    "next": "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?cursor=next"
                },
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        first = run_source(repo, "find_tender", now, client)
        second = run_source(repo, "find_tender", now, client)
    assert first["status"] == second["status"] == "partial"
    assert first["inserted"] == 1 and second["replayed"] == 1
    assert json.loads(repo.get_source("find_tender")["cursor"])["next"].endswith("cursor=next")
    assert len(repo.list_records()) == 1


def test_failed_parse_keeps_checkpoint_and_never_returns_empty_success(repo, now):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"unexpected": "schema"}))
    ) as client:
        result = run_source(repo, "find_tender", now, client)
    assert result["status"] == "failed"
    assert repo.get_source("find_tender")["cursor"] is None
    assert repo.list_runs()[0]["status"] == "failed"


def test_next_link_cannot_reach_private_service(repo, now):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(
            200, json={"releases": [], "links": {"next": "http://127.0.0.1/private"}}
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = run_source(repo, "find_tender", now, client)
    assert result["status"] == "failed" and len(seen) == 1
    assert repo.get_source("find_tender")["cursor"] is None


def test_rate_limited_cf_records_requested_pause(repo, now):
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(403, headers={"Retry-After": "300"}))
    ) as client:
        result = run_source(repo, "contracts_finder", now, client)
    assert result["status"] == "failed"
    assert result["retry_after_seconds"] == 300


def test_post_fetch_disabled_source_records_blocked_rejection_counts(repo, now, monkeypatch):
    class DisablingAdapter:
        def fetch(self, source, client, cutoff):
            repo.update_source("find_tender", {"enabled": False})
            return FetchBatch(
                documents=[
                    ParsedDocument(
                        external_id="blocked-after-fetch",
                        source_url="https://example.org/source",
                        title="Synthetic",
                        published_at=cutoff,
                        payload={},
                    )
                ]
            )

    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: DisablingAdapter())
    result = run_source(repo, "find_tender", now)
    run = repo.list_runs()[0]
    assert result["status"] == "blocked"
    assert run["fetched"] == run["rejected"] == 1
    assert repo.get_source("find_tender")["cursor"] is None


def test_permanent_cf_denial_is_not_reported_as_rate_limit(repo, now):
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(403))) as client:
        result = run_source(repo, "contracts_finder", now, client)
    assert result["status"] == "failed" and "HTTP 403" in result["error"]
    assert "retry_after_seconds" not in result


def test_rest_access_does_not_require_stream_credential(repo, now):
    from meritus.config import Settings
    from meritus.sources.runner import check_access

    repo.update_source(
        "companies_house", {"enabled": True, "config": {"company_numbers": ["09999999"]}}
    )
    check_access(
        repo.get_source("companies_house"),
        Settings(companies_house_api_key="synthetic-rest-key", companies_house_stream_key=None),
        now,
    )
