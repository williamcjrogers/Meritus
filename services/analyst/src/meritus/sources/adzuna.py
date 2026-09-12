"""Official Adzuna UK job-search adapter with repost grouping."""

from __future__ import annotations

import hashlib
import json
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from meritus.config import Settings
from meritus.domain import FetchBatch, ParsedDocument
from meritus.sources.common import organisation, source_date, source_json
from meritus.sources.documents import FileSlidingWindowBudget
from meritus.sources.extraction import extract_document
from meritus.sources.http import FetchError, RateLimited, fetch_bytes

API_ROOT = "https://api.adzuna.com/v1/api/jobs/gb/search"
HOSTS = {"api.adzuna.com"}
PUBLIC_HOSTS = {"adzuna.co.uk", "www.adzuna.co.uk"}
_SECRET_QUERY = {"app_id", "app_key", "api_key", "key", "token", "access_token"}
_QUOTA_WINDOWS = {
    "minute": 60,
    "day": 86_400,
    "week": 604_800,
    "month": 2_678_400,
}


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _sanitise_url(value: str) -> str:
    parts = urlsplit(value)
    if (
        parts.scheme != "https"
        or parts.hostname not in PUBLIC_HOSTS
        or parts.username
        or parts.password
    ):
        return "https://www.adzuna.co.uk/"
    query = urlencode(
        [(key, item) for key, item in parse_qsl(parts.query) if key.casefold() not in _SECRET_QUERY]
    )
    return urlunsplit(("https", parts.netloc, parts.path, query, ""))


def _repost_key(item: dict) -> str:
    company = _clean((item.get("company") or {}).get("display_name")).casefold()
    title = _clean(item.get("title")).casefold()
    location = _clean((item.get("location") or {}).get("display_name")).casefold()
    description = _clean(item.get("description")).casefold()
    basis = "\n".join((company, title, location, description))
    return hashlib.sha256(basis.encode()).hexdigest()[:32]


def parse_jobs(results: list[dict]) -> list[ParsedDocument]:
    groups: dict[str, list[dict]] = {}
    for item in results:
        if not isinstance(item, dict) or not _clean(item.get("id")):
            raise ValueError("Adzuna result has no stable identifier.")
        groups.setdefault(_repost_key(item), []).append(item)
    documents = []
    for group_key, items in groups.items():
        items.sort(key=lambda item: (_clean(item.get("created")), _clean(item.get("id"))))
        representative = items[-1]
        company = (
            _clean((representative.get("company") or {}).get("display_name"))
            or "Unresolved employer"
        )
        title = _clean(representative.get("title")) or "Untitled vacancy"
        description = _clean(representative.get("description"))
        location = _clean((representative.get("location") or {}).get("display_name"))
        published = source_date(representative.get("created"))
        if published is None:
            raise ValueError("Adzuna result has no valid creation date.")
        entity = organisation("adzuna", group_key, company)
        source_url = _sanitise_url(_clean(representative.get("redirect_url")))
        extracted = extract_document(f"{title}. {description}", source_url, published, [entity])
        observations = [item for item in extracted.observations if item.kind == "claims_hiring"]
        for observation in observations:
            observation.event_key = f"adzuna:repost:{group_key}"
            observation.attributes.update(
                {
                    "amplifier_only": True,
                    "location": location or None,
                    "repost_count": len(items),
                }
            )
        repost_ids = [_clean(item["id"]) for item in items]
        documents.append(
            ParsedDocument(
                external_id=f"adzuna:{group_key}",
                source_url=source_url,
                title=f"{company}: {title}",
                published_at=published,
                payload={
                    "original_url": source_url,
                    "job_id": _clean(representative["id"]),
                    "repost_ids": repost_ids,
                    "company": company,
                    "title": title,
                    "location": location,
                    "created": representative.get("created"),
                    "locations": extracted.payload["locations"],
                },
                entities=[entity],
                observations=observations,
                warnings=["Job advertisements are amplifier-only and require analyst review."]
                if observations
                else [],
                media_type="application/json",
            )
        )
    return documents


def _acquire_request_quota(config: dict, settings: Settings) -> None:
    quotas = config.get("request_quotas")
    if not isinstance(quotas, dict) or set(quotas) != set(_QUOTA_WINDOWS):
        raise FetchError(
            "Adzuna account minute, day, week and month request quotas must be configured."
        )
    for name, seconds in _QUOTA_WINDOWS.items():
        limit = quotas[name]
        if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
            raise FetchError("Adzuna account request quotas must be positive integers.")
        wait = FileSlidingWindowBudget(
            settings.data_dir / "rate-limits" / f"adzuna-{name}.json",
            limit=limit,
            window_seconds=seconds,
        ).acquire()
        if wait:
            raise RateLimited(wait)


class AdzunaAdapter:
    def fetch(self, source, client, now):
        settings = Settings()
        app_id = settings.adzuna_app_id.get_secret_value() if settings.adzuna_app_id else ""
        app_key = settings.adzuna_app_key.get_secret_value() if settings.adzuna_app_key else ""
        if not app_id or not app_key:
            raise FetchError("Adzuna credentials are not configured.")
        config = source.get("config") or {}
        pages = min(max(int(config.get("pages", 1)), 1), 10)
        results = []
        for page in range(1, pages + 1):
            _acquire_request_quota(config, settings)
            content, _, _ = fetch_bytes(
                client,
                f"{API_ROOT}/{page}",
                allowed_hosts=HOSTS,
                params={
                    "app_id": app_id,
                    "app_key": app_key,
                    "results_per_page": min(max(int(config.get("results_per_page", 50)), 1), 50),
                    "what": str(config.get("query") or "construction claims"),
                    "content-type": "application/json",
                },
                max_bytes=5_000_000,
            )
            payload = source_json(content)
            page_results = payload.get("results") if isinstance(payload, dict) else None
            if not isinstance(page_results, list):
                raise FetchError("Adzuna response has no results list.")
            results.extend(page_results)
            if not page_results:
                break
        return FetchBatch(
            documents=parse_jobs(results),
            cursor=json.dumps({"retrieved_at": now.isoformat()}, sort_keys=True),
        )


__all__ = ["API_ROOT", "AdzunaAdapter", "parse_jobs"]
