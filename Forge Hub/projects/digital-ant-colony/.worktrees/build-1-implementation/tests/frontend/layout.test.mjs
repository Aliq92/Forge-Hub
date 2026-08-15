import test from "node:test";
import assert from "node:assert/strict";

import {
  antDestination,
  idlePosition,
  pheromoneVisual,
  profileAppearance,
  taskPosition,
} from "../../src/ant_colony/web/static/js/colony-layout.js";

const viewport = { width: 900, height: 560 };

test("claimed ant destination is the authoritative task position", () => {
  const tasks = {
    "TASK-ROOT": { id: "TASK-ROOT", parentId: null },
    "TASK-A": { id: "TASK-A", parentId: "TASK-ROOT" },
  };
  const ant = { id: "ANT-03", profile: "explorer", targetTaskId: "TASK-A" };

  assert.deepEqual(
    antDestination(ant, tasks, viewport),
    taskPosition(tasks["TASK-A"], tasks, viewport),
  );
});

test("child tasks remain visibly grouped around their parent", () => {
  const tasks = {
    "TASK-ROOT": { id: "TASK-ROOT", parentId: null },
    "TASK-A": { id: "TASK-A", parentId: "TASK-ROOT" },
  };
  const parent = taskPosition(tasks["TASK-ROOT"], tasks, viewport);
  const child = taskPosition(tasks["TASK-A"], tasks, viewport);
  const distance = Math.hypot(child.x - parent.x, child.y - parent.y);

  assert.ok(distance >= 70 && distance <= 150, `unexpected parent-child distance ${distance}`);
});

test("stronger pheromones produce a larger brighter signal", () => {
  const low = pheromoneVisual({ urgency: 0.1, confidence: 0.1, demand: 0.1, verification: 0.1 });
  const high = pheromoneVisual({ urgency: 0.9, confidence: 0.9, demand: 0.9, verification: 0.9 });

  assert.ok(high.haloRadius > low.haloRadius);
  assert.ok(high.alpha > low.alpha);
  assert.ok(high.trailWidth > low.trailWidth);
});

test("layout and bounded idle wandering are deterministic", () => {
  const task = { id: "TASK-CENTRAL", parentId: null };
  assert.deepEqual(taskPosition(task, { [task.id]: task }, viewport), taskPosition(task, { [task.id]: task }, viewport));

  const first = idlePosition("ANT-07", 4_000, viewport);
  const second = idlePosition("ANT-07", 4_000, viewport);
  assert.deepEqual(first, second);
  assert.ok(Math.hypot(first.x - viewport.width / 2, first.y - viewport.height / 2) <= 68);
});

test("ant profiles have stable distinct visual shapes", () => {
  assert.equal(profileAppearance("explorer").shape, "circle");
  assert.equal(profileAppearance("verifier").shape, "diamond");
  assert.equal(profileAppearance("synthesizer").shape, "hexagon");
});
