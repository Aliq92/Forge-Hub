/* Bacteria Bloom - agar environment: dish mask, nutrient field, inhibitor field, temperature */
(function (BB) {
  'use strict';
  const { GRID_W, GRID_H, DISH_MARGIN, NUTRIENT_MAX } = BB.CONFIG;
  const util = BB.util;

  function Environment(seed) {
    this.w = GRID_W;
    this.h = GRID_H;
    this.cx = GRID_W / 2;
    this.cy = GRID_H / 2;
    this.radius = Math.min(GRID_W, GRID_H) / 2 - DISH_MARGIN;

    this.dishMask = new Uint8Array(GRID_W * GRID_H);
    this.nutrient = new Float32Array(GRID_W * GRID_H);
    this.inhibitor = new Float32Array(GRID_W * GRID_H);
    this.agarVariation = new Float32Array(GRID_W * GRID_H); // static moisture/texture field for rendering

    this.temperature = BB.CONFIG.TEMP_DEFAULT;
    this.nutrientRegen = 'low';

    this.buildMask();
    this.randomize(seed || 1);
  }

  Environment.prototype.buildMask = function () {
    const { w, h, cx, cy, radius } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx + 0.5, dy = y - cy + 0.5;
        this.dishMask[y * w + x] = (dx * dx + dy * dy <= radius * radius) ? 1 : 0;
      }
    }
  };

  Environment.prototype.index = function (x, y) { return y * this.w + x; };

  Environment.prototype.inDish = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.dishMask[y * this.w + x] === 1;
  };

  // Generates a fresh organic nutrient field + agar texture using layered value noise.
  Environment.prototype.randomize = function (seed, opts) {
    opts = opts || {};
    const rng = util.mulberry32((seed | 0) || Date.now());
    const nNoise = util.fbm2D(rng, this.w, this.h, 4, 26);
    const tNoise = util.fbm2D(util.mulberry32(((seed | 0) + 777)), this.w, this.h, 3, 14);
    const baseLevel = opts.baseNutrient != null ? opts.baseNutrient : 0.55;
    const variance = opts.variance != null ? opts.variance : 0.4;

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = this.index(x, y);
        if (!this.dishMask[i]) { this.nutrient[i] = 0; this.agarVariation[i] = 0; continue; }
        const n = nNoise(x, y);
        this.nutrient[i] = util.clamp(baseLevel + (n - 0.5) * 2 * variance, 0.05, NUTRIENT_MAX);
        this.agarVariation[i] = tNoise(x, y);
        this.inhibitor[i] = 0;
      }
    }
  };

  Environment.prototype.clearFields = function () {
    this.nutrient.fill(0);
    this.inhibitor.fill(0);
  };

  Environment.prototype.addNutrient = function (gx, gy, radius, strength) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(gx - radius)), x1 = Math.min(this.w - 1, Math.ceil(gx + radius));
    const y0 = Math.max(0, Math.floor(gy - radius)), y1 = Math.min(this.h - 1, Math.ceil(gy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx, dy = y - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const i = this.index(x, y);
        if (!this.dishMask[i]) continue;
        const falloff = 1 - Math.sqrt(d2) / radius;
        this.nutrient[i] = util.clamp(this.nutrient[i] + strength * falloff * 0.06, 0, NUTRIENT_MAX);
      }
    }
  };

  Environment.prototype.addInhibitor = function (gx, gy, radius, strength) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(gx - radius)), x1 = Math.min(this.w - 1, Math.ceil(gx + radius));
    const y0 = Math.max(0, Math.floor(gy - radius)), y1 = Math.min(this.h - 1, Math.ceil(gy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx, dy = y - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const i = this.index(x, y);
        if (!this.dishMask[i]) continue;
        const falloff = 1 - Math.sqrt(d2) / radius;
        this.inhibitor[i] = util.clamp(this.inhibitor[i] + strength * falloff * 0.09, 0, 1);
      }
    }
  };

  Environment.prototype.eraseAt = function (gx, gy, radius) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(gx - radius)), x1 = Math.min(this.w - 1, Math.ceil(gx + radius));
    const y0 = Math.max(0, Math.floor(gy - radius)), y1 = Math.min(this.h - 1, Math.ceil(gy + radius));
    const touched = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx, dy = y - gy;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.index(x, y);
        if (!this.dishMask[i]) continue;
        this.inhibitor[i] = 0;
        touched.push(i);
      }
    }
    return touched;
  };

  Environment.prototype.stepRegen = function (dt) {
    const rate = BB.CONFIG.NUTRIENT_REGEN_RATES[this.nutrientRegen] || 0;
    if (rate <= 0) return;
    const { nutrient, dishMask } = this;
    for (let i = 0; i < nutrient.length; i++) {
      if (!dishMask[i]) continue;
      if (nutrient[i] < NUTRIENT_MAX) nutrient[i] = Math.min(NUTRIENT_MAX, nutrient[i] + rate * dt);
    }
  };

  // qualitative temperature label
  Environment.prototype.tempLabel = function () {
    const t = this.temperature;
    if (t < 17) return 'COLD';
    if (t < 24) return 'COOL';
    if (t <= 34) return 'OPTIMAL';
    if (t <= 42) return 'WARM';
    return 'HOT';
  };

  BB.Environment = Environment;

})(window.BB = window.BB || {});
