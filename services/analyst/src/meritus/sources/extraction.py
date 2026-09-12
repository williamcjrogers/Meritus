"""Conservative reviewed extraction with stable text evidence locations."""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable
from datetime import UTC, datetime

from lxml import etree

from meritus.domain import EntityInput, ObservationInput, ParsedDocument

_SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
_NEGATION = re.compile(r"\b(?:did not|does not|do not|not|no|never|without|excluded?)\b", re.I)
_YEAR = re.compile(r"\b(19\d{2}|20\d{2})\b")
_DURATION = re.compile(r"\b(\d+(?:\.\d+)?)\s*(days?|weeks?|months?)\b", re.I)
_GEOGRAPHY = re.compile(
    r"\b(London|Birmingham|Manchester|Leeds|Liverpool|Bristol|England|Scotland|Wales|"
    r"Northern Ireland|United Kingdom|UK)\b",
    re.I,
)
_PATTERNS = {
    "contract_provision": re.compile(
        r"\b(?:fixed[ -]price|lump[ -]sum|liquidated damages|extension of time|"
        r"contract(?:ual)? provision)\b",
        re.I,
    ),
    "project_delay": re.compile(
        r"\b(?:slipp(?:ed|age)|delay(?:ed|s)?|completion (?:moved|deferred)|overrun)\b", re.I
    ),
    "claims_hiring": re.compile(
        r"\b(?:hiring|recruiting|vacancy|seeking)\b.*"
        r"\b(?:claims?|commercial|quantity survey|QS)\b|"
        r"\b(?:claims?|commercial) manager\b",
        re.I,
    ),
}


def secure_xml_root(data: bytes | str):
    """Parse XML without DTDs, network access or entity expansion."""
    raw = data.encode() if isinstance(data, str) else data
    upper = raw.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise ValueError("XML DTD and entity declarations are not permitted.")
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        load_dtd=False,
        recover=False,
        huge_tree=False,
    )
    try:
        return etree.fromstring(raw, parser=parser)
    except etree.XMLSyntaxError as exc:
        raise ValueError("Source XML is invalid.") from exc


def _sentences(text: str) -> Iterable[tuple[int, int, str]]:
    for page_number, page in enumerate(text.split("\f"), 1):
        clean = re.sub(r"[ \t]+", " ", page).strip()
        if not clean:
            continue
        for sentence_number, sentence in enumerate(_SENTENCE.split(clean), 1):
            sentence = re.sub(r"\s+", " ", sentence).strip()
            if sentence:
                yield page_number, sentence_number, sentence


def _normalise_entities(entities) -> list[EntityInput]:
    return [
        item if isinstance(item, EntityInput) else EntityInput.model_validate(item)
        for item in entities
    ]


def extract_document(
    text: str,
    source_url: str,
    published_at: datetime,
    entities,
) -> ParsedDocument:
    """Create pending proposals only; analysts decide whether the text supports them."""
    if published_at.tzinfo is None or published_at.utcoffset() is None:
        raise ValueError("published_at must include a UTC offset")
    published_at = published_at.astimezone(UTC)
    entity_items = _normalise_entities(entities)
    digest = hashlib.sha256(
        f"{source_url}\n{published_at.isoformat()}\n{text}".encode()
    ).hexdigest()
    observations: list[ObservationInput] = []
    locations = []
    for page, sentence_number, sentence in _sentences(text):
        pointer = f"page:{page}:sentence:{sentence_number}"
        kinds = [kind for kind, pattern in _PATTERNS.items() if pattern.search(sentence)]
        if not kinds:
            continue
        years = [int(value) for value in _YEAR.findall(sentence)]
        duration = _DURATION.search(sentence)
        geography = _GEOGRAPHY.search(sentence)
        attributes = {
            "page": page,
            "sentence": sentence_number,
            "negated": bool(_NEGATION.search(sentence)),
            "historical": bool(years and min(years) < published_at.year),
            "period": duration.group(0) if duration else None,
            "geography": geography.group(0) if geography else None,
        }
        locations.append({"pointer": pointer, "sentence": sentence})
        for kind in kinds:
            for entity in entity_items:
                event_digest = hashlib.sha256(
                    f"{kind}\n{entity.key}\n{source_url}\n{pointer}\n{sentence}".encode()
                ).hexdigest()[:24]
                observations.append(
                    ObservationInput(
                        subject_key=entity.key,
                        kind=kind,
                        event_key=f"reviewed-extraction:{event_digest}",
                        headline={
                            "contract_provision": "Contract provision mentioned",
                            "project_delay": "Potential project delay mentioned",
                            "claims_hiring": "Claims-related recruitment mentioned",
                        }[kind],
                        detail=sentence,
                        occurred_at=published_at,
                        state="pending",
                        evidence_pointer=pointer,
                        value=float(duration.group(1))
                        if kind == "project_delay" and duration
                        else None,
                        unit=duration.group(2).lower().rstrip("s") + "s"
                        if kind == "project_delay" and duration
                        else None,
                        attributes={**attributes, "review_required": True},
                    )
                )
    return ParsedDocument(
        external_id=f"extraction:{digest}",
        source_url=source_url,
        title="Reviewed document extraction",
        published_at=published_at,
        payload={
            "original_url": source_url,
            "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "locations": locations,
        },
        entities=entity_items,
        observations=observations,
        warnings=["Machine-proposed observations require analyst review."] if observations else [],
        media_type="text/plain",
        raw_text=text,
    )


__all__ = ["extract_document", "secure_xml_root"]
