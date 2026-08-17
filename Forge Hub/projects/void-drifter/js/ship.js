// ---------------- Player ship: Newtonian drift physics, resources, upgrades ----------------
const UPGRADE_BASE = {
  thrusters: { thrustMult: 0.12 },
  fuelTank: { fuel: 26 },
  hullUp: { hull: 22 },
  scanner: { range: 150 },
  magnet: { radius: 26 },
  shield: { charge: 26 },
  boostUp: { mult: 0.14, energyCut: 0.09 },
  cargo: { cap: 75 },
};

class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2; // pointing "up" initially
    this.angularVelocity = 0;

    this.radius = 15;

    this.maxHull = 100;
    this.hull = 100;
    this.maxFuel = 100;
    this.fuel = 100;
    this.maxEnergy = 100;
    this.energy = 100;

    this.salvage = 0;
    this.maxCargo = 150;

    this.shieldCharge = 0;
    this.shieldFlash = 0;

    this.upgrades = { thrusters: 0, fuelTank: 0, hullUp: 0, scanner: 0, magnet: 0, shield: 0, boostUp: 0, cargo: 0 };

    this.thrusting = false;
    this.reversing = false;
    this.boosting = false;
    this.canBoost = true;

    this.damageFlash = 0;
    this.destroyed = false;
    this.invulnTime = 0; // brief grace period after spawn / respawn

    this._recalc();
  }

  _recalc() {
    const u = this.upgrades;
    this.thrustPower = 250 * (1 + u.thrusters * UPGRADE_BASE.thrusters.thrustMult);
    this.reverseThrustPower = this.thrustPower * 0.6;
    this.maxFuel = 100 + u.fuelTank * UPGRADE_BASE.fuelTank.fuel;
    this.maxHull = 100 + u.hullUp * UPGRADE_BASE.hullUp.hull;
    this.scannerRange = 480 + u.scanner * UPGRADE_BASE.scanner.range;
    this.magnetRadius = 46 + u.magnet * UPGRADE_BASE.magnet.radius;
    this.maxShield = u.shield * UPGRADE_BASE.shield.charge;
    this.boostMult = 2.1 + u.boostUp * UPGRADE_BASE.boostUp.mult;
    this.boostEnergyRate = 30 * Math.max(0.35, 1 - u.boostUp * UPGRADE_BASE.boostUp.energyCut);
    this.maxCargo = 150 + u.cargo * UPGRADE_BASE.cargo.cap;
  }

  applyUpgrade(key) {
    if (this.upgrades[key] == null) return;
    this.upgrades[key]++;
    const prevMaxFuel = this.maxFuel, prevMaxHull = this.maxHull;
    this._recalc();
    // top up new capacity proportionally so upgrades feel immediately rewarding
    this.fuel += this.maxFuel - prevMaxFuel;
    this.hull += this.maxHull - prevMaxHull;
    this.maxCargo = this.maxCargo; // already set
    this.hull = clamp(this.hull, 0, this.maxHull);
    this.fuel = clamp(this.fuel, 0, this.maxFuel);
  }

  update(dt, input, settings) {
    if (this.destroyed) return;
    this.prevX = this.x;
    this.prevY = this.y;
    if (this.invulnTime > 0) this.invulnTime -= dt;

    const rotAccel = 16;
    const maxRotSpeed = 3.6;
    let turnInput = 0;
    if (input.left) turnInput -= 1;
    if (input.right) turnInput += 1;
    const targetAngVel = turnInput * maxRotSpeed;
    this.angularVelocity = lerp(this.angularVelocity, targetAngVel, 1 - Math.exp(-rotAccel * dt));
    this.angle += this.angularVelocity * dt;

    this.thrusting = false;
    this.reversing = false;
    this.boosting = false;

    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);

    const wantBoost = input.boost && this.energy > 0.5 && (input.thrust || !input.reverse);

    if (input.thrust && this.fuel > 0) {
      let power = this.thrustPower;
      this.thrusting = true;
      if (wantBoost) {
        power *= this.boostMult;
        this.boosting = true;
        this.energy = clamp(this.energy - this.boostEnergyRate * dt, 0, this.maxEnergy);
      }
      this.vx += fx * power * dt;
      this.vy += fy * power * dt;
      this.fuel = clamp(this.fuel - 6.2 * dt * (this.boosting ? 1.6 : 1), 0, this.maxFuel);
    } else if (input.reverse && this.fuel > 0) {
      this.reversing = true;
      this.vx -= fx * this.reverseThrustPower * dt;
      this.vy -= fy * this.reverseThrustPower * dt;
      this.fuel = clamp(this.fuel - 4.2 * dt, 0, this.maxFuel);
    }

    // light damping keeps drift controllable without killing the "floaty" feel
    const damp = Math.pow(0.986, dt * 60);
    this.vx *= damp;
    this.vy *= damp;

    // soft speed cap: extra drag beyond practical max speed
    const speed = Math.hypot(this.vx, this.vy);
    const maxSpeed = 560;
    if (speed > maxSpeed) {
      const over = speed - maxSpeed;
      const pull = Math.min(1, over / maxSpeed) * 0.06;
      this.vx *= 1 - pull;
      this.vy *= 1 - pull;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.vx) || !isFinite(this.vy)) {
      this.x = isFinite(this.x) ? this.x : 0;
      this.y = isFinite(this.y) ? this.y : 0;
      this.vx = 0; this.vy = 0;
    }

    // energy regen when not boosting
    if (!this.boosting) {
      this.energy = clamp(this.energy + 5.5 * dt, 0, this.maxEnergy);
    }

    // shield passive regen (costs a sliver of energy, only if not empty energy)
    if (this.maxShield > 0 && this.shieldCharge < this.maxShield && this.energy > 2) {
      const regen = 8 * dt;
      this.shieldCharge = clamp(this.shieldCharge + regen, 0, this.maxShield);
      this.energy = clamp(this.energy - regen * 0.3, 0, this.maxEnergy);
    }

    if (this.damageFlash > 0) this.damageFlash -= dt;
    if (this.shieldFlash > 0) this.shieldFlash -= dt;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  // returns { hullDamage, absorbed }
  applyDamage(amount) {
    if (this.invulnTime > 0 || this.destroyed) return { hullDamage: 0, absorbed: 0 };
    this.damageFlash = 0.35;
    let absorbed = 0;
    let remaining = amount;
    if (this.shieldCharge > 0) {
      absorbed = Math.min(this.shieldCharge, remaining);
      this.shieldCharge -= absorbed;
      remaining -= absorbed;
      this.shieldFlash = 0.4;
    }
    this.hull = clamp(this.hull - remaining, 0, this.maxHull);
    if (this.hull <= 0) this.destroyed = true;
    return { hullDamage: remaining, absorbed };
  }

  collect(type, value) {
    switch (type) {
      case 'fuel': this.fuel = clamp(this.fuel + value, 0, this.maxFuel); break;
      case 'energy': this.energy = clamp(this.energy + value, 0, this.maxEnergy); break;
      case 'repair': this.hull = clamp(this.hull + value, 0, this.maxHull); break;
      case 'salvage': this.salvage = clamp(this.salvage + value, 0, this.maxCargo); break;
      case 'rarecore':
        this.salvage = clamp(this.salvage + value, 0, this.maxCargo);
        this.energy = clamp(this.energy + 25, 0, this.maxEnergy);
        break;
    }
  }

  draw(ctx, camera, w, h, time) {
    const sx = this.x - camera.x + w / 2;
    const sy = this.y - camera.y + h / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // shield ring
    if (this.maxShield > 0 && this.shieldCharge > 0) {
      const pct = this.shieldCharge / this.maxShield;
      ctx.save();
      ctx.rotate(-this.angle);
      ctx.strokeStyle = `rgba(180,140,255,${0.25 + pct * 0.35 + this.shieldFlash * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // engine glow (behind ship)
    if (this.thrusting) {
      const flicker = 0.7 + Math.sin(time * 40) * 0.15;
      const len = (this.boosting ? 34 : 18) * flicker;
      const grad = ctx.createLinearGradient(-this.radius, 0, -this.radius - len, 0);
      const glowColor = this.boosting ? '255,180,90' : '100,224,255';
      grad.addColorStop(0, `rgba(${glowColor},0.9)`);
      grad.addColorStop(1, `rgba(${glowColor},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-this.radius + 2, -5);
      ctx.lineTo(-this.radius - len, 0);
      ctx.lineTo(-this.radius + 2, 5);
      ctx.closePath();
      ctx.fill();
    }
    if (this.reversing) {
      ctx.fillStyle = 'rgba(100,224,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(this.radius - 2, -3);
      ctx.lineTo(this.radius + 9, 0);
      ctx.lineTo(this.radius - 2, 3);
      ctx.closePath();
      ctx.fill();
    }

    // hull body
    const flash = this.damageFlash > 0 ? Math.min(1, this.damageFlash / 0.35) : 0;
    ctx.beginPath();
    ctx.moveTo(this.radius + 4, 0);
    ctx.lineTo(-this.radius + 2, -this.radius * 0.75);
    ctx.lineTo(-this.radius - 4, 0);
    ctx.lineTo(-this.radius + 2, this.radius * 0.75);
    ctx.closePath();
    const bodyColor = flash > 0 ? `rgba(255,${140 - flash * 100},${140 - flash * 100},1)` : 'rgba(226,240,250,1)';
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,224,255,0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // cockpit accent
    ctx.beginPath();
    ctx.arc(this.radius * 0.15, 0, this.radius * 0.28, 0, TAU);
    ctx.fillStyle = 'rgba(100,224,255,0.85)';
    ctx.fill();

    ctx.restore();
  }
}
