import httpx
import pytest

from meritus.sources.http import FetchError, RateLimited, fetch_bytes

HOST = "www.find-tender.service.gov.uk"


def test_redirect_cannot_reach_unapproved_host():
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(302, headers={"location": "http://127.0.0.1/private"})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as client,
        pytest.raises(FetchError, match=r"host|HTTPS"),
    ):
        fetch_bytes(client, f"https://{HOST}/api/test", allowed_hosts={HOST})
    assert len(seen) == 1


def test_response_limit_and_retry_after():
    with (
        httpx.Client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b"x" * 20))
        ) as client,
        pytest.raises(FetchError, match="limit"),
    ):
        fetch_bytes(client, f"https://{HOST}/api/test", allowed_hosts={HOST}, max_bytes=10)
    with (
        httpx.Client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(429, headers={"retry-after": "300"})
            )
        ) as client,
        pytest.raises(RateLimited) as error,
    ):
        fetch_bytes(client, f"https://{HOST}/api/test", allowed_hosts={HOST})
    assert error.value.retry_after == 300


def test_conditional_response_and_secrets_never_in_error():
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(304, headers={"etag": "abc"}))
    ) as client:
        content, headers, status = fetch_bytes(
            client, f"https://{HOST}/api/test", allowed_hosts={HOST}
        )
    assert content == b"" and status == 304 and headers["etag"] == "abc"
    with (
        httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(500))) as client,
        pytest.raises(FetchError) as error,
    ):
        fetch_bytes(
            client, f"https://{HOST}/api/test?token=secret-value", allowed_hosts={HOST}, retries=0
        )
    assert "secret-value" not in str(error.value)
