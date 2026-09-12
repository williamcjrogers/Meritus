import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from meritus.sources.common import source_json
from meritus.sources.procurement import parse_release

NOW = "2026-09-01T12:00:00Z"


def test_official_uk9_and_uk11_examples_have_no_adverse_signal():
    fixtures = Path(__file__).parents[1] / "fixtures" / "procurement"
    uk9 = json.loads((fixtures / "uk9.json").read_text())
    history = json.loads((fixtures / "uk9-history.json").read_text())
    doc = parse_release(uk9, "find_tender", history)
    assert any(r.from_key == "GB-COH:08834019" and r.role == "supplier" for r in doc.relationships)
    assert not any(o.kind.startswith("adverse") for o in doc.observations)
    uk11 = json.loads((fixtures / "uk11.json").read_text())
    assert not any(
        o.kind.startswith("adverse") for o in parse_release(uk11, "find_tender").observations
    )


def test_upstream_infinity_is_retained_and_never_silently_becomes_null():
    release = source_json(
        '{"id":"infinity","ocid":"test","date":"2026-09-01T00:00:00Z",'
        '"tender":{"lotDetails":{"maximumLotsBidPerSupplier":Infinity}}}'
    )
    doc = parse_release(release, "find_tender")
    saved = json.loads(doc.model_dump_json())
    assert saved["payload"]["release"]["tender"]["lotDetails"]["maximumLotsBidPerSupplier"] == {
        "source_non_finite_number": "Infinity"
    }
    assert doc.warnings and "maximumLotsBidPerSupplier" in doc.warnings[0]


def test_upstream_valid_json_exponent_overflow_keeps_its_original_literal():
    parsed = source_json('{"value":1e999}')
    assert parsed == {"value": {"source_non_finite_number": "1e999"}}


def release_with_supplier():
    return {
        "id": "release-1",
        "ocid": "process-1",
        "date": NOW,
        "tender": {"title": "Synthetic bridge works"},
        "parties": [
            {
                "id": "buyer",
                "name": "Example Authority",
                "roles": ["buyer"],
                "identifier": {"scheme": "GB-PPON", "id": "TEST-123"},
            },
            {
                "id": "supplier-1",
                "name": "Synthetic Contractor Ltd",
                "roles": ["supplier"],
                "identifier": {"scheme": "GB-COH", "id": "8834019"},
            },
            {
                "id": "supplier-2",
                "name": "Other Contractor Ltd",
                "roles": ["supplier"],
                "identifier": {"scheme": "GB-COH", "id": "09999999"},
            },
        ],
        "awards": [
            {"id": "a1", "suppliers": [{"id": "supplier-1"}]},
            {"id": "a2", "suppliers": [{"id": "supplier-2"}]},
        ],
        "contracts": [{"id": "c1", "awardID": "a1", "status": "active"}],
    }


def test_successful_completion_is_not_adverse():
    release = release_with_supplier()
    release["contracts"][0].update(
        status="terminated", terminationRationaleClassification={"id": "contractCompleted"}
    )
    doc = parse_release(release, "find_tender")
    assert not any(o.kind == "adverse_termination" for o in doc.observations)


def test_metrics_met_and_other_are_not_adverse_and_buyer_is_not_supplier():
    release = release_with_supplier()
    release["contracts"][0]["implementation"] = {
        "metrics": [
            {"id": "1", "observations": [{"measureClassification": {"id": "met"}}]},
            {
                "id": "2",
                "observations": [
                    {"measureClassification": {"id": "other"}, "notes": "Only one KPI was agreed."}
                ],
            },
        ]
    }
    doc = parse_release(release, "find_tender")
    assert not any(o.kind == "adverse_performance" for o in doc.observations)
    assert any(e.key == "GB-COH:08834019" for e in doc.entities)
    assert all(e.scheme != "GB-COH" for e in doc.entities if e.name == "Example Authority")


