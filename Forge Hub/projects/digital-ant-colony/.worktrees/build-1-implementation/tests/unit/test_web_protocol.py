import json
from datetime import UTC, datetime

from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal
from ant_colony.events.models import EventType
from ant_colony.web.protocol import BrowserEventType, EventMapper


def test_task_claim_maps_to_versioned_browser_event() -> None:
    journal = EventJournal(
        IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC)),
        SequentialIdSource(),
    )
    event = journal.append(
        "RUN-0001",
        3,
        EventType.TASK_CLAIMED,
        "ANT-07",
        "TASK-0004",
        {"ant_id": "ANT-07"},
    )

    envelope = EventMapper().map(event)

    assert envelope.schema_version == 1
    assert envelope.event_type is BrowserEventType.TASK_CLAIMED
    assert envelope.payload == {"task_id": "TASK-0004", "ant_id": "ANT-07"}
    assert json.loads(json.dumps(envelope.to_dict()))["event_type"] == "TASK_CLAIMED"


def test_all_domain_events_map_without_sequence_gaps() -> None:
    mapper = EventMapper()
    journal = EventJournal(
        IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC)),
        SequentialIdSource(),
    )

    details_by_type = {
        EventType.TASK_CREATED: {"task": {"id": "TASK-0001", "status": "OPEN"}},
        EventType.RESULT_RECORDED: {"result": {"id": "RESULT-0001", "task_id": "TASK-0001"}},
        EventType.ANT_CREATED: {"profile": "EXPLORER"},
        EventType.ANT_ACTIVITY_CHANGED: {"activity": "IDLE", "target_task_id": None},
    }
    envelopes = tuple(
        mapper.map(
            journal.append(
                "RUN-0001",
                1,
                event_type,
                "ANT-01",
                "TASK-0001",
                details_by_type.get(event_type, {}),
            )
        )
        for event_type in EventType
    )

    assert tuple(envelope.sequence for envelope in envelopes) == tuple(range(1, len(EventType) + 1))
    assert all(envelope.event_type is not None for envelope in envelopes)
