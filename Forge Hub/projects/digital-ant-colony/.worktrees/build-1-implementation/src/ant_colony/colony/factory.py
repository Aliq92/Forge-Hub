"""Composition root for the deterministic Build #1 colony."""

from datetime import UTC, datetime

from ant_colony.ants.ant import Ant
from ant_colony.ants.models import AntState, BoundedAntMemory
from ant_colony.ants.profiles import explorer_profile, synthesizer_profile, verifier_profile
from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import TaskDraft, TaskKind
from ant_colony.colony.engine import ColonyEngine
from ant_colony.colony.models import ColonyConfig
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal
from ant_colony.events.models import EventType
from ant_colony.pheromones.models import PheromoneLevels
from ant_colony.providers.deterministic import DeterministicScenarioProvider
from ant_colony.research.scenario import build_synthetic_scenario


def build_deterministic_colony(
    ant_count: int = 10,
    config: ColonyConfig | None = None,
) -> ColonyEngine:
    if not 1 <= ant_count <= 30:
        raise ValueError("ant_count must be between 1 and 30")
    config = config or ColonyConfig(ant_count=ant_count)
    clock = IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC))
    ids = SequentialIdSource()
    run_id = ids.next("RUN")
    journal = EventJournal(clock, ids)
    board = Blackboard(run_id, journal, clock, ids)
    scenario = build_synthetic_scenario()
    goal = board.create_goal(scenario.title, scenario.goal, "SYSTEM")
    board.create_task(
        TaskDraft(
            title="Decompose research goal",
            description=scenario.goal,
            kind=TaskKind.RESEARCH,
            priority=10,
            required_capabilities=frozenset({"analysis"}),
            created_by="SYSTEM",
            pheromones=PheromoneLevels(urgency=1.0, demand=1.0),
            critical=False,
            topic_key="decompose",
        )
    )
    ants: list[Ant] = []
    for index in range(1, ant_count + 1):
        if index <= max(1, ant_count - 4):
            profile = explorer_profile()
        elif index < ant_count:
            profile = verifier_profile()
        else:
            profile = synthesizer_profile()
        ant_id = f"ANT-{index:02d}"
        ant = Ant(AntState(ant_id, profile, profile.capabilities, BoundedAntMemory()))
        ants.append(ant)
        journal.append(
            run_id,
            0,
            EventType.ANT_CREATED,
            ant_id,
            ant_id,
            {"profile": profile.name.value},
        )
    return ColonyEngine(
        board,
        tuple(ants),
        DeterministicScenarioProvider(scenario),
        goal.id,
        goal.description,
        config,
    )

