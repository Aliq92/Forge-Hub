// Orbital Bloom - DOM wiring: panels, inspector, stats, presets, settings, modals
import {
  CONSTANTS, state, stats, saveSettings, loadSettings, loadLastPreset, clamp,
  saveLastSeed, loadLastSeed, saveSystemSnapshot, loadSystemSnapshot,
} from './config.js';
import { attractors, getAttractor, removeAttractor, setMass, duplicateAttractor, createAttractor, clearAttractors } from './attractors.js';
import * as P from './particles.js';
import { nearbyParticleCount } from './gravity.js';
import * as Renderer from './renderer.js';
import { listPresets, loadPreset } from './presets.js';
import { generateSystem, randomSeed } from './generator.js';
import { CHALLENGES, challengeState, startChallenge, stopChallenge, updateChallenge } from './challenges.js';
import * as Sim from './simulation.js';
import { focusOnSelected } from './tools.js';

let camera = null;
let canvas = null;

const $ = (id) => document.getElementById(id);

export function initUI(cameraRef, canvasRef) {
  camera = cameraRef;
  canvas = canvasRef;

  wireScreens();
  wireModals();
  wireAccordion();
  wireToolRail();
  wireSpawnPanel();
  wireAttractorPanel();
  wireWorldPanel();
  wireSimControls();
  wireSettingsModal();
  wireInspector();
  wireKeyboard();
  wireGenerator();
  wireCinematic();
  wireSaveLoad();
  wireOnboarding();
  buildPresetGrids();
  buildChallengeList();

  window.addEventListener('ob:selection-changed', refreshInspector);
  window.addEventListener('ob:preset-loaded', () => {
    syncAllControlsFromState();
    refreshInspector();
  });

  syncAllControlsFromState();
  refreshInspector();
  setInterval(uiTick, 150);
}

// ---------- Screens ----------
function wireScreens() {
  $('btn-enter-sandbox').addEventListener('click', () => enterSandbox());
  $('btn-back-title').addEventListener('click', () => {
    document.getElementById('sandbox-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
  });
}

function enterSandbox(presetId) {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('sandbox-screen').classList.remove('hidden');
  camera._vw = canvas.clientWidth;
  camera._vh = canvas.clientHeight;
  if (attractors.length === 0 && P.count === 0) {
    const last = presetId || loadLastPreset() || 'accretionDisc';
    loadPreset(last, camera);
    syncAllControlsFromState();
  }
  maybeShowOnboarding();
}

// ---------- Modals ----------
function openModal(id) {
  $('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  $(id).classList.remove('hidden');
}
function closeModals() {
  $('modal-overlay').classList.add('hidden');
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}
function wireModals() {
  $('btn-title-presets').addEventListener('click', () => openModal('modal-presets'));
  $('btn-title-how').addEventListener('click', () => openModal('modal-how'));
  $('btn-title-settings').addEventListener('click', () => openModal('modal-settings'));
  $('btn-settings-open').addEventListener('click', () => openModal('modal-settings'));
  $('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModals(); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));
}

// ---------- Accordion ----------
function wireAccordion() {
  document.querySelectorAll('.panel-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.panel-section');
      section.classList.toggle('collapsed');
    });
  });
}

// ---------- Tool rail ----------
function wireToolRail() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTool = btn.dataset.tool;
    });
  });
}

// ---------- Spawn panel ----------
function wireSpawnPanel() {
  $('spawn-cloud-mode').addEventListener('change', (e) => { state.spawnMode = e.target.value; });
  $('spawn-amount').addEventListener('change', (e) => { state.spawnAmount = parseInt(e.target.value, 10); });
  bindRange('spawn-radius', 'out-spawn-radius', (v) => { state.spawnRadius = v; }, (v) => v.toFixed(0));
  bindRange('spawn-spread', 'out-spawn-spread', (v) => { state.spawnSpread = v; }, (v) => v.toFixed(2));
  bindRange('spawn-speed', 'out-spawn-speed', (v) => { state.spawnSpeed = v; }, (v) => v.toFixed(0));
  bindRange('spawn-spin', 'out-spawn-spin', (v) => { state.spawnSpin = v; }, (v) => v.toFixed(0));
  $('spawn-continuous').addEventListener('change', (e) => { state.continuousStream = e.target.checked; });
}

