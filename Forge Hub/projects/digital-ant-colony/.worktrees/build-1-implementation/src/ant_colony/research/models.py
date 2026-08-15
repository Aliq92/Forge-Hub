"""Synthetic research scenario and final-answer records."""

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ScenarioTask:
    title: str
    description: str
    topic_key: str
    priority: int


@dataclass(frozen=True)
class ScenarioFinding:
    topic_key: str
    content: str
    evidence_notes: tuple[str, ...]
    confidence: float


@dataclass(frozen=True)
class FinalAnswer:
    content: str
    confidence: float
    evidence_notes: tuple[str, ...]


@dataclass(frozen=True)
class ResearchScenario:
    title: str
    goal: str
    tasks: tuple[ScenarioTask, ...]
    findings_by_topic: Mapping[str, tuple[ScenarioFinding, ...]]
    contradiction_content: str
    final_answer: FinalAnswer

