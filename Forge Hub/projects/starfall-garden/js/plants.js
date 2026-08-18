// Luminous flora: planting, growth, aura benefits, damage.
SG.Plants = {
  restoreCost(world, x, y, baseCost, player) {
    let cost = Math.max(1, Math.round(baseCost));
    if (player.rootNetworkBonus && this._nearAnyPlant(world, x, y, 1.0)) {
      const discount = SG.util.clamp(0.35 + (player.rootNetworkLevel || 1) * 0.12, 0.35, 0.75);
      cost = Math.max(1, Math.round(cost * (1 - discount)));
    }
    return cost;
  },

  _nearAnyPlant(world, x, y, scale) {
    for (const p of world.patches) {
      if (!p.plant || !p.plant.alive) continue;
      const cfg = SG.PLANT_TYPES[p.plant.type];
      const r = (cfg.auraRadius || 60) * scale;
      if (SG.util.dist2(x, y, p.x, p.y) <= r * r) return true;
    }
    return false;
  },

  canPlant(patch) {
    return patch && (patch.state === SG.TERRAIN.RESTORED || patch.state === SG.TERRAIN.CRYSTAL) && !patch.plant;
  },

  tryPlant(world, patch, typeKey, player) {
    if (!this.canPlant(patch)) return { ok: false, reason: 'terrain' };
    const cfg = SG.PLANT_TYPES[typeKey];
    const cost = Math.max(1, Math.round(cfg.cost * player.plantCostMul));
    if (player.fragments < cost) return { ok: false, reason: 'cost', cost };
    player.fragments -= cost;
    patch.plant = {
      type: typeKey, growth: 0, growTime: cfg.growTime, health: cfg.maxHealth, maxHealth: cfg.maxHealth,
      alive: true, pulsePhase: Math.random() * SG.util.TAU, damagedFlash: 0,
    };
    world.plantsAlive++;
    return { ok: true, cost };
  },

  update(dt, world, particles) {
    for (const patch of world.patches) {
      const pl = patch.plant;
      if (!pl || !pl.alive) continue;
      pl.pulsePhase += dt * 1.4;
      if (pl.damagedFlash > 0) pl.damagedFlash -= dt;
      if (pl.growth < 1) {
        pl.growth = Math.min(1, pl.growth + dt / pl.growTime);
        if (pl.growth >= 1) {
          world.markBlooming(patch);
          particles.burst(patch.x, patch.y, 14, {
            color: SG.PLANT_TYPES[pl.type].color, life: 0.7, size: 4, speedMin: 20, speedMax: 90, glow: true, gravity: -20,
          });
        }
      }
    }
  },

  // Sum of aura effects from all mature living plants near (x,y).
  getAuraEffects(world, x, y) {
    let energyRegenBonus = 0, magnetBonus = 0, damageReduction = 0, healBonus = 0;
    for (const patch of world.patches) {
      const pl = patch.plant;
      if (!pl || !pl.alive || pl.growth < 0.5) continue;
      const cfg = SG.PLANT_TYPES[pl.type];
      if (!cfg.auraRadius) continue;
      const d2 = SG.util.dist2(x, y, patch.x, patch.y);
      if (d2 > cfg.auraRadius * cfg.auraRadius) continue;
      const t = 1 - Math.sqrt(d2) / cfg.auraRadius;
      if (pl.type === 'starflower') energyRegenBonus += 0.9 * t;
      if (pl.type === 'luminatree') magnetBonus = Math.max(magnetBonus, 55 * t);
      if (pl.type === 'shieldbloom') damageReduction = Math.max(damageReduction, 0.55 * t);
      if (pl.type === 'hearttree') healBonus += 1.2 * t;
    }
    return { energyRegenBonus, magnetBonus, damageReduction, healBonus };
  },

  damage(world, patch, amount, particles, onDestroyed) {
    const pl = patch.plant;
    if (!pl || !pl.alive) return;
    pl.health -= amount;
    pl.damagedFlash = 0.4;
    particles.burst(patch.x, patch.y, 6, { color: '#ffb37a', life: 0.4, size: 3, speedMin: 20, speedMax: 60 });
    if (pl.health <= 0) {
      pl.alive = false;
      patch.plant = null;
      world.plantsAlive = Math.max(0, world.plantsAlive - 1);
      particles.burst(patch.x, patch.y, 16, { color: '#5a4636', life: 0.6, size: 4, speedMin: 30, speedMax: 100 });
      if (onDestroyed) onDestroyed(pl.type);
    }
  },
};
