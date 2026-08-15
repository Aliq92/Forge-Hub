"""Inspectable deterministic task scoring."""

from dataclasses import dataclass
from typing import Mapping

from ant_colony.ants.models import AntState
from ant_colony.blackboard.models import Task, TaskStatus


@dataclass(frozen=True)
class ScoreBreakdown:
    priority: float
    urgency: float
    demand: float
    verification_need: float
    capability_match: float
    duplication_penalty: float

    @property
    def total(self) -> float:
        return (
            self.priority
            + self.urgency
            + self.demand
            + self.verification_need
            + self.capability_match
            - self.duplication_penalty
        )


@dataclass(frozen=True)
class ScoredTask:
    task: Task
    breakdown: ScoreBreakdown


def score_task(ant: AntState, task: Task, related_claimed_count: int = 0) -> ScoreBreakdown:
    weights = ant.profile.weights
    if not task.required_capabilities:
        match = 1.0
    else:
        match = len(task.required_capabilities & ant.capabilities) / len(task.required_capabilities)
    recent_duplicate = 1 if ant.memory.contains_topic(task.topic_key) else 0
    return ScoreBreakdown(
        priority=(max(0, min(10, task.priority)) / 10.0) * weights.priority,
        urgency=task.pheromones.urgency * weights.urgency,
        demand=task.pheromones.demand * weights.demand,
        verification_need=task.pheromones.verification * weights.verification_need,
        capability_match=match * weights.capability_match,
        duplication_penalty=(related_claimed_count + recent_duplicate) * weights.duplication_penalty,
    )


def choose_task(
    ant: AntState,
    tasks: tuple[Task, ...],
    related_claimed_counts: Mapping[str, int],
) -> ScoredTask | None:
    scored = [
        ScoredTask(task, score_task(ant, task, related_claimed_counts.get(task.topic_key, 0)))
        for task in tasks
        if task.status is TaskStatus.OPEN
        and task.kind in ant.profile.eligible_kinds
        and task.required_capabilities.issubset(ant.capabilities)
    ]
    if not scored:
        return None
    return min(
        scored,
        key=lambda item: (
            -item.breakdown.total,
            -item.task.priority,
            item.task.created_sequence,
            item.task.id,
        ),
    )

