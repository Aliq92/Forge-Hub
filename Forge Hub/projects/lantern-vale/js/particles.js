// Generic pooled particle system used by fireflies, dust, shrine bursts, etc.

export class Particle {
  constructor() { this.reset(); }
  reset() {
    this.active = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 2; this.color = '#ffffff';
    this.gravity = 0; this.drag = 1; this.fade = true;
    this.glow = false; this.shape = 'circle';
  }
}

export class ParticleSystem {
  constructor(maxParticles = 600) {
    this.pool = new Array(maxParticles).fill(null).map(() => new Particle());
    this.cursor = 0;
  }

  spawn(opts) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.reset();
    Object.assign(p, opts);
    p.active = true;
    p.age = 0;
    return p;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxLife) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx, camX, camY) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.age / p.maxLife;
      const alpha = p.fade ? Math.max(0, 1 - t) : 1;
      const sx = p.x - camX, sy = p.y - camY;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.2, p.size * (p.shrink ? (1 - t) : 1)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() { for (const p of this.pool) p.active = false; }
}
