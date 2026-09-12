"""Engine construction, schema initialisation and transaction ownership."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.pool import StaticPool

from meritus.models import Base, Source
from meritus.sources.catalogue import source_catalogue


def create_engine_for_url(url: str) -> Engine:
    options: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if url in {"sqlite://", "sqlite:///:memory:"}:
            options["poolclass"] = StaticPool
    engine = create_engine(url, **options)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


@contextmanager
def session_scope(engine: Engine) -> Iterator[OrmSession]:
    session = OrmSession(engine, expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def initialise_database(engine: Engine) -> None:
    Base.metadata.create_all(engine)
    with session_scope(engine) as session:
        existing = set(session.scalars(select(Source.id)))
        for definition in source_catalogue():
            if definition["id"] in existing:
                continue
            session.add(Source(**definition))


def utc_now() -> datetime:
    return datetime.now(UTC)
