// Orbital Bloom - core constants and shared mutable state/settings

export const CONSTANTS = {
  MAX_PARTICLES: 6000,
  SOFTENING: 24,               // gravity softening radius (world units)
  MAX_PARTICLE_SPEED: 2600,    // hard velocity cap for particles
  MAX_ATTRACTOR_SPEED: 900,    // hard velocity cap for dynamic attractors
  MAX_MASS: 400000,
  MIN_MASS: 40,
  BASE_DT: 1 / 60,             // fixed physics timestep at 1x speed
  G_DEFAULT: 2600,             // base gravitational constant (scaled, not real units)
  MAX_ZOOM: 6,
  MIN_ZOOM: 0.08,
};

export const TRAIL_FADE = {
  off: 1,
  short: 0.32,
  medium: 0.13,
  long: 0.055,
  extreme: 0.022,
};

export const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

export const PALETTE = {
  white: '#eef3ff',
  cyan: '#5be3ff',
  violet: '#b389ff',
  gold: '#ffd27a',
  blue: '#5f7bff',
  bg: '#050611',
};

// Central mutable application state (settings + tool state)
export const state = {
  // simulation control
  running: true,
  speedMultiplier: 1,
  gravityStrength: 1,

  // visuals
  trailLength: 'medium',
  trailStyle: 'soft',
  colorMode: 'uniform',
  particleBrightness: 1,
  particleSize: 1,
  backgroundDensity: 1,
  motionBlur: false,
  renderQuality: 'auto', // 'low' | 'medium' | 'high' | 'auto'
  particleDensityPref: 'medium', // 'low' | 'medium' | 'high'

  // physics behavior
  absorbMode: 'absorb', // 'absorb' | 'passthrough'
  collisionMode: 'merge', // 'ignore' | 'merge' | 'bounce' | 'destroy'

  // camera / view
  followBody: false,
  cinematicMode: false,
  gravityOverlay: false,

  // random system generator
  lastSeed: null,

  // accessibility / prefs
  reducedMotion: false,
  showFPS: false,
  screenFlash: true,

  // tools
  currentTool: 'select',
  attractorType: 'star',
  attractorFixed: false,

  // spawn panel
  spawnMode: 'rotating', // static | rotating | jet | ring | disc
  spawnAmount: 500,
  spawnRadius: 120,
  spawnSpread: 0.35,
  spawnSpeed: 40,
  spawnSpin: 18,
  continuousStream: false,

  // selection
  selectedAttractorId: null,
  selectedKind: null, // 'attractor'

  // overlay
  classificationOverlay: false,
};

export const stats = {
  absorbedCount: 0,
  simTime: 0,
  fps: 0,
};

const SETTINGS_KEY = 'orbitalBloom.settings.v1';
const PRESET_KEY = 'orbitalBloom.lastPreset.v1';
const FAVORITES_KEY = 'orbitalBloom.favorites.v1';

const PERSISTED_KEYS = [
  'trailLength', 'trailStyle', 'colorMode', 'particleBrightness', 'particleSize',
  'backgroundDensity', 'motionBlur', 'reducedMotion', 'showFPS', 'screenFlash',
  'absorbMode', 'gravityStrength', 'renderQuality', 'particleDensityPref', 'collisionMode',
];

export function saveSettings() {
  try {
    const out = {};
    for (const k of PERSISTED_KEYS) out[k] = state[k];
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(out));
  } catch (e) { /* storage unavailable */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const k of PERSISTED_KEYS) {
      if (data[k] !== undefined) state[k] = data[k];
    }
  } catch (e) { /* ignore */ }
}

export function saveLastPreset(id) {
  try { localStorage.setItem(PRESET_KEY, id); } catch (e) {}
}
export function loadLastPreset() {
  try { return localStorage.getItem(PRESET_KEY); } catch (e) { return null; }
}

const SEED_KEY = 'orbitalBloom.lastSeed.v1';
export function saveLastSeed(seed) {
  try { localStorage.setItem(SEED_KEY, seed); } catch (e) {}
}
export function loadLastSeed() {
  try { return localStorage.getItem(SEED_KEY); } catch (e) { return null; }
}

const SYSTEM_KEY = 'orbitalBloom.savedSystem.v1';
export function saveSystemSnapshot(snapshot) {
  try { localStorage.setItem(SYSTEM_KEY, JSON.stringify(snapshot)); return true; }
  catch (e) { return false; }
}
export function loadSystemSnapshot() {
  try {
    const raw = localStorage.getItem(SYSTEM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function saveFavorite(name, config) {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({ name, config, ts: Date.now() });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (e) {}
}
export function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
