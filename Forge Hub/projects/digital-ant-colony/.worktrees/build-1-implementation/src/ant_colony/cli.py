"""Command-line entry points for browser and headless Build #1 operation."""

from argparse import ArgumentParser
from collections.abc import Sequence

from ant_colony.colony.factory import build_deterministic_colony
from ant_colony.colony.models import ColonyStatus


def _parser() -> ArgumentParser:
    parser = ArgumentParser(description="Run Digital Ant Colony Forge Build #1")
    parser.add_argument("--headless", action="store_true", help="run once without importing or starting the web observer")
    parser.add_argument("--host", default="127.0.0.1", help="observer bind address (default: loopback only)")
    parser.add_argument("--port", type=int, default=8000, help="observer port")
    return parser


def _run_headless() -> int:
    result = build_deterministic_colony().run_until_terminal()
    print("Digital Ant Colony - deterministic headless run")
    for event in result.event_trace:
        actor = event.actor_id or "SYSTEM"
        subject = event.subject_id or "-"
        print(f"EVENT {event.sequence:03d} CYCLE {event.cycle:02d} {event.type.value} actor={actor} subject={subject}")
    print(f"STATUS {result.status.value}")
    print(
        f"CONFIDENCE {result.final_confidence:.2f}"
        if result.final_confidence is not None
        else "CONFIDENCE unavailable"
    )
    final = result.final_answer.content if result.final_answer is not None else "No final synthesis"
    print(f"FINAL {final}")
    return 0 if result.status is ColonyStatus.COMPLETED else 1


def main(arguments: Sequence[str] | None = None) -> int:
    options = _parser().parse_args(arguments)
    if options.headless:
        return _run_headless()

    import uvicorn

    uvicorn.run(
        "ant_colony.web.server:create_app",
        factory=True,
        host=options.host,
        port=options.port,
        log_level="info",
    )
    return 0
