from datetime import UTC, datetime, timedelta

from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal
from ant_colony.events.models import EventType


BASE_TIME = datetime(2026, 8, 15, tzinfo=UTC)


def test_journal_assigns_stable_ids_sequences_and_times() -> None:
    journal = EventJournal(IncrementingClock(BASE_TIME), SequentialIdSource())

    first = journal.append(
        "RUN-0001", 0, EventType.TASK_CREATED, "ANT-01", "TASK-0001", {"parent_id": None}
    )
    second = journal.append(
        "RUN-0001", 1, EventType.TASK_CLAIMED, "ANT-01", "TASK-0001", {}
    )

    assert (first.id, first.sequence) == ("EVENT-0001", 1)
    assert (second.id, second.sequence) == ("EVENT-0002", 2)
    assert second.timestamp - first.timestamp == timedelta(microseconds=1)
    assert journal.after(1) == (second,)


def test_journal_exposes_immutable_event_details() -> None:
    journal = EventJournal(IncrementingClock(BASE_TIME), SequentialIdSource())
    details = {"status": "OPEN"}

    event = journal.append("RUN-0001", 0, EventType.TASK_CREATED, None, "TASK-0001", details)
    details["status"] = "CLAIMED"

    assert event.details["status"] == "OPEN"
    assert journal.events == (event,)
