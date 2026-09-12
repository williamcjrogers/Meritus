"""Reusable source-right checks for retrieval, analysis, imports and exports."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from meritus.sources.catalogue import get_source_definition

_OPERATIONS = {"retrieve", "import", "analyse", "export"}
_PUBLIC_RIGHTS = {
    "companies_house": _OPERATIONS,
    "gazette": _OPERATIONS,
    "find_tender": _OPERATIONS,
    "contracts_finder": _OPERATIONS,
    "payment_practices": _OPERATIONS,
    "bsr_gateway": _OPERATIONS,
    "ras_members": _OPERATIONS,
    "ras_prohibitions": _OPERATIONS,
    "developer_remediation": _OPERATIONS,
    "debarment": _OPERATIONS,
}
_ALWAYS_RECORDED_PERMISSION = {
    "hmcts",
    "find_case_law",
    "rns",
    "adzuna",
    "construction_index",
}
_HOST_SOURCES = {
    "api.company-information.service.gov.uk": "companies_house",
    "find-and-update.company-information.service.gov.uk": "companies_house",
    "www.thegazette.co.uk": "gazette",
    "thegazette.co.uk": "gazette",
    "www.find-tender.service.gov.uk": "find_tender",
    "find-tender.service.gov.uk": "find_tender",
    "www.contractsfinder.service.gov.uk": "contracts_finder",
    "contractsfinder.service.gov.uk": "contracts_finder",
    "check-payment-practices.service.gov.uk": "payment_practices",
    "www.gov.uk": None,
    "gov.uk": None,
    "www.court-tribunal-hearings.service.gov.uk": "hmcts",
    "court-tribunal-hearings.service.gov.uk": "hmcts",
    "caselaw.nationalarchives.gov.uk": "find_case_law",
    "www.londonstockexchange.com": "rns",
    "londonstockexchange.com": "rns",
    "api.adzuna.com": "adzuna",
    "www.adzuna.co.uk": "adzuna",
    "adzuna.co.uk": "adzuna",
    "www.theconstructionindex.co.uk": "construction_index",
    "theconstructionindex.co.uk": "construction_index",
}
_RESTRICTED_UNCONFIGURED_HOSTS = {
    "www.balfourbeatty.com": "publisher:balfour_beatty",
    "balfourbeatty.com": "publisher:balfour_beatty",
    "www.constructionenquirer.com": "publisher:construction_enquirer",
    "constructionenquirer.com": "publisher:construction_enquirer",
}


class SourceBlocked(PermissionError):
    """Raised when a source has no recorded right for an operation."""

    def __init__(self, source_id: str, operation: str, reason: str):
        self.source_id = source_id
        self.operation = operation
        self.reason = reason
        super().__init__(f"{source_id} is blocked for {operation}: {reason}")


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(UTC)


def _scope_covers(scope: Any, operation: str) -> bool:
    if isinstance(scope, str):
        return bool(scope.strip())
    if isinstance(scope, list):
        return bool(scope) and all(isinstance(item, str) and item.strip() for item in scope)
    if isinstance(scope, dict):
        return bool(scope) and scope.get(operation, True) is not False
    return False


def permission_allows(source: dict[str, Any], operation: str, now: datetime) -> bool:
    """Return whether the declared catalogue right or reviewed grant covers an operation.

    Feed enablement, credentials, contact details and rate windows are intentionally
    runner concerns. This helper only evaluates the legal/contractual permission record.
    """
    if operation not in _OPERATIONS:
        raise ValueError(f"Unknown source operation: {operation}")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a UTC offset")
    source_id = str(source.get("id") or "")
    permission = source.get("permissions") or {}
    if permission.get("denied") is True:
        return False
    if source_id in _PUBLIC_RIGHTS and operation in _PUBLIC_RIGHTS[source_id]:
        return True
    if source_id == "reviewed_import":
        return operation in {"import", "analyse", "export"}

    if source_id in _ALWAYS_RECORDED_PERMISSION or source.get("requires_permission"):
        reference = permission.get("reference") or permission.get("permission_reference")
        scope = permission.get("scope")
        reviewed_at = _datetime(permission.get("reviewed_at"))
        operations = permission.get("operations")
        expiry_value = permission.get("expires_at")
        expires_at = _datetime(expiry_value)
        if not isinstance(reference, str) or not reference.strip():
            return False
        if not _scope_covers(scope, operation):
            return False
        if reviewed_at is None or reviewed_at > now.astimezone(UTC):
            return False
        if not isinstance(operations, list) or operation not in operations:
            return False
        if expiry_value is not None and expiry_value != "" and expires_at is None:
            return False
        if expires_at is not None and expires_at <= now.astimezone(UTC):
            return False
        return permission.get("denied") is not True
    return False


def require_permission(source: dict[str, Any], operation: str, now: datetime) -> None:
    if not permission_allows(source, operation, now):
        raise SourceBlocked(str(source.get("id") or "unknown"), operation, "no applicable grant")


def _known_source_for_url(source_url: str) -> str | None:
    try:
        parts = urlsplit(source_url)
    except ValueError:
        return None
    if parts.scheme not in {"http", "https"}:
        return None
    hostname = (parts.hostname or "").casefold().rstrip(".")
    if hostname == "rns-distribution.com" or hostname.endswith(".rns-distribution.com"):
        return "rns"
    source_id = _HOST_SOURCES.get(hostname)
    if hostname in {"www.gov.uk", "gov.uk"}:
        path = parts.path.casefold()
        if "companies-house" in path:
            return "companies_house"
        if "court" in path or "tribunal" in path:
            return "hmcts"
        if "debarment" in path or "procurement-act" in path:
            return "debarment"
        if "responsible-actors-scheme" in path:
            return "ras_prohibitions" if "prohibition" in path else "ras_members"
        if "gateway" in path or "building-safety-regulator" in path:
            return "bsr_gateway"
        if "building-safety" in path or "developer-remediation" in path:
            return "developer_remediation"
    return source_id


def _validated_source_url(source_url: str, declared_source_id: str | None) -> str:
    if source_url == "":
        return source_url
    source_id = declared_source_id or "reviewed_import"
    if (
        source_url != source_url.strip()
        or any(character.isspace() for character in source_url)
        or "\\" in source_url
    ):
        raise SourceBlocked(source_id, "import", "source URL must be an absolute HTTP(S) URL")
    try:
        parts = urlsplit(source_url)
        port = parts.port
    except ValueError as exc:
        raise SourceBlocked(
            source_id, "import", "source URL must be an absolute HTTP(S) URL"
        ) from exc
    if (
        parts.scheme not in {"http", "https"}
        or not parts.netloc
        or not parts.hostname
        or "%" in parts.netloc
        or parts.username is not None
        or parts.password is not None
        or (port is not None and not 1 <= port <= 65535)
    ):
        raise SourceBlocked(source_id, "import", "source URL must be an absolute HTTP(S) URL")
    return source_url


def resolve_source_for_url(
    repo, source_url: str, declared_source_id: str | None = None
) -> dict[str, Any]:
    """Resolve a publisher URL without allowing reviewed_import to mask known origins."""
    source_url = _validated_source_url(str(source_url or ""), declared_source_id)
    known_source_id = _known_source_for_url(source_url)
    try:
        hostname = (urlsplit(source_url).hostname or "").casefold().rstrip(".")
    except ValueError:
        hostname = ""
    if restricted_id := _RESTRICTED_UNCONFIGURED_HOSTS.get(hostname):
        raise SourceBlocked(
            restricted_id,
            "import",
            "known restricted publisher has no configured permission source",
        )
    declared = declared_source_id or None
    if known_source_id and declared and declared != known_source_id:
        raise SourceBlocked(
            known_source_id,
            "import",
            f"URL belongs to {known_source_id}, not declared source {declared}",
        )
    source_id = known_source_id or declared or "reviewed_import"
    try:
        return repo.get_source(source_id)
    except KeyError:
        # Preserve the repository contract while producing the policy-specific error.
        try:
            get_source_definition(source_id)
        except KeyError as exc:
            raise SourceBlocked(source_id, "import", "unknown source") from exc
        raise


__all__ = [
    "SourceBlocked",
    "permission_allows",
    "require_permission",
    "resolve_source_for_url",
]
