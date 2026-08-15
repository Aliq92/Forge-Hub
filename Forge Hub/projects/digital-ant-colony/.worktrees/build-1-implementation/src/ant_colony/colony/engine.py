"""Deterministic single-process colony cycle runner."""

from ant_colony.ants.ant import Ant, AntTurnContext
from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.models import TaskDraft, TaskKind, TaskStatus
from ant_colony.colony.models import (
    ColonyConfig,
    ColonyRunResult,
    ColonyStatus,
    CycleOutcome,
)
from ant_colony.colony.policy import assess_completion, assess_stall, cycle_made_progress
from ant_colony.events.models import DomainEvent, EventType
from ant_colony.providers.base import WorkProvider
from ant_colony.research.models import FinalAnswer


class ColonyEngine:
    def __init__(
        self,
        board: Blackboard,
        ants: tuple[Ant, ...],
        provider: WorkProvider,
        goal_id: str,
        goal_text: str,
        config: ColonyConfig,
    ) -> None:
        self.board = board
        self.ants = tuple(sorted(ants, key=lambda ant: ant.state.id))
        self.provider = provider
        self.goal_id = goal_id
        self.goal_text = goal_text
        self.config = config
        self.status = ColonyStatus.RUNNING
        self.cycle = 0
        self._no_progress_cycles = 0
        self._synthesis_created = False

    def step(self) -> CycleOutcome:
        if self.status is not ColonyStatus.RUNNING:
            raise RuntimeError("cannot step a terminal colony")
        self.cycle += 1
        self.board.set_cycle(self.cycle)
        start_sequence = len(self.board.journal.events)
        turn_order: list[str] = []
        for ant in self.ants:
            turn_order.append(ant.state.id)
            ant.take_turn(
                AntTurnContext(
                    self.board,
                    self.provider,
                    self.cycle,
                    self.goal_id,
                    self.goal_text,
                )
            )

        self.board.decay_pheromones(self.config.pheromone_decay_factor)
        if self._ready_for_synthesis():
            synthesis = self.board.create_task(
                TaskDraft(
                    title="Synthesize verified findings",
                    description=self.goal_text,
                    kind=TaskKind.SYNTHESIS,
                    priority=10,
                    required_capabilities=frozenset({"synthesis"}),
                    created_by="SYSTEM",
                    critical=False,
                    topic_key="synthesis",
                )
            )
            self._synthesis_created = True
            self._emit(EventType.SYNTHESIS_STARTED, synthesis.id, {"task_id": synthesis.id})

        cycle_events = self.board.journal.after(start_sequence)
        made_progress = cycle_made_progress(cycle_events)
        self._no_progress_cycles = 0 if made_progress else self._no_progress_cycles + 1

        completion = assess_completion(self.board.snapshot(), self.config.minimum_confidence)
        if completion.complete:
            self.status = ColonyStatus.COMPLETED
            self._emit(
                EventType.COLONY_COMPLETED,
                completion.final_result_id,
                {"confidence": completion.final_confidence},
            )
        else:
            stall = assess_stall(
                self.board.snapshot(),
                self._no_progress_cycles,
                self.config.no_progress_cycle_limit,
                self.cycle,
                self.config.maximum_cycles,
            )
            if stall.stalled:
                self.status = ColonyStatus.STALLED
                self._emit(EventType.COLONY_STALLED, None, {"reason": stall.reason})

        return CycleOutcome(
            self.cycle,
            tuple(turn_order),
            made_progress,
            self.status,
            self.board.journal.after(start_sequence),
        )

    def run_until_terminal(self) -> ColonyRunResult:
        while self.status is ColonyStatus.RUNNING:
            self.step()
        return self._build_result()

    def events_after(self, sequence: int) -> tuple[DomainEvent, ...]:
        return self.board.journal.after(sequence)

    def _ready_for_synthesis(self) -> bool:
        if self._synthesis_created:
            return False
        research = [
            task
            for task in self.board.snapshot().tasks
            if task.kind is TaskKind.RESEARCH and task.critical
        ]
        return bool(research) and all(task.status is TaskStatus.VERIFIED for task in research)

    def _build_result(self) -> ColonyRunResult:
        answer = None
        confidence = None
        if self.status is ColonyStatus.COMPLETED:
            synthesis = next(
                task
                for task in self.board.snapshot().tasks
                if task.kind is TaskKind.SYNTHESIS and task.status is TaskStatus.COMPLETED
            )
            result = self.board.result(synthesis.result_ids[-1])
            answer = FinalAnswer(result.content, result.confidence, result.evidence_notes)
            confidence = result.confidence
        return ColonyRunResult(
            self.status,
            self.cycle,
            answer,
            confidence,
            self.board.journal.events,
        )

    def _emit(
        self,
        event_type: EventType,
        subject_id: str | None,
        details: dict[str, object],
    ) -> None:
        self.board.journal.append(
            self.board.run_id,
            self.cycle,
            event_type,
            None,
            subject_id,
            details,
        )

