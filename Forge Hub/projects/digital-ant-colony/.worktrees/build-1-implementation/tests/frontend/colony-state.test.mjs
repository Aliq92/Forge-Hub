import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEvent,
  createColonyState,
} from "../../src/ant_colony/web/static/js/colony-state.js";
import { socketUrl } from "../../src/ant_colony/web/static/js/websocket.js";


function snapshot() {
  return {
    run_id: "RUN-0001",
    sequence: 4,
    cycle: 2,
    payload: {
      colony: { status: "RUNNING", cycle: 2, synthesis_active: false, final_result: null },
      ants: [{ id: "ANT-07", profile: "VERIFIER", activity: "OBSERVING", target_task_id: null }],
      tasks: [{
        id: "TASK-0012",
        parent_id: null,
        kind: "RESEARCH",
        status: "OPEN",
        claimed_by: null,
        pheromones: { urgency: 0.4, confidence: 0.0, demand: 0.8, verification: 0.0 },
      }],
      results: [],
      verifications: [],
    },
  };
}


test("task claim associates the real ant with the real task", () => {
  const state = createColonyState(snapshot());
  const next = applyEvent(state, {
    sequence: 5,
    cycle: 3,
    event_type: "TASK_CLAIMED",
    payload: { ant_id: "ANT-07", task_id: "TASK-0012" },
  });

  assert.equal(next.ants["ANT-07"].targetTaskId, "TASK-0012");
  assert.equal(next.tasks["TASK-0012"].status, "CLAIMED");
  assert.equal(next.tasks["TASK-0012"].claimedBy, "ANT-07");
});


test("child task creation preserves parent relationship", () => {
  const state = createColonyState(snapshot());
  const next = applyEvent(state, {
    sequence: 5,
    cycle: 3,
    event_type: "TASK_CREATED",
    payload: { task: { id: "TASK-0013", parent_id: "TASK-0012", kind: "VERIFICATION", status: "OPEN", pheromones: {} } },
  });

  assert.equal(next.tasks["TASK-0013"].parentId, "TASK-0012");
});


test("pheromone event replaces authoritative signal values", () => {
  const state = createColonyState(snapshot());
  const next = applyEvent(state, {
    sequence: 5,
    cycle: 3,
    event_type: "PHEROMONE_CHANGED",
    payload: { task_id: "TASK-0012", pheromones: { urgency: 0.2, confidence: 0, demand: 0.4, verification: 0 } },
  });

  assert.equal(next.tasks["TASK-0012"].pheromones.demand, 0.4);
});


test("sequence gap requests a snapshot without applying event", () => {
  const state = createColonyState(snapshot());
  const next = applyEvent(state, {
    sequence: 7,
    cycle: 4,
    event_type: "TASK_FAILED",
    payload: { task_id: "TASK-0012" },
  });

  assert.equal(next.needsResnapshot, true);
  assert.equal(next.tasks["TASK-0012"].status, "OPEN");
});


test("socket URL follows page protocol and host", () => {
  assert.equal(socketUrl({ protocol: "http:", host: "localhost:8000" }), "ws://localhost:8000/ws");
  assert.equal(socketUrl({ protocol: "https:", host: "example.test" }), "wss://example.test/ws");
});


test("completion exposes the recorded authoritative synthesis", () => {
  let state = createColonyState(snapshot());
  state = applyEvent(state, {
    sequence: 5,
    cycle: 3,
    event_type: "RESULT_RECORDED",
    payload: { result: { id: "RESULT-FINAL", content: "Verified synthesis", confidence: 0.91 } },
  });
  state = applyEvent(state, {
    sequence: 6,
    cycle: 3,
    event_type: "COLONY_COMPLETED",
    payload: { subject_id: "RESULT-FINAL", confidence: 0.91 },
  });

  assert.equal(state.colony.status, "COMPLETED");
  assert.equal(state.colony.final_result.content, "Verified synthesis");
});
