// Small math / RNG / noise helpers shared across systems.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
export function randRange(rng, min, max) { return min + rng() * (max - min); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Seeded 2D value-noise generator (smooth, coherent, no external deps).
export function makeNoise2D(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function grad(hash, x, y) {
    const h = hash & 7;
    const gx = 1 + (h & 3);
    const gy = 1 + ((h >> 2) & 1) * 2;
    const sx = (h & 4) ? -1 : 1;
    const sy = (h & 1) ? -1 : 1;
    return sx * gx * x + sy * gy * y;
  }

  return function noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return (lerp(x1, x2, v) + 1) / 2; // normalize roughly to 0..1
  };
}

export function fbm(noise2D, x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2D(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
  }
  emit(evt, payload) {
    const arr = this.listeners.get(evt);
    if (arr) for (const fn of arr) fn(payload);
  }
}
