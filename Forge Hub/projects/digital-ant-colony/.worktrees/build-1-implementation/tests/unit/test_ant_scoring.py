from dataclasses import replace
from datetime import UTC, datetime

from ant_colony.ants.models import AntState, BehaviorProfile, BoundedAntMemory, MemoryEntry
from ant_colony.ants.profiles import explorer_profile, synthesizer_profile, verifier_profile
from ant_colony.ants.scoring import choose_task
from ant_colony.blackboard.models import Task, TaskKind, TaskStatus
from ant_colony.pheromones.models import PheromoneLevels


NOW = datetime(2026, 8, 15, tzinfo=UTC)


def explorer_state(ant_id: str = "ANT-01") -> AntState:
    profile = explorer_profile()
    return AntState(ant_id, profile, profile.capabilities, BoundedAntMemory(limit=2))


def task(
    task_id: str,
    *,
    priority: int = 5,
    demand: float = 0.0,
    kind: TaskKind = TaskKind.RESEARCH,
    required: frozenset[str] = frozenset({"analysis"}),
    topic_key: str = "topic",
    created_sequence: int = 1,
) -> Task:
    return Task(
        task_id,
        None,
        task_id,
        "Scoring fixture",
        kind,
        TaskStatus.OPEN,
        priority,
        required,
        None,
        "SYSTEM",
        (),
        0.0,
        PheromoneLevels(demand=demand, verification=0.9 if kind is TaskKind.VERIFICATION else 0.0),
        0,
        2,
        True,
        topic_key,
        created_sequence,
        NOW,
        NOW,
    )


def test_explorer_chooses_high_demand_capability_match() -> None:
    ant = explorer_state()
    weak = task("TASK-0001", demand=0.2, created_sequence=1)
    strong = task("TASK-0002", demand=0.9, created_sequence=2)

    chosen = choose_task(ant, (weak, strong), related_claimed_counts={})

    assert chosen is not None
    assert chosen.task.id == "TASK-0002"
    assert chosen.breakdown.demand > 0
    assert chosen.breakdown.capability_match > 0


def test_duplication_penalty_changes_selection() -> None:
    ant = explorer_state()
    duplicate = task("TASK-0001", demand=1.0, topic_key="coordination", created_sequence=1)
    alternative = task("TASK-0002", demand=0.7, topic_key="verification", created_sequence=2)

    chosen = choose_task(ant, (duplicate, alternative), {"coordination": 3})

    assert chosen is not None
    assert chosen.task.id == "TASK-0002"


def test_ties_resolve_by_priority_then_creation_then_id() -> None:
    ant = explorer_state()
    later = task("TASK-0002", priority=6, created_sequence=2)
    earlier = task("TASK-0001", priority=6, created_sequence=1)

    chosen = choose_task(ant, (later, earlier), {})

    assert chosen is not None
    assert chosen.task.id == "TASK-0001"


def test_profiles_share_model_but_restrict_task_kinds() -> None:
    verifier = AntState("ANT-07", verifier_profile(), verifier_profile().capabilities, BoundedAntMemory())
    synthesizer = AntState(
        "ANT-10", synthesizer_profile(), synthesizer_profile().capabilities, BoundedAntMemory()
    )

    assert verifier.profile.name is BehaviorProfile.VERIFIER
    assert verifier.profile.eligible_kinds == frozenset({TaskKind.VERIFICATION})
    assert synthesizer.profile.eligible_kinds == frozenset({TaskKind.SYNTHESIS})


def test_local_memory_evicts_oldest_entry() -> None:
    memory = BoundedAntMemory(limit=2)
    memory.remember(MemoryEntry("TASK-0001", "a", "completed"))
    memory.remember(MemoryEntry("TASK-0002", "b", "failed"))
    memory.remember(MemoryEntry("TASK-0003", "c", "completed"))

    assert tuple(entry.task_id for entry in memory.entries) == ("TASK-0002", "TASK-0003")
