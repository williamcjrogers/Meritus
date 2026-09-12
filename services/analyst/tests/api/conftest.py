from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from meritus.config import Settings
from meritus.repository import Repository


@pytest.fixture
def api_settings(engine, tmp_path: Path) -> Settings:
    return Settings(
        database_url=str(engine.url),
        data_dir=tmp_path / "managed",
        opensearch_url="http://127.0.0.1:1",
        api_allowed_hosts=["testserver", "localhost", "127.0.0.1"],
        api_allowed_origins=["http://testserver", "http://localhost"],
    )


@pytest.fixture
def client(engine, api_settings: Settings):
    from meritus.api import create_app

    with TestClient(create_app(settings=api_settings, repository=Repository(engine))) as value:
        yield value


@pytest.fixture
def authenticated(client: TestClient) -> tuple[TestClient, str]:
    response = client.post(
        "/api/auth/setup",
        json={"username": "analyst", "password": "a-long-test-password"},
        headers={"Origin": "http://testserver"},
    )
    assert response.status_code == 200
    return client, response.json()["csrf_token"]
