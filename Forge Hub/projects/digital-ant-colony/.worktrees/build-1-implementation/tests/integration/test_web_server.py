from pathlib import Path


def test_server_serves_static_index(test_client) -> None:
    response = test_client.get("/")

    assert response.status_code == 200
    assert "Digital Ant Colony" in response.text


def test_server_serves_frontend_modules(test_client) -> None:
    for path in (
        "/static/css/colony.css",
        "/static/js/ants.js",
        "/static/js/colony-layout.js",
        "/static/js/colony-renderer.js",
        "/static/js/colony-state.js",
        "/static/js/tasks.js",
        "/static/js/websocket.js",
        "/static/js/app.js",
    ):
        response = test_client.get(path)
        assert response.status_code == 200
        assert response.text.strip()


def test_server_exposes_current_snapshot(test_client) -> None:
    idle = test_client.get("/api/state").json()
    assert idle["payload"]["colony"]["status"] == "IDLE"

    assert test_client.post("/api/runs").status_code == 202
    running = test_client.get("/api/state").json()

    assert running["schema_version"] == 1
    assert running["message_type"] == "SNAPSHOT"


def test_second_run_is_rejected(test_client) -> None:
    assert test_client.post("/api/runs").status_code == 202
    assert test_client.post("/api/runs").status_code == 409
