"""Shared ant state, profiles, and bounded local memory."""

from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum

from ant_colony.blackboard.models import TaskKind


class BehaviorProfile(StrEnum):
    EXPLORER = "EXPLORER"
    VERIFIER = "VERIFIER"
    SYNTHESIZER = "SYNTHESIZER"


class AntActivity(StrEnum):
    IDLE = "IDLE"
    OBSERVING = "OBSERVING"
    MOVING_TO_TASK = "MOVING_TO_TASK"
    WORKING = "WORKING"
    VERIFYING = "VERIFYING"
    SYNTHESIZING = "SYNTHESIZING"
    FAILED = "FAILED"


@dataclass(frozen=True)
class ScoringWeights:
    priority: float
    urgency: float
    demand: float
    verification_need: float
    capability_match: float
    duplication_penalty: float


@dataclass(frozen=True)
class AntProfile:
    name: BehaviorProfile
    capabilities: frozenset[str]
    eligible_kinds: frozenset[TaskKind]
    weights: ScoringWeights


@dataclass(frozen=True)
class MemoryEntry:
    task_id: str
    topic_key: str
    outcome: str


class BoundedAntMemory:
    def __init__(self, limit: int = 5) -> None:
        if limit < 1:
            raise ValueError("memory limit must be positive")
        self._entries: deque[MemoryEntry] = deque(maxlen=limit)

    @property
    def entries(self) -> tuple[MemoryEntry, ...]:
        return tuple(self._entries)

    def remember(self, entry: MemoryEntry) -> None:
        self._entries.append(entry)

    def contains_topic(self, topic_key: str) -> bool:
        return any(entry.topic_key == topic_key for entry in self._entries)


@dataclass
class AntState:
    id: str
    profile: AntProfile
    capabilities: frozenset[str]
    memory: BoundedAntMemory
    current_task_id: str | None = None
    activity: AntActivity = AntActivity.IDLE
    target_task_id: str | None = None

