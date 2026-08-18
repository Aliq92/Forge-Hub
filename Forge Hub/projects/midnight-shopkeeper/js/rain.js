// Minimal canvas rain effect. Pauses automatically when the tab is hidden or reduced motion is on.
export class RainEffect {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.drops = [];
    this.count = opts.count || 90;
    this.running = false;
    this.reducedMotion = false;
    this._raf = null;
    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(); else if (this.wantRunning) this.resume();
    });
    this.resize();
    this.seed();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width; this.h = rect.height;
  }

  seed() {
    this.drops = Array.from({ length: this.count }, () => this.newDrop(true));
  }

  newDrop(randomY) {
    return {
      x: Math.random() * (this.w || 300),
      y: randomY ? Math.random() * (this.h || 500) : -10,
      len: 10 + Math.random() * 18,
      speed: 260 + Math.random() * 220,
      drift: 18 + Math.random() * 10,
      opacity: 0.08 + Math.random() * 0.18,
    };
  }

  start() {
    this.wantRunning = true;
    if (this.reducedMotion) { this.drawStatic(); return; }
    this.resume();
  }

  resume() {
    if (this.running || this.reducedMotion) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.step(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  pause() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  stop() {
    this.pause();
    this.wantRunning = false;
  }

  setReducedMotion(v) {
    this.reducedMotion = v;
    if (v) { this.pause(); this.drawStatic(); }
    else if (this.wantRunning) this.resume();
  }

  drawStatic() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.strokeStyle = 'rgba(200,215,230,0.12)';
    ctx.lineWidth = 1;
    for (const d of this.drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3, d.y + d.len);
      ctx.stroke();
    }
  }

  step(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.lineCap = 'round';
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.drift * dt;
      ctx.strokeStyle = `rgba(200,215,230,${d.opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
      ctx.stroke();
      if (d.y > this.h + 20) Object.assign(d, this.newDrop(false));
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this._resize);
  }
}
