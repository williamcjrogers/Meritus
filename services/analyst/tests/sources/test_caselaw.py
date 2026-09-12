import json
from datetime import UTC, datetime

import pytest

from meritus.sources.caselaw import ATOM_URL, CaseLawAdapter, parse_atom, parse_legaldocml

ATOM = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:tna="https://caselaw.nationalarchives.gov.uk">
  <link rel="next" href="https://caselaw.nationalarchives.gov.uk/atom.xml?page=2" />
  <entry>
    <id>https://caselaw.nationalarchives.gov.uk/id/d-12</id>
    <tna:uri>d-12</tna:uri>
    <title>Example Ltd v Builder Ltd</title>
    <updated>2026-09-11T12:30:00Z</updated>
    <published>2026-09-10T10:00:00Z</published>
    <link rel="alternate" href="https://caselaw.nationalarchives.gov.uk/tna.synthetic" />
    <link rel="alternate" type="application/akn+xml"
      href="https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/d-12/data.xml" />
  </entry>
</feed>"""


def test_atom_retains_stable_d_identifier_update_and_pagination():
    entries, next_url, updated = parse_atom(ATOM)
    assert entries[0]["external_id"] == "d-12"
    assert entries[0]["source_url"] == "https://caselaw.nationalarchives.gov.uk/tna.synthetic"
    assert entries[0]["updated_at"] == datetime(2026, 9, 11, 12, 30, tzinfo=UTC)
    assert next_url == "https://caselaw.nationalarchives.gov.uk/atom.xml?page=2"
    assert updated == datetime(2026, 9, 11, 12, 30, tzinfo=UTC)


@pytest.mark.parametrize(
    "pdf_url",
    [
        "https://assets.caselaw.nationalarchives.gov.uk/d-synthetic/d-synthetic.pdf",
        "https://unused.example.invalid/offered.pdf",
    ],
)
def test_offered_pdf_does_not_block_or_expand_xml_ingestion(monkeypatch, tmp_path, pdf_url):
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    document_id = "d-00000000-0000-0000-0000-000000000012"
    atom = ATOM.replace(b"d-12", document_id.encode()).replace(
        b"</entry>",
        f'<link rel="alternate" type="application/pdf" href="{pdf_url}" /></entry>'.encode(),
    )
    xml_url = f"https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/{document_id}/data.xml"
    calls = []

    def fake_fetch(client, url, **kwargs):
        calls.append(url)
        if url == ATOM_URL:
            return atom, {}, 200
        assert url == xml_url, "Only the approved XML alternate may be fetched"
        return (
            b'<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0">'
            b"<judgment><judgmentBody><p>The claim was dismissed.</p></judgmentBody></judgment>"
            b"</akomaNtoso>",
            {},
            200,
        )

    monkeypatch.setattr("meritus.sources.caselaw.fetch_bytes", fake_fetch)
    batch = CaseLawAdapter().fetch(
        {"config": {"max_pages": 1}, "cursor": None},
        object(),
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert [document.external_id for document in batch.documents] == [document_id]
    assert calls == [ATOM_URL, xml_url]
    assert pdf_url not in batch.documents[0].model_dump_json()


@pytest.mark.parametrize(
    "consumed_url",
    [
        b"https://caselaw.nationalarchives.gov.uk/tna.synthetic",
        b"https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/d-12/data.xml",
        b"https://caselaw.nationalarchives.gov.uk/atom.xml?page=2",
    ],
)
def test_unapproved_consumed_html_xml_and_pagination_links_are_rejected(consumed_url):
    atom = ATOM.replace(consumed_url, b"https://unapproved.example.invalid/source")
    with pytest.raises(ValueError, match="unapproved URL"):
        parse_atom(atom)


def test_legaldocml_rejects_dtd_and_external_entities():
    malicious = b"""<!DOCTYPE judgment [<!ENTITY stolen SYSTEM "file:///etc/passwd">]>
    <akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"><judgment>&stolen;</judgment></akomaNtoso>"""
    with pytest.raises(ValueError, match=r"DTD|entity"):
        parse_legaldocml(
            malicious,
            {
                "external_id": "ewhc/tcc/2026/d-12",
                "source_url": "https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2026/d-12",
                "title": "Example",
                "published_at": datetime(2026, 9, 10, tzinfo=UTC),
                "updated_at": datetime(2026, 9, 11, tzinfo=UTC),
            },
        )


def test_atom_continuation_does_not_advance_high_water_early(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    page_two = (
        ATOM.replace(
            b'<link rel="next" href="https://caselaw.nationalarchives.gov.uk/atom.xml?page=2" />',
            b"",
        )
        .replace(b"d-12", b"d-11")
        .replace(b"2026-09-11T12:30:00Z", b"2026-09-10T12:30:00Z")
    )
    legal_xml = (
        b'<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0">'
        b"<judgment><judgmentBody><p>The claim was dismissed.</p></judgmentBody></judgment>"
        b"</akomaNtoso>"
    )
    calls = []

    def fake_fetch(client, url, **kwargs):
        del client, kwargs
        calls.append(url)
        if url == ATOM_URL:
            return ATOM, {}, 200
        if url.endswith("page=2"):
            return page_two, {}, 200
        return legal_xml, {}, 200

    monkeypatch.setattr("meritus.sources.caselaw.fetch_bytes", fake_fetch)
    first = CaseLawAdapter().fetch(
        {"config": {"max_pages": 1}, "cursor": None},
        object(),
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    first_cursor = json.loads(first.cursor)
    assert first.complete is False
    assert first_cursor["updated_at"] is None
    assert first_cursor["pending_updated_at"] == "2026-09-11T12:30:00+00:00"

    second = CaseLawAdapter().fetch(
        {"config": {"max_pages": 1}, "cursor": first.cursor},
        object(),
        datetime(2026, 9, 12, 1, tzinfo=UTC),
    )
    second_cursor = json.loads(second.cursor)
    assert second.complete is True
    assert second_cursor["updated_at"] == "2026-09-11T12:30:00+00:00"
    assert second_cursor["next_url"] is None
    assert calls[0] == ATOM_URL


def test_legaldocml_observations_keep_paragraph_ids_instead_of_inventing_pages():
    entries, _, _ = parse_atom(ATOM)
    xml = (
        b'<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0">'
        b"<judgment>"
        b"<body>"
        b'<paragraph eId="para_17">'
        b"<num>17.</num>"
        b"<content>"
        b"<p>Completion was delayed by 8 weeks.</p>"
        b"</content>"
        b"</paragraph>"
        b'<paragraph eId="para_42">'
        b"<content>"
        b"<p>The contract was fixed-price.</p>"
        b"</content>"
        b"</paragraph>"
        b"</body>"
        b"</judgment>"
        b"</akomaNtoso>"
    )
    doc = parse_legaldocml(xml, entries[0])
    delays = [item for item in doc.observations if item.kind == "project_delay"]
    assert delays and "para_17" in delays[0].evidence_pointer
    assert all("page:" not in item.evidence_pointer for item in doc.observations)
    assert all("page" not in item.attributes for item in doc.observations)
    assert any("para_42" in location["pointer"] for location in doc.payload["locations"])