// ---------- Attractor defaults ----------
function wireAttractorPanel() {
  $('attractor-fixed').addEventListener('change', (e) => { state.attractorFixed = e.target.checked; });
}

// ---------- World & visuals ----------
function wireWorldPanel() {
  bindRange('gravity-strength', 'out-gravity', (v) => { state.gravityStrength = v; saveSettings(); }, (v) => v.toFixed(2));
  $('trail-length').addEventListener('change', (e) => { state.trailLength = e.target.value; saveSettings(); });
  $('trail-style').addEventListener('change', (e) => { state.trailStyle = e.target.value; saveSettings(); });
  $('color-mode').addEventListener('change', (e) => { state.colorMode = e.target.value; saveSettings(); });
  bindRange('particle-brightness', 'out-brightness', (v) => { state.particleBrightness = v; saveSettings(); }, (v) => v.toFixed(2));
  bindRange('particle-size', 'out-size', (v) => { state.particleSize = v; saveSettings(); }, (v) => v.toFixed(2));
  $('absorb-mode').addEventListener('change', (e) => { state.absorbMode = e.target.value; saveSettings(); });
  $('collision-mode').addEventListener('change', (e) => { state.collisionMode = e.target.value; saveSettings(); });
  $('classification-overlay').addEventListener('change', (e) => { state.classificationOverlay = e.target.checked; });
  $('gravity-overlay').addEventListener('change', (e) => { state.gravityOverlay = e.target.checked; });
}

function bindRange(inputId, outId, onChange, fmt) {
  const el = $(inputId);
  const out = $(outId);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    if (out) out.textContent = fmt ? fmt(v) : v;
    onChange(v);
  });
}

// ---------- Sim controls ----------
function wireSimControls() {
  $('btn-play-pause').addEventListener('click', togglePlayPause);
  $('btn-step').addEventListener('click', () => Sim.stepForward());
  $('select-speed').addEventListener('change', (e) => { state.speedMultiplier = parseFloat(e.target.value); });

  $('btn-cam-reset').addEventListener('click', () => camera.reset());
  $('btn-cam-fit').addEventListener('click', () => fitCameraToScene());
  $('btn-cam-focus').addEventListener('click', () => {
    if (state.selectedAttractorId == null) { showToast('No attractor selected'); return; }
    focusOnSelected(camera);
  });

  $('btn-clear-trails').addEventListener('click', () => { Renderer.clearTrails(); showToast('Trails cleared'); });
  $('btn-clear-particles').addEventListener('click', () => { Sim.clearParticlesOnly(); showToast('Particles cleared'); });
  $('btn-clear-attractors').addEventListener('click', () => { Sim.clearAttractorsOnly(); refreshInspector(); showToast('Attractors cleared'); });
  $('btn-clear-all').addEventListener('click', () => { Sim.clearAllBodies(); refreshInspector(); showToast('Cleared all'); });
  $('btn-reset-sim').addEventListener('click', () => { Sim.resetSimulation(); refreshInspector(); syncAllControlsFromState(); showToast('Simulation reset'); });

  $('btn-panels-toggle').addEventListener('click', () => {
    document.getElementById('side-panel').classList.toggle('open-mobile');
    document.getElementById('tool-rail').classList.toggle('open-mobile');
  });
}

function togglePlayPause() {
  state.running = !state.running;
  $('play-pause-label').textContent = state.running ? 'Pause' : 'Resume';
  $('play-pause-icon').innerHTML = state.running ? '&#10074;&#10074;' : '&#9654;';
}

