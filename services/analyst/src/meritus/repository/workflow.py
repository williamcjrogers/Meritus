"""Durable analyst decisions, calendar, pipeline and frozen snapshots."""

from copy import deepcopy
from datetime import date, datetime
from typing import Any

from sqlalchemy import select, update

from meritus.access import project_entity, record_allows
from meritus.db import session_scope, utc_now
from meritus.models import (
    CalendarEntry,
    Entity,
    Observation,
    Outbox,
    PipelineAction,
    Relationship,
    Review,
    Snapshot,
    SourceRecord,
)
from meritus.repository.evidence import _aware, _sanitise_payload, model_dict, sanitise_url
from meritus.sources.catalogue import company_key
from meritus.workflow.lineage import attach_calendar_lineage

_ENTITY_CHANGE_FIELDS = {"kind", "name", "scheme", "identifier", "verified", "properties"}
_ENTITY_KINDS = {"organisation", "project", "building", "proceeding", "person"}
_STATE_ACTIONS = {
    "accept": "verified",
    "verify": "verified",
    "verified": "verified",
    "reject": "rejected",
    "rejected": "rejected",
    "reset": "pending",
    "pending": "pending",
}
_TARGET_ACTIONS = {
    "entity": {*_STATE_ACTIONS, "update", "merge"},
    "observation": {*_STATE_ACTIONS, "update", "confirm_independence", "group_event"},
    "relationship": {*_STATE_ACTIONS, "update"},
    "source_record": {"withdraw"},
}
_RESERVED_ENTITY_PROPERTIES = {
    "merge_redirect_review_id",
    "merge_review_id",
    "merged_into_entity_id",
    "source_identities",
}
_REVIEWED_OBSERVATION_ATTRIBUTES = {
    "event_group_key",
    "event_group_review_reference",
    "independence_confirmed",
    "independence_review_reference",
}


