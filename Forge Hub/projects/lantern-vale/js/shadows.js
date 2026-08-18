// Shadow creatures: simple steering AI, no pathfinding meshes. They avoid
// strong lantern light and press in only when the light is weak.
import { dist, angleTo, randRange, clamp } from './utils.js';
import { TERRAIN, COLORS } from './config.js';

const TYPES = {
  shade: { speed: 46, detect: 240, fleeMul: 1.0, exposeThreshold: 1.3, radius: 13, color: '#3a2f52', damage: 1 },
  wraith: { speed: 88, detect: 300, fleeMul: 1.4, exposeThreshold: 0.55, radius: 11, color: '#5a3e6b', damage: 1 }
};

export class Shadow {
  constructor(type, x, y) {
    this.type = type;
    Object.assign(this, TYPES[type]);
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.state = 'wander';
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.exposureTimer = 0;
    this.stunTimer = 0;
    this.dissolved = false;
    this.spawnFade = 0;
  }
}

export class ShadowManager {
  constructor(world, particles, rng) {
    this.world = world;
    this.particles = particles;
    this.rng = rng;
    this.list = [];
    this.respawnTimer = 0;
    this.encounterCount = 0;
    this._lastNearFlag = false;
    this.difficultyMul = 1;
  }

  _findDarkSpot(minDepth) {
    for (let tries = 0; tries < 30; tries++) {
      const x = randRange(this.rng, 100, this.world.pixelW - 100);
      const y = randRange(this.rng, 100, this.world.pixelH - 100);
      const t = this.world.terrainAt(x, y);
      const depth = this.world.depthAt(x, y);
      if (t === TERRAIN.WALL) continue;
      if (depth < minDepth) continue;
      if (t === TERRAIN.SHADOWGROUND || depth > 0.4 || this.rng() < 0.25) return { x, y, depth };
    }
    return null;
  }

  targetCount(difficultyDepth) {
    return Math.round((4 + difficultyDepth * 14) * this.difficultyMul);
  }

  update(dt, player, safeZones, flareEvent) {
    const difficultyDepth = this.world.depthAt(player.x, player.y);
    const wanted = this.targetCount(difficultyDepth);

    this.respawnTimer -= dt;
    if (this.list.length < wanted && this.respawnTimer <= 0) {
      this.respawnTimer = 0.9;
      const spot = this._findDarkSpot(Math.max(0, difficultyDepth - 0.35));
      if (spot) {
        const type = (spot.depth > 0.45 && this.rng() < 0.45) ? 'wraith' : 'shade';
        const d = dist(spot.x, spot.y, player.x, player.y);
        if (d > 260) this.list.push(new Shadow(type, spot.x, spot.y));
      }
    }

    const lanternIntensity = player.lantern.intensity;
    const lanternRadius = player.lantern.radius + player.shadowWard;
    const inFlare = flareEvent && player.lantern.flareTimer > 0;

    let nearAny = false;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (s.dissolved) { this.list.splice(i, 1); continue; }
      s.spawnFade = clamp(s.spawnFade + dt * 2, 0, 1);

      const inSafe = safeZones.some(z => dist(s.x, s.y, z.x, z.y) < z.radius);
      const d = dist(s.x, s.y, player.x, player.y);
      if (d < 420) nearAny = true;

      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= 0.9; s.vy *= 0.9;
        continue;
      }

      const litStrong = d < lanternRadius * 0.92 && lanternIntensity > 0.4;
      const withinFlareBurst = inFlare && d < player.lantern.flareRadius;

      if (withinFlareBurst) {
        const ang = angleTo(player.x, player.y, s.x, s.y);
        s.vx = Math.cos(ang) * 340; s.vy = Math.sin(ang) * 340;
        s.stunTimer = 1.4;
        s.exposureTimer += dt * 6;
        this.particles.spawn({ x: s.x, y: s.y, vx: Math.cos(ang) * 30, vy: Math.sin(ang) * 30, life: 0, maxLife: 0.5, size: 3, color: COLORS.magic.violet, glow: true });
      } else if (litStrong || inSafe) {
        s.exposureTimer += dt;
        const ang = angleTo(player.x, player.y, s.x, s.y);
        const speed = s.speed * s.fleeMul;
        s.vx = Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed;
        s.state = 'flee';
      } else {
        s.exposureTimer = Math.max(0, s.exposureTimer - dt * 2);
        const shouldChase = d < s.detect && lanternIntensity < 0.55;
        if (shouldChase) {
          const ang = angleTo(s.x, s.y, player.x, player.y);
          s.vx = Math.cos(ang) * s.speed; s.vy = Math.sin(ang) * s.speed;
          s.state = 'chase';
        } else {
          s.wanderTimer -= dt;
          if (s.wanderTimer <= 0) {
            s.wanderAngle += randRange(this.rng, -1.2, 1.2);
            s.wanderTimer = randRange(this.rng, 1, 2.5);
          }
          s.vx = Math.cos(s.wanderAngle) * s.speed * 0.35;
          s.vy = Math.sin(s.wanderAngle) * s.speed * 0.35;
          s.state = 'wander';
        }
      }

      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      if (!this.world.isSolid(nx, s.y)) s.x = nx;
      if (!this.world.isSolid(s.x, ny)) s.y = ny;
      s.x = clamp(s.x, 20, this.world.pixelW - 20);
      s.y = clamp(s.y, 20, this.world.pixelH - 20);

      if (s.exposureTimer > s.exposeThreshold) {
        s.dissolved = true;
        this.encounterCount++;
        for (let p = 0; p < 8; p++) {
          this.particles.spawn({
            x: s.x, y: s.y, vx: randRange(this.rng, -60, 60), vy: randRange(this.rng, -60, 60),
            life: 0, maxLife: 0.6, size: 2.5, color: COLORS.magic.violet, glow: true, drag: 0.9
          });
        }
        continue;
      }

      if (!inSafe && s.state === 'chase' && d < s.radius + player.radius) {
        const hit = player.takeDamage(s.damage, s.x, s.y);
        if (hit) {
          this.encounterCount++;
          const ang = angleTo(player.x, player.y, s.x, s.y);
          s.vx = Math.cos(ang) * 260; s.vy = Math.sin(ang) * 260;
          s.stunTimer = 0.6;
        }
      }
    }

    this._lastNearFlag = nearAny;
    return nearAny;
  }

  render(ctx, camX, camY, time) {
    for (const s of this.list) {
      const sx = s.x - camX, sy = s.y - camY;
      ctx.save();
      ctx.globalAlpha = 0.8 * s.spawnFade;
      const wobble = Math.sin(time * 3 + s.x * 0.01) * 2;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(sx, sy + wobble, s.radius, s.radius * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 * s.spawnFade;
      ctx.fillStyle = s.type === 'wraith' ? '#caa6ff' : '#8f7bb8';
      ctx.beginPath();
      ctx.arc(sx - 3, sy - 2 + wobble, 1.6, 0, Math.PI * 2);
      ctx.arc(sx + 3, sy - 2 + wobble, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
