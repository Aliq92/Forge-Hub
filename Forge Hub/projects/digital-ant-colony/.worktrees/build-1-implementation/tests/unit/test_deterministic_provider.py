import pytest

from ant_colony.blackboard.models import VerificationVerdict
from ant_colony.providers.base import (
    DecompositionRequest,
    ExecutionRequest,
    ProviderFailure,
    SynthesisFinding,
    SynthesisRequest,
)
from ant_colony.providers.deterministic import DeterministicScenarioProvider
from ant_colony.research.scenario import build_synthetic_scenario
from tests.fixtures.synthetic_scenario import configured_contradiction_request


def test_deterministic_provider_decomposes_same_request_identically() -> None:
    provider = DeterministicScenarioProvider(build_synthetic_scenario())
    request = DecompositionRequest("GOAL-0001", provider.scenario.goal)

    first = provider.decompose(request)
    second = provider.decompose(request)

    assert first == second
    assert len(first.tasks) == 4
    assert tuple(task.topic_key for task in first.tasks) == (
        "local-signals",
        "central-control",
        "verification-loops",
        "scale-behavior",
    )


def test_verification_detects_configured_contradiction() -> None:
    provider = DeterministicScenarioProvider(build_synthetic_scenario())

    response = provider.verify(configured_contradiction_request())

    assert response.verdict is VerificationVerdict.CONTRADICTION
    assert response.recommend_reopen is True
    assert response.confidence_delta == -0.35


def test_execution_retry_returns_corrected_finding() -> None:
    provider = DeterministicScenarioProvider(build_synthetic_scenario())

    first = provider.execute(ExecutionRequest("TASK-0002", "central-control", "Central", 0))
    second = provider.execute(ExecutionRequest("TASK-0002", "central-control", "Central", 1))

    assert first.content != second.content
    assert second.confidence > first.confidence


def test_synthesis_is_independent_of_input_order() -> None:
    provider = DeterministicScenarioProvider(build_synthetic_scenario())
    findings = (
        SynthesisFinding("verification-loops", "B", 0.85),
        SynthesisFinding("local-signals", "A", 0.8),
    )

    forward = provider.synthesize(SynthesisRequest(provider.scenario.goal, findings))
    reverse = provider.synthesize(SynthesisRequest(provider.scenario.goal, tuple(reversed(findings))))

    assert forward == reverse
    assert forward.confidence == 0.86


def test_unknown_scenario_topic_raises_typed_failure() -> None:
    provider = DeterministicScenarioProvider(build_synthetic_scenario())

    with pytest.raises(ProviderFailure):
        provider.execute(ExecutionRequest("TASK-9999", "unknown", "Unknown", 0))
