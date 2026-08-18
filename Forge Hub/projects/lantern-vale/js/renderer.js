// Draws the world scene (terrain, objects, entities) at full brightness;
// the LightingSystem then composites darkness on top of what this produces.
import { TILE, TERRAIN, COLORS } from './config.js';
import { hexA } from './lighting.js';
import { clamp } from './utils.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fogBlobs = [];
    for (let i = 0; i < 10; i++) {
      this.fogBlobs.push({
        x: Math.random(), y: Math.random(),
        r: 140 + Math.random() * 220,
        speed: 4 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Some embedding contexts briefly report a 0x0 layout on first paint;
    // fall back to the previous (or a sane default) size rather than leaving
    // the canvas at zero, which would crash later drawImage calls.
    const w = window.innerWidth || this.viewW || 800;
    const h = window.innerHeight || this.viewH || 600;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w; this.viewH = h;
  }

  drawTerrain(world, camX, camY) {
    const ctx = this.ctx;
    const startTx = Math.max(0, Math.floor(camX / TILE) - 1);
    const startTy = Math.max(0, Math.floor(camY / TILE) - 1);
    const endTx = Math.min(world.w - 1, Math.ceil((camX + this.viewW) / TILE) + 1);
    const endTy = Math.min(world.h - 1, Math.ceil((camY + this.viewH) / TILE) + 1);

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const i = ty * world.w + tx;
        const terrain = world.overlay[i] || world.biome[i];
        const sx = tx * TILE - camX, sy = ty * TILE - camY;
        ctx.fillStyle = TERRAIN_COLOR[terrain] || '#333';
        ctx.fillRect(sx, sy, TILE + 1, TILE + 1);

        if (terrain === TERRAIN.WATER || terrain === TERRAIN.DEEPWATER) {
          const shimmer = 0.5 + 0.5 * Math.sin((tx * 0.6 + ty * 0.4) + this._t * 0.8);
          ctx.fillStyle = `rgba(120,170,220,${0.06 + shimmer * 0.05})`;
          ctx.fillRect(sx, sy, TILE, TILE);
        } else if (terrain === TERRAIN.PATH || terrain === TERRAIN.STONE) {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          if ((tx + ty) % 2 === 0) ctx.fillRect(sx, sy, TILE, TILE);
        } else if (terrain === TERRAIN.TALLGRASS) {
          ctx.strokeStyle = 'rgba(20,50,20,0.35)';
          ctx.lineWidth = 1;
          for (let k = 0; k < 3; k++) {
            const bx = sx + 6 + k * 12 + Math.sin(this._t * 1.5 + tx + k) * 2;
            ctx.beginPath(); ctx.moveTo(bx, sy + TILE - 4); ctx.lineTo(bx + 2, sy + TILE - 16); ctx.stroke();
          }
        } else if (terrain === TERRAIN.WALL) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(sx, sy, TILE, TILE);
        }
      }
    }
  }

  drawObjects(world, camX, camY, plants) {
    const ctx = this.ctx;
    const t = this._t;

    // Hidden stepping-stone / star-moss trails: drawn always, masked by darkness.
    for (const hp of world.objects.hiddenPaths) {
      for (const p of hp.points) {
        const sx = p.x - camX, sy = p.y - camY;
        if (!this._onscreen(sx, sy, 20)) continue;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = COLORS.magic.cyan;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const sm of world.objects.starMoss) {
      const sx = sm.x - camX, sy = sm.y - camY;
      if (!this._onscreen(sx, sy, 20)) continue;
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + sx);
      ctx.save();
      ctx.shadowColor = COLORS.magic.green;
      ctx.shadowBlur = 8 * pulse;
      ctx.fillStyle = COLORS.magic.green;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const rp of world.objects.ruinsProps) {
      const sx = rp.x - camX, sy = rp.y - camY;
      if (!this._onscreen(sx, sy, 60)) continue;
      ctx.save();
      ctx.fillStyle = '#5b5a68';
      if (rp.kind === 'pillar') ctx.fillRect(sx - 6, sy - 30, 12, 40);
      else if (rp.kind === 'arch') { ctx.fillRect(sx - 20, sy - 6, 8, 30); ctx.fillRect(sx + 12, sy - 6, 8, 30); ctx.fillRect(sx - 20, sy - 10, 40, 8); }
      else { ctx.beginPath(); ctx.ellipse(sx, sy, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    for (const er of world.objects.emberReeds) {
      const sx = er.x - camX, sy = er.y - camY;
      if (!this._onscreen(sx, sy, 30)) continue;
      const sway = Math.sin(t * 1.4 + sx * 0.05) * 4;
      ctx.save();
      ctx.strokeStyle = er.ready ? COLORS.magic.green : '#3a4a3a';
      ctx.lineWidth = 3;
      if (er.ready) { ctx.shadowColor = COLORS.magic.green; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.moveTo(sx, sy + 14); ctx.quadraticCurveTo(sx + sway, sy - 6, sx + sway * 1.4, sy - 22); ctx.stroke();
      ctx.restore();
    }

    for (const f of world.objects.moonflowers) {
      const sx = f.x - camX, sy = f.y - camY;
      if (!this._onscreen(sx, sy, 30)) continue;
      ctx.save();
      const pulse = 0.6 + 0.4 * Math.sin(t * 2 + sx * 0.1);
      if (f.awake) { ctx.shadowColor = COLORS.magic.paleBlue; ctx.shadowBlur = 14 * pulse; }
      ctx.fillStyle = f.awake ? COLORS.magic.paleBlue : '#454a5c';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2;
        ctx.ellipse(sx + Math.cos(ang) * 5, sy + Math.sin(ang) * 5, 4, 3, ang, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = f.awake ? COLORS.lantern.gold : '#333';
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    for (const lt of world.objects.lumenTrees) {
      const sx = lt.x - camX, sy = lt.y - camY;
      if (!this._onscreen(sx, sy, 100)) continue;
      ctx.save();
      ctx.fillStyle = '#2c2418';
      ctx.fillRect(sx - 6, sy - 10, 12, 50);
      const pulse = 0.7 + 0.3 * Math.sin(t * 1.2 + sx);
      if (lt.discovered) { ctx.shadowColor = COLORS.lantern.gold; ctx.shadowBlur = 30 * pulse; }
      ctx.fillStyle = lt.discovered ? hexA(COLORS.lantern.gold, 0.85) : '#38352f';
      ctx.beginPath();
      ctx.arc(sx, sy - 20, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPlayer(player) {
    const ctx = this.ctx;
    const sx = this.viewW / 2, sy = this.viewH / 2;
    const bob = player.moving ? Math.sin(player.animPhase) * 2.4 : Math.sin(player.animPhase * 0.4) * 0.6;
    const sway = Math.sin(player.animPhase * 0.9) * 6;

    ctx.save();
    ctx.translate(sx, sy + bob);

    // soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // cloak
    const flash = player.hitFlash > 0;
    ctx.fillStyle = flash ? '#ff8080' : '#2b2438';
    ctx.beginPath();
    ctx.moveTo(-8, 10); ctx.quadraticCurveTo(-11, -4, -5, -14);
    ctx.lineTo(5, -14); ctx.quadraticCurveTo(11, -4, 8, 10);
    ctx.closePath(); ctx.fill();

    // head
    ctx.fillStyle = flash ? '#ffd0c0' : '#e8c9a0';
    ctx.beginPath(); ctx.arc(0, -18, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#ff9090' : '#3a3050';
    ctx.beginPath(); ctx.arc(0, -20, 6.5, Math.PI, 0); ctx.fill();

    // lantern (swaying)
    const lx = player.facing * (10 + sway * 0.15);
    const ly = 2 + Math.abs(sway) * 0.2;
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(player.facing * 6, -6); ctx.lineTo(lx, ly); ctx.stroke();

    const energyFrac = player.lantern.energy / player.lantern.maxEnergy;
    const glowA = 0.4 + 0.6 * energyFrac;
    ctx.save();
    ctx.shadowColor = COLORS.lantern.gold;
    ctx.shadowBlur = 16 * (player.lantern.depleted ? 0.3 : 1);
    ctx.fillStyle = player.lantern.depleted ? hexA(COLORS.lantern.orange, 0.5) : hexA(COLORS.lantern.gold, glowA);
    ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3a2f22';
    ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.stroke();

    if (player.invulnTimer > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(player.invulnTimer * 30);
    }
    ctx.restore();
  }

  drawFog(settings, camX, camY) {
    if (settings.fogDensity <= 0) return;
    const ctx = this.ctx;
    const t = this._t;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (const b of this.fogBlobs) {
      const driftX = ((b.x + t * 0.002 * b.speed) % 1) * (this.viewW + b.r * 2) - b.r;
      const driftY = b.y * this.viewH + Math.sin(t * 0.1 + b.phase) * 20;
      const grad = ctx.createRadialGradient(driftX, driftY, 0, driftX, driftY, b.r);
      grad.addColorStop(0, `rgba(180,190,210,${0.05 * settings.fogDensity})`);
      grad.addColorStop(1, 'rgba(180,190,210,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(driftX, driftY, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _onscreen(sx, sy, pad) {
    return sx > -pad && sx < this.viewW + pad && sy > -pad && sy < this.viewH + pad;
  }

  clear() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.dark.black;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  setTime(t) { this._t = t; }
}

const TERRAIN_COLOR = {
  [TERRAIN.PATH]: '#8a7a5c',
  [TERRAIN.STONE]: '#7d7a72',
  [TERRAIN.BRIDGE]: '#7a6644',
  [TERRAIN.GRASS]: '#3c5a3a',
  [TERRAIN.MEADOW]: '#4d6a44',
  [TERRAIN.TALLGRASS]: '#3a5636',
  [TERRAIN.WATER]: '#28486a',
  [TERRAIN.DEEPWATER]: '#193353',
  [TERRAIN.MUD]: '#4a3f2e',
  [TERRAIN.SHADOWGROUND]: '#241f30',
  [TERRAIN.RUINS]: '#565060',
  [TERRAIN.WALL]: '#100e18',
  [TERRAIN.CAVE]: '#2a2632',
  [TERRAIN.SHRINE]: '#6a5c46'
};
