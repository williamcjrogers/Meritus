from datetime import UTC, datetime

import pytest

from meritus.sources.adzuna import AdzunaAdapter, parse_jobs
from meritus.sources.http import FetchError
from meritus.sources.news import APPROVED_FEEDS, parse_rss
from meritus.sources.registry import get_adapter
from meritus.sources.runner import run_source


def test_adzuna_reposts_group_without_credentials_or_duplicate_signal():
    results = [
        {
            "id": "one",
            "title": "Senior Claims Manager",
            "description": "Lead construction claims in London",
            "created": "2026-09-11T09:00:00Z",
            "redirect_url": "https://www.adzuna.co.uk/jobs/details/one?app_key=secret&tracking=ok",
            "company": {"display_name": "Example Limited"},
            "location": {"display_name": "London"},
        },
        {
            "id": "two",
            "title": "Senior Claims Manager",
            "description": "Lead construction claims in London",
            "created": "2026-09-12T09:00:00Z",
            "redirect_url": "https://www.adzuna.co.uk/jobs/details/two?app_id=secret&tracking=ok",
            "company": {"display_name": "Example Limited"},
            "location": {"display_name": "London"},
        },
    ]
    documents = parse_jobs(results)
    assert len(documents) == 1
    assert documents[0].payload["repost_ids"] == ["one", "two"]
    assert all(item.state == "pending" for item in documents[0].observations)
    assert documents[0].observations[0].attributes["amplifier_only"] is True
    assert "secret" not in documents[0].model_dump_json()


def test_adzuna_requires_account_quotas_before_network(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_ADZUNA_APP_ID", "licensed-app")
    monkeypatch.setenv("MERITUS_ADZUNA_APP_KEY", "licensed-key")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))

    class NoNetworkClient:
        requests = 0

        def stream(self, *args, **kwargs):
            self.requests += 1
            raise AssertionError("network must not be reached")

    client = NoNetworkClient()
    with pytest.raises(FetchError, match="quotas"):
        AdzunaAdapter().fetch(
            {"config": {}, "cursor": None},
            client,
            datetime(2026, 9, 12, tzinfo=UTC),
        )
    assert client.requests == 0


def test_construction_index_groups_same_article_across_feeds():
    feed = b"""<rss version="2.0"><channel><title>Construction Index</title><item>
      <guid>article-7</guid><title>Example contract delayed</title>
      <link>https://www.theconstructionindex.co.uk/news/view/example-contract-delayed</link>
      <pubDate>Fri, 11 Sep 2026 09:00:00 GMT</pubDate>
      <description>Completion slipped by 4 weeks.</description>
    </item></channel></rss>"""
    first = parse_rss(feed, APPROVED_FEEDS[0])
    second = parse_rss(feed, APPROVED_FEEDS[1])
    assert first[0].external_id == second[0].external_id
    assert first[0].observations[0].event_key == second[0].observations[0].event_key
    assert first[0].raw_text is None


def test_construction_index_rejects_unapproved_feed():
    with pytest.raises(ValueError, match="approved"):
        parse_rss(b"<rss/>", "https://www.theconstructionindex.co.uk/feeds/other.xml")


@pytest.mark.parametrize("source_id", ["find_case_law", "rns", "adzuna", "construction_index"])
def test_unlicensed_source_never_reaches_network(repo, source_id):
    class NoNetworkClient:
        def __init__(self):
            self.requests = []

        def stream(self, *args, **kwargs):
            self.requests.append((args, kwargs))
            raise AssertionError("network must not be reached")

    client = NoNetworkClient()
    result = run_source(repo, source_id, client=client)
    assert result["status"] == "blocked"
    assert client.requests == []


@pytest.mark.parametrize(
    "source_id", ["hmcts", "find_case_law", "rns", "adzuna", "construction_index"]
)
def test_licensed_source_adapters_are_registered(source_id):
    assert callable(get_adapter(source_id).fetch)
