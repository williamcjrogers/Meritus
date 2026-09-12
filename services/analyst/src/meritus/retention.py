"""Source-aware erasure, durable restore markers and managed-file manifests."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
from contextlib import contextmanager
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, func, select

from meritus.config import Settings
from meritus.db import session_scope
from meritus.models import (
    Alert,
    AlertLineage,
    AlertScoreState,
    CalendarEntry,
    Entity,
    EntityProvenance,
    ImportPreview,
    Observation,
    Outbox,
    Relationship,
    Review,
    Snapshot,
    Source,
    SourceRecord,
)

_STATE_NAME = ".retention-state.json"
_KINDS = {"export", "backup", "raw"}
_BIND_CHUNK = 5_000


def _chunks(values, size=_BIND_CHUNK):
    items = sorted(set(values))
    for offset in range(0, len(items), size):
        yield items[offset : offset + size]


def _delete_chunks(session, model, column, values):
    for chunk in _chunks(values):
        session.execute(delete(model).where(column.in_(chunk)))


def _models_by_ids(session, model, column, values, *, lock=False):
    result = []
    for chunk in _chunks(values):
        statement = select(model).where(column.in_(chunk))
        if lock:
            statement = statement.with_for_update(of=model)
        result.extend(session.scalars(statement).unique().all())
    return result


def _aware(value):
    if value is None or value == "":
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _root(path):
    root = Path(path).absolute()
    if root.is_symlink():
        raise ValueError("Managed data root must not be a symbolic link")
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _managed_path(path, root):
    candidate = Path(path).absolute()
    # Resolve for containment, but reject symlinks even if their targets are internal.
    resolved = candidate.resolve()
    if resolved == root or root not in resolved.parents:
        raise ValueError("Managed artifact path is outside the data directory")
    for part in (candidate, *candidate.parents):
        if part == root:
            break
        if part.is_symlink():
            raise ValueError("Managed artifact paths must not contain symbolic links")
    if candidate.name in {_STATE_NAME, ".retention.lock"}:
        raise ValueError("Retention control files are not managed artifacts")
    return resolved


def _digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


@contextmanager
def _locked_state(root):
    lock_path = root / ".retention.lock"
    if lock_path.is_symlink():
        raise ValueError("Retention lock must not be a symbolic link")
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            path = root / _STATE_NAME
            if path.is_symlink():
                raise ValueError("Retention state must not be a symbolic link")
            if path.exists():
                if path.stat().st_size > 64_000_000:
                    raise ValueError("Retention state exceeds the supported size")
                state = json.loads(path.read_text())
                if (
                    state.get("version") != 1
                    or not isinstance(state.get("erasures"), dict)
                    or not isinstance(state.get("artifacts"), dict)
                ):
                    raise ValueError("Invalid retention state format")
            else:
                state = {"version": 1, "erasures": {}, "artifacts": {}}
            yield state
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def _save_state(root, state):
    path = root / _STATE_NAME
    temporary = root / f"{_STATE_NAME}.new"
    descriptor = os.open(temporary, os.O_CREAT | os.O_TRUNC | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(state, stream, sort_keys=True)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(root, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists() and not temporary.is_symlink():
            temporary.unlink()


def register_managed_artifact(path, record_ids, kind, *, managed_root=None):
    """Register an existing managed file; later replacement is never silently deleted."""
    root = _root(managed_root or Settings().data_dir)
    candidate = _managed_path(path, root)
    identifiers = sorted(set(record_ids))
    if (
        kind not in _KINDS
        or not identifiers
        or any(not isinstance(item, str) or not item for item in identifiers)
    ):
        raise ValueError("Artifact needs a supported kind and non-empty record identifiers")
    if not candidate.is_file():
        raise ValueError("Managed artifact must be an existing regular file")
    with _locked_state(root) as state:
        if set(identifiers) & state["erasures"].keys():
            raise ValueError("Cannot register an artifact containing erased evidence")
        state["artifacts"][str(candidate.relative_to(root))] = {
            "kind": kind,
            "record_ids": identifiers,
            "sha256": _digest(candidate),
        }
        _save_state(root, state)


def read_erasure_ledger(managed_root):
    """Export deletion history only; file deletion permissions are installation-local."""
    root = _root(managed_root)
    with _locked_state(root) as state:
        return {"version": 1, "erasures": deepcopy(state["erasures"])}


def merge_erasure_ledger(incoming, managed_root):
    """Restore cannot replace newer deletion history or import arbitrary file paths."""
    if (
        not isinstance(incoming, dict)
        or set(incoming) != {"version", "erasures"}
        or incoming["version"] != 1
        or not isinstance(incoming["erasures"], dict)
    ):
        raise ValueError("Invalid restore erasure ledger")
    list_fields = {"observation_ids", "relationship_ids", "entity_ids", "review_ids"}
    required = {"at", "reason", "lineage_key"} | list_fields
    for identifier, marker in incoming["erasures"].items():
        if not isinstance(identifier, str) or not identifier or not isinstance(marker, dict):
            raise ValueError("Invalid erasure record identifier")
        if set(marker) != required or not all(
            isinstance(marker[field], str) and marker[field] for field in required - list_fields
        ):
            raise ValueError("Invalid erasure marker")
        _aware(marker["at"])
        for field in list_fields:
            if not isinstance(marker[field], list) or any(
                not isinstance(item, str) or not item for item in marker[field]
            ):
                raise ValueError("Invalid erasure references")
    root = _root(managed_root)
    with _locked_state(root) as state:
        for identifier, marker in incoming["erasures"].items():
            existing = state["erasures"].get(identifier)
            if existing:
                for field in list_fields:
                    existing[field] = sorted(set(existing.get(field, [])) | set(marker[field]))
            else:
                state["erasures"][identifier] = deepcopy(marker)
        _save_state(root, state)


def _mentions(value, identifiers):
    if isinstance(value, dict):
        return any(_mentions(item, identifiers) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_mentions(item, identifiers) for item in value)
    return isinstance(value, str) and value in identifiers


def _string_tokens(value):
    if isinstance(value, dict):
        return set().union(*(_string_tokens(item) for item in value.values())) if value else set()
    if isinstance(value, (list, tuple)):
        return set().union(*(_string_tokens(item) for item in value)) if value else set()
    return {value} if isinstance(value, str) else set()


def sanitise_snapshot(snapshot, expired_record_ids, policy):
    """Remove affected rows and frozen inputs; never leave an obsolete derived score."""
    result = deepcopy(snapshot)
    payload = result.get("payload", result)
    tokens = (
        set(expired_record_ids)
        | set(policy.get("observation_ids", []))
        | set(policy.get("relationship_ids", []))
        | set(policy.get("entity_ids", []))
        | set(policy.get("review_ids", []))
    )
    substantive = {
        key: value for key, value in payload.items() if key not in {"redaction", "coverage"}
    }
    if not _mentions(substantive, tokens):
        return result
    kept = {}
    known_lists = {
        "items",
        "rankings",
        "entities",
        "source_records",
        "observations",
        "relationships",
        "reviews",
        "calendar",
        "pipeline_actions",
    }
    safe_metadata = {"knowledge_cutoff", "rule_version", "research_mode", "export_policy"}
    for key, value in payload.items():
        if key in known_lists and isinstance(value, list):
            kept[key] = [item for item in value if not _mentions(item, tokens)]
        elif key in safe_metadata:
            kept[key] = value
    kept.setdefault("items", [])
    kept["coverage"] = {
        "complete": False,
        "retention_redacted": True,
        "reason": "Supporting evidence was erased; the original ranking is no longer reproducible.",
    }
    kept["redaction"] = {
        "at": policy.get("now"),
        "record_ids": sorted(expired_record_ids),
        "reason": "retention_erasure",
    }
    if "payload" in result:
        result["payload"] = kept
        result["redacted_at"] = policy.get("now")
    else:
        result = kept
    return result


def _expiry_reason(record, now, ledger, lineage_keys):
    if record.id in ledger:
        return ledger[record.id]["reason"]
    # A restore may have changed internal IDs. Preserve source/lineage hashes as a second key.
    key = _lineage_key(record)
    if key in lineage_keys:
        return "previously_erased"
    if (
        record.source_id == "find_case_law"
        and (record.permissions or {}).get("current_version_only") is True
    ):
        if record.withdrawn:
            return "publisher_withdrawn"
        if not record.active:
            return "publisher_superseded"
    grants = [
        record.permissions or {},
        record.import_permission or {},
    ]
    if record.expires_at and _aware(record.expires_at) <= now:
        return "retention_expired"
    for grant in grants:
        if grant.get("denied") is True:
            return "permission_revoked"
        retention = grant.get("retention_days")
        if (
            isinstance(retention, int)
            and not isinstance(retention, bool)
            and retention > 0
            and _aware(record.observed_at) + timedelta(days=retention) <= now
        ):
            return "retention_expired"
        expiry = grant.get("content_expires_at")
        if expiry and _aware(expiry) <= now:
            return "retention_expired"
        permission_expiry = grant.get("expires_at")
        if (
            permission_expiry
            and _aware(permission_expiry) <= now
            and grant.get("retain_after_permission_expiry") is not True
        ):
            return "permission_expired"
    return None


def _lineage_key(record):
    return hashlib.sha256(
        json.dumps([record.source_id, record.external_id, record.content_hash]).encode()
    ).hexdigest()


def _erase_files(root, state):
    removed, unresolved = 0, []
    erased = set(state["erasures"])
    for relative, artifact in list(state["artifacts"].items()):
        if not erased.intersection(artifact["record_ids"]):
            continue
        try:
            candidate = _managed_path(root / relative, root)
            if candidate.exists():
                if not candidate.is_file() or _digest(candidate) != artifact["sha256"]:
                    raise ValueError("Managed file changed after registration")
                candidate.unlink()
                removed += 1
            del state["artifacts"][relative]
        except (OSError, ValueError) as error:
            unresolved.append({"path": relative, "reason": str(error)})
    _save_state(root, state)
    return removed, unresolved


def purge_expired(repo, now: datetime, managed_root: Path):
    """Erase expired material and report every remaining managed-store deletion."""
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Purge time must include a UTC offset")
    now = now.astimezone(UTC)
    root = _root(managed_root)
    result = {"records_erased": 0, "previews_erased": 0, "snapshots_redacted": 0}
    with _locked_state(root) as state:
        with session_scope(repo.engine) as session:
            lineage_keys = {item.get("lineage_key") for item in state["erasures"].values()}
            # Fetch policy metadata only; routine expiry checks never load raw bodies.
            statement = select(
                SourceRecord.id,
                SourceRecord.source_id,
                SourceRecord.external_id,
                SourceRecord.content_hash,
                SourceRecord.active,
                SourceRecord.withdrawn,
                SourceRecord.observed_at,
                SourceRecord.expires_at,
                SourceRecord.payload["import_permission"].label("import_permission"),
                SourceRecord.payload["erasure"].label("erasure"),
                Source.permissions,
            ).join(Source, Source.id == SourceRecord.source_id)
            reasons = {}
            for metadata in session.execute(statement):
                if metadata.erasure:
                    continue
                reason = _expiry_reason(metadata, now, state["erasures"], lineage_keys)
                if reason:
                    reasons[metadata.id] = reason
            ids = set(reasons)
            expired = _models_by_ids(session, SourceRecord, SourceRecord.id, ids, lock=True)

            expired_urls: dict[str, set[str]] = {}
            for record in expired:
                if record.source_url:
                    expired_urls.setdefault(record.source_url, set()).add(record.id)

            legacy_relationship_records: dict[str, set[str]] = {}
            if expired_urls:
                for relation in session.scalars(
                    select(Relationship).where(Relationship.record_id.is_(None))
                ):
                    source_url = str((relation.attributes or {}).get("source_url") or "")
                    matching = expired_urls.get(source_url, set())
                    if not matching:
                        continue
                    legacy_relationship_records[relation.id] = matching
                    if len(matching) == 1:
                        relation.record_id = next(iter(matching))

            relationships = {item.id: item for record in expired for item in record.relationships}
            if legacy_relationship_records:
                for chunk in _chunks(legacy_relationship_records):
                    for relation in session.scalars(
                        select(Relationship).where(Relationship.id.in_(chunk))
                    ):
                        relationships[relation.id] = relation
            relationship_ids = set(relationships)
            affected_entities = {
                item.entity_id for record in expired for item in record.observations
            }
            affected_entities |= {item.from_entity_id for item in relationships.values()} | {
                item.to_entity_id for item in relationships.values()
            }

            expired_provenance = _models_by_ids(
                session, EntityProvenance, EntityProvenance.record_id, ids
            )
            affected_entities.update(item.entity_id for item in expired_provenance)
            per_record = {
                record.id: {
                    "observation_ids": {item.id for item in record.observations},
                    "relationship_ids": {item.id for item in record.relationships},
                    "entity_ids": {item.entity_id for item in record.observations}
                    | {item.from_entity_id for item in record.relationships}
                    | {item.to_entity_id for item in record.relationships},
                    "review_ids": set(),
                }
                for record in expired
            }
            for relationship_id, record_ids in legacy_relationship_records.items():
                relation = relationships[relationship_id]
                for record_id in record_ids:
                    per_record[record_id]["relationship_ids"].add(relationship_id)
                    per_record[record_id]["entity_ids"].update(
                        {relation.from_entity_id, relation.to_entity_id}
                    )
            for provenance in expired_provenance:
                per_record[provenance.record_id]["entity_ids"].add(provenance.entity_id)

            surviving_entities = set()
            for chunk in _chunks(affected_entities):
                for entity_id, record_id in session.execute(
                    select(Observation.entity_id, Observation.record_id).where(
                        Observation.entity_id.in_(chunk)
                    )
                ):
                    if record_id not in ids:
                        surviving_entities.add(entity_id)
                for relation in session.scalars(
                    select(Relationship).where(
                        (Relationship.from_entity_id.in_(chunk))
                        | (Relationship.to_entity_id.in_(chunk))
                    )
                ):
                    if relation.id not in relationship_ids and relation.record_id not in ids:
                        surviving_entities.update({relation.from_entity_id, relation.to_entity_id})
            orphan_entities = affected_entities - surviving_entities

            if ids:
                entity_reviews: dict[str, list[Review]] = {}
                for review in _models_by_ids(session, Review, Review.target_id, affected_entities):
                    if review.target_type == "entity":
                        entity_reviews.setdefault(review.target_id, []).append(review)
                record_ids_by_token: dict[str, set[str]] = {}
                for record_id, references in per_record.items():
                    for token in (
                        {record_id} | references["observation_ids"] | references["relationship_ids"]
                    ):
                        record_ids_by_token.setdefault(token, set()).add(record_id)
                for source_url, record_ids in expired_urls.items():
                    record_ids_by_token.setdefault(source_url, set()).update(record_ids)
                for review in session.scalars(select(Review)):
                    review_tokens = {review.target_id} | _string_tokens(review.payload)
                    matching_records = set().union(
                        *(record_ids_by_token.get(token, set()) for token in review_tokens)
                    )
                    if matching_records:
                        for record_id in matching_records:
                            per_record[record_id]["review_ids"].add(review.id)

                _delete_chunks(session, Observation, Observation.record_id, ids)
                _delete_chunks(session, Relationship, Relationship.id, relationship_ids)

                all_provenance = _models_by_ids(
                    session, EntityProvenance, EntityProvenance.entity_id, affected_entities
                )
                provenance_by_entity: dict[str, list[EntityProvenance]] = {}
                provenance_record_ids = {item.record_id for item in all_provenance}
                record_state = {}
                for chunk in _chunks(provenance_record_ids):
                    rows = session.execute(
                        select(
                            SourceRecord.id,
                            SourceRecord.active,
                            SourceRecord.withdrawn,
                            SourceRecord.payload,
                        ).where(SourceRecord.id.in_(chunk))
                    )
                    record_state.update(
                        {
                            record_id: (active, withdrawn, payload)
                            for record_id, active, withdrawn, payload in rows
                        }
                    )
                for provenance in all_provenance:
                    provenance_by_entity.setdefault(provenance.entity_id, []).append(provenance)
                expected_expired_by_entity: dict[str, set[str]] = {}
                for record_id, references in per_record.items():
                    for entity_id in references["entity_ids"]:
                        expected_expired_by_entity.setdefault(entity_id, set()).add(record_id)
                recorded_expired_by_entity: dict[str, set[str]] = {}
                for provenance in expired_provenance:
                    recorded_expired_by_entity.setdefault(provenance.entity_id, set()).add(
                        provenance.record_id
                    )

                for entity in _models_by_ids(
                    session, Entity, Entity.id, affected_entities, lock=True
                ):
                    contributions = provenance_by_entity.get(entity.id, [])
                    source_keys = {
                        key for contribution in contributions for key in contribution.properties
                    }
                    # Reconstruct reviewed properties from the audit trail after redaction,
                    # so values copied from an expired review cannot survive as manual fields.
                    for review in entity_reviews.get(entity.id, []):
                        if review.action == "update":
                            changes = review.payload.get("changes", review.payload)
                            if isinstance(changes, dict) and isinstance(
                                changes.get("properties"), dict
                            ):
                                source_keys.update(changes["properties"])
                    expected_expired = expected_expired_by_entity.get(entity.id, set())
                    recorded_expired = recorded_expired_by_entity.get(entity.id, set())
                    provenance_complete = expected_expired <= recorded_expired
                    if provenance_complete:
                        properties = {
                            key: value
                            for key, value in entity.properties.items()
                            if key not in source_keys
                        }
                    else:
                        properties = {
                            key: value
                            for key, value in entity.properties.items()
                            if key
                            in {
                                "merge_redirect_review_id",
                                "merge_review_id",
                                "merged_into_entity_id",
                                "source_identities",
                            }
                        }
                    surviving = []
                    for contribution in contributions:
                        active, withdrawn, payload = record_state.get(
                            contribution.record_id, (False, True, {})
                        )
                        if (
                            contribution.record_id not in ids
                            and active
                            and not withdrawn
                            and not (payload or {}).get("erasure")
                        ):
                            surviving.append(contribution)
                    surviving.sort(key=lambda item: (str(item.observed_at), item.id))
                    if surviving:
                        for contribution in surviving:
                            properties.update(deepcopy(contribution.properties))
                        entity.name = surviving[-1].name
                        entity.properties = properties
                        entity.verified = any(item.verified for item in surviving)
                    else:
                        entity.name = "Identity evidence erased"
                        entity.properties = {**properties, "erased": True}
                        entity.verified = False
                    entity.updated_at = now

                linked_alert_ids = set()
                for chunk in _chunks(ids):
                    linked_alert_ids.update(
                        session.scalars(
                            select(AlertLineage.alert_id).where(AlertLineage.record_id.in_(chunk))
                        )
                    )
                affected_alerts = {
                    alert.id: alert
                    for alert in _models_by_ids(session, Alert, Alert.entity_id, affected_entities)
                }
                for alert in _models_by_ids(session, Alert, Alert.id, linked_alert_ids):
                    affected_alerts[alert.id] = alert
                for alert in affected_alerts.values():
                    alert.title = "Supporting evidence erased"
                    alert.body = ""
                _delete_chunks(session, AlertLineage, AlertLineage.record_id, ids)
                _delete_chunks(
                    session, AlertScoreState, AlertScoreState.entity_id, affected_entities
                )
                _delete_chunks(session, EntityProvenance, EntityProvenance.record_id, ids)
                _delete_chunks(session, Outbox, Outbox.record_id, ids)
                for record in expired:
                    reason = reasons[record.id]
                    record.raw_text = None
                    record.raw_text_hash = None
                    record.title = "Evidence erased"
                    record.source_url = ""
                    record.payload = {"erasure": {"at": now.isoformat(), "reason": reason}}
                    record.active = False
                    record.withdrawn = True
                    session.add(
                        Outbox(
                            operation="delete",
                            record_id=record.id,
                            payload={
                                "reason": reason,
                                "entity_ids": sorted(per_record[record.id]["entity_ids"]),
                            },
                        )
                    )
                result["records_erased"] = len(ids)

            for record in expired:
                existing = state["erasures"].get(record.id, {})
                state["erasures"][record.id] = {
                    "at": existing.get("at", now.isoformat()),
                    "reason": reasons[record.id],
                    "lineage_key": _lineage_key(record),
                    "observation_ids": sorted(
                        per_record[record.id]["observation_ids"]
                        | set(existing.get("observation_ids", []))
                    ),
                    "relationship_ids": sorted(
                        per_record[record.id]["relationship_ids"]
                        | set(existing.get("relationship_ids", []))
                    ),
                    "entity_ids": sorted(
                        (per_record[record.id]["entity_ids"] & orphan_entities)
                        | set(existing.get("entity_ids", []))
                    ),
                    "review_ids": sorted(
                        per_record[record.id]["review_ids"] | set(existing.get("review_ids", []))
                    ),
                }
            # Persist before the DB transaction commits, so a crash cannot lose erasure history.
            _save_state(root, state)
            policy = {
                name: set()
                for name in ("observation_ids", "relationship_ids", "entity_ids", "review_ids")
            }
            for marker in state["erasures"].values():
                for name in policy:
                    policy[name].update(marker.get(name, []))
            policy["now"] = now.isoformat()
            all_erased = set(state["erasures"])
            durable_tokens = all_erased | set().union(
                *(
                    policy[name]
                    for name in ("observation_ids", "relationship_ids", "entity_ids", "review_ids")
                )
            )

            if policy["relationship_ids"]:
                _delete_chunks(
                    session,
                    Relationship,
                    Relationship.id,
                    policy["relationship_ids"],
                )
            if durable_tokens:
                for review in session.scalars(select(Review)):
                    if (
                        review.id in policy["review_ids"]
                        or (review.target_type != "entity" and review.target_id in durable_tokens)
                        or _mentions(review.payload, durable_tokens)
                    ):
                        review.reason = "Supporting evidence erased under retention policy"
                        review.payload = {"erased": True}
                # Authoritative human decisions have precedence over source reconstruction.
                # Source-linked review payloads have already been removed above.
                for entity in _models_by_ids(session, Entity, Entity.id, affected_entities):
                    if entity.properties.get("merged_into_entity_id"):
                        continue
                    reviews = sorted(
                        entity_reviews.get(entity.id, []),
                        key=lambda review: (str(review.created_at), review.id),
                    )
                    for review in reviews:
                        if review.payload.get("erased") or review.action not in {
                            "update",
                            "verified",
                            "rejected",
                            "pending",
                        }:
                            continue
                        repo._apply_review(session, review)
                    if entity.name != "Identity evidence erased":
                        entity.properties = {
                            key: value
                            for key, value in entity.properties.items()
                            if key != "erased"
                        }
                    entity.updated_at = now
                for calendar in session.scalars(select(CalendarEntry)):
                    record_id = str((calendar.evidence or {}).get("source_record_id") or "")
                    if (
                        record_id in all_erased
                        or _mentions(calendar.evidence, durable_tokens)
                        or calendar.source_url in expired_urls
                    ):
                        calendar.title = "Supporting evidence erased"
                        calendar.source_url = ""
                        calendar.evidence = {"erased": True}
                        calendar.basis = ""
                        calendar.status = "provisional"

                for snapshot in session.scalars(select(Snapshot)):
                    cleaned = sanitise_snapshot({"payload": snapshot.payload}, all_erased, policy)
                    if cleaned["payload"] != snapshot.payload:
                        snapshot.payload = cleaned["payload"]
                        snapshot.redacted_at = now
                        result["snapshots_redacted"] += 1
            for preview in session.scalars(select(ImportPreview)):
                should_erase = (
                    _aware(preview.expires_at) <= now
                    or _mentions(preview.payload, durable_tokens)
                    or _mentions(preview.result, durable_tokens)
                )
                if should_erase and (preview.payload or preview.result is not None):
                    preview.payload = {}
                    preview.result = None
                    result["previews_erased"] += 1
            session.flush()
        removed, unresolved = _erase_files(root, state)
        result["artifacts_removed"] = removed
        result["unresolved_artifacts"] = unresolved
    with session_scope(repo.engine) as session:
        result["pending_search_deletions"] = session.scalar(
            select(func.count())
            .select_from(Outbox)
            .where(Outbox.operation == "delete", Outbox.processed_at.is_(None))
        )
    result["complete"] = (
        not result["pending_search_deletions"] and not result["unresolved_artifacts"]
    )
    return result
