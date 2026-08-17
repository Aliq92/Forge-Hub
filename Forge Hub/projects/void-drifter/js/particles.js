// ---------------- Pooled particle system ----------------
class ParticlePool {
  constructor(maxParticles = 500) {
    this.max = maxParticles;
    this.particles = [];
    for (let i = 0; i < maxParticles; i++) this.particles.push(this._blank());
    this.cursor = 0;
    this.densityMult = 1;
  }

  _blank() {
    return { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '255,255,255', alpha: 1, kind: 'spark', drag: 1, gravity: 0 };
  }

  setDensity(level) {
    this.densityMult = level === 'low' ? 0.35 : level === 'high' ? 1.5 : 1;
  }

  spawn(opts) {
    if (Math.random() > this.densityMult && opts.optional) return;
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.alive = true;
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = 0; p.maxLife = opts.life || 0.6;
    p.size = opts.size || 2;
    p.color = opts.color || '255,255,255';
    p.alpha = opts.alpha != null ? opts.alpha : 1;
    p.kind = opts.kind || 'spark';
    p.drag = opts.drag != null ? opts.drag : 1;
    p.gravity = opts.gravity || 0;
    return p;
  }

  burst(x, y, count, opts) {
    const n = Math.max(1, Math.round(count * this.densityMult));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU;
      const spd = randRangeSimple(opts.speedMin, opts.speedMax);
      this.spawn({
        x, y,
        vx: Math.cos(ang) * spd + (opts.vx || 0),
        vy: Math.sin(ang) * spd + (opts.vy || 0),
        life: randRangeSimple(opts.lifeMin, opts.lifeMax),
        size: randRangeSimple(opts.sizeMin, opts.sizeMax),
        color: opts.color,
        kind: opts.kind || 'spark',
        drag: opts.drag,
      });
    }
  }

  update(dt) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.drag !== 1) { p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60); }
    }
  }

  draw(ctx, camera, w, h) {
    ctx.save();
    for (const p of this.particles) {
      if (!p.alive) continue;
      const sx = p.x - camera.x + w / 2;
      const sy = p.y - camera.y + h / 2;
      if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
      const t = 1 - p.life / p.maxLife;
      const alpha = p.alpha * t;
      if (alpha <= 0.01) continue;
      if (p.kind === 'spark') {
        ctx.strokeStyle = `rgba(${p.color},${alpha})`;
        ctx.lineWidth = Math.max(0.6, p.size * t);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * 0.02, sy - p.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * t, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function randRangeSimple(min, max) { return min + Math.random() * (max - min); }
