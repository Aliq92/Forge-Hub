"""Pure completion, progress, and stall predicates."""

from ant_colony.blackboard.board import BlackboardSnapshot
from ant_colony.blackboard.models import TaskKind, TaskStatus
from ant_colony.colony.models import CompletionAssessment, StallAssessment
from ant_colony.events.models import DomainEvent, EventType


PROGRESS_EVENTS = frozenset(
    {
        EventType.TASK_CREATED,
        EventType.TASK_CLAIMED,
        EventType.TASK_COMPLETED,
        EventType.TASK_VERIFIED,
        EventType.TASK_REOPENED,
        EventType.TASK_FAILED,
        EventType.CONFIDENCE_CHANGED,
        EventType.SYNTHESIS_STARTED,
    }
)


def assess_completion(
    snapshot: BlackboardSnapshot,
    minimum_confidence: float,
) -> CompletionAssessment:
    reasons: list[str] = []
    critical_research = [
        task for task in snapshot.tasks if task.kind is TaskKind.RESEARCH and task.critical
    ]
    active_or_failed = [
        task
        for task in critical_research
        if task.status in {TaskStatus.OPEN, TaskStatus.CLAIMED, TaskStatus.BLOCKED, TaskStatus.FAILED}
    ]
    if active_or_failed:
        reasons.append("critical research remains")
    if any(task.status is not TaskStatus.VERIFIED for task in critical_research):
        reasons.append("required verification is incomplete")

    synthesis = next(
        (
            task
            for task in snapshot.tasks
            if task.kind is TaskKind.SYNTHESIS and task.status is TaskStatus.COMPLETED
        ),
        None,
    )
    if synthesis is None or not synthesis.result_ids:
        reasons.append("synthesis is incomplete")
        return CompletionAssessment(False, tuple(reasons))

    result_by_id = {result.id: result for result in snapshot.results}
    final_result = result_by_id[synthesis.result_ids[-1]]
    if final_result.confidence < minimum_confidence:
        reasons.append("final confidence is below minimum")
    return CompletionAssessment(
        complete=not reasons,
        reasons=tuple(reasons),
        final_result_id=final_result.id,
        final_confidence=final_result.confidence,
    )


def cycle_made_progress(events: tuple[DomainEvent, ...]) -> bool:
    return any(event.type in PROGRESS_EVENTS for event in events)


def assess_stall(
    snapshot: BlackboardSnapshot,
    no_progress_cycles: int,
    configured_limit: int,
    cycle: int,
    maximum_cycles: int,
) -> StallAssessment:
    if cycle >= maximum_cycles:
        return StallAssessment(True, f"maximum cycle limit {maximum_cycles} reached")
    if no_progress_cycles < configured_limit:
        return StallAssessment(False)
    viable = any(task.status in {TaskStatus.OPEN, TaskStatus.CLAIMED} for task in snapshot.tasks)
    if viable:
        return StallAssessment(False)
    return StallAssessment(
        True,
        f"no viable work after {no_progress_cycles} no-progress cycles",
    )

