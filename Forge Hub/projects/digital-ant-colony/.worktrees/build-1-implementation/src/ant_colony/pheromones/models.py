"""Typed pheromone values used by tasks and scoring."""

from dataclasses import dataclass


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


@dataclass(frozen=True)
class PheromoneLevels:
    urgency: float = 0.0
    confidence: float = 0.0
    demand: float = 0.0
    verification: float = 0.0

    def __post_init__(self) -> None:
        for name in ("urgency", "confidence", "demand", "verification"):
            object.__setattr__(self, name, _clamp(getattr(self, name)))

