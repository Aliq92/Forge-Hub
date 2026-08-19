// Orbital Bloom - hand-tuned presets. Each produces an immediately beautiful structure.
import { CONSTANTS, PALETTE, state, stats, saveLastPreset, clamp } from './config.js';
import { attractors, clearAttractors, createAttractor } from './attractors.js';
import * as P from './particles.js';
import { clearTrails, triggerFlash } from './renderer.js';
import { clearEmitters } from './tools.js';

const G = CONSTANTS.G_DEFAULT;

function beginPreset() {
  clearAttractors();
  P.resetParticles();
  clearEmitters();
  clearTrails();
  state.gravityStrength = 1;
  state.collisionMode = 'merge';
  state.selectedAttractorId = null;
  stats.absorbedCount = 0;
  stats.simTime = 0;
}

function spawnKeplerianAnnulus(cx, cy, count, innerR, outerR, centralMass, opts = {}) {
  const { spread = 0.15, dir = 1, speedScale = 1, colorBucket = 255 } = opts;
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
    P.spawnParticle(x, y, vx, vy, -1, colorBucket);
  }
}

const BUCKET_IDX = { white: 0, cyan: 1, violet: 2, gold: 3, blue: 4 };

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
      const core = createAttractor('heavyCore', 0, 0, { mass: 42000, fixed: true, name: 'Core' });
      spawnKeplerianAnnulus(0, 0, 2400, 95, 480, 42000, { spread: 0.2, speedScale: 0.99, colorBucket: BUCKET_IDX[core.color] });
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
      const body = createAttractor('heavyCore', 90, -30, { mass: 22000, fixed: true, name: 'Slingshot Mass' });
      const origin = { x: -680, y: -260 };
      // Aim so the stream's closest approach clears the absorption radius with
      // comfortable margin — a tight beam that bends dramatically but survives.
      const toBody = { x: body.x - origin.x, y: body.y - origin.y };
      const distToBody = Math.hypot(toBody.x, toBody.y);
      const baseAngle = Math.atan2(toBody.y, toBody.x);
      const missDistance = body.radius * 6;
      const offsetAngle = Math.asin(clamp(missDistance / distToBody, -0.9, 0.9));
      const angle = baseAngle - offsetAngle;
      P.spawnPattern({
        cx: origin.x, cy: origin.y, count: 500, mode: 'jet',
        radius: 20, spread: 0.05, speed: 380, angle, coneSpread: 0.015,
      });
      state.continuousStream = false;
      camera.fitBounds(-720, -420, 620, 420, camera._vw || 1200, camera._vh || 800);
    },
  },

  galaxySeed: {
    label: 'Galaxy Seed',
    build(camera) {
      beginPreset();
      const core = createAttractor('heavyCore', 0, 0, { mass: 52000, fixed: true, name: 'Galactic Core' });
      spawnKeplerianAnnulus(0, 0, 2800, 45, 620, 52000, { spread: 0.24, speedScale: 0.93, colorBucket: BUCKET_IDX[core.color] });
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
      // Each intruder is aimed with a deliberate impact parameter so it swings
      // through the ring band and perturbs it, rather than diving straight
      // into the star and merging before it ever reaches the ring.
      const intruderDefs = [
        { startAngle: 200, impact: 290, speed: 205, side: 1 },
        { startAngle: 35, impact: 310, speed: 195, side: -1 },
        { startAngle: 300, impact: 270, speed: 220, side: 1 },
      ];
      intruderDefs.forEach((d, i) => {
        const startDist = 620;
        const rad = (d.startAngle * Math.PI) / 180;
        const sx = Math.cos(rad) * startDist, sy = Math.sin(rad) * startDist;
        const towardAngle = Math.atan2(-sy, -sx);
        const offsetAngle = Math.asin(clamp(d.impact / startDist, -0.9, 0.9)) * d.side;
        const angle = towardAngle + offsetAngle;
        const a = createAttractor('planet', sx, sy, { mass: 4200, name: `Intruder ${i + 1}` });
        a.vx = Math.cos(angle) * d.speed;
        a.vy = Math.sin(angle) * d.speed;
      });
      camera.fitBounds(-660, -660, 660, 660, camera._vw || 1200, camera._vh || 800);
    },
  },

  collapsingCluster: {
    label: 'Collapsing Cluster',
    build(camera) {
      beginPreset();
      const centers = [
        { x: -260, y: -140, mass: 8000, color: 'gold' },
        { x: 240, y: -80, mass: 6500, color: 'cyan' },
        { x: -40, y: 260, mass: 7200, color: 'violet' },
      ];
      const bodies = centers.map((c, i) => createAttractor('star', c.x, c.y, { mass: c.mass, name: `Mass ${i + 1}` }));
      // loosely distributed particles around each mass with a partial tangential
      // component — enough angular momentum to spiral in gradually and watchably
      // rather than free-falling straight to the center in under a second.
      bodies.forEach((a, i) => {
        for (let k = 0; k < 700; k++) {
          const r = Math.sqrt(Math.random()) * 220 + 40;
          const theta = Math.random() * Math.PI * 2;
          const x = a.x + Math.cos(theta) * r, y = a.y + Math.sin(theta) * r;
          const vCirc = Math.sqrt((G * a.mass) / r) * 0.45;
          const nx = Math.cos(theta), ny = Math.sin(theta);
          const tx = -ny, ty = nx;
          P.spawnParticle(x, y, tx * vCirc, ty * vCirc, -1, BUCKET_IDX[centers[i].color]);
        }
      });
      camera.fitBounds(-560, -460, 560, 560, camera._vw || 1200, camera._vh || 800);
    },
  },

  supermassiveCore: {
    label: 'Supermassive Core',
    build(camera) {
      beginPreset();
      const core = createAttractor('heavyCore', 0, 0, { mass: 90000, fixed: true, name: 'Supermassive Core' });
      // two-tier disc: a tight, blazing-fast inner ring and a slow, wide outer structure
      spawnKeplerianAnnulus(0, 0, 900, 40, 90, 90000, { spread: 0.08, speedScale: 1, colorBucket: BUCKET_IDX.gold });
      spawnKeplerianAnnulus(0, 0, 2200, 160, 560, 90000, { spread: 0.2, speedScale: 0.97, colorBucket: BUCKET_IDX[core.color] });
      camera.fitBounds(-620, -620, 620, 620, camera._vw || 1200, camera._vh || 800);
    },
  },

  doubleDisc: {
    label: 'Double Disc',
    build(camera) {
      beginPreset();
      const m = 11000, D = 260;
      const v = twoBodyVelocity(m, m, D);
      const a1 = createAttractor('star', -D / 2, 0, { mass: m, name: 'Disc A', color: 'gold' });
      const a2 = createAttractor('star', D / 2, 0, { mass: m, name: 'Disc B', color: 'cyan' });
      a1.vy = v.v1; a2.vy = -v.v2;
      // same rotation direction on both — the discs interact tidally rather than shearing past each other
      spawnKeplerianAnnulus(-D / 2, 0, 1100, 22, 165, m, { spread: 0.12, dir: 1, speedScale: 1, colorBucket: BUCKET_IDX.gold });
      spawnKeplerianAnnulus(D / 2, 0, 1100, 22, 165, m, { spread: 0.12, dir: 1, speedScale: 1, colorBucket: BUCKET_IDX.cyan });
      camera.fitBounds(-480, -380, 480, 380, camera._vw || 1200, camera._vh || 800);
    },
  },

  voidPassage: {
    label: 'Void Passage',
    build(camera) {
      beginPreset();
      const field = [
        { x: -60, y: -180, mass: 9000, type: 'star' },
        { x: 180, y: 60, mass: 14000, type: 'heavyCore' },
        { x: -220, y: 220, mass: 6000, type: 'planet' },
        { x: 340, y: -220, mass: 7500, type: 'star' },
      ];
      field.forEach((f, i) => createAttractor(f.type, f.x, f.y, { mass: f.mass, fixed: true, name: `Field ${i + 1}` }));
      const origin = { x: -900, y: -420 };
      const aim = { x: 900, y: 320 };
      const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
      P.spawnPattern({
        cx: origin.x, cy: origin.y, count: 900, mode: 'jet',
        radius: 26, spread: 0.1, speed: 420, angle, coneSpread: 0.04,
        colorBucket: BUCKET_IDX.cyan,
      });
      camera.fitBounds(-940, -480, 940, 480, camera._vw || 1200, camera._vh || 800);
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
  if (id !== 'emptySpace' && attractors.length > 0) {
    const anchor = attractors.reduce((best, a) => (a.mass > best.mass ? a : best), attractors[0]);
    triggerFlash(anchor.x, anchor.y, PALETTE[anchor.color] || PALETTE.white, anchor.radius * 5);
  }
  window.dispatchEvent(new CustomEvent('ob:preset-loaded', { detail: { id } }));
  return true;
}
