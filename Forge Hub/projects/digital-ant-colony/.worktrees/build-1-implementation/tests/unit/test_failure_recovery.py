from datetime import UTC, datetime

from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import FailureCategory, FailureRecord, TaskDraft, TaskKind, TaskStatus
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal


def make_board() -> Blackboard:
    clock = IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC))
    ids = SequentialIdSource()
    return Blackboard("RUN-0001", EventJournal(clock, ids), clock, ids)


def retry_draft() -> TaskDraft:
    return TaskDraft(
        "Retry research",
        "Exercise bounded retry.",
        TaskKind.RESEARCH,
        5,
        frozenset({"analysis"}),
        "SYSTEM",
        max_attempts=2,
        topic_key="retry",
    )


def execution_failure(notes: str) -> FailureRecord:
    return FailureRecord(FailureCategory.TASK_EXECUTION, notes, datetime(2026, 8, 15, tzinfo=UTC))


def test_failed_task_reopens_until_retry_budget_is_exhausted() -> None:
    board = make_board()
    task = board.create_task(retry_draft())
    board.claim_task(task.id, "ANT-01")

    reopened = board.release_after_failure(task.id, "ANT-01", execution_failure("first"))
    board.claim_task(task.id, "ANT-02")
    failed = board.release_after_failure(task.id, "ANT-02", execution_failure("second"))

    assert reopened.status is TaskStatus.OPEN
    assert reopened.claimed_by is None
    assert failed.status is TaskStatus.FAILED
    assert failed.attempt_count == 2
    assert len(board.snapshot().failures_by_task[task.id]) == 2
