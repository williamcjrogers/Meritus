import json
from datetime import UTC, datetime, timedelta
from xml.sax.saxutils import escape

import httpx
import pytest
from sqlalchemy import select

from meritus.domain import FetchBatch
from meritus.models import SourceRecord
from meritus.retention import purge_expired
from meritus.sources.caselaw import parse_legaldocml, revalidate_retained_cases
from meritus.sources.http import FetchError, fetch_bytes

HOST = "caselaw.nationalarchives.gov.uk"
NOW = datetime(2026, 9, 12, 12, tzinfo=UTC)


def legal_xml(title="Example Ltd v Builder Ltd", body="The construction claim was dismissed."):
    return (
        '<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0">'
        "<judgment><meta><identification><FRBRWork>"
        f'<FRBRname value="{escape(title)}" />'
        "</FRBRWork></identification></meta>"
        f'<body><paragraph eId="p1"><content><p>{escape(body)}</p>'
        "</content></paragraph></body></judgment></akomaNtoso>"
    ).encode()


def seed(repo, external_id="ewhc/tcc/2026/12", *, xml=None, observed_at=NOW):
    document = parse_legaldocml(
        xml or legal_xml(),
        {
            "external_id": external_id,
            "source_url": f"https://{HOST}/{external_id}",
            "xml_url": f"https://{HOST}/{external_id}/data.xml",
            "title": "Example Ltd v Builder Ltd",
            "published_at": datetime(2026, 9, 10, tzinfo=UTC),
            "updated_at": datetime(2026, 9, 11, tzinfo=UTC),
        },
    )
    repo.ingest_batch("find_case_law", FetchBatch(documents=[document]), observed_at=observed_at)
    return document


@pytest.fixture(autouse=True)
def isolated_budget(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    monkeypatch.setattr("meritus.sources.http._pace_host", lambda *args: None)


@pytest.mark.parametrize("status", [404, 410])
def test_confirmed_missing_current_document_becomes_content_free_tombstone(repo, status):
    seed(repo)
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(status))) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert batch.complete
    assert len(batch.documents) == 1
    tombstone = batch.documents[0]
    assert tombstone.withdrawn
    assert tombstone.published_at is None and tombstone.raw_text is None
    assert not tombstone.entities and not tombstone.observations and not tombstone.relationships
    assert "Example" not in tombstone.model_dump_json()
    assert tombstone.payload["withdrawal_status"] == status


def test_approved_redirect_to_confirmed_missing_document_is_a_withdrawal(repo):
    seed(repo)
    calls = []

    def response(request):
        calls.append(str(request.url))
        if len(calls) == 1:
            return httpx.Response(302, headers={"location": f"https://{HOST}/renamed/data.xml"})
        return httpx.Response(404)

    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert len(calls) == 2 and batch.documents[0].withdrawn


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500),
        httpx.Response(401),
        httpx.Response(403),
        httpx.Response(200, content=b""),
        httpx.Response(200, content=b"<broken"),
        httpx.Response(200, content=b"<html><body>Not found</body></html>"),
        httpx.Response(
            200, content=b'<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"/>'
        ),
        httpx.Response(304),
        httpx.Response(302, headers={"location": "https://example.com/404"}),
    ],
)
def test_unconfirmed_missing_or_invalid_response_preserves_prior_and_checkpoint(repo, response):
    seed(repo)
    source = repo.get_source("find_case_law")
    source["cursor"] = json.dumps({"updated_at": "2026-09-11T00:00:00+00:00"})
    with httpx.Client(transport=httpx.MockTransport(lambda _: response)) as client:
        batch = revalidate_retained_cases(repo, source, client, NOW)
    state = json.loads(batch.cursor)
    assert not batch.complete and not batch.documents
    assert state["updated_at"] == "2026-09-11T00:00:00+00:00"
    assert state["current_records"]["after_external_id"] is None
    assert state["current_records"]["last_complete_at"] is None
    assert state["current_records"]["stop_reason"] == "check_failed"
    assert repo.list_records()[0]["active"]


def test_exception_message_without_confirmed_http_status_cannot_withdraw(repo, monkeypatch):
    seed(repo)

    def fail(*args, **kwargs):
        raise FetchError("Source returned HTTP 404.")

    monkeypatch.setattr("meritus.sources.caselaw.fetch_bytes", fail)
    batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), object(), NOW)
    assert not batch.complete and not batch.documents


def test_transport_failure_is_partial_and_cannot_withdraw(repo):
    seed(repo)

    def fail(request):
        raise httpx.ReadError("Synthetic connection failure", request=request)

    with httpx.Client(transport=httpx.MockTransport(fail)) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert not batch.complete and not batch.documents
    assert json.loads(batch.cursor)["current_records"]["stop_reason"] == "check_failed"


