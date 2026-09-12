"""Private, portable backups with retention-safe restore semantics."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import stat
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select

from meritus.db import utc_now
from meritus.models import Base, Source, SourceRecord
from meritus.repository import Repository
from meritus.retention import (
    merge_erasure_ledger,
    purge_expired,
    read_erasure_ledger,
    register_managed_artifact,
)
from meritus.sources.catalogue import source_catalogue

FORMAT = "meritus-private-backup"
VERSION = 1
_ADDITIVE_V1_TABLES = {"alert_generation", "alert_lineage", "alert_score_state"}
MAX_ARCHIVE_BYTES = 2_000_000_000
REPLACE_CONFIRMATION = "REPLACE"


def _root(path: str | Path) -> Path:
    root = Path(path).absolute()
    if root.is_symlink():
        raise ValueError("Managed data root must not be a symbolic link")
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _inside_root(path: str | Path, root: Path, *, must_exist: bool) -> Path:
    candidate = Path(path).absolute()
    resolved = candidate.resolve()
    if resolved == root or root not in resolved.parents:
        raise ValueError("Backup files must be inside the managed data directory")
    for part in (candidate, *candidate.parents):
        if part == root:
            break
        if part.is_symlink():
            raise ValueError("Backup paths must not contain symbolic links")
    if must_exist and (not resolved.is_file() or candidate.is_symlink()):
        raise ValueError("Backup archive must be an existing regular file")
    return resolved


def _portable(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"$datetime": value.isoformat()}
    if isinstance(value, date):
        return {"$date": value.isoformat()}
    if isinstance(value, bytes):
        return {"$bytes": value.hex()}
    return value


def _native(value: Any) -> Any:
    if isinstance(value, dict):
        if set(value) == {"$datetime"} and isinstance(value["$datetime"], str):
            parsed = datetime.fromisoformat(value["$datetime"].replace("Z", "+00:00"))
            return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
        if set(value) == {"$date"} and isinstance(value["$date"], str):
            return date.fromisoformat(value["$date"])
        if set(value) == {"$bytes"} and isinstance(value["$bytes"], str):
            return bytes.fromhex(value["$bytes"])
    return value


def _native_cell(column, value: Any) -> Any:
    if value is None:
        return None
    try:
        expected = column.type.python_type
    except NotImplementedError:
        return value
    if expected not in {datetime, date, bytes}:
        return value
    decoded = _native(value)
    if type(decoded) is not expected:
        raise ValueError(f"Invalid portable value for {column.table.name}.{column.name}")
    return decoded


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )


def _database_payload(repo: Repository) -> dict[str, list[dict[str, Any]]]:
    tables: dict[str, list[dict[str, Any]]] = {}
    with repo.engine.connect() as connection:
        transaction = connection.begin()
        try:
            if connection.dialect.name == "postgresql":
                connection.exec_driver_sql(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
                )
            for table in Base.metadata.sorted_tables:
                rows = connection.execute(select(table)).mappings()
                tables[table.name] = [
                    {column.name: _portable(row[column.name]) for column in table.columns}
                    for row in rows
                ]
        finally:
            transaction.rollback()
    return tables


def _write_archive(destination: Path, document: dict[str, Any]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.parent / f".{destination.name}.{uuid4().hex}.new"
    descriptor = os.open(
        temporary,
        os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    try:
        with os.fdopen(descriptor, "wb") as raw:
            with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as compressed:
                compressed.write(_canonical(document))
            raw.flush()
            os.fsync(raw.fileno())
        try:
            os.link(temporary, destination, follow_symlinks=False)
        except FileExistsError as error:
            raise ValueError("Backup refuses to overwrite an existing archive") from error
        temporary.unlink()
        directory = os.open(destination.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists() and not temporary.is_symlink():
            temporary.unlink()


def create_backup(
    repo: Repository,
    destination: str | Path,
    *,
    managed_root: str | Path,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Create a database backup and register it for evidence expiry deletion."""
    now = now or utc_now()
    if now.tzinfo is None:
        raise ValueError("Backup time must include a UTC offset")
    root = _root(managed_root)
    path = _inside_root(destination, root, must_exist=False)
    if path.exists():
        raise ValueError("Backup refuses to overwrite an existing archive")
    purge_expired(repo, now=now, managed_root=root)
    ledger = read_erasure_ledger(root)
    tables = _database_payload(repo)
    payload = {
        "format": FORMAT,
        "version": VERSION,
        "created_at": now.astimezone(UTC).isoformat(),
        "database": {"tables": tables},
        "erasure_ledger": ledger,
        "files": [],
    }
    document = {"payload": payload, "sha256": hashlib.sha256(_canonical(payload)).hexdigest()}
    _write_archive(path, document)

    erased = set(ledger["erasures"])
    record_ids = sorted(
        row["id"] for row in tables.get(SourceRecord.__tablename__, []) if row["id"] not in erased
    )
    registered = bool(record_ids)
    if registered:
        try:
            register_managed_artifact(path, record_ids, "backup", managed_root=root)
        except Exception:
            # A concurrent purge can make the snapshot ineligible between the
            # database read and registration. Never leave that evidence behind.
            path.unlink(missing_ok=True)
            raise
    return {
        "path": str(path),
        "format": FORMAT,
        "version": VERSION,
        "record_count": len(tables.get(SourceRecord.__tablename__, [])),
        "registered": registered,
        "sha256": document["sha256"],
    }


