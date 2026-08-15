"""The fixed Forge Build #1 research scenario."""

from types import MappingProxyType

from ant_colony.research.models import FinalAnswer, ResearchScenario, ScenarioFinding, ScenarioTask


CONTRADICTORY_CLAIM = (
    "Central assignment remains the most resilient pattern even when the manager becomes unavailable."
)


def build_synthetic_scenario() -> ResearchScenario:
    tasks = (
        ScenarioTask("Evaluate local signals", "Assess coordination through shared signals.", "local-signals", 8),
        ScenarioTask("Evaluate central control", "Compare centralized assignment failure modes.", "central-control", 7),
        ScenarioTask("Evaluate verification loops", "Measure independent correction behavior.", "verification-loops", 9),
        ScenarioTask("Evaluate scale behavior", "Assess coordination as worker count grows.", "scale-behavior", 6),
    )
    findings = {
        "local-signals": (
            ScenarioFinding(
                "local-signals",
                "Shared demand and urgency signals recruit workers without direct assignment.",
                ("Synthetic trial LS-1",),
                0.78,
            ),
        ),
        "central-control": (
            ScenarioFinding(
                "central-control",
                CONTRADICTORY_CLAIM,
                ("Synthetic trial CC-1 contains an injected contradiction",),
                0.58,
            ),
            ScenarioFinding(
                "central-control",
                "Central assignment is efficient while healthy but creates a single coordination failure point.",
                ("Synthetic corrected trial CC-2",),
                0.82,
            ),
        ),
        "verification-loops": (
            ScenarioFinding(
                "verification-loops",
                "Independent verification detects contradictions and supports targeted reopening.",
                ("Synthetic trial VL-1",),
                0.84,
            ),
        ),
        "scale-behavior": (
            ScenarioFinding(
                "scale-behavior",
                "Duplication penalties and demand signals keep additional workers focused on unmet work.",
                ("Synthetic trial SB-1",),
                0.76,
            ),
        ),
    }
    return ResearchScenario(
        title="Coordination under contradictory findings",
        goal="Which coordination pattern resolves contradictory findings most reliably?",
        tasks=tasks,
        findings_by_topic=MappingProxyType(findings),
        contradiction_content=CONTRADICTORY_CLAIM,
        final_answer=FinalAnswer(
            "Shared signals combined with independent verification best balance autonomous recruitment, resilience, and correction of contradictory findings.",
            0.86,
            ("Four deterministic research branches", "One contradiction detected and corrected"),
        ),
    )

