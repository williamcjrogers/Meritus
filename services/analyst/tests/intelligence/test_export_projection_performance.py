from datetime import UTC, datetime, timedelta

from meritus.db import session_scope
from meritus.domain import EntityInput, FetchBatch, ObservationInput, ParsedDocument
from meritus.intelligence.service import IntelligenceService
from meritus.read_access import sanitise_ranked_items


def test_public_frozen_snapshot_does_not_rebuild_current_entity_projection(repo, monkeypatch):
    now = datetime.now(UTC)
    result = repo.ingest_batch(
        "find_tender",
        FetchBatch(
            documents=[
                ParsedDocument(
                    external_id="frozen-public-record",
                    source_url="https://example.test/frozen-public-record",
                    title="Frozen public record",
                    published_at=now - timedelta(days=1),
                    payload={},
                    entities=[
                        EntityInput(
                            key="GB-COH:09999991",
                            kind="organisation",
                            scheme="GB-COH",
                            identifier="09999991",
                            name="Frozen Public Ltd",
                            verified=True,
                        )
                    ],
                    observations=[
                        ObservationInput(
                            subject_key="GB-COH:09999991",
                            kind="accounts_overdue",
                            event_key="accounts:frozen-public",
                            headline="Accounts overdue",
                            detail="Accounts filing is overdue",
                            occurred_at=now - timedelta(days=1),
                            state="verified",
                        )
                    ],
                )
            ],
            cursor="complete",
        ),
        now,
    )
    assert result["inserted"] == 1
    snapshot = IntelligenceService(repo).create_snapshot("weekly", now)
    payload = snapshot["payload"]

    def unexpected_projection(*_args, **_kwargs):
        raise AssertionError("fully permitted frozen entities must not be reprojected")

    monkeypatch.setattr("meritus.read_access.entity_projection_map", unexpected_projection)
    with session_scope(repo.engine) as session:
        projected = sanitise_ranked_items(
            session,
            payload["items"],
            rule_version=snapshot["rule_version"],
            knowledge_cutoff=payload["knowledge_cutoff"],
            applied_rules=payload["applied_rules"],
            frozen_inputs=payload,
            export_policy=payload["export_policy"],
            now=now,
        )

    assert len(projected) == len(payload["items"])
    assert projected[0]["name"] == payload["items"][0]["name"] == "Frozen Public Ltd"
    assert projected[0]["score"] == payload["items"][0]["score"]
