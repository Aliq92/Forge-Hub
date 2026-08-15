"""Read-only snapshots and a reference visualization projection."""

from dataclasses import dataclass, replace
from typing import Mapping

from ant_colony.blackboard.models import TaskKind, TaskStatus
from ant_colony.colony.engine import ColonyEngine
from ant_colony.web.protocol import (
    BrowserEnvelope,
    BrowserEventType,
    BrowserMessageType,
)


def _task_payload(task) -> dict[str, object]:
    return {
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


def _result_payload(result) -> dict[str, object]:
    return {
        "id": result.id,
        "task_id": result.task_id,
        "ant_id": result.ant_id,
        "content": result.content,
        "confidence": result.confidence,
        "evidence_notes": result.evidence_notes,
        "provider_operation": result.provider_operation,
    }


class SnapshotBuilder:
    def build(self, engine: ColonyEngine) -> BrowserEnvelope:
        state = engine.board.snapshot()
        synthesis = next(
            (task for task in state.tasks if task.kind is TaskKind.SYNTHESIS),
            None,
        )
        final_result = None
        if synthesis is not None and synthesis.result_ids:
            final_result = _result_payload(engine.board.result(synthesis.result_ids[-1]))
        return BrowserEnvelope(
            1,
            BrowserMessageType.SNAPSHOT,
            engine.board.run_id,
            len(engine.board.journal.events),
            engine.cycle,
            None,
            {
                "colony": {
                    "status": engine.status.value,
                    "cycle": engine.cycle,
                    "goal": engine.goal_text,
                    "synthesis_active": synthesis is not None
                    and synthesis.status in {TaskStatus.OPEN, TaskStatus.CLAIMED},
                    "final_result": final_result,
                },
                "ants": [
                    {
                        "id": ant.state.id,
                        "profile": ant.state.profile.name.value,
                        "activity": ant.state.activity.value,
                        "target_task_id": ant.state.target_task_id,
                    }
                    for ant in engine.ants
                ],
                "tasks": [_task_payload(task) for task in state.tasks],
                "results": [_result_payload(result) for result in state.results],
                "verifications": [
                    {
                        "id": record.id,
                        "verification_task_id": record.verification_task_id,
                        "target_task_id": record.target_task_id,
                        "verifier_id": record.verifier_id,
                        "verdict": record.verdict.value,
                        "confidence_delta": record.confidence_delta,
                    }
                    for record in state.verifications
                ],
            },
        )


@dataclass(frozen=True)
class VisualizationState:
    run_id: str
    sequence: int
    cycle: int
    colony: Mapping[str, object]
    ants: Mapping[str, Mapping[str, object]]
    tasks: Mapping[str, Mapping[str, object]]
    results: Mapping[str, Mapping[str, object]]
    verifications: tuple[Mapping[str, object], ...]

    @classmethod
    def from_snapshot(cls, envelope: BrowserEnvelope) -> "VisualizationState":
        payload = envelope.payload
        return cls(
            envelope.run_id,
            envelope.sequence,
            envelope.cycle,
            dict(payload["colony"]),
            {item["id"]: dict(item) for item in payload["ants"]},
            {item["id"]: dict(item) for item in payload["tasks"]},
            {item["id"]: dict(item) for item in payload["results"]},
            tuple(dict(item) for item in payload["verifications"]),
        )


def apply_browser_event(state: VisualizationState, envelope: BrowserEnvelope) -> VisualizationState:
    if envelope.sequence <= state.sequence:
        return state
    if envelope.sequence != state.sequence + 1:
        raise ValueError("browser event sequence gap")
    ants = {key: dict(value) for key, value in state.ants.items()}
    tasks = {key: dict(value) for key, value in state.tasks.items()}
    results = {key: dict(value) for key, value in state.results.items()}
    verifications = list(state.verifications)
    colony = dict(state.colony)
    event_type = envelope.event_type
    payload = envelope.payload

    if event_type is BrowserEventType.TASK_CREATED:
        item = dict(payload["task"])
        tasks[item["id"]] = item
    elif event_type is BrowserEventType.TASK_CLAIMED:
        item = tasks[payload["task_id"]]
        item.update(status="CLAIMED", claimed_by=payload["ant_id"])
    elif event_type is BrowserEventType.ANT_CREATED:
        ants[payload["ant_id"]] = {
            "id": payload["ant_id"],
            "profile": payload["profile"],
            "activity": "IDLE",
            "target_task_id": None,
        }
    elif event_type is BrowserEventType.ANT_ACTIVITY_CHANGED:
        ants[payload["ant_id"]].update(
            activity=payload["activity"],
            target_task_id=payload["target_task_id"],
        )
    elif event_type is BrowserEventType.PHEROMONE_CHANGED:
        tasks[payload["task_id"]]["pheromones"] = dict(payload["pheromones"])
    elif event_type is BrowserEventType.RESULT_RECORDED:
        item = dict(payload["result"])
        results[item["id"]] = item
    elif event_type is BrowserEventType.TASK_COMPLETED:
        item = tasks[payload["task_id"]]
        item["status"] = "COMPLETED"
        if payload.get("result_id") is not None:
            item["confidence"] = payload["confidence"]
    elif event_type is BrowserEventType.TASK_REOPENED:
        tasks[payload["task_id"]].update(status="OPEN", claimed_by=None)
    elif event_type is BrowserEventType.TASK_VERIFIED:
        tasks[payload["task_id"]]["status"] = "VERIFIED"
    elif event_type is BrowserEventType.TASK_FAILED:
        tasks[payload["task_id"]].update(status="FAILED", claimed_by=None)
    elif event_type is BrowserEventType.TASK_BLOCKED:
        tasks[payload["task_id"]].update(status="BLOCKED", claimed_by=None)
    elif event_type is BrowserEventType.CONFIDENCE_CHANGED:
        tasks[payload["subject_id"]]["confidence"] = payload["new"]
    elif event_type is BrowserEventType.VERIFICATION_RECORDED:
        verifications.append(dict(payload))
    elif event_type is BrowserEventType.SYNTHESIS_STARTED:
        colony["synthesis_active"] = True
    elif event_type is BrowserEventType.COLONY_COMPLETED:
        colony.update(status="COMPLETED", synthesis_active=False)
    elif event_type is BrowserEventType.COLONY_STALLED:
        colony["status"] = "STALLED"

    colony["cycle"] = envelope.cycle
    return VisualizationState(
        state.run_id,
        envelope.sequence,
        envelope.cycle,
        colony,
        ants,
        tasks,
        results,
        tuple(verifications),
    )

