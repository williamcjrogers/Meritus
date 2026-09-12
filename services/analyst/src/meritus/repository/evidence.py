"""Transactional evidence ingestion and read models."""

import hashlib
import re
from copy import deepcopy
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import TypeAdapter
from sqlalchemy import Engine, and_, or_, select
from sqlalchemy.orm import Session, selectinload

from meritus.db import session_scope
from meritus.domain import FetchBatch, ParsedDocument
from meritus.models import (
    Entity,
    EntityProvenance,
    Observation,
    Outbox,
    Relationship,
    Review,
    Source,
    SourceRecord,
)
from meritus.sources.catalogue import company_key

_BATCH_ADAPTER = TypeAdapter(FetchBatch)
_URL_SECRET_NAMES = {
    "access_key",
    "access_token",
    "api_key",
    "apikey",
    "client_secret",
    "credential",
    "key",
    "password",
    "secret",
    "signature",
    "sig",
    "token",
}
_REVIEWED_ENTITY_PROPERTIES = {
    "merge_redirect_review_id",
    "merge_review_id",
    "merged_into_entity_id",
    "source_identities",
}


def _is_secret_query_name(name: str) -> bool:
    normalised = name.lower().replace("-", "_")
    compact = normalised.replace("_", "")
    return normalised in _URL_SECRET_NAMES or compact in {
        "accesskey",
        "accesstoken",
        "apikey",
        "appkey",
        "clientsecret",
        "googleaccessid",
        "signature",
        "streamkey",
        "xamzcredential",
        "xamzsecuritytoken",
        "xamzsignature",
        "xgoogcredential",
        "xgoogsignature",
    }


def _fragment_has_credentials(fragment: str) -> bool:
    if not fragment:
        return False
    pairs = parse_qsl(fragment, keep_blank_values=True)
    if pairs:
        return any(_is_secret_query_name(key) for key, _ in pairs)
    lowered = fragment.lower()
    return any(
        marker in lowered for marker in ("credential", "password", "secret", "signature", "token")
    )


def _aware(value: datetime, field: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must include a UTC offset")
    return value.astimezone(UTC)


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return deepcopy(value)


def model_dict(model, *, exclude: set[str] | None = None) -> dict[str, Any]:
    excluded = exclude or set()
    return {
        column.key: _json_value(getattr(model, column.key))
        for column in model.__mapper__.column_attrs
        if column.key not in excluded
    }


def sanitise_url(url: str) -> str:
    """Remove URL credentials and credential-like query parameters."""
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    if parts.scheme not in {"http", "https"}:
        return url
    host = parts.hostname or ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    if parts.port:
        host = f"{host}:{parts.port}"
    query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parts.query, keep_blank_values=True)
            if not _is_secret_query_name(key)
        ],
        doseq=True,
    )
    fragment = "" if _fragment_has_credentials(parts.fragment) else parts.fragment
    return urlunsplit((parts.scheme, host, parts.path, query, fragment))


def _sanitise_raw_text(value: str | None) -> str | None:
    if value is None:
        return None
    return re.sub(r"https?://[^\s<>\"']+", lambda match: sanitise_url(match.group()), value)


def _sanitise_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            _sanitise_raw_text(key) if isinstance(key, str) else key: _sanitise_payload(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitise_payload(item) for item in value]
    if isinstance(value, str):
        return _sanitise_raw_text(value)
    return deepcopy(value)


class EvidenceRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    def ingest_batch(
        self,
        source_id: str,
        batch: FetchBatch,
        observed_at: datetime,
        run_id: str | None = None,
        *,
        stream_name: str | None = None,
    ) -> dict[str, Any]:
        batch = _BATCH_ADAPTER.validate_python(batch)
        observed_at = _aware(observed_at, "observed_at")
        with session_scope(self.engine) as session:
            source = session.scalar(select(Source).where(Source.id == source_id).with_for_update())
            if source is None:
                raise KeyError(f"Unknown source: {source_id}")
            run = self._get_run_for_source(session, run_id, source_id)
            self._validate_batch(session, source_id, batch)
            documents_with_hashes = [
                (document, hashlib.sha256(document.model_dump_json().encode()).hexdigest())
                for document in batch.documents
            ]
            stale_hashes = set()
            entity_batch = batch
            if (
                source_id == "find_case_law"
                and (source.permissions or {}).get("current_version_only") is True
                and documents_with_hashes
            ):
                stale_hashes = set(
                    session.scalars(
                        select(SourceRecord.content_hash).where(
                            SourceRecord.source_id == source_id,
                            SourceRecord.content_hash.in_(
                                [digest for _document, digest in documents_with_hashes]
                            ),
                            or_(
                                SourceRecord.active.is_(False),
                                SourceRecord.withdrawn.is_(True),
                            ),
                        )
                    )
                )
                # A replay must not put erased names or quoted summaries back
                # into canonical entities before the record deduplication check.
                entity_batch = batch.model_copy(
                    update={
                        "documents": [
                            document
                            for document, digest in documents_with_hashes
                            if digest not in stale_hashes
                        ]
                    }
                )
            self._upsert_batch_entities(session, entity_batch, observed_at)

            inserted = updated = replayed = 0
            for document, digest in documents_with_hashes:
                outcome = (
                    "replayed"
                    if digest in stale_hashes
                    else self._ingest_document(session, source_id, document, digest, observed_at)
                )
                inserted += outcome == "inserted"
                updated += outcome == "updated"
                replayed += outcome == "replayed"

            if stream_name is None:
                source.cursor = batch.cursor
            else:
                from meritus.models import StreamCheckpoint

                if source_id != "companies_house" or stream_name not in {"companies", "filings"}:
                    raise ValueError("Unknown source stream")
                checkpoint = session.get(StreamCheckpoint, (source_id, stream_name))
                if checkpoint is None:
                    raise ValueError("Stream checkpoint must be initialised before ingestion")
                if batch.cursor is None or not batch.cursor.isdigit():
                    raise ValueError("Stream checkpoint requires a numeric timepoint")
                if checkpoint.timepoint and int(batch.cursor) < int(checkpoint.timepoint):
                    raise ValueError("Stream checkpoint cannot move backwards")
                checkpoint.timepoint = batch.cursor
                checkpoint.last_event_at = observed_at
            if run is not None:
                run.fetched += len(batch.documents)
                run.inserted += inserted
                run.updated += updated
                run.cursor = batch.cursor

            return {
                "source_id": source_id,
                "fetched": len(batch.documents),
                "inserted": inserted,
                "updated": updated,
                "replayed": replayed,
                "cursor": batch.cursor,
            }

    @staticmethod
    def _get_run_for_source(session: Session, run_id: str | None, source_id: str):
        if run_id is None:
            return None
        from meritus.models import IngestionRun

        run = session.get(IngestionRun, run_id)
        if run is None:
            raise KeyError(f"Unknown ingestion run: {run_id}")
        if run.source_id != source_id:
            raise ValueError("The ingestion run belongs to a different source")
        if run.status != "running":
            raise ValueError("The ingestion run is not active")
        return run

    def _validate_batch(self, session: Session, source_id: str, batch: FetchBatch) -> None:
        batch_entities: dict[str, Any] = {}
        for document in batch.documents:
            for entity in document.entities:
                self._validate_entity_identity(source_id, entity)
                previous = batch_entities.get(entity.key)
                if previous is not None and (
                    previous.kind != entity.kind
                    or previous.scheme != entity.scheme
                    or previous.identifier != entity.identifier
                ):
                    raise ValueError(f"Conflicting definitions for entity {entity.key}")
                batch_entities[entity.key] = entity

        referenced = {
            observation.subject_key
            for document in batch.documents
            for observation in document.observations
        }
        referenced.update(
            key
            for document in batch.documents
            for relationship in document.relationships
            for key in (relationship.from_key, relationship.to_key)
        )
        existing = set()
        if referenced:
            existing = set(
                session.scalars(select(Entity.key).where(Entity.key.in_(referenced))).all()
            )
        available = existing | set(batch_entities)
        for document in batch.documents:
            for observation in document.observations:
                self._validate_reference_source(session, source_id, observation.subject_key)
                if observation.subject_key not in available:
                    raise ValueError(f"Unknown observation subject: {observation.subject_key}")
            for relationship in document.relationships:
                self._validate_reference_source(session, source_id, relationship.from_key)
                self._validate_reference_source(session, source_id, relationship.to_key)
                if relationship.from_key not in available:
                    raise ValueError(f"Unknown relationship source: {relationship.from_key}")
                if relationship.to_key not in available:
                    raise ValueError(f"Unknown relationship target: {relationship.to_key}")

    @classmethod
    def _validate_reference_source(cls, session: Session, source_id: str, key: str) -> None:
        if key.startswith("unresolved:") and not key.startswith(f"unresolved:{source_id}:"):
            raise ValueError(f"Cross-source unresolved reference: {key}")
        if key.startswith("project:") and not key.startswith(f"project:{source_id}:"):
            entity = session.scalar(select(Entity).where(Entity.key == key))
            if entity is None or not cls._project_has_reviewed_resolution(session, entity):
                raise ValueError(
                    f"Cross-source project reference requires analyst resolution: {key}"
                )

    @staticmethod
    def _project_has_reviewed_resolution(session: Session, entity: Entity) -> bool:
        candidate_ids = {
            entity.properties.get("merge_review_id"),
            entity.properties.get("merge_redirect_review_id"),
        }
        for identity in entity.properties.get("source_identities", []):
            source_identity = session.get(Entity, identity.get("entity_id"))
            if source_identity is not None:
                candidate_ids.update(
                    {
                        source_identity.properties.get("merge_review_id"),
                        source_identity.properties.get("merge_redirect_review_id"),
                    }
                )
        for review_id in candidate_ids - {None}:
            review = session.get(Review, review_id)
            if review is not None and review.target_type == "entity" and review.action == "merge":
                return True
        return False

    @staticmethod
    def _validate_entity_identity(source_id: str, entity) -> None:
        if set(entity.properties) & _REVIEWED_ENTITY_PROPERTIES:
            raise ValueError("Entity resolution properties require an analyst merge review")
        if entity.key.startswith("unresolved:"):
            expected_prefix = f"unresolved:{source_id}:"
            if not entity.key.startswith(expected_prefix) or entity.scheme or entity.identifier:
                raise ValueError(f"Invalid unresolved identity: {entity.key}")
            return
        if entity.scheme == "GB-COH":
            if entity.identifier is None or company_key(entity.identifier) != entity.key:
                raise ValueError(f"Companies House identifier does not match key {entity.key}")
            return
        if entity.scheme is not None or entity.identifier is not None:
            if not entity.scheme or not entity.identifier:
                raise ValueError(
                    f"Identity scheme and identifier must be supplied together: {entity.key}"
                )
            if entity.key != f"{entity.scheme}:{entity.identifier}":
                raise ValueError(f"Entity identifier does not match key {entity.key}")
            return
        if entity.kind == "project" and entity.key.startswith(f"project:{source_id}:"):
            return
        raise ValueError(f"Name-only entity must use an unresolved key: {entity.key}")

    @staticmethod
    def _upsert_batch_entities(session: Session, batch: FetchBatch, observed_at: datetime) -> None:
        for document in batch.documents:
            for item in document.entities:
                entity = session.scalar(select(Entity).where(Entity.key == item.key))
                verified = item.verified and not item.key.startswith("unresolved:")
                properties = _sanitise_payload(item.properties)
                if entity is None:
                    session.add(
                        Entity(
                            key=item.key,
                            kind=item.kind,
                            name=item.name,
                            scheme=item.scheme,
                            identifier=item.identifier,
                            verified=verified,
                            properties=properties,
                            created_at=observed_at,
                            updated_at=observed_at,
                        )
                    )
                    session.flush()
                    continue
                if entity.properties.get("merged_into_entity_id"):
                    continue
                entity.name = item.name
                entity.verified = entity.verified or verified
                entity.properties = {**entity.properties, **properties}
                entity.updated_at = observed_at

    def _ingest_document(
        self,
        session: Session,
        source_id: str,
        document: ParsedDocument,
        digest: str,
        observed_at: datetime,
    ) -> str:
        external_id = sanitise_url(document.external_id)
        replay = session.scalar(
            select(SourceRecord).where(
                SourceRecord.source_id == source_id,
                SourceRecord.external_id == external_id,
                SourceRecord.content_hash == digest,
            )
        )
        if replay is not None:
            if not (replay.payload or {}).get("erasure"):
                self._upsert_document_provenance(session, document, replay, observed_at)
            return "replayed"

        prior_records = session.scalars(
            select(SourceRecord).where(
                SourceRecord.source_id == source_id,
                SourceRecord.external_id == external_id,
            )
        ).all()
        for prior in prior_records:
            prior.active = False
        revision = max((record.revision for record in prior_records), default=0) + 1
        raw_text = _sanitise_raw_text(document.raw_text)
        record = SourceRecord(
            source_id=source_id,
            external_id=external_id,
            revision=revision,
            content_hash=digest,
            source_url=sanitise_url(document.source_url),
            title=_sanitise_raw_text(document.title),
            published_at=document.published_at,
            observed_at=observed_at,
            expires_at=document.expires_at,
            active=True,
            withdrawn=document.withdrawn,
            media_type=document.media_type,
            payload=_sanitise_payload(document.payload),
            raw_text=raw_text,
            raw_text_hash=hashlib.sha256(raw_text.encode()).hexdigest()
            if raw_text is not None
            else None,
            parser_version="v1",
        )
        session.add(record)
        session.flush()
        self._upsert_document_provenance(session, document, record, observed_at)

        if not document.withdrawn:
            loaded_entities = session.scalars(
                select(Entity).where(
                    Entity.key.in_(
                        {observation.subject_key for observation in document.observations}
                        | {
                            key
                            for relationship in document.relationships
                            for key in (relationship.from_key, relationship.to_key)
                        }
                    )
                )
            )
            entities = {}
            for entity in loaded_entities:
                entities[entity.key] = self._resolve_merged_entity(session, entity)
            for item in document.observations:
                session.add(
                    Observation(
                        record_id=record.id,
                        entity_id=entities[item.subject_key].id,
                        kind=item.kind,
                        event_key=item.event_key,
                        headline=_sanitise_raw_text(item.headline),
                        detail=_sanitise_raw_text(item.detail),
                        occurred_at=item.occurred_at,
                        period_end=item.period_end,
                        state=item.state,
                        evidence_pointer=_sanitise_raw_text(item.evidence_pointer),
                        value=item.value,
                        unit=item.unit,
                        attributes=_sanitise_payload(item.attributes),
                        created_at=observed_at,
                    )
                )
            for item in document.relationships:
                session.add(
                    Relationship(
                        record_id=record.id,
                        from_entity_id=entities[item.from_key].id,
                        to_entity_id=entities[item.to_key].id,
                        role=item.role,
                        evidence_pointer=_sanitise_raw_text(item.evidence_pointer),
                        valid_from=item.valid_from,
                        valid_to=item.valid_to,
                        state=item.state,
                        attributes=_sanitise_payload(item.attributes),
                        created_at=observed_at,
                    )
                )

        session.add(
            Outbox(
                operation="delete" if document.withdrawn else "index",
                record_id=record.id,
                payload={"source_id": source_id, "external_id": external_id},
            )
        )
        return "updated" if prior_records else "inserted"

    @staticmethod
    def _upsert_document_provenance(
        session: Session,
        document: ParsedDocument,
        record: SourceRecord,
        observed_at: datetime,
    ) -> None:
        """Keep source-owned canonical fields separate so erasure can recompute safely."""
        for item in document.entities:
            entity = session.scalar(select(Entity).where(Entity.key == item.key))
            if entity is None or entity.properties.get("merged_into_entity_id"):
                continue
            provenance = session.scalar(
                select(EntityProvenance).where(
                    EntityProvenance.entity_id == entity.id,
                    EntityProvenance.record_id == record.id,
                )
            )
            values = {
                "name": _sanitise_raw_text(item.name),
                "properties": _sanitise_payload(item.properties),
                "verified": item.verified and not item.key.startswith("unresolved:"),
                "observed_at": observed_at,
            }
            if provenance is None:
                session.add(
                    EntityProvenance(
                        entity_id=entity.id,
                        record_id=record.id,
                        **values,
                    )
                )
                continue
            for field, value in values.items():
                setattr(provenance, field, value)

    @staticmethod
    def _resolve_merged_entity(session: Session, entity: Entity) -> Entity:
        visited = {entity.id}
        current = entity
        while destination_id := current.properties.get("merged_into_entity_id"):
            if destination_id in visited:
                raise ValueError(f"Cyclic entity merge involving {entity.key}")
            visited.add(destination_id)
            destination = session.get(Entity, destination_id)
            if destination is None:
                raise ValueError(f"Missing merge destination for {entity.key}")
            current = destination
        return current

    def list_entities(
        self, query: str = "", kind: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        if not 1 <= limit <= 1000:
            raise ValueError("limit must be between 1 and 1000")
        with session_scope(self.engine) as session:
            statement = select(Entity)
            if query:
                pattern = f"%{query.strip()}%"
                statement = statement.where(
                    or_(Entity.name.ilike(pattern), Entity.key.ilike(pattern))
                )
            if kind:
                statement = statement.where(Entity.kind == kind)
            statement = statement.order_by(Entity.name, Entity.id).limit(limit)
            return [model_dict(entity) for entity in session.scalars(statement)]

    def get_entity(self, entity_id: str) -> dict[str, Any]:
        with session_scope(self.engine) as session:
            entity = session.get(Entity, entity_id)
            if entity is None:
                raise KeyError(f"Unknown entity: {entity_id}")
            return model_dict(entity)

    def list_observations(
        self, entity_id: str | None = None, active_only: bool = True
    ) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = (
                select(Observation)
                .join(Observation.record)
                .options(
                    selectinload(Observation.record).selectinload(SourceRecord.source),
                    selectinload(Observation.entity),
                )
            )
            if entity_id:
                statement = statement.where(Observation.entity_id == entity_id)
            if active_only:
                statement = statement.where(
                    SourceRecord.active.is_(True), SourceRecord.withdrawn.is_(False)
                )
            statement = statement.order_by(
                SourceRecord.observed_at.desc(), Observation.created_at.desc()
            )
            observations = session.scalars(statement).all()
            return [self._observation_dict(item) for item in observations]

    @staticmethod
    def _observation_dict(observation: Observation) -> dict[str, Any]:
        record = observation.record
        data = model_dict(observation)
        data.update(
            {
                "entity_key": observation.entity.key,
                "entity_name": observation.entity.name,
                "entity_verified": observation.entity.verified,
                "source_id": record.source_id,
                "source_url": record.source_url,
                "title": record.title,
                "published_at": _json_value(record.published_at),
                "observed_at": _json_value(record.observed_at),
                "expires_at": _json_value(record.expires_at),
                "active": record.active,
                "withdrawn": record.withdrawn,
                "content_hash": record.content_hash,
                "revision": record.revision,
            }
        )
        return data

    def list_relationships(self, entity_id: str | None = None) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = select(Relationship).options(
                selectinload(Relationship.record).selectinload(SourceRecord.source),
                selectinload(Relationship.from_entity),
                selectinload(Relationship.to_entity),
            )
            statement = statement.where(
                or_(
                    Relationship.record_id.is_(None),
                    Relationship.record.has(
                        and_(SourceRecord.active.is_(True), SourceRecord.withdrawn.is_(False))
                    ),
                )
            )
            if entity_id:
                statement = statement.where(
                    or_(
                        Relationship.from_entity_id == entity_id,
                        Relationship.to_entity_id == entity_id,
                    )
                )
            statement = statement.order_by(Relationship.created_at.desc())
            return [self._relationship_dict(item) for item in session.scalars(statement)]

    @staticmethod
    def _relationship_dict(item: Relationship) -> dict[str, Any]:
        data = model_dict(item)
        data.update(
            {
                "from_entity_key": item.from_entity.key,
                "from_entity_name": item.from_entity.name,
                "to_entity_key": item.to_entity.key,
                "to_entity_name": item.to_entity.name,
                "source_id": item.record.source_id if item.record else None,
                "source_url": item.record.source_url if item.record else None,
                "title": item.record.title if item.record else None,
            }
        )
        return data

    def list_records(self, entity_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if not 1 <= limit <= 1000:
            raise ValueError("limit must be between 1 and 1000")
        with session_scope(self.engine) as session:
            statement = select(SourceRecord).options(
                selectinload(SourceRecord.source),
                selectinload(SourceRecord.observations).selectinload(Observation.entity),
            )
            if entity_id:
                observation_records = select(Observation.record_id).where(
                    Observation.entity_id == entity_id
                )
                relationship_records = select(Relationship.record_id).where(
                    or_(
                        Relationship.from_entity_id == entity_id,
                        Relationship.to_entity_id == entity_id,
                    )
                )
                statement = statement.where(
                    SourceRecord.id.in_(observation_records.union(relationship_records))
                )
            statement = statement.order_by(
                SourceRecord.observed_at.desc(), SourceRecord.revision.desc()
            ).limit(limit)
            records = session.scalars(statement).all()
            return [self._record_dict(record) for record in records]

    def _record_dict(self, record: SourceRecord) -> dict[str, Any]:
        data = model_dict(record)
        data.update(
            {
                "observations": [self._observation_dict(item) for item in record.observations],
                "source_name": record.source.name,
                "source_home_url": record.source.home_url,
                "source_licence_url": record.source.licence_url,
                "source_permissions": _json_value(record.source.permissions),
                "source_requires_permission": record.source.requires_permission,
            }
        )
        return data