function fitCameraToScene() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of attractors) {
    minX = Math.min(minX, a.x - a.radius * 3); maxX = Math.max(maxX, a.x + a.radius * 3);
    minY = Math.min(minY, a.y - a.radius * 3); maxY = Math.max(maxY, a.y + a.radius * 3);
  }
  const step = Math.max(1, Math.floor(P.count / 1500));
  for (let i = 0; i < P.count; i += step) {
    minX = Math.min(minX, P.px[i]); maxX = Math.max(maxX, P.px[i]);
    minY = Math.min(minY, P.py[i]); maxY = Math.max(maxY, P.py[i]);
  }
  if (!isFinite(minX)) { camera.reset(); return; }
  camera.fitBounds(minX, minY, maxX, maxY, canvas.clientWidth, canvas.clientHeight);
}

// ---------- Settings modal ----------
function wireSettingsModal() {
  $('setting-particle-density').addEventListener('change', (e) => {
    state.particleDensityPref = e.target.value;
    const map = { low: 500, medium: 1000, high: 2500 };
    const v = map[e.target.value];
    state.spawnAmount = v;
    $('spawn-amount').value = String(v);
    saveSettings();
  });
  $('setting-render-quality').addEventListener('change', (e) => { state.renderQuality = e.target.value; saveSettings(); });
  $('setting-bg-density').addEventListener('change', (e) => {
    state.backgroundDensity = parseFloat(e.target.value);
    Renderer.buildBackground();
    saveSettings();
  });
  $('setting-motion-blur').addEventListener('change', (e) => { state.motionBlur = e.target.checked; saveSettings(); });
  $('setting-reduced-motion').addEventListener('change', (e) => { state.reducedMotion = e.target.checked; saveSettings(); });
  $('setting-show-fps').addEventListener('change', (e) => {
    state.showFPS = e.target.checked;
    $('stat-fps').classList.toggle('hidden', !state.showFPS);
    saveSettings();
  });
  $('setting-screen-flash').addEventListener('change', (e) => { state.screenFlash = e.target.checked; saveSettings(); });
}

// ---------- Inspector ----------
function wireInspector() {
  $('insp-name').addEventListener('input', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) a.name = e.target.value.slice(0, 24) || a.name;
  });
  $('insp-mass').addEventListener('input', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) {
      setMass(a, parseFloat(e.target.value));
      $('out-insp-mass').textContent = Math.round(a.mass);
      $('insp-radius').value = a.radius;
      $('out-insp-radius').textContent = Math.round(a.radius);
    }
  });
  $('insp-radius').addEventListener('input', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) { a.radius = clamp(parseFloat(e.target.value), 5, 90); $('out-insp-radius').textContent = Math.round(a.radius); }
  });
  $('insp-px').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) a.x = parseFloat(e.target.value) || 0;
  });
  $('insp-py').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) a.y = parseFloat(e.target.value) || 0;
  });
  $('insp-vx').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a && !a.fixed) a.vx = clamp(parseFloat(e.target.value) || 0, -CONSTANTS.MAX_ATTRACTOR_SPEED, CONSTANTS.MAX_ATTRACTOR_SPEED);
  });
  $('insp-vy').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a && !a.fixed) a.vy = clamp(parseFloat(e.target.value) || 0, -CONSTANTS.MAX_ATTRACTOR_SPEED, CONSTANTS.MAX_ATTRACTOR_SPEED);
  });
  $('insp-fixed').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) { a.fixed = e.target.checked; if (a.fixed) { a.vx = 0; a.vy = 0; } }
  });
  $('insp-trail').addEventListener('change', (e) => {
    const a = getAttractor(state.selectedAttractorId);
    if (a) a.showTrail = e.target.checked;
  });
  document.querySelectorAll('#insp-color-swatches .swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const a = getAttractor(state.selectedAttractorId);
      if (a) { a.color = sw.dataset.color; refreshInspector(); }
    });
  });
  $('btn-insp-focus').addEventListener('click', () => focusOnSelected(camera));
  $('btn-insp-duplicate').addEventListener('click', () => {
    if (state.selectedAttractorId == null) return;
    const copy = duplicateAttractor(state.selectedAttractorId);
    if (copy) { dispatchSelectionUI(copy.id); showToast(`Duplicated ${copy.name}`); }
  });
  $('btn-insp-delete').addEventListener('click', () => {
    if (state.selectedAttractorId != null) {
      removeAttractor(state.selectedAttractorId);
      state.selectedAttractorId = null;
      refreshInspector();
    }
  });
}

