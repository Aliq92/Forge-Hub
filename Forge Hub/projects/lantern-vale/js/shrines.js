// Ancient shrines: checkpoints that restore light, open safe zones, and grant
// upgrades. The Heart Lantern is the final, gated shrine.
import { dist } from './utils.js';
import { COLORS, SHRINE_COUNT } from './config.js';

export class ShrineManager {
  constructor(world, particles, plantManager) {
    this.world = world;
    this.particles = particles;
    this.plants = plantManager;
    this.shrines = world.shrineSpecs.map(s => ({ ...s, activated: false, safeRadius: 0, pulsePhase: Math.random() * 10 }));
    this.heart = { ...world.heartLantern, activated: false, safeRadius: 0, pulsePhase: 0 };
    this.activatedCount = 0;
  }

  get safeZones() {
    const zones = [];
    for (const s of this.shrines) if (s.activated) zones.push({ x: s.x, y: s.y, radius: s.safeRadius });
    if (this.heart.activated) zones.push({ x: this.heart.x, y: this.heart.y, radius: this.heart.safeRadius });
    return zones;
  }

  nearestUnactivated(player, reach = 60) {
    for (const s of this.shrines) {
      if (!s.activated && dist(s.x, s.y, player.x, player.y) < reach) return s;
    }
    if (this.activatedCount >= SHRINE_COUNT && !this.heart.activated &&
        dist(this.heart.x, this.heart.y, player.x, player.y) < reach) return this.heart;
    return null;
  }

  activate(shrine) {
    shrine.activated = true;
    shrine.safeRadius = 0;
    this._burst(shrine.x, shrine.y);
    this.plants.awakenNear(shrine.x, shrine.y, 260);
    if (shrine.id === 'heart') {
      this.heart.activated = true;
      return 'heart';
    }
    this.activatedCount++;
    if (this.activatedCount >= SHRINE_COUNT) this.world.openGate();
    return 'shrine';
  }

  update(dt) {
    for (const s of this.shrines) {
      s.pulsePhase += dt;
      if (s.activated && s.safeRadius < 230) s.safeRadius += dt * 90;
    }
    this.heart.pulsePhase += dt;
    if (this.heart.activated && this.heart.safeRadius < 400) this.heart.safeRadius += dt * 120;
  }

  _burst(x, y) {
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 90;
      this.particles.spawn({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0, maxLife: 1 + Math.random() * 0.8, size: 2 + Math.random() * 3,
        color: Math.random() < 0.6 ? COLORS.lantern.gold : COLORS.magic.paleBlue,
        glow: true, drag: 0.92
      });
    }
  }

  render(ctx, camX, camY, time) {
    const drawShrine = (s, isHeart) => {
      const sx = s.x - camX, sy = s.y - camY;
      const pulse = 0.7 + 0.3 * Math.sin(time * 2 + s.pulsePhase);
      ctx.save();
      if (s.activated) {
        ctx.shadowColor = COLORS.lantern.amber;
        ctx.shadowBlur = 24 * pulse;
      }
      ctx.fillStyle = s.activated ? COLORS.lantern.gold : '#4a4658';
      const w = isHeart ? 22 : 14, h = isHeart ? 30 : 20;
      ctx.beginPath();
      ctx.moveTo(sx, sy - h);
      ctx.lineTo(sx + w * 0.5, sy);
      ctx.lineTo(sx, sy + h);
      ctx.lineTo(sx - w * 0.5, sy);
      ctx.closePath();
      ctx.fill();
      if (s.activated) {
        ctx.globalAlpha = 0.7 * pulse;
        ctx.fillStyle = COLORS.lantern.gold;
        ctx.beginPath();
        ctx.arc(sx, sy - h * 0.3, isHeart ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    for (const s of this.shrines) drawShrine(s, false);
    if (this.activatedCount >= SHRINE_COUNT || this.heart.activated) drawShrine(this.heart, true);
  }
}
