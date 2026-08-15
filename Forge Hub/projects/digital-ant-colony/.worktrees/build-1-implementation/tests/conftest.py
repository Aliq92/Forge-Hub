import pytest
from fastapi.testclient import TestClient

from ant_colony.web.controller import RunController
from ant_colony.web.server import create_app


@pytest.fixture
def run_controller() -> RunController:
    return RunController(display_delay=0.01)


@pytest.fixture
def test_client(run_controller: RunController):
    with TestClient(create_app(run_controller)) as client:
        yield client
