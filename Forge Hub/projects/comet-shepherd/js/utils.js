// Small shared helpers: seeded RNG, vector math, formatting.

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0);
}

export function makeRng(seed){
  const s = typeof seed === 'number' ? seed : hashSeed(String(seed));
  return mulberry32(s);
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => { const dx = ax-bx, dy = ay-by; return dx*dx+dy*dy; };
export const len = (x, y) => Math.hypot(x, y);
export function normalize(x, y){
  const l = Math.hypot(x, y);
  if(l < 1e-8) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}
export const TAU = Math.PI * 2;
export function angleTo(ax, ay, bx, by){ return Math.atan2(by - ay, bx - ax); }
export function randRange(rng, lo, hi){ return lo + rng() * (hi - lo); }
export function randInt(rng, lo, hi){ return Math.floor(randRange(rng, lo, hi + 1)); }
export function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }
export function weightedPick(rng, items, weightFn){
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  let r = rng() * total;
  for(const it of items){
    r -= weightFn(it);
    if(r <= 0) return it;
  }
  return items[items.length - 1];
}

export function formatNumber(n){
  if(n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}

export function formatDistance(n){
  if(n >= 1e6) return (n/1e6).toFixed(2) + 'M km';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'k km';
  return Math.round(n) + ' km';
}

export function uid(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isFiniteVec(x, y){
  return Number.isFinite(x) && Number.isFinite(y);
}
