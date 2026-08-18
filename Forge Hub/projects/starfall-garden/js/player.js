// The keeper: player entity, movement, dash, shield, stats.
SG.Player = class {
  constructor() {
    this.reset();
  }

  reset() {
    const c = SG.CONFIG.player;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.facing = -Math.PI / 2;
    this.moveDirX = 0; this.moveDirY = 1;

    this.radius = c.radius;
    this.speedMul = 1;
    this.baseSpeed = c.baseSpeed;

    this.maxHealth = c.baseHealth;
    this.health = this.maxHealth;
    this.maxEnergy = c.baseEnergy;
    this.energy = this.maxEnergy;
    this.energyRegenMul = 1;

    this.collectRadius = c.baseCollectRadius;
    this.fragments = 0;

    this.dashCooldownMul = 1;
    this.dashCooldownTimer = 0;
    this.dashTimer = 0;
    this.dashDirX = 0; this.dashDirY = -1;
    this.dashInvuln = 0;

    this.plantCostMul = 1;
    this.rootNetworkBonus = false;
    this.fragmentBonusChance = 0;
    this.warningTimeBonus = 0;
    this.timeBloomActive = false;

    this.shieldEnabled = false;
    this.shieldCooldown = 18;
    this.shieldTimer = 0; // counts down while recharging; 0 = ready
    this.shieldFlash = 0;

    this.secondWind = false;
    this.secondWindUsed = false;

    this.hitInvuln = 0;
    this.damageFlash = 0;
    this.slowFactor = 1;

    this.trail = [];
    this.alive = true;
  }

  get shieldReady() { return this.shieldEnabled && this.shieldTimer <= 0; }

  setInput(ix, iy) {
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    this.inputX = ix; this.inputY = iy;
    if (len > 0.05) { this.moveDirX = ix; this.moveDirY = iy; this.facing = Math.atan2(iy, ix); }
  }

  tryDash() {
    if (this.dashCooldownTimer > 0 || this.dashTimer > 0) return false;
    const c = SG.CONFIG.player;
    if (this.energy < c.dashEnergyCost) return false;
    this.energy -= c.dashEnergyCost;
    this.dashTimer = c.dashDuration;
    this.dashCooldownTimer = c.dashCooldown * this.dashCooldownMul;
    this.dashDirX = this.moveDirX; this.dashDirY = this.moveDirY;
    this.dashInvuln = c.dashDuration + 0.08;
    return true;
  }

  applyDamage(amount) {
    if (this.hitInvuln > 0 || this.dashInvuln > 0) return 0;
    if (this.shieldReady) {
      this.shieldTimer = this.shieldCooldown;
      this.shieldFlash = 0.5;
      return 0;
    }
    this.health -= amount;
    this.hitInvuln = SG.CONFIG.player.invulnAfterHit;
    this.damageFlash = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      if (this.secondWind && !this.secondWindUsed) {
        this.secondWindUsed = true;
        this.health = this.maxHealth * 0.5;
        this.hitInvuln = 2.5;
        return amount;
      }
      this.alive = false;
    }
    return amount;
  }

  update(dt, world) {
    const c = SG.CONFIG.player;

    // patch-based effects (frosted ridge slow)
    const patch = world.patchAtLocal(this.x, this.y);
    this.slowFactor = (patch && patch.biome === 'frostedridge') ? 0.82 : 1;

    let speed = this.baseSpeed * this.speedMul * this.slowFactor;
    let mx = this.inputX || 0, my = this.inputY || 0;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      speed = c.dashSpeed;
      mx = this.dashDirX; my = this.dashDirY;
    }
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.dashInvuln > 0) this.dashInvuln -= dt;
    if (this.hitInvuln > 0) this.hitInvuln -= dt;
    if (this.damageFlash > 0) this.damageFlash -= dt;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    this.vx = mx * speed;
    this.vy = my * speed;
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;

    const maxR = world.unlockedRadius - this.radius * 0.6;
    const d = Math.hypot(nx, ny);
    if (d > maxR && maxR > 0) {
      const s = maxR / d;
      nx *= s; ny *= s;
    }
    this.x = nx; this.y = ny;

    // energy regen
    this.energy = Math.min(this.maxEnergy, this.energy + c.energyRegen * this.energyRegenMul * dt);

    // trail
    if (Math.hypot(this.vx, this.vy) > 10) {
      this.trail.push({ x: this.x, y: this.y, life: 0.28 });
      if (this.trail.length > 14) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }
};
