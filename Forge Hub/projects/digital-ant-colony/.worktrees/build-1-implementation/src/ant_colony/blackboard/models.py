"""Immutable records stored by the blackboard."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from ant_colony.pheromones.models import PheromoneLevels


class TaskKind(StrEnum):
    RESEARCH = "RESEARCH"
    VERIFICATION = "VERIFICATION"
    SYNTHESIS = "SYNTHESIS"


class TaskStatus(StrEnum):
    OPEN = "OPEN"
    CLAIMED = "CLAIMED"
    COMPLETED = "COMPLETED"
    VERIFIED = "VERIFIED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class VerificationVerdict(StrEnum):
    AGREE = "AGREE"
    DISAGREE = "DISAGREE"
    CONTRADICTION = "CONTRADICTION"


class FailureCategory(StrEnum):
    TASK_EXECUTION = "TASK_EXECUTION"
    PROVIDER = "PROVIDER"
    COORDINATION = "COORDINATION"
    CONFIDENCE_VERIFICATION = "CONFIDENCE_VERIFICATION"


@dataclass(frozen=True)
class Goal:
    id: str
    title: str
    description: str
    created_by: str
    created_at: datetime


@dataclass(frozen=True)
class TaskDraft:
    title: str
    description: str
    kind: TaskKind
    priority: int
    required_capabilities: frozenset[str]
    created_by: str
    parent_id: str | None = None
    target_task_id: str | None = None
    confidence: float = 0.0
    pheromones: PheromoneLevels = field(default_factory=PheromoneLevels)
    max_attempts: int = 2
    critical: bool = True
    topic_key: str = ""


@dataclass(frozen=True)
class Task:
    id: str
    parent_id: str | None
    title: str
    description: str
    kind: TaskKind
    status: TaskStatus
    priority: int
    required_capabilities: frozenset[str]
    claimed_by: str | None
    created_by: str
    result_ids: tuple[str, ...]
    confidence: float
    pheromones: PheromoneLevels
    attempt_count: int
    max_attempts: int
    critical: bool
    topic_key: str
    created_sequence: int
    created_at: datetime
    updated_at: datetime
    target_task_id: str | None = None


@dataclass(frozen=True)
class ResultDraft:
    content: str
    evidence_notes: tuple[str, ...]
    confidence: float
    provider_operation: str


@dataclass(frozen=True)
class ResultRecord:
    id: str
    task_id: str
    ant_id: str
    content: str
    evidence_notes: tuple[str, ...]
    confidence: float
    provider_operation: str
    created_at: datetime


@dataclass(frozen=True)
class VerificationDraft:
    verification_task_id: str
    target_task_id: str
    verifier_id: str
    verdict: VerificationVerdict
    confidence_delta: float
    evidence_notes: tuple[str, ...]
    recommend_reopen: bool = False


@dataclass(frozen=True)
class VerificationRecord:
    id: str
    verification_task_id: str
    target_task_id: str
    verifier_id: str
    verdict: VerificationVerdict
    confidence_delta: float
    evidence_notes: tuple[str, ...]
    recommend_reopen: bool
    created_at: datetime


@dataclass(frozen=True)
class FailureRecord:
    category: FailureCategory
    notes: str
    created_at: datetime

