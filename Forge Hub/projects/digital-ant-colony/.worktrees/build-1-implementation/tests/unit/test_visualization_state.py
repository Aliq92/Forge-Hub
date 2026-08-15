from functools import reduce

from ant_colony.colony.factory import build_deterministic_colony
from ant_colony.web.protocol import EventMapper
from ant_colony.web.state import SnapshotBuilder, VisualizationState, apply_browser_event


def test_snapshot_plus_events_reconstructs_current_visual_state() -> None:
    engine = build_deterministic_colony()
    snapshot = SnapshotBuilder().build(engine)
    baseline = VisualizationState.from_snapshot(snapshot)

    engine.step()
    mapped = tuple(EventMapper().map(event) for event in engine.events_after(snapshot.sequence))
    reconstructed = reduce(apply_browser_event, mapped, baseline)
    current = VisualizationState.from_snapshot(SnapshotBuilder().build(engine))

    assert reconstructed == current


def test_snapshot_contains_logical_targets_but_no_screen_coordinates() -> None:
    envelope = SnapshotBuilder().build(build_deterministic_colony())

    assert all("target_task_id" in ant for ant in envelope.payload["ants"])
    assert all("x" not in ant and "y" not in ant for ant in envelope.payload["ants"])
