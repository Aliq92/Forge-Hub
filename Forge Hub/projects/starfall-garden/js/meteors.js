// Starfall cycle: calm / warning / night / recovery phases and telegraphed meteor impacts.
SG.METEOR_TYPES = {
  small: { impactRadius: 34, warnTime: 1.3, fallTime: 0.4, damage: 12, color: '#ff8c3c' },
  large: { impactRadius: 62, warnTime: 2.3, fallTime: 0.65, damage: 28, color: '#ff4d4d' },
  crystal: { impactRadius: 30, warnTime: 1.5, fallTime: 0.45, damage: 10, color: '#8fd9ff' },
};

SG.MeteorManager = class {
  constructor(world) {
    this.world = world;
    this.reset();
  }

  reset(hard = true) {
    this.phase = SG.PHASE.CALM;
    this.phaseTimer = 13;
    this.cyclesCompleted = 0;
    this.meteors = [];
    this.spawnTimer = 1.5;
    this.stats = { meteorsTotal: 0, meteorsDodged: 0, meteorHits: 0 };
    this.shakeAmount = 0;
    this.warnedThisPhase = false;
  }

  difficulty(healthPct) {
    const d = SG.util.clamp(this.cyclesCompleted * 0.16 + healthPct / 140, 0, 1.6);
    return d;
  }

  phaseDurations(diff, hard) {
    const mul = hard ? 0.8 : 1;
    return {
      calm: Math.max(7, (13 - diff * 2.4)) * mul,
      warning: 3.6,
      night: Math.max(9, (11 + diff * 5)) * mul,
      recovery: Math.max(5, (8 - diff * 1.2)),
    };
  }

  _setPhase(p, diff, hardMode) {
    this.phase = p;
    const d = this.phaseDurations(diff, hardMode);
    this.phaseTimer = d[p];
    this.warnedThisPhase = false;
  }

  update(dt, player, particles, resourceManager, world, callbacks, healthPct, hardMode, fallSlowMul) {
    this.world = world;
    const diff = this.difficulty(healthPct);
    this.phaseTimer -= dt;

    if (this.phaseTimer <= 0) {
      if (this.phase === SG.PHASE.CALM) this._setPhase(SG.PHASE.WARNING, diff, hardMode);
      else if (this.phase === SG.PHASE.WARNING) this._setPhase(SG.PHASE.NIGHT, diff, hardMode);
      else if (this.phase === SG.PHASE.NIGHT) { this.cyclesCompleted++; this._setPhase(SG.PHASE.RECOVERY, diff, hardMode); }
      else this._setPhase(SG.PHASE.CALM, diff, hardMode);
    }

    if (this.phase === SG.PHASE.WARNING && !this.warnedThisPhase) {
      this.warnedThisPhase = true;
      if (callbacks.onWarning) callbacks.onWarning();
    }

    this._updateSpawning(dt, diff, player, hardMode);
    this._updateMeteors(dt, player, particles, resourceManager, callbacks, fallSlowMul || 1);

    if (this.shakeAmount > 0) this.shakeAmount = Math.max(0, this.shakeAmount - dt * 3.2);
  }

  _maxConcurrent(diff) {
    if (this.phase === SG.PHASE.NIGHT) return Math.round(3 + diff * 2.4);
    if (this.phase === SG.PHASE.WARNING) return 2;
    return 0;
  }

  _updateSpawning(dt, diff, player, hardMode) {
    if (this.spawningDisabled) return;
    if (this.phase !== SG.PHASE.WARNING && this.phase !== SG.PHASE.NIGHT) return;
    this.spawnTimer -= dt;
    const activeWarnings = this.meteors.filter(m => m.state !== 'impacted').length;
    if (this.spawnTimer <= 0 && activeWarnings < this._maxConcurrent(diff)) {
      const baseInterval = this.phase === SG.PHASE.NIGHT ? Math.max(0.65, 1.5 - diff * 0.5) : 1.8;
      this.spawnTimer = baseInterval * SG.util.rand(0.75, 1.25) * (hardMode ? 0.75 : 1);
      this._spawnMeteor(diff, player);
    }
  }

  _pickTarget(player) {
    const w = this.world;
    const maxR = Math.max(30, w.unlockedRadius * 0.92);
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * SG.util.TAU;
      const dist = Math.sqrt(Math.random()) * maxR;
      const x = Math.cos(angle) * dist, y = Math.sin(angle) * dist;
      if (SG.util.dist(x, y, player.x, player.y) >= 70) return { x, y };
    }
    return { x: Math.cos(Math.random() * SG.util.TAU) * maxR * 0.5, y: 0 };
  }

  _spawnMeteor(diff, player, forcedType, posOverride) {
    let typeKey = forcedType;
    if (!typeKey) {
      const entries = [{ item: 'small', weight: 5 }, { item: 'large', weight: 1.2 + diff * 1.4 }];
      if (this.phase === SG.PHASE.NIGHT && diff > 0.35) entries.push({ item: 'crystal', weight: 0.7 });
      typeKey = SG.util.weightedChoice(entries);
    }
    const cfg = SG.METEOR_TYPES[typeKey];
    const target = posOverride || this._pickTarget(player);
    const sizeMul = 1 + Math.min(0.35, diff * 0.22);
    const originAngle = -Math.PI / 2 + SG.util.rand(-0.7, 0.7);
    const originDist = SG.util.rand(260, 420);
    const startX = target.x + Math.cos(originAngle) * originDist;
    const startY = target.y + Math.sin(originAngle) * originDist - 60;
    this.meteors.push({
      typeKey,
      x: target.x, y: target.y,
      startX, startY, drawX: startX, drawY: startY,
      impactRadius: cfg.impactRadius * (typeKey === 'large' ? sizeMul : 1),
      damage: Math.round(cfg.damage * (1 + Math.min(0.3, diff * 0.18))),
      warnTime: cfg.warnTime + (player.warningTimeBonus || 0),
      warnTimer: cfg.warnTime + (player.warningTimeBonus || 0),
      fallTime: cfg.fallTime,
      fallTimer: cfg.fallTime,
      state: 'warning',
      color: cfg.color,
    });
    this.stats.meteorsTotal++;
  }

  _updateMeteors(dt, player, particles, resourceManager, callbacks, fallSlowMul) {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      if (m.state === 'warning') {
        m.warnTimer -= dt;
        if (m.warnTimer <= 0) { m.state = 'falling'; }
      } else if (m.state === 'falling') {
        m.fallTimer -= dt * fallSlowMul;
        const t = SG.util.easeInCubic(1 - Math.max(0, m.fallTimer) / m.fallTime);
        m.drawX = SG.util.lerp(m.startX, m.x, t);
        m.drawY = SG.util.lerp(m.startY, m.y, t);
        if (m.fallTimer <= 0) {
          this._impact(m, player, particles, resourceManager, callbacks);
          m.state = 'impacted';
          m.impactedFlash = 0.35;
        }
      } else if (m.state === 'impacted') {
        m.impactedFlash -= dt;
        if (m.impactedFlash <= 0) { this.meteors.splice(i, 1); }
      }
    }
  }

  _impact(m, player, particles, resourceManager, callbacks) {
    const w = this.world;
    let hitPlayer = false;
    const isCrystal = m.typeKey === 'crystal';

    for (const patch of w.patches) {
      const d = SG.util.dist(patch.x, patch.y, m.x, m.y);
      if (d > m.impactRadius) continue;
      if (isCrystal) {
        if (patch.state === SG.TERRAIN.DEAD && w.isUnlocked(patch)) {
          w.restorePatch(patch, true);
        }
      } else {
        const wasAlive = patch.state === SG.TERRAIN.RESTORED || patch.state === SG.TERRAIN.BLOOMING || patch.state === SG.TERRAIN.CRYSTAL;
        if (patch.plant) {
          const frac = 1 - d / m.impactRadius;
          SG.Plants.damage(w, patch, m.damage * frac * 1.4, particles, callbacks.onPlantDestroyed);
        }
        if (wasAlive) w.scorchPatch(patch);
      }
    }

    if (isCrystal && resourceManager) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * SG.util.TAU, r = SG.util.rand(6, m.impactRadius * 0.6);
        resourceManager.spawnBonusAt(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, 'bright');
      }
    }

    const distToPlayer = SG.util.dist(player.x, player.y, m.x, m.y);
    if (distToPlayer <= m.impactRadius + player.radius * 0.7) {
      const reduction = SG.Plants.getAuraEffects(w, player.x, player.y).damageReduction;
      const dmg = Math.max(1, Math.round(m.damage * (1 - reduction)));
      const applied = player.applyDamage(dmg);
      if (applied > 0) { hitPlayer = true; this.stats.meteorHits++; }
    }
    if (!hitPlayer) this.stats.meteorsDodged++;

    particles.burst(m.x, m.y, isCrystal ? 20 : 26, {
      color: m.color, life: 0.6, size: 5, speedMin: 60, speedMax: 220, glow: true, gravity: 40, drag: 0.9,
    });
    this.shakeAmount = Math.min(1, this.shakeAmount + (m.typeKey === 'large' ? 0.85 : 0.4));
    if (callbacks.onImpact) callbacks.onImpact(m, hitPlayer);
  }

  getPhaseLabel() {
    switch (this.phase) {
      case SG.PHASE.CALM: return 'CALM';
      case SG.PHASE.WARNING: return 'STARFALL WARNING';
      case SG.PHASE.NIGHT: return 'STARFALL NIGHT';
      case SG.PHASE.RECOVERY: return 'RECOVERY';
    }
  }
};
