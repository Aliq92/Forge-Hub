// Orbital Bloom - lightweight optional challenge mode (heuristic, no accounts/scores)
import { state, stats } from './config.js';
import { attractors } from './attractors.js';
import * as P from './particles.js';

export const CHALLENGES = {
  stableRing: {
    label: 'Stable Ring',
    description: 'Keep at least 55% of particles bound in orbit for 60 seconds.',
    duration: 60,
  },
  slingshot: {
    label: 'Slingshot',
    description: 'Guide a particle stream around the massive attractor and through the gold target zone.',
    duration: 0,
  },
  binaryBalance: {
    label: 'Binary Balance',
    description: 'Keep two attractors orbiting without merging for 45 seconds.',
    duration: 45,
  },
  discMaker: {
    label: 'Disc Maker',
    description: 'Reach 70% bound particles in a rotating disc.',
    duration: 0,
  },
};

export const challengeState = {
  active: null, startTime: 0, elapsed: 0, progress: 0, status: 'idle',
  targetZone: null, initialDynamicCount: 0,
};

export function startChallenge(id) {
  if (!CHALLENGES[id]) return;
  challengeState.active = id;
  challengeState.startTime = stats.simTime;
  challengeState.elapsed = 0;
  challengeState.progress = 0;
  challengeState.status = 'running';
  challengeState.targetZone = id === 'slingshot' ? { x: 520, y: 90, r: 75 } : null;
  challengeState.initialDynamicCount = attractors.filter(a => !a.fixed).length;
  state.classificationOverlay = true;
}

export function stopChallenge() {
  challengeState.active = null;
  challengeState.status = 'idle';
}

export function updateChallenge() {
  if (!challengeState.active) return;
  const id = challengeState.active;
  const def = CHALLENGES[id];
  challengeState.elapsed = Math.max(0, stats.simTime - challengeState.startTime);

  if (id === 'stableRing') {
    let bound = 0;
    for (let i = 0; i < P.count; i++) if (P.pclass[i] === 0) bound++;
    const frac = P.count > 0 ? bound / P.count : 0;
    challengeState.progress = Math.min(challengeState.elapsed / def.duration, 1);
    if (frac < 0.55 && challengeState.elapsed > 4) challengeState.status = 'failed';
    else if (challengeState.elapsed >= def.duration) challengeState.status = 'success';
  } else if (id === 'binaryBalance') {
    challengeState.progress = Math.min(challengeState.elapsed / def.duration, 1);
    const dynCount = attractors.filter(a => !a.fixed).length;
    if (dynCount < Math.max(challengeState.initialDynamicCount - 1, 1)) challengeState.status = 'failed';
    else if (challengeState.elapsed >= def.duration) challengeState.status = 'success';
  } else if (id === 'slingshot') {
    const zone = challengeState.targetZone;
    let hit = false;
    for (let i = 0; i < P.count; i++) {
      const dx = P.px[i] - zone.x, dy = P.py[i] - zone.y;
      if (dx * dx + dy * dy < zone.r * zone.r) { hit = true; break; }
    }
    if (hit) { challengeState.progress = 1; challengeState.status = 'success'; }
  } else if (id === 'discMaker') {
    let bound = 0;
    for (let i = 0; i < P.count; i++) if (P.pclass[i] === 0) bound++;
    const frac = P.count > 0 ? bound / P.count : 0;
    challengeState.progress = Math.min(frac / 0.7, 1);
    if (frac >= 0.7) challengeState.status = 'success';
  }
}
