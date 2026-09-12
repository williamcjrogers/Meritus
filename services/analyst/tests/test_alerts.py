from datetime import timedelta

from sqlalchemy import event, func, select

from meritus.alerts import emit_alert, generate_scoring_alerts
from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.models import (
    Alert,
    AlertGeneration,
    AlertLineage,
    AlertScoreState,
    Entity,
    EntityProvenance,
    SourceRecord,
)
from meritus.retention import purge_expired
from meritus.sources.runner import run_source


def _record(repo, now, *, external_id="alert-record", event_key="event:one", expires_at=None):
    repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id=external_id,
                    source_url=f"https://example.invalid/{external_id}",
                    title="Synthetic alert evidence",
                    published_at=now,
                    expires_at=expires_at,
                    payload={"synthetic": True},
                    entities=[
                        EntityInput(
                            key="TEST:ALERT-SUBJECT",
                            name="Synthetic Alert Subject Ltd",
                            scheme="TEST",
                            identifier="ALERT-SUBJECT",
                            verified=True,
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="TEST:ALERT-SUBJECT",
                            kind="insolvency",
                            event_key=event_key,
                            headline="Synthetic qualifying event",
                            detail="Synthetic alert evidence only",
                            occurred_at=now,
                            state="verified",
                        )
                    ],
                )
            ]
        ),
        observed_at=now,
    )
    with session_scope(repo.engine) as session:
        record = session.scalar(select(SourceRecord).where(SourceRecord.external_id == external_id))
        entity = session.scalar(select(Entity).where(Entity.key == "TEST:ALERT-SUBJECT"))
        return record.id, entity.id


def _item(entity_id, record_ids, *, score, eligible=False):
    return {
        "entity_id": entity_id,
        "name": "Synthetic Alert Subject Ltd",
        "score": score,
        "eligible": eligible,
        "contributions": [
            {
                "record_id": record_id,
                "event_key": f"event:{index}",
                "kind": "insolvency",
                "qualifies": True,
                "exclusion_reason": None,
                "applied_points": score / len(record_ids),
            }
            for index, record_id in enumerate(record_ids, start=1)
        ],
    }


def test_scoring_alerts_baseline_new_event_material_change_and_replay(repo, now):
    first_record, entity_id = _record(repo, now)
    baseline = _item(entity_id, [first_record], score=15)

    assert generate_scoring_alerts(repo, [baseline], "rules-v1", now)["created"] == 0
    assert generate_scoring_alerts(repo, [baseline], "rules-v1", now)["created"] == 0

    second_record, _ = _record(
        repo,
        now + timedelta(minutes=1),
        external_id="alert-record-two",
        event_key="event:two",
    )
    with_new_event = _item(entity_id, [first_record, second_record], score=20)
    result = generate_scoring_alerts(repo, [with_new_event], "rules-v1", now + timedelta(minutes=2))
    assert result == {"created": 1, "qualifying_events": 1, "material_changes": 0}
    assert (
        generate_scoring_alerts(repo, [with_new_event], "rules-v1", now + timedelta(minutes=3))[
            "created"
        ]
        == 0
    )

    material = _item(entity_id, [first_record, second_record], score=31, eligible=True)
    result = generate_scoring_alerts(repo, [material], "rules-v1", now + timedelta(minutes=4))
    assert result == {"created": 1, "qualifying_events": 0, "material_changes": 1}
    assert (
        generate_scoring_alerts(repo, [material], "rules-v1", now + timedelta(minutes=5))["created"]
        == 0
    )

    with session_scope(repo.engine) as session:
        alerts = session.scalars(select(Alert).order_by(Alert.created_at)).all()
        assert [item.category for item in alerts] == ["qualifying_event", "material_change"]
        assert session.scalar(select(func.count()).select_from(AlertGeneration)) == 2
        assert session.scalar(select(func.count()).select_from(AlertLineage)) == 3
        state = session.get(AlertScoreState, entity_id)
        assert state.score == 31
        assert state.eligible is True


