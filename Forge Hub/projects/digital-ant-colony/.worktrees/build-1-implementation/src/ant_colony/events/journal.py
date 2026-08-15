"""Append-only in-memory domain event journal."""

from types import MappingProxyType
from typing import Mapping

from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.events.clock import Clock
from ant_colony.events.models import DomainEvent, EventType


class EventJournal:
    def __init__(self, clock: Clock, ids: SequentialIdSource) -> None:
        self._clock = clock
        self._ids = ids
        self._events: list[DomainEvent] = []

    @property
    def events(self) -> tuple[DomainEvent, ...]:
        return tuple(self._events)

    def append(
        self,
        run_id: str,
        cycle: int,
        event_type: EventType,
        actor_id: str | None,
        subject_id: str | None,
        details: Mapping[str, object],
    ) -> DomainEvent:
        event = DomainEvent(
            id=self._ids.next("EVENT"),
            run_id=run_id,
            sequence=len(self._events) + 1,
            cycle=cycle,
            type=event_type,
            actor_id=actor_id,
            subject_id=subject_id,
            timestamp=self._clock.now(),
            details=MappingProxyType(dict(details)),
        )
        self._events.append(event)
        return event

    def after(self, sequence: int) -> tuple[DomainEvent, ...]:
        return tuple(event for event in self._events if event.sequence > sequence)