def test_failure_joins_specific_award_supplier_and_stable_event():
    release = release_with_supplier()
    release["contracts"][0]["implementation"] = {
        "performanceFailures": [
            {
                "id": "failure-1",
                "events": 1,
                "description": "Specified delivery obligation not met",
                "period": {"endDate": NOW},
            },
        ]
    }
    first = parse_release(release, "find_tender")
    release["id"] = "release-2"
    second = parse_release(release, "find_tender")
    failure = [o for o in first.observations if o.kind == "adverse_performance"]
    assert len(failure) == 1
    assert failure[0].subject_key == "GB-COH:08834019"
    assert failure[0].state == "verified"
    assert failure[0].event_key == next(
        o.event_key for o in second.observations if o.kind == "adverse_performance"
    )


def test_hydration_uses_history_before_event_not_future_supplier():
    release = release_with_supplier()
    original = release_with_supplier()
    original["date"] = "2026-08-01T00:00:00Z"
    future = release_with_supplier()
    future["date"] = "2026-10-01T00:00:00Z"
    future["awards"][0]["suppliers"] = [{"id": "supplier-2"}]
    release["parties"] = release["parties"][:1]
    release.pop("awards")
    doc = parse_release(release, "find_tender", {"releases": [original, future]})
    links = [r for r in doc.relationships if r.role == "supplier"]
    assert any(r.from_key == "GB-COH:08834019" for r in links)
    assert not any(r.from_key == "GB-COH:09999999" for r in links)


def test_plural_normal_completion_and_unknown_ground_stays_pending():
    release = release_with_supplier()
    release["contracts"][0].update(
        status="terminated", terminationRationaleClassifications=[{"id": "contractCompleted"}]
    )
    assert not any(
        o.kind == "adverse_termination" for o in parse_release(release, "find_tender").observations
    )
    release["contracts"][0]["terminationRationaleClassifications"] = [
        {"id": "unfamiliarReason", "description": "Requires source review"}
    ]
    observations = parse_release(release, "find_tender").observations
    assert all(o.state == "pending" for o in observations if o.kind == "adverse_termination")


def test_award_only_contracts_finder_and_malformed_schema():
    release = release_with_supplier()
    release.pop("contracts")
    release["awards"][0].update(
        value={"amount": 6000000, "currency": "GBP"},
        contractPeriod={"startDate": "2026-01-01T00:00:00Z", "endDate": "2029-01-01T00:00:00Z"},
    )
    doc = parse_release(release, "contracts_finder")
    context = [o for o in doc.observations if o.kind == "contract_value_context"]
    assert len(context) == 1 and context[0].value == 6000000
    assert context[0].subject_key == "GB-COH:08834019"
    with pytest.raises(ValueError, match="release"):
        parse_release({"date": datetime.now(UTC).isoformat()}, "find_tender")


def test_award_embedded_supplier_receives_responsible_failure_and_effective_dates():
    release = release_with_supplier()
    release["parties"] = release["parties"][:1]
    release["awards"][0]["suppliers"] = [
        {
            "id": "supplier-1",
            "name": "Synthetic Contractor Ltd",
            "identifier": {"scheme": "GB-COH", "id": "08834019"},
        }
    ]
    release["contracts"][0]["period"] = {
        "startDate": "2026-01-01T00:00:00Z",
        "endDate": "2026-12-31T00:00:00Z",
    }
    release["contracts"][0]["implementation"] = {
        "performanceFailures": [
            {
                "id": "f1",
                "events": 1,
                "description": "Test delivery failure",
                "suppliers": [{"id": "supplier-1"}],
            }
        ]
    }
    doc = parse_release(release, "find_tender")
    adverse = [item for item in doc.observations if item.kind == "adverse_performance"]
    assert len(adverse) == 1 and adverse[0].subject_key == "GB-COH:08834019"
    relationship = next(item for item in doc.relationships if item.role == "supplier")
    assert relationship.valid_from.isoformat().startswith("2026-01-01")
    assert relationship.valid_to.isoformat().startswith("2026-12-31")


@pytest.mark.parametrize("owner", ["tender", "award"])
def test_engineering_cpv_in_item_is_included(owner):
    from meritus.sources.procurement import construction_release

    release = {"tender": {"mainProcurementCategory": "services"}}
    item = {"id": "engineering", "classification": {"scheme": "CPV", "id": "71000000"}}
    if owner == "tender":
        release["tender"]["items"] = [item]
    else:
        release["awards"] = [{"id": "award", "items": [item]}]
    assert construction_release(release)


