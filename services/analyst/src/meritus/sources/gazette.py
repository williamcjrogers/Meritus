"""Corporate Gazette notices under the documented public fair-use window."""

from __future__ import annotations

import json
import re
import threading
import time
from collections import deque
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from meritus.config import Settings
from meritus.domain import FetchBatch, ObservationInput, ParsedDocument
from meritus.sources.common import organisation, source_date
from meritus.sources.documents import FileSlidingWindowBudget
from meritus.sources.http import RateLimited, fetch_bytes
from meritus.sources.policy import SourceBlocked

FEED_URL = "https://www.thegazette.co.uk/insolvency/notice/data.json"
GAZETTE_HOSTS = {"www.thegazette.co.uk", "thegazette.co.uk"}
PUBLIC_REQUEST_LIMIT = 5
PUBLIC_WINDOW_SECONDS = 10
_LONDON = ZoneInfo("Europe/London")
_NOTICE_ID = re.compile(r"^(?:[0-9]+|[LEB]-[0-9]+-[0-9]+)$", re.IGNORECASE)

# Official Gazette notice taxonomy identifiers. Classification never uses prose keywords.
PETITION_CODES = {"2450"}
CORPORATE_INSOLVENCY_CODES = {
    "2401",
    "2402",
    "2410",
    "2411",
    "2412",
    "2421",
    "2430",
    "2431",
    "2441",
    "2450",
    "2451",
    "2460",
    "2461",
    "2462",
    "2463",
    "2464",
    "2465",
    "2466",
    "2467",
    "2468",
    "2469",
    "2470",
}


class GazetteRateLimiter:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        now = self.clock()
        with self._lock:
            while self._calls and self._calls[0] <= now - PUBLIC_WINDOW_SECONDS:
                self._calls.popleft()
            if len(self._calls) >= PUBLIC_REQUEST_LIMIT:
                retry = max(1, int(PUBLIC_WINDOW_SECONDS - (now - self._calls[0])) + 1)
                raise RateLimited(retry)
            self._calls.append(now)


_RATE_LIMITER = GazetteRateLimiter()


def _acquire_shared_budget(data_dir: Path | str) -> None:
    retry = FileSlidingWindowBudget(
        Path(data_dir) / "source-rate-limits" / "gazette.json",
        limit=PUBLIC_REQUEST_LIMIT,
        window_seconds=PUBLIC_WINDOW_SECONDS,
    ).acquire()
    if retry is not None:
        raise RateLimited(retry)


def gazette_window_open(now: datetime) -> bool:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Gazette schedule checks require an aware datetime.")
    hour = now.astimezone(_LONDON).hour
    return hour >= 21 or hour < 7


def _recursive_values(value, keys: set[str]):
    if isinstance(value, dict):
        for key, item in value.items():
            if key.rsplit("/", 1)[-1].rsplit("#", 1)[-1] in keys and item not in (None, ""):
                yield item
            yield from _recursive_values(item, keys)
    elif isinstance(value, list):
        for item in value:
            yield from _recursive_values(item, keys)


def _scalar(value):
    if isinstance(value, list):
        return _scalar(value[0]) if value else None
    if isinstance(value, dict):
        return value.get("@value") or value.get("value") or value.get("id") or value.get("@id")
    return value


def _notice_id(notice: dict) -> str:
    candidate = _scalar(notice.get("hasNoticeID") or notice.get("noticeID") or notice.get("id"))
    if candidate and "://" in str(candidate):
        path = urlsplit(str(candidate)).path.rstrip("/")
        candidate = path.rsplit("/", 1)[-1] if "/notice/" in path else None
    if not candidate:
        path = urlsplit(str(notice.get("@id") or notice.get("uri") or "")).path.rstrip("/")
        candidate = path.rsplit("/", 1)[-1] if "/notice/" in path else None
    candidate = str(candidate or "")
    if not _NOTICE_ID.fullmatch(candidate):
        raise ValueError("Gazette notice ID is malformed.")
    return candidate


def _notice_code(notice: dict) -> str | None:
    candidate = _scalar(
        notice.get("hasNoticeCode") or notice.get("noticeCode") or notice.get("f:notice-code")
    )
    if candidate is None:
        values = list(_recursive_values(notice, {"hasNoticeCode", "noticeCode"}))
        candidate = _scalar(values[0]) if values else None
    if candidate is None:
        return None
    code = str(candidate).rstrip("/").rsplit("/", 1)[-1]
    return code if code.isdigit() else None


