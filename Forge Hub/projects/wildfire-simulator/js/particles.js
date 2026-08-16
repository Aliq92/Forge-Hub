(function (WF) {
  'use strict';

  const { FIRE_STATE } = WF;
  const MAX_PARTICLES = 380;

  class SmokeSystem {
    constructor(cellPx) {
      this.cellPx = cellPx;
      this.particles = [];
      this._spawnAccumulator = 0;
    }

    reset() {
      this.particles.length = 0;
    }

    spawnFromFire(sim, dt, windVec) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const rate = 26; // potential spawns/sec across all active fire, scaled by intensity
      let budget = rate * dt;
      for (const i of sim.active) {
        if (budget <= 0) break;
        const state = sim.state[i];
        if (state !== FIRE_STATE.BURNING && state !== FIRE_STATE.SMOLDERING) continue;
        const intensity = sim.intensity[i];
        const chance = intensity * dt * 3.2;
        if (Math.random() < chance) {
          const x = i % sim.w, y = (i / sim.w) | 0;
          this.particles.push({
            x: (x + 0.5) * this.cellPx + (Math.random() - 0.5) * this.cellPx,
            y: (y + 0.5) * this.cellPx,
            vx: windVec.x * windVec.s * 18 + (Math.random() - 0.5) * 6,
            vy: windVec.y * windVec.s * 10 - (8 + Math.random() * 10) - intensity * 6,
            life: 0,
            maxLife: 2.2 + Math.random() * 2.2,
            size: this.cellPx * (0.6 + Math.random() * 0.5) * (0.6 + intensity * 0.6),
            alpha: 0.18 + Math.random() * 0.12,
          });
          if (this.particles.length >= MAX_PARTICLES) break;
          budget -= 1;
        }
      }
    }

    update(dt, windVec) {
      const arr = this.particles;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += dt;
        if (p.life >= p.maxLife) { arr.splice(i, 1); continue; }
        p.vx += windVec.x * windVec.s * 6 * dt;
        p.vy -= 2 * dt; // gentle continued rise
        p.vx *= (1 - 0.15 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += dt * 5;
      }
    }

    draw(ctx) {
      const arr = this.particles;
      if (arr.length === 0) return;
      ctx.save();
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        const t = p.life / p.maxLife;
        const alpha = p.alpha * (1 - t) * (t < 0.15 ? t / 0.15 : 1);
        if (alpha <= 0.005) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(60,58,56,${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  WF.SmokeSystem = SmokeSystem;
})(window.WF = window.WF || {});
