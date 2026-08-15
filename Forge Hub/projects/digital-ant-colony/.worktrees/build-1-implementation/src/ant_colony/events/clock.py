"""Injectable clocks keep tests and traces deterministic."""

from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime:
        """Return a timezone-aware timestamp."""


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class IncrementingClock:
    def __init__(self, start: datetime, step: timedelta = timedelta(microseconds=1)) -> None:
        if start.tzinfo is None:
            raise ValueError("clock start must be timezone-aware")
        self._next = start
        self._step = step

    def now(self) -> datetime:
        current = self._next
        self._next += self._step
        return current

