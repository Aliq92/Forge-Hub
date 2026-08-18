// Fireflies: the renewable lantern resource. Drift near flowers, water and
// shrines; flee gently from the player; restore lantern energy on collection.
import { dist, randRange, clamp } from './utils.js';
import { COLORS, TERRAIN } from './config.js';

const MAX_FIREFLIES = 46;
const ENERGY_PER_FIREFLY = 4.5;

export class FireflyManager {
  constructor(world, particles, rng) {
    this.world = world;
    this.particles = particles;
    this.rng = rng;
    this.list = [];
    this.spawnAccum = 0;
    this.swarmTimer = 0;
    this._buildAnchors();
    for (let i = 0; i < 18; i++) this._spawnOne();
  }

  _buildAnchors() {
    const w = this.world;
    this.anchors = [
      ...w.objects.moonflowers.map(f => ({ x: f.x, y: f.y })),
      ...w.shrineSpecs.map(s => ({ x: s.x, y: s.y }))
    ];
  }

  _spawnOne(near = null) {
    if (this.list.length >= MAX_FIREFLIES) return;
    let x, y;
    if (near) {
      x = near.x + randRange(this.rng, -70, 70);
      y = near.y + randRange(this.rng, -70, 70);
    } else if (this.anchors.length && this.rng() < 0.7) {
      const a = this.anchors[Math.floor(this.rng() * this.anchors.length)];
      x = a.x + randRange(this.rng, -90, 90);
      y = a.y + randRange(this.rng, -90, 90);
    } else {
      x = randRange(this.rng, 80, this.world.pixelW - 80);
      y = randRange(this.rng, 80, this.world.pixelH - 80);
    }
    if (this.world.isSolid(x, y)) return;
    this.list.push({
      x, y, homeX: x, homeY: y,
      vx: 0, vy: 0,
      phase: this.rng() * Math.PI * 2,
      wobble: randRange(this.rng, 0.6, 1.4),
      collected: false,
      swarm: false
    });
  }

  spawnSwarm(centerX, centerY, count = 18) {
    for (let i = 0; i < count; i++) {
      this.list.push({
        x: centerX + randRange(this.rng, -60, 60),
        y: centerY + randRange(this.rng, -60, 60),
        homeX: centerX, homeY: centerY,
        vx: 0, vy: 0, phase: this.rng() * Math.PI * 2,
        wobble: randRange(this.rng, 0.6, 1.4),
        collected: false, swarm: true
      });
    }
  }

  update(dt, player, onCollect) {
    this.spawnAccum += dt;
    if (this.spawnAccum > 2.2 && this.list.length < MAX_FIREFLIES) {
      this.spawnAccum = 0;
      this._spawnOne();
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.collected) { this.list.splice(i, 1); continue; }

      f.phase += dt * f.wobble;
      const wanderX = Math.sin(f.phase) * 18;
      const wanderY = Math.cos(f.phase * 1.3) * 18;
      let targetX = f.homeX + wanderX;
      let targetY = f.homeY + wanderY;

      const d = dist(f.x, f.y, player.x, player.y);
      const fleeRadius = player.fireflyRadius + 30;
      if (d < fleeRadius && d > player.fireflyRadius * 0.55) {
        const ang = Math.atan2(f.y - player.y, f.x - player.x);
        targetX = f.x + Math.cos(ang) * 40;
        targetY = f.y + Math.sin(ang) * 40;
      }

      f.vx += (targetX - f.x) * dt * 1.6;
      f.vy += (targetY - f.y) * dt * 1.6;
      f.vx *= 0.9; f.vy *= 0.9;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (d < player.fireflyRadius * 0.55) {
        f.collected = true;
        this.particles.spawn({
          x: f.x, y: f.y, vx: randRange(this.rng, -10, 10), vy: -30,
          life: 0, maxLife: 0.5, size: 3, color: COLORS.lantern.gold, glow: true, gravity: -10
        });
        onCollect(ENERGY_PER_FIREFLY);
      }
    }
  }

  render(ctx, camX, camY, time) {
    for (const f of this.list) {
      const sx = f.x - camX, sy = f.y - camY;
      const pulse = 0.6 + 0.4 * Math.sin(time * 4 + f.phase);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = COLORS.lantern.gold;
      ctx.shadowBlur = 10 * pulse;
      ctx.fillStyle = COLORS.lantern.gold;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
