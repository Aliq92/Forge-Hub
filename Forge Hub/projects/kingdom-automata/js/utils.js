// ============================================================
// utils.js — RNG, noise, math & color helpers (no dependencies)
// ============================================================

// Deterministic PRNG (mulberry32), seeded from a string or number.
function makeRNG(seed) {
  let s;
  if (typeof seed === 'string') {
    s = 0;
    for (let i = 0; i < seed.length; i++) {
      s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
    }
  } else {
    s = seed | 0;
  }
  s = s || 0xC0FFEE;
  return function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function rngFloat(rng, min, max) { return rng() * (max - min) + min; }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function rngChance(rng, p) { return rng() < p; }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function dist2(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }

// ---- Value noise (smoothed, multi-octave) --------------------------------
// Generates a lattice of random values at low resolution and bilinearly
// interpolates, then sums a few octaves for natural clustered shapes.
class ValueNoise {
  constructor(rng, width, height, cell = 6) {
    this.gw = Math.ceil(width / cell) + 2;
    this.gh = Math.ceil(height / cell) + 2;
    this.cell = cell;
    this.lattice = new Float32Array(this.gw * this.gh);
    for (let i = 0; i < this.lattice.length; i++) this.lattice[i] = rng();
  }
  sample(x, y) {
    const gx = x / this.cell, gy = y / this.cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const tx = smoothstep(gx - x0), ty = smoothstep(gy - y0);
    const idx = (xx, yy) => (clamp(yy, 0, this.gh - 1) * this.gw) + clamp(xx, 0, this.gw - 1);
    const v00 = this.lattice[idx(x0, y0)];
    const v10 = this.lattice[idx(x0 + 1, y0)];
    const v01 = this.lattice[idx(x0, y0 + 1)];
    const v11 = this.lattice[idx(x0 + 1, y0 + 1)];
    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
  }
}

function fbm(noiseLayers, x, y) {
  let sum = 0, weight = 0;
  for (const layer of noiseLayers) {
    sum += layer.noise.sample(x, y) * layer.amp;
    weight += layer.amp;
  }
  return weight > 0 ? sum / weight : 0;
}

// ---- Color helpers ---------------------------------------------------------
function hsl(h, s, l) { return `hsl(${((h % 360) + 360) % 360},${clamp(s, 0, 100)}%,${clamp(l, 0, 100)}%)`; }
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function rgbToHex([r, g, b]) { return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }
function hslToHex(h, s, l) { return rgbToHex(hslToRgb(h, s, l)); }
function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function mixHex(hexA, hexB, t) {
  const a = [parseInt(hexA.slice(1,3),16), parseInt(hexA.slice(3,5),16), parseInt(hexA.slice(5,7),16)];
  const b = [parseInt(hexB.slice(1,3),16), parseInt(hexB.slice(3,5),16), parseInt(hexB.slice(5,7),16)];
  return rgbToHex([Math.round(lerp(a[0],b[0],t)), Math.round(lerp(a[1],b[1],t)), Math.round(lerp(a[2],b[2],t))]);
}

// A spread of visually distinct hues for kingdom colors.
function distinctHue(index, total) {
  const golden = 137.508;
  return (index * golden) % 360;
}

function fmtInt(n) {
  n = Math.round(n);
  return n.toLocaleString('en-US');
}
function fmtCompact(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtGold(n) { return fmtCompact(n) + 'g'; }
