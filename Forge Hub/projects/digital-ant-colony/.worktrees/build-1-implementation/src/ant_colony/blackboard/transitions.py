"""Legal task lifecycle transitions."""

from dataclasses import replace
from datetime import datetime

from ant_colony.blackboard.models import Task, TaskStatus


class InvalidTaskTransition(ValueError):
    pass


ALLOWED_TRANSITIONS: dict[TaskStatus, frozenset[TaskStatus]] = {
    TaskStatus.OPEN: frozenset({TaskStatus.CLAIMED}),
    TaskStatus.CLAIMED: frozenset(
        {TaskStatus.COMPLETED, TaskStatus.OPEN, TaskStatus.BLOCKED, TaskStatus.FAILED}
    ),
    TaskStatus.COMPLETED: frozenset({TaskStatus.VERIFIED, TaskStatus.OPEN}),
    TaskStatus.BLOCKED: frozenset({TaskStatus.OPEN}),
    TaskStatus.VERIFIED: frozenset(),
    TaskStatus.FAILED: frozenset(),
}


def transition_task(task: Task, new_status: TaskStatus, *, updated_at: datetime) -> Task:
    if new_status not in ALLOWED_TRANSITIONS[task.status]:
        raise InvalidTaskTransition(f"cannot transition {task.status} to {new_status}")
    return replace(task, status=new_status, updated_at=updated_at)

