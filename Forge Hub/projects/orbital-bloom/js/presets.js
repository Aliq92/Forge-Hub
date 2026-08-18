// Orbital Bloom - hand-tuned presets. Each produces an immediately beautiful structure.
import { CONSTANTS, state, stats, saveLastPreset } from './config.js';
import { clearAttractors, createAttractor } from './attractors.js';
import * as P from './particles.js';
import { clearTrails } from './renderer.js';
import { clearEmitters } from './tools.js';

const G = CONSTANTS.G_DEFAULT;

function beginPreset() {
  clearAttractors();
  P.resetParticles();
  clearEmitters();
  clearTrails();
  state.gravityStrength = 1;
  state.selectedAttractorId = null;
  stats.absorbedCount = 0;
  stats.simTime = 0;
}

function spawnKeplerianAnnulus(cx, cy, count, innerR, outerR, centralMass, opts = {}) {
  const { spread = 0.15, dir = 1, speedScale = 1 } = opts;
  for (let i = 0; i < count; i++) {
    const r = innerR + Math.random() * (outerR - innerR);
    const theta = Math.random() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r, y = cy + Math.sin(theta) * r;
    const vCirc = Math.sqrt((G * centralMass) / r) * speedScale;
    const dx = x - cx, dy = y - cy;
    const dist = Math.max(Math.hypot(dx, dy), 1);
    const nx = dx / dist, ny = dy / dist;
    const tx = -ny * dir, ty = nx * dir;
    const jitter = 1 + (Math.random() - 0.5) * spread;
    let vx = tx * vCirc * jitter, vy = ty * vCirc * jitter;
    vx += nx * (Math.random() - 0.5) * vCirc * 0.05;
    vy += ny * (Math.random() - 0.5) * vCirc * 0.05;
    P.spawnParticle(x, y, vx, vy, -1);
  }
}

function twoBodyVelocity(mass1, mass2, separation) {
  const mTotal = mass1 + mass2;
  const w = Math.sqrt((G * mTotal) / Math.pow(separation, 3));
  return {
    r1: (separation * mass2) / mTotal,
    r2: (separation * mass1) / mTotal,
    v1: w * (separation * mass2) / mTotal,
    v2: w * (separation * mass1) / mTotal,
  };
}

