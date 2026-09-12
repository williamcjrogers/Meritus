import json
from datetime import UTC, datetime

import httpx
import pytest

from meritus.sources.rns import RNSAdapter, parse_index, parse_newsml, validate_base_url

INDEX = b"""{
  "workingDate": "2026-09-12",
  "maxSequenceNumber": 124,
  "announcements": [
    {"workingDate": "2026-09-12", "sequenceNumber": 123, "annId": 701},
    {"workingDate": "2026-09-12", "sequenceNumber": 124, "annId": 702,
     "received": "2026-09-12T08:05:00Z", "headline": "Contract update",
     "company": "Example plc"}
  ]
}"""

NEWSML = b"""<newsMessage xmlns="http://iptc.org/std/nar/2006-10-01/">
  <header><sent>2026-09-12T08:05:00Z</sent></header>
  <itemSet><newsItem guid="rns-124"><contentMeta><headline>Contract update</headline></contentMeta>
    <contentSet><inlineXML><html><body>
      <p>Completion slipped by 8 weeks.</p>
    </body></html></inlineXML></contentSet>
  </newsItem></itemSet>
</newsMessage>"""


def test_rns_sequence_replay_is_stable_and_token_is_never_persisted():
    entries = parse_index(INDEX, "https://feed.rns-distribution.com", after_sequence=123)
    assert [item["sequence"] for item in entries] == [124]
    doc = parse_newsml(NEWSML, entries[0])
    assert doc.external_id == "2026-09-12:124"
    assert "secret-token" not in doc.model_dump_json()
    assert parse_newsml(NEWSML, entries[0]).external_id == doc.external_id


def test_rns_hostname_is_restricted_to_onboarded_domain():
    assert (
        validate_base_url("https://feed.rns-distribution.com")
        == "https://feed.rns-distribution.com"
    )
    with pytest.raises(ValueError, match=r"rns-distribution\.com"):
        validate_base_url("https://rns-distribution.com.attacker.test")


def test_rns_adapter_uses_token_in_memory_and_checkpoints_sequence(monkeypatch, tmp_path):
    monkeypatch.setenv("MERITUS_RNS_USER", "licensed-user")
    monkeypatch.setenv("MERITUS_RNS_ACCESS_KEY", "licensed-key")
    monkeypatch.setenv("MERITUS_RNS_BASE_URL", "https://feed.rns-distribution.com")
    monkeypatch.setenv("MERITUS_DATA_DIR", str(tmp_path))
    requests = []

    def handler(request):
        requests.append(request)
        if request.url.path == "/login":
            assert json.loads(request.content) == {
                "user": "licensed-user",
                "accessKey": "licensed-key",
            }
            return httpx.Response(200, json={"token": "secret-token"})
        assert request.headers["authorization"] == "Bearer secret-token"
        if request.url.path == "/announcements/2026-09-12":
            return httpx.Response(200, content=INDEX)
        return httpx.Response(200, content=NEWSML)

    source = {"cursor": json.dumps({"date": "2026-09-12", "sequence": 123})}
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        batch = RNSAdapter().fetch(source, client, datetime(2026, 9, 12, 12, tzinfo=UTC))
    assert len(batch.documents) == 1
    assert json.loads(batch.cursor)["sequence"] == 124
    assert "secret-token" not in batch.model_dump_json()
    assert [request.url.path for request in requests] == [
        "/login",
        "/announcements/2026-09-12",
        "/announcements/2026-09-12/124",
    ]


def test_newsml_provider_name_never_becomes_issuer():
    entry = parse_index(INDEX, "https://feed.rns-distribution.com", after_sequence=123)[0]
    xml = NEWSML.replace(
        b"<contentMeta>", b"<contentMeta><provider><name>Unrelated Distributor</name></provider>"
    )
    doc = parse_newsml(xml, entry)
    assert [entity.name for entity in doc.entities] == ["Example plc"]
    no_issuer = parse_newsml(xml, {**entry, "company": None})
    assert no_issuer.entities == [] and no_issuer.observations == []
