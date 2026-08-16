(function (WF) {
  'use strict';

  const { TERRAIN, TERRAIN_INFO, FIRE_STATE, MANMADE, AREA_PER_CELL_HA, mulberry32 } = WF;

  const NEI = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ];
  const SQRT2 = Math.SQRT2;

  // Tunable spread parameters
  const BASE_SPREAD = 0.62;      // base probability-per-second scale
  const WIND_INFLUENCE = 2.0;    // how strongly wind skews directional spread
  const ELEV_INFLUENCE = 1.1;    // uphill spread boost
  const HEAT_GAIN = 0.55;
  const HEAT_DECAY = 0.90;       // per sim-tick multiplicative decay
  const EXTRA_MOISTURE_DECAY = 0.985;

  class FireSim {
  constructor(grid, env, rngSeed) {
    this.env = env;
    this.rng = mulberry32((rngSeed >>> 0) ^ 0x9e3779b9);
    this.loadTerrain(grid);
  }

  loadTerrain(grid) {
    this.grid = grid;
    const n = grid.w * grid.h;
    this.state = new Uint8Array(n);
    this.timer = new Float32Array(n);       // seconds spent in current state
    this.intensity = new Float32Array(n);
    this.heat = new Float32Array(n);
    this.extraMoisture = new Float32Array(n);

    this.active = new Set();
    this.burnedCount = 0;
    this.simTime = 0;
    this.ignitionPoints = 0;
    this.waterDropsUsed = 0;
    this.firebreakLength = 0;
    this.peakActiveCells = 0;
    this.everIgnited = false;
    this.completed = false;
    this.hitMilestones = new Set();
    this.lastContainmentPct = 0;
    this._dirtyRender = []; // list of cell indices whose terrain visuals changed (for renderer to bake)
  }

  get w() { return this.grid.w; }
  get h() { return this.grid.h; }

  isBurnable(i) {
    const info = TERRAIN_INFO[this.grid.terrain[i]];
    return info.burnable && this.grid.fuel[i] > 0;
  }

  // --- Tools -------------------------------------------------------------

  forEachInRadius(cx, cy, radius, fn) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2 + 0.01) fn(y * this.w + x, x, y);
      }
    }
  }

  ignite(cx, cy, radius = 1.2, countPoint = true) {
    let ignited = 0;
    this.forEachInRadius(cx, cy, radius, (i) => {
      if (this.isBurnable(i) && this.state[i] === FIRE_STATE.UNBURNED) {
        this.state[i] = FIRE_STATE.IGNITING;
        this.timer[i] = 0;
        this.intensity[i] = 0.08;
        this.active.add(i);
        ignited++;
      }
    });
    if (ignited > 0) {
      this.everIgnited = true;
      if (countPoint) this.ignitionPoints++;
    }
    return ignited;
  }

  applyFirebreak(cx, cy, radius) {
    let count = 0;
    this.forEachInRadius(cx, cy, radius, (i) => {
      if (this.grid.manmade[i] !== MANMADE.FIREBREAK) {
        if (this.grid.terrain[i] !== TERRAIN.WATER) {
          this.grid.terrain[i] = TERRAIN.BARE;
          this.grid.fuel[i] = 0;
          this.grid.maxFuel[i] = 0;
          this.grid.manmade[i] = MANMADE.FIREBREAK;
          this._dirtyRender.push(i);
          count++;
        }
      }
    });
    this.firebreakLength += count;
    return count;
  }

  applyContainment(cx, cy, radius) {
    let count = 0;
    this.forEachInRadius(cx, cy, radius, (i) => {
      if (this.grid.manmade[i] !== MANMADE.CONTAINMENT) {
        if (this.grid.terrain[i] !== TERRAIN.WATER) {
          this.grid.terrain[i] = TERRAIN.BARE;
          this.grid.fuel[i] = 0;
          this.grid.maxFuel[i] = 0;
          this.grid.manmade[i] = MANMADE.CONTAINMENT;
          this._dirtyRender.push(i);
          count++;
        }
      }
    });
    this.firebreakLength += count;
    return count;
  }

  applyClearVegetation(cx, cy, radius) {
    let count = 0;
    this.forEachInRadius(cx, cy, radius, (i) => {
      if (TERRAIN_INFO[this.grid.terrain[i]].burnable && this.grid.fuel[i] > 0) {
        this.grid.terrain[i] = TERRAIN.BARE;
        this.grid.fuel[i] = 0;
        this.grid.maxFuel[i] = 0;
        this._dirtyRender.push(i);
        count++;
      }
    });
    return count;
  }

  applyWaterDrop(cx, cy, radius) {
    let affected = 0;
    this.forEachInRadius(cx, cy, radius, (i, x, y) => {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / Math.max(radius, 0.001);
      const falloff = 1 - Math.min(1, d);
      this.extraMoisture[i] = Math.min(1, this.extraMoisture[i] + 0.85 * falloff);
      if (this.state[i] === FIRE_STATE.BURNING || this.state[i] === FIRE_STATE.IGNITING) {
        this.intensity[i] *= (1 - 0.55 * falloff);
        if (this.intensity[i] < 0.08 && this.rng() < 0.6 * falloff) {
          this.state[i] = FIRE_STATE.SMOLDERING;
          this.timer[i] = 0;
        }
        affected++;
      }
    });
    return affected;
  }

  // --- Simulation ----------------------------------------------------------

  effectiveMoisture(i) {
    const base = this.grid.baseMoisture[i];
    const globalMoisture = this.env.moisture; // 0..1
    const dryness = this.env.dryness; // 0..1
    let m = base * 0.45 + globalMoisture * 0.45 + this.extraMoisture[i];
    m -= dryness * 0.28;
    return Math.min(1, Math.max(0, m));
  }

  windVector() {
    const a = this.env.windDir;
    return { x: Math.sin(a), y: -Math.cos(a), s: this.env.windStrength };
  }

  spreadFrom(idx, sourceIntensity, dt, windVec) {
    const w = this.w;
    const x = idx % w, y = (idx / w) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = NEI[k][0], dy = NEI[k][1];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
      const ni = ny * w + nx;
      if (!this.isBurnable(ni)) continue;
      if (this.state[ni] !== FIRE_STATE.UNBURNED) continue;

      const info = TERRAIN_INFO[this.grid.terrain[ni]];
      const dist = (dx !== 0 && dy !== 0) ? SQRT2 : 1;

      let p = BASE_SPREAD * info.flammability * sourceIntensity;
      p *= 0.65 + 0.35 * Math.min(1, this.grid.fuel[ni] / Math.max(1, this.grid.maxFuel[ni]));

      const effMoisture = this.effectiveMoisture(ni);
      p *= Math.max(0.04, 1.45 - effMoisture * 1.7);

      p *= 0.55 + this.env.dryness * 1.1;
      p *= 0.85 + this.env.temperature * 0.3;

      const ux = dx / dist, uy = dy / dist;
      const dot = ux * windVec.x + uy * windVec.y;
      const windFactor = 1 + windVec.s * WIND_INFLUENCE * dot;
      p *= Math.max(0.04, windFactor);

      p /= dist;

      const slope = this.grid.elevation[ni] - this.grid.elevation[idx];
      p *= 1 + Math.min(0.5, Math.max(-0.3, slope * ELEV_INFLUENCE));

      p *= 1 + this.heat[ni] * 0.6;
      p = Math.min(1, Math.max(0, p));

      const chance = 1 - Math.pow(1 - p, dt);
      if (this.rng() < chance) {
        this.state[ni] = FIRE_STATE.IGNITING;
        this.timer[ni] = 0;
        this.intensity[ni] = 0.08;
        this.active.add(ni);
      } else {
        this.heat[ni] = Math.min(1, this.heat[ni] + sourceIntensity * dt * HEAT_GAIN);
      }
    }
  }

  step(dt) {
    if (this.completed) return;
    this.simTime += dt;
    const windVec = this.windVector();

    // decay heat / extra moisture across the whole grid (cheap, typed array pass)
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) {
      if (this.heat[i] > 0.001) this.heat[i] *= HEAT_DECAY; else if (this.heat[i]) this.heat[i] = 0;
      if (this.extraMoisture[i] > 0.001) this.extraMoisture[i] *= EXTRA_MOISTURE_DECAY; else if (this.extraMoisture[i]) this.extraMoisture[i] = 0;
    }

    const toRemove = [];
    for (const i of this.active) {
      const terrainType = this.grid.terrain[i];
      const info = TERRAIN_INFO[terrainType];
      this.timer[i] += dt;

      if (this.state[i] === FIRE_STATE.IGNITING) {
        const frac = Math.min(1, this.timer[i] / info.igniteDuration);
        this.intensity[i] = 0.06 + frac * 0.25;
        if (frac >= 1) {
          this.state[i] = FIRE_STATE.BURNING;
          this.timer[i] = 0;
        }
      } else if (this.state[i] === FIRE_STATE.BURNING) {
        const duration = info.burnDuration;
        const frac = this.timer[i] / duration;
        const fuelFrac = Math.max(0, this.grid.fuel[i] / Math.max(1, this.grid.maxFuel[i]));
        const bell = Math.sin(Math.min(1, frac) * Math.PI); // ramps up then down
        const moistureDamp = Math.max(0.25, 1 - this.effectiveMoisture(i) * 0.7);
        this.intensity[i] = info.intensityPeak * bell * moistureDamp * (0.4 + 0.6 * fuelFrac);

        const consumeRate = (this.grid.maxFuel[i] / duration) * (0.6 + 0.8 * this.intensity[i]);
        this.grid.fuel[i] = Math.max(0, this.grid.fuel[i] - consumeRate * dt);

        if (frac >= 1 || this.grid.fuel[i] <= 0.001) {
          this.state[i] = FIRE_STATE.SMOLDERING;
          this.timer[i] = 0;
        } else {
          this.spreadFrom(i, this.intensity[i], dt, windVec);
        }
      } else if (this.state[i] === FIRE_STATE.SMOLDERING) {
        const frac = this.timer[i] / info.smolderDuration;
        this.intensity[i] = info.intensityPeak * 0.18 * Math.max(0, 1 - frac);
        if (this.intensity[i] > 0.03) this.spreadFrom(i, this.intensity[i] * 0.3, dt, windVec);
        if (frac >= 1) {
          this.state[i] = FIRE_STATE.BURNED;
          this.intensity[i] = 0;
          this.burnedCount++;
          toRemove.push(i);
          this._dirtyRender.push(i);
        }
      }
    }
    for (const i of toRemove) this.active.delete(i);

    if (this.active.size > this.peakActiveCells) this.peakActiveCells = this.active.size;

    if (this.everIgnited && this.active.size === 0 && !this.completed) {
      this.completed = true;
    }
  }

  // --- Stats -----------------------------------------------------------

  computeActiveClusters() {
    if (this.active.size === 0) return 0;
    const visited = new Set();
    let clusters = 0;
    const w = this.w, h = this.h;
    for (const start of this.active) {
      if (visited.has(start)) continue;
      clusters++;
      const stack = [start];
      visited.add(start);
      while (stack.length) {
        const i = stack.pop();
        const x = i % w, y = (i / w) | 0;
        for (let k = 0; k < 8; k++) {
          const nx = x + NEI[k][0], ny = y + NEI[k][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited.has(ni) || !this.active.has(ni)) continue;
          visited.add(ni);
          stack.push(ni);
        }
      }
    }
    return clusters;
  }

  computeContainmentPct() {
    if (this.active.size === 0) return this.lastContainmentPct;
    let blocked = 0, total = 0;
    const w = this.w, h = this.h;
    for (const i of this.active) {
      if (this.state[i] !== FIRE_STATE.BURNING && this.state[i] !== FIRE_STATE.IGNITING) continue;
      const x = i % w, y = (i / w) | 0;
      let cellBlocked = 0, cellOpen = 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + NEI[k][0], ny = y + NEI[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) { cellBlocked++; continue; }
        const ni = ny * w + nx;
        const open = this.isBurnable(ni) && this.state[ni] === FIRE_STATE.UNBURNED;
        if (open) cellOpen++; else cellBlocked++;
      }
      // Skip fully-engulfed interior cells (no open neighbors) — they aren't
      // part of the active perimeter and would otherwise dilute the estimate.
      if (cellOpen === 0) continue;
      blocked += cellBlocked;
      total += cellBlocked + cellOpen;
    }
    const pct = total > 0 ? (blocked / total) * 100 : 100;
    this.lastContainmentPct = pct;
    return pct;
  }

  getStats() {
    let fuelSum = 0;
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) fuelSum += this.grid.fuel[i];
    const vegPct = this.grid.totalMaxFuel > 0 ? (fuelSum / this.grid.totalMaxFuel) * 100 : 0;

    let igniting = 0, burning = 0, smoldering = 0;
    for (const i of this.active) {
      if (this.state[i] === FIRE_STATE.IGNITING) igniting++;
      else if (this.state[i] === FIRE_STATE.BURNING) burning++;
      else if (this.state[i] === FIRE_STATE.SMOLDERING) smoldering++;
    }

    const burnedPct = this.grid.burnableTotal > 0 ? (this.burnedCount / this.grid.burnableTotal) * 100 : 0;

    return {
      activeFires: this.computeActiveClusters(),
      burningCells: igniting + burning + smoldering,
      burnedCells: this.burnedCount,
      burnedArea: this.burnedCount * AREA_PER_CELL_HA,
      burnedPct,
      vegPct: Math.max(0, Math.min(100, vegPct)),
      containmentPct: this.computeContainmentPct(),
      simTime: this.simTime,
      ignitionPoints: this.ignitionPoints,
      waterDropsUsed: this.waterDropsUsed,
      firebreakLength: this.firebreakLength,
      peakActiveCells: this.peakActiveCells,
      completed: this.completed,
    };
  }
  }

  WF.FireSim = FireSim;
})(window.WF = window.WF || {});
