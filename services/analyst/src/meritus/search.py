"""OpenSearch projections with canonical permission checks and durable outbox retries."""

from __future__ import annotations

import fcntl
import json
import threading
from contextlib import contextmanager
from datetime import UTC
from functools import wraps
from uuid import uuid4

import httpx
from sqlalchemy import func, or_, select, update

from meritus.db import session_scope, utc_now
from meritus.models import Entity, Observation, Outbox, Relationship, SourceRecord
from meritus.retention import purge_expired

EVIDENCE = "meritus-evidence"
ENTITIES = "meritus-entities"
MAPPING = {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0},
    "mappings": {
        "properties": {
            "source_id": {"type": "keyword"},
            "external_id": {"type": "keyword"},
            "content_hash": {"type": "keyword"},
            "entity_ids": {"type": "keyword"},
            "title": {"type": "text"},
            "name": {"type": "text"},
            "body": {"type": "text"},
            "published_at": {"type": "date"},
        }
    },
}


def _aware(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _permitted(record, now):
    from meritus.access import record_allows

    return record_allows(
        record,
        {
            "id": record.source_id,
            "permissions": record.source.permissions,
            "requires_permission": record.source.requires_permission,
        },
        now,
    )


def _entities(record):
    result = {item.entity_id: item.entity for item in record.observations}
    for relationship in record.relationships:
        result[relationship.from_entity_id] = relationship.from_entity
        result[relationship.to_entity_id] = relationship.to_entity
    return result


def _document(record):
    body = "\n".join(
        [
            record.raw_text or "",
            *[
                f"{item.headline}\n{item.detail}"
                for item in record.observations
                if item.state != "rejected"
            ],
        ]
    )
    return {
        "source_id": record.source_id,
        "external_id": record.external_id,
        "content_hash": record.content_hash,
        "title": record.title,
        "source_url": record.source_url,
        "published_at": _aware(record.published_at).isoformat() if record.published_at else None,
        "entity_ids": list(_entities(record)),
        "body": body[:100000],
        "text_truncated": len(body) > 100000,
    }


def _serialised(operation):
    @wraps(operation)
    def locked(self, *args, **kwargs):
        with self.exclusive():
            return operation(self, *args, **kwargs)

    return locked


class SearchIndex:
    def __init__(self, settings, client=None):
        self.settings = settings
        self.url = settings.opensearch_url.rstrip("/")
        self._lock_state = threading.local()
        self.owned_client = client is None
        self.client = client or httpx.Client(timeout=10)

    @contextmanager
    def exclusive(self):
        """Hold the projection lock through a complete restore; nested calls are safe."""
        if getattr(self._lock_state, "held", False):
            yield
            return
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        with (self.settings.data_dir / ".search-projection.lock").open("a+") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            self._lock_state.held = True
            try:
                yield
            finally:
                self._lock_state.held = False
                fcntl.flock(handle, fcntl.LOCK_UN)

    @_serialised
    def invalidate(self):
        """Remove this installation's projections before restoring canonical state."""
        response = self._request(
            "GET", f"_cat/indices/{EVIDENCE}*,{ENTITIES}*", params={"format": "json", "h": "index"}
        )
        names = [row["index"] for row in response.json()]
        removed = []
        for name in names:
            if name not in {EVIDENCE, ENTITIES} and not name.startswith(
                (EVIDENCE + "-v1", ENTITIES + "-v1")
            ):
                continue
            self._request("DELETE", name, missing_ok=True)
            removed.append(name)
        return {"indices_removed": len(removed)}

    def close(self):
        if self.owned_client:
            self.client.close()

    def _request(self, method, path, *, missing_ok=False, **kwargs):
        response = self.client.request(method, self.url + "/" + path.lstrip("/"), **kwargs)
        if missing_ok and response.status_code == 404:
            return response
        response.raise_for_status()
        return response

    def health(self):
        try:
            response = self._request("GET", "_cluster/health").json()
            return {
                "status": response.get("status", "unknown"),
                "available": response.get("status") in {"green", "yellow"},
            }
        except (httpx.HTTPError, ValueError):
            return {"status": "unavailable", "available": False}

    def _ensure(self):
        for alias in [EVIDENCE, ENTITIES]:
            response = self._request("HEAD", alias, missing_ok=True)
            if response.status_code == 404:
                self._request("PUT", f"{alias}-v1", json={**MAPPING, "aliases": {alias: {}}})

    def _entity_document(self, session, identifier, now):
        entity = session.get(Entity, identifier)
        if entity is None:
            return None
        observations = select(Observation.record_id).where(Observation.entity_id == identifier)
        relationships = select(Relationship.record_id).where(
            or_(Relationship.from_entity_id == identifier, Relationship.to_entity_id == identifier)
        )
        candidates = select(SourceRecord).where(
            SourceRecord.active.is_(True),
            or_(SourceRecord.id.in_(observations), SourceRecord.id.in_(relationships)),
        )
        for record in session.scalars(candidates).unique():
            if _permitted(record, now):
                from meritus.access import project_entity

                projected = project_entity(session, entity, now=now)
                return (
                    {key: projected[key] for key in ("name", "kind", "key", "verified")}
                    if projected
                    else None
                )
        return None

    def _queue_denied_projections(self, repo, now):
        from meritus.access import record_access_clause

        with session_scope(repo.engine) as session:
            denied = (
                select(SourceRecord.id)
                .where(
                    SourceRecord.active.is_(True),
                    ~func.coalesce(record_access_clause(session, now=now), False),
                )
                .execution_options(yield_per=500)
            )
            for identifier in session.scalars(denied):
                latest = session.scalar(
                    select(Outbox)
                    .where(Outbox.record_id == identifier)
                    .order_by(Outbox.processed_at.desc().nulls_first(), Outbox.id)
                    .limit(1)
                )
                if latest and (
                    latest.processed_at is None or latest.payload.get("access_denied") is True
                ):
                    continue
                session.add(
                    Outbox(
                        record_id=identifier, operation="delete", payload={"access_denied": True}
                    )
                )
                session.flush()

    @_serialised
    def drain_outbox(self, repo, limit=500):
        now = utc_now()
        purge_expired(repo, now, self.settings.data_dir)
        self._queue_denied_projections(repo, now)
        result = {"processed": 0, "failed": 0}
        with session_scope(repo.engine) as session:
            rows = session.scalars(
                select(Outbox)
                .where(Outbox.processed_at.is_(None))
                .order_by(Outbox.id)
                .limit(max(1, min(limit, 1000)))
                .with_for_update(skip_locked=True)
            ).all()
            for row in rows:
                try:
                    self._ensure()
                    record = session.get(SourceRecord, row.record_id)
                    entity_ids = set(row.payload.get("entity_ids", []))
                    if record:
                        lineage_ids = select(SourceRecord.id).where(
                            SourceRecord.source_id == record.source_id,
                            SourceRecord.external_id == record.external_id,
                        )
                        entity_ids.update(
                            session.scalars(
                                select(Observation.entity_id).where(
                                    Observation.record_id.in_(lineage_ids)
                                )
                            )
                        )
                        for pair in session.execute(
                            select(Relationship.from_entity_id, Relationship.to_entity_id).where(
                                Relationship.record_id.in_(lineage_ids)
                            )
                        ):
                            entity_ids.update(pair)
                        lineage = {
                            "bool": {
                                "filter": [
                                    {"term": {"source_id": record.source_id}},
                                    {"term": {"external_id": record.external_id}},
                                ]
                            }
                        }
                        record = session.scalar(
                            select(SourceRecord)
                            .where(
                                SourceRecord.source_id == record.source_id,
                                SourceRecord.external_id == record.external_id,
                                SourceRecord.active.is_(True),
                            )
                            .order_by(SourceRecord.revision.desc())
                            .limit(1)
                        )
                    else:
                        lineage = {"ids": {"values": [row.record_id]}}
                    access_denied = record is None or not _permitted(record, now)
                    if access_denied:
                        self._request(
                            "POST", f"{EVIDENCE}/_delete_by_query", json={"query": lineage}
                        )
                    else:
                        # Corrections remove any formerly indexed version of this source lineage.
                        self._request(
                            "POST",
                            f"{EVIDENCE}/_delete_by_query",
                            json={
                                "query": {
                                    "bool": {
                                        "filter": [
                                            {"term": {"source_id": record.source_id}},
                                            {"term": {"external_id": record.external_id}},
                                        ],
                                        "must_not": [{"ids": {"values": [record.id]}}],
                                    }
                                }
                            },
                        )
                        self._request(
                            "PUT",
                            f"{EVIDENCE}/_doc/{record.id}",
                            params={"require_alias": "true"},
                            json=_document(record),
                        )
                    for identifier in entity_ids:
                        document = self._entity_document(session, identifier, now)
                        if document:
                            self._request(
                                "PUT",
                                f"{ENTITIES}/_doc/{identifier}",
                                params={"require_alias": "true"},
                                json=document,
                            )
                        else:
                            self._request(
                                "DELETE", f"{ENTITIES}/_doc/{identifier}", missing_ok=True
                            )
                    row.payload = {**row.payload, "access_denied": access_denied}
                    row.processed_at = now
                    row.last_error = None
                    result["processed"] += 1
                except (httpx.HTTPError, ValueError) as error:
                    row.attempts += 1
                    row.last_error = f"Search projection failed ({type(error).__name__})"
                    result["failed"] += 1
        return result

    @_serialised
    def reindex(self, repo):
        now = utc_now()
        purge_expired(repo, now, self.settings.data_dir)
        suffix = "v1-" + uuid4().hex
        names = {alias: f"{alias}-{suffix}" for alias in [EVIDENCE, ENTITIES]}
        for name in names.values():
            self._request("PUT", name, json=MAPPING)
        count = 0
        entities = {}
        pending = []
        try:
            with session_scope(repo.engine) as session:
                outbox_ids = list(
                    session.scalars(select(Outbox.id).where(Outbox.processed_at.is_(None)))
                )
                statement = (
                    select(SourceRecord)
                    .where(SourceRecord.active.is_(True))
                    .execution_options(yield_per=100)
                )
                for record in session.scalars(statement):
                    if not _permitted(record, now):
                        continue
                    pending.extend(
                        [
                            {"index": {"_index": names[EVIDENCE], "_id": record.id}},
                            _document(record),
                        ]
                    )
                    entities.update(_entities(record))
                    count += 1
                    if len(pending) >= 1000:
                        self._bulk(pending)
                        pending = []
                if pending:
                    self._bulk(pending)
                pending = []
                indexed_entities = 0
                from meritus.access import project_entity

                for identifier, entity in entities.items():
                    projected = project_entity(session, entity, now=now)
                    if projected is None:
                        continue
                    indexed_entities += 1
                    pending.extend(
                        [
                            {"index": {"_index": names[ENTITIES], "_id": identifier}},
                            {
                                "name": projected["name"],
                                "kind": projected["kind"],
                                "key": projected["key"],
                                "verified": projected["verified"],
                            },
                        ]
                    )
                    if len(pending) >= 1000:
                        self._bulk(pending)
                        pending = []
                if pending:
                    self._bulk(pending)
                self._request("POST", ",".join(names.values()) + "/_refresh")
                actions = []
                old_indices = set()
                for alias in names:
                    response = self._request("GET", f"_alias/{alias}", missing_ok=True)
                    if response.status_code != 404:
                        for name in response.json():
                            actions.append({"remove": {"index": name, "alias": alias}})
                            old_indices.add(name)
                    actions.append({"add": {"index": names[alias], "alias": alias}})
                self._request("POST", "_aliases", json={"actions": actions})
                for offset in range(0, len(outbox_ids), 1000):
                    session.execute(
                        update(Outbox)
                        .where(Outbox.id.in_(outbox_ids[offset : offset + 1000]))
                        .values(processed_at=now, last_error=None)
                    )
            for name in old_indices:
                if name.startswith((EVIDENCE + "-v1", ENTITIES + "-v1")):
                    self._request("DELETE", name, missing_ok=True)
            return {
                "records_indexed": count,
                "entities_indexed": indexed_entities,
                "complete": True,
            }
        except Exception:
            # Keep the old aliases intact on build failure; unused fresh indexes are recoverable.
            raise

    def _bulk(self, lines):
        payload = "\n".join(json.dumps(item) for item in lines) + "\n"
        response = self._request(
            "POST", "_bulk", content=payload, headers={"Content-Type": "application/x-ndjson"}
        ).json()
        if response.get("errors"):
            raise ValueError("OpenSearch rejected one or more projection documents")
