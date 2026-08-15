"""Authoritative in-memory colony state."""

from dataclasses import dataclass, replace
from types import MappingProxyType
from typing import Mapping, TYPE_CHECKING

from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import (
    FailureRecord,
    Goal,
    ResultDraft,
    ResultRecord,
    Task,
    TaskDraft,
    TaskKind,
    TaskStatus,
    VerificationRecord,
    VerificationDraft,
)
from ant_colony.blackboard.transitions import transition_task
from ant_colony.events.clock import Clock
from ant_colony.events.journal import EventJournal
from ant_colony.events.models import EventType
from ant_colony.pheromones.rules import decay, reinforce

if TYPE_CHECKING:
    from ant_colony.ants.models import AntState


class UnknownTaskError(KeyError):
    pass


class ParentTaskError(ValueError):
    pass


class TaskOwnershipError(ValueError):
    pass


@dataclass(frozen=True)
class ClaimOutcome:
    claimed: bool
    task: Task


@dataclass(frozen=True)
class BlackboardSnapshot:
    goals: tuple[Goal, ...]
    tasks: tuple[Task, ...]
    results: tuple[ResultRecord, ...]
    verifications: tuple[VerificationRecord, ...]
    failures_by_task: Mapping[str, tuple[FailureRecord, ...]]
    child_ids_by_parent: Mapping[str, tuple[str, ...]]


