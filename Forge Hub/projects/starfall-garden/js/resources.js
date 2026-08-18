// Star fragments: falling resources the player collects.
SG.ResourceManager = class {
  constructor(world) {
    this.world = world;
    this.fragments = [];
    this.spawnTimer = 0;
  }

  reset() {
    this.fragments = [];
    this.spawnTimer = 0.6;
  }

  _pickType(phase) {
    const t = SG.CONFIG.fragments.types;
    if (phase === SG.PHASE.NIGHT) {
      return SG.util.weightedChoice([
        { item: 'common', weight: 3 }, { item: 'bright', weight: 4 }, { item: 'ancient', weight: 1.4 },
      ]);
    }
    if (phase === SG.PHASE.WARNING) {
      return SG.util.weightedChoice([{ item: 'common', weight: 5 }, { item: 'bright', weight: 2.5 }, { item: 'ancient', weight: 0.3 }]);
    }
    return SG.util.weightedChoice([{ item: 'common', weight: 6 }, { item: 'bright', weight: 1 }]);
  }

  spawnOne(phase) {
    const w = this.world;
    const maxR = Math.max(20, w.unlockedRadius * 0.9);
    const angle = Math.random() * SG.util.TAU;
    const dist = Math.sqrt(Math.random()) * maxR;
    const targetX = Math.cos(angle) * dist;
    const targetY = Math.sin(angle) * dist;

    const originAngle = -Math.PI / 2 + SG.util.rand(-0.9, 0.9);
    const originDist = SG.util.rand(220, 360);
    const startX = targetX + Math.cos(originAngle) * originDist;
    const startY = targetY + Math.sin(originAngle) * originDist - 40;

    const typeKey = this._pickType(phase);
    const typeCfg = SG.CONFIG.fragments.types[typeKey];
    const fallDuration = typeKey === 'ancient' ? SG.util.rand(1.6, 2.0) : typeKey === 'bright' ? SG.util.rand(1.2, 1.6) : SG.util.rand(0.9, 1.3);

    this.fragments.push({
      typeKey, value: typeCfg.value, color: typeCfg.color, baseRadius: typeCfg.radius,
      startX, startY, targetX, targetY, x: startX, y: startY,
      progress: 0, fallDuration, landed: false, life: SG.CONFIG.fragments.lifeSeconds,
      maxLife: SG.CONFIG.fragments.lifeSeconds, magnetized: false, mvx: 0, mvy: 0,
      bob: Math.random() * SG.util.TAU,
    });
  }

  spawnBonusAt(x, y, typeKey) {
    const typeCfg = SG.CONFIG.fragments.types[typeKey];
    this.fragments.push({
      typeKey, value: typeCfg.value, color: typeCfg.color, baseRadius: typeCfg.radius,
      startX: x, startY: y, targetX: x, targetY: y, x, y,
      progress: 1, fallDuration: 0.1, landed: true, life: SG.CONFIG.fragments.lifeSeconds,
      maxLife: SG.CONFIG.fragments.lifeSeconds, magnetized: false, mvx: 0, mvy: 0,
      bob: Math.random() * SG.util.TAU,
    });
  }

  spawnInterval(phase) {
    switch (phase) {
      case SG.PHASE.NIGHT: return 0.5;
      case SG.PHASE.WARNING: return 1.25;
      case SG.PHASE.RECOVERY: return 1.7;
      default: return 2.1;
    }
  }

  update(dt, phase, player, effectiveCollectRadius, particles, onCollect) {
    this.spawnTimer -= dt;
    const maxFragments = 46;
    if (this.spawnTimer <= 0 && this.fragments.length < maxFragments) {
      this.spawnTimer = this.spawnInterval(phase) * SG.util.rand(0.8, 1.2);
      this.spawnOne(phase);
    }

    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.bob += dt * 3;
      if (!f.landed) {
        f.progress += dt / f.fallDuration;
        if (f.progress >= 1) {
          f.progress = 1; f.landed = true;
          f.x = f.targetX; f.y = f.targetY;
          particles.burst(f.x, f.y, 8, { color: f.color, life: 0.5, size: 3, speedMin: 20, speedMax: 70, glow: true, gravity: -10 });
        } else {
          const t = SG.util.easeInCubic(f.progress);
          f.x = SG.util.lerp(f.startX, f.targetX, t);
          f.y = SG.util.lerp(f.startY, f.targetY, t);
        }
        continue;
      }

      f.life -= dt;
      if (f.life <= 0) { this.fragments.splice(i, 1); continue; }

      const dx = player.x - f.x, dy = player.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d <= effectiveCollectRadius) f.magnetized = true;

      if (f.magnetized) {
        const pull = SG.util.clamp((effectiveCollectRadius - d) / effectiveCollectRadius, 0, 1);
        const speed = 260 + pull * 420;
        if (d > 0.01) {
          f.mvx = (dx / d) * speed;
          f.mvy = (dy / d) * speed;
        }
        f.x += f.mvx * dt;
        f.y += f.mvy * dt;
        if (d < 14) {
          onCollect(f);
          particles.burst(f.x, f.y, 10, { color: f.color, life: 0.4, size: 3.5, speedMin: 40, speedMax: 130, glow: true });
          this.fragments.splice(i, 1);
        }
      }
    }
  }
};
