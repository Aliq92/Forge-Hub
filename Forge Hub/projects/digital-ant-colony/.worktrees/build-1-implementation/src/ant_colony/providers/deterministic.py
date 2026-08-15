"""Scenario-focused provider used by Forge Build #1."""

from ant_colony.blackboard.models import VerificationVerdict
from ant_colony.providers.base import (
    DecompositionRequest,
    DecompositionResponse,
    ExecutionRequest,
    ExecutionResponse,
    ProviderFailure,
    SynthesisRequest,
    SynthesisResponse,
    TaskProposal,
    VerificationRequest,
    VerificationResponse,
)
from ant_colony.research.models import ResearchScenario


class DeterministicScenarioProvider:
    def __init__(self, scenario: ResearchScenario) -> None:
        self.scenario = scenario

    def decompose(self, request: DecompositionRequest) -> DecompositionResponse:
        if request.goal_text != self.scenario.goal:
            raise ProviderFailure("unknown synthetic goal")
        return DecompositionResponse(
            tuple(
                TaskProposal(task.title, task.description, task.topic_key, task.priority)
                for task in self.scenario.tasks
            )
        )

    def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        findings = self.scenario.findings_by_topic.get(request.topic_key)
        if findings is None:
            raise ProviderFailure(f"unknown scenario topic: {request.topic_key}")
        finding = findings[min(request.attempt_count, len(findings) - 1)]
        return ExecutionResponse(finding.content, finding.evidence_notes, finding.confidence)

    def verify(self, request: VerificationRequest) -> VerificationResponse:
        if request.topic_key not in self.scenario.findings_by_topic:
            raise ProviderFailure(f"unknown verification topic: {request.topic_key}")
        if request.result_content == self.scenario.contradiction_content:
            return VerificationResponse(
                VerificationVerdict.CONTRADICTION,
                -0.35,
                ("Independent fixture contradicts the injected central-control claim.",),
                True,
            )
        return VerificationResponse(
            VerificationVerdict.AGREE,
            0.1,
            ("Independent fixture agrees with the finding.",),
            False,
        )

    def synthesize(self, request: SynthesisRequest) -> SynthesisResponse:
        if request.goal_text != self.scenario.goal:
            raise ProviderFailure("unknown synthesis goal")
        sorted(request.findings, key=lambda finding: (finding.topic_key, finding.content))
        answer = self.scenario.final_answer
        return SynthesisResponse(answer.content, answer.confidence, answer.evidence_notes)

