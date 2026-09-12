"""Small live materialisation cache, invalidated by evidence, rights and review changes."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from threading import RLock
from time import monotonic
from weakref import WeakKeyDictionary

from sqlalchemy import func, select

from meritus.access import record_access_clause
from meritus.db import session_scope
from meritus.models import (
    Alert,
    CalendarEntry,
    Entity,
    Outbox,
    PipelineAction,
    Relationship,
    Review,
    Snapshot,
    SourceRecord,
)

_CACHE = WeakKeyDictionary()
_LOCK = RLock()


def generation(repo, now: datetime):
    """Include present read eligibility so time expiry invalidates without a purge."""
    with session_scope(repo.engine) as session:
        values = []
        for model, field in (
            (Entity, Entity.updated_at),
            (Review, Review.created_at),
            (PipelineAction, PipelineAction.occurred_at),
            (CalendarEntry, CalendarEntry.created_at),
            (Snapshot, Snapshot.created_at),
            (SourceRecord, SourceRecord.observed_at),
            (Alert, Alert.created_at),
            (Relationship, Relationship.created_at),
        ):
            values.append(
                tuple(
                    session.execute(select(func.count(), func.max(field)).select_from(model)).one()
                )
            )
        values.append(
            tuple(session.execute(select(func.count(Alert.read_at), func.max(Alert.read_at))).one())
        )
        values.append(session.scalar(select(func.count()).select_from(Outbox)))
        values.append(
            session.scalar(
                select(func.count())
                .select_from(SourceRecord)
                .where(record_access_clause(session, SourceRecord, now=now, active_only=False))
            )
        )
    sources = json.dumps(repo.list_sources(), sort_keys=True, default=str)
    return (sources, *values)


def materialise(repo, key: str, build):
    """Cache only returned rankings/metadata, never full raw evidence or frozen inputs."""
    with _LOCK:
        current = generation(repo, datetime.now(UTC))
        engine_cache = _CACHE.setdefault(repo.engine, {})
        cached = engine_cache.get(key)
        if cached and cached[0] == current and monotonic() < cached[1]:
            return deepcopy(cached[2])
        for _attempt in range(2):
            value = build()
            after = generation(repo, datetime.now(UTC))
            if after == current:
                engine_cache[key] = (current, monotonic() + 30, deepcopy(value))
                return value
            current = after
        raise ValueError("Evidence or access changed during calculation; refresh to retry")


def clear_cache(repo):
    with _LOCK:
        _CACHE.pop(repo.engine, None)