class WorkflowRepositoryMixin:
    def record_review(
        self,
        target_type: str,
        target_id: str,
        action: str,
        reason: str,
        actor: str,
        payload: dict | None = None,
    ) -> dict[str, Any]:
        target_type = target_type.strip().lower()
        target_id = target_id.strip()
        action = action.strip().lower()
        if not all(
            (target_type.strip(), target_id.strip(), action.strip(), reason.strip(), actor.strip())
        ):
            raise ValueError("A review requires target, action, reason and actor")
        if payload is not None and not isinstance(payload, dict):
            raise ValueError("Review payload must be an object")
        decision_payload = _sanitise_payload(deepcopy(payload or {}))
        now = utc_now()
        with session_scope(self.engine) as session:
            canonical_action = self._validate_review(
                session, target_type, target_id, action, decision_payload
            )
            review = Review(
                target_type=target_type,
                target_id=target_id,
                action=canonical_action,
                actor=actor,
                reason=reason,
                payload=decision_payload,
                created_at=now,
            )
            session.add(review)
            session.flush()
            self._apply_review(session, review)
            session.flush()
            return model_dict(review)

    def _validate_review(
        self,
        session,
        target_type: str,
        target_id: str,
        action: str,
        payload: dict[str, Any],
    ) -> str:
        allowed_actions = _TARGET_ACTIONS.get(target_type)
        if allowed_actions is None:
            raise ValueError(f"Unsupported review target: {target_type}")
        if action not in allowed_actions:
            raise ValueError(f"Unsupported review action for {target_type}: {action}")
        target_model = {
            "entity": Entity,
            "observation": Observation,
            "relationship": Relationship,
            "source_record": SourceRecord,
        }[target_type]
        target = session.get(target_model, target_id)
        if target is None:
            raise KeyError(f"Unknown {target_type.replace('_', ' ')}: {target_id}")
        self._require_review_target_access(session, target_type, target)

        canonical_action = _STATE_ACTIONS.get(action, action)
        if target_type == "entity":
            self._validate_entity_review(session, target, canonical_action, payload)
        elif target_type in {"observation", "relationship"} and canonical_action == "update":
            self._validated_model_changes(target_model, payload)
        elif target_type == "observation" and canonical_action == "group_event":
            unknown = set(payload) - {"event_group_key"}
            if unknown:
                raise ValueError("group_event only accepts event_group_key")
            event_group_key = payload.get("event_group_key")
            if not isinstance(event_group_key, str) or not event_group_key.strip():
                raise ValueError("group_event requires a non-empty event_group_key")
        elif target_type == "observation" and canonical_action == "confirm_independence":
            if payload:
                raise ValueError("confirm_independence does not accept decision attributes")
        elif target_type == "source_record" and (target.withdrawn or not target.active):
            raise ValueError("Only an active source record can be withdrawn")
        return canonical_action

    def _validate_entity_review(
        self, session, entity: Entity, action: str, payload: dict[str, Any]
    ) -> None:
        if entity.properties.get("merged_into_entity_id"):
            raise ValueError("Reviews must target the canonical entity after a merge")
        if action == "merge":
            if set(payload) != {"into_entity_id"}:
                raise ValueError("An entity merge only accepts into_entity_id")
            destination_id = payload.get("into_entity_id")
            if not isinstance(destination_id, str) or not destination_id:
                raise ValueError("An entity merge requires into_entity_id")
            destination = session.get(Entity, destination_id)
            if destination is None:
                raise KeyError(f"Unknown merge destination entity: {destination_id}")
            self._require_entity(session, destination.id)
            if destination.id == entity.id:
                raise ValueError("An entity cannot be merged into itself")
            if destination.properties.get("merged_into_entity_id"):
                raise ValueError("The merge destination has already been merged")
            if entity.kind != destination.kind:
                raise ValueError("Merged entities must have the same kind")
            return

        changes = payload.get("changes", payload) if action == "update" else {}
        if not isinstance(changes, dict):
            raise ValueError("Entity changes must be an object")
        if action == "update" and not changes:
            raise ValueError("Entity update requires at least one change")
        unknown = set(changes) - _ENTITY_CHANGE_FIELDS
        if unknown:
            raise ValueError(f"Entity fields cannot be changed: {', '.join(sorted(unknown))}")
        if "properties" in changes:
            if not isinstance(changes["properties"], dict):
                raise ValueError("Entity properties must be an object")
            reserved = set(changes["properties"]) & _RESERVED_ENTITY_PROPERTIES
            if reserved:
                raise ValueError("Merge identity properties can only be changed by a merge review")

        candidate = {
            "key": entity.key,
            "kind": changes.get("kind", entity.kind),
            "name": changes.get("name", entity.name),
            "scheme": changes.get("scheme", entity.scheme),
            "identifier": changes.get("identifier", entity.identifier),
            "verified": changes.get("verified", entity.verified),
        }
        if action == "verified":
            candidate["verified"] = True
        elif action in {"rejected", "pending"}:
            candidate["verified"] = False
        self._validate_review_entity_identity(**candidate)

    @staticmethod
    def _validate_review_entity_identity(
        *,
        key: str,
        kind: str,
        name: str,
        scheme: str | None,
        identifier: str | None,
        verified: bool,
    ) -> None:
        if kind not in _ENTITY_KINDS:
            raise ValueError(f"Invalid entity kind: {kind}")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Entity name cannot be empty")
        if key.startswith("unresolved:"):
            if scheme is not None or identifier is not None:
                raise ValueError("Unresolved identities cannot acquire an identifier")
            if verified:
                raise ValueError(
                    "Unresolved identities cannot be verified; merge a confirmed target"
                )
            return
        if scheme == "GB-COH":
            if kind != "organisation":
                raise ValueError("A Companies House identity must be an organisation")
            if identifier is None or company_key(identifier) != key:
                raise ValueError(f"Companies House identifier does not match key {key}")
            return
        if scheme is not None or identifier is not None:
            if not scheme or not identifier or key != f"{scheme}:{identifier}":
                raise ValueError(f"Entity identifier does not match key {key}")
            return
        if kind == "project" and key.startswith("project:"):
            return
        raise ValueError(f"Name-only entity must use an unresolved key: {key}")

    def _apply_review(self, session, review: Review) -> None:
        if review.target_type == "entity":
            entity = session.get(Entity, review.target_id)
            if entity is None:
                raise KeyError(f"Unknown entity: {review.target_id}")
            if review.action == "merge":
                self._merge_entity(session, entity, review)
            elif review.action == "update":
                changes = review.payload.get("changes", review.payload)
                for key, value in changes.items():
                    if key == "properties":
                        value = {**entity.properties, **deepcopy(value)}
                    setattr(entity, key, value)
                entity.updated_at = review.created_at
            elif review.action == "verified":
                entity.verified = True
                entity.updated_at = review.created_at
            elif review.action in {"rejected", "pending"}:
                entity.verified = False
                entity.updated_at = review.created_at
            return

        if review.target_type == "source_record":
            record = session.get(SourceRecord, review.target_id)
            record.withdrawn = True
            record.active = False
            pending_index = session.scalar(
                select(Outbox).where(
                    Outbox.record_id == record.id,
                    Outbox.processed_at.is_(None),
                )
            )
            if pending_index is not None:
                pending_index.operation = "delete"
            else:
                session.add(
                    Outbox(
                        operation="delete",
                        record_id=record.id,
                        payload={"source_id": record.source_id, "external_id": record.external_id},
                    )
                )
            return
        model = {"observation": Observation, "relationship": Relationship}[review.target_type]
        target = session.get(model, review.target_id)
        if review.action in {"verified", "pending", "rejected"}:
            target.state = review.action
        elif review.action == "update":
            changes = review.payload.get("changes", review.payload)
            for key, value in changes.items():
                setattr(target, key, deepcopy(value))
        elif review.action == "confirm_independence":
            target.attributes = {
                **target.attributes,
                "independence_confirmed": True,
                "independence_review_reference": review.id,
            }
        elif review.action == "group_event":
            target.attributes = {
                **target.attributes,
                "event_group_key": review.payload["event_group_key"].strip(),
                "event_group_review_reference": review.id,
            }

    @staticmethod
    def _validated_model_changes(model, payload: dict[str, Any]) -> dict[str, Any]:
        changes = payload.get("changes", payload)
        if not isinstance(changes, dict):
            raise ValueError("Review changes must be an object")
        if not changes:
            raise ValueError("Review update requires at least one change")
        allowed = {column.key for column in model.__mapper__.column_attrs} - {
            "id",
            "record_id",
            "entity_id",
            "from_entity_id",
            "to_entity_id",
            "created_at",
        }
        unknown = set(changes) - allowed
        if unknown:
            raise ValueError(f"Fields cannot be changed: {', '.join(sorted(unknown))}")
        if "state" in changes and changes["state"] not in {"verified", "pending", "rejected"}:
            raise ValueError("Invalid review state")
        if "attributes" in changes and not isinstance(changes["attributes"], dict):
            raise ValueError("Attributes must be an object")
        if (
            model is Observation
            and set(changes.get("attributes", {})) & _REVIEWED_OBSERVATION_ATTRIBUTES
        ):
            raise ValueError("Reviewed event attributes require a dedicated review action")
        return changes

    @staticmethod
    def _merge_entity(session, source: Entity, review: Review) -> None:
        destination_id = review.payload["into_entity_id"]
        destination = session.get(Entity, destination_id)

        source_identity = {
            "entity_id": source.id,
            "key": source.key,
            "name": source.name,
            "scheme": source.scheme,
            "identifier": source.identifier,
        }
        redirected_entities = [
            entity
            for entity in session.scalars(select(Entity)).all()
            if entity.properties.get("merged_into_entity_id") == source.id
        ]
        destination_properties = deepcopy(destination.properties)
        identities = list(destination_properties.get("source_identities", []))
        incoming_identities = [
            source_identity,
            *deepcopy(source.properties.get("source_identities", [])),
        ]
        known_identity_ids = {identity.get("entity_id") for identity in identities}
        for identity in incoming_identities:
            if identity.get("entity_id") not in known_identity_ids:
                identities.append(identity)
                known_identity_ids.add(identity.get("entity_id"))
        destination_properties["source_identities"] = identities
        destination.properties = destination_properties
        destination.updated_at = review.created_at

        source_properties = deepcopy(source.properties)
        source_properties.update(
            {"merged_into_entity_id": destination.id, "merge_review_id": review.id}
        )
        source.properties = source_properties
        source.verified = False
        source.updated_at = review.created_at

        for redirected in redirected_entities:
            redirected_properties = deepcopy(redirected.properties)
            redirected_properties.update(
                {
                    "merged_into_entity_id": destination.id,
                    "merge_redirect_review_id": review.id,
                }
            )
            redirected.properties = redirected_properties
            redirected.updated_at = review.created_at

        redirected_ids = [source.id, *(entity.id for entity in redirected_entities)]
        session.execute(
            update(Observation)
            .where(Observation.entity_id.in_(redirected_ids))
            .values(entity_id=destination.id)
        )
        session.execute(
            update(Relationship)
            .where(Relationship.from_entity_id.in_(redirected_ids))
            .values(from_entity_id=destination.id)
        )
        session.execute(
            update(Relationship)
            .where(Relationship.to_entity_id.in_(redirected_ids))
            .values(to_entity_id=destination.id)
        )
        session.execute(
            update(CalendarEntry)
            .where(CalendarEntry.entity_id.in_(redirected_ids))
            .values(entity_id=destination.id)
        )
        session.execute(
            update(PipelineAction)
            .where(PipelineAction.entity_id.in_(redirected_ids))
            .values(entity_id=destination.id)
        )

    def list_reviews(
        self,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = select(Review)
            if target_type:
                statement = statement.where(Review.target_type == target_type)
            if target_id:
                statement = statement.where(Review.target_id == target_id)
            statement = statement.order_by(Review.created_at.desc(), Review.id.desc()).limit(limit)
            return [model_dict(review) for review in session.scalars(statement)]

    def add_calendar_entry(self, data: dict) -> dict[str, Any]:
        required = {"entity_id", "kind", "title", "date", "precision", "status"}
        missing = required - set(data)
        if missing:
            raise ValueError(f"Missing calendar fields: {', '.join(sorted(missing))}")
        allowed = required | {
            "source_url",
            "source_record_id",
            "evidence",
            "jurisdiction",
            "basis",
            "reviewer",
        }
        unknown = set(data) - allowed
        if unknown:
            raise ValueError(f"Unknown calendar fields: {', '.join(sorted(unknown))}")
        entry_date = data["date"]
        if isinstance(entry_date, str):
            entry_date = date.fromisoformat(entry_date)
        elif isinstance(entry_date, datetime):
            entry_date = entry_date.date()
        if not isinstance(entry_date, date):
            raise ValueError("Calendar date must be an ISO date")
        with session_scope(self.engine) as session:
            self._require_entity(session, data["entity_id"])
            data = attach_calendar_lineage(session, data)
            entry = CalendarEntry(
                entity_id=data["entity_id"],
                kind=data["kind"],
                title=data["title"],
                date=entry_date,
                precision=data["precision"],
                source_url=sanitise_url(data.get("source_url", "")),
                evidence=_sanitise_payload(data.get("evidence", {})),
                status=data["status"],
                jurisdiction=data.get("jurisdiction", ""),
                basis=data.get("basis", ""),
                reviewer=data.get("reviewer", ""),
                created_at=utc_now(),
            )
            session.add(entry)
            session.flush()
            return model_dict(entry)

    def list_calendar_entries(self) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = select(CalendarEntry).order_by(CalendarEntry.date, CalendarEntry.id)
            return [model_dict(entry) for entry in session.scalars(statement)]

    def add_pipeline_action(self, data: dict) -> dict[str, Any]:
        required = {"entity_id", "stage", "actor", "occurred_at"}
        missing = required - set(data)
        if missing:
            raise ValueError(f"Missing pipeline fields: {', '.join(sorted(missing))}")
        unknown = set(data) - (required | {"note"})
        if unknown:
            raise ValueError(f"Unknown pipeline fields: {', '.join(sorted(unknown))}")
        occurred_at = data["occurred_at"]
        if isinstance(occurred_at, str):
            occurred_at = datetime.fromisoformat(occurred_at)
        occurred_at = _aware(occurred_at, "occurred_at")
        with session_scope(self.engine) as session:
            self._require_entity(session, data["entity_id"])
            action = PipelineAction(
                entity_id=data["entity_id"],
                stage=data["stage"],
                note=data.get("note", ""),
                actor=data["actor"],
                occurred_at=occurred_at,
            )
            session.add(action)
            session.flush()
            return model_dict(action)

    def list_pipeline_actions(self) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = select(PipelineAction).order_by(
                PipelineAction.occurred_at.desc(), PipelineAction.id.desc()
            )
            return [model_dict(action) for action in session.scalars(statement)]

    def save_snapshot(
        self, kind: str, as_of: datetime, rule_version: str, payload: dict
    ) -> dict[str, Any]:
        as_of = _aware(as_of, "as_of")
        frozen_payload = deepcopy(payload)
        with session_scope(self.engine) as session:
            snapshot = Snapshot(
                kind=kind,
                as_of=as_of,
                rule_version=rule_version,
                payload=frozen_payload,
                created_at=utc_now(),
            )
            session.add(snapshot)
            session.flush()
            return model_dict(snapshot)

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        with session_scope(self.engine) as session:
            snapshot = session.get(Snapshot, snapshot_id)
            if snapshot is None:
                raise KeyError(f"Unknown snapshot: {snapshot_id}")
            return model_dict(snapshot)

    def list_snapshots(self, kind: str | None = None) -> list[dict[str, Any]]:
        with session_scope(self.engine) as session:
            statement = select(Snapshot)
            if kind:
                statement = statement.where(Snapshot.kind == kind)
            statement = statement.order_by(Snapshot.as_of.desc(), Snapshot.id.desc())
            return [model_dict(snapshot) for snapshot in session.scalars(statement)]

    @staticmethod
    def _require_entity(session, entity_id: str) -> Entity:
        entity = session.get(Entity, entity_id)
        if entity is None or project_entity(session, entity, now=utc_now()) is None:
            raise KeyError(f"Unknown entity: {entity_id}")
        return entity

    @staticmethod
    def _require_record(session, record_id: str) -> SourceRecord:
        record = session.get(SourceRecord, record_id)
        if record is None or not record_allows(record, record.source, utc_now()):
            raise KeyError(f"Unknown source record: {record_id}")
        return record

    def _require_review_target_access(self, session, target_type: str, target) -> None:
        if target_type == "entity":
            self._require_entity(session, target.id)
        elif target_type == "source_record":
            self._require_record(session, target.id)
        elif target_type == "observation":
            self._require_record(session, target.record_id)
        elif target_type == "relationship":
            self._require_entity(session, target.from_entity_id)
            self._require_entity(session, target.to_entity_id)
            if target.record_id:
                self._require_record(session, target.record_id)