def _read_archive(path: Path) -> dict[str, Any]:
    try:
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        with os.fdopen(descriptor, "rb") as raw:
            metadata = os.fstat(raw.fileno())
            if not stat.S_ISREG(metadata.st_mode):
                raise ValueError("Backup archive must be a regular file")
            if metadata.st_size > MAX_ARCHIVE_BYTES:
                raise ValueError("Backup archive exceeds the supported size")
            with gzip.GzipFile(fileobj=raw, mode="rb") as stream:
                content = stream.read(MAX_ARCHIVE_BYTES + 1)
    except (OSError, EOFError) as error:
        raise ValueError("Backup archive is not valid gzip data") from error
    if len(content) > MAX_ARCHIVE_BYTES:
        raise ValueError("Backup archive expands beyond the supported size")
    try:
        document = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Backup archive does not contain valid JSON") from error
    if not isinstance(document, dict) or set(document) != {"payload", "sha256"}:
        raise ValueError("Invalid backup archive envelope")
    payload = document["payload"]
    if (
        not isinstance(payload, dict)
        or document["sha256"] != hashlib.sha256(_canonical(payload)).hexdigest()
    ):
        raise ValueError("Backup archive integrity check failed")
    if payload.get("format") != FORMAT or payload.get("version") != VERSION:
        raise ValueError("Unsupported backup archive format or version")
    if set(payload) != {
        "format",
        "version",
        "created_at",
        "database",
        "erasure_ledger",
        "files",
    }:
        raise ValueError("Invalid backup archive payload")
    datetime.fromisoformat(str(payload["created_at"]).replace("Z", "+00:00"))
    if not isinstance(payload["files"], list):
        raise ValueError("Invalid backup file manifest")
    for member in payload["files"]:
        if not isinstance(member, dict) or not isinstance(member.get("path"), str):
            raise ValueError("Invalid backup file manifest")
        relative = PurePosixPath(member["path"])
        if relative.is_absolute() or ".." in relative.parts or not relative.parts:
            raise ValueError("Backup contains an unsafe archive member")
    database = payload["database"]
    if not isinstance(database, dict) or set(database) != {"tables"}:
        raise ValueError("Invalid backup database payload")
    tables = database["tables"]
    expected = {table.name for table in Base.metadata.sorted_tables}
    if not isinstance(tables, dict):
        raise ValueError("Backup database tables do not match this application version")
    missing = expected - set(tables)
    if set(tables) - expected or missing - _ADDITIVE_V1_TABLES:
        raise ValueError("Backup database tables do not match this application version")
    for name in missing:
        tables[name] = []
    for table in Base.metadata.sorted_tables:
        rows = tables[table.name]
        columns = {column.name for column in table.columns}
        if not isinstance(rows, list) or any(
            not isinstance(row, dict) or set(row) != columns for row in rows
        ):
            raise ValueError(f"Invalid rows for backup table {table.name}")
    return payload


def _catalogue_source_rows() -> list[dict[str, Any]]:
    expected = []
    for definition in source_catalogue():
        expected.append(
            {
                **definition,
                "cursor": None,
                "last_attempt_at": None,
                "last_success_at": None,
                "last_error": None,
            }
        )
    return sorted(expected, key=lambda row: row["id"])


