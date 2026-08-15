"""Simple deterministic pheromone reinforcement and decay."""

from ant_colony.pheromones.models import PheromoneLevels


def reinforce(
    levels: PheromoneLevels,
    *,
    urgency: float = 0.0,
    confidence: float = 0.0,
    demand: float = 0.0,
    verification: float = 0.0,
) -> PheromoneLevels:
    return PheromoneLevels(
        urgency=levels.urgency + urgency,
        confidence=levels.confidence + confidence,
        demand=levels.demand + demand,
        verification=levels.verification + verification,
    )


def decay(levels: PheromoneLevels, factor: float) -> PheromoneLevels:
    if not 0.0 <= factor <= 1.0:
        raise ValueError("decay factor must be between 0.0 and 1.0")
    return PheromoneLevels(
        urgency=levels.urgency * factor,
        confidence=levels.confidence * factor,
        demand=levels.demand * factor,
        verification=levels.verification * factor,
    )