def _company_details(notice: dict) -> tuple[str, str | None]:
    numbers = list(
        _recursive_values(
            notice,
            {"companyNumber", "company-number", "hasCompanyNumber", "company_number"},
        )
    )
    names = list(
        _recursive_values(
            notice.get("isAbout") or notice,
            {"name", "organisationName", "companyName", "hasCompanyName"},
        )
    )
    name = str(_scalar(names[0]) or "Unresolved company")
    number = _scalar(numbers[0]) if numbers else None
    return name, str(number) if number else None


def _safe_payload(value):
    """Keep the notice structure while dropping unnecessary personal contact fields."""
    if isinstance(value, dict):
        return {
            key: _safe_payload(item)
            for key, item in value.items()
            if key.lower()
            not in {
                "address",
                "email",
                "fax",
                "person",
                "personname",
                "telephone",
            }
        }
    if isinstance(value, list):
        return [_safe_payload(item) for item in value]
    return value


def parse_notice(notice: dict) -> ParsedDocument:
    if not isinstance(notice, dict):
        raise ValueError("Gazette notice must be an object.")
    notice_id = _notice_id(notice)
    code = _notice_code(notice)
    name, number = _company_details(notice)
    entity = organisation("gazette", notice_id, name, "GB-COH" if number else None, number)
    published = source_date(
        _scalar(
            notice.get("datePublished") or notice.get("published") or notice.get("publicationDate")
        )
    )
    case_values = list(_recursive_values(notice, {"caseNumber", "case-number", "case_number"}))
    case_number = str(_scalar(case_values[0])) if case_values else None
    observations = []
    warnings = []
    if code in CORPORATE_INSOLVENCY_CODES:
        kind = "insolvency_petition" if code in PETITION_CODES else "insolvency_event"
        occurrence = case_number or notice_id
        observations.append(
            ObservationInput(
                subject_key=entity.key,
                kind=kind,
                event_key=f"gazette:{kind}:{entity.key}:{occurrence}",
                headline=(
                    "Corporate winding-up petition notice"
                    if kind == "insolvency_petition"
                    else "Corporate insolvency notice"
                ),
                detail=f"The Gazette published corporate notice taxonomy code {code}.",
                occurred_at=published,
                state="verified" if entity.verified and published else "pending",
                evidence_pointer=f"/notice/{notice_id}/hasNoticeCode",
                attributes={"notice_code": code, "case_number": case_number},
            )
        )
    else:
        warnings.append(
            "Notice taxonomy is absent or unsupported; no adverse event was classified."
        )
    withdrawn_literal = notice.get("isWithdrawn", False)
    if isinstance(withdrawn_literal, dict):
        if "@value" not in withdrawn_literal:
            raise ValueError("Gazette isWithdrawn literal has an unsupported structure.")
        withdrawn_literal = withdrawn_literal["@value"]
    if isinstance(withdrawn_literal, bool):
        withdrawn = withdrawn_literal
    elif isinstance(withdrawn_literal, str) and withdrawn_literal.casefold() in {"true", "false"}:
        withdrawn = withdrawn_literal.casefold() == "true"
    else:
        raise ValueError("Gazette isWithdrawn literal must be true or false.")
    withdrawn = withdrawn or str(notice.get("status") or "").casefold() in {
        "withdrawn",
        "cancelled",
    }
    return ParsedDocument(
        external_id=notice_id,
        source_url=f"https://www.thegazette.co.uk/notice/{notice_id}",
        title=f"Gazette notice {notice_id}: {name}",
        published_at=published,
        payload=_safe_payload(notice),
        entities=[entity],
        observations=observations,
        warnings=warnings,
        withdrawn=withdrawn,
    )


