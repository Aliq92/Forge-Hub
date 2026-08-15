function normalizeAnt(ant) {
  return {
    id: ant.id,
    profile: ant.profile,
    activity: ant.activity,
    targetTaskId: ant.target_task_id ?? ant.targetTaskId ?? null,
  };
}

function normalizeTask(task) {
  return {
    ...task,
    parentId: task.parent_id ?? task.parentId ?? null,
    targetTaskId: task.target_task_id ?? task.targetTaskId ?? null,
    claimedBy: task.claimed_by ?? task.claimedBy ?? null,
    pheromones: { urgency: 0, confidence: 0, demand: 0, verification: 0, ...(task.pheromones ?? {}) },
  };
}

export function createColonyState(snapshot) {
  const payload = snapshot.payload;
  return {
    runId: snapshot.run_id,
    sequence: snapshot.sequence,
    cycle: snapshot.cycle,
    colony: { ...payload.colony },
    ants: Object.fromEntries(payload.ants.map((ant) => [ant.id, normalizeAnt(ant)])),
    tasks: Object.fromEntries(payload.tasks.map((task) => [task.id, normalizeTask(task)])),
    results: Object.fromEntries(payload.results.map((result) => [result.id, { ...result }])),
    verifications: payload.verifications.map((record) => ({ ...record })),
    events: [],
    needsResnapshot: false,
  };
}

export function applyEvent(state, envelope) {
  if (envelope.event_type === "RESNAPSHOT_REQUIRED") {
    return { ...state, needsResnapshot: true };
  }
  if (envelope.sequence <= state.sequence) return state;
  if (envelope.sequence !== state.sequence + 1) {
    return { ...state, needsResnapshot: true };
  }

  const ants = Object.fromEntries(Object.entries(state.ants).map(([id, ant]) => [id, { ...ant }]));
  const tasks = Object.fromEntries(Object.entries(state.tasks).map(([id, task]) => [id, { ...task }]));
  const results = Object.fromEntries(Object.entries(state.results).map(([id, result]) => [id, { ...result }]));
  const verifications = state.verifications.map((record) => ({ ...record }));
  const colony = { ...state.colony, cycle: envelope.cycle };
  const payload = envelope.payload;

  switch (envelope.event_type) {
    case "TASK_CREATED": {
      const task = normalizeTask(payload.task);
      tasks[task.id] = task;
      break;
    }
    case "TASK_CLAIMED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "CLAIMED", claimedBy: payload.ant_id };
      if (ants[payload.ant_id]) {
        ants[payload.ant_id].targetTaskId = payload.task_id;
        ants[payload.ant_id].activity = "MOVING_TO_TASK";
      }
      break;
    case "ANT_CREATED":
      ants[payload.ant_id] = normalizeAnt({ id: payload.ant_id, profile: payload.profile, activity: "IDLE" });
      break;
    case "ANT_ACTIVITY_CHANGED":
      if (ants[payload.ant_id]) {
        ants[payload.ant_id].activity = payload.activity;
        ants[payload.ant_id].targetTaskId = payload.target_task_id;
      }
      break;
    case "PHEROMONE_CHANGED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], pheromones: { ...payload.pheromones } };
      break;
    case "RESULT_RECORDED":
      results[payload.result.id] = { ...payload.result };
      break;
    case "TASK_COMPLETED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "COMPLETED", confidence: payload.confidence ?? tasks[payload.task_id].confidence };
      break;
    case "TASK_REOPENED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "OPEN", claimedBy: null };
      break;
    case "TASK_VERIFIED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "VERIFIED" };
      break;
    case "TASK_FAILED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "FAILED", claimedBy: null };
      break;
    case "TASK_BLOCKED":
      tasks[payload.task_id] = { ...tasks[payload.task_id], status: "BLOCKED", claimedBy: null };
      break;
    case "CONFIDENCE_CHANGED":
      if (tasks[payload.subject_id]) tasks[payload.subject_id].confidence = payload.new;
      break;
    case "VERIFICATION_RECORDED":
      verifications.push({ ...payload });
      break;
    case "SYNTHESIS_STARTED":
      colony.synthesis_active = true;
      break;
    case "COLONY_COMPLETED":
      colony.status = "COMPLETED";
      colony.synthesis_active = false;
      colony.final_result = results[payload.final_result_id ?? payload.subject_id] ?? null;
      break;
    case "COLONY_STALLED":
      colony.status = "STALLED";
      break;
  }

  return {
    ...state,
    sequence: envelope.sequence,
    cycle: envelope.cycle,
    colony,
    ants,
    tasks,
    results,
    verifications,
    events: [...state.events, envelope].slice(-100),
    needsResnapshot: false,
  };
}
