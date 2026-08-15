"""One shared deterministic ant turn state machine."""

from dataclasses import dataclass, replace

from ant_colony.ants.models import AntActivity, AntState, MemoryEntry
from ant_colony.ants.scoring import choose_task
from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.models import (
    FailureCategory,
    FailureRecord,
    ResultDraft,
    Task,
    TaskDraft,
    TaskKind,
    TaskStatus,
    VerificationDraft,
)
from ant_colony.blackboard.verification import VerificationService
from ant_colony.events.models import EventType
from ant_colony.providers.base import (
    DecompositionRequest,
    ExecutionRequest,
    ProviderFailure,
    SynthesisFinding,
    SynthesisRequest,
    VerificationRequest,
    WorkProvider,
)
from ant_colony.pheromones.models import PheromoneLevels


@dataclass(frozen=True)
class AntTurnContext:
    board: Blackboard
    provider: WorkProvider
    cycle: int
    goal_id: str
    goal_text: str

    def next_cycle(self) -> "AntTurnContext":
        return replace(self, cycle=self.cycle + 1)


@dataclass(frozen=True)
class AntTurnOutcome:
    ant_id: str
    activity: AntActivity
    task_id: str | None
    claimed: bool = False
    completed: bool = False
    failed: bool = False
    message: str = ""


