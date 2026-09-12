from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event
from time import sleep

import pytest

from meritus.sources.hmcts import HMCTSAdapter, receive_publication
from meritus.sources.policy import SourceBlocked


def _enable(repo, now):
    repo.update_source(
        "hmcts",
        {
            "enabled": True,
            "permissions": {
                "reference": "synthetic-test-grant",
                "scope": {"retrieve": True, "analyse": True, "sensitivity": ["PUBLIC"]},
                "reviewed_at": now.isoformat(),
                "operations": ["retrieve", "analyse"],
            },
        },
    )


def _set_retention(repo, days):
    repo.update_source("hmcts", {"permissions": {"retention_days": days}})


def _payload(version=1, expiry="2026-10-12T09:30:00Z"):
    return {
        "version": version,
        "sensitivity": "PUBLIC",
        "title": "Synthetic hearing publication",
        "published_at": "2026-09-12T08:00:00Z",
        "expires_at": expiry,
        "source_url": "https://www.court-tribunal-hearings.service.gov.uk/publication-1",
        "content": "A public hearing listing for Example Limited.",
        "media_type": "text/plain",
    }


def test_receiver_requires_permission_before_parsing(repo, now):
    with pytest.raises(SourceBlocked):
        receive_publication(repo, "publication-1", "POST", {"broken": object()}, now=now)


def test_receiver_versions_replaces_and_withdraws(repo, now):
    _enable(repo, now)
    created = receive_publication(repo, "publication-1", "POST", _payload(), now=now)
    replaced = receive_publication(repo, "publication-1", "PUT", _payload(2), now=now)
    withdrawn = receive_publication(repo, "publication-1", "DELETE", {}, now=now)

    assert created["status"] == "created"
    assert replaced["status"] == "replaced"
    assert withdrawn["status"] == "withdrawn"
    records = [item for item in repo.list_records(limit=100) if item["source_id"] == "hmcts"]
    assert [item["revision"] for item in records] == [3, 2, 1]
    assert records[0]["withdrawn"] is True
    assert records[0]["expires_at"] == now.isoformat()
    assert records[1]["payload"]["publication_version"] == 2


def test_receiver_rejects_non_public_scope_and_stale_version(repo, now):
    _enable(repo, now)
    secret = _payload()
    secret["sensitivity"] = "PRIVATE"
    with pytest.raises(SourceBlocked):
        receive_publication(repo, "publication-1", "POST", secret, now=now)
    receive_publication(repo, "publication-1", "POST", _payload(2), now=now)
    with pytest.raises(ValueError, match="newer"):
        receive_publication(repo, "publication-1", "PUT", _payload(2), now=now)


def test_hmcts_adapter_never_claims_pull_success():
    with pytest.raises(SourceBlocked, match="receiver"):
        HMCTSAdapter().fetch({}, object(), datetime(2026, 9, 12, tzinfo=UTC))


def test_receiver_requires_publication_expiry_or_finite_grant_retention(repo, now):
    _enable(repo, now)
    without_expiry = _payload(expiry=None)

    with pytest.raises(ValueError, match=r"expiry or.*retention_days"):
        receive_publication(repo, "publication-1", "POST", without_expiry, now=now)

    _set_retention(repo, 7)
    receive_publication(repo, "publication-1", "POST", without_expiry, now=now)
    record = next(item for item in repo.list_records() if item["source_id"] == "hmcts")
    assert record["expires_at"] == (now + timedelta(days=7)).isoformat()


def test_receiver_caps_publication_expiry_by_grant_retention(repo, now):
    _enable(repo, now)
    _set_retention(repo, 3)

    receive_publication(
        repo,
        "publication-1",
        "POST",
        _payload(expiry=(now + timedelta(days=30)).isoformat()),
        now=now,
    )

    record = next(item for item in repo.list_records() if item["source_id"] == "hmcts")
    assert record["expires_at"] == (now + timedelta(days=3)).isoformat()


@pytest.mark.parametrize("retention_days", [True, 0, -1, "7"])
def test_receiver_rejects_invalid_grant_retention(repo, now, retention_days):
    _enable(repo, now)
    _set_retention(repo, retention_days)

    with pytest.raises(ValueError, match="retention_days"):
        receive_publication(repo, "publication-1", "POST", _payload(expiry=None), now=now)


def test_receiver_rejects_already_expired_publication(repo, now):
    _enable(repo, now)

    with pytest.raises(ValueError, match="future"):
        receive_publication(
            repo,
            "publication-1",
            "POST",
            _payload(expiry=(now - timedelta(seconds=1)).isoformat()),
            now=now,
        )


def test_concurrent_late_older_put_cannot_regress_active_publication(repo, now, monkeypatch):
    if repo.engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL row-lock verification")
    import meritus.sources.hmcts as hmcts

    _enable(repo, now)
    receive_publication(repo, "publication-1", "POST", _payload(), now=now)
    entered = Event()
    release = Event()
    original_extract = hmcts.extract_document

    def blocking_extract(raw_text, source_url, published_at, entities):
        if raw_text == "version 3":
            entered.set()
            assert release.wait(timeout=5)
        return original_extract(raw_text, source_url, published_at, entities)

    monkeypatch.setattr(hmcts, "extract_document", blocking_extract)
    newer = _payload(3)
    newer["content"] = "version 3"
    older = _payload(2)
    older["content"] = "version 2"

    with ThreadPoolExecutor(max_workers=2) as executor:
        latest = executor.submit(receive_publication, repo, "publication-1", "PUT", newer, now)
        assert entered.wait(timeout=5)
        late = executor.submit(receive_publication, repo, "publication-1", "PUT", older, now)
        sleep(0.1)
        assert not late.done()
        release.set()
        assert latest.result(timeout=5)["version"] == 3
        with pytest.raises(ValueError, match="newer"):
            late.result(timeout=5)

    records = [item for item in repo.list_records(limit=100) if item["source_id"] == "hmcts"]
    active = [item for item in records if item["active"]]
    assert len(active) == 1
    assert active[0]["payload"]["publication_version"] == 3