def test_source_failure_alert_is_fixed_generic_text_and_deduplicated(repo, now, monkeypatch):
    class PrivateFailure(Exception):
        pass

    def fail(_source_id):
        raise PrivateFailure("private upstream response body")

    monkeypatch.setattr("meritus.sources.runner.get_adapter", fail)
    result = run_source(repo, "find_tender", now)
    assert result["status"] == "failed"

    with session_scope(repo.engine) as session:
        alert = session.scalar(select(Alert))
        generation = session.get(AlertGeneration, alert.id)
        assert alert.title == "Source collection needs attention"
        assert alert.body == (
            "Source find_tender ended with status failed. Review source health before retrying."
        )
        assert "private upstream" not in alert.body
        assert generation.kind == "source_failure"
        assert generation.source_id == "find_tender"


def test_material_change_retains_previous_readable_record_lineage(repo, now):
    first_record, entity_id = _record(repo, now, external_id="material-old")
    second_record, _ = _record(
        repo,
        now + timedelta(minutes=1),
        external_id="material-current",
        event_key="event:current",
    )
    baseline = _item(entity_id, [first_record, second_record], score=35)
    generate_scoring_alerts(repo, [baseline], "rules-v1", now + timedelta(minutes=2))

    current = _item(entity_id, [second_record], score=20)
    result = generate_scoring_alerts(repo, [current], "rules-v1", now + timedelta(minutes=3))

    assert result["material_changes"] == 1
    with session_scope(repo.engine) as session:
        alert = session.scalar(select(Alert).where(Alert.category == "material_change"))
        assert set(
            session.scalars(select(AlertLineage.record_id).where(AlertLineage.alert_id == alert.id))
        ) == {first_record, second_record}


def test_scoring_baseline_uses_batched_queries_instead_of_per_entity_sql(repo, now):
    items = []
    with session_scope(repo.engine) as session:
        for number in range(100):
            entity = Entity(
                key=f"TEST:BATCH-ALERT:{number}",
                kind="organisation",
                name=f"Synthetic entity {number}",
                verified=True,
                properties={},
                created_at=now,
                updated_at=now,
            )
            record = SourceRecord(
                source_id="find_tender",
                external_id=f"batch-alert-{number}",
                revision=1,
                content_hash=f"{number:064x}",
                source_url=f"https://example.invalid/batch-alert-{number}",
                title="Synthetic evidence",
                published_at=now,
                observed_at=now,
                active=True,
                withdrawn=False,
                media_type="application/json",
                payload={"synthetic": True},
                parser_version="test-v1",
            )
            session.add_all([entity, record])
            session.flush()
            session.add(
                EntityProvenance(
                    entity_id=entity.id,
                    record_id=record.id,
                    name=entity.name,
                    properties={},
                    verified=True,
                    observed_at=now,
                )
            )
            items.append(_item(entity.id, [record.id], score=15))

    statements = []

    def count_statement(*_args):
        statements.append(1)

    event.listen(repo.engine, "before_cursor_execute", count_statement)
    try:
        result = generate_scoring_alerts(repo, items, "rules-v1", now)
    finally:
        event.remove(repo.engine, "before_cursor_execute", count_statement)

    assert result["created"] == 0
    assert len(statements) < 20


def test_retention_redacts_alert_lineage_and_clears_derived_score_state(repo, now, tmp_path):
    record_id, entity_id = _record(
        repo,
        now,
        external_id="expiring-alert-record",
        expires_at=now + timedelta(hours=1),
    )
    generate_scoring_alerts(repo, [_item(entity_id, [record_id], score=25)], "rules-v1", now)
    alert = emit_alert(
        repo,
        dedupe_key="expiring-alert",
        entity_id=entity_id,
        category="qualifying_event",
        title="Expiring source alert",
        body="Expiring source detail",
        record_ids=[record_id],
        generation_kind="qualifying_event",
        rule_version="rules-v1",
        now=now,
    )

    purge_expired(repo, now + timedelta(hours=2), tmp_path / "managed")

    with session_scope(repo.engine) as session:
        stored = session.get(Alert, alert["id"])
        assert stored.title == "Supporting evidence erased"
        assert stored.body == ""
        assert session.get(AlertLineage, (alert["id"], record_id)) is None
        assert session.get(AlertScoreState, entity_id) is None
