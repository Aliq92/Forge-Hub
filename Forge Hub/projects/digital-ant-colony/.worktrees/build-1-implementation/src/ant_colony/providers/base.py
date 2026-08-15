"""Provider-neutral typed research operations."""

from dataclasses import dataclass
from typing import Protocol

from ant_colony.blackboard.models import VerificationVerdict


class ProviderFailure(RuntimeError):
    pass


@dataclass(frozen=True)
class TaskProposal:
    title: str
    description: str
    topic_key: str
    priority: int


@dataclass(frozen=True)
class DecompositionRequest:
    goal_id: str
    goal_text: str


@dataclass(frozen=True)
class DecompositionResponse:
    tasks: tuple[TaskProposal, ...]


@dataclass(frozen=True)
class ExecutionRequest:
    task_id: str
    topic_key: str
    title: str
    attempt_count: int


@dataclass(frozen=True)
class ExecutionResponse:
    content: str
    evidence_notes: tuple[str, ...]
    confidence: float


@dataclass(frozen=True)
class VerificationRequest:
    verification_task_id: str
    target_task_id: str
    topic_key: str
    result_content: str


@dataclass(frozen=True)
class VerificationResponse:
    verdict: VerificationVerdict
    confidence_delta: float
    evidence_notes: tuple[str, ...]
    recommend_reopen: bool


@dataclass(frozen=True)
class SynthesisFinding:
    topic_key: str
    content: str
    confidence: float


@dataclass(frozen=True)
class SynthesisRequest:
    goal_text: str
    findings: tuple[SynthesisFinding, ...]


@dataclass(frozen=True)
class SynthesisResponse:
    content: str
    confidence: float
    evidence_notes: tuple[str, ...]


class WorkProvider(Protocol):
    def decompose(self, request: DecompositionRequest) -> DecompositionResponse:
        """Create stable research task proposals."""

    def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Perform one deterministic research task."""

    def verify(self, request: VerificationRequest) -> VerificationResponse:
        """Independently judge one result."""

    def synthesize(self, request: SynthesisRequest) -> SynthesisResponse:
        """Combine verified findings into a final answer."""

