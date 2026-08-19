// Orbital Bloom - main simulation orchestration: fixed-timestep physics loop
import { CONSTANTS, PALETTE, state, stats } from './config.js';
import * as P from './particles.js';
import { attractors, clearAttractors } from './attractors.js';
import * as Gravity from './gravity.js';
import * as Renderer from './renderer.js';
import { tickEmitters, clearEmitters } from './tools.js';
import { updateChallenge } from './challenges.js';

let camera = null;
let canvas = null;
let rafId = null;
let lastT = null;

export function initSimulation(cameraRef, canvasRef) {
  camera = cameraRef;
  canvas = canvasRef;
}

function onAttractorMerge(survivor, x, y) {
  Renderer.triggerFlash(x, y, PALETTE[survivor.color] || PALETTE.gold, survivor.radius * 3.2);
  P.spawnPattern({
    cx: x, cy: y, count: 60, mode: 'disc',
    radius: survivor.radius * 2.4, spread: 0.7, spin: 0, speed: 130,
  });
}

function onAttractorBounce(a, b, x, y) {
  Renderer.triggerFlash(x, y, PALETTE[a.color] || PALETTE.white, Math.max(a.radius, b.radius) * 2.2);
}

function onAttractorDestroy(survivor, x, y, doomedColor) {
  Renderer.triggerFlash(x, y, PALETTE[doomedColor] || PALETTE.violet, survivor.radius * 2.8);
  P.spawnPattern({
    cx: x, cy: y, count: 90, mode: 'disc',
    radius: survivor.radius * 3, spread: 0.9, spin: 0, speed: 220,
  });
}

function onSlingshotEvent(x, y) {
  Renderer.triggerFlash(x, y, PALETTE.cyan, 60);
}

export function physicsStep(dt) {
  const g = CONSTANTS.G_DEFAULT * state.gravityStrength;
  Gravity.stepAttractors(dt, g);
  Gravity.handleAttractorCollisions({
    onMerge: onAttractorMerge,
    onBounce: onAttractorBounce,
    onDestroy: onAttractorDestroy,
  });
  Gravity.stepParticles(dt, g, onSlingshotEvent);
  tickEmitters(dt);
  stats.simTime += dt;
  updateChallenge();
}

export function stepForward() {
  const dt = CONSTANTS.BASE_DT * Math.max(state.speedMultiplier, 1);
  physicsStep(dt);
}

export function startLoop() {
  lastT = performance.now();
  const frame = (t) => {
    rafId = requestAnimationFrame(frame);
    const dtReal = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    camera.update(dtReal);

    if (state.running) {
      const sm = state.speedMultiplier;
      const steps = sm <= 1 ? 1 : Math.round(sm);
      const dtPerStep = CONSTANTS.BASE_DT * (sm / steps);
      for (let i = 0; i < steps; i++) physicsStep(dtPerStep);
    }

    if (state.followBody && state.selectedAttractorId != null && !camera._animT) {
      const a = attractors.find(a => a.id === state.selectedAttractorId);
      if (a) {
        const followLerp = 1 - Math.pow(0.0025, dtReal);
        camera.x += (a.x - camera.x) * followLerp;
        camera.y += (a.y - camera.y) * followLerp;
      }
    }

    camera._vw = canvas.clientWidth;
    camera._vh = canvas.clientHeight;
    Renderer.render(camera, canvas.clientWidth, canvas.clientHeight, dtReal);
  };
  rafId = requestAnimationFrame(frame);
}

export function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

export function resetSimulation() {
  clearAttractors();
  P.resetParticles();
  clearEmitters();
  Renderer.clearTrails();
  stats.absorbedCount = 0;
  stats.simTime = 0;
  state.selectedAttractorId = null;
  state.running = true;
  camera.reset(true);
}

export function clearParticlesOnly() {
  P.resetParticles();
  clearEmitters();
  stats.absorbedCount = 0;
}

export function clearAttractorsOnly() {
  clearAttractors();
  state.selectedAttractorId = null;
}

export function clearAllBodies() {
  clearParticlesOnly();
  clearAttractorsOnly();
}

export function liveParticleStats() {
  let sum = 0, max = 0;
  for (let i = 0; i < P.count; i++) {
    const s = P.pspeed[i];
    sum += s;
    if (s > max) max = s;
  }
  return {
    avg: P.count > 0 ? sum / P.count : 0,
    max,
    count: P.count,
    attractorCount: attractors.length,
  };
}
