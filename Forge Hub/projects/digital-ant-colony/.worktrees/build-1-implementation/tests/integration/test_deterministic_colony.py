from ant_colony.colony.factory import build_deterministic_colony
from ant_colony.colony.models import ColonyConfig, ColonyStatus
from ant_colony.events.models import EventType


def logical_trace(result):
    return tuple(
        (
            event.id,
            event.sequence,
            event.cycle,
            event.type,
            event.actor_id,
            event.subject_id,
            dict(event.details),
        )
        for event in result.event_trace
    )


def test_deterministic_colony_reaches_verified_synthesis() -> None:
    first = build_deterministic_colony(ant_count=10).run_until_terminal()
    second = build_deterministic_colony(ant_count=10).run_until_terminal()

    assert first.status is ColonyStatus.COMPLETED
    assert first.final_answer == second.final_answer
    assert first.final_confidence == second.final_confidence == 0.86
    assert logical_trace(first) == logical_trace(second)
    event_types = tuple(event.type for event in first.event_trace)
    assert EventType.TASK_REOPENED in event_types
    assert EventType.TASK_VERIFIED in event_types
    assert EventType.PHEROMONE_CHANGED in event_types
    assert EventType.SYNTHESIS_STARTED in event_types
    assert event_types[-1] is EventType.COLONY_COMPLETED
    assert any(
        event.type is EventType.VERIFICATION_RECORDED
        and event.details["verdict"] == "CONTRADICTION"
        for event in first.event_trace
    )


def test_engine_invokes_ants_in_stable_id_order() -> None:
    engine = build_deterministic_colony(ant_count=10)

    outcome = engine.step()

    assert outcome.ant_turn_order == tuple(f"ANT-{index:02d}" for index in range(1, 11))


def test_maximum_cycle_guard_stalls_unfinished_colony() -> None:
    engine = build_deterministic_colony(
        ant_count=10,
        config=ColonyConfig(ant_count=10, maximum_cycles=1),
    )

    result = engine.run_until_terminal()

    assert result.status is ColonyStatus.STALLED
    assert result.event_trace[-1].type is EventType.COLONY_STALLED
    assert result.event_trace[-1].details["reason"] == "maximum cycle limit 1 reached"
