from datetime import timedelta

import pytest
from sqlalchemy import event

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.scoring import score_entities as reference_score_entities
from meritus.intelligence.service import IntelligenceService
from meritus.models import Entity, Review


def _seed(repo, now, *, detail="Initial evidence"):
    document = ParsedDocument(
        external_id="signal-1",
        source_url="https://check-payment-practices.service.gov.uk/report/1",
        title="Signal",
        published_at=now - timedelta(days=1),
        payload={"detail": detail},
        entities=[
            EntityInput(
                key="GB-COH:08834019",
                name="Example Ltd",
                scheme="GB-COH",
                identifier="08834019",
                verified=True,
                properties={
                    "sector": "construction",
                    "geography": "London",
                    "lead_time_band": "12-24 months",
                },
            )
        ],
        observations=[
            ObservationInput(
                subject_key="GB-COH:08834019",
                kind="accounts_overdue",
                event_key="accounts:1",
                headline="Accounts overdue",
                detail=detail,
                occurred_at=now - timedelta(days=2),
                state="verified",
            )
        ],
    )
    repo.ingest_batch("payment_practices", FetchBatch(documents=[document]), now)
    return document


def test_watchlist_enriches_contract_fields_and_filters(repo, now, monkeypatch):
    monkeypatch.setattr("meritus.repository.workflow.utc_now", lambda: now)
    _seed(repo, now)
    entity = repo.list_entities()[0]
    repo.record_review("entity", entity["id"], "verify", "Checked", "WR")
    repo.add_pipeline_action(
        {
            "entity_id": entity["id"],
            "stage": "shortlisted",
            "note": "Review",
            "actor": "WR",
            "occurred_at": now,
        }
    )
    service = IntelligenceService(repo)
    item = service.watchlist(now, sector="construction", stage="shortlisted")["items"][0]
    assert (
        item["sector"],
        item["geography"],
        item["lead_time_band"],
        item["reviewer"],
        item["review_state"],
        item["pipeline_stage"],
    ) == ("construction", "London", "12-24 months", "WR", "verified", "shortlisted")
    assert "change_since_previous" in item
    assert "suggested_review_route" in item


def test_snapshot_retains_frozen_inputs_after_later_correction(repo, now):
    document = _seed(repo, now)
    service = IntelligenceService(repo)
    snapshot = service.create_snapshot("weekly", now)
    frozen = snapshot["payload"]
    corrected = document.model_copy(
        update={
            "payload": {"detail": "Correction"},
            "observations": [
                document.observations[0].model_copy(
                    update={"detail": "Corrected later", "state": "rejected"}
                )
            ],
        }
    )
    repo.ingest_batch(
        "payment_practices", FetchBatch(documents=[corrected]), now + timedelta(days=1)
    )
    retained = repo.get_snapshot(snapshot["id"])["payload"]
    assert retained == frozen
    assert retained["observations"][0]["detail"] == "Initial evidence"
    assert retained["source_records"][0]["revision"] == 1


def test_future_published_revision_does_not_hide_eligible_lineage(repo, now):
    document = _seed(repo, now, detail="Eligible evidence")
    future = document.model_copy(
        update={
            "published_at": now + timedelta(days=1),
            "payload": {"detail": "Not known at cutoff"},
            "observations": [
                document.observations[0].model_copy(update={"detail": "Future publication"})
            ],
        }
    )
    repo.ingest_batch("payment_practices", FetchBatch(documents=[future]), now)

    snapshot = IntelligenceService(repo).create_snapshot("weekly", now)
    payload = snapshot["payload"]

    assert payload["items"][0]["score"] == 11.8
    assert payload["observations"][0]["detail"] == "Eligible evidence"
    assert payload["source_records"][0]["revision"] == 1


def test_snapshot_stores_record_references_without_raw_body_duplication(repo, now):
    _seed(repo, now)

    payload = IntelligenceService(repo).create_snapshot("weekly", now)["payload"]
    record = payload["source_records"][0]

    assert {"id", "source_id", "content_hash", "revision"} <= record.keys()
    assert {"payload", "raw_text", "observations"}.isdisjoint(record)
    assert payload["observations"][0]["record_id"] == record["id"]