function dispatchSelectionUI(id) {
  state.selectedAttractorId = id;
  window.dispatchEvent(new CustomEvent('ob:selection-changed', { detail: { id } }));
}

function refreshInspector() {
  const a = getAttractor(state.selectedAttractorId);
  const section = $('inspector-section');
  if (!a) { section.style.display = 'none'; return; }
  section.style.display = '';
  const active = document.activeElement;

  if (active !== $('insp-name')) $('insp-name').value = a.name;
  $('insp-type').textContent = a.type.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  if (active !== $('insp-mass')) { $('insp-mass').value = a.mass; }
  $('out-insp-mass').textContent = Math.round(a.mass);
  if (active !== $('insp-radius')) $('insp-radius').value = a.radius;
  $('out-insp-radius').textContent = Math.round(a.radius);
  if (active !== $('insp-px')) $('insp-px').value = Math.round(a.x);
  if (active !== $('insp-py')) $('insp-py').value = Math.round(a.y);
  if (active !== $('insp-vx')) $('insp-vx').value = Math.round(a.vx);
  if (active !== $('insp-vy')) $('insp-vy').value = Math.round(a.vy);
  $('insp-speed').textContent = Math.round(Math.hypot(a.vx, a.vy));
  $('insp-nearby').textContent = nearbyParticleCount(a, 180);
  if (active !== $('insp-fixed')) $('insp-fixed').checked = a.fixed;
  if (active !== $('insp-trail')) $('insp-trail').checked = a.showTrail !== false;
  document.querySelectorAll('#insp-color-swatches .swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === a.color);
  });
}

// ---------- Random system generator ----------
function wireGenerator() {
  const seedInput = $('generator-seed');
  const savedSeed = loadLastSeed();
  if (savedSeed) seedInput.value = savedSeed;

  $('btn-generator-seed-random').addEventListener('click', () => {
    seedInput.value = randomSeed();
  });
  $('btn-generate-system').addEventListener('click', () => {
    const seed = generateSystem(seedInput.value, camera);
    seedInput.value = seed;
    syncAllControlsFromState();
    refreshInspector();
    showToast(`Generated system · seed ${seed}`);
  });
}

// ---------- Cinematic mode & fullscreen ----------
let cursorHideTimer = null;
function wireCinematic() {
  $('btn-cinematic').addEventListener('click', enterCinematic);
  $('btn-cinematic-exit').addEventListener('click', exitCinematic);
  $('btn-fullscreen').addEventListener('click', toggleFullscreen);
  $('btn-cam-follow').addEventListener('click', () => {
    state.followBody = !state.followBody;
    $('btn-cam-follow').classList.toggle('active-toggle', state.followBody);
    if (state.followBody && state.selectedAttractorId == null) {
      showToast('Select a body to follow it');
    }
  });

  const sandbox = document.getElementById('sandbox-screen');
  sandbox.addEventListener('mousemove', () => {
    if (!state.cinematicMode) return;
    sandbox.classList.remove('cursor-hidden');
    clearTimeout(cursorHideTimer);
    cursorHideTimer = setTimeout(() => sandbox.classList.add('cursor-hidden'), 2600);
  });
}

function enterCinematic() {
  state.cinematicMode = true;
  document.getElementById('sandbox-screen').classList.add('cinematic-active');
  $('btn-cinematic-exit').classList.remove('hidden');
}
function exitCinematic() {
  state.cinematicMode = false;
  const sandbox = document.getElementById('sandbox-screen');
  sandbox.classList.remove('cinematic-active');
  sandbox.classList.remove('cursor-hidden');
  $('btn-cinematic-exit').classList.add('hidden');
  clearTimeout(cursorHideTimer);
}
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => showToast('Fullscreen not available'));
  } else {
    document.exitFullscreen?.();
  }
}

