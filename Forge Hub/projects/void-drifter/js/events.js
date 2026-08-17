// ---------------- Random space events: variety without a quest system ----------------
class EventManager {
  constructor() {
    this.cooldown = randRangeSimple(18, 30);
    this.active = null; // { type, timeLeft, totalTime }
    this.beacons = []; // minimap markers for signals/beacons { x, y, life, color, label }
  }

  get spawnDensityMult() {
    if (!this.active) return 1;
    if (this.active.type === 'surge') return 2.0;
    if (this.active.type === 'calm') return 0.25;
    return 1;
  }

  get fuelConsumptionMult() {
    return this.active && this.active.type === 'leak' ? 1.9 : 1;
  }

  update(dt, player, world, onToast) {
    if (this.active) {
      this.active.timeLeft -= dt;
      if (this.active.timeLeft <= 0) this.active = null;
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0 && !this.active) {
      this._trigger(player, world, onToast);
      this.cooldown = randRangeSimple(35, 60);
    }
    for (const b of this.beacons) b.life -= dt;
    this.beacons = this.beacons.filter((b) => b.life > 0);
  }

  _trigger(player, world, onToast) {
    const roll = Math.random();
    if (roll < 0.24) this._salvageSignal(player, world, onToast);
    else if (roll < 0.46) this._asteroidSurge(onToast);
    else if (roll < 0.66) this._fuelLeak(onToast);
    else if (roll < 0.84) this._calmPocket(onToast);
    else this._distressBeacon(player, world, onToast);
  }

  _dirAhead(player, dist) {
    const speed = Math.hypot(player.vx, player.vy);
    const ang = speed > 5 ? Math.atan2(player.vy, player.vx) : player.angle;
    return { x: player.x + Math.cos(ang) * dist, y: player.y + Math.sin(ang) * dist };
  }

  _salvageSignal(player, world, onToast) {
    const p = this._dirAhead(player, randRangeSimple(700, 1100));
    const rng = mulberry32(hashSeed('signal', Math.round(p.x), Math.round(p.y)));
    for (let i = 0; i < randInt(rng, 4, 7); i++) {
      world.injectPickup(new Pickup(p.x + randRangeSimple(-90, 90), p.y + randRangeSimple(-90, 90), 'salvage', rng));
    }
    this.beacons.push({ x: p.x, y: p.y, life: 40, color: '160,255,190', label: 'SALVAGE SIGNAL' });
    onToast('SALVAGE SIGNAL', 'A wreck nearby is broadcasting — salvage detected.');
  }

  _asteroidSurge(onToast) {
    this.active = { type: 'surge', timeLeft: 14, totalTime: 14 };
    onToast('ASTEROID SURGE', 'Sensors show a dense field forming ahead.');
  }

  _fuelLeak(onToast) {
    this.active = { type: 'leak', timeLeft: 12, totalTime: 12 };
    onToast('FUEL LEAK', 'A micro-fracture is venting fuel. Consumption spiking.');
  }

  _calmPocket(onToast) {
    this.active = { type: 'calm', timeLeft: 16, totalTime: 16 };
    onToast('CALM POCKET', 'A quiet stretch of space. Breathe easy.');
  }

  _distressBeacon(player, world, onToast) {
    const p = this._dirAhead(player, randRangeSimple(900, 1400));
    const rng = mulberry32(hashSeed('distress', Math.round(p.x), Math.round(p.y)));
    world.injectPickup(new Pickup(p.x, p.y, 'rarecore', rng));
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * TAU;
      world.injectAsteroid(new Asteroid(p.x + Math.cos(ang) * 130, p.y + Math.sin(ang) * 130, 'medium', rng, 1.3));
    }
    this.beacons.push({ x: p.x, y: p.y, life: 55, color: '220,150,255', label: 'DISTRESS BEACON' });
    onToast('DISTRESS BEACON', 'Risk/reward: a rare core is guarded nearby.');
  }
}
