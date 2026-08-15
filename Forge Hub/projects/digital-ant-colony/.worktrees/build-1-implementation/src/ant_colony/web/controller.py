"""Narrow one-run application control outside the read-only observer."""

import asyncio
from collections.abc import Callable

from ant_colony.colony.engine import ColonyEngine
from ant_colony.colony.factory import build_deterministic_colony
from ant_colony.colony.models import ColonyStatus
from ant_colony.web.protocol import EventMapper
from ant_colony.web.websocket import ObserverHub


class RunAlreadyStartedError(RuntimeError):
    pass


class RunController:
    def __init__(
        self,
        *,
        display_delay: float = 0.15,
        engine_factory: Callable[[], ColonyEngine] = build_deterministic_colony,
        hub: ObserverHub | None = None,
    ) -> None:
        self.display_delay = display_delay
        self._engine_factory = engine_factory
        self.hub = hub or ObserverHub()
        self.current_engine: ColonyEngine | None = None
        self._task: asyncio.Task[None] | None = None
        self._started = False

    async def start(self) -> None:
        if self._started:
            raise RunAlreadyStartedError("the Build #1 run has already started")
        self._started = True
        self.current_engine = self._engine_factory()
        self._task = asyncio.create_task(self._run())

    async def wait(self) -> None:
        if self._task is not None:
            await self._task

    async def _run(self) -> None:
        engine = self.current_engine
        if engine is None:
            return
        if self.display_delay:
            await asyncio.sleep(self.display_delay)
        mapper = EventMapper()
        while engine.status is ColonyStatus.RUNNING:
            sequence = len(engine.board.journal.events)
            engine.step()
            for event in engine.events_after(sequence):
                self.hub.publish(mapper.map(event))
            if self.display_delay and engine.status is ColonyStatus.RUNNING:
                await asyncio.sleep(self.display_delay)

