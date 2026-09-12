"""Licensed RNS distribution NewsML-G2 adapter."""

from __future__ import annotations

import json
from datetime import timedelta
from urllib.parse import urljoin, urlsplit, urlunsplit

from meritus.config import Settings
from meritus.domain import FetchBatch, ParsedDocument
from meritus.sources.common import organisation, source_date, source_json
from meritus.sources.documents import FileSlidingWindowBudget
from meritus.sources.extraction import extract_document, secure_xml_root
from meritus.sources.http import FetchError, RateLimited, fetch_bytes


def validate_base_url(value: str) -> str:
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError as exc:
        raise ValueError("RNS base URL must use an onboarded rns-distribution.com host.") from exc
    host = (parts.hostname or "").casefold().rstrip(".")
    if (
        parts.scheme != "https"
        or (host != "rns-distribution.com" and not host.endswith(".rns-distribution.com"))
        or port not in (None, 443)
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError("RNS base URL must use an onboarded rns-distribution.com host.")
    return urlunsplit(("https", parts.netloc, parts.path.rstrip("/"), "", ""))


def _allowed(base_url: str) -> set[str]:
    return {urlsplit(base_url).hostname}


def parse_index(data: bytes | str, base_url: str, after_sequence: int = 0) -> list[dict]:
    try:
        payload = source_json(data)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("RNS index is not valid JSON.") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("announcements"), list):
        raise ValueError("RNS index has no announcements list.")
    date_value = payload.get("workingDate")
    if source_date(date_value) is None:
        raise ValueError("RNS index has no valid announcement date.")
    entries = []
    for item in payload["announcements"]:
        if not isinstance(item, dict):
            raise ValueError("RNS index contains an invalid announcement.")
        raw_sequence = item.get("sequenceNumber")
        try:
            sequence = int(raw_sequence)
        except (TypeError, ValueError) as exc:
            raise ValueError("RNS index contains an invalid sequence number.") from exc
        if sequence <= after_sequence:
            continue
        item_date = item.get("workingDate") or date_value
        parsed_item_date = source_date(item_date)
        parsed_working_date = source_date(date_value)
        if parsed_item_date is None or parsed_item_date.date() != parsed_working_date.date():
            raise ValueError("RNS index announcement date does not match its working date.")
        detail_url = urljoin(
            base_url + "/", f"announcements/{parsed_item_date.date().isoformat()}/{sequence}"
        )
        if urlsplit(detail_url).hostname not in _allowed(base_url):
            raise ValueError("RNS index links outside the onboarded host.")
        entries.append(
            {
                "date": parsed_item_date.date().isoformat(),
                "sequence": sequence,
                "source_url": detail_url,
                "received": item.get("received"),
                "headline": item.get("headline"),
                "company": item.get("company"),
            }
        )
    return sorted(entries, key=lambda item: item["sequence"])


def _local_name(node) -> str:
    return node.tag.rsplit("}", 1)[-1] if isinstance(node.tag, str) else ""


def _first_text(root, names: set[str]) -> str:
    for node in root.iter():
        if _local_name(node) in names:
            value = " ".join("".join(node.itertext()).split())
            if value:
                return value
    return ""


def parse_newsml(data: bytes | str, entry: dict) -> ParsedDocument:
    root = secure_xml_root(data)
    title = (
        _first_text(root, {"headline", "title"})
        or entry.get("headline")
        or f"RNS announcement {entry['sequence']}"
    )
    published = source_date(_first_text(root, {"sent", "firstCreated", "contentCreated"}))
    if published is None:
        published = source_date(entry.get("received")) or source_date(entry["date"])
    # The dated index identifies the issuer. Generic NewsML names also describe
    # providers and subjects and cannot be used as an issuer fallback.
    issuer = entry.get("company") if isinstance(entry.get("company"), str) else ""
    issuer = " ".join(issuer.split())
    entities = []
    if issuer:
        entities.append(organisation("rns", f"{entry['date']}:{entry['sequence']}", issuer))
    text = _first_text(root, {"inlineXML", "inlineData", "body"})
    extracted = extract_document(text, entry["source_url"], published, entities)
    return ParsedDocument(
        external_id=f"{entry['date']}:{entry['sequence']}",
        source_url=entry["source_url"],
        title=title,
        published_at=published,
        payload={
            "original_url": entry["source_url"],
            "announcement_date": entry["date"],
            "sequence": entry["sequence"],
            "locations": extracted.payload["locations"],
        },
        entities=entities,
        observations=extracted.observations,
        warnings=(
            ["RNS extracted propositions require analyst review."]
            if extracted.observations
            else ["Issuer absent from the dated index; analyst identity review is required."]
            if not issuer
            else []
        ),
        media_type="application/newsml+xml",
        raw_text=text or None,
    )


class RNSAdapter:
    def fetch(self, source, client, now):
        settings = Settings()
        base_url = validate_base_url(settings.rns_base_url or "")
        user = settings.rns_user.get_secret_value() if settings.rns_user else ""
        access_key = settings.rns_access_key.get_secret_value() if settings.rns_access_key else ""
        if not user or not access_key:
            raise FetchError("RNS credentials are not configured.")
        allowed = _allowed(base_url)
        login, _, _ = fetch_bytes(
            client,
            base_url + "/login",
            allowed_hosts=allowed,
            method="POST",
            json_data={"user": user, "accessKey": access_key},
            max_bytes=100_000,
        )
        try:
            response = source_json(login)
            token = str(response.get("token") or response.get("accessToken") or "")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            token = ""
        if not token:
            raise FetchError("RNS login did not return an access token.")
        headers = {"Authorization": f"Bearer {token}"}
        cursor = json.loads(source.get("cursor") or "{}")
        cursor_date = source_date(cursor.get("date"))
        earliest = now - timedelta(days=6)
        start = cursor_date or earliest
        complete = True
        warnings = []
        if start < earliest:
            start = earliest
            complete = False
            warnings.append("RNS history gap exceeds the seven-day online window.")
        documents = []
        requested_date = start.date()
        last_sequence = (
            int(cursor.get("sequence", 0))
            if cursor_date and cursor_date.date() == requested_date
            else 0
        )
        budget = FileSlidingWindowBudget(
            settings.data_dir / "rate-limits" / "rns-index.json", limit=1, window_seconds=5
        )
        wait = budget.acquire()
        if wait:
            raise RateLimited(wait)
        index_url = f"{base_url}/announcements/{requested_date.isoformat()}"
        index, _, _ = fetch_bytes(
            client, index_url, allowed_hosts=allowed, headers=headers, max_bytes=2_000_000
        )
        for entry in parse_index(index, base_url, last_sequence):
            content, _, _ = fetch_bytes(
                client,
                entry["source_url"],
                allowed_hosts=allowed,
                headers=headers,
                max_bytes=10_000_000,
            )
            documents.append(parse_newsml(content, entry))
            last_sequence = entry["sequence"]
        if requested_date < now.date():
            checkpoint_date = requested_date + timedelta(days=1)
            checkpoint_sequence = 0
            complete = False
            warnings.append("RNS historical catch-up will continue in the next source run.")
        else:
            checkpoint_date = requested_date
            checkpoint_sequence = last_sequence
        return FetchBatch(
            documents=documents,
            cursor=json.dumps(
                {
                    "date": checkpoint_date.isoformat(),
                    "sequence": checkpoint_sequence,
                    "retrieved_at": now.isoformat(),
                },
                sort_keys=True,
            ),
            complete=complete,
            warnings=warnings,
        )


__all__ = ["RNSAdapter", "parse_index", "parse_newsml", "validate_base_url"]
