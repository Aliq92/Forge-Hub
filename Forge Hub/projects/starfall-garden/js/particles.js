// Simple pooled particle system.
SG.ParticleSystem = class {
  constructor() {
    this.pool = [];
    this.active = [];
    this.densityMul = 1;
  }

  setDensity(level) {
    this.densityMul = level === 'low' ? 0.45 : level === 'high' ? 1.6 : 1;
  }

  _get() {
    return this.pool.pop() || {};
  }

  spawn(opts) {
    const p = this._get();
    p.x = opts.x; p.y = opts.y;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0;
    p.life = p.maxLife = opts.life || 0.6;
    p.size = opts.size || 3;
    p.endSize = opts.endSize !== undefined ? opts.endSize : p.size * 0.2;
    p.color = opts.color || '#ffffff';
    p.glow = opts.glow || false;
    p.gravity = opts.gravity || 0;
    p.drag = opts.drag !== undefined ? opts.drag : 0.98;
    p.shape = opts.shape || 'circle';
    p.alphaMul = opts.alphaMul !== undefined ? opts.alphaMul : 1;
    p.rot = opts.rot || 0;
    p.vrot = opts.vrot || 0;
    this.active.push(p);
  }

  burst(x, y, count, opts) {
    count = Math.round(count * this.densityMul);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * SG.util.TAU;
      const speed = SG.util.rand(opts.speedMin || 20, opts.speedMax || 90);
      this.spawn(Object.assign({}, opts, {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      }));
    }
  }

  update(dt) {
    const arr = this.active;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  draw(ctx) {
    for (const p of this.active) {
      const t = p.life / p.maxLife;
      const alpha = t * p.alphaMul;
      const size = SG.util.lerp(p.endSize, p.size, t);
      ctx.save();
      ctx.globalAlpha = SG.util.clamp(alpha, 0, 1);
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = size * 2.2;
      }
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, size), 0, SG.util.TAU);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-size, -size * 0.18, size * 2, size * 0.36);
      }
      ctx.restore();
    }
  }

  clear() {
    while (this.active.length) this.pool.push(this.active.pop());
  }

  get count() { return this.active.length; }
};