def _feed_entries(payload: dict) -> list[dict]:
    for key in ("entry", "entries", "results", "notices"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            return [value]
    graph = payload.get("@graph")
    if isinstance(graph, list):
        return [item for item in graph if isinstance(item, dict)]
    return [payload] if any(key in payload for key in ("hasNoticeID", "noticeID")) else []


def parse_feed(payload: dict) -> list[ParsedDocument]:
    if not isinstance(payload, dict):
        raise ValueError("Gazette feed must be an object.")
    documents: dict[str, ParsedDocument] = {}
    for item in _feed_entries(payload):
        document = parse_notice(item)
        documents[document.external_id] = document
    return list(documents.values())


def _jsonld_url(entry: dict) -> str | None:
    links = entry.get("link") or []
    if isinstance(links, dict):
        links = [links]
    for link in links:
        if not isinstance(link, dict):
            continue
        target = str(link.get("@href") or link.get("href") or "")
        if not target.lower().endswith("/data.jsonld"):
            continue
        parts = urlsplit(target)
        if parts.scheme == "https" and parts.hostname in GAZETTE_HOSTS:
            return target
    return None


def _linked_notice(payload: dict, feed_entry: dict) -> dict:
    candidates = payload.get("@graph") if isinstance(payload, dict) else None
    if not isinstance(candidates, list):
        candidates = [payload]
    notice = next(
        (
            item
            for item in candidates
            if isinstance(item, dict)
            and (
                any(key in item for key in ("hasNoticeID", "noticeID", "hasNoticeCode"))
                or "/notice/" in str(item.get("@id") or item.get("id") or "")
            )
        ),
        payload,
    )
    if not isinstance(notice, dict):
        raise ValueError("Gazette JSON-LD did not contain a notice object.")
    return {**feed_entry, **notice, "linked_data": payload}


class GazetteAdapter:
    def fetch(self, source, client, now):
        if not gazette_window_open(now):
            raise SourceBlocked(
                "gazette", "retrieve", "public automation is limited to 21:00-07:00 Europe/London"
            )
        settings = Settings()
        contact = (settings.organisational_contact or "").strip()
        if not contact:
            raise SourceBlocked("gazette", "retrieve", "configure an organisational contact")
        config = source.get("config") or {}
        configured_pages = min(
            100, max(1, int(config.get("page_limit", config.get("max_pages", 10))))
        )
        try:
            cursor = json.loads(source.get("cursor") or "{}")
        except json.JSONDecodeError as error:
            raise ValueError("Gazette cursor is invalid.") from error
        end = source_date(cursor.get("end")) or now
        start = source_date(cursor.get("start")) or end - timedelta(days=30)
        page = max(1, int(cursor.get("page", 1)))
        documents: dict[str, ParsedDocument] = {}
        complete = True
        headers = {"User-Agent": f"MeritusVia/0.1 ({contact})", "Accept": "application/json"}
        # One public feed page plus at most four JSON-LD documents fits the fair-use budget.
        for _ in range(min(configured_pages, 1)):
            _acquire_shared_budget(settings.data_dir)
            raw, _, _ = fetch_bytes(
                client,
                FEED_URL,
                allowed_hosts=GAZETTE_HOSTS,
                params={
                    "categorycode": "24",
                    "start-publish-date": start.astimezone(UTC).strftime("%Y-%m-%d"),
                    "end-publish-date": end.astimezone(UTC).strftime("%Y-%m-%d"),
                    "results-page": page,
                    "results-page-size": min(4, max(1, int(config.get("page_size", 4)))),
                    "sort-by": "latest-date",
                },
                headers=headers,
                max_bytes=16_000_000,
            )
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError as error:
                raise ValueError("Gazette returned invalid JSON.") from error
            entries = _feed_entries(payload)
            if not entries:
                break
            for entry in entries:
                detail_url = _jsonld_url(entry)
                detail = entry
                if detail_url:
                    _acquire_shared_budget(settings.data_dir)
                    detail_raw, _, _ = fetch_bytes(
                        client,
                        detail_url,
                        allowed_hosts=GAZETTE_HOSTS,
                        headers=headers,
                        max_bytes=4_000_000,
                    )
                    try:
                        detail_payload = json.loads(detail_raw)
                    except json.JSONDecodeError as error:
                        raise ValueError("Gazette JSON-LD response is invalid.") from error
                    detail = _linked_notice(detail_payload, entry)
                document = parse_notice(detail)
                documents[document.external_id] = document
            page += 1
            links = payload.get("link") or []
            if isinstance(links, dict):
                links = [links]
            complete = not any(
                isinstance(link, dict) and (link.get("@rel") or link.get("rel")) == "next"
                for link in links
            )
        next_cursor = None
        warnings = []
        if not complete:
            next_cursor = json.dumps(
                {"start": start.isoformat(), "end": end.isoformat(), "page": page}, sort_keys=True
            )
            warnings.append("Gazette page cap reached; the next page is resumable.")
        return FetchBatch(
            documents=list(documents.values()),
            cursor=next_cursor,
            complete=complete,
            warnings=warnings,
        )
