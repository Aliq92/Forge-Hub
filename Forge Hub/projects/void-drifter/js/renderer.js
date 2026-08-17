// ---------------- Canvas render orchestration ----------------
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.resize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw({ player, world, camera, particles, starfield, time, sectorInfo, reducedMotion, insideIonCloud }) {
    const ctx = this.ctx;
    const w = this.width, h = this.height;

    const tint = sectorInfo ? sectorInfo.bgTint : '5,7,13';
    ctx.fillStyle = `rgb(${tint})`;
    ctx.fillRect(0, 0, w, h);

    const cam = { x: camera.renderX, y: camera.renderY };

    starfield.drawNebula(ctx, cam, w, h, reducedMotion);
    starfield.drawStars(ctx, cam, w, h, time, reducedMotion);

    world.draw(ctx, cam, w, h, time);
    particles.draw(ctx, cam, w, h);
    if (!player.destroyed) player.draw(ctx, cam, w, h, time);

    const fog = sectorInfo ? sectorInfo.fog : 0;
    if (fog > 0) {
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.75);
      grad.addColorStop(0, `rgba(${tint},0)`);
      grad.addColorStop(1, `rgba(${tint},${Math.min(0.85, fog)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    if (insideIonCloud) {
      const flicker = 0.03 + Math.random() * 0.04;
      ctx.fillStyle = `rgba(140,100,255,${flicker})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (player.damageFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${player.damageFlash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    // subtle vignette for cinematic depth (always on, cheap)
    const vgrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    vgrad.addColorStop(0, 'rgba(0,0,0,0)');
    vgrad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vgrad;
    ctx.fillRect(0, 0, w, h);
  }
}
