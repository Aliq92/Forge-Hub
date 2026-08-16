(function (WF) {
  'use strict';

  const { GRID_W, GRID_H, CELL_PX, TERRAIN, TERRAIN_INFO, FIRE_STATE, MANMADE } = WF;

  const NATIVE_W = GRID_W * CELL_PX;
  const NATIVE_H = GRID_H * CELL_PX;

  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function lerpColor(a, b, t) {
    return [
      clamp255(a[0] + (b[0] - a[0]) * t),
      clamp255(a[1] + (b[1] - a[1]) * t),
      clamp255(a[2] + (b[2] - a[2]) * t),
    ];
  }

  function terrainColor(sim, i) {
    const grid = sim.grid;
    if (sim.state[i] === FIRE_STATE.BURNED) {
      const n = ((i * 2654435761) >>> 0) % 17 / 17 - 0.5;
      const v = 22 + n * 8;
      return [v, v * 0.9, v * 0.85];
    }
    if (grid.manmade[i] === MANMADE.FIREBREAK) return [107, 86, 58];
    if (grid.manmade[i] === MANMADE.CONTAINMENT) return [168, 152, 60];
    const info = TERRAIN_INFO[grid.terrain[i]];
    let [r, g, b] = info.color;
    const elev = grid.elevation[i];
    const shade = grid.terrain[i] === TERRAIN.WATER ? 1 : 0.82 + elev * 0.34;
    const n = (((i * 2654435761) >>> 0) % 23) / 23 - 0.5;
    const tex = 1 + n * 0.07;
    return [clamp255(r * shade * tex), clamp255(g * shade * tex), clamp255(b * shade * tex)];
  }

  function moistureColor(sim, i) {
    const grid = sim.grid;
    if (grid.terrain[i] === TERRAIN.ROCK) return [70, 66, 62];
    const m = grid.terrain[i] === TERRAIN.WATER ? 1 : sim.effectiveMoisture(i);
    return lerpColor([132, 78, 40], [38, 120, 172], Math.max(0, Math.min(1, m)));
  }

  function fuelColor(sim, i) {
    const grid = sim.grid;
    if (!TERRAIN_INFO[grid.terrain[i]].burnable) return [36, 38, 42];
    const frac = grid.maxFuel[i] > 0 ? grid.fuel[i] / grid.maxFuel[i] : 0;
    return lerpColor([46, 32, 14], [92, 204, 92], frac);
  }

  function intensityColor(sim, i) {
    const inten = sim.intensity[i] || 0;
    if (inten <= 0.01) {
      const grid = sim.grid;
      if (!TERRAIN_INFO[grid.terrain[i]].burnable) return [26, 24, 26];
      return [20, 22, 20];
    }
    if (inten < 0.5) return lerpColor([46, 10, 4], [224, 84, 12], inten / 0.5);
    return lerpColor([224, 84, 12], [255, 236, 150], (inten - 0.5) / 0.5);
  }

  const VIEW_FN = {
    terrain: terrainColor,
    moisture: moistureColor,
    fuel: fuelColor,
    intensity: intensityColor,
  };

  class Renderer {
    constructor(els) {
      this.els = els;
      this.view = 'terrain';
      this.ctxTerrain = this._setup(els.terrainCanvas);
      this.ctxFire = this._setup(els.fireCanvas);
      this.ctxSmoke = this._setup(els.smokeCanvas);
      els.stage.style.width = NATIVE_W + 'px';
      els.stage.style.height = NATIVE_H + 'px';
    }

    _setup(canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(NATIVE_W * dpr);
      canvas.height = Math.round(NATIVE_H * dpr);
      canvas.style.width = NATIVE_W + 'px';
      canvas.style.height = NATIVE_H + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }

    setView(view) { this.view = view; }

    bakeFull(sim) {
      const ctx = this.ctxTerrain;
      const fn = VIEW_FN[this.view] || terrainColor;
      const w = sim.w, h = sim.h;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const [r, g, b] = fn(sim, i);
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
        }
      }
      sim._dirtyRender.length = 0;
    }

    processDirty(sim) {
      if (sim._dirtyRender.length === 0) return;
      const ctx = this.ctxTerrain;
      const fn = VIEW_FN[this.view] || terrainColor;
      const w = sim.w;
      const seen = new Set();
      for (const i of sim._dirtyRender) {
        if (seen.has(i)) continue;
        seen.add(i);
        const x = i % w, y = (i / w) | 0;
        const [r, g, b] = fn(sim, i);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
      sim._dirtyRender.length = 0;
    }

    renderFireLayer(sim) {
      const ctx = this.ctxFire;
      ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      const activeSize = sim.active.size;
      if (activeSize === 0) return;
      const simplified = activeSize > 2200;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const w = sim.w;
      for (const i of sim.active) {
        const inten = sim.intensity[i];
        if (inten <= 0.015) continue;
        const state = sim.state[i];
        const x = i % w, y = (i / w) | 0;
        const cx = (x + 0.5) * CELL_PX, cy = (y + 0.5) * CELL_PX;
        let core, glow, alpha;
        if (state === FIRE_STATE.IGNITING) { core = [255, 226, 160]; glow = [255, 140, 40]; alpha = 0.25 + inten * 0.9; }
        else if (state === FIRE_STATE.BURNING) { core = [255, 244, 190]; glow = [255, 100, 24]; alpha = 0.5 + inten * 0.5; }
        else { core = [200, 110, 46]; glow = [110, 50, 22]; alpha = 0.15 + inten * 0.9; }

        if (simplified) {
          ctx.fillStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${Math.min(1, alpha).toFixed(2)})`;
          ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
          continue;
        }
        const r = CELL_PX * (0.9 + inten * 1.0);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},${(alpha * 0.5).toFixed(3)})`;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${core[0]},${core[1]},${core[2]},${(alpha * 0.85).toFixed(3)})`;
        ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    renderSmoke(smokeSystem) {
      const ctx = this.ctxSmoke;
      ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
      smokeSystem.draw(ctx);
    }

    clearSmoke() {
      this.ctxSmoke.clearRect(0, 0, NATIVE_W, NATIVE_H);
    }
  }

  Object.assign(WF, { Renderer, NATIVE_W, NATIVE_H });
})(window.WF = window.WF || {});
