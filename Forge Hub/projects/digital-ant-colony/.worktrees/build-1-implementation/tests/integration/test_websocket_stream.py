import asyncio

from ant_colony.colony.models import ColonyStatus
from ant_colony.web.protocol import (
    BrowserEnvelope,
    BrowserEventType,
    BrowserMessageType,
)
from ant_colony.web.websocket import ObserverHub


def test_websocket_receives_snapshot_then_real_colony_event(test_client) -> None:
    assert test_client.post("/api/runs").status_code == 202
    with test_client.websocket_connect("/ws") as socket:
        snapshot = socket.receive_json()
        event = socket.receive_json()

    assert snapshot["message_type"] == "SNAPSHOT"
    assert event["message_type"] == "EVENT"
    assert event["sequence"] == snapshot["sequence"] + 1


def test_queue_overflow_requests_fresh_snapshot() -> None:
    hub = ObserverHub(queue_size=1)
    subscriber_id, queue = hub.subscribe()
    first = BrowserEnvelope(
        1,
        BrowserMessageType.EVENT,
        "RUN-0001",
        1,
        1,
        BrowserEventType.TASK_CREATED,
        {"task": {"id": "TASK-0001"}},
    )
    second = BrowserEnvelope(
        1,
        BrowserMessageType.EVENT,
        "RUN-0001",
        2,
        1,
        BrowserEventType.TASK_CLAIMED,
        {"task_id": "TASK-0001", "ant_id": "ANT-01"},
    )

    hub.publish(first)
    hub.publish(second)

    replacement = queue.get_nowait()
    assert replacement.event_type is BrowserEventType.RESNAPSHOT_REQUIRED
    hub.unsubscribe(subscriber_id)
    assert hub.subscriber_count == 0


def test_no_observers_does_not_stop_colony(run_controller) -> None:
    async def run_colony():
        await run_controller.start()
        await run_controller.wait()

    asyncio.run(run_colony())

    assert run_controller.current_engine is not None
    assert run_controller.current_engine.status is ColonyStatus.COMPLETED
