(function (WF) {
  'use strict';

  const {
    GRID_W, GRID_H, PRESETS, dirToCompass, SIM_STEP, MAX_STEPS_PER_FRAME,
    generateTerrain, FireSim, SmokeSystem, Renderer, NATIVE_W, NATIVE_H,
    el, setActive, renderStats, updateWindDisplay, logEvent, clearLog, showSummary, hideSummary,
  } = WF;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const state = {
  env: { dryness: 0.45, moisture: 0.40, temperature: 0.50, windDir: 0, windStrength: 0.30 },
  tool: 'ignite',
  toolRadius: 3,
  speed: 1,
  running: false,
  presetSelected: 'calm',
  seed: 0,
  sim: null,
  camera: { zoom: 1, panX: 0, panY: 0, fitScale: 1 },
};

const renderer = new Renderer({
  terrainCanvas: el.terrainCanvas,
  fireCanvas: el.fireCanvas,
  smokeCanvas: el.smokeCanvas,
  stage: el.canvasStage,
});
const smoke = new SmokeSystem(NATIVE_W / GRID_W);

function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function newTerrain(seed) {
  state.seed = seed >>> 0;
  const grid = generateTerrain(state.seed);
  state.sim = new FireSim(grid, state.env, state.seed);
  smoke.reset();
  renderer.bakeFull(state.sim);
  clearLog();
  renderStats(state.sim.getStats());
  el.seedDisplay.textContent = 'Seed ' + state.seed.toString(36).toUpperCase().slice(0, 8);
  hideSummary();
  state.running = false;
  setPlayButton(false);
  logEvent('Terrain generated', '', 0);
}

// --- Camera --------------------------------------------------------------

function computeFitScale() {
  const rect = el.canvasWrap.getBoundingClientRect();
  const pad = 20;
  const availW = Math.max(80, rect.width - pad * 2);
  const availH = Math.max(80, rect.height - pad * 2);
  state.camera.fitScale = Math.min(availW / NATIVE_W, availH / NATIVE_H);
}

function applyCameraTransform() {
  const total = state.camera.fitScale * state.camera.zoom;
  el.canvasStage.style.transform = `translate(${state.camera.panX}px, ${state.camera.panY}px) scale(${total})`;
}

window.addEventListener('resize', () => { computeFitScale(); applyCameraTransform(); });

// --- Input: pointer mapping ------------------------------------------------

function gridFromClient(clientX, clientY) {
  const rect = el.canvasStage.getBoundingClientRect();
  let gx = (clientX - rect.left) / rect.width * GRID_W;
  let gy = (clientY - rect.top) / rect.height * GRID_H;
  gx = clamp(gx, 0, GRID_W - 1);
  gy = clamp(gy, 0, GRID_H - 1);
  return { gx, gy };
}

function applyTool(gx, gy, isStart) {
  const sim = state.sim;
  if (!sim) return;
  const r = state.toolRadius;
  switch (state.tool) {
    case 'ignite': {
      const n = sim.ignite(gx, gy, r, isStart);
      if (isStart && n > 0) logEvent('Fire started', 'ignite', sim.simTime);
      break;
    }
    case 'firebreak': {
      const n = sim.applyFirebreak(gx, gy, r);
      if (isStart && n > 0) logEvent('Firebreak created', 'firebreak', sim.simTime);
      break;
    }
    case 'containment': {
      const n = sim.applyContainment(gx, gy, r);
      if (isStart && n > 0) logEvent('Containment line created', 'firebreak', sim.simTime);
      break;
    }
    case 'water': {
      sim.applyWaterDrop(gx, gy, r);
      if (isStart) { sim.waterDropsUsed++; logEvent('Water drop deployed', 'water', sim.simTime); }
      break;
    }
    case 'clear': {
      sim.applyClearVegetation(gx, gy, r);
      break;
    }
  }
}

function updateCursor(clientX, clientY, visible) {
  const wrapRect = el.canvasWrap.getBoundingClientRect();
  const stageRect = el.canvasStage.getBoundingClientRect();
  const cellPxOnScreen = stageRect.width / GRID_W;
  const diameter = state.toolRadius * 2 * cellPxOnScreen;
  el.ignitionCursor.style.width = diameter + 'px';
  el.ignitionCursor.style.height = diameter + 'px';
  el.ignitionCursor.style.left = (clientX - wrapRect.left) + 'px';
  el.ignitionCursor.style.top = (clientY - wrapRect.top) + 'px';
  el.ignitionCursor.style.display = visible ? 'block' : 'none';
  el.ignitionCursor.dataset.tool = state.tool;
}

const activePointers = new Map();
let paintPointerId = null;
let isPanning = false;
let panLast = null;
let panPointerIds = null;
let pinchStartDist = 0;
let pinchStartZoom = 1;

function centroid(pts) { return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

el.canvasStage.addEventListener('pointerdown', (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { el.canvasStage.setPointerCapture(e.pointerId); } catch (_) {}

  if (e.pointerType === 'touch' && activePointers.size === 2) {
    paintPointerId = null;
    const pts = [...activePointers.values()];
    panLast = centroid(pts);
    pinchStartDist = dist(pts[0], pts[1]);
    pinchStartZoom = state.camera.zoom;
    panPointerIds = [...activePointers.keys()];
    return;
  }
  if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
    isPanning = true;
    panLast = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (paintPointerId === null && activePointers.size === 1) {
    paintPointerId = e.pointerId;
    const { gx, gy } = gridFromClient(e.clientX, e.clientY);
    applyTool(gx, gy, true);
    updateCursor(e.clientX, e.clientY, true);
  }
});

el.canvasStage.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (panPointerIds && activePointers.size >= 2) {
    const pts = [...activePointers.values()].slice(0, 2);
    const c = centroid(pts);
    if (panLast) { state.camera.panX += c.x - panLast.x; state.camera.panY += c.y - panLast.y; }
    panLast = c;
    const d = dist(pts[0], pts[1]);
    if (pinchStartDist > 0) state.camera.zoom = clamp(pinchStartZoom * (d / pinchStartDist), 0.5, 3);
    applyCameraTransform();
    return;
  }
  if (isPanning && panLast) {
    state.camera.panX += e.clientX - panLast.x;
    state.camera.panY += e.clientY - panLast.y;
    panLast = { x: e.clientX, y: e.clientY };
    applyCameraTransform();
    return;
  }
  if (e.pointerType === 'mouse') updateCursor(e.clientX, e.clientY, true);
  if (paintPointerId === e.pointerId) {
    const { gx, gy } = gridFromClient(e.clientX, e.clientY);
    applyTool(gx, gy, false);
    if (e.pointerType === 'touch') updateCursor(e.clientX, e.clientY, true);
  }
});

function endPointer(e) {
  activePointers.delete(e.pointerId);
  if (paintPointerId === e.pointerId) paintPointerId = null;
  if (panPointerIds && panPointerIds.includes(e.pointerId)) { panPointerIds = null; panLast = null; pinchStartDist = 0; }
  if (isPanning) { isPanning = false; panLast = null; }
  if (e.pointerType === 'touch') updateCursor(0, 0, false);
}
el.canvasStage.addEventListener('pointerup', endPointer);
el.canvasStage.addEventListener('pointercancel', endPointer);
el.canvasWrap.addEventListener('pointerleave', () => { if (activePointers.size === 0) updateCursor(0, 0, false); });
el.canvasWrap.addEventListener('contextmenu', (e) => e.preventDefault());

el.canvasWrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  state.camera.zoom = clamp(state.camera.zoom * factor, 0.5, 3);
  applyCameraTransform();
}, { passive: false });

