"""Versioned, JSON-friendly read-only browser protocol."""

from dataclasses import dataclass
from enum import StrEnum
from typing import Mapping, TypeAlias

from ant_colony.events.models import DomainEvent, EventType


JSONScalar: TypeAlias = str | int | float | bool | None
JSONValue: TypeAlias = JSONScalar | list["JSONValue"] | dict[str, "JSONValue"]


class BrowserMessageType(StrEnum):
    SNAPSHOT = "SNAPSHOT"
    EVENT = "EVENT"


class BrowserEventType(StrEnum):
    GOAL_CREATED = "GOAL_CREATED"
    TASK_CREATED = "TASK_CREATED"
    ANT_CREATED = "ANT_CREATED"
    ANT_OBSERVED_TASK = "ANT_OBSERVED_TASK"
    ANT_ACTIVITY_CHANGED = "ANT_ACTIVITY_CHANGED"
    TASK_CLAIMED = "TASK_CLAIMED"
    TASK_BLOCKED = "TASK_BLOCKED"
    RESULT_RECORDED = "RESULT_RECORDED"
    TASK_COMPLETED = "TASK_COMPLETED"
    TASK_FAILED = "TASK_FAILED"
    TASK_REOPENED = "TASK_REOPENED"
    TASK_VERIFICATION_STARTED = "TASK_VERIFICATION_STARTED"
    TASK_VERIFIED = "TASK_VERIFIED"
    VERIFICATION_RECORDED = "VERIFICATION_RECORDED"
    CONFIDENCE_CHANGED = "CONFIDENCE_CHANGED"
    PHEROMONE_CHANGED = "PHEROMONE_CHANGED"
    ANT_FAILED = "ANT_FAILED"
    SYNTHESIS_STARTED = "SYNTHESIS_STARTED"
    COLONY_COMPLETED = "COLONY_COMPLETED"
    COLONY_STALLED = "COLONY_STALLED"
    RESNAPSHOT_REQUIRED = "RESNAPSHOT_REQUIRED"


@dataclass(frozen=True)
class BrowserEnvelope:
    schema_version: int
    message_type: BrowserMessageType
    run_id: str
    sequence: int
    cycle: int
    event_type: BrowserEventType | None
    payload: Mapping[str, object]

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "message_type": self.message_type.value,
            "run_id": self.run_id,
            "sequence": self.sequence,
            "cycle": self.cycle,
            "event_type": self.event_type.value if self.event_type is not None else None,
            "payload": _json_value(self.payload),
        }


def _json_value(value: object) -> object:
    if isinstance(value, StrEnum):
        return value.value
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    return value


class EventMapper:
    def map(self, event: DomainEvent) -> BrowserEnvelope:
        event_type = BrowserEventType(event.type.value)
        payload: dict[str, object]
        if event.type is EventType.TASK_CLAIMED:
            payload = {"task_id": event.subject_id, "ant_id": event.actor_id}
        elif event.type is EventType.TASK_CREATED:
            payload = {"task": event.details["task"]}
        elif event.type is EventType.ANT_CREATED:
            payload = {"ant_id": event.actor_id, **dict(event.details)}
        elif event.type is EventType.ANT_ACTIVITY_CHANGED:
            payload = {"ant_id": event.actor_id, **dict(event.details)}
        elif event.type is EventType.RESULT_RECORDED:
            payload = {"result": event.details["result"]}
        elif event.type is EventType.PHEROMONE_CHANGED:
            payload = {"task_id": event.subject_id, "pheromones": dict(event.details)}
        elif event.subject_id is not None and event.type.name.startswith("TASK_"):
            payload = {"task_id": event.subject_id, "ant_id": event.actor_id, **dict(event.details)}
        else:
            payload = {
                "actor_id": event.actor_id,
                "subject_id": event.subject_id,
                **dict(event.details),
            }
        return BrowserEnvelope(
            1,
            BrowserMessageType.EVENT,
            event.run_id,
            event.sequence,
            event.cycle,
            event_type,
            payload,
        )

