from datetime import UTC, datetime

from ant_colony.ants.ant import Ant, AntTurnContext
from ant_colony.ants.models import AntActivity, AntState, BoundedAntMemory
from ant_colony.ants.profiles import explorer_profile, synthesizer_profile, verifier_profile
from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import ResultDraft, TaskDraft, TaskKind, TaskStatus
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal
from ant_colony.providers.base import ProviderFailure
from ant_colony.providers.deterministic import DeterministicScenarioProvider
from ant_colony.research.scenario import build_synthetic_scenario


def make_context(provider=None) -> AntTurnContext:
    clock = IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC))
    ids = SequentialIdSource()
    board = Blackboard("RUN-0001", EventJournal(clock, ids), clock, ids)
    scenario = build_synthetic_scenario()
    return AntTurnContext(
        board,
        provider or DeterministicScenarioProvider(scenario),
        1,
        "GOAL-0001",
        scenario.goal,
    )


def research_task(board: Blackboard):
    return board.create_task(
        TaskDraft(
            "Evaluate local signals",
            "Execute deterministic research.",
            TaskKind.RESEARCH,
            8,
            frozenset({"analysis"}),
            "SYSTEM",
            topic_key="local-signals",
        )
    )


def test_explorer_claim_and_execution_occur_on_separate_turns() -> None:
    context = make_context()
    task = research_task(context.board)
    profile = explorer_profile()
    ant = Ant(AntState("ANT-01", profile, profile.capabilities, BoundedAntMemory()))

    first = ant.take_turn(context)
    second = ant.take_turn(context.next_cycle())

    assert first.activity is AntActivity.MOVING_TO_TASK
    assert first.task_id == task.id
    assert second.activity is AntActivity.WORKING
    assert context.board.task(task.id).status is TaskStatus.COMPLETED
    assert len(context.board.snapshot().results) == 1
    assert any(child.kind is TaskKind.VERIFICATION for child in context.board.snapshot().tasks)


class FailingProvider(DeterministicScenarioProvider):
    def execute(self, request):
        raise ProviderFailure("synthetic provider outage")


def test_provider_failure_releases_task_for_another_ant() -> None:
    scenario = build_synthetic_scenario()
    context = make_context(FailingProvider(scenario))
    task = research_task(context.board)
    profile = explorer_profile()
    ant = Ant(AntState("ANT-01", profile, profile.capabilities, BoundedAntMemory()))

    ant.take_turn(context)
    failed = ant.take_turn(context.next_cycle())

    assert failed.failed is True
    assert context.board.task(task.id).status is TaskStatus.OPEN
    assert context.board.task(task.id).claimed_by is None


def test_explorer_decomposes_goal_into_parent_linked_children() -> None:
    context = make_context()
    root = context.board.create_task(
        TaskDraft(
            "Decompose research goal",
            context.goal_text,
            TaskKind.RESEARCH,
            10,
            frozenset({"analysis"}),
            "SYSTEM",
            topic_key="decompose",
        )
    )
    profile = explorer_profile()
    ant = Ant(AntState("ANT-01", profile, profile.capabilities, BoundedAntMemory()))

    ant.take_turn(context)
    ant.take_turn(context.next_cycle())

    children = [task for task in context.board.snapshot().tasks if task.parent_id == root.id]
    assert len(children) == 4
    assert context.board.task(root.id).status is TaskStatus.COMPLETED


def test_verifier_independently_verifies_completed_result() -> None:
    context = make_context()
    target = research_task(context.board)
    context.board.claim_task(target.id, "ANT-01")
    result = context.board.add_result(
        target.id,
        "ANT-01",
        ResultDraft("Shared demand recruits workers.", ("fixture",), 0.78, "execute"),
    )
    context.board.complete_task(target.id, "ANT-01", result.id)
    check = context.board.create_verification_task(target.id, "SYSTEM")
    profile = verifier_profile()
    ant = Ant(AntState("ANT-07", profile, profile.capabilities, BoundedAntMemory()))

    ant.take_turn(context)
    outcome = ant.take_turn(context.next_cycle())

    assert outcome.activity is AntActivity.VERIFYING
    assert context.board.task(check.id).status is TaskStatus.COMPLETED
    assert context.board.task(target.id).status is TaskStatus.VERIFIED


def test_synthesizer_records_final_result() -> None:
    context = make_context()
    finding = research_task(context.board)
    context.board.claim_task(finding.id, "ANT-01")
    result = context.board.add_result(
        finding.id,
        "ANT-01",
        ResultDraft("Shared demand recruits workers.", ("fixture",), 0.8, "execute"),
    )
    context.board.complete_task(finding.id, "ANT-01", result.id)
    context.board.verify_task(finding.id, "ANT-07")
    synthesis = context.board.create_task(
        TaskDraft(
            "Synthesize findings",
            context.goal_text,
            TaskKind.SYNTHESIS,
            10,
            frozenset({"synthesis"}),
            "SYSTEM",
            topic_key="synthesis",
        )
    )
    profile = synthesizer_profile()
    ant = Ant(AntState("ANT-10", profile, profile.capabilities, BoundedAntMemory()))

    ant.take_turn(context)
    outcome = ant.take_turn(context.next_cycle())

    assert outcome.activity is AntActivity.SYNTHESIZING
    assert context.board.task(synthesis.id).status is TaskStatus.COMPLETED
    assert context.board.result(context.board.task(synthesis.id).result_ids[0]).confidence == 0.86