class Blackboard:
    def __init__(
        self,
        run_id: str,
        journal: EventJournal,
        clock: Clock,
        ids: SequentialIdSource,
    ) -> None:
        self.run_id = run_id
        self.journal = journal
        self._clock = clock
        self._ids = ids
        self._cycle = 0
        self._goals: dict[str, Goal] = {}
        self._tasks: dict[str, Task] = {}
        self._results: dict[str, ResultRecord] = {}
        self._verifications: dict[str, VerificationRecord] = {}
        self._failures_by_task: dict[str, list[FailureRecord]] = {}
        self._children: dict[str, list[str]] = {}

    @property
    def cycle(self) -> int:
        return self._cycle

    def now(self):
        return self._clock.now()

    def set_cycle(self, cycle: int) -> None:
        self._cycle = cycle

    def create_goal(self, title: str, description: str, created_by: str) -> Goal:
        goal = Goal(self._ids.next("GOAL"), title, description, created_by, self._clock.now())
        self._goals[goal.id] = goal
        self._emit(EventType.GOAL_CREATED, created_by, goal.id, {"title": title})
        return goal

    def create_task(self, draft: TaskDraft) -> Task:
        if draft.parent_id is not None and draft.parent_id not in self._tasks:
            raise ParentTaskError(f"unknown parent task {draft.parent_id}")
        now = self._clock.now()
        task = Task(
            id=self._ids.next("TASK"),
            parent_id=draft.parent_id,
            title=draft.title,
            description=draft.description,
            kind=draft.kind,
            status=TaskStatus.OPEN,
            priority=draft.priority,
            required_capabilities=draft.required_capabilities,
            claimed_by=None,
            created_by=draft.created_by,
            result_ids=(),
            confidence=max(0.0, min(1.0, draft.confidence)),
            pheromones=draft.pheromones,
            attempt_count=0,
            max_attempts=draft.max_attempts,
            critical=draft.critical,
            topic_key=draft.topic_key,
            created_sequence=len(self._tasks) + 1,
            created_at=now,
            updated_at=now,
            target_task_id=draft.target_task_id,
        )
        self._tasks[task.id] = task
        if task.parent_id is not None:
            self._children.setdefault(task.parent_id, []).append(task.id)
        self._emit(
            EventType.TASK_CREATED,
            draft.created_by,
            task.id,
            {
                "task": {
                    "id": task.id,
                    "parent_id": task.parent_id,
                    "target_task_id": task.target_task_id,
                    "title": task.title,
                    "kind": task.kind.value,
                    "status": task.status.value,
                    "priority": task.priority,
                    "claimed_by": task.claimed_by,
                    "confidence": task.confidence,
                    "critical": task.critical,
                    "topic_key": task.topic_key,
                    "created_sequence": task.created_sequence,
                    "pheromones": {
                        "urgency": task.pheromones.urgency,
                        "confidence": task.pheromones.confidence,
                        "demand": task.pheromones.demand,
                        "verification": task.pheromones.verification,
                    },
                }
            },
        )
        return task

    def task(self, task_id: str) -> Task:
        try:
            return self._tasks[task_id]
        except KeyError as error:
            raise UnknownTaskError(task_id) from error

    def result(self, result_id: str) -> ResultRecord:
        return self._results[result_id]

    def eligible_tasks(
        self,
        eligible_kinds: frozenset[TaskKind],
        capabilities: frozenset[str],
    ) -> tuple[Task, ...]:
        return tuple(
            sorted(
                (
                    task
                    for task in self._tasks.values()
                    if task.status is TaskStatus.OPEN
                    and task.kind in eligible_kinds
                    and task.required_capabilities.issubset(capabilities)
                ),
                key=lambda task: task.created_sequence,
            )
        )

    def claim_task(self, task_id: str, ant_id: str) -> ClaimOutcome:
        current = self.task(task_id)
        if current.status is not TaskStatus.OPEN:
            return ClaimOutcome(False, current)
        claimed = transition_task(current, TaskStatus.CLAIMED, updated_at=self._clock.now())
        claimed = replace(claimed, claimed_by=ant_id)
        self._tasks[task_id] = claimed
        self._emit(EventType.TASK_CLAIMED, ant_id, task_id, {"ant_id": ant_id})
        return ClaimOutcome(True, claimed)

    def add_result(self, task_id: str, ant_id: str, draft: ResultDraft) -> ResultRecord:
        task = self.task(task_id)
        self._require_owner(task, ant_id)
        result = ResultRecord(
            id=self._ids.next("RESULT"),
            task_id=task_id,
            ant_id=ant_id,
            content=draft.content,
            evidence_notes=tuple(draft.evidence_notes),
            confidence=max(0.0, min(1.0, draft.confidence)),
            provider_operation=draft.provider_operation,
            created_at=self._clock.now(),
        )
        self._results[result.id] = result
        self._emit(
            EventType.RESULT_RECORDED,
            ant_id,
            result.id,
            {
                "result": {
                    "id": result.id,
                    "task_id": task_id,
                    "ant_id": ant_id,
                    "content": result.content,
                    "confidence": result.confidence,
                    "evidence_notes": result.evidence_notes,
                    "provider_operation": result.provider_operation,
                }
            },
        )
        return result

    def complete_task(self, task_id: str, ant_id: str, result_id: str) -> Task:
        task = self.task(task_id)
        self._require_owner(task, ant_id)
        result = self.result(result_id)
        if result.task_id != task_id or result.ant_id != ant_id:
            raise TaskOwnershipError("result does not belong to task claimant")
        completed = transition_task(task, TaskStatus.COMPLETED, updated_at=self._clock.now())
        completed = replace(
            completed,
            result_ids=task.result_ids + (result_id,),
            confidence=result.confidence,
        )
        self._tasks[task_id] = completed
        self._emit(
            EventType.TASK_COMPLETED,
            ant_id,
            task_id,
            {"result_id": result_id, "confidence": completed.confidence},
        )
        return completed

    def release_after_failure(
        self,
        task_id: str,
        ant_id: str,
        failure: FailureRecord,
    ) -> Task:
        task = self.task(task_id)
        self._require_owner(task, ant_id)
        self._failures_by_task.setdefault(task_id, []).append(failure)
        attempts = task.attempt_count + 1
        terminal = attempts >= task.max_attempts
        status = TaskStatus.FAILED if terminal else TaskStatus.OPEN
        updated = transition_task(task, status, updated_at=self._clock.now())
        updated = replace(
            updated,
            claimed_by=None,
            attempt_count=attempts,
            pheromones=reinforce(task.pheromones, urgency=0.2, demand=0.1),
        )
        self._tasks[task_id] = updated
        self._emit(
            EventType.ANT_FAILED,
            ant_id,
            task_id,
            {"category": failure.category.value, "notes": failure.notes},
        )
        self._emit(
            EventType.TASK_FAILED if terminal else EventType.TASK_REOPENED,
            ant_id,
            task_id,
            {"attempt_count": attempts, "terminal": terminal},
        )
        return updated

    def block_task(self, task_id: str, ant_id: str, reason: str) -> Task:
        task = self.task(task_id)
        self._require_owner(task, ant_id)
        blocked = transition_task(task, TaskStatus.BLOCKED, updated_at=self._clock.now())
        blocked = replace(blocked, claimed_by=None)
        self._tasks[task_id] = blocked
        self._emit(EventType.TASK_BLOCKED, ant_id, task_id, {"reason": reason})
        return blocked

    def reopen_task(
        self,
        task_id: str,
        actor_id: str,
        reason: str,
        *,
        increment_attempt: bool = False,
    ) -> Task:
        task = self.task(task_id)
        reopened = transition_task(task, TaskStatus.OPEN, updated_at=self._clock.now())
        reopened = replace(
            reopened,
            claimed_by=None,
            attempt_count=task.attempt_count + (1 if increment_attempt else 0),
        )
        self._tasks[task_id] = reopened
        self._emit(EventType.TASK_REOPENED, actor_id, task_id, {"reason": reason})
        return reopened

    def create_verification_task(self, target_task_id: str, created_by: str) -> Task:
        target = self.task(target_task_id)
        if target.status is not TaskStatus.COMPLETED:
            raise ValueError("verification target must be completed")
        return self.create_task(
            TaskDraft(
                title=f"Verify: {target.title}",
                description=f"Independently verify {target.id}.",
                kind=TaskKind.VERIFICATION,
                priority=target.priority + 1,
                required_capabilities=frozenset({"verification"}),
                created_by=created_by,
                parent_id=target.id,
                target_task_id=target.id,
                pheromones=reinforce(target.pheromones, verification=0.5, demand=0.2),
                max_attempts=target.max_attempts,
                critical=target.critical,
                topic_key=f"verify:{target.topic_key}",
            )
        )

    def record_verification(self, draft: VerificationDraft) -> VerificationRecord:
        verification_task = self.task(draft.verification_task_id)
        self._require_owner(verification_task, draft.verifier_id)
        if verification_task.kind is not TaskKind.VERIFICATION:
            raise ValueError("verification record requires a verification task")
        if verification_task.target_task_id != draft.target_task_id:
            raise ValueError("verification target does not match task")
        record = VerificationRecord(
            id=self._ids.next("VERIFY"),
            verification_task_id=draft.verification_task_id,
            target_task_id=draft.target_task_id,
            verifier_id=draft.verifier_id,
            verdict=draft.verdict,
            confidence_delta=draft.confidence_delta,
            evidence_notes=tuple(draft.evidence_notes),
            recommend_reopen=draft.recommend_reopen,
            created_at=self._clock.now(),
        )
        self._verifications[record.id] = record
        self._emit(
            EventType.VERIFICATION_RECORDED,
            record.verifier_id,
            record.target_task_id,
            {"verification_id": record.id, "verdict": record.verdict.value},
        )
        return record

    def complete_verification_task(self, task_id: str, ant_id: str) -> Task:
        task = self.task(task_id)
        self._require_owner(task, ant_id)
        completed = transition_task(task, TaskStatus.COMPLETED, updated_at=self._clock.now())
        self._tasks[task_id] = completed
        self._emit(EventType.TASK_COMPLETED, ant_id, task_id, {"verification": True})
        return completed

    def adjust_confidence(self, task_id: str, actor_id: str, delta: float) -> Task:
        task = self.task(task_id)
        old = task.confidence
        new = round(max(0.0, min(1.0, old + delta)), 10)
        updated = replace(task, confidence=new, updated_at=self._clock.now())
        self._tasks[task_id] = updated
        self._emit(
            EventType.CONFIDENCE_CHANGED,
            actor_id,
            task_id,
            {"old": old, "new": new, "delta": delta},
        )
        return updated

    def verify_task(self, task_id: str, actor_id: str) -> Task:
        task = self.task(task_id)
        verified = transition_task(task, TaskStatus.VERIFIED, updated_at=self._clock.now())
        self._tasks[task_id] = verified
        self._emit(EventType.TASK_VERIFIED, actor_id, task_id, {"confidence": verified.confidence})
        return verified

    def decay_pheromones(self, factor: float) -> tuple[Task, ...]:
        changed: list[Task] = []
        for task_id, task in tuple(self._tasks.items()):
            levels = decay(task.pheromones, factor)
            if levels == task.pheromones:
                continue
            updated = replace(task, pheromones=levels, updated_at=self._clock.now())
            self._tasks[task_id] = updated
            changed.append(updated)
            self._emit(
                EventType.PHEROMONE_CHANGED,
                None,
                task_id,
                {
                    "urgency": levels.urgency,
                    "confidence": levels.confidence,
                    "demand": levels.demand,
                    "verification": levels.verification,
                },
            )
        return tuple(changed)

    def snapshot(self) -> BlackboardSnapshot:
        return BlackboardSnapshot(
            goals=tuple(self._goals.values()),
            tasks=tuple(sorted(self._tasks.values(), key=lambda task: task.created_sequence)),
            results=tuple(self._results.values()),
            verifications=tuple(self._verifications.values()),
            failures_by_task=MappingProxyType(
                {task_id: tuple(records) for task_id, records in self._failures_by_task.items()}
            ),
            child_ids_by_parent=MappingProxyType(
                {parent_id: tuple(children) for parent_id, children in self._children.items()}
            ),
        )

    def _require_owner(self, task: Task, ant_id: str) -> None:
        if task.status is not TaskStatus.CLAIMED or task.claimed_by != ant_id:
            raise TaskOwnershipError(f"{ant_id} does not own {task.id}")

    def _emit(
        self,
        event_type: EventType,
        actor_id: str | None,
        subject_id: str | None,
        details: Mapping[str, object],
    ) -> None:
        self.journal.append(
            self.run_id,
            self._cycle,
            event_type,
            actor_id,
            subject_id,
            details,
        )
