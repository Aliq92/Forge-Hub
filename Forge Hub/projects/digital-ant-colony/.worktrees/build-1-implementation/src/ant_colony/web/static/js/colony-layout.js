function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function angleFor(id) {
  return (hash(id) % 3600) * Math.PI / 1800;
}

export function taskPosition(task, tasks, viewport) {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  if (task.parentId && tasks[task.parentId]) {
    const parent = taskPosition(tasks[task.parentId], tasks, viewport);
    const angle = angleFor(task.id);
    const distance = 88 + (hash(`${task.id}:distance`) % 42);
    return { x: parent.x + Math.cos(angle) * distance, y: parent.y + Math.sin(angle) * distance };
  }
  const angle = angleFor(task.id);
  const radius = Math.min(viewport.width, viewport.height) * 0.27;
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

export function idlePosition(antId, elapsedMs, viewport) {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const phase = angleFor(antId);
  const time = elapsedMs / 1800;
  const radius = 30 + hash(antId) % 32;
  return {
    x: center.x + Math.cos(time + phase) * radius,
    y: center.y + Math.sin(time * 0.73 + phase) * radius,
  };
}

export function antDestination(ant, tasks, viewport, elapsedMs = 0) {
  const task = ant.targetTaskId ? tasks[ant.targetTaskId] : null;
  return task ? taskPosition(task, tasks, viewport) : idlePosition(ant.id, elapsedMs, viewport);
}

export function pheromoneVisual(pheromones = {}) {
  const values = ["urgency", "confidence", "demand", "verification"].map((key) => pheromones[key] ?? 0);
  const intensity = Math.max(0, Math.min(1, values.reduce((sum, value) => sum + value, 0) / values.length));
  return {
    intensity,
    haloRadius: 18 + intensity * 28,
    alpha: 0.12 + intensity * 0.48,
    trailWidth: 0.75 + intensity * 4,
  };
}

export function profileAppearance(profile) {
  const key = String(profile).toLowerCase();
  if (key === "verifier") return { shape: "diamond", color: "#ffca58" };
  if (key === "synthesizer") return { shape: "hexagon", color: "#ef77ff" };
  return { shape: "circle", color: "#6de6b5" };
}