const PRESETS = {
  emptySpace: {
    label: 'Empty Space',
    build(camera) {
      beginPreset();
      camera.reset();
    },
  },

  accretionDisc: {
    label: 'Accretion Disc',
    build(camera) {
      beginPreset();
      createAttractor('heavyCore', 0, 0, { mass: 42000, fixed: true, name: 'Core' });
      spawnKeplerianAnnulus(0, 0, 2400, 95, 480, 42000, { spread: 0.2, speedScale: 0.99 });
      camera.fitBounds(-540, -540, 540, 540, camera._vw || 1200, camera._vh || 800);
    },
  },

  binaryStars: {
    label: 'Binary Stars',
    build(camera) {
      beginPreset();
      const m1 = 12000, m2 = 12000, D = 220;
      const v = twoBodyVelocity(m1, m2, D);
      const s1 = createAttractor('star', -D / 2, 0, { mass: m1, name: 'Star A' });
      const s2 = createAttractor('star', D / 2, 0, { mass: m2, name: 'Star B' });
      s1.vy = v.v1; s2.vy = -v.v2;
      P.spawnPattern({ cx: 0, cy: 0, count: 1900, mode: 'disc', radius: 460, spread: 0.4, spin: 26, speed: 0 });
      camera.fitBounds(-560, -560, 560, 560, camera._vw || 1200, camera._vh || 800);
    },
  },

  threeBodyChaos: {
    label: 'Three-Body Chaos',
    build(camera) {
      beginPreset();
      const masses = [6200, 7100, 8300];
      const radius = 170;
      const angles = [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3];
      const bodies = [];
      for (let i = 0; i < 3; i++) {
        const x = Math.cos(angles[i]) * radius, y = Math.sin(angles[i]) * radius;
        const a = createAttractor(i === 2 ? 'heavyCore' : 'star', x, y, { mass: masses[i], name: `Body ${i + 1}` });
        bodies.push(a);
      }
      const mTotal = masses.reduce((s, v) => s + v, 0);
      const w = Math.sqrt((G * mTotal) / Math.pow(radius, 3)) * 0.62;
      for (const a of bodies) {
        const dist = Math.hypot(a.x, a.y);
        const nx = a.x / dist, ny = a.y / dist;
        a.vx = -ny * dist * w + (Math.random() - 0.5) * 18;
        a.vy = nx * dist * w + (Math.random() - 0.5) * 18;
      }
      P.spawnPattern({ cx: 0, cy: 0, count: 1100, mode: 'disc', radius: 520, spread: 0.5, spin: 6, speed: 0 });
      camera.fitBounds(-620, -620, 620, 620, camera._vw || 1200, camera._vh || 800);
    },
  },

  ringFormation: {
    label: 'Ring Formation',
    build(camera) {
      beginPreset();
      createAttractor('star', 0, 0, { mass: 16000, fixed: true, name: 'Central Star' });
      spawnKeplerianAnnulus(0, 0, 2000, 65, 380, 16000, { spread: 0.06, speedScale: 1 });
      camera.fitBounds(-440, -440, 440, 440, camera._vw || 1200, camera._vh || 800);
    },
  },

  gravitySlingshot: {
    label: 'Gravity Slingshot',
    build(camera) {
      beginPreset();
      createAttractor('heavyCore', 90, -30, { mass: 22000, fixed: true, name: 'Slingshot Mass' });
      const origin = { x: -680, y: -260 };
      const aim = { x: 520, y: 70 };
      const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
      P.spawnPattern({
        cx: origin.x, cy: origin.y, count: 500, mode: 'jet',
        radius: 30, spread: 0.15, speed: 380, angle, coneSpread: 0.05,
      });
      state.continuousStream = false;
      camera.fitBounds(-720, -420, 620, 420, camera._vw || 1200, camera._vh || 800);
    },
  },

  galaxySeed: {
    label: 'Galaxy Seed',
    build(camera) {
      beginPreset();
      createAttractor('heavyCore', 0, 0, { mass: 52000, fixed: true, name: 'Galactic Core' });
      spawnKeplerianAnnulus(0, 0, 2800, 45, 620, 52000, { spread: 0.24, speedScale: 0.93 });
      camera.fitBounds(-680, -680, 680, 680, camera._vw || 1200, camera._vh || 800);
    },
  },

  twinVortex: {
    label: 'Twin Vortex',
    build(camera) {
      beginPreset();
      const m = 9500, D = 380;
      const v = twoBodyVelocity(m, m, D);
      const a1 = createAttractor('planet', -D / 2, 0, { mass: m, name: 'Vortex A' });
      const a2 = createAttractor('planet', D / 2, 0, { mass: m, name: 'Vortex B' });
      a1.vy = v.v1; a2.vy = -v.v2;
      spawnKeplerianAnnulus(-D / 2, 0, 950, 25, 150, m, { spread: 0.15, dir: 1, speedScale: 1 });
      spawnKeplerianAnnulus(D / 2, 0, 950, 25, 150, m, { spread: 0.15, dir: -1, speedScale: 1 });
      camera.fitBounds(-560, -400, 560, 400, camera._vw || 1200, camera._vh || 800);
    },
  },

  brokenOrbit: {
    label: 'Broken Orbit',
    build(camera) {
      beginPreset();
      createAttractor('star', 0, 0, { mass: 14000, fixed: true, name: 'Central Star' });
      spawnKeplerianAnnulus(0, 0, 1300, 60, 260, 14000, { spread: 0.05, speedScale: 1 });
      const intruders = [
        { x: -560, y: -120, vx: 150, vy: 40 },
        { x: 600, y: 180, vx: -140, vy: -60 },
        { x: 60, y: -640, vx: 10, vy: 190 },
      ];
      intruders.forEach((it, i) => {
        const a = createAttractor('planet', it.x, it.y, { mass: 4200, name: `Intruder ${i + 1}` });
        a.vx = it.vx; a.vy = it.vy;
      });
      camera.fitBounds(-660, -660, 660, 660, camera._vw || 1200, camera._vh || 800);
    },
  },
};

export function listPresets() {
  return Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label }));
}

export function loadPreset(id, camera) {
  const p = PRESETS[id];
  if (!p) return false;
  camera._vw = camera._vw || window.innerWidth;
  camera._vh = camera._vh || window.innerHeight;
  p.build(camera);
  saveLastPreset(id);
  window.dispatchEvent(new CustomEvent('ob:preset-loaded', { detail: { id } }));
  return true;
}
