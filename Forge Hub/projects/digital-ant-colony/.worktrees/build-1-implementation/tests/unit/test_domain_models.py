from datetime import UTC, datetime

import pytest

from ant_colony.blackboard.models import Task, TaskKind, TaskStatus
from ant_colony.blackboard.transitions import InvalidTaskTransition, transition_task
from ant_colony.pheromones.models import PheromoneLevels
from ant_colony.pheromones.rules import decay, reinforce


NOW = datetime(2026, 8, 15, tzinfo=UTC)


def make_task(status: TaskStatus) -> Task:
    return Task(
        id="TASK-0001",
        parent_id=None,
        title="Compare coordination approaches",
        description="Collect deterministic evidence.",
        kind=TaskKind.RESEARCH,
        status=status,
        priority=5,
        required_capabilities=frozenset({"analysis"}),
        claimed_by=None,
        created_by="SYSTEM",
        result_ids=(),
        confidence=0.4,
        pheromones=PheromoneLevels(),
        attempt_count=0,
        max_attempts=2,
        critical=True,
        topic_key="coordination",
        created_sequence=1,
        created_at=NOW,
        updated_at=NOW,
    )


def test_pheromone_values_are_clamped_and_decay() -> None:
    levels = PheromoneLevels(urgency=1.2, confidence=-0.1, demand=0.8, verification=0.5)

    assert levels == PheromoneLevels(urgency=1.0, confidence=0.0, demand=0.8, verification=0.5)
    assert decay(levels, factor=0.5) == PheromoneLevels(0.5, 0.0, 0.4, 0.25)


def test_reinforcement_is_named_and_clamped() -> None:
    levels = PheromoneLevels(demand=0.8)

    assert reinforce(levels, demand=0.3, urgency=0.2) == PheromoneLevels(
        urgency=0.2,
        confidence=0.0,
        demand=1.0,
        verification=0.0,
    )


def test_transition_rejects_completed_to_claimed() -> None:
    task = make_task(TaskStatus.COMPLETED)

    with pytest.raises(InvalidTaskTransition):
        transition_task(task, TaskStatus.CLAIMED, updated_at=NOW)


def test_transition_returns_new_immutable_task() -> None:
    task = make_task(TaskStatus.OPEN)

    claimed = transition_task(task, TaskStatus.CLAIMED, updated_at=NOW)

    assert claimed.status is TaskStatus.CLAIMED
    assert task.status is TaskStatus.OPEN