class Ant:
    def __init__(self, state: AntState) -> None:
        self.state = state

    def take_turn(self, context: AntTurnContext) -> AntTurnOutcome:
        context.board.set_cycle(context.cycle)
        if self.state.current_task_id is None:
            return self._observe_score_and_claim(context)
        task = context.board.task(self.state.current_task_id)
        if task.kind is TaskKind.VERIFICATION:
            return self._verify(context, task)
        if task.kind is TaskKind.SYNTHESIS:
            return self._synthesize(context, task)
        return self._execute_research(context, task)

    def _observe_score_and_claim(self, context: AntTurnContext) -> AntTurnOutcome:
        self._set_activity(context, AntActivity.OBSERVING, None)
        tasks = context.board.eligible_tasks(
            self.state.profile.eligible_kinds,
            self.state.capabilities,
        )
        for task in tasks:
            self._emit(context, EventType.ANT_OBSERVED_TASK, task.id, {"ant_id": self.state.id})
        snapshot = context.board.snapshot()
        related_counts: dict[str, int] = {}
        for task in snapshot.tasks:
            if task.status is TaskStatus.CLAIMED:
                related_counts[task.topic_key] = related_counts.get(task.topic_key, 0) + 1
        chosen = choose_task(self.state, tasks, related_counts)
        if chosen is None:
            self._set_activity(context, AntActivity.IDLE, None)
            return AntTurnOutcome(self.state.id, AntActivity.IDLE, None)
        claim = context.board.claim_task(chosen.task.id, self.state.id)
        if not claim.claimed:
            return AntTurnOutcome(self.state.id, AntActivity.OBSERVING, chosen.task.id)
        self.state.current_task_id = chosen.task.id
        self._set_activity(context, AntActivity.MOVING_TO_TASK, chosen.task.id)
        return AntTurnOutcome(
            self.state.id,
            AntActivity.MOVING_TO_TASK,
            chosen.task.id,
            claimed=True,
            message=f"score={chosen.breakdown.total:.3f}",
        )

    def _execute_research(self, context: AntTurnContext, task: Task) -> AntTurnOutcome:
        self._set_activity(context, AntActivity.WORKING, task.id)
        try:
            if task.topic_key == "decompose":
                response = context.provider.decompose(
                    DecompositionRequest(context.goal_id, context.goal_text)
                )
                for proposal in response.tasks:
                    context.board.create_task(
                        TaskDraft(
                            title=proposal.title,
                            description=proposal.description,
                            kind=TaskKind.RESEARCH,
                            priority=proposal.priority,
                            required_capabilities=frozenset({"analysis"}),
                            created_by=self.state.id,
                            parent_id=task.id,
                            pheromones=PheromoneLevels(
                                urgency=min(1.0, proposal.priority / 20.0),
                                demand=0.6,
                            ),
                            topic_key=proposal.topic_key,
                        )
                    )
                draft = ResultDraft(
                    f"Created {len(response.tasks)} research tasks.",
                    ("deterministic decomposition",),
                    1.0,
                    "decompose",
                )
                needs_verification = False
            else:
                response = context.provider.execute(
                    ExecutionRequest(task.id, task.topic_key, task.title, task.attempt_count)
                )
                draft = ResultDraft(
                    response.content,
                    response.evidence_notes,
                    response.confidence,
                    "execute",
                )
                needs_verification = True
            result = context.board.add_result(task.id, self.state.id, draft)
            context.board.complete_task(task.id, self.state.id, result.id)
            if needs_verification:
                context.board.create_verification_task(task.id, self.state.id)
            self.state.memory.remember(MemoryEntry(task.id, task.topic_key, "completed"))
            self._finish(context)
            return AntTurnOutcome(
                self.state.id,
                AntActivity.WORKING,
                task.id,
                completed=True,
            )
        except ProviderFailure as error:
            return self._handle_failure(context, task, error)

    def _verify(self, context: AntTurnContext, task: Task) -> AntTurnOutcome:
        self._set_activity(context, AntActivity.VERIFYING, task.id)
        target = context.board.task(task.target_task_id or "")
        result = context.board.result(target.result_ids[-1])
        try:
            response = context.provider.verify(
                VerificationRequest(task.id, target.id, target.topic_key, result.content)
            )
            VerificationService(context.board).apply(
                VerificationDraft(
                    task.id,
                    target.id,
                    self.state.id,
                    response.verdict,
                    response.confidence_delta,
                    response.evidence_notes,
                    response.recommend_reopen,
                )
            )
            self.state.memory.remember(MemoryEntry(task.id, task.topic_key, "completed"))
            self._finish(context)
            return AntTurnOutcome(
                self.state.id,
                AntActivity.VERIFYING,
                task.id,
                completed=True,
            )
        except ProviderFailure as error:
            return self._handle_failure(context, task, error)

    def _synthesize(self, context: AntTurnContext, task: Task) -> AntTurnOutcome:
        self._set_activity(context, AntActivity.SYNTHESIZING, task.id)
        findings: list[SynthesisFinding] = []
        for candidate in context.board.snapshot().tasks:
            if candidate.kind is TaskKind.RESEARCH and candidate.status is TaskStatus.VERIFIED:
                result = context.board.result(candidate.result_ids[-1])
                findings.append(SynthesisFinding(candidate.topic_key, result.content, candidate.confidence))
        try:
            response = context.provider.synthesize(
                SynthesisRequest(context.goal_text, tuple(findings))
            )
            result = context.board.add_result(
                task.id,
                self.state.id,
                ResultDraft(
                    response.content,
                    response.evidence_notes,
                    response.confidence,
                    "synthesize",
                ),
            )
            context.board.complete_task(task.id, self.state.id, result.id)
            self.state.memory.remember(MemoryEntry(task.id, task.topic_key, "completed"))
            self._finish(context)
            return AntTurnOutcome(
                self.state.id,
                AntActivity.SYNTHESIZING,
                task.id,
                completed=True,
            )
        except ProviderFailure as error:
            return self._handle_failure(context, task, error)

    def _handle_failure(
        self,
        context: AntTurnContext,
        task: Task,
        error: ProviderFailure,
    ) -> AntTurnOutcome:
        context.board.release_after_failure(
            task.id,
            self.state.id,
            FailureRecord(FailureCategory.PROVIDER, str(error), context.board.now()),
        )
        self.state.memory.remember(MemoryEntry(task.id, task.topic_key, "failed"))
        self._set_activity(context, AntActivity.FAILED, task.id)
        self.state.current_task_id = None
        return AntTurnOutcome(
            self.state.id,
            AntActivity.FAILED,
            task.id,
            failed=True,
            message=str(error),
        )

    def _finish(self, context: AntTurnContext) -> None:
        self.state.current_task_id = None
        self._set_activity(context, AntActivity.IDLE, None)

    def _set_activity(
        self,
        context: AntTurnContext,
        activity: AntActivity,
        target_task_id: str | None,
    ) -> None:
        self.state.activity = activity
        self.state.target_task_id = target_task_id
        self._emit(
            context,
            EventType.ANT_ACTIVITY_CHANGED,
            self.state.id,
            {"activity": activity.value, "target_task_id": target_task_id},
        )

    def _emit(
        self,
        context: AntTurnContext,
        event_type: EventType,
        subject_id: str | None,
        details: dict[str, object],
    ) -> None:
        context.board.journal.append(
            context.board.run_id,
            context.cycle,
            event_type,
            self.state.id,
            subject_id,
            details,
        )