@pytest.mark.parametrize("with_contracts", [True, False])
def test_award_shell_hydrates_dated_supplier_before_collection(now, with_contracts):
    import httpx

    from meritus.sources.procurement import ProcurementAdapter

    release = release_with_supplier()
    history = release_with_supplier()
    history["date"] = "2026-08-01T00:00:00Z"
    release["tender"]["mainProcurementCategory"] = "works"
    release["parties"] = release["parties"][:1]
    release["awards"] = [{"id": "a1"}]
    if not with_contracts:
        release.pop("contracts")
    seen = []

    def handler(request):
        seen.append(request.url.path)
        return httpx.Response(
            200,
            json={"releases": [history]}
            if "ocdsRecordPackages" in request.url.path
            else {"releases": [release]},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        batch = ProcurementAdapter("find_tender").fetch({"config": {}, "cursor": None}, client, now)
    assert any("ocdsRecordPackages" in path for path in seen)
    assert any(
        r.from_key == "GB-COH:08834019"
        for r in batch.documents[0].relationships
        if r.role == "supplier"
    )


def test_unavailable_optional_history_preserves_release_and_partial_coverage(now):
    import httpx

    from meritus.sources.procurement import ProcurementAdapter

    release = release_with_supplier()
    release["tender"]["mainProcurementCategory"] = "works"
    release["parties"] = []

    def handler(request):
        if "/Record/" in request.url.path:
            return httpx.Response(404)
        return httpx.Response(200, json={"releases": [release]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = ProcurementAdapter("contracts_finder").fetch({"config": {}}, client, now)
    assert len(result.documents) == 1 and result.complete is False
    assert any("history" in warning.lower() for warning in result.warnings)
    assert result.documents[0].payload["history_lookup"]["status"] == "unavailable"
    assert not any(
        entity.verified and entity.kind == "organisation" for entity in result.documents[0].entities
    )


def test_large_official_record_history_uses_separate_bounded_size(monkeypatch, now):
    import meritus.sources.procurement as module

    release = release_with_supplier()
    release["tender"]["mainProcurementCategory"] = "works"
    release["parties"] = []
    limits = []

    def fetch(client, url, **kwargs):
        limits.append(kwargs.get("max_bytes", 10_000_000))
        return json.dumps({"releases": [release]}).encode(), {}, 200

    monkeypatch.setattr(module, "fetch_bytes", fetch)
    module.ProcurementAdapter("find_tender").fetch({"config": {}}, object(), now)
    assert limits[-1] == 64_000_000


@pytest.mark.parametrize("status,body", [(200, b""), (204, b""), (200, b" \n")])
def test_empty_optional_history_keeps_published_release_and_identity_gap(now, status, body):
    import httpx

    from meritus.sources.procurement import ProcurementAdapter

    release = release_with_supplier()
    release["tender"]["mainProcurementCategory"] = "works"
    release["parties"] = []

    def handler(request):
        if "ocdsRecordPackages" in request.url.path:
            return httpx.Response(
                status, content=body, headers={"content-type": "application/json"}
            )
        return httpx.Response(200, json={"releases": [release]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = ProcurementAdapter("find_tender").fetch({"config": {}}, client, now)
    assert len(result.documents) == 1 and result.complete is False
    document = result.documents[0]
    assert document.external_id == release["id"]
    assert document.payload["history_lookup"]["reason"] == "empty_response"
    assert document.payload["history_lookup"]["status"] == "unavailable"
    assert not any(entity.verified for entity in document.entities if entity.kind == "organisation")


def test_malformed_nonempty_optional_history_still_fails_closed(now):
    import httpx

    from meritus.sources.http import FetchError
    from meritus.sources.procurement import ProcurementAdapter

    release = release_with_supplier()
    release["tender"]["mainProcurementCategory"] = "works"
    release["parties"] = []

    def handler(request):
        if "ocdsRecordPackages" in request.url.path:
            return httpx.Response(200, content=b'{"records":')
        return httpx.Response(200, json={"releases": [release]})

    with (
        httpx.Client(transport=httpx.MockTransport(handler)) as client,
        pytest.raises(FetchError, match="supplier history returned malformed JSON"),
    ):
        ProcurementAdapter("find_tender").fetch({"config": {}}, client, now)


def test_rate_limit_after_complete_page_returns_resumable_prior_pages(monkeypatch, now):
    import meritus.sources.procurement as module
    from meritus.sources.http import RateLimited

    first = release_with_supplier()
    first["id"] = "complete-page-release"
    first["tender"]["mainProcurementCategory"] = "works"
    interrupted_url = f"{module.ENDPOINTS['find_tender']}?cursor=second"
    calls = 0

    def fetch(client, url, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            return (
                json.dumps({"releases": [first], "links": {"next": interrupted_url}}).encode(),
                {},
                200,
            )
        raise RateLimited(120)

    ticks = iter((100.0, 107.0))
    monkeypatch.setattr(module, "fetch_bytes", fetch)
    monkeypatch.setattr(module.time, "monotonic", lambda: next(ticks))

    result = module.ProcurementAdapter("find_tender").fetch({"config": {}}, object(), now)

    assert [document.external_id for document in result.documents] == ["complete-page-release"]
    assert result.complete is False
    checkpoint = json.loads(result.cursor)
    assert checkpoint["next"] == interrupted_url
    assert datetime.fromisoformat(checkpoint["retry_not_before"]) == now + timedelta(seconds=127)
    assert "Publisher rate limit" in result.warnings[0]
    assert "retry after 120 seconds" in result.warnings[0]
    assert calls == 2


def test_history_rate_limit_discards_entire_interrupted_page(monkeypatch, now):
    import meritus.sources.procurement as module
    from meritus.sources.http import RateLimited

    complete = release_with_supplier()
    complete["id"] = "complete-page-release"
    complete["tender"]["mainProcurementCategory"] = "works"
    staged = release_with_supplier()
    staged["id"] = "must-be-discarded"
    staged["tender"]["mainProcurementCategory"] = "works"
    needs_history = release_with_supplier()
    needs_history["id"] = "history-rate-limit"
    needs_history["ocid"] = "process-needing-history"
    needs_history["tender"]["mainProcurementCategory"] = "works"
    needs_history["parties"] = []
    interrupted_url = f"{module.ENDPOINTS['find_tender']}?cursor=second"
    calls = 0

    def fetch(client, url, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            package = {"releases": [complete], "links": {"next": interrupted_url}}
        elif calls == 2:
            package = {"releases": [staged, needs_history]}
        else:
            raise RateLimited(30)
        return json.dumps(package).encode(), {}, 200

    monkeypatch.setattr(module, "fetch_bytes", fetch)
    monkeypatch.setattr(module.time, "monotonic", lambda: 10.0)

    result = module.ProcurementAdapter("find_tender").fetch({"config": {}}, object(), now)

    assert [document.external_id for document in result.documents] == ["complete-page-release"]
    assert json.loads(result.cursor)["next"] == interrupted_url
    assert result.complete is False


def test_retry_checkpoint_blocks_premature_network_resume(monkeypatch, now):
    import meritus.sources.procurement as module
    from meritus.sources.http import RateLimited

    requests = 0

    def fetch(*args, **kwargs):
        nonlocal requests
        requests += 1
        raise AssertionError("No network request is permitted before the retry deadline.")

    cursor = json.dumps(
        {
            "next": f"{module.ENDPOINTS['find_tender']}?cursor=second",
            "window_end": now.isoformat(),
            "retry_not_before": (now + timedelta(seconds=61)).isoformat(),
        }
    )
    monkeypatch.setattr(module, "fetch_bytes", fetch)

    with pytest.raises(RateLimited) as error:
        module.ProcurementAdapter("find_tender").fetch(
            {"config": {}, "cursor": cursor}, object(), now
        )

    assert error.value.retry_after == 61
    assert requests == 0


def test_first_page_rate_limit_remains_a_runner_level_rate_limit(monkeypatch, now):
    import meritus.sources.procurement as module
    from meritus.sources.http import RateLimited

    def fetch(*args, **kwargs):
        raise RateLimited(90)

    monkeypatch.setattr(module, "fetch_bytes", fetch)

    with pytest.raises(RateLimited) as error:
        module.ProcurementAdapter("find_tender").fetch({"config": {}}, object(), now)

    assert error.value.retry_after == 90
