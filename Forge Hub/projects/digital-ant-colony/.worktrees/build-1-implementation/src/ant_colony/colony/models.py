"""Colony configuration and run outcomes."""

from dataclasses import dataclass
from enum import StrEnum

from ant_colony.events.models import DomainEvent
from ant_colony.research.models import FinalAnswer


class ColonyStatus(StrEnum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    STALLED = "STALLED"


@dataclass(frozen=True)
class ColonyConfig:
    ant_count: int = 10
    minimum_confidence: float = 0.75
    pheromone_decay_factor: float = 0.9
    no_progress_cycle_limit: int = 5
    maximum_cycles: int = 100


@dataclass(frozen=True)
class CompletionAssessment:
    complete: bool
    reasons: tuple[str, ...]
    final_result_id: str | None = None
    final_confidence: float | None = None


@dataclass(frozen=True)
class StallAssessment:
    stalled: bool
    reason: str | None = None


@dataclass(frozen=True)
class CycleOutcome:
    cycle: int
    ant_turn_order: tuple[str, ...]
    made_progress: bool
    status: ColonyStatus
    events: tuple[DomainEvent, ...]


@dataclass(frozen=True)
class ColonyRunResult:
    status: ColonyStatus
    cycles: int
    final_answer: FinalAnswer | None
    final_confidence: float | None
    event_trace: tuple[DomainEvent, ...]

