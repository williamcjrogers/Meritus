import json
from datetime import timedelta

import pytest

from meritus.domain import FetchBatch, ParsedDocument
from meritus.sources.http import FetchError
from meritus.sources.runner import run_source


@pytest.fixture
def licensed(repo, now, monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    repo.update_source(
        "find_case_law",
        {
            "enabled": True,
            "permissions": {
                "reference": "synthetic-current-version-licence",
                "scope": "Synthetic controlled testing",
                "reviewed_at": (now - timedelta(days=1)).isoformat(),
                "operations": ["retrieve", "analyse", "export"],
                "current_version_only": True,
            },
        },
    )
    return repo


def checked_batch(now, reason="complete"):
    return FetchBatch(
        documents=[
            ParsedDocument(
                external_id="ewhc/tcc/2026/99999",
                source_url="https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/99999",
                title="Withdrawn judgment",
                published_at=None,
                payload={},
                withdrawn=True,
            )
        ],
        cursor=json.dumps({"current_records": {"stop_reason": reason}}),
        complete=reason == "complete",
        warnings=[] if reason == "complete" else ["Retained-case checks are incomplete."],
    )


def install_checks(monkeypatch, batch, purge):
    monkeypatch.setattr(
        "meritus.sources.caselaw.revalidate_retained_cases",
        lambda *args: batch,
        raising=False,
    )
    monkeypatch.setattr("meritus.sources.runner.purge_expired", purge)


def test_reconciliation_is_committed_and_erased_before_new_feed(licensed, now, monkeypatch):
    seen = []

    def purge(*args):
        seen.append("purge")
        return {"complete": True, "unresolved_artifacts": []}

    class Adapter:
        def fetch(self, source, client, cutoff):
            assert seen == ["purge"]
            assert json.loads(source["cursor"])["current_records"]["stop_reason"] == "complete"
            seen.append("feed")
            return FetchBatch(cursor=source["cursor"])

    install_checks(monkeypatch, checked_batch(now), purge)
    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: Adapter())
    result = run_source(licensed, "find_case_law", now)
    assert result["status"] == "success"
    assert result["fetched"] == 1
    assert licensed.list_runs()[0]["fetched"] == 1
    assert seen == ["purge", "feed", "purge"]


@pytest.mark.parametrize("reason", ["rate_limit", "check_failed"])
def test_incomplete_publisher_checks_stop_new_collection(licensed, now, monkeypatch, reason):
    class Adapter:
        def fetch(self, *args):
            pytest.fail("New collection must not run after a failed publisher check")

    batch = checked_batch(now, reason)
    install_checks(monkeypatch, batch, lambda *args: {"complete": True, "unresolved_artifacts": []})
    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: Adapter())
    result = run_source(licensed, "find_case_law", now)
    assert result["status"] == "partial"
    assert result["fetched"] == 1
    assert licensed.get_source("find_case_law")["cursor"] == batch.cursor


def test_later_feed_failure_preserves_completed_reconciliation(licensed, now, monkeypatch):
    class Adapter:
        def fetch(self, *args):
            raise FetchError("Synthetic feed outage")

    batch = checked_batch(now)
    install_checks(monkeypatch, batch, lambda *args: {"complete": True, "unresolved_artifacts": []})
    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: Adapter())
    result = run_source(licensed, "find_case_law", now)
    assert result["status"] == "failed"
    assert "completed batch was committed" in result["error"]
    assert licensed.get_source("find_case_law")["cursor"] == batch.cursor
    assert licensed.list_runs()[0]["fetched"] == 1


def test_managed_file_erasure_failure_stops_new_collection(licensed, now, monkeypatch):
    class Adapter:
        def fetch(self, *args):
            pytest.fail("Collection must stop until licensed content can be erased")

    install_checks(
        monkeypatch,
        checked_batch(now),
        lambda *args: {"complete": False, "unresolved_artifacts": [{"path": "synthetic"}]},
    )
    monkeypatch.setattr("meritus.sources.runner.get_adapter", lambda _: Adapter())
    result = run_source(licensed, "find_case_law", now)
    assert result["status"] == "failed"
    assert licensed.list_runs()[0]["fetched"] == 1


def test_revocation_during_reconciliation_prevents_commit(licensed, now, monkeypatch):
    def checks(*args):
        licensed.update_source("find_case_law", {"permissions": {"denied": True}})
        return checked_batch(now)

    monkeypatch.setattr("meritus.sources.caselaw.revalidate_retained_cases", checks, raising=False)
    result = run_source(licensed, "find_case_law", now)
    assert result["status"] == "blocked"
    assert licensed.get_source("find_case_law")["cursor"] is None
    assert licensed.list_runs()[0]["rejected"] == 1
