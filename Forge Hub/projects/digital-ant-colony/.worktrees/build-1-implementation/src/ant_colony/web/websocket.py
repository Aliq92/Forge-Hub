"""Bounded, non-blocking observer subscriptions."""

import asyncio

from ant_colony.web.protocol import BrowserEnvelope, BrowserEventType, BrowserMessageType


class ObserverHub:
    def __init__(self, queue_size: int = 128) -> None:
        self._queue_size = queue_size
        self._next_id = 1
        self._subscribers: dict[int, asyncio.Queue[BrowserEnvelope]] = {}

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> tuple[int, asyncio.Queue[BrowserEnvelope]]:
        subscriber_id = self._next_id
        self._next_id += 1
        queue: asyncio.Queue[BrowserEnvelope] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers[subscriber_id] = queue
        return subscriber_id, queue

    def unsubscribe(self, subscriber_id: int) -> None:
        self._subscribers.pop(subscriber_id, None)

    def publish(self, envelope: BrowserEnvelope) -> None:
        for queue in tuple(self._subscribers.values()):
            try:
                queue.put_nowait(envelope)
            except asyncio.QueueFull:
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait(
                    BrowserEnvelope(
                        1,
                        BrowserMessageType.EVENT,
                        envelope.run_id,
                        envelope.sequence,
                        envelope.cycle,
                        BrowserEventType.RESNAPSHOT_REQUIRED,
                        {"reason": "observer queue overflow"},
                    )
                )