def _target_is_empty(repo: Repository) -> bool:
    with repo.engine.connect() as connection:
        for table in Base.metadata.sorted_tables:
            count = connection.scalar(select(func.count()).select_from(table)) or 0
            if table.name != Source.__tablename__ and count:
                return False
        rows = connection.execute(select(Source.__table__)).mappings()
        current = sorted(
            (
                {column.name: row[column.name] for column in Source.__table__.columns}
                for row in rows
            ),
            key=lambda row: row["id"],
        )
    return current in ([], _catalogue_source_rows())


def _replace_database(connection, tables: dict[str, list[dict[str, Any]]]) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        connection.execute(table.delete())
    for table in Base.metadata.sorted_tables:
        rows = tables[table.name]
        if rows:
            connection.execute(table.insert(), rows)


@contextmanager
def _replacement_transaction(engine):
    connection = engine.connect()
    try:
        if connection.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        else:
            connection.begin()
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _decode_tables(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    tables = payload["database"]["tables"]
    return {
        table.name: [
            {column.name: _native_cell(column, row[column.name]) for column in table.columns}
            for row in tables[table.name]
        ]
        for table in Base.metadata.sorted_tables
    }


def restore_backup(
    archive: str | Path,
    repo: Repository,
    *,
    managed_root: str | Path,
    now: datetime | None = None,
    replace: bool = False,
    confirmation: str | None = None,
    search_index=None,
) -> dict[str, Any]:
    """Restore a validated archive, then enforce merged erasure state before return."""
    now = now or utc_now()
    if now.tzinfo is None:
        raise ValueError("Restore time must include a UTC offset")
    root = _root(managed_root)
    path = _inside_root(archive, root, must_exist=True)
    payload = _read_archive(path)
    tables = _decode_tables(payload)
    target_empty = _target_is_empty(repo)
    if not target_empty and not replace:
        raise ValueError("Restore target is not empty; use explicit replacement")
    if replace and confirmation != REPLACE_CONFIRMATION:
        raise ValueError(f'Replacement requires confirmation "{REPLACE_CONFIRMATION}"')

    # Deletion history is installation-local and remains present even if the
    # database replacement or later purge is interrupted.
    merge_erasure_ledger(payload["erasure_ledger"], root)
    path.chmod(0o600)
    archive_record_ids = sorted(row["id"] for row in tables[SourceRecord.__tablename__])
    erased = set(read_erasure_ledger(root)["erasures"])
    registered = bool(archive_record_ids) and not erased.intersection(archive_record_ids)
    if registered:
        try:
            register_managed_artifact(path, archive_record_ids, "backup", managed_root=root)
        except Exception:
            path.unlink(missing_ok=True)
            raise
    else:
        path.unlink(missing_ok=True)

    owned_search = search_index is None
    if owned_search:
        from meritus.config import Settings
        from meritus.search import SearchIndex

        search_index = SearchIndex(Settings(data_dir=root))
    try:
        with search_index.exclusive():
            invalidation = search_index.invalidate()
            with _replacement_transaction(repo.engine) as connection:
                transactional_repo = Repository(connection)
                _replace_database(connection, tables)
                purge = purge_expired(transactional_repo, now=now, managed_root=root)
            try:
                search = search_index.reindex(repo)
                if search.get("complete") is not True:
                    raise RuntimeError("Search rebuild did not report completion")
            except Exception as error:
                raise RuntimeError(
                    "Database restore committed, but the search rebuild is incomplete; "
                    "run meritus reindex before restarting the application."
                ) from error
    finally:
        if owned_search:
            search_index.close()
    return {
        "path": str(path),
        "format": FORMAT,
        "version": VERSION,
        "record_count": len(tables[SourceRecord.__tablename__]),
        "replaced": not target_empty,
        "purge": purge,
        "search": {"invalidation": invalidation, "reindex": search},
        "archive_registered": registered and path.exists(),
        "archive_retained": path.exists(),
        "complete": True,
    }


__all__ = [
    "FORMAT",
    "REPLACE_CONFIRMATION",
    "VERSION",
    "create_backup",
    "restore_backup",
]
