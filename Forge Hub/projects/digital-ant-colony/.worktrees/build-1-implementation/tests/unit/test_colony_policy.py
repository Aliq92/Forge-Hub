from dataclasses import replace
from datetime import UTC, datetime
from types import MappingProxyType

from ant_colony.blackboard.board import BlackboardSnapshot
from ant_colony.blackboard.models import ResultRecord, Task, TaskKind, TaskStatus
from ant_colony.colony.policy import assess_completion, assess_stall
from ant_colony.pheromones.models import PheromoneLevels


NOW = datetime(2026, 8, 15, tzinfo=UTC)


def task(task_id: str, kind: TaskKind, status: TaskStatus, *, confidence: float = 0.8) -> Task:
    return Task(
        task_id,
        None,
        task_id,
        "Policy fixture",
        kind,
        status,
        8,
        frozenset(),
        None,
        "SYSTEM",
        ("RESULT-0001",) if kind is TaskKind.SYNTHESIS and status is TaskStatus.COMPLETED else (),
        confidence,
        PheromoneLevels(),
        0,
        2,
        True,
        task_id.lower(),
        int(task_id.split("-")[-1]),
        NOW,
        NOW,
    )


def snapshot(*tasks: Task, final_confidence: float = 0.8) -> BlackboardSnapshot:
    results = ()
    if any(item.kind is TaskKind.SYNTHESIS and item.status is TaskStatus.COMPLETED for item in tasks):
        results = (
            ResultRecord(
                "RESULT-0001",
                next(item.id for item in tasks if item.kind is TaskKind.SYNTHESIS),
                "ANT-10",
                "Final answer",
                ("verified findings",),
                final_confidence,
                "synthesize",
                NOW,
            ),
        )
    return BlackboardSnapshot(
        (),
        tuple(tasks),
        results,
        (),
        MappingProxyType({}),
        MappingProxyType({}),
    )


def test_completed_research_without_verification_cannot_finalize() -> None:
    state = snapshot(
        task("TASK-0001", TaskKind.RESEARCH, TaskStatus.COMPLETED),
        task("TASK-0002", TaskKind.SYNTHESIS, TaskStatus.COMPLETED),
    )

    assessment = assess_completion(state, minimum_confidence=0.75)

    assert assessment.complete is False
    assert "required verification is incomplete" in assessment.reasons


def test_verified_research_and_confident_synthesis_can_finalize() -> None:
    state = snapshot(
        task("TASK-0001", TaskKind.RESEARCH, TaskStatus.VERIFIED),
        task("TASK-0002", TaskKind.SYNTHESIS, TaskStatus.COMPLETED),
        final_confidence=0.86,
    )

    assessment = assess_completion(state, minimum_confidence=0.75)

    assert assessment.complete is True
    assert assessment.final_confidence == 0.86


def test_low_confidence_synthesis_cannot_finalize() -> None:
    state = snapshot(
        task("TASK-0001", TaskKind.RESEARCH, TaskStatus.VERIFIED),
        task("TASK-0002", TaskKind.SYNTHESIS, TaskStatus.COMPLETED),
        final_confidence=0.6,
    )

    assert assess_completion(state, minimum_confidence=0.75).complete is False


def test_colony_stalls_only_without_progress_or_recovery() -> None:
    state = snapshot(task("TASK-0001", TaskKind.RESEARCH, TaskStatus.BLOCKED))

    stalled = assess_stall(
        state,
        no_progress_cycles=5,
        configured_limit=5,
        cycle=20,
        maximum_cycles=100,
    )

    assert stalled.stalled is True
    assert stalled.reason == "no viable work after 5 no-progress cycles"


def test_open_work_prevents_no_progress_stall() -> None:
    state = snapshot(task("TASK-0001", TaskKind.RESEARCH, TaskStatus.OPEN))

    assert not assess_stall(state, 5, 5, 20, 100).stalled


def test_maximum_cycle_guard_has_distinct_reason() -> None:
    state = snapshot(task("TASK-0001", TaskKind.RESEARCH, TaskStatus.OPEN))

    stalled = assess_stall(state, 0, 5, 100, 100)

    assert stalled.stalled is True
    assert stalled.reason == "maximum cycle limit 100 reached"