def test_watchlist_record_query_does_not_select_raw_record_bodies(repo, engine, now):
    _seed(repo, now)
    statements = []

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement.casefold())

    event.listen(engine, "before_cursor_execute", capture_statement)
    try:
        IntelligenceService(repo).watchlist(now)
    finally:
        event.remove(engine, "before_cursor_execute", capture_statement)

    record_queries = [statement for statement in statements if "source_records" in statement]
    assert record_queries
    # Rights predicates and projected grant metadata may inspect JSON paths; raw payload
    # columns and raw text must not be selected into the scoring process.
    import re

    assert all(
        not re.search(r"(?:select|,)\s+source_records\.payload(?:\s+as|\s*,)", statement)
        for statement in record_queries
    )
    assert all(
        not re.search(r"source_records\.raw_text(?:\s|,)", statement)
        for statement in record_queries
    )


def test_retrospective_entity_reconstruction_is_rejected_without_history(repo, now):
    _seed(repo, now)
    with pytest.raises(ValueError, match="Historical entity state is unavailable"):
        IntelligenceService(repo).watchlist(now - timedelta(days=2))


def test_dashboard_truthfully_reports_coverage_and_source_counts(repo, now):
    _seed(repo, now)
    dashboard = IntelligenceService(repo).dashboard(now)
    assert dashboard["summary"]["entities"] == 1
    payment = next(
        item for item in dashboard["source_health"] if item["source_id"] == "payment_practices"
    )
    assert payment["record_count_at_cutoff"] == 1
    assert dashboard["summary"]["coverage_complete"] is False


def test_multi_entity_grouping_matches_pure_scorer_without_cross_product(repo, now, monkeypatch):
    _seed(repo, now)
    repo.ingest_batch(
        "payment_practices",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="signal-2",
                    source_url="https://check-payment-practices.service.gov.uk/report/2",
                    title="Second signal",
                    published_at=now - timedelta(days=1),
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:07777777",
                            name="Second Ltd",
                            scheme="GB-COH",
                            identifier="07777777",
                            verified=True,
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="GB-COH:07777777",
                            kind="new_charge",
                            event_key="charge:2",
                            headline="Charge",
                            detail="Charge evidence",
                            occurred_at=now - timedelta(days=2),
                            state="verified",
                        )
                    ],
                )
            ]
        ),
        now,
    )
    entities = repo.list_entities(limit=1000)
    observations = repo.list_observations()
    expected = reference_score_entities(entities, observations, now)
    calls = []

    def grouped_call(scoring_entities, scoring_observations, cutoff, rules=None):
        calls.append((len(scoring_entities), len(scoring_observations)))
        return reference_score_entities(scoring_entities, scoring_observations, cutoff, rules=rules)

    monkeypatch.setattr("meritus.intelligence.service.score_entities", grouped_call)
    actual = IntelligenceService(repo).watchlist(now)["items"]

    assert [(item["key"], item["score"]) for item in actual] == [
        (item["key"], item["score"]) for item in expected
    ]
    assert calls == [(1, 1), (1, 1)]


def test_metrics_enumerates_more_than_repository_page_limit(repo, now):
    with session_scope(repo.engine) as session:
        for index in range(1001):
            entity_id = f"metric-{index}"
            session.add(
                Entity(
                    id=entity_id,
                    key=f"test:metric:{index}",
                    kind="organisation",
                    name=f"Metric {index}",
                    verified=True,
                    properties={"cohort": "scale"},
                    created_at=now,
                    updated_at=now,
                )
            )
            session.add(
                Review(
                    target_type="entity",
                    target_id=entity_id,
                    action="verified",
                    actor="scale-test",
                    reason="Complete denominator test",
                    payload={},
                    created_at=now - timedelta(days=1),
                )
            )

    result = IntelligenceService(repo).metrics(now, cohort="scale")

    assert result["counts"]["reviewed_recommendations"] == 1001
    assert result["denominators"]["conversation_rate_reviewed"] == 1001


def test_snapshot_embeds_the_parameters_used_for_scoring(repo, now):
    from meritus.intelligence.rules import DEFAULT_RULES

    _seed(repo, now)
    snapshot = IntelligenceService(repo).create_snapshot("weekly", now)
    assert snapshot["payload"]["applied_rules"] == DEFAULT_RULES
    assert snapshot["payload"]["applied_rules"] is not DEFAULT_RULES


