"""Approved Construction Index RSS adapter with syndication grouping."""

from __future__ import annotations

import hashlib
import json
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from meritus.domain import EntityInput, FetchBatch, ParsedDocument
from meritus.sources.extraction import extract_document, secure_xml_root
from meritus.sources.http import FetchError, fetch_bytes

APPROVED_FEEDS = (
    "https://www.theconstructionindex.co.uk/feeds/news-uk.xml",
    "https://www.theconstructionindex.co.uk/feeds/news-contract.xml",
    "https://www.theconstructionindex.co.uk/feeds/news-law.xml",
)
HOSTS = {"www.theconstructionindex.co.uk"}


def _child_text(node, name: str) -> str:
    for child in node:
        if isinstance(child.tag, str) and child.tag.rsplit("}", 1)[-1].casefold() == name:
            return " ".join("".join(child.itertext()).split())
    return ""


def _article_id(guid: str, link: str, title: str) -> str:
    stable = link or guid or title
    return hashlib.sha256(stable.strip().casefold().encode()).hexdigest()[:32]


def parse_rss(data: bytes | str, feed_url: str) -> list[ParsedDocument]:
    if feed_url not in APPROVED_FEEDS:
        raise ValueError("Construction Index feed is not on the approved feed list.")
    root = secure_xml_root(data)
    items = [node for node in root.iter() if node.tag.rsplit("}", 1)[-1].casefold() == "item"]
    documents = []
    for item in items:
        title = _child_text(item, "title")
        link = _child_text(item, "link")
        guid = _child_text(item, "guid")
        description_html = _child_text(item, "description")
        if not title or not link:
            raise ValueError("Construction Index RSS item is missing title or link.")
        parts = urlsplit(link)
        if parts.scheme != "https" or parts.hostname not in {
            "www.theconstructionindex.co.uk",
            "theconstructionindex.co.uk",
        }:
            raise ValueError("Construction Index RSS item links outside the approved publisher.")
        try:
            published = parsedate_to_datetime(_child_text(item, "pubdate"))
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Construction Index RSS item has an invalid publication date."
            ) from exc
        if published.tzinfo is None:
            raise ValueError("Construction Index RSS publication date has no UTC offset.")
        summary = BeautifulSoup(description_html, "html.parser").get_text(" ", strip=True)
        article_id = _article_id(guid, link, title)
        entity = EntityInput(
            key=f"project:construction_index:{article_id}",
            kind="project",
            name=title,
            properties={"identity_status": "unresolved_from_headline"},
        )
        extracted = extract_document(summary, link, published, [entity])
        for observation in extracted.observations:
            observation.event_key = f"construction-index:{article_id}:{observation.kind}"
            observation.attributes["syndication_group"] = article_id
        documents.append(
            ParsedDocument(
                external_id=f"construction-index:{article_id}",
                source_url=link,
                title=title,
                published_at=published,
                payload={
                    "original_url": link,
                    "guid": guid or None,
                    "feed_urls": [feed_url],
                    "summary_sha256": hashlib.sha256(summary.encode()).hexdigest(),
                    "locations": extracted.payload["locations"],
                },
                entities=[entity],
                observations=extracted.observations,
                warnings=["RSS propositions and subject identity require analyst review."]
                if extracted.observations
                else [],
                media_type="application/rss+xml",
                raw_text=None,
            )
        )
    return documents


class ConstructionIndexAdapter:
    def fetch(self, source, client, now):
        config = source.get("config") or {}
        configured = config.get("approved_feeds")
        if not isinstance(configured, list) or not configured:
            raise FetchError("Construction Index has no configured approved feeds.")
        if any(item not in APPROVED_FEEDS for item in configured):
            raise FetchError("Construction Index configuration contains an unapproved feed.")
        grouped: dict[str, ParsedDocument] = {}
        for feed_url in configured:
            content, _, _ = fetch_bytes(client, feed_url, allowed_hosts=HOSTS, max_bytes=5_000_000)
            for document in parse_rss(content, feed_url):
                existing = grouped.get(document.external_id)
                if existing is None:
                    grouped[document.external_id] = document
                else:
                    existing.payload["feed_urls"] = sorted(
                        set(existing.payload["feed_urls"] + document.payload["feed_urls"])
                    )
        return FetchBatch(
            documents=list(grouped.values()),
            cursor=json.dumps({"retrieved_at": now.isoformat()}, sort_keys=True),
        )


__all__ = ["APPROVED_FEEDS", "ConstructionIndexAdapter", "parse_rss"]