def test_source_transform_date_is_retained_without_using_check_time(repo):
    seed(repo)
    xml = legal_xml().replace(
        b"</FRBRWork>",
        b'</FRBRWork><FRBRManifestation><FRBRdate name="transform" '
        b'date="2026-09-12T08:15:00Z" /></FRBRManifestation>',
    )
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml))
    ) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert batch.documents[0].payload["updated_at"] == "2026-09-12T08:15:00+00:00"
    assert batch.documents[0].published_at == datetime(2026, 9, 10, tzinfo=UTC)


def test_missing_current_title_uses_identifier_not_superseded_name(repo):
    seed(repo)
    xml = legal_xml().replace(b'<FRBRname value="Example Ltd v Builder Ltd" />', b"")
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml))
    ) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert batch.documents[0].title == "ewhc/tcc/2026/12"
    assert "Example Ltd" not in batch.documents[0].model_dump_json()


def test_current_full_replacement_preserves_publication_date_and_does_not_invent_update(repo):
    previous = seed(repo)
    xml = legal_xml(title="Revised public title", body="The revised construction claim succeeded.")
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml))
    ) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert batch.complete and len(batch.documents) == 1
    replacement = batch.documents[0]
    assert replacement.title == "Revised public title"
    assert "revised construction" in replacement.raw_text
    assert replacement.published_at == previous.published_at
    assert replacement.payload["updated_at"] is None
    assert replacement.observations and not replacement.withdrawn
    repo.ingest_batch("find_case_law", batch, NOW)
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml))
    ) as client:
        replay = revalidate_retained_cases(
            repo, repo.get_source("find_case_law"), client, NOW + timedelta(days=1)
        )
    assert replay.complete and not replay.documents
    repo.ingest_batch("find_case_law", replay, NOW + timedelta(days=1))
    assert len(repo.list_records()) == 2


def test_unchanged_current_xml_does_not_create_artificial_new_revision(repo):
    seed(repo)
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=legal_xml()))
    ) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert batch.complete and not batch.documents
    assert json.loads(batch.cursor)["current_records"]["checked_count"] == 1


def test_republished_revision_can_be_withdrawn_again_after_prior_erasure(repo, tmp_path):
    repo.update_source("find_case_law", {"permissions": {"current_version_only": True}})
    seed(repo)
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(404))) as client:
        first = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    repo.ingest_batch("find_case_law", first, NOW)
    purge_expired(repo, NOW, tmp_path)
    seed(repo, xml=legal_xml(body="The republished construction judgment."))
    current = next(record for record in repo.list_records() if record["active"])
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(404))) as client:
        second = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
        retry = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    counts = repo.ingest_batch("find_case_law", second, NOW)
    assert counts["updated"] == 1 and counts["replayed"] == 0
    assert second.documents[0].payload["current_replaces_record_id"] == current["id"]
    assert second.documents[0] != first.documents[0]
    assert second.documents == retry.documents
    assert repo.ingest_batch("find_case_law", retry, NOW)["replayed"] == 1
    purge_expired(repo, NOW, tmp_path)
    assert not any(record["active"] and not record["withdrawn"] for record in repo.list_records())
    assert all(record["raw_text"] is None for record in repo.list_records())


def test_live_restoration_of_historical_xml_creates_new_transition_without_restoring_erased_row(
    repo, tmp_path
):
    repo.update_source("find_case_law", {"permissions": {"current_version_only": True}})
    xml_a = legal_xml().replace(
        b"</FRBRWork>",
        b'</FRBRWork><FRBRManifestation><FRBRdate name="transform" '
        b'date="2026-09-11T00:00:00Z" /></FRBRManifestation>',
    )
    old_a = seed(repo, xml=xml_a)
    original_id = repo.list_records()[0]["id"]
    seed(repo, xml=xml_a.replace(b"dismissed", b"allowed"))
    purge_expired(repo, NOW, tmp_path)
    current_b = next(record for record in repo.list_records() if record["active"])
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=xml_a))
    ) as client:
        restored_a = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    counts = repo.ingest_batch("find_case_law", restored_a, NOW)
    assert counts["updated"] == 1 and counts["replayed"] == 0
    assert restored_a.documents[0].payload["current_replaces_record_id"] == current_b["id"]
    assert restored_a.documents[0].published_at == old_a.published_at
    assert restored_a.documents[0].payload["updated_at"] == old_a.payload["updated_at"]
    purge_expired(repo, NOW, tmp_path)
    current_a = next(record for record in repo.list_records() if record["active"])
    assert current_a["id"] != original_id and current_a["raw_text"] == old_a.raw_text
    erased_a = next(record for record in repo.list_records() if record["id"] == original_id)
    assert erased_a["raw_text"] is None and erased_a["payload"]["erasure"]
    # An unverified old envelope still cannot revive its erased historical record.
    assert repo.ingest_batch("find_case_law", FetchBatch(documents=[old_a]), NOW)["replayed"] == 1
    assert (
        next(record for record in repo.list_records() if record["active"])["id"] == current_a["id"]
    )


