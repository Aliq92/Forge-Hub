// Orbital Bloom - random system generator: structured randomness over a few sensible layouts
import { CONSTANTS, state, stats, saveLastSeed } from './config.js';
import { clearAttractors, createAttractor } from './attractors.js';
import * as P from './particles.js';
import { clearTrails, triggerFlash } from './renderer.js';
import { clearEmitters } from './tools.js';

const G = CONSTANTS.G_DEFAULT;
const LAYOUTS = ['singleStarDisc', 'binary', 'starPlusOrbiter', 'threeBody', 'debrisCloud', 'ringSystem'];
const BUCKET_IDX = { white: 0, cyan: 1, violet: 2, gold: 3, blue: 4 };
const COLORS = ['gold', 'cyan', 'violet', 'blue', 'white'];

// xmur3 string hash -> mulberry32 PRNG. Small, deterministic, no external dependency.
function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  let a = h;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 9);
}

function annulus(rng, cx, cy, count, innerR, outerR, centralMass, dir, colorBucket) {
  for (let i = 0; i < count; i++) {
    const r = innerR + rng() * (outerR - innerR);
    const theta = rng() * Math.PI * 2;
    const x = cx + Math.cos(theta) * r, y = cy + Math.sin(theta) * r;
    const vCirc = Math.sqrt((G * centralMass) / r);
    const dx = x - cx, dy = y - cy;
    const dist = Math.max(Math.hypot(dx, dy), 1);
    const nx = dx / dist, ny = dy / dist;
    const tx = -ny * dir, ty = nx * dir;
    const jitter = 1 + (rng() - 0.5) * 0.18;
    const vx = tx * vCirc * jitter, vy = ty * vCirc * jitter;
    P.spawnParticle(x, y, vx, vy, -1, colorBucket);
  }
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function range(rng, lo, hi) { return lo + rng() * (hi - lo); }

export function generateSystem(seedStr, camera) {
  const seed = seedStr && seedStr.trim() ? seedStr.trim() : randomSeed();
  const rng = makeRng(seed);

  clearAttractors();
  P.resetParticles();
  clearEmitters();
  clearTrails();
  state.gravityStrength = 1;
  state.collisionMode = 'merge';
  state.selectedAttractorId = null;
  stats.absorbedCount = 0;
  stats.simTime = 0;

  const layout = pick(rng, LAYOUTS);
  const mainColor = pick(rng, COLORS);

  if (layout === 'singleStarDisc') {
    const mass = range(rng, 20000, 60000);
    const core = createAttractor('heavyCore', 0, 0, { mass, fixed: true, color: mainColor, name: 'Generated Core' });
    annulus(rng, 0, 0, Math.round(range(rng, 1400, 2400)), 70, range(rng, 320, 520), mass, rng() < 0.5 ? 1 : -1, BUCKET_IDX[mainColor]);
  } else if (layout === 'binary') {
    const m1 = range(rng, 8000, 16000), m2 = range(rng, 8000, 16000);
    const D = range(rng, 180, 320);
    const mTotal = m1 + m2;
    const w = Math.sqrt((G * mTotal) / Math.pow(D, 3));
    const c1 = pick(rng, COLORS), c2 = pick(rng, COLORS.filter(c => c !== c1));
    const a1 = createAttractor('star', -D / 2, 0, { mass: m1, color: c1, name: 'Star A' });
    const a2 = createAttractor('star', D / 2, 0, { mass: m2, color: c2, name: 'Star B' });
    a1.vy = w * (D * m2) / mTotal; a2.vy = -w * (D * m1) / mTotal;
    P.spawnPattern({ cx: 0, cy: 0, count: Math.round(range(rng, 1200, 2000)), mode: 'disc', radius: range(rng, 380, 520), spread: 0.4, spin: range(rng, -35, 35), speed: 0 });
  } else if (layout === 'starPlusOrbiter') {
    const mass = range(rng, 30000, 55000);
    const core = createAttractor('heavyCore', 0, 0, { mass, fixed: true, color: mainColor, name: 'Star' });
    const orbitR = range(rng, 260, 420);
    const orbitMass = range(rng, 3000, 9000);
    const v = Math.sqrt((G * mass) / orbitR);
    const orbiter = createAttractor('planet', orbitR, 0, { mass: orbitMass, name: 'Orbiter' });
    orbiter.vy = v * (rng() < 0.5 ? 1 : -1);
    annulus(rng, 0, 0, Math.round(range(rng, 1300, 2000)), 60, orbitR * 1.6, mass, 1, BUCKET_IDX[mainColor]);
  } else if (layout === 'threeBody') {
    const masses = [range(rng, 5000, 9000), range(rng, 5000, 9000), range(rng, 5000, 9000)];
    const radius = range(rng, 140, 220);
    const bodies = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + rng() * 0.6;
      const x = Math.cos(ang) * radius, y = Math.sin(ang) * radius;
      bodies.push(createAttractor(i === 0 ? 'heavyCore' : 'star', x, y, { mass: masses[i], color: pick(rng, COLORS), name: `Body ${i + 1}` }));
    }
    const mTotal = masses.reduce((s, v) => s + v, 0);
    const w = Math.sqrt((G * mTotal) / Math.pow(radius, 3)) * range(rng, 0.5, 0.72);
    for (const a of bodies) {
      const dist = Math.hypot(a.x, a.y);
      const nx = a.x / dist, ny = a.y / dist;
      a.vx = -ny * dist * w; a.vy = nx * dist * w;
    }
    P.spawnPattern({ cx: 0, cy: 0, count: Math.round(range(rng, 900, 1400)), mode: 'disc', radius: range(rng, 420, 600), spread: 0.5, spin: range(rng, -12, 12), speed: 0 });
  } else if (layout === 'debrisCloud') {
    const count = Math.round(range(rng, 2, 4));
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2, dist = range(rng, 120, 320);
      const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
      const a = createAttractor(pick(rng, ['star', 'planet']), x, y, { mass: range(rng, 4000, 9000), color: pick(rng, COLORS) });
      for (let k = 0; k < 500; k++) {
        const r = Math.sqrt(rng()) * 180 + 30;
        const th = rng() * Math.PI * 2;
        const px = a.x + Math.cos(th) * r, py = a.y + Math.sin(th) * r;
        P.spawnParticle(px, py, (rng() - 0.5) * 8, (rng() - 0.5) * 8, -1, BUCKET_IDX[a.color]);
      }
    }
  } else { // ringSystem
    const mass = range(rng, 12000, 26000);
    createAttractor('star', 0, 0, { mass, fixed: true, color: mainColor, name: 'Generated Star' });
    annulus(rng, 0, 0, Math.round(range(rng, 1500, 2200)), 55, range(rng, 260, 400), mass, 1, BUCKET_IDX[mainColor]);
  }

  const bounds = 640;
  camera.fitBounds(-bounds, -bounds, bounds, bounds, camera._vw || window.innerWidth, camera._vh || window.innerHeight);
  triggerFlash(0, 0, '#eef3ff', 140);
  state.lastSeed = seed;
  saveLastSeed(seed);
  window.dispatchEvent(new CustomEvent('ob:preset-loaded', { detail: { id: null, seed } }));
  return seed;
}