// ---------- Save / Load system (bodies + settings, not raw particles) ----------
function wireSaveLoad() {
  $('btn-save-system').addEventListener('click', () => {
    const snapshot = {
      attractors: attractors.map(a => ({
        type: a.type, x: a.x, y: a.y, vx: a.vx, vy: a.vy, mass: a.mass,
        radius: a.radius, fixed: a.fixed, color: a.color, showTrail: a.showTrail, name: a.name,
      })),
      camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
      colorMode: state.colorMode, gravityStrength: state.gravityStrength,
      collisionMode: state.collisionMode, seed: state.lastSeed,
    };
    if (saveSystemSnapshot(snapshot)) showToast('System saved');
    else showToast('Could not save (storage unavailable)');
  });

  $('btn-load-system').addEventListener('click', () => {
    const snap = loadSystemSnapshot();
    if (!snap) { showToast('No saved system found'); return; }
    clearAttractors();
    P.resetParticles();
    state.selectedAttractorId = null;
    for (const a of snap.attractors || []) {
      const created = createAttractor(a.type, a.x, a.y, {
        mass: a.mass, vx: a.vx, vy: a.vy, fixed: a.fixed, color: a.color,
        showTrail: a.showTrail, name: a.name,
      });
      if (a.radius) created.radius = a.radius;
    }
    if (snap.camera) camera.animateTo(snap.camera.x, snap.camera.y, snap.camera.zoom, 0.5);
    if (snap.colorMode) state.colorMode = snap.colorMode;
    if (snap.gravityStrength) state.gravityStrength = snap.gravityStrength;
    if (snap.collisionMode) state.collisionMode = snap.collisionMode;
    if (snap.seed) { state.lastSeed = snap.seed; $('generator-seed').value = snap.seed; }
    Renderer.clearTrails();
    syncAllControlsFromState();
    refreshInspector();
    showToast('System loaded — add particles to bring it to life');
  });
}

// ---------- Onboarding ----------
const ONBOARDING_KEY = 'orbitalBloom.onboardingSeen.v1';
function wireOnboarding() {
  $('btn-onboarding-dismiss').addEventListener('click', dismissOnboarding);
}
function dismissOnboarding() {
  $('onboarding-guide').classList.add('hidden');
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch (e) {}
}
function maybeShowOnboarding() {
  try {
    if (!localStorage.getItem(ONBOARDING_KEY)) $('onboarding-guide').classList.remove('hidden');
  } catch (e) {}
}

// ---------- Presets ----------
function buildPresetGrids() {
  const presets = listPresets();
  for (const container of [$('preset-grid'), $('preset-grid-modal')]) {
    container.innerHTML = '';
    for (const p of presets) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        if (document.getElementById('title-screen').classList.contains('hidden') === false) {
          enterSandbox(p.id);
        } else {
          loadPreset(p.id, camera);
          syncAllControlsFromState();
          refreshInspector();
        }
        closeModals();
        showToast(`Loaded: ${p.label}`);
      });
      container.appendChild(btn);
    }
  }
}

