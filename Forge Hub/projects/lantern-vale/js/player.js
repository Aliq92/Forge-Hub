// The wanderer: position, movement, health, and upgrade stats.
import { Lantern } from './lantern.js';
import { clamp } from './utils.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 10;
    this.speed = 158;
    this.facing = 1; // 1 = right, -1 = left
    this.facingAngle = 0;
    this.moving = false;
    this.animPhase = 0;

    this.maxHealth = 3;
    this.health = 3;
    this.invulnTimer = 0;
    this.hitFlash = 0;
    this.knockX = 0; this.knockY = 0;

    this.lantern = new Lantern();

    // Upgradeable stats
    this.fireflyRadius = 46;
    this.shadowWard = 0;
    this.afterglow = 0;
    this.guidingLight = 0;
    this.lastEmber = 0;

    this.footstepTimer = 0;
    this.footstepParticleTimer = 0;

    this.inSafeZone = false;
    this.hitEvent = false;
  }

  takeDamage(amount, fromX, fromY) {
    if (this.invulnTimer > 0) return false;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    this.invulnTimer = 1.1;
    this.hitFlash = 0.35;
    const dx = this.x - fromX, dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.knockX = (dx / len) * 210;
    this.knockY = (dy / len) * 210;
    this.lantern.onHit();
    this.hitEvent = true;
    return true;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, this.maxHealth); }

  update(dt, input, world) {
    const axis = input.getMoveAxis();
    this.moving = axis.x !== 0 || axis.y !== 0;

    const terrainMul = world.speedMultiplierAt(this.x, this.y);

    let vx = axis.x * this.speed * terrainMul;
    let vy = axis.y * this.speed * terrainMul;

    // Gentle knockback decay, layered on top of normal movement.
    vx += this.knockX; vy += this.knockY;
    this.knockX *= Math.pow(0.02, dt);
    this.knockY *= Math.pow(0.02, dt);

    const nx = this.x + vx * dt;
    const ny = this.y + vy * dt;
    if (!world.isSolid(nx, this.y)) this.x = nx;
    if (!world.isSolid(this.x, ny)) this.y = ny;
    this.x = clamp(this.x, 8, world.pixelW - 8);
    this.y = clamp(this.y, 8, world.pixelH - 8);

    if (this.moving && (axis.x !== 0 || axis.y !== 0)) {
      this.facingAngle = Math.atan2(axis.y, axis.x);
      this.facing = axis.x < 0 ? -1 : axis.x > 0 ? 1 : this.facing;
    }

    this.animPhase += dt * (this.moving ? 8 : 2);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.footstepParticleTimer -= dt;
  }
}