def test_bounded_cycle_resumes_and_does_not_claim_completion_early(repo):
    for number in (10, 11, 12):
        seed(repo, f"ewhc/tcc/2026/{number}")
    source = repo.get_source("find_case_law")
    source["config"] = {"revalidation_limit": 2}
    calls = []

    def response(request):
        calls.append(str(request.url))
        return httpx.Response(200, content=legal_xml())

    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        first = revalidate_retained_cases(repo, source, client, NOW)
        assert not first.complete and len(calls) == 2
        state = json.loads(first.cursor)["current_records"]
        assert state["after_external_id"] == "ewhc/tcc/2026/11"
        assert state["stop_reason"] == "batch_limit" and state["last_complete_at"] is None
        source["cursor"] = first.cursor
        second = revalidate_retained_cases(repo, source, client, NOW + timedelta(hours=1))
    assert second.complete and len(calls) == 3
    assert (
        json.loads(second.cursor)["current_records"]["last_complete_at"]
        == (NOW + timedelta(hours=1)).isoformat()
    )


def test_success_before_failed_record_is_checkpointed_but_failed_record_is_retried(repo):
    for number in (10, 11, 12):
        seed(repo, f"ewhc/tcc/2026/{number}")

    def response(request):
        if "/10/" in str(request.url):
            return httpx.Response(404)
        return httpx.Response(500)

    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    state = json.loads(batch.cursor)["current_records"]
    assert not batch.complete and len(batch.documents) == 1
    assert state["after_external_id"] == "ewhc/tcc/2026/10"
    assert state["checked_count"] == 1 and state["stop_reason"] == "check_failed"


def test_only_active_find_case_law_records_are_revalidated(repo):
    seed(repo)
    seed(repo, xml=legal_xml(body="The revised construction claim."))
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(410))) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert json.loads(batch.cursor)["current_records"]["checked_count"] == 1
    repo.ingest_batch("find_case_law", batch, NOW)
    with repo.engine.connect() as connection:
        assert len(connection.execute(select(SourceRecord.id)).all()) == 3
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: pytest.fail("No active XML remains"))
    ) as client:
        empty = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    assert empty.complete and not empty.documents


def test_rate_budget_counts_redirects_and_stops_without_false_withdrawal(repo, monkeypatch):
    seed(repo)
    acquired = []

    def acquire(self):
        acquired.append(True)
        return None if len(acquired) == 1 else 40

    monkeypatch.setattr("meritus.sources.caselaw.FileSlidingWindowBudget.acquire", acquire)
    calls = []

    def response(request):
        calls.append(str(request.url))
        return httpx.Response(302, headers={"location": f"https://{HOST}/renamed/data.xml"})

    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        batch = revalidate_retained_cases(repo, repo.get_source("find_case_law"), client, NOW)
    state = json.loads(batch.cursor)["current_records"]
    assert len(acquired) == 2 and len(calls) == 1
    assert not batch.complete and not batch.documents
    assert state["stop_reason"] == "rate_limit" and state["retry_after_seconds"] == 40
    assert state["after_external_id"] is None


def test_http_error_exposes_actual_status_without_response_content():
    with (
        httpx.Client(
            transport=httpx.MockTransport(lambda _: httpx.Response(404, content=b"private"))
        ) as client,
        pytest.raises(FetchError) as error,
    ):
        fetch_bytes(client, f"https://{HOST}/missing/data.xml", allowed_hosts={HOST})
    assert error.value.status_code == 404 and "private" not in str(error.value)


def test_http_request_budget_counts_retry_attempts():
    acquired = []
    calls = []

    def acquire():
        acquired.append(True)

    def response(request):
        calls.append(str(request.url))
        return (
            httpx.Response(503, headers={"retry-after": "1"})
            if len(calls) == 1
            else httpx.Response(200, content=b"ok")
        )

    with httpx.Client(transport=httpx.MockTransport(response)) as client:
        content, _, status = fetch_bytes(
            client,
            f"https://{HOST}/example/data.xml",
            allowed_hosts={HOST},
            before_request=acquire,
            sleep=lambda _: None,
        )
    assert status == 200 and content == b"ok"
    assert len(acquired) == len(calls) == 2
