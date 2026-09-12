from datetime import UTC, datetime, timedelta

import pytest

from meritus.sources.policy import SourceBlocked, permission_allows, resolve_source_for_url

NOW = datetime(2026, 9, 12, tzinfo=UTC)


def grant(**changes):
    value = {
        "reference": "grant-123",
        "scope": "Meritus origination research",
        "reviewed_at": (NOW - timedelta(days=1)).isoformat(),
        "operations": ["retrieve", "import", "analyse", "export"],
        "expires_at": (NOW + timedelta(days=30)).isoformat(),
    }
    value.update(changes)
    return value


def test_public_catalogue_rights_do_not_depend_on_feed_credentials(repo):
    source = repo.get_source("payment_practices")
    assert permission_allows(source, "import", NOW)
    assert permission_allows(source, "export", NOW)


@pytest.mark.parametrize(
    "changes",
    [
        {"reference": ""},
        {"scope": ""},
        {"reviewed_at": "not-a-date"},
        {"operations": ["retrieve"]},
        {"expires_at": "not-a-date"},
        {"expires_at": (NOW - timedelta(seconds=1)).isoformat()},
    ],
)
def test_restricted_permission_fields_fail_closed(repo, changes):
    repo.update_source("rns", {"permissions": grant(**changes)})
    assert not permission_allows(repo.get_source("rns"), "import", NOW)


def test_known_url_cannot_be_disguised_as_reviewed_import(repo):
    with pytest.raises(SourceBlocked, match="not declared source"):
        resolve_source_for_url(
            repo,
            "https://www.londonstockexchange.com/news/example",
            "reviewed_import",
        )


@pytest.mark.parametrize(
    "source_url",
    [
        "//www.londonstockexchange.com/news/example",
        "www.londonstockexchange.com/news/example",
        "londonstockexchange.com/news/example",
        "ftp://www.londonstockexchange.com/news/example",
        "https://www%2elondonstockexchange.com/news/example",
        "https://evil.example\\www.londonstockexchange.com/news/example",
        "https://user:password@www.londonstockexchange.com/news/example",
    ],
)
def test_source_resolution_rejects_non_absolute_http_urls(repo, source_url):
    with pytest.raises(SourceBlocked, match=r"absolute HTTP\(S\)"):
        resolve_source_for_url(repo, source_url, "reviewed_import")


def test_rns_onboarding_subdomains_resolve_to_restricted_source(repo):
    source = resolve_source_for_url(repo, "https://tenant.rns-distribution.com/announcements")
    assert source["id"] == "rns"


def test_known_restricted_publisher_without_source_is_blocked(repo):
    with pytest.raises(SourceBlocked, match="known restricted publisher"):
        resolve_source_for_url(repo, "https://www.balfourbeatty.com/investors/results.pdf")


def test_ongoing_permission_can_omit_grant_expiry(repo):
    repo.update_source("rns", {"permissions": grant(expires_at=None)})
    assert permission_allows(repo.get_source("rns"), "import", NOW)


def test_construction_index_grant_cannot_authorise_construction_enquirer(repo):
    repo.update_source("construction_index", {"permissions": grant()})
    with pytest.raises(SourceBlocked, match="construction_enquirer"):
        resolve_source_for_url(repo, "https://www.constructionenquirer.com/article")
