from ant_colony.web.protocol import BrowserEnvelope, BrowserEventType, BrowserMessageType


def task_claimed_envelope(sequence: int = 2) -> BrowserEnvelope:
    return BrowserEnvelope(
        1,
        BrowserMessageType.EVENT,
        "RUN-0001",
        sequence,
        1,
        BrowserEventType.TASK_CLAIMED,
        {"task_id": "TASK-0004", "ant_id": "ANT-07"},
    )