// ---------- Challenges ----------
function buildChallengeList() {
  const list = $('challenge-list');
  list.innerHTML = '';
  for (const [id, def] of Object.entries(CHALLENGES)) {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${def.label}</div>
      <div class="challenge-desc">${def.description}</div>
      <div class="challenge-bar"><div class="challenge-bar-fill" id="chal-bar-${id}"></div></div>
      <div class="challenge-row">
        <span id="chal-status-${id}" class="challenge-status">Idle</span>
        <button class="btn btn-compact" data-challenge="${id}">Start</button>
      </div>`;
    list.appendChild(card);
    card.querySelector('button').addEventListener('click', () => {
      if (challengeState.active === id) { stopChallenge(); }
      else { startChallenge(id); }
      $('classification-overlay').checked = state.classificationOverlay;
      refreshChallengeUI();
    });
  }
}

function refreshChallengeUI() {
  for (const id of Object.keys(CHALLENGES)) {
    const bar = $(`chal-bar-${id}`);
    const status = $(`chal-status-${id}`);
    const btn = document.querySelector(`[data-challenge="${id}"]`);
    if (!bar) continue;
    if (challengeState.active === id) {
      bar.style.width = `${Math.round(challengeState.progress * 100)}%`;
      status.textContent = challengeState.status === 'success' ? 'Success!' : challengeState.status === 'failed' ? 'Failed' : `Running ${Math.round(challengeState.elapsed)}s`;
      btn.textContent = 'Stop';
    } else {
      bar.style.width = '0%';
      status.textContent = 'Idle';
      btn.textContent = 'Start';
    }
  }
}

// ---------- Keyboard ----------
function wireKeyboard() {
  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (document.getElementById('sandbox-screen').classList.contains('hidden')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.key === 'r' || e.key === 'R') camera.reset();
    else if (e.key === 'f' || e.key === 'F') fitCameraToScene();
    else if (e.key === 'c' || e.key === 'C') { state.cinematicMode ? exitCinematic() : enterCinematic(); }
    else if (e.key === 'Escape') { if (state.cinematicMode) exitCinematic(); else closeModals(); }
  });
}

// ---------- Periodic UI tick ----------
function uiTick() {
  if (document.getElementById('sandbox-screen').classList.contains('hidden')) return;
  const s = Sim.liveParticleStats();
  $('stat-particles').textContent = s.count;
  $('stat-attractors').textContent = s.attractorCount;
  $('stat-simtime').textContent = `${stats.simTime.toFixed(1)}s`;
  $('stat-avgspeed').textContent = Math.round(s.avg);
  $('stat-maxspeed').textContent = Math.round(s.max);
  $('stat-absorbed').textContent = stats.absorbedCount;
  $('stat-gravity').textContent = `${state.gravityStrength.toFixed(2)}×`;
  $('stat-fps-panel').textContent = stats.fps;
  if (state.showFPS) $('stat-fps').textContent = `${stats.fps} FPS`;

  let bound = 0, falling = 0, escaping = 0, chaotic = 0;
  for (let i = 0; i < P.count; i++) {
    const c = P.pclass[i];
    if (c === 0) bound++; else if (c === 1) falling++; else if (c === 2) escaping++; else chaotic++;
  }
  $('stat-bound').textContent = bound;
  $('stat-falling').textContent = falling;
  $('stat-escaping').textContent = escaping;
  $('stat-chaotic').textContent = chaotic;

  refreshInspector();
  refreshChallengeUI();
}

// ---------- Sync all controls from state (on load / preset change) ----------
export function syncAllControlsFromState() {
  $('gravity-strength').value = state.gravityStrength; $('out-gravity').textContent = state.gravityStrength.toFixed(2);
  $('trail-length').value = state.trailLength;
  $('trail-style').value = state.trailStyle;
  $('color-mode').value = state.colorMode;
  $('particle-brightness').value = state.particleBrightness; $('out-brightness').textContent = state.particleBrightness.toFixed(2);
  $('particle-size').value = state.particleSize; $('out-size').textContent = state.particleSize.toFixed(2);
  $('absorb-mode').value = state.absorbMode;
  $('classification-overlay').checked = state.classificationOverlay;
  $('select-speed').value = String(state.speedMultiplier);
  $('spawn-amount').value = String(state.spawnAmount);

  $('setting-render-quality').value = state.renderQuality;
  $('collision-mode').value = state.collisionMode;
  $('gravity-overlay').checked = state.gravityOverlay;
  $('btn-cam-follow').classList.toggle('active-toggle', state.followBody);
  $('setting-particle-density').value = state.particleDensityPref;
  $('setting-motion-blur').checked = state.motionBlur;
  $('setting-reduced-motion').checked = state.reducedMotion;
  $('setting-show-fps').checked = state.showFPS;
  $('setting-screen-flash').checked = state.screenFlash;
  $('stat-fps').classList.toggle('hidden', !state.showFPS);

  const bgOpt = [...document.getElementById('setting-bg-density').options].find(o => Math.abs(parseFloat(o.value) - state.backgroundDensity) < 0.01);
  if (bgOpt) $('setting-bg-density').value = bgOpt.value;

  $('play-pause-label').textContent = state.running ? 'Pause' : 'Resume';
  $('play-pause-icon').innerHTML = state.running ? '&#10074;&#10074;' : '&#9654;';
}

// ---------- Toast ----------
let toastTimer = null;
export function showToast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
