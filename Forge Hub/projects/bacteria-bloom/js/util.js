/* Bacteria Bloom - small math / noise / RNG utilities */
(function (BB) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Coarse-grid value noise with bilinear interpolation, fbm-able.
  function makeValueNoise(rng, w, h, cell) {
    const gw = Math.ceil(w / cell) + 2;
    const gh = Math.ceil(h / cell) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    return function (x, y) {
      const fx = x / cell, fy = y / cell;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const i00 = y0 * gw + x0, i10 = y0 * gw + x0 + 1;
      const i01 = (y0 + 1) * gw + x0, i11 = (y0 + 1) * gw + x0 + 1;
      const a = lerp(g[i00] || 0, g[i10] || 0, tx);
      const b = lerp(g[i01] || 0, g[i11] || 0, tx);
      return lerp(a, b, ty);
    };
  }

  function fbm2D(rng, w, h, octaves, baseCell) {
    const layers = [];
    let cell = baseCell;
    for (let o = 0; o < octaves; o++) {
      layers.push({ fn: makeValueNoise(rng, w, h, cell), amp: Math.pow(0.55, o) });
      cell = Math.max(3, cell * 0.5);
    }
    let norm = 0;
    for (const l of layers) norm += l.amp;
    return function (x, y) {
      let v = 0;
      for (const l of layers) v += l.fn(x, y) * l.amp;
      return v / norm;
    };
  }

  BB.util = { mulberry32, clamp, lerp, smoothstep, makeValueNoise, fbm2D };

})(window.BB = window.BB || {});
