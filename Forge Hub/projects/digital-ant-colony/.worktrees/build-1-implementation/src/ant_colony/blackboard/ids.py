"""Deterministic identifiers for repeatable simulations."""

from collections import defaultdict


class SequentialIdSource:
    def __init__(self) -> None:
        self._counts: dict[str, int] = defaultdict(int)

    def next(self, prefix: str) -> str:
        normalized = prefix.upper()
        self._counts[normalized] += 1
        return f"{normalized}-{self._counts[normalized]:04d}"

