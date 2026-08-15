"""Build #1 behavior profiles for the shared ant model."""

from ant_colony.ants.models import AntProfile, BehaviorProfile, ScoringWeights
from ant_colony.blackboard.models import TaskKind


def explorer_profile() -> AntProfile:
    return AntProfile(
        BehaviorProfile.EXPLORER,
        frozenset({"analysis", "exploration"}),
        frozenset({TaskKind.RESEARCH}),
        ScoringWeights(1.0, 0.8, 1.2, 0.2, 1.0, 0.5),
    )


def verifier_profile() -> AntProfile:
    return AntProfile(
        BehaviorProfile.VERIFIER,
        frozenset({"verification", "analysis"}),
        frozenset({TaskKind.VERIFICATION}),
        ScoringWeights(0.8, 0.7, 0.8, 1.5, 1.0, 0.5),
    )


def synthesizer_profile() -> AntProfile:
    return AntProfile(
        BehaviorProfile.SYNTHESIZER,
        frozenset({"synthesis", "analysis"}),
        frozenset({TaskKind.SYNTHESIS}),
        ScoringWeights(1.0, 1.0, 0.7, 0.5, 1.2, 0.4),
    )

