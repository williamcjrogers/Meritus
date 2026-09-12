"""Repository orchestration for watchlists, dashboards and frozen snapshots."""

from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, func, or_, select

from meritus.access import record_access_clause
from meritus.db import session_scope, utc_now
from meritus.intelligence.cache import materialise
from meritus.intelligence.rules import DEFAULT_RULES, RULE_VERSION
from meritus.intelligence.scoring import score_entities
from meritus.models import (
    Alert,
    CalendarEntry,
    Entity,
    EntityProvenance,
    Observation,
    PipelineAction,
    Relationship,
    Review,
    Snapshot,
    SourceRecord,
)
from meritus.outputs.indices import build_indices
from meritus.outputs.metrics import build_metrics
from meritus.read_access import (
    alert_access_clause,
    calendar_access_clause,
    entity_access_clause,
    pipeline_access_clause,
    project_entities,
    review_access_clause,
    sanitise_ranked_items,
)
from meritus.repository.evidence import _json_value, model_dict
from meritus.sources.policy import permission_allows


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        # SQLite commonly drops offsets from aware DateTime values.
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _latest_by_entity(items: list[dict[str, Any]], date_field: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in items:
        entity_id = item.get("entity_id") or (
            item.get("target_id") if item.get("target_type") == "entity" else None
        )
        when = _datetime(item.get(date_field))
        if not entity_id or when is None:
            continue
        existing = result.get(str(entity_id))
        if existing is None or when > _datetime(existing[date_field]):
            result[str(entity_id)] = item
    return result


class IntelligenceService:
    def __init__(self, repo):
        self.repo = repo

    def _cutoff(self, as_of: datetime | None) -> datetime:
        cutoff = as_of or utc_now()
        parsed = _datetime(cutoff)
        if parsed is None:
            raise ValueError("as_of must include a UTC offset")
        return parsed

    def _selected_record_ids(self, cutoff: datetime):
        latest_revision = (
            select(
                SourceRecord.source_id.label("source_id"),
                SourceRecord.external_id.label("external_id"),
                func.max(SourceRecord.revision).label("revision"),
            )
            .where(
                SourceRecord.observed_at <= cutoff,
                SourceRecord.published_at.is_not(None),
                SourceRecord.published_at <= cutoff,
            )
            .group_by(SourceRecord.source_id, SourceRecord.external_id)
            .subquery()
        )
        return select(SourceRecord.id).join(
            latest_revision,
            and_(
                SourceRecord.source_id == latest_revision.c.source_id,
                SourceRecord.external_id == latest_revision.c.external_id,
                SourceRecord.revision == latest_revision.c.revision,
            ),
        )

    def _all_entities(
        self, cutoff: datetime | None = None, record_ids=None
    ) -> list[dict[str, Any]]:
        cutoff = cutoff or utc_now()
        access_now = utc_now()
        with session_scope(self.repo.engine) as session:
            if record_ids is None:
                record_ids = set(
                    session.scalars(
                        self._selected_record_ids(cutoff).where(
                            record_access_clause(
                                session, SourceRecord, now=access_now, active_only=False
                            )
                        )
                    )
                )
            entities = session.scalars(select(Entity).order_by(Entity.name, Entity.id)).all()
            all_provenance = list(
                session.scalars(
                    select(EntityProvenance).order_by(
                        EntityProvenance.observed_at, EntityProvenance.id
                    )
                )
            )
            sourced_ids = {row.entity_id for row in all_provenance}
            readable = [row for row in all_provenance if row.record_id in record_ids]
            result = []
            for offset in range(0, len(entities), 5000):
                group = entities[offset : offset + 5000]
                ids = {entity.id for entity in group}
                result.extend(
                    project_entities(
                        session,
                        group,
                        now=access_now,
                        provenance_rows=[row for row in readable if row.entity_id in ids],
                        sourced_ids=sourced_ids,
                    )
                )
            return result

    def _records_at_cutoff(self, cutoff: datetime) -> dict[str, list[dict[str, Any]]]:
        # Column projections avoid loading ORM relationship graphs or raw bodies.
        columns = [
            column
            for column in SourceRecord.__table__.columns
            if column.name not in {"payload", "raw_text"}
        ]
        with session_scope(self.repo.engine) as session:
            statement = (
                select(
                    *columns, SourceRecord.payload["import_permission"].label("import_permission")
                )
                .where(
                    SourceRecord.id.in_(self._selected_record_ids(cutoff)),
                    record_access_clause(session, SourceRecord, now=utc_now(), active_only=False),
                )
                .order_by(SourceRecord.source_id, SourceRecord.external_id)
            )
            records = []
            for row in session.execute(statement):
                reference = {key: _json_value(value) for key, value in row._mapping.items()}
                reference["active"] = not reference["withdrawn"]
                reference["import_permission"] = reference["import_permission"] or {}
                records.append(reference)
            by_id = {record["id"]: record for record in records}
            identifiers = list(by_id)
            observations = []
            for offset in range(0, len(identifiers), 5000):
                statement = (
                    select(*Observation.__table__.columns)
                    .where(Observation.record_id.in_(identifiers[offset : offset + 5000]))
                    .order_by(Observation.record_id, Observation.id)
                )
                for row in session.execute(statement):
                    item = {key: _json_value(value) for key, value in row._mapping.items()}
                    record = by_id[item["record_id"]]
                    item.update(
                        {
                            key: record[key]
                            for key in (
                                "source_id",
                                "source_url",
                                "title",
                                "published_at",
                                "observed_at",
                                "expires_at",
                                "active",
                                "withdrawn",
                                "content_hash",
                                "revision",
                            )
                        }
                    )
                    observations.append(item)
            return {"records": records, "observations": observations}

    def _all_reviews(self, cutoff: datetime | None = None) -> list[dict[str, Any]]:
        # The evidence cutoff never revives an expired permission. Callers apply
        # historical review dates separately when reconstructing a snapshot.
        del cutoff
        with session_scope(self.repo.engine) as session:
            statement = (
                select(Review)
                .where(review_access_clause(session, Review, now=utc_now()))
                .order_by(Review.created_at.desc(), Review.id.desc())
            )
            return [model_dict(item) for item in session.scalars(statement).all()]

    def _frozen_inputs(self, cutoff: datetime) -> dict[str, Any]:
        with session_scope(self.repo.engine) as session:
            future_change = session.scalar(
                select(Entity.id)
                .where(
                    Entity.updated_at > cutoff, entity_access_clause(session, Entity, now=utc_now())
                )
                .limit(1)
            )
        if future_change:
            raise ValueError(
                "Historical entity state is unavailable; use a previously frozen snapshot"
            )
        evidence = self._records_at_cutoff(cutoff)
        selected_records = evidence["records"]
        observations = evidence["observations"]
        entities = self._all_entities(cutoff, {record["id"] for record in selected_records})
        if any((_datetime(entity.get("updated_at")) or cutoff) > cutoff for entity in entities):
            raise ValueError(
                "Historical entity state is unavailable; use a previously frozen snapshot or "
                "create an explicitly labelled retrospective research dataset"
            )
        entities = [
            item
            for item in entities
            if not (item.get("properties") or {}).get("merged_into_entity_id")
        ]
        all_reviews = self._all_reviews(cutoff)
        if any(
            item.get("target_type") in {"observation", "relationship", "source_record"}
            and (_datetime(item.get("created_at")) or cutoff) > cutoff
            for item in all_reviews
        ):
            raise ValueError(
                "Historical reviewed evidence state is unavailable; use a previously frozen "
                "snapshot or a labelled retrospective research dataset"
            )
        reviews = [
            item for item in all_reviews if (_datetime(item.get("created_at")) or cutoff) <= cutoff
        ]
        entity_map = {item["id"]: item for item in entities}
        observations = [item for item in observations if item["entity_id"] in entity_map]
        for item in observations:
            entity = entity_map[item["entity_id"]]
            item.update(
                entity_name=entity["name"],
                entity_key=entity["key"],
                entity_verified=entity["verified"],
            )
        with session_scope(self.repo.engine) as session:
            relationships = []
            record_map = {item["id"]: item for item in selected_records}
            for row in session.execute(
                select(*Relationship.__table__.columns).where(Relationship.created_at <= cutoff)
            ):
                item = {key: _json_value(value) for key, value in row._mapping.items()}
                from_id, to_id = item["from_entity_id"], item["to_entity_id"]
                matter_id = (item.get("attributes") or {}).get("matter_entity_id")
                if (
                    from_id not in entity_map
                    or to_id not in entity_map
                    or (matter_id and matter_id not in entity_map)
                ):
                    continue
                record = record_map.get(item["record_id"])
                if item["record_id"] and record is None:
                    continue
                item.update(
                    from_entity_key=entity_map[from_id]["key"],
                    from_entity_name=entity_map[from_id]["name"],
                    to_entity_key=entity_map[to_id]["key"],
                    to_entity_name=entity_map[to_id]["name"],
                    source_id=record["source_id"] if record else None,
                    source_url=record["source_url"] if record else None,
                    title=record["title"] if record else None,
                )
                relationships.append(item)
            calendar = [
                model_dict(row)
                for row in session.scalars(
                    select(CalendarEntry).where(
                        CalendarEntry.created_at <= cutoff,
                        calendar_access_clause(session, CalendarEntry, now=utc_now()),
                    )
                )
                if row.entity_id in entity_map
            ]
            pipeline = [
                model_dict(row)
                for row in session.scalars(
                    select(PipelineAction).where(
                        PipelineAction.occurred_at <= cutoff,
                        pipeline_access_clause(session, PipelineAction, now=utc_now()),
                    )
                )
                if row.entity_id in entity_map
            ]
        sources = self.repo.list_sources()
        incomplete_sources = [
            item["id"]
            for item in sources
            if item["id"] != "reviewed_import"
            and item.get("enabled") is True
            and item.get("status") != "healthy"
        ]
        return {
            "entities": entities,
            "source_records": selected_records,
            "source_permissions": {
                item["id"]: deepcopy(item.get("permissions") or {}) for item in sources
            },
            "observations": observations,
            "relationships": relationships,
            "reviews": reviews,
            "calendar": calendar,
            "pipeline_actions": pipeline,
            "coverage": {
                "complete": not incomplete_sources,
                "database_enumeration_complete": True,
                "truncated": False,
                "incomplete_sources": incomplete_sources,
                "entities_considered": len(entities),
                "source_records_considered": len(selected_records),
            },
        }

    def _previous_rows(self, kind: str, cutoff: datetime) -> dict[str, dict[str, Any]]:
        with session_scope(self.repo.engine) as session:
            snapshot = session.execute(
                select(Snapshot.rule_version, Snapshot.payload)
                .where(
                    Snapshot.kind == kind,
                    Snapshot.as_of < cutoff,
                    Snapshot.redacted_at.is_(None),
                )
                .order_by(Snapshot.as_of.desc(), Snapshot.id.desc())
                .limit(1)
            ).first()
            if snapshot is None:
                return {}
            payload = snapshot.payload or {}
            items = sanitise_ranked_items(
                session,
                payload.get("items", []),
                rule_version=snapshot.rule_version,
                knowledge_cutoff=payload.get("knowledge_cutoff"),
                applied_rules=payload.get("applied_rules"),
                frozen_inputs=payload,
                now=utc_now(),
            )
        return {str(item.get("entity_id")): item for item in items if item.get("entity_id")}

    @staticmethod
    def _routes(relationships: list[dict[str, Any]]) -> dict[str, str]:
        routes: dict[str, str] = {}
        for relationship in relationships:
            if relationship.get("state") != "verified":
                continue
            role = str(relationship.get("role") or "")
            if role not in {"introduction_route", "adviser", "funder", "practitioner"}:
                continue
            subject_id = str(relationship.get("from_entity_id"))
            routes.setdefault(
                subject_id,
                str(
                    (relationship.get("attributes") or {}).get("route")
                    or relationship.get("to_entity_name")
                    or relationship.get("to_entity_id")
                ),
            )
        return routes

    def _enrich(
        self,
        rows: list[dict[str, Any]],
        inputs: dict[str, Any],
        previous: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        entities = {item["id"]: item for item in inputs["entities"]}
        latest_review = _latest_by_entity(inputs["reviews"], "created_at")
        latest_pipeline = _latest_by_entity(inputs["pipeline_actions"], "occurred_at")
        routes = self._routes(inputs["relationships"])
        enriched = []
        for rank, row in enumerate(rows, start=1):
            item = deepcopy(row)
            entity = entities.get(item["entity_id"], {})
            properties = entity.get("properties") or {}
            review = latest_review.get(str(item["entity_id"]))
            pipeline = latest_pipeline.get(str(item["entity_id"]))
            prior = previous.get(str(item["entity_id"]))
            item.update(
                {
                    "rank": rank,
                    "sector": properties.get("sector"),
                    "geography": properties.get("geography"),
                    "lead_time_band": properties.get("lead_time_band"),
                    "reviewer": review.get("actor") if review else properties.get("reviewer"),
                    "review_state": (
                        "merged"
                        if review and review.get("action") == "merge"
                        else "rejected"
                        if review and review.get("action") in {"rejected", "reject"}
                        else "pending"
                        if review and review.get("action") in {"pending", "reset"}
                        else "verified"
                        if entity.get("verified")
                        else "pending"
                    ),
                    "pipeline_stage": pipeline.get("stage") if pipeline else None,
                    "change_since_previous": (
                        round(float(item["score"]) - float(prior["score"]), 1) if prior else None
                    ),
                    "suggested_review_route": (
                        properties.get("suggested_review_route")
                        or routes.get(str(item["entity_id"]))
                    ),
                }
            )
            enriched.append(item)
        return enriched

    def _watchlist_data(self, cutoff: datetime, kind: str = "weekly") -> dict[str, Any]:
        inputs = self._frozen_inputs(cutoff)
        inputs["applied_rules"] = deepcopy(DEFAULT_RULES)
        entities_by_key = {item.get("key"): item.get("id") for item in inputs["entities"]}
        observations_by_entity: dict[str, list[dict[str, Any]]] = {}
        for observation in inputs["observations"]:
            entity_id = observation.get("entity_id") or entities_by_key.get(
                observation.get("entity_key")
            )
            if entity_id:
                observations_by_entity.setdefault(str(entity_id), []).append(observation)
        rows = []
        for entity in inputs["entities"]:
            rows.extend(
                score_entities(
                    [entity],
                    observations_by_entity.get(str(entity["id"]), []),
                    cutoff,
                    rules=inputs["applied_rules"],
                )
            )
        rows.sort(
            key=lambda row: (
                -float(row["score"]),
                row.get("latest_evidence_at") is None,
                -(_datetime(row.get("latest_evidence_at")) or cutoff).timestamp(),
                str(row.get("key") or ""),
            )
        )
        rows = self._enrich(rows, inputs, self._previous_rows(kind, cutoff))
        return {"items": rows, "inputs": inputs}

    def watchlist(
        self,
        as_of: datetime | None = None,
        *,
        q: str | None = None,
        kind: str | None = None,
        stage: str | None = None,
        source: str | None = None,
        eligible: bool | None = None,
        sector: str | None = None,
        geography: str | None = None,
        lead_time_band: str | None = None,
        reviewer: str | None = None,
        review_state: str | None = None,
        pipeline_stage: str | None = None,
        signal_family: str | None = None,
    ) -> dict[str, Any]:
        cutoff = self._cutoff(as_of)
        if as_of is None:

            def build():
                calculation_time = utc_now()
                data = self._watchlist_data(calculation_time)
                return {
                    "items": data["items"],
                    "as_of": calculation_time.isoformat(),
                    "coverage": data["inputs"]["coverage"],
                }

            data = materialise(self.repo, "watchlist", build)
        else:
            full = self._watchlist_data(cutoff)
            data = {
                "items": full["items"],
                "as_of": cutoff.isoformat(),
                "coverage": full["inputs"]["coverage"],
            }
        items = data["items"]
        matching_evidence = self._matching_evidence(q, cutoff) if q else set()
        requested_stage = pipeline_stage or stage

        def matches(item: dict[str, Any]) -> bool:
            if (
                q
                and q.casefold() not in f"{item.get('name', '')} {item.get('key', '')}".casefold()
                and item["entity_id"] not in matching_evidence
            ):
                return False
            filters = {
                "kind": kind,
                "pipeline_stage": requested_stage,
                "sector": sector,
                "geography": geography,
                "lead_time_band": lead_time_band,
                "reviewer": reviewer,
                "review_state": review_state,
            }
            if any(
                value is not None and item.get(field) != value for field, value in filters.items()
            ):
                return False
            if source and source not in (item.get("source_ids") or []):
                return False
            if eligible is not None and item.get("eligible") is not eligible:
                return False
            return not signal_family or signal_family in {
                contribution.get("family") for contribution in item.get("contributions") or []
            }

        return {
            "items": [item for item in items if matches(item)],
            "as_of": data["as_of"],
            "rule_version": RULE_VERSION,
            "coverage": data["coverage"],
        }

    def _matching_evidence(self, query: str, cutoff: datetime) -> set[str]:
        with session_scope(self.repo.engine) as session:
            pattern = "%" + query.replace("%", r"\%").replace("_", r"\_") + "%"
            matched_records = select(SourceRecord.id).where(
                SourceRecord.id.in_(self._selected_record_ids(cutoff)),
                record_access_clause(session, SourceRecord, now=utc_now(), active_only=False),
                or_(
                    SourceRecord.title.ilike(pattern, escape="\\"),
                    SourceRecord.raw_text.ilike(pattern, escape="\\"),
                    SourceRecord.id.in_(
                        select(Observation.record_id).where(
                            or_(
                                Observation.headline.ilike(pattern, escape="\\"),
                                Observation.detail.ilike(pattern, escape="\\"),
                            )
                        )
                    ),
                ),
            )
            observation_ids = select(Observation.entity_id).where(
                Observation.record_id.in_(matched_records)
            )
            from_ids = select(Relationship.from_entity_id).where(
                Relationship.record_id.in_(matched_records)
            )
            to_ids = select(Relationship.to_entity_id).where(
                Relationship.record_id.in_(matched_records)
            )
            return set(session.scalars(observation_ids.union(from_ids, to_ids)))

    def create_snapshot(
        self, kind: str = "weekly", as_of: datetime | None = None
    ) -> dict[str, Any]:
        if kind not in {"weekly", "digest", "retrospective_research"}:
            raise ValueError("Snapshot kind must be weekly, digest or retrospective_research")
        cutoff = self._cutoff(as_of)
        data = self._watchlist_data(cutoff, kind)
        sources = {item["id"]: item for item in self.repo.list_sources()}
        export_policy = {
            source_id: permission_allows(source, "export", utc_now())
            for source_id, source in sources.items()
        }
        payload = {
            "items": data["items"],
            **data["inputs"],
            "knowledge_cutoff": cutoff.isoformat(),
            "rule_version": RULE_VERSION,
            "export_policy": export_policy,
            "research_mode": "retrospective" if kind == "retrospective_research" else "current",
        }
        return self.repo.save_snapshot(kind, cutoff, RULE_VERSION, payload)

    def dashboard(self, as_of: datetime | None = None) -> dict[str, Any]:
        cutoff = self._cutoff(as_of)
        data = self._watchlist_data(cutoff)
        watchlist = data["items"]
        inputs = data["inputs"]
        records_by_source: dict[str, list[dict[str, Any]]] = {}
        for record in inputs["source_records"]:
            records_by_source.setdefault(str(record["source_id"]), []).append(record)
        source_health = []
        for source in self.repo.list_sources():
            records = records_by_source.get(source["id"], [])
            source_health.append(
                {
                    "source_id": source["id"],
                    "name": source["name"],
                    "status": source["status"],
                    "record_count_at_cutoff": len(records),
                    "last_success_at": source.get("last_success_at"),
                    "coverage_complete": inputs["coverage"]["complete"],
                }
            )
        recent = sorted(
            [
                {"type": "review", **item, "activity_at": item.get("created_at")}
                for item in inputs["reviews"]
            ]
            + [
                {"type": "pipeline", **item, "activity_at": item.get("occurred_at")}
                for item in inputs["pipeline_actions"]
            ],
            key=lambda item: str(item.get("activity_at") or ""),
            reverse=True,
        )[:20]
        with session_scope(self.repo.engine) as session:
            alerts = [
                model_dict(item)
                for item in session.scalars(
                    select(Alert)
                    .where(
                        Alert.created_at <= cutoff,
                        alert_access_clause(session, Alert, now=utc_now()),
                    )
                    .order_by(Alert.created_at.desc())
                ).all()
            ]
        return {
            "summary": {
                "entities": len(inputs["entities"]),
                "ranked": len(watchlist),
                "eligible": sum(bool(item["eligible"]) for item in watchlist),
                "pending_reviews": sum(
                    item.get("review_state") in {None, "pending"} for item in watchlist
                ),
                "coverage_complete": inputs["coverage"]["complete"],
            },
            "watchlist": watchlist,
            "recent_activity": recent,
            "source_health": source_health,
            "alerts": alerts,
        }

    def metrics(
        self,
        as_of: datetime | None = None,
        *,
        cohort: str | None = None,
        date_from: datetime | str | None = None,
        date_to: datetime | str | None = None,
    ) -> dict[str, Any]:
        cutoff = self._cutoff(as_of)
        entities = {item["id"]: item for item in self._all_entities()}
        with session_scope(self.repo.engine) as session:
            actions = [
                model_dict(row)
                for row in session.scalars(
                    select(PipelineAction).where(
                        pipeline_access_clause(session, PipelineAction, now=utc_now())
                    )
                )
            ]
        reviews = deepcopy(self._all_reviews())
        for item in actions:
            properties = (entities.get(item.get("entity_id")) or {}).get("properties") or {}
            item.setdefault("cohort", properties.get("cohort"))
        for item in reviews:
            if item.get("target_type") != "entity":
                continue
            properties = (entities.get(item.get("target_id")) or {}).get("properties") or {}
            item.setdefault("cohort", properties.get("cohort"))
        return build_metrics(
            actions,
            reviews,
            cutoff,
            cohort=cohort,
            date_from=date_from,
            date_to=date_to,
        )

    def indices(self) -> dict[str, Any]:
        now = utc_now()
        with session_scope(self.repo.engine) as session:
            observations = [
                {key: _json_value(value) for key, value in row._mapping.items()}
                for row in session.execute(
                    select(
                        *Observation.__table__.columns,
                        SourceRecord.source_id,
                        SourceRecord.source_url,
                        SourceRecord.published_at,
                        SourceRecord.observed_at,
                        SourceRecord.active,
                        SourceRecord.withdrawn,
                        SourceRecord.revision,
                    )
                    .join(SourceRecord, SourceRecord.id == Observation.record_id)
                    .where(
                        Observation.kind.in_(["gateway_metric", "adjudication_metric"]),
                        Observation.state == "verified",
                        SourceRecord.published_at <= now,
                        SourceRecord.observed_at <= now,
                        record_access_clause(session, SourceRecord, now=now),
                    )
                )
            ]
        return build_indices(observations)


__all__ = ["IntelligenceService"]
