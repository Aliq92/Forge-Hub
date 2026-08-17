// ---------------- Math & RNG utilities (global scope, no modules by design) ----------------
const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }

function wrapAngle(a) {
  a = a % TAU;
  if (a < -Math.PI) a += TAU;
  if (a > Math.PI) a -= TAU;
  return a;
}

// shortest signed difference from a to b
function angleDiff(a, b) { return wrapAngle(b - a); }

// Deterministic 32-bit hash -> seed
function hashSeed(...vals) {
  let h = 2166136261;
  for (const v of vals) {
    const s = String(v);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

// mulberry32 seeded PRNG -> returns a function producing floats [0,1)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) { return min + rng() * (max - min); }
function randInt(rng, min, max) { return Math.floor(randRange(rng, min, max + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function weightedPick(rng, items) {
  // items: [{weight, ...}]
  let total = 0;
  for (const it of items) total += it.weight;
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function formatKm(px) { return (px / DISTANCE_PX_PER_KM).toFixed(2); }
function pxToKm(px) { return px / DISTANCE_PX_PER_KM; }
function kmToPx(km) { return km * DISTANCE_PX_PER_KM; }

const DISTANCE_PX_PER_KM = 400;

function circleOverlap(x1, y1, r1, x2, y2, r2) {
  return dist2(x1, y1, x2, y2) <= (r1 + r2) * (r1 + r2);
}