def test_current_rights_precede_identity_review_filters_and_evidence_search(repo, now):
    public = _seed(repo, now, detail="public concrete inspection")
    private = public.model_copy(
        update={
            "external_id": "restricted-record",
            "title": "Private tunnel evidence",
            "entities": [public.entities[0].model_copy(update={"name": "Hidden Company Name"})],
            "observations": [
                public.observations[0].model_copy(
                    update={"event_key": "private-event", "detail": "private tunnel inspection"}
                )
            ],
        }
    )
    repo.ingest_batch("find_tender", FetchBatch(documents=[private]), now)
    entity = repo.list_entities()[0]
    with session_scope(repo.engine) as session:
        session.add(
            Review(
                target_type="entity",
                target_id=entity["id"],
                action="verified",
                actor="Hidden Reviewer",
                reason="Restricted reason",
                created_at=now,
                payload={"source_id": "find_tender"},
            )
        )
    repo.update_source("find_tender", {"permissions": {"denied": True}})
    service = IntelligenceService(repo)
    assert service.watchlist(now, q="Hidden Company")["items"] == []
    assert service.watchlist(now, q="private tunnel")["items"] == []
    assert service.watchlist(now, reviewer="Hidden Reviewer")["items"] == []
    visible = service.watchlist(now, q="concrete inspection")["items"]
    assert len(visible) == 1 and visible[0]["name"] == "Example Ltd"
    assert visible[0]["reviewer"] is None


def test_live_materialisation_reuses_score_then_invalidates_permission_change(
    repo, now, monkeypatch
):
    from datetime import UTC, datetime

    from meritus.intelligence.cache import clear_cache

    current = datetime.now(UTC)
    _seed(repo, current)
    clear_cache(repo)
    calls = []
    original = IntelligenceService._watchlist_data

    def calculate(self, *args, **kwargs):
        calls.append(True)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(IntelligenceService, "_watchlist_data", calculate)
    assert IntelligenceService(repo).watchlist()["items"]
    assert IntelligenceService(repo).watchlist(sector="construction")["items"]
    assert len(calls) == 1
    repo.update_source("payment_practices", {"permissions": {"denied": True}})
    assert IntelligenceService(repo).watchlist()["items"] == []
    assert len(calls) == 2


def test_frozen_export_preserves_name_after_later_human_edit(repo, now):
    from meritus.read_access import sanitise_ranked_items

    _seed(repo, now)
    snapshot = IntelligenceService(repo).create_snapshot("weekly", now)
    payload = snapshot["payload"]
    entity_id = payload["entities"][0]["id"]
    repo.record_review(
        "entity",
        entity_id,
        "update",
        "Later name correction",
        "WR",
        {"name": "Later reviewed name"},
    )
    with session_scope(repo.engine) as session:
        exported = sanitise_ranked_items(
            session,
            payload["items"],
            rule_version=snapshot["rule_version"],
            knowledge_cutoff=payload["knowledge_cutoff"],
            applied_rules=payload["applied_rules"],
            frozen_inputs=payload,
            now=now + timedelta(days=1),
        )
    assert exported[0]["name"] == "Example Ltd"
    assert exported[0]["score"] == payload["items"][0]["score"]
    repo.update_source("payment_practices", {"permissions": {"denied": True}})
    with session_scope(repo.engine) as session:
        assert (
            sanitise_ranked_items(
                session,
                payload["items"],
                rule_version=snapshot["rule_version"],
                knowledge_cutoff=payload["knowledge_cutoff"],
                applied_rules=payload["applied_rules"],
                frozen_inputs=payload,
                now=now + timedelta(days=1),
            )
            == []
        )


def test_live_cache_obeys_timed_expiry_without_physical_purge(repo, now, monkeypatch):
    from datetime import datetime

    from sqlalchemy import select

    from meritus.intelligence.cache import clear_cache
    from meritus.models import SourceRecord

    clock = [now]

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0]

    monkeypatch.setattr("meritus.intelligence.cache.datetime", Clock)
    monkeypatch.setattr("meritus.intelligence.service.utc_now", lambda: clock[0])
    _seed(repo, now)
    with session_scope(repo.engine) as session:
        row = session.scalar(select(SourceRecord))
        row.expires_at = now + timedelta(seconds=1)
    clear_cache(repo)
    assert IntelligenceService(repo).watchlist()["items"]
    clock[0] = now + timedelta(seconds=2)
    assert IntelligenceService(repo).watchlist()["items"] == []
    with session_scope(repo.engine) as session:
        assert session.scalar(select(SourceRecord)).payload is not None
