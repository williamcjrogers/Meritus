import httpx
from sqlalchemy import select

from meritus.config import Settings
from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.models import Outbox
from meritus.search import SearchIndex


def seed(repo, now):
    entity = EntityInput(
        key="GB-COH:09999999",
        scheme="GB-COH",
        identifier="09999999",
        name="Synthetic Search Ltd",
        verified=True,
    )
    doc = ParsedDocument(
        external_id="one",
        source_url="https://example.org/source",
        title="Synthetic evidence",
        published_at=now,
        payload={},
        entities=[entity],
        observations=[
            ObservationInput(
                subject_key=entity.key,
                kind="project_delay",
                event_key="one",
                headline="Test event",
                detail="Synthetic detail",
            )
        ],
    )
    repo.ingest_batch("find_tender", FetchBatch(documents=[doc]), now)
    return repo.list_records()[0]


def test_outbox_failure_remains_pending_with_attempt_count(repo, now, tmp_path):
    seed(repo, now)

    def handler(request):
        return httpx.Response(503, json={"error": "unavailable"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = SearchIndex(Settings(data_dir=tmp_path), client=client).drain_outbox(repo)
    assert result["failed"] == 1 and result["processed"] == 0
    with session_scope(repo.engine) as session:
        row = session.scalar(select(Outbox))
        assert row.attempts == 1 and row.processed_at is None


def test_denied_source_is_deleted_and_not_indexed(repo, now, tmp_path):
    seed(repo, now)
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    requests = []

    def handler(request):
        requests.append(request)
        if request.method == "HEAD":
            return httpx.Response(200)
        return httpx.Response(200, json={"acknowledged": True, "deleted": 1})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = SearchIndex(Settings(data_dir=tmp_path), client=client).drain_outbox(repo)
    assert result["processed"] >= 1
    assert any(request.url.path.endswith("/_delete_by_query") for request in requests)
    assert not any(request.method == "PUT" and "/_doc/" in request.url.path for request in requests)


def test_successful_projection_acknowledges_evidence_and_entity(repo, now, tmp_path):
    record = seed(repo, now)
    requests = []

    def handler(request):
        requests.append(request)
        if request.method == "HEAD":
            return httpx.Response(200)
        return httpx.Response(200, json={"acknowledged": True, "deleted": 0})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert SearchIndex(Settings(data_dir=tmp_path), client=client).drain_outbox(repo) == {
            "processed": 1,
            "failed": 0,
        }
    docs = [
        request for request in requests if request.method == "PUT" and "/_doc/" in request.url.path
    ]
    assert len(docs) == 2
    assert all(request.url.params["require_alias"] == "true" for request in docs)
    assert any(record["id"] in request.url.path for request in docs)
    with session_scope(repo.engine) as session:
        assert session.scalar(select(Outbox)).processed_at is not None


def test_failed_bulk_does_not_swap_working_aliases_or_ack_outbox(repo, now, tmp_path):
    import pytest

    seed(repo, now)
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.path == "/_bulk":
            return httpx.Response(200, json={"errors": True})
        return httpx.Response(200, json={"acknowledged": True})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as client,
        pytest.raises(ValueError, match="rejected"),
    ):
        SearchIndex(Settings(data_dir=tmp_path), client=client).reindex(repo)
    assert not any(request.url.path == "/_aliases" for request in requests)
    with session_scope(repo.engine) as session:
        assert session.scalar(select(Outbox)).processed_at is None


def test_permission_change_requeues_previously_processed_records(repo, now, tmp_path):
    seed(repo, now)
    with session_scope(repo.engine) as session:
        for row in session.scalars(select(Outbox)):
            row.processed_at = now
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    with session_scope(repo.engine) as session:
        assert session.scalar(select(Outbox).where(Outbox.processed_at.is_(None))) is not None


def test_publisher_withdrawal_deletes_entire_lineage_and_previous_entity(repo, now, tmp_path):
    seed(repo, now)
    identifier = repo.list_entities()[0]["id"]
    with session_scope(repo.engine) as session:
        for row in session.scalars(select(Outbox)):
            row.processed_at = now
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="one",
                    source_url="https://example.org/source",
                    title="Withdrawn",
                    published_at=now,
                    withdrawn=True,
                    payload={"version": 2},
                )
            ]
        ),
        now,
    )
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"acknowledged": True, "deleted": 1})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        SearchIndex(Settings(data_dir=tmp_path), client=client).drain_outbox(repo)
    assert any(request.url.path.endswith("/_delete_by_query") for request in requests)
    assert any(
        request.method == "DELETE" and identifier in request.url.path for request in requests
    )
    assert not any(request.method == "PUT" and "/_doc/" in request.url.path for request in requests)


def test_expired_stored_grant_requeues_even_when_retention_keeps_raw_record(
    repo, now, tmp_path, monkeypatch
):
    from datetime import timedelta

    from meritus.models import SourceRecord

    record = seed(repo, now)
    with session_scope(repo.engine) as session:
        for row in session.scalars(select(Outbox)):
            row.processed_at = now - timedelta(hours=2)
        row = session.get(SourceRecord, record["id"])
        row.payload = {
            "import_permission": {
                "expires_at": (now - timedelta(hours=1)).isoformat(),
                "retain_after_permission_expiry": True,
            }
        }
    monkeypatch.setattr("meritus.search.utc_now", lambda: now)
    monkeypatch.setattr("meritus.search.purge_expired", lambda *args, **kwargs: {})
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"deleted": 1, "acknowledged": True})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        index = SearchIndex(Settings(data_dir=tmp_path), client=client)
        assert index.drain_outbox(repo)["processed"] == 1
        assert index.drain_outbox(repo)["processed"] == 0
    assert any(request.url.path.endswith("/_delete_by_query") for request in requests)
    assert not any(request.method == "PUT" and "/_doc/" in request.url.path for request in requests)


def test_restore_lock_is_reentrant_and_invalidation_only_removes_managed_indices(tmp_path):
    requests = []

    def handler(request):
        requests.append(request)
        if "_cat/indices" in request.url.path:
            return httpx.Response(
                200,
                json=[
                    {"index": "meritus-evidence-v1-test"},
                    {"index": "meritus-evidence-unmanaged"},
                    {"index": "other"},
                ],
            )
        return httpx.Response(200, json={"acknowledged": True})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        index = SearchIndex(Settings(data_dir=tmp_path), client=client)
        with index.exclusive():
            assert index.invalidate()["indices_removed"] == 1
    assert [request.url.path for request in requests if request.method == "DELETE"] == [
        "/meritus-evidence-v1-test"
    ]
