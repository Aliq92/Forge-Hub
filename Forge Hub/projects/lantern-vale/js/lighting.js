// The darkness/light compositing system. The world is drawn at full
// brightness; a darkness layer is then punched full of soft holes wherever
// light sources are, using canvas compositing (never a flat transparent
// rectangle). A coarse world-space memory grid drives the Afterglow effect.
import { clamp, lerp, dist } from './utils.js';
import { COLORS, TILE } from './config.js';

const MEMORY_CELL = 96;

export class LightingSystem {
  constructor(world) {
    this.world = world;
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.memCols = Math.ceil(world.pixelW / MEMORY_CELL) + 1;
    this.memRows = Math.ceil(world.pixelH / MEMORY_CELL) + 1;
    this.memory = new Float32Array(this.memCols * this.memRows).fill(-999);
    this.time = 0;
  }

  resize(w, h) {
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
  }

  _memIdx(cx, cy) { return cy * this.memCols + cx; }

  updateMemory(dt, player) {
    this.time += dt;
    const r = player.lantern.radius;
    if (r < 10) return;
    const cxMin = Math.max(0, Math.floor((player.x - r) / MEMORY_CELL));
    const cxMax = Math.min(this.memCols - 1, Math.ceil((player.x + r) / MEMORY_CELL));
    const cyMin = Math.max(0, Math.floor((player.y - r) / MEMORY_CELL));
    const cyMax = Math.min(this.memRows - 1, Math.ceil((player.y + r) / MEMORY_CELL));
    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const wx = cx * MEMORY_CELL, wy = cy * MEMORY_CELL;
        if (dist(wx, wy, player.x, player.y) <= r + MEMORY_CELL) {
          this.memory[this._memIdx(cx, cy)] = this.time;
        }
      }
    }
  }

  // Composite darkness over the already-drawn bright world scene.
  composite(ctx, camX, camY, viewW, viewH, sources, player, depth, settings) {
    if (viewW <= 0 || viewH <= 0) return;
    const mctx = this.maskCtx;
    if (this.maskCanvas.width !== viewW || this.maskCanvas.height !== viewH) this.resize(viewW, viewH);

    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;
    const baseAlpha = clamp(0.83 + depth * 0.13, 0.83, 0.965);
    const grad = mctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, hexA(COLORS.dark.coldPurple, baseAlpha));
    grad.addColorStop(1, hexA(COLORS.dark.black, baseAlpha));
    mctx.fillStyle = grad;
    mctx.fillRect(0, 0, viewW, viewH);

    // Afterglow: partially reveal recently-lit ground the player has since left.
    const afterglowDur = 0.5 + (player.afterglow || 0);
    if (afterglowDur > 0.5) {
      mctx.globalCompositeOperation = 'destination-out';
      const cxMin = Math.max(0, Math.floor((camX) / MEMORY_CELL) - 1);
      const cxMax = Math.min(this.memCols - 1, Math.ceil((camX + viewW) / MEMORY_CELL) + 1);
      const cyMin = Math.max(0, Math.floor((camY) / MEMORY_CELL) - 1);
      const cyMax = Math.min(this.memRows - 1, Math.ceil((camY + viewH) / MEMORY_CELL) + 1);
      for (let cy = cyMin; cy <= cyMax; cy++) {
        for (let cx = cxMin; cx <= cxMax; cx++) {
          const t = this.memory[this._memIdx(cx, cy)];
          if (t < 0) continue;
          const age = this.time - t;
          if (age <= 0.05 || age > afterglowDur) continue;
          const frac = 1 - age / afterglowDur;
          const wx = cx * MEMORY_CELL, wy = cy * MEMORY_CELL;
          const sx = wx - camX, sy = wy - camY;
          const rg = mctx.createRadialGradient(sx, sy, 0, sx, sy, MEMORY_CELL * 1.3);
          rg.addColorStop(0, `rgba(255,255,255,${0.35 * frac})`);
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          mctx.fillStyle = rg;
          mctx.beginPath();
          mctx.arc(sx, sy, MEMORY_CELL * 1.3, 0, Math.PI * 2);
          mctx.fill();
        }
      }
    }

    mctx.globalCompositeOperation = 'destination-out';
    for (const src of sources) {
      const sx = src.x - camX, sy = src.y - camY;
      if (sx < -src.radius - 40 || sx > viewW + src.radius + 40 || sy < -src.radius - 40 || sy > viewH + src.radius + 40) continue;
      const r = src.radius;
      if (r <= 1) continue;
      const rg = mctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const strength = clamp(src.intensity ?? 1, 0, 1);
      rg.addColorStop(0, `rgba(255,255,255,${0.98 * strength})`);
      rg.addColorStop(0.6, `rgba(255,255,255,${0.85 * strength})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = rg;
      mctx.beginPath();
      mctx.arc(sx, sy, r, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(this.maskCanvas, 0, 0);

    // Warm colored glow tint near the player's own lantern for atmosphere.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lx = player.x - camX, ly = player.y - camY;
    const lr = player.lantern.radius;
    if (lr > 4) {
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr * 1.05);
      const amberA = 0.16 * player.lantern.intensity;
      glow.addColorStop(0, hexA(COLORS.lantern.gold, amberA));
      glow.addColorStop(0.7, hexA(COLORS.lantern.amber, amberA * 0.5));
      glow.addColorStop(1, hexA(COLORS.lantern.amber, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, lr * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player.lantern.flareTimer > 0) {
      const t = player.lantern.flareTimer / player.lantern.flareDuration;
      const fr = player.lantern.flareRadius * (1 - t) + lr * t;
      ctx.globalAlpha = t;
      ctx.strokeStyle = hexA(COLORS.lantern.gold, 0.8);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(lx, ly, fr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

export { hexA };
