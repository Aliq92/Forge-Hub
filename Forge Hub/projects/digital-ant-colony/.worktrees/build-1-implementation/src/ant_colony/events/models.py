"""Structured colony events."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Mapping


class EventType(StrEnum):
    GOAL_CREATED = "GOAL_CREATED"
    TASK_CREATED = "TASK_CREATED"
    ANT_CREATED = "ANT_CREATED"
    ANT_OBSERVED_TASK = "ANT_OBSERVED_TASK"
    ANT_ACTIVITY_CHANGED = "ANT_ACTIVITY_CHANGED"
    TASK_CLAIMED = "TASK_CLAIMED"
    TASK_BLOCKED = "TASK_BLOCKED"
    RESULT_RECORDED = "RESULT_RECORDED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_FAILED = "TASK_FAILED"
    TASK_REOPENED = "TASK_REOPENED"
    TASK_VERIFICATION_STARTED = "TASK_VERIFICATION_STARTED"
    TASK_VERIFIED = "TASK_VERIFIED"
    VERIFICATION_RECORDED = "VERIFICATION_RECORDED"
    CONFIDENCE_CHANGED = "CONFIDENCE_CHANGED"
    PHEROMONE_CHANGED = "PHEROMONE_CHANGED"
    ANT_FAILED = "ANT_FAILED"
    SYNTHESIS_STARTED = "SYNTHESIS_STARTED"
    COLONY_COMPLETED = "COLONY_COMPLETED"
    COLONY_STALLED = "COLONY_STALLED"


EventDetails = Mapping[str, object]


@dataclass(frozen=True)
class DomainEvent:
    id: str
    run_id: str
    sequence: int
    cycle: int
    type: EventType
    actor_id: str | None
    subject_id: str | None
    timestamp: datetime
    details: EventDetails

