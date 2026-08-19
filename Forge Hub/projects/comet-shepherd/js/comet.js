import { CONFIG } from './config.js';
import { clamp, normalize, len } from './utils.js';

export class Comet{
  constructor(x, y, vx, vy){
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.mass = CONFIG.COMET_MASS;
    this.radius = CONFIG.COMET_START_RADIUS;

    this.maxIce = CONFIG.COMET_START_ICE;
    this.ice = this.maxIce;
    this.heat = 0;
    this.maxHeat = 100;
    this.maxEnergy = CONFIG.COMET_START_ENERGY;
    this.energy = this.maxEnergy;
    this.collectRadius = CONFIG.COMET_START_COLLECT_RADIUS;
    this.tailIntensity = 0.4;

    this.correctionCooldown = 0;
    this.emergencyCooldown = 0;
    this.alive = true;
    this.invulnTimer = 1.2; // brief spawn grace period

    // upgrade-affected multipliers
    this.energyCostMult = 1;
    this.heatGainMult = 1;
    this.iceRegenRate = 0;
    this.emergencyPowerMult = 1;
    this.previewLevel = 0;
    this.gravitySenseLevel = 0;
    this.slingshotMasteryLevel = 0;
    this.starHarvestLevel = 0;

    this.distanceTravelled = 0;
    this.maxSpeed = 0;
    this.closestSolarPass = Infinity;

    this.impactFlash = 0;
    this.tailDisruption = 0;
  }

  get speed(){ return Math.hypot(this.vx, this.vy); }

  // Applies a velocity delta and drains energy proportional to strength (0..1 = fraction of max impulse).
  applyCorrection(dx, dy, strengthFrac, isEmergency=false){
    const n = normalize(dx, dy);
    if(n.x === 0 && n.y === 0) return false;
    if(isEmergency){
      if(this.emergencyCooldown > 0) return false;
      const impulse = CONFIG.EMERGENCY_IMPULSE * this.emergencyPowerMult;
      this.vx += n.x * impulse;
      this.vy += n.y * impulse;
      this.energy = clamp(this.energy - CONFIG.EMERGENCY_ENERGY_COST, 0, this.maxEnergy);
      this.emergencyCooldown = CONFIG.EMERGENCY_COOLDOWN;
      this.tailDisruption = 0.5;
      return true;
    }
    const cost = CONFIG.CORRECTION_ENERGY_PER_IMPULSE * strengthFrac * this.energyCostMult;
    if(this.energy < cost * 0.25) return false;
    const impulse = CONFIG.CORRECTION_MAX_IMPULSE * strengthFrac;
    this.vx += n.x * impulse;
    this.vy += n.y * impulse;
    this.energy = clamp(this.energy - cost, 0, this.maxEnergy);
    this.correctionCooldown = CONFIG.CORRECTION_COOLDOWN;
    return true;
  }

  applyNudge(dx, dy){
    if(this.correctionCooldown > 0) return false;
    const cost = CONFIG.NUDGE_ENERGY_COST * this.energyCostMult;
    if(this.energy < cost) return false;
    const n = normalize(dx, dy);
    this.vx += n.x * CONFIG.NUDGE_IMPULSE;
    this.vy += n.y * CONFIG.NUDGE_IMPULSE;
    this.energy = clamp(this.energy - cost, 0, this.maxEnergy);
    this.correctionCooldown = CONFIG.NUDGE_COOLDOWN;
    return true;
  }

  damage(amount){
    if(this.invulnTimer > 0) return;
    this.ice = clamp(this.ice - amount, 0, this.maxIce);
    this.impactFlash = 1;
    if(this.ice <= 0) this.alive = false;
  }

  heal(amount){
    this.ice = clamp(this.ice + amount, 0, this.maxIce);
  }

  restoreEnergy(amount){
    this.energy = clamp(this.energy + amount, 0, this.maxEnergy);
  }

  update(dt, heatInput, coldSpace){
    this.correctionCooldown = Math.max(0, this.correctionCooldown - dt);
    this.emergencyCooldown = Math.max(0, this.emergencyCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.impactFlash = Math.max(0, this.impactFlash - dt*2.4);
    this.tailDisruption = Math.max(0, this.tailDisruption - dt*0.8);

    this.energy = clamp(this.energy + CONFIG.ENERGY_REGEN_PER_SEC * dt, 0, this.maxEnergy);

    // heat dynamics
    const gain = heatInput * this.heatGainMult;
    this.heat = clamp(this.heat + gain * dt - CONFIG.HEAT_COOL_RATE * dt, 0, this.maxHeat);

    if(this.heat > CONFIG.HEAT_ICE_LOSS_THRESHOLD){
      const over = (this.heat - CONFIG.HEAT_ICE_LOSS_THRESHOLD) / (this.maxHeat - CONFIG.HEAT_ICE_LOSS_THRESHOLD);
      this.damage(CONFIG.HEAT_ICE_LOSS_RATE * over * dt);
    } else if(coldSpace && this.iceRegenRate > 0){
      this.heal(this.iceRegenRate * dt);
    }

    const spd = this.speed;
    this.maxSpeed = Math.max(this.maxSpeed, spd);
    this.distanceTravelled += spd * dt;

    // tail intensity reacts to speed & heat — both speed AND stellar heat should make
    // the tail longer/brighter (heat used to subtract here, which fought a close solar
    // pass looking dramatic; now a close/hot pass is rewarded visually, matching stars
    // actually boiling off more coma material).
    const speedFactor = clamp(spd / 380, 0, 1);
    const heatFactor = clamp(this.heat / 100, 0, 1);
    this.tailIntensity = clamp(0.35 + speedFactor*0.75 + heatFactor*0.4, 0.15, 1.7);
  }

  get heatLabel(){
    if(this.heat < CONFIG.HEAT_COLD_MAX) return 'COLD';
    if(this.heat < CONFIG.HEAT_WARM_MAX) return 'WARM';
    if(this.heat < CONFIG.HEAT_HOT_MAX) return 'HOT';
    return 'CRITICAL';
  }

  // Qualitative stability read on Ice Integrity — reuses the existing ice/health stat
  // rather than adding a second meter, per the "don't clutter the HUD" design rule.
  get stabilityState(){
    const frac = this.maxIce > 0 ? this.ice / this.maxIce : 1;
    if(frac > 0.66) return 'STABLE';
    if(frac > 0.33) return 'STRAINED';
    if(frac > 0.12) return 'CRACKING';
    return 'CRITICAL';
  }
}
