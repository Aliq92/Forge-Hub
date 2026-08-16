// Seeded RNG + value-noise helpers for clustered procedural terrain.
(function (WF) {
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

  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Builds one layer of tileable-ish value noise sampled over [0,1)x[0,1) space.
  function makeNoiseLayer(rng, gx, gy) {
    const w = gx + 1, h = gy + 1;
    const grid = new Float32Array(w * h);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    return function sample(xn, yn) {
      const fx = xn * gx, fy = yn * gy;
      let x0 = Math.floor(fx), y0 = Math.floor(fy);
      let x1 = Math.min(x0 + 1, gx), y1 = Math.min(y0 + 1, gy);
      x0 = Math.min(Math.max(x0, 0), gx);
      y0 = Math.min(Math.max(y0, 0), gy);
      const tx = smoothstep(fx - Math.floor(fx));
      const ty = smoothstep(fy - Math.floor(fy));
      const v00 = grid[y0 * w + x0], v10 = grid[y0 * w + x1];
      const v01 = grid[y1 * w + x0], v11 = grid[y1 * w + x1];
      const a = lerp(v00, v10, tx), b = lerp(v01, v11, tx);
      return lerp(a, b, ty);
    };
  }

  // Fractal (multi-octave) noise field, returned as a normalized Float32Array[w*h] in [0,1].
  function fractalNoiseField(rng, w, h, octaves) {
    const layers = octaves.map(o => ({ sample: makeNoiseLayer(rng, o.freq, o.freq), weight: o.weight }));
    const field = new Float32Array(w * h);
    let min = Infinity, max = -Infinity;
    for (let y = 0; y < h; y++) {
      const yn = y / h;
      for (let x = 0; x < w; x++) {
        const xn = x / w;
        let v = 0, wsum = 0;
        for (const l of layers) { v += l.sample(xn, yn) * l.weight; wsum += l.weight; }
        v /= wsum;
        field[y * w + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = Math.max(1e-6, max - min);
    for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / range;
    return field;
  }

  Object.assign(WF, { mulberry32, fractalNoiseField });
})(window.WF = window.WF || {});