el.camZoomIn.onclick = () => { state.camera.zoom = clamp(state.camera.zoom * 1.25, 0.5, 3); applyCameraTransform(); };
el.camZoomOut.onclick = () => { state.camera.zoom = clamp(state.camera.zoom / 1.25, 0.5, 3); applyCameraTransform(); };
el.camReset.onclick = () => { state.camera.zoom = 1; state.camera.panX = 0; state.camera.panY = 0; applyCameraTransform(); };

// --- Tools & view UI -------------------------------------------------------

el.toolGrid.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.tool = btn.dataset.tool;
    setActive(el.toolGrid, '.tool-btn', (b) => b === btn);
  });
});

el.toolRadius.addEventListener('input', () => {
  state.toolRadius = parseInt(el.toolRadius.value, 10);
  el.toolRadiusVal.textContent = String(state.toolRadius);
});

el.viewButtons.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    renderer.setView(btn.dataset.view);
    setActive(el.viewButtons, 'button', (b) => b === btn);
    if (state.sim) renderer.bakeFull(state.sim);
  });
});

// --- Environment sliders & presets -----------------------------------------

function markCustom() {
  state.presetSelected = 'custom';
  setActive(el.presetGrid, '.preset-btn', (b) => b.dataset.preset === 'custom');
}

