// Orbital Bloom - particle system: struct-of-arrays, bounded capacity, swap-remove
import { CONSTANTS } from './config.js';

const CAP = CONSTANTS.MAX_PARTICLES;

export const px = new Float32Array(CAP);
export const py = new Float32Array(CAP);
export const pvx = new Float32Array(CAP);
export const pvy = new Float32Array(CAP);
export const pPrevX = new Float32Array(CAP);
export const pPrevY = new Float32Array(CAP);
export const page = new Float32Array(CAP);   // seconds alive
export const plife = new Float32Array(CAP);  // <0 = infinite
export const pseed = new Float32Array(CAP);  // stable random 0..1 per particle
export const pspeed = new Float32Array(CAP); // cached speed magnitude (for color mode)
export const pgrav = new Float32Array(CAP);  // cached local gravity magnitude
export const pclass = new Uint8Array(CAP);   // 0 bound,1 falling,2 escaping,3 chaotic

export let count = 0;

export function capacity() { return CAP; }

export function resetParticles() {
  count = 0;
}

export function spawnParticle(x, y, vx, vy, life = -1) {
  if (count >= CAP) return -1;
  const i = count++;
  px[i] = x; py[i] = y;
  pPrevX[i] = x; pPrevY[i] = y;
  pvx[i] = vx; pvy[i] = vy;
  page[i] = 0; plife[i] = life;
  pseed[i] = Math.random();
  pspeed[i] = Math.hypot(vx, vy);
  pgrav[i] = 0;
  pclass[i] = 0;
  return i;
}

export function removeAt(i) {
  count--;
  if (i === count) return;
  px[i] = px[count]; py[i] = py[count];
  pPrevX[i] = pPrevX[count]; pPrevY[i] = pPrevY[count];
  pvx[i] = pvx[count]; pvy[i] = pvy[count];
  page[i] = page[count]; plife[i] = plife[count];
  pseed[i] = pseed[count];
  pspeed[i] = pspeed[count];
  pgrav[i] = pgrav[count];
  pclass[i] = pclass[count];
}

export function clearNear(cx, cy, radius) {
  const r2 = radius * radius;
  let removed = 0;
  for (let i = count - 1; i >= 0; i--) {
    const dx = px[i] - cx, dy = py[i] - cy;
    if (dx * dx + dy * dy <= r2) { removeAt(i); removed++; }
  }
  return removed;
}

// Flexible pattern spawner used by both interactive tools and presets.
// mode: 'static' | 'rotating' | 'ring' | 'disc' | 'jet'
export function spawnPattern(opts) {
  const {
    cx, cy, count: n, mode = 'rotating',
    radius = 100, spread = 0.35,
    spin = 0,          // simple kinematic angular rate (slider units, -100..100)
    speed = 0,          // overall drift speed
    angle = 0,          // direction for jet/drift (radians)
    coneSpread = 0.35,  // half-angle for jet cone (radians)
    keplerian = false, centralMass = 0, G = CONSTANTS.G_DEFAULT,
    lifespan = -1,
  } = opts;

  let spawned = 0;
  for (let k = 0; k < n; k++) {
    let r, theta, x, y;
    if (mode === 'ring') {
      r = radius * (1 + (Math.random() - 0.5) * spread * 0.25);
      theta = Math.random() * Math.PI * 2;
      x = cx + Math.cos(theta) * r; y = cy + Math.sin(theta) * r;
    } else if (mode === 'disc') {
      r = Math.sqrt(Math.random()) * radius;
      theta = Math.random() * Math.PI * 2;
      x = cx + Math.cos(theta) * r; y = cy + Math.sin(theta) * r;
    } else if (mode === 'jet') {
      const a = angle + (Math.random() - 0.5) * coneSpread;
      const off = (Math.random() - 0.5) * radius * 0.18;
      const perp = angle + Math.PI / 2;
      x = cx + Math.cos(perp) * off;
      y = cy + Math.sin(perp) * off;
      theta = a; r = 0;
    } else { // static | rotating -> filled circular cloud
      r = Math.random() * radius;
      theta = Math.random() * Math.PI * 2;
      x = cx + Math.cos(theta) * r; y = cy + Math.sin(theta) * r;
    }

    let vx = 0, vy = 0;
    if (mode === 'jet') {
      const sp = speed * (0.75 + Math.random() * 0.5);
      vx = Math.cos(theta) * sp; vy = Math.sin(theta) * sp;
    } else {
      let tangential = 0;
      if (keplerian && centralMass > 0) {
        const dist = Math.max(r, 14);
        tangential = Math.sqrt((G * centralMass) / dist) * (spin < 0 ? -1 : 1);
      } else if (spin) {
        tangential = spin * r * 0.018;
      }
      const dx = x - cx, dy = y - cy;
      const dist = Math.max(Math.hypot(dx, dy), 0.001);
      const nx = dx / dist, ny = dy / dist;
      const tx = -ny, ty = nx; // perpendicular (ccw for positive tangential)
      // `speed` acts as a radial term for non-jet modes (positive = outward burst, negative = inward implosion)
      vx = tx * tangential + nx * speed;
      vy = ty * tangential + ny * speed;
      vx += (Math.random() - 0.5) * spread * 22;
      vy += (Math.random() - 0.5) * spread * 22;
    }

    if (spawnParticle(x, y, vx, vy, lifespan) === -1) break;
    spawned++;
  }
  return spawned;
}
