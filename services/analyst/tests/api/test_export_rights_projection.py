import csv
import io
from datetime import UTC, datetime, timedelta

from meritus.db import session_scope
from meritus.models import Entity, EntityProvenance, Review, SourceRecord


def test_export_projects_identity_and_conditions_only_from_exportable_sources(authenticated, repo):
    client, _csrf = authenticated
    now = datetime.now(UTC)
    repo.update_source(
        "hmcts",
        {
            "permissions": {
                "reference": "analysis-only-test-grant",
                "scope": {"analyse": True, "export": False},
                "reviewed_at": (now - timedelta(days=1)).isoformat(),
                "operations": ["analyse"],
                "expires_at": (now + timedelta(days=1)).isoformat(),
                "distribution_conditions": "SECRET HMCTS CONDITION",
            }
        },
    )
    with session_scope(repo.engine) as session:
        entity = Entity(
            key="TEST:MIXED-EXPORT",
            kind="organisation",
            name="SECRET CANONICAL NAME",
            scheme="TEST",
            identifier="MIXED-EXPORT",
            verified=True,
            properties={"sector": "SECRET CANONICAL SECTOR"},
            created_at=now - timedelta(days=3),
            updated_at=now,
        )
        public_record = SourceRecord(
            source_id="find_tender",
            external_id="mixed-export-public",
            revision=1,
            content_hash="a" * 64,
            source_url="https://example.test/public",
            title="Public evidence",
            published_at=now - timedelta(days=3),
            observed_at=now - timedelta(days=3),
            active=True,
            withdrawn=False,
            media_type="application/json",
            payload={"import_permission": {"attribution": "PUBLIC ATTRIBUTION"}},
        )
        restricted_record = SourceRecord(
            source_id="hmcts",
            external_id="mixed-export-restricted",
            revision=1,
            content_hash="b" * 64,
            source_url="https://example.test/restricted",
            title="SECRET EVIDENCE TITLE",
            published_at=now - timedelta(days=2),
            observed_at=now - timedelta(days=2),
            active=True,
            withdrawn=False,
            media_type="application/json",
            payload={"import_permission": {"attribution": "SECRET RECORD CONDITION"}},
        )
        session.add_all([entity, public_record, restricted_record])
        session.flush()
        session.add_all(
            [
                EntityProvenance(
                    entity_id=entity.id,
                    record_id=public_record.id,
                    name="Public Projected Name",
                    properties={"sector": "Public Sector"},
                    verified=True,
                    observed_at=public_record.observed_at,
                ),
                EntityProvenance(
                    entity_id=entity.id,
                    record_id=restricted_record.id,
                    name="SECRET PROJECTED NAME",
                    properties={"sector": "SECRET PROJECTED SECTOR"},
                    verified=True,
                    observed_at=restricted_record.observed_at,
                ),
                Review(
                    target_type="entity",
                    target_id=entity.id,
                    action="update",
                    actor="SECRET REVIEWER",
                    reason="SECRET REVIEW REASON",
                    payload={
                        "source_id": "hmcts",
                        "source_record_id": restricted_record.id,
                        "changes": {
                            "name": "SECRET REVIEWED NAME",
                            "properties": {"sector": "SECRET REVIEWED SECTOR"},
                        },
                    },
                    created_at=now,
                ),
            ]
        )
        entity_id = entity.id
        public_id = public_record.id
        restricted_id = restricted_record.id

    rules = {
        "recommendation_threshold": 40.0,
        "independence_window_days": 180,
        "family_cap": 45.0,
        "context_cap": 10.0,
        "total_cap": 100.0,
    }
    common = {
        "family": "procurement_performance",
        "kind": "adverse_performance",
        "points": 25,
        "applied_points": 25,
        "qualifies": True,
        "substantive": True,
        "event_at": now.isoformat(),
        "exclusion_reason": None,
        "attributes": {},
    }
    snapshot = repo.save_snapshot(
        "weekly",
        now,
        "meritus-v1",
        {
            "items": [
                {
                    "entity_id": entity_id,
                    "name": "SECRET FROZEN NAME",
                    "kind": "organisation",
                    "score": 50.0,
                    "eligible": True,
                    "independent_events": 2,
                    "sector": "SECRET FROZEN SECTOR",
                    "source_ids": ["find_tender", "hmcts"],
                    "gaps": [],
                    "contributions": [
                        {
                            **common,
                            "observation_id": "public-observation",
                            "record_id": public_id,
                            "source_id": "find_tender",
                            "event_key": "public-event",
                            "event_group_key": "public-event",
                            "evidence_url": "https://example.test/public",
                        },
                        {
                            **common,
                            "observation_id": "restricted-observation",
                            "record_id": restricted_id,
                            "source_id": "hmcts",
                            "event_key": "restricted-event",
                            "event_group_key": "restricted-event",
                            "evidence_url": "https://example.test/restricted",
                        },
                    ],
                }
            ],
            "entities": [
                {
                    "id": entity_id,
                    "name": "SECRET FROZEN NAME",
                    "properties": {"sector": "SECRET FROZEN SECTOR"},
                    "provenance_record_ids": [public_id, restricted_id],
                }
            ],
            "reviews": [],
            "source_records": [
                {
                    "id": public_id,
                    "source_id": "find_tender",
                    "import_permission": {"attribution": "PUBLIC ATTRIBUTION"},
                },
                {
                    "id": restricted_id,
                    "source_id": "hmcts",
                    "import_permission": {"attribution": "SECRET RECORD CONDITION"},
                },
            ],
            "source_permissions": {
                "find_tender": {"attribution": "PUBLIC SOURCE CONDITION"},
                "hmcts": {"distribution_conditions": "SECRET SNAPSHOT CONDITION"},
            },
            "knowledge_cutoff": now.isoformat(),
            "applied_rules": rules,
            "export_policy": {"find_tender": True, "hmcts": True},
        },
    )

    response = client.get(f"/api/exports/{snapshot['id']}.csv")

    assert response.status_code == 200, response.text
    row = next(csv.DictReader(io.StringIO(response.text)))
    assert row["name"] == "Public Projected Name"
    assert row["sector"] == "Public Sector"
    assert row["source_ids"] == '["find_tender"]'
    assert "PUBLIC SOURCE CONDITION" in row["permitted_distribution_conditions"]
    assert "PUBLIC ATTRIBUTION" in row["permitted_distribution_conditions"]
    assert "SECRET" not in response.text

    html = client.get(f"/api/exports/{snapshot['id']}.html")
    assert html.status_code == 200, html.text
    assert "Public Projected Name" in html.text
    assert "Public Sector" in html.text
    assert "SECRET" not in html.text
