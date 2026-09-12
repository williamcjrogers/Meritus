"""Short-lived, request-bound proofs issued by the Directors Workspace gateway."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException, Request

from meritus.config import Settings

BRIDGE_HEADER = "X-Meritus-Bridge"
_MAX_HEADER_LENGTH = 16_384
_FIELDS = {"v", "sub", "iat", "method", "path", "body_sha256"}


@dataclass(frozen=True)
class VerifiedDirector:
    """Internal request state, populated only after the complete request is verified."""

    subject: str
    actor_id: str


def _reject() -> HTTPException:
    return HTTPException(status_code=401, detail="A valid Directors Workspace request is required")


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate proof field")
        result[key] = value
    return result


def request_target(request: Request) -> str:
    """Bind the proof to the exact percent-encoded path and unsorted query string."""
    raw_path = request.scope.get("raw_path")
    path = raw_path.decode("ascii") if raw_path is not None else request.url.path
    query = request.scope.get("query_string", b"").decode("ascii")
    return path + ("?" + query if query else "")


def verify_director_request(request: Request, settings: Settings, body: bytes) -> VerifiedDirector:
    """Authenticate a buffered request without creating a local password or session."""
    secret = settings.portal_bridge_secret
    header = request.headers.get(BRIDGE_HEADER, "")
    if (
        secret is None
        or not header
        or len(header) > _MAX_HEADER_LENGTH
        or len(request.headers.getlist(BRIDGE_HEADER)) != 1
    ):
        raise _reject()
    try:
        encoded, signature = header.split(".")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", encoded) or not re.fullmatch(
            r"[a-f0-9]{64}", signature
        ):
            raise ValueError("Invalid proof encoding")
        expected = hmac.new(
            secret.get_secret_value().encode("utf-8"), encoded.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid proof signature")
        decoded = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        if base64.urlsafe_b64encode(decoded).decode("ascii").rstrip("=") != encoded:
            raise ValueError("Non-canonical proof encoding")
        payload = json.loads(decoded.decode("utf-8"), object_pairs_hook=_unique_object)
        if not isinstance(payload, dict) or set(payload) != _FIELDS:
            raise ValueError("Invalid proof fields")
        subject, issued_at = payload["sub"], payload["iat"]
        if type(payload["v"]) is not int or payload["v"] != 1:
            raise ValueError("Invalid proof version")
        if not isinstance(subject, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", subject):
            raise ValueError("Invalid director subject")
        if type(issued_at) is not int or not 0 <= issued_at <= 9_007_199_254_740_991:
            raise ValueError("Invalid proof timestamp")
        age = time.time() - issued_at
        if age > 30 or age < -5:
            raise ValueError("Expired proof")
        method, path, body_digest = payload["method"], payload["path"], payload["body_sha256"]
        if not isinstance(method, str) or not re.fullmatch(r"[A-Z]{1,16}", method):
            raise ValueError("Invalid request method")
        if (
            not isinstance(path, str)
            or not path.startswith("/")
            or len(path) > 8192
            or re.search(r"[^\x21-\x7e]|#", path)
        ):
            raise ValueError("Invalid request target")
        if not isinstance(body_digest, str) or not re.fullmatch(r"[a-f0-9]{64}", body_digest):
            raise ValueError("Invalid body digest")
        if method != request.method or path != request_target(request):
            raise ValueError("Request target does not match proof")
        if not hmac.compare_digest(body_digest, hashlib.sha256(body).hexdigest()):
            raise ValueError("Request body does not match proof")
    except (ValueError, TypeError, UnicodeError, RecursionError) as error:
        raise _reject() from error
    return VerifiedDirector(subject, str(uuid5(NAMESPACE_URL, "meritus:director:" + subject)))


def director_for_request(request: Request) -> VerifiedDirector:
    """Fail closed unless middleware verified the exact request before routing."""
    director = getattr(request.state, "verified_director", None)
    if not isinstance(director, VerifiedDirector):
        raise _reject()
    return director