el.dryness.addEventListener('input', () => {
  state.env.dryness = el.dryness.value / 100;
  el.drynessVal.textContent = el.dryness.value + '%';
  markCustom();
});
el.moisture.addEventListener('input', () => {
  state.env.moisture = el.moisture.value / 100;
  el.moistureVal.textContent = el.moisture.value + '%';
  markCustom();
});
el.temperature.addEventListener('input', () => {
  state.env.temperature = el.temperature.value / 100;
  el.temperatureVal.textContent = el.temperature.value + '%';
  markCustom();
});
let lastWindStrength = state.env.windStrength;
el.windStrength.addEventListener('input', () => {
  state.env.windStrength = el.windStrength.value / 100;
  el.windStrengthVal.textContent = el.windStrength.value + '%';
  updateWindDisplay(state.env.windDir, state.env.windStrength);
  markCustom();
});
el.windStrength.addEventListener('change', () => {
  if (!state.sim) return;
  const dir = state.env.windStrength > lastWindStrength ? 'increased' : 'decreased';
  logEvent(`Wind strength ${dir} to ${Math.round(state.env.windStrength * 100)}%`, 'wind', state.sim.simTime);
  lastWindStrength = state.env.windStrength;
});

function applyPreset(key) {
  if (key === 'custom') { markCustom(); return; }
  const p = PRESETS[key];
  el.dryness.value = p.dryness;
  el.moisture.value = p.moisture;
  el.temperature.value = p.temperature;
  el.windStrength.value = p.windStrength;
  state.env.dryness = p.dryness / 100;
  state.env.moisture = p.moisture / 100;
  state.env.temperature = p.temperature / 100;
  state.env.windStrength = p.windStrength / 100;
  lastWindStrength = state.env.windStrength;
  el.drynessVal.textContent = p.dryness + '%';
  el.moistureVal.textContent = p.moisture + '%';
  el.temperatureVal.textContent = p.temperature + '%';
  el.windStrengthVal.textContent = p.windStrength + '%';
  state.presetSelected = key;
  setActive(el.presetGrid, '.preset-btn', (b) => b.dataset.preset === key);
  updateWindDisplay(state.env.windDir, state.env.windStrength);
}
el.presetGrid.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

// --- Wind compass ------------------------------------------------------

let compassDragging = false;
function angleFromCompassEvent(e) {
  const rect = el.windCompass.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += Math.PI * 2;
  return angle;
}
function setWindDir(angle) {
  state.env.windDir = angle;
  updateWindDisplay(angle, state.env.windStrength);
}
el.windCompass.addEventListener('pointerdown', (e) => {
  compassDragging = true;
  try { el.windCompass.setPointerCapture(e.pointerId); } catch (_) {}
  setWindDir(angleFromCompassEvent(e));
});
el.windCompass.addEventListener('pointermove', (e) => { if (compassDragging) setWindDir(angleFromCompassEvent(e)); });
el.windCompass.addEventListener('pointerup', () => {
  if (compassDragging) {
    compassDragging = false;
    if (state.sim) logEvent(`Wind direction changed to ${dirToCompass(state.env.windDir)}`, 'wind', state.sim.simTime);
  }
});

// --- Sim controls ------------------------------------------------------

