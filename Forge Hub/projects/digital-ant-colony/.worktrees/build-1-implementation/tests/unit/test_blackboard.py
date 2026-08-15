from datetime import UTC, datetime

import pytest

from ant_colony.blackboard.board import Blackboard, ParentTaskError
from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import ResultDraft, TaskDraft, TaskKind, TaskStatus
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal


@pytest.fixture
def board() -> Blackboard:
    clock = IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC))
    ids = SequentialIdSource()
    return Blackboard("RUN-0001", EventJournal(clock, ids), clock, ids)


def research_draft(
    title: str,
    *,
    parent_id: str | None = None,
    max_attempts: int = 2,
) -> TaskDraft:
    return TaskDraft(
        title=title,
        description=f"Research {title.lower()}.",
        kind=TaskKind.RESEARCH,
        priority=5,
        required_capabilities=frozenset({"analysis"}),
        created_by="SYSTEM",
        parent_id=parent_id,
        max_attempts=max_attempts,
        topic_key=title.lower().replace(" ", "-"),
    )


def test_only_one_ant_can_claim_an_open_task(board: Blackboard) -> None:
    task = board.create_task(research_draft("Compare approaches"))

    first = board.claim_task(task.id, "ANT-01")
    second = board.claim_task(task.id, "ANT-02")

    assert first.claimed is True
    assert second.claimed is False
    assert board.task(task.id).claimed_by == "ANT-01"


def test_child_task_preserves_parent_relationship(board: Blackboard) -> None:
    parent = board.create_task(research_draft("Root research"))
    child = board.create_task(research_draft("Gather evidence", parent_id=parent.id))

    assert child.parent_id == parent.id
    assert board.snapshot().child_ids_by_parent[parent.id] == (child.id,)


def test_invalid_parent_is_rejected_without_creating_task(board: Blackboard) -> None:
    with pytest.raises(ParentTaskError):
        board.create_task(research_draft("Orphan", parent_id="TASK-9999"))

    assert board.snapshot().tasks == ()


def test_result_history_is_separate_and_immutable(board: Blackboard) -> None:
    task = board.create_task(research_draft("Collect evidence"))
    board.claim_task(task.id, "ANT-01")
    result = board.add_result(
        task.id,
        "ANT-01",
        ResultDraft("Finding A", ("fixture:a",), 0.7, "execute"),
    )

    completed = board.complete_task(task.id, "ANT-01", result.id)
    snapshot = board.snapshot()

    assert completed.status is TaskStatus.COMPLETED
    assert completed.result_ids == (result.id,)
    assert snapshot.results == (result,)
    assert isinstance(snapshot.tasks, tuple)
