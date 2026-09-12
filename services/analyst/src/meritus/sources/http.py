"""Bounded HTTPS retrieval with explicit publisher and response limits."""

import time
from collections.abc import Callable
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from threading import Lock
from urllib.parse import urljoin, urlsplit

import httpx

_HOST_REQUEST_LOCK = Lock()
_HOST_LAST_REQUEST: dict[str, float] = {}


def _pace_host(host: str, sleep) -> None:
    # Source runs are serialised in the database; this also bounds calls within a process.
    with _HOST_REQUEST_LOCK:
        now = time.monotonic()
        delay = max(0.0, _HOST_LAST_REQUEST.get(host, 0) + 0.2 - now)
        if delay:
            sleep(delay)
        _HOST_LAST_REQUEST[host] = time.monotonic()


class FetchError(ValueError):
    def __init__(self, message: str, *, status_code: int | None = None):
        self.status_code = status_code
        super().__init__(message)


class RateLimited(FetchError):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Source requests must pause for {retry_after} seconds.")


def validate_url(url: str, allowed_hosts: set[str]) -> None:
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise FetchError("Source requests require HTTPS.")
    if parts.hostname not in allowed_hosts or parts.port not in (None, 443):
        raise FetchError("Source URL host is not approved for this adapter.")
    if parts.username or parts.password:
        raise FetchError("Credentials cannot be embedded in source URLs.")


def retry_delay(value: str | None, fallback: int = 5) -> int:
    if not value:
        return fallback
    try:
        return max(1, int(value))
    except ValueError:
        try:
            return max(1, int((parsedate_to_datetime(value) - datetime.now(UTC)).total_seconds()))
        except (TypeError, ValueError):
            return fallback


def fetch_bytes(
    client: httpx.Client,
    url: str,
    *,
    allowed_hosts: set[str],
    params: dict | None = None,
    headers: dict | None = None,
    max_bytes: int = 10_000_000,
    retries: int = 2,
    method: str = "GET",
    json_data: dict | None = None,
    sleep=time.sleep,
    before_request: Callable[[], int | None] | None = None,
) -> tuple[bytes, dict, int]:
    """Long Retry-After values surface to durable scheduling instead of blocking a worker."""
    if not 0 < max_bytes <= 512_000_000:
        raise ValueError("Response limit must be between 1 and 512,000,000 bytes.")
    redirects = attempts = 0
    while True:
        validate_url(url, allowed_hosts)
        if before_request is not None:
            wait = before_request()
            if wait:
                raise RateLimited(wait)
        _pace_host(urlsplit(url).hostname, sleep)
        try:
            with client.stream(
                method,
                url,
                params=params,
                headers=headers,
                json=json_data,
                timeout=30,
                follow_redirects=False,
            ) as response:
                status = response.status_code
                if status in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if not location or redirects >= 5:
                        raise FetchError("Source redirect chain is invalid or too long.")
                    next_url = urljoin(str(response.url), location)
                    validate_url(next_url, allowed_hosts)
                    if urlsplit(next_url).hostname != urlsplit(url).hostname:
                        headers = {
                            key: value
                            for key, value in (headers or {}).items()
                            if key.lower() not in {"authorization", "cookie"}
                        }
                    url, params = next_url, None
                    redirects += 1
                    continue
                if status == 304:
                    return b"", dict(response.headers), status
                limited = status == 429 or (
                    status == 403
                    and urlsplit(url).hostname == "www.contractsfinder.service.gov.uk"
                    and (
                        "retry-after" in response.headers
                        or response.headers.get("x-ratelimit-remaining") == "0"
                    )
                )
                if limited or status in (502, 503, 504):
                    delay = retry_delay(
                        response.headers.get("retry-after"), 300 if status == 403 else 5
                    )
                    if attempts >= retries or delay > 30:
                        raise RateLimited(delay)
                    attempts += 1
                    sleep(delay)
                    continue
                if status < 200 or status >= 300:
                    raise FetchError(f"Source returned HTTP {status}.", status_code=status)
                length = response.headers.get("content-length")
                if length and length.isdigit() and int(length) > max_bytes:
                    raise FetchError("Source response exceeds its byte limit.")
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise FetchError("Source response exceeds its byte limit.")
                    chunks.append(chunk)
                return b"".join(chunks), dict(response.headers), status
        except httpx.RequestError as error:
            if attempts < retries:
                attempts += 1
                sleep(min(2**attempts, 10))
                continue
            raise FetchError(f"Source transport failed ({type(error).__name__}).") from None