function setPlayButton(running) {
  const iconPlay = el.btnPlay.querySelector('.icon-play');
  const iconPause = el.btnPlay.querySelector('.icon-pause');
  const label = el.btnPlay.querySelector('.btn-label');
  iconPlay.style.display = running ? 'none' : '';
  iconPause.style.display = running ? '' : 'none';
  label.textContent = running ? 'Pause' : 'Play';
}

el.btnPlay.addEventListener('click', () => {
  if (!state.sim || state.sim.completed) return;
  state.running = !state.running;
  setPlayButton(state.running);
});

el.btnReset.addEventListener('click', () => { newTerrain(state.seed); });
el.btnNewTerrain.addEventListener('click', () => { newTerrain(randomSeed()); });

el.speedButtons.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.speed = parseFloat(btn.dataset.speed);
    setActive(el.speedButtons, 'button', (b) => b === btn);
  });
});

el.btnMenuToggle.addEventListener('click', () => {
  const open = el.panelLeft.classList.toggle('open');
  el.panelRight.classList.toggle('open', open);
});

el.summaryClose.addEventListener('click', hideSummary);
el.summaryNew.addEventListener('click', () => { newTerrain(randomSeed()); });

// --- Milestones / completion ---------------------------------------------

function checkMilestones(sim, stats) {
  for (const m of [10, 25, 50, 75]) {
    if (stats.burnedPct >= m && !sim.hitMilestones.has(m)) {
      sim.hitMilestones.add(m);
      logEvent(`${m}% of terrain burned`, 'milestone', sim.simTime);
    }
  }
  if (stats.containmentPct >= 97 && sim.active.size > 0 && !sim._loggedContained) {
    sim._loggedContained = true;
    logEvent('Fire contained', 'contained', sim.simTime);
  }
}

function onFireComplete(sim, stats) {
  logEvent('Fire extinguished', 'contained', sim.simTime);
  state.running = false;
  setPlayButton(false);
  showSummary({
    burnedArea: stats.burnedArea,
    burnedPct: stats.burnedPct,
    simTime: stats.simTime,
    peakActiveCells: stats.peakActiveCells,
    ignitionPoints: stats.ignitionPoints,
    waterDropsUsed: stats.waterDropsUsed,
    firebreakLength: stats.firebreakLength,
    containmentPct: sim.lastContainmentPct,
  });
}

// --- Main loop ------------------------------------------------------------

let lastT = performance.now();
let lastStatsUpdate = 0;
let lastOverlayBake = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dtReal = (now - lastT) / 1000;
  lastT = now;
  dtReal = Math.min(dtReal, 0.25);

  const sim = state.sim;
  if (!sim) return;

  if (state.running && !sim.completed) {
    let acc = (frame._acc || 0) + dtReal * state.speed;
    let steps = 0;
    while (acc >= SIM_STEP && steps < MAX_STEPS_PER_FRAME) {
      sim.step(SIM_STEP);
      acc -= SIM_STEP;
      steps++;
    }
    frame._acc = acc;

    const windVec = sim.windVector();
    smoke.spawnFromFire(sim, dtReal * state.speed, windVec);
    smoke.update(dtReal * state.speed, windVec);
  }

  renderer.processDirty(sim);
  renderer.renderFireLayer(sim);
  renderer.renderSmoke(smoke);

  if (renderer.view !== 'terrain' && now - lastOverlayBake > 260) {
    renderer.bakeFull(sim);
    lastOverlayBake = now;
  }

  if (now - lastStatsUpdate > 220) {
    const stats = sim.getStats();
    renderStats(stats);
    if (state.running) checkMilestones(sim, stats);
    if (stats.completed && !sim._completionUiShown) {
      sim._completionUiShown = true;
      onFireComplete(sim, stats);
    }
    lastStatsUpdate = now;
  }
}

// --- Init -------------------------------------------------------------

function init() {
  computeFitScale();
  applyCameraTransform();
  updateWindDisplay(state.env.windDir, state.env.windStrength);
  newTerrain(randomSeed());
  requestAnimationFrame(frame);
}

init();
})(window.WF = window.WF || {});
