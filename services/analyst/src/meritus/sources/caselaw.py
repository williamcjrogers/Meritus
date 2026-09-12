"""The National Archives Find Case Law Atom and LegalDocML adapter."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC
from urllib.parse import urlsplit

from sqlalchemy import func, select

from meritus.config import Settings
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.models import SourceRecord
from meritus.sources.common import source_date
from meritus.sources.documents import FileSlidingWindowBudget
from meritus.sources.extraction import extract_document, secure_xml_root
from meritus.sources.http import FetchError, RateLimited, fetch_bytes

ATOM_URL = "https://caselaw.nationalarchives.gov.uk/atom.xml?order=-transformation"
HOSTS = {"caselaw.nationalarchives.gov.uk"}
_ATOM = "{http://www.w3.org/2005/Atom}"
_TNA = "{https://caselaw.nationalarchives.gov.uk}"
_AKN = "{http://docs.oasis-open.org/legaldocml/ns/akn/3.0}"
_DOCUMENT_URI = re.compile(r"^[a-z0-9][a-z0-9/-]*$")


def _text(element, path: str) -> str:
    found = element.find(path)
    return "" if found is None else " ".join("".join(found.itertext()).split())


def _official_url(uri: str) -> None:
    parts = urlsplit(uri)
    if (
        parts.scheme != "https"
        or parts.hostname not in HOSTS
        or parts.port not in (None, 443)
        or parts.username
        or parts.password
    ):
        raise ValueError("Find Case Law entry has an unapproved URL.")


def _stable_uri(value: str) -> str:
    value = value.strip().strip("/")
    if not _DOCUMENT_URI.fullmatch(value) or any(part in {".", ".."} for part in value.split("/")):
        raise ValueError("Find Case Law entry identifier is invalid.")
    return value


def parse_atom(data: bytes | str):
    root = secure_xml_root(data)
    if root.tag != f"{_ATOM}feed":
        raise ValueError("Find Case Law response is not an Atom feed.")
    next_url = None
    for link in root.findall(f"{_ATOM}link"):
        if link.get("rel") == "next":
            next_url = link.get("href")
            if next_url:
                _official_url(next_url)
    entries = []
    latest = None
    for entry in root.findall(f"{_ATOM}entry"):
        identifier = _text(entry, f"{_ATOM}id")
        document_uri = _text(entry, f"{_TNA}uri")
        updated = source_date(_text(entry, f"{_ATOM}updated"))
        published = source_date(_text(entry, f"{_ATOM}published"))
        if not identifier or not document_uri or updated is None:
            raise ValueError(
                "Find Case Law Atom entry is missing its identifier, document URI or update date."
            )
        _official_url(identifier)
        xml_url = None
        source_url = identifier
        for link in entry.findall(f"{_ATOM}link"):
            href = link.get("href")
            if not href:
                continue
            media_type = link.get("type")
            if media_type in {"application/xml", "application/akn+xml"}:
                _official_url(href)
                xml_url = href
            if link.get("rel") == "alternate" and media_type in {None, "text/html"}:
                _official_url(href)
                source_url = href
        external_id = _stable_uri(document_uri)
        entries.append(
            {
                "external_id": external_id,
                "source_url": source_url,
                "xml_url": xml_url
                or f"https://caselaw.nationalarchives.gov.uk/{external_id}/data.xml",
                "title": _text(entry, f"{_ATOM}title"),
                "published_at": published,
                "updated_at": updated,
            }
        )
        latest = updated if latest is None or updated > latest else latest
    return entries, next_url, latest


def _judgment_root(data: bytes | str):
    root = secure_xml_root(data)
    bodies = [
        *root.findall(f"{_AKN}judgment/{_AKN}judgmentBody"),
        *root.findall(f"{_AKN}judgment/{_AKN}body"),
    ]
    if root.tag != f"{_AKN}akomaNtoso" or not any(
        " ".join(body.itertext()).strip() for body in bodies
    ):
        raise ValueError("Find Case Law XML does not contain a LegalDocML judgment body.")
    return root


def _xml_digest(data: bytes | str) -> str:
    return hashlib.sha256(data.encode() if isinstance(data, str) else data).hexdigest()


def parse_legaldocml(data: bytes | str, entry: dict) -> ParsedDocument:
    root = _judgment_root(data)
    text = " ".join(" ".join(root.itertext()).split())
    external_id = str(entry["external_id"])
    entity = EntityInput(
        key=f"UK-JUDGMENT:{external_id}",
        kind="proceeding",
        name=str(entry.get("title") or external_id),
        scheme="UK-JUDGMENT",
        identifier=external_id,
        verified=True,
    )
    updated = entry.get("updated_at")
    published = entry.get("published_at") or updated
    observations = []
    locations = []
    blocks = root.xpath(
        "//*[local-name()='judgment']//*[local-name()='p' and not(.//*[local-name()='p'])]"
    )
    if not blocks:
        blocks = [root]
    tree = root.getroottree()
    for block in blocks:
        block_text = " ".join("".join(block.itertext()).split())
        ancestors = [block, *block.iterancestors()]
        identified = next((node for node in ancestors if node.get("eId")), None)
        locator = f"xml:eId:{identified.get('eId')}:" if identified is not None else "xml:"
        locator += tree.getpath(block)
        extracted = extract_document(block_text, entry["source_url"], published, [entity])
        pointers = {}
        for location in extracted.payload["locations"]:
            sentence = location["pointer"].rsplit(":", 1)[-1]
            pointer = f"{locator}:sentence:{sentence}"
            pointers[location["pointer"]] = pointer
            locations.append({**location, "pointer": pointer})
        for observation in extracted.observations:
            pointer = pointers[observation.evidence_pointer]
            attributes = {
                key: value for key, value in observation.attributes.items() if key != "page"
            }
            attributes["xml_locator"] = locator
            event_key = (
                "reviewed-extraction:"
                + hashlib.sha256(
                    f"{observation.kind}:{entity.key}:{entry['source_url']}:{pointer}:{observation.detail}".encode()
                ).hexdigest()[:24]
            )
            observations.append(
                observation.model_copy(
                    update={
                        "evidence_pointer": pointer,
                        "event_key": event_key,
                        "attributes": attributes,
                    }
                )
            )
    construction_terms = ("construction", "adjudication", "building contract")
    if any(word in text.casefold() for word in construction_terms):
        observations.insert(
            0,
            ObservationInput(
                subject_key=entity.key,
                kind="construction_decision",
                event_key=f"find-case-law:{external_id}",
                headline=entry.get("title") or "Construction decision",
                detail=(
                    "Potentially relevant construction decision; classification requires review."
                ),
                occurred_at=published,
                state="pending",
                evidence_pointer="LegalDocML document",
                attributes={"updated_at": updated.isoformat() if updated else None},
            ),
        )
    return ParsedDocument(
        external_id=external_id,
        source_url=entry["source_url"],
        title=entry.get("title") or external_id,
        published_at=published,
        payload={
            "original_url": entry["source_url"],
            "xml_url": entry["xml_url"],
            "updated_at": updated.isoformat() if updated else None,
            "xml_sha256": _xml_digest(data),
            "locations": locations,
        },
        entities=[entity],
        observations=observations,
        warnings=["Case relevance and extracted propositions require analyst review."],
        media_type="application/akn+xml",
        raw_text=text,
    )


def _request_budget():
    return FileSlidingWindowBudget(
        Settings().data_dir / "rate-limits" / "find-case-law.json",
        limit=1000,
        window_seconds=300,
    )


def _current_entry(root, retained, xml_url):
    # A current full document can change its title without appearing in a bounded Atom page.
    # If XML supplies no current title, use the stable identifier, not superseded party names.
    title = root.find(f".//{_AKN}FRBRWork/{_AKN}FRBRname")
    name = title.get("value") if title is not None else None
    if not name:
        doc_title = root.find(f".//{_AKN}docTitle")
        name = " ".join(doc_title.itertext()).strip() if doc_title is not None else None
    transformed = root.find(f".//{_AKN}FRBRManifestation/{_AKN}FRBRdate[@name='transform']")
    updated = source_date(transformed.get("date")) if transformed is not None else None
    published = retained["published_at"]
    if published is not None and published.tzinfo is None:
        published = published.replace(tzinfo=UTC)
    return {
        "external_id": retained["external_id"],
        "source_url": retained["source_url"],
        "xml_url": xml_url,
        "title": name or retained["external_id"],
        "published_at": published,
        "updated_at": updated,
    }


def revalidate_retained_cases(repo, source, client, now) -> FetchBatch:
    """Check a bounded current-document cycle, without persisting or erasing anything.

    The caller atomically ingests this checkpoint and its validated replacements, then
    purges superseded/withdrawn material before ordinary feed ingestion. Only an actual
    HTTP404/410 from an approved XML endpoint is a withdrawal. Incomplete checks stop at
    the first failed item and never move its checkpoint. A batch limit is continuation,
    not proof of coverage: current_records.last_complete_at changes only at cycle end.
    """
    if source["id"] != "find_case_law":
        raise ValueError("Current judgment reconciliation requires Find Case Law.")
    if now.tzinfo is None:
        raise ValueError("Revalidation time must include a UTC offset.")
    config = source.get("config") or {}
    limit = min(max(int(config.get("revalidation_limit", 100)), 1), 250)
    cursor = json.loads(source.get("cursor") or "{}")
    prior = cursor.get("current_records") or {}
    after = prior.get("after_external_id")
    through = prior.get("through_external_id")
    for identifier in (after, through):
        if identifier is not None:
            _stable_uri(identifier)
    conditions = (
        SourceRecord.source_id == "find_case_law",
        SourceRecord.active.is_(True),
        SourceRecord.withdrawn.is_(False),
    )
    with repo.engine.connect() as connection:
        if through is None:
            through = connection.scalar(
                select(func.max(SourceRecord.external_id)).where(*conditions)
            )
        statement = select(
            SourceRecord.id.label("record_id"),
            SourceRecord.external_id,
            SourceRecord.source_url,
            SourceRecord.published_at,
            SourceRecord.payload["xml_url"].as_string().label("xml_url"),
            SourceRecord.payload["xml_sha256"].as_string().label("xml_sha256"),
        ).where(*conditions)
        if after is not None:
            statement = statement.where(SourceRecord.external_id > after)
        if through is not None:
            statement = statement.where(SourceRecord.external_id <= through)
        rows = (
            connection.execute(statement.order_by(SourceRecord.external_id).limit(limit + 1))
            .mappings()
            .all()
        )
    state = {
        "after_external_id": after,
        "through_external_id": through,
        "cycle_started_at": prior.get("cycle_started_at") or now.astimezone(UTC).isoformat(),
        "last_complete_at": prior.get("last_complete_at"),
        "checked_count": 0,
        "stop_reason": "batch_limit" if len(rows) > limit else "complete",
    }
    documents = []
    warnings = []
    budget = _request_budget()
    for retained in rows[:limit]:
        external_id = retained["external_id"]
        try:
            _stable_uri(external_id)
            xml_url = (
                retained["xml_url"]
                or f"https://caselaw.nationalarchives.gov.uk/{external_id}/data.xml"
            )
            _official_url(xml_url)
            _official_url(retained["source_url"])
            if not urlsplit(xml_url).path.endswith("/data.xml"):
                raise ValueError("Retained judgment must use an official XML endpoint.")
            try:
                xml, _, status = fetch_bytes(
                    client,
                    xml_url,
                    allowed_hosts=HOSTS,
                    max_bytes=20_000_000,
                    retries=0,
                    before_request=budget.acquire,
                )
            except FetchError as error:
                if error.status_code not in {404, 410}:
                    raise
                documents.append(
                    ParsedDocument(
                        external_id=external_id,
                        source_url=retained["source_url"],
                        title="Withdrawn Find Case Law document",
                        published_at=None,
                        payload={
                            "xml_url": xml_url,
                            "withdrawal_status": error.status_code,
                            "current_replaces_record_id": retained["record_id"],
                        },
                        withdrawn=True,
                        media_type="application/akn+xml",
                    )
                )
            else:
                if status != 200:
                    raise FetchError(
                        "Current judgment verification requires a full HTTP200 XML response."
                    )
                root = _judgment_root(xml)
                if _xml_digest(xml) != retained["xml_sha256"]:
                    replacement = parse_legaldocml(xml, _current_entry(root, retained, xml_url))
                    # A publisher may restore identical historical XML. Represent the fresh
                    # verified transition without reviving the erased historical record.
                    replacement.payload["current_replaces_record_id"] = retained["record_id"]
                    documents.append(replacement)
        except (FetchError, ValueError) as error:
            state["stop_reason"] = (
                "rate_limit" if isinstance(error, RateLimited) else "check_failed"
            )
            if isinstance(error, RateLimited):
                state["retry_after_seconds"] = error.retry_after
            warnings.append(
                "A retained judgment could not be verified; "
                "its current-version checkpoint was not advanced."
            )
            break
        state["after_external_id"] = external_id
        state["checked_count"] += 1
    complete = state["stop_reason"] == "complete"
    if complete:
        state.update(
            after_external_id=None,
            through_external_id=None,
            cycle_started_at=None,
            last_complete_at=now.astimezone(UTC).isoformat(),
        )
    elif state["stop_reason"] == "batch_limit":
        warnings.append(
            "Find Case Law current-version check limit reached; "
            "remaining judgments were checkpointed."
        )
    cursor["current_records"] = state
    return FetchBatch(
        documents=documents,
        cursor=json.dumps(cursor, sort_keys=True),
        complete=complete,
        warnings=warnings,
    )


class CaseLawAdapter:
    def fetch(self, source, client, now):
        config = source.get("config") or {}
        cursor = json.loads(source.get("cursor") or "{}")
        since = source_date(cursor.get("updated_at"))
        pending_latest = source_date(cursor.get("pending_updated_at"))
        url = cursor.get("next_url") or ATOM_URL
        max_pages = min(max(int(config.get("max_pages", 5)), 1), 20)
        budget = _request_budget()
        documents = []
        latest = pending_latest or since
        complete = True
        warnings = []
        for _ in range(max_pages):
            content, _, _ = fetch_bytes(
                client,
                url,
                allowed_hosts=HOSTS,
                max_bytes=5_000_000,
                before_request=budget.acquire,
            )
            entries, next_url, page_latest = parse_atom(content)
            for entry in entries:
                if since is not None and entry["updated_at"] <= since:
                    continue
                xml, _, _ = fetch_bytes(
                    client,
                    entry["xml_url"],
                    allowed_hosts=HOSTS,
                    max_bytes=20_000_000,
                    before_request=budget.acquire,
                )
                documents.append(parse_legaldocml(xml, entry))
            if page_latest is not None and (latest is None or page_latest > latest):
                latest = page_latest
            if not next_url:
                url = None
                break
            url = next_url
        else:
            complete = False
            warnings.append("Find Case Law page limit reached; continuation was checkpointed.")
        if not documents and latest is None:
            raise FetchError("Find Case Law feed did not contain dated entries.")
        next_cursor = {
            **cursor,
            "updated_at": (
                latest.astimezone(UTC).isoformat()
                if complete and latest
                else cursor.get("updated_at")
            ),
            "next_url": url,
            "pending_updated_at": latest.astimezone(UTC).isoformat()
            if not complete and latest
            else None,
            "retrieved_at": now.astimezone(UTC).isoformat(),
        }
        return FetchBatch(
            documents=documents,
            cursor=json.dumps(next_cursor, sort_keys=True),
            complete=complete,
            warnings=warnings,
        )


__all__ = [
    "ATOM_URL",
    "CaseLawAdapter",
    "parse_atom",
    "parse_legaldocml",
    "revalidate_retained_cases",
]
