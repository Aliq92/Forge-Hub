/* Bacteria Bloom - core simulation: growth, competition, death, mutation */
(function (BB) {
  'use strict';
  const C = BB.CONFIG;
  const util = BB.util;
  const STRAIN_ORDER = BB.Strains.STRAIN_ORDER;

  const NEI8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const NEI8_LEN = NEI8.map(([x, y]) => Math.hypot(x, y));

  function Simulation(env) {
    this.env = env;
    this.w = env.w; this.h = env.h;
    this.n = this.w * this.h;

    this.colonyIdGrid = new Int32Array(this.n);      // 0 = empty
    this.strainIdxGrid = new Uint8Array(this.n).fill(255);
    this.density = new Float32Array(this.n);
    this.age = new Float32Array(this.n);
    this.mutationIdGrid = new Int16Array(this.n).fill(-1);
    this.dead = new Uint8Array(this.n);
    this.deathFade = new Float32Array(this.n);
    this.dirX = new Float32Array(this.n);
    this.dirY = new Float32Array(this.n);

    this.dishCellCount = 0;
    for (let i = 0; i < this.n; i++) if (env.dishMask[i]) this.dishCellCount++;

    this.colonies = new Map();
    this.rng = util.mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

    this.simTime = 0;
    this.tickAccumulator = 0;
    this.speedMultiplier = 1;
    this.mutationRate = 'low';

    this.stats = null;
  }

  Simulation.prototype.computeTempFactor = function (strain, temp) {
    const center = (strain.idealTempMin + strain.idealTempMax) / 2;
    const halfBand = (strain.idealTempMax - strain.idealTempMin) / 2;
    const dist = Math.abs(temp - center);
    if (dist <= halfBand) return 1.0;
    const over = dist - halfBand;
    return Math.max(0, 1 - Math.pow(over / strain.tempTolerance, 1.6));
  };

  Simulation.prototype.computeDeathRate = function (strain, nutrient, inhibitor, tempFactor, stressMult) {
    let rate = 0;
    if (nutrient < 0.06) rate += (0.06 - nutrient) * 2.4 / strain.starvationTolerance;
    if (tempFactor < 0.15) rate += (0.15 - tempFactor) * 3.2 / strain.starvationTolerance;
    if (inhibitor > 0) rate += inhibitor * inhibitor * 0.85 * strain.inhibitorSensitivity;
    return rate * (stressMult || 1) * 0.6;
  };

  Simulation.prototype.computeStressLevel = function (strain, nutrient, inhibitor, tempFactor) {
    const starve = util.clamp((0.15 - nutrient) / 0.15, 0, 1);
    const heat = util.clamp(1 - tempFactor, 0, 1);
    const inhib = util.clamp(inhibitor * strain.inhibitorSensitivity, 0, 1);
    return util.clamp(Math.max(starve * 0.7, heat * 0.8, inhib) , 0, 1);
  };

  Simulation.prototype.inoculate = function (strainKey, gx, gy) {
    gx = Math.round(gx); gy = Math.round(gy);
    if (!this.env.inDish(gx, gy)) return null;
    const idx0 = gy * this.w + gx;
    if (this.colonyIdGrid[idx0] !== 0 && !this.dead[idx0]) return null;

    const colony = new BB.Colony(strainKey, idx0, this.simTime);
    this.colonies.set(colony.id, colony);

    const seedOffsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ox, oy] of seedOffsets) {
      const nx = gx + ox, ny = gy + oy;
      if (!this.env.inDish(nx, ny)) continue;
      const nIdx = ny * this.w + nx;
      if (this.colonyIdGrid[nIdx] !== 0 && !this.dead[nIdx]) continue;
      const ang = this.rng() * Math.PI * 2;
      this.claimCell(colony, nIdx, { dx: Math.cos(ang), dy: Math.sin(ang) }, null);
      colony.frontier.add(nIdx);
    }
    return colony;
  };

  Simulation.prototype.claimCell = function (colony, idx, dir, parentMut) {
    if (this.dead[idx]) {
      const oldColony = this.colonies.get(this.colonyIdGrid[idx]);
      if (oldColony) { oldColony.fading.delete(idx); oldColony.frontier.delete(idx); }
    }
    const strainIdx = STRAIN_ORDER.indexOf(colony.strainKey);
    this.colonyIdGrid[idx] = colony.id;
    this.strainIdxGrid[idx] = strainIdx;
    this.density[idx] = C.START_DENSITY;
    this.age[idx] = 0;
    this.dead[idx] = 0;
    this.deathFade[idx] = 0;
    colony.cellCount++;

    let dx = dir ? dir.dx : 0, dy = dir ? dir.dy : 0;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const jitter = (this.rng() - 0.5) * 0.6;
    const cos = Math.cos(jitter), sin = Math.sin(jitter);
    this.dirX[idx] = dx * cos - dy * sin;
    this.dirY[idx] = dx * sin + dy * cos;

    const consume = colony.strain.nutrientConsume * C.BASE_NUTRIENT_CONSUME;
    this.env.nutrient[idx] = Math.max(0, this.env.nutrient[idx] - consume);

    let mutId = parentMut ? parentMut.id : -1;
    if (!parentMut) {
      const mutRate = (C.MUTATION_RATES[this.mutationRate] || 0) * colony.strain.mutationTendency;
      if (mutRate > 0 && this.rng() < mutRate) {
        const variant = colony.addMutation(this.rng);
        mutId = variant.id;
      }
    }
    this.mutationIdGrid[idx] = mutId;
  };

  Simulation.prototype.killCell = function (colony, idx) {
    if (this.dead[idx]) return;
    this.dead[idx] = 1;
    this.deathFade[idx] = 1;
    colony.cellCount = Math.max(0, colony.cellCount - 1);
    colony.frontier.delete(idx);
    colony.fading.add(idx);
  };

  Simulation.prototype.resolveCompetition = function (attacker, attackerIdx, targetIdx, dt, attackerTempFactor) {
    const defender = this.colonies.get(this.colonyIdGrid[targetIdx]);
    if (!defender || defender === attacker || this.dead[targetIdx]) return;
    const atkStrain = attacker.strain, defStrain = defender.strain;
    const atkStrength = atkStrain.competitiveStrength * this.density[attackerIdx] * attackerTempFactor;
    const defTempFactor = this.computeTempFactor(defStrain, this.env.temperature);
    const defStrength = defStrain.competitiveStrength * this.density[targetIdx] * defTempFactor;
    const margin = C.COMPETITION_MARGIN;
    const rate = C.COMPETITION_CONVERT_RATE * dt;

    if (atkStrength > defStrength * margin) {
      this.density[targetIdx] -= rate * (atkStrength / (defStrength + 0.001)) * 0.15;
      if (this.density[targetIdx] <= C.CLAIM_MIN_DENSITY) {
        defender.cellCount = Math.max(0, defender.cellCount - 1);
        defender.frontier.delete(targetIdx);
        const mutId = this.mutationIdGrid[attackerIdx];
        const mut = mutId > 0 ? attacker.mutations[mutId - 1] : null;
        this.claimCell(attacker, targetIdx, { dx: this.dirX[attackerIdx], dy: this.dirY[attackerIdx] }, mut);
        return targetIdx;
      }
    } else if (defStrength > atkStrength * margin) {
      this.density[attackerIdx] -= rate * (defStrength / (atkStrength + 0.001)) * 0.08;
      if (this.density[attackerIdx] <= C.CLAIM_MIN_DENSITY) {
        this.killCell(attacker, attackerIdx);
      }
    }
    return null;
  };

  Simulation.prototype.growColony = function (colony, dt) {
    const strain = colony.strain;
    const env = this.env;
    const w = this.w;
    const toAdd = [];

    for (const idx of colony.frontier) {
      if (this.dead[idx]) continue;

      const gx = idx % w, gy = (idx / w) | 0;
      const localNutrient = env.nutrient[idx];
      const localInhibitor = env.inhibitor[idx];
      const tempFactor = this.computeTempFactor(strain, env.temperature);
      const mutId = this.mutationIdGrid[idx];
      const mut = mutId > 0 ? colony.mutations[mutId - 1] : null;
      const growthMult = mut ? mut.growthMult : 1;
      const stressMult = mut ? mut.stressMult : 1;

      // thicken interior density
      const dmax = strain.densityMax;
      if (this.density[idx] < dmax) {
        const nutFactor = 0.15 + 0.85 * localNutrient;
        const inhibFactor = Math.max(0, 1 - localInhibitor * strain.inhibitorSensitivity);
        const thickAmt = C.BASE_THICKEN_RATE * strain.thickenRate * growthMult * tempFactor * nutFactor * inhibFactor * dt;
        if (thickAmt > 0) {
          this.density[idx] = Math.min(dmax, this.density[idx] + thickAmt);
          env.nutrient[idx] = Math.max(0, env.nutrient[idx] - thickAmt * strain.nutrientConsume * 0.4);
        }
      }
      this.age[idx] += dt;

      // death / stress
      const deathRate = this.computeDeathRate(strain, localNutrient, localInhibitor, tempFactor, stressMult);
      if (deathRate > 0) {
        this.density[idx] -= deathRate * dt;
        if (this.density[idx] <= 0) {
          this.killCell(colony, idx);
          continue;
        }
      }

      let hasOpenNeighbor = false;
      let hasContest = false;
      const dlen = Math.hypot(this.dirX[idx], this.dirY[idx]);

      for (let k = 0; k < 8; k++) {
        const ox = NEI8[k][0], oy = NEI8[k][1];
        const nx = gx + ox, ny = gy + oy;
        if (!env.inDish(nx, ny)) continue;
        const nIdx = ny * w + nx;
        const targetNutrient = env.nutrient[nIdx];
        const targetInhibitor = env.inhibitor[nIdx];

        let dirBias = 1;
        if (strain.branchiness > 0.01 && dlen > 0.01) {
          const dot = (ox * this.dirX[idx] + oy * this.dirY[idx]) / (NEI8_LEN[k] * dlen);
          dirBias = util.lerp(1, Math.max(0.05, (dot + 1) / 2 * 1.9), strain.branchiness * (mut ? mut.branchMult : 1));
        }
        let seekBias = 1;
        if (strain.nutrientSeeking) {
          seekBias = Math.max(0.15, 1 + (targetNutrient - localNutrient) * strain.nutrientSeeking);
        }

        const isEmpty = this.colonyIdGrid[nIdx] === 0 || this.dead[nIdx];
        if (isEmpty) {
          if (targetInhibitor >= C.INHIBITOR_KILL_THRESHOLD && strain.inhibitorSensitivity > 0.95) continue;
          hasOpenNeighbor = true;
          const nutFactor2 = 0.08 + 0.92 * targetNutrient;
          const inhibFactor2 = Math.max(0, 1 - targetInhibitor * strain.inhibitorSensitivity);
          const densityGate = util.clamp(this.density[idx] / (dmax * 0.4), 0.15, 1);
          const isoRandom = util.lerp(1, this.rng() * 0.6 + 0.7, strain.isotropy);
          const prob = C.BASE_SPREAD_RATE * strain.growthRate * growthMult * tempFactor *
            nutFactor2 * inhibFactor2 * densityGate * dirBias * seekBias * isoRandom * dt;
          if (this.rng() < prob) {
            this.claimCell(colony, nIdx, { dx: ox, dy: oy }, mut);
            toAdd.push(nIdx);
          }
        } else if (this.colonyIdGrid[nIdx] !== colony.id) {
          hasContest = true;
          const won = this.resolveCompetition(colony, idx, nIdx, dt, tempFactor);
          if (won !== null) toAdd.push(won);
        }
      }

      if (this.dead[idx]) continue; // may have died mid-loop via competition push-back

      const maturedFully = this.density[idx] >= dmax * 0.985;
      const stable = maturedFully && !hasOpenNeighbor && !hasContest;
      if (!stable) toAdd.push(idx);
    }

    colony.frontier = new Set(toAdd);
  };

  Simulation.prototype.decayFading = function (colony) {
    if (colony.fading.size === 0) return;
    const toClear = [];
    for (const idx of colony.fading) {
      this.deathFade[idx] -= C.DEATH_CLEAR_FADE;
      if (this.deathFade[idx] <= 0) toClear.push(idx);
    }
    for (const idx of toClear) {
      colony.fading.delete(idx);
      this.colonyIdGrid[idx] = 0;
      this.strainIdxGrid[idx] = 255;
      this.density[idx] = 0;
      this.age[idx] = 0;
      this.dead[idx] = 0;
      this.deathFade[idx] = 0;
      this.mutationIdGrid[idx] = -1;
      this.dirX[idx] = 0; this.dirY[idx] = 0;
    }
  };

  Simulation.prototype.tick = function () {
    const dt = 1 / C.BASE_TICKS_PER_SEC;
    this.simTime += dt;
    this.env.stepRegen(dt);
    for (const colony of this.colonies.values()) {
      this.growColony(colony, dt);
      this.decayFading(colony);
    }
  };

  Simulation.prototype.eraseAt = function (gx, gy, radius) {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(gx - radius)), x1 = Math.min(this.w - 1, Math.ceil(gx + radius));
    const y0 = Math.max(0, Math.floor(gy - radius)), y1 = Math.min(this.h - 1, Math.ceil(gy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx, dy = y - gy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (!this.env.dishMask[i]) continue;
        if (this.colonyIdGrid[i] !== 0 && !this.dead[i]) {
          const colony = this.colonies.get(this.colonyIdGrid[i]);
          if (colony) this.killCell(colony, i);
        }
      }
    }
    this.env.eraseAt(gx, gy, radius);
  };

  Simulation.prototype.resetDish = function () {
    this.colonyIdGrid.fill(0);
    this.strainIdxGrid.fill(255);
    this.density.fill(0);
    this.age.fill(0);
    this.mutationIdGrid.fill(-1);
    this.dead.fill(0);
    this.deathFade.fill(0);
    this.dirX.fill(0); this.dirY.fill(0);
    this.colonies.clear();
    this.simTime = 0;
    BB.resetColonyIds();
  };

  Simulation.prototype.newDish = function (seed) {
    this.resetDish();
    this.env.randomize(seed || (Date.now() >>> 0));
    this.env.temperature = C.TEMP_DEFAULT;
  };

  Simulation.prototype.computeStats = function () {
    const order = STRAIN_ORDER;
    const counts = { rapida: 0, dendra: 0, compacta: 0, resilia: 0 };
    const mass = { rapida: 0, dendra: 0, compacta: 0, resilia: 0 };
    let aliveTotal = 0, nutrientSum = 0;

    for (let i = 0; i < this.n; i++) {
      if (!this.env.dishMask[i]) continue;
      nutrientSum += this.env.nutrient[i];
      const sId = this.strainIdxGrid[i];
      if (sId === 255 || this.dead[i]) continue;
      const key = order[sId];
      counts[key]++;
      mass[key] += this.density[i];
      aliveTotal++;
    }

    let dominant = null, domMass = 0;
    for (const k of order) if (mass[k] > domMass) { domMass = mass[k]; dominant = k; }

    this.stats = {
      coverage: aliveTotal / this.dishCellCount,
      totalMass: order.reduce((s, k) => s + mass[k], 0),
      avgNutrient: nutrientSum / this.dishCellCount,
      dominant,
      perStrain: order.map(k => ({ key: k, count: counts[k], mass: mass[k], coverage: counts[k] / this.dishCellCount })),
      simTime: this.simTime,
      temperature: this.env.temperature
    };
    return this.stats;
  };

  Simulation.prototype.getCellInfo = function (gx, gy) {
    gx = Math.round(gx); gy = Math.round(gy);
    if (!this.env.inDish(gx, gy)) return null;
    const idx = gy * this.w + gx;
    if (this.colonyIdGrid[idx] === 0 && !this.dead[idx]) {
      return { empty: true, nutrient: this.env.nutrient[idx], inhibitor: this.env.inhibitor[idx] };
    }
    const colony = this.colonies.get(this.colonyIdGrid[idx]);
    const strain = colony ? colony.strain : null;
    const tempFactor = strain ? this.computeTempFactor(strain, this.env.temperature) : 1;
    const stress = strain ? this.computeStressLevel(strain, this.env.nutrient[idx], this.env.inhibitor[idx], tempFactor) : 0;
    const mutId = this.mutationIdGrid[idx];
    const mut = (mutId > 0 && colony) ? colony.mutations[mutId - 1] : null;
    return {
      empty: false,
      strainName: strain ? strain.name : '?',
      colonyAge: colony ? (this.simTime - colony.birthTime) : 0,
      density: this.density[idx],
      nutrient: this.env.nutrient[idx],
      inhibitor: this.env.inhibitor[idx],
      tempFactor,
      stress,
      dead: !!this.dead[idx],
      mutation: mut
    };
  };

  BB.Simulation = Simulation;

})(window.BB = window.BB || {});
