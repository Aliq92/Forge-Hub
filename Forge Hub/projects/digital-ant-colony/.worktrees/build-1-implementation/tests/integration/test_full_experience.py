import time

from fastapi.testclient import TestClient

from ant_colony.colony.factory import build_deterministic_colony
from ant_colony.web.controller import RunController
from ant_colony.web.server import create_app


def test_browser_run_reaches_same_final_synthesis_as_headless_run() -> None:
    headless = build_deterministic_colony().run_until_terminal()
    controller = RunController(display_delay=0)

    with TestClient(create_app(controller)) as client:
        assert client.post("/api/runs").status_code == 202
        deadline = time.monotonic() + 2
        while True:
            snapshot = client.get("/api/state").json()
            if snapshot["payload"]["colony"]["status"] != "RUNNING":
                break
            assert time.monotonic() < deadline, "browser-started colony did not terminate"
            time.sleep(0.01)

    colony = snapshot["payload"]["colony"]
    assert colony["status"] == "COMPLETED"
    assert colony["final_result"]["content"] == headless.final_answer.content
    assert colony["final_result"]["confidence"] == headless.final_confidence
    assert any(item["status"] == "VERIFIED" for item in snapshot["payload"]["tasks"])
    assert snapshot["payload"]["verifications"]
