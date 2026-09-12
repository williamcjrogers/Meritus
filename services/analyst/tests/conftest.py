import json
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import text

from meritus.db import create_engine_for_url, initialise_database
from meritus.repository import Repository


@pytest.fixture
def now() -> datetime:
    return datetime(2026, 9, 12, 9, 30, tzinfo=UTC)


@pytest.fixture
def engine(tmp_path):
    config_path = os.environ.get("MERITUS_TEST_POSTGRES_CONFIG")
    if config_path:
        config = json.loads(Path(config_path).read_text())
        base = create_engine_for_url(config["url"])
        schema = "meritus_test_" + uuid4().hex
        with base.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = base.execution_options(schema_translate_map={None: schema})
        try:
            initialise_database(engine)
            yield engine
        finally:
            with base.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            base.dispose()
        return
    database_path = tmp_path / "meritus-test.db"
    engine = create_engine_for_url(f"sqlite:///{database_path}")
    initialise_database(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def repo(engine) -> Repository:
    return Repository(engine)
