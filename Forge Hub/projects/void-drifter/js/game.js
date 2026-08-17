// ---------------- Game: state machine, main update loop, collision resolution ----------------
function closestPointOnSegment(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return { x: x1 + dx * t, y: y1 + dy * t };
}

class Game {
  constructor() {
    this.ui = new UIManager();
    this.input = new InputManager();
    this.sound = new SoundEngine();
    this.starfield = new StarField();
    this.settings = SaveData.getSettings();
    this.particles = new ParticlePool(500);
    this.particles.setDensity(this.settings.particleDensity);

    this.state = 'title';
    this.mode = 'standard';
    this.time = 0;
    this._bestSaveAccum = 0;
    this._insideIonCloud = false;
    this.nearestStation = null;

    this.ui.syncSettingsUI(this.settings);
    this.ui.titleBest.textContent = SaveData.getBestDistanceKm().toFixed(2) + ' km';
    this.ui.showFpsCounter(this.settings.showFps);

    this.input.onPause(() => this._handleEscape());
    this.input.onInteract(() => this._handleInteract());
    this.input.onAnyKey(() => this.sound.resume());
  }

  // ---------------- Run lifecycle ----------------
  startRun(mode) {
    this.mode = mode || this.mode;
    this.player = new Player();
    this.world = new World(Math.floor(Date.now() * 0.001) ^ Math.floor(Math.random() * 1e9), this.mode);
    this.camera = new Camera();
    this.camera.reset(0, 0);
    this.eventManager = new EventManager();
    this.achievementTracker = new AchievementTracker();
    this.particles = new ParticlePool(500);
    this.particles.setDensity(this.settings.particleDensity);

    this.stats = {
      distancePx: 0,
      maxDistancePx: 0,
      bestKm: SaveData.getBestDistanceKm(),
      sectorsSurvived: 0,
      currentSectorName: null,
      salvageCollectedTotal: 0,
      asteroidsHit: 0,
      resourcesCollected: 0,
      upgradesAcquired: 0,
      criticalCollisionSurvived: false,
      fuelEmptyMarkerPx: null,
      distanceSinceFuelEmptyKm: 0,
    };
    this.nextUpgradeMilestoneKm = 15;
    this.dockedStation = null;
    this.nearestStation = null;
    this.state = 'playing';

    this.ui.hideAllScreens();
    this.ui.showHud(true);
    this.ui.setSector('');
    this.ui._lastSector = null;
    this.sound.init();
    this.sound.resume();
    this.input.clearHeld();
  }

  restartRun() { this.startRun(this.mode); }

  _endRun(title) {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.sound.setThrust(false, false);
    this.sound.playDestruction();
    this.camera.addShake(16, 0.6);
    if (this.particles) {
      this.particles.burst(this.player.x, this.player.y, 46, {
        speedMin: 60, speedMax: 320, lifeMin: 0.4, lifeMax: 1.1, sizeMin: 1.5, sizeMax: 4.5, color: '255,180,120',
      });
    }
    SaveData.setBestDistanceKm(pxToKm(this.stats.maxDistancePx));
    this.stats.bestKm = SaveData.getBestDistanceKm();
    this.ui.setGameOverStats({ ...this.stats, distancePx: this.stats.maxDistancePx, title });
    this.ui.showScreen('gameover');
  }

  // ---------------- Screen navigation ----------------
  _handleEscape() {
    if (this.state === 'playing') { this.state = 'paused'; this.ui.showScreen('pause'); }
    else if (this.state === 'paused') { this.resumeFromPause(); }
    else if (this.state === 'settings' || this.state === 'controls') { this._closeSubScreen(); }
  }
  resumeFromPause() { this.state = 'playing'; this.ui.hideAllScreens(); }

  _handleInteract() {
    if (this.state !== 'playing' || !this.nearestStation) return;
    if (distance(this.player.x, this.player.y, this.nearestStation.x, this.nearestStation.y) > this.nearestStation.dockRadius) return;
    this.dockedStation = this.nearestStation;
    this.state = 'station';
    this._refreshStationUI();
    this.ui.showScreen('station');
    this.sound.playDock();
  }

  openSettings() {
    this._settingsReturn = this.state === 'title' ? 'title' : 'pause';
    this._prevStateBeforeSub = this.state;
    this.state = 'settings';
    this.ui.showScreen('settings');
  }
  openControls() {
    this._prevStateBeforeSub = this.state;
    this.state = 'controls';
    this.ui.showScreen('controls');
  }
  _closeSubScreen() {
    this.state = this._prevStateBeforeSub || (this.player ? 'paused' : 'title');
    this.ui.showScreen(this.state === 'title' ? 'title' : 'pause');
  }

  openTutorial() { this._prevStateBeforeSub = this.state; this.state = 'tutorial'; this.ui.showScreen('tutorial'); }
  closeTutorial() {
    SaveData.setTutorialSeen();
    this.state = this._prevStateBeforeSub || 'title';
    this.ui.showScreen('title');
  }

  returnToTitle() {
    this.state = 'title';
    this.sound.setThrust(false, false);
    this.ui.hideAllScreens();
    this.ui.showHud(false);
    this.ui.showScreen('title');
    this.ui.titleBest.textContent = SaveData.getBestDistanceKm().toFixed(2) + ' km';
  }

  // ---------------- Upgrades ----------------
  _openUpgradeSelect(fromStation) {
    this._upgradeReturnState = fromStation ? 'station' : 'playing';
    const choices = rollUpgradeChoices(Math.random, this.player, 3);
    if (choices.length === 0) { this._resumeFromUpgrade(); return; }
    this.state = 'upgrade';
    this.ui.showUpgradeChoices(choices, (key) => this.chooseUpgrade(key));
  }
  chooseUpgrade(key) {
    this.player.applyUpgrade(key);
    this.stats.upgradesAcquired++;
    this.sound.playUpgrade();
    this._resumeFromUpgrade();
  }
  skipUpgrade() { this._resumeFromUpgrade(); }
  _resumeFromUpgrade() {
    if (this._upgradeReturnState === 'station') {
      this.state = 'station';
      this._refreshStationUI();
      this.ui.showScreen('station');
    } else {
      this.state = 'playing';
      this.ui.hideAllScreens();
    }
  }

  // ---------------- Station ----------------
  _refreshStationUI() {
    const repairCost = stationRepairCost(this.player);
    const refuelCost = stationRefuelCost(this.player);
    const upgradeCost = stationUpgradeCost(this.player);
    this.ui.setStationInfo(this.player, repairCost, refuelCost, upgradeCost);
  }
  stationRepair() {
    const cost = stationRepairCost(this.player);
    if (this.player.salvage < cost || this.player.hull >= this.player.maxHull) return;
    this.player.salvage -= cost;
    this.player.hull = this.player.maxHull;
    this.sound.playPickup('repair');
    this._refreshStationUI();
  }
  stationRefuel() {
    const cost = stationRefuelCost(this.player);
    if (this.player.salvage < cost || this.player.fuel >= this.player.maxFuel) return;
    this.player.salvage -= cost;
    this.player.fuel = this.player.maxFuel;
    this.sound.playPickup('fuel');
    this._refreshStationUI();
  }
  stationBuyUpgrade() {
    const cost = stationUpgradeCost(this.player);
    if (this.player.salvage < cost) return;
    this.player.salvage -= cost;
    this._openUpgradeSelect(true);
  }
  stationLeave() {
    this.dockedStation = null;
    this.state = 'playing';
    this.ui.hideAllScreens();
  }

  // ---------------- Settings sync ----------------
  applySettingsFromUI() {
    const s = this.settings;
    s.musicVolume = Number(document.getElementById('musicVolume').value);
    s.soundVolume = Number(document.getElementById('soundVolume').value);
    s.screenShake = document.getElementById('screenShake').checked;
    s.particleDensity = document.getElementById('particleDensity').value;
    s.showFps = document.getElementById('showFps').checked;
    s.reducedMotion = document.getElementById('reducedMotion').checked;
    SaveData.saveSettings(s);
    this.sound.setMusicVolume(s.musicVolume / 100);
    this.sound.setSfxVolume(s.soundVolume / 100);
    this.particles.setDensity(s.particleDensity);
    this.ui.showFpsCounter(s.showFps);
  }

  // ---------------- Main update ----------------
  update(dt) {
    this.time += dt;

    if (this.state === 'playing') this._updatePlaying(dt);

    if (this.player && this.state !== 'title') {
      this.ui.updateHUD(this.player, this.stats);
      this.ui.drawMinimap(this.player, this.world, getSectorInfo(pxToKm(this.stats.distancePx)), this._insideIonCloud, this.eventManager ? this.eventManager.beacons : []);
    }
  }

  _updatePlaying(dt) {
    const player = this.player, world = this.world, particles = this.particles;
    const inputState = this.input.getState();
    player.update(dt, inputState, this.settings);
    this.sound.setThrust(player.thrusting, player.boosting);
    if (player.thrusting && player.boosting) this.sound.playBoost();

    // gravity well pull
    for (const gw of world.gravityWells) {
      const { ax, ay } = gw.pullOn(player.x, player.y);
      player.vx += ax * dt; player.vy += ay * dt;
    }

    world.ensureChunksAround(player.x, player.y, this.eventManager.spawnDensityMult);
    world.unloadFarChunks(player.x, player.y);
    world.update(dt, player);
    this.eventManager.update(dt, player, world, (t, m) => this.ui.toast(t, m));

    const queryRadius = Math.max(player.magnetRadius, 260, player.scannerRange * 0.5);
    const nearby = world.queryNearby(player.x, player.y, queryRadius);

    // pickups
    for (const p of nearby.resources) {
      if (p.collected) continue;
      p.update(dt, player, player.magnetRadius, this.time);
      if (distance(p.x, p.y, player.x, player.y) < player.radius + p.radius) this._collectPickup(p);
    }

    // asteroid collisions (swept segment test to avoid tunneling at high speed).
    // Gated by invulnTime so a single bump can't re-trigger every frame while the ship
    // and asteroid remain in contact (asteroids aren't removed on a non-fatal hit).
    if (player.invulnTime <= 0) {
      for (const a of nearby.asteroids) {
        const cp = closestPointOnSegment(player.prevX, player.prevY, player.x, player.y, a.x, a.y);
        if (dist2(cp.x, cp.y, a.x, a.y) <= (player.radius + a.radius) * (player.radius + a.radius)) {
          this._resolveAsteroidCollision(a, cp);
          break;
        }
      }
    }

    // hazards
    this._insideIonCloud = false;
    for (const hz of nearby.hazards) {
      if (hz.type === 'ioncloud') {
        if (hz.containsPoint(player.x, player.y)) {
          this._insideIonCloud = true;
          player.energy = clamp(player.energy - hz.drainPerSec * dt, 0, player.maxEnergy);
        }
      } else if (hz.type === 'mine') {
        if (!hz.exploded && distance(player.x, player.y, hz.x, hz.y) < hz.triggerRadius) {
          hz.exploded = true; hz.dead = true;
          const { hullDamage } = player.applyDamage(38);
          player.invulnTime = 0.35;
          particles.burst(hz.x, hz.y, 30, { speedMin: 100, speedMax: 380, lifeMin: 0.3, lifeMax: 0.8, sizeMin: 1.5, sizeMax: 4, color: '255,120,80' });
          this.camera.addShake(14, 0.4);
          this.sound.playCollision(1);
          if (hullDamage > 0) this.stats.asteroidsHit++;
        }
      } else if (hz.type === 'debris' || hz.type === 'solar') {
        if (circleOverlap(player.x, player.y, player.radius, hz.x, hz.y, hz.radius)) {
          const relSpeed = Math.hypot(player.vx - hz.vx, player.vy - hz.vy);
          const dmg = (hz.type === 'solar' ? 16 : 8) + relSpeed * 0.045;
          const { hullDamage } = player.applyDamage(dmg);
          player.invulnTime = 0.3;
          hz.dead = true;
          particles.burst(hz.x, hz.y, 12, { speedMin: 60, speedMax: 220, lifeMin: 0.2, lifeMax: 0.5, sizeMin: 1, sizeMax: 3, color: hz.type === 'solar' ? '255,160,80' : '200,200,210' });
          this.camera.addShake(6, 0.2);
          this.sound.playCollision(0.5);
          if (hullDamage > 0) this.stats.asteroidsHit++;
        }
      }
    }

    // station proximity
    this.nearestStation = null;
    let bestD = Infinity;
    for (const s of nearby.stations) {
      const d = distance(player.x, player.y, s.x, s.y);
      if (d < s.dockRadius && d < bestD) { bestD = d; this.nearestStation = s; }
    }
    this.ui.setInteractHint(!!this.nearestStation);

    // distance / sector progression
    this.stats.distancePx = Math.hypot(player.x, player.y);
    if (this.stats.distancePx > this.stats.maxDistancePx) this.stats.maxDistancePx = this.stats.distancePx;
    const sectorInfo = getSectorInfo(pxToKm(this.stats.distancePx));
    if (sectorInfo.name !== this.stats.currentSectorName) {
      this.stats.currentSectorName = sectorInfo.name;
      this.stats.sectorsSurvived++;
      this.ui.setSector(sectorInfo.name);
    }

    const kmNow = pxToKm(this.stats.maxDistancePx);
    if (kmNow >= this.nextUpgradeMilestoneKm) {
      this.nextUpgradeMilestoneKm += 15;
      this._openUpgradeSelect(false);
    }

    if (player.fuel <= 0) {
      if (this.stats.fuelEmptyMarkerPx == null) this.stats.fuelEmptyMarkerPx = this.stats.distancePx;
      this.stats.distanceSinceFuelEmptyKm = pxToKm(Math.abs(this.stats.distancePx - this.stats.fuelEmptyMarkerPx));
    } else {
      this.stats.fuelEmptyMarkerPx = null;
      this.stats.distanceSinceFuelEmptyKm = 0;
    }

    this.achievementTracker.update({
      distanceKm: kmNow,
      salvageCollectedTotal: this.stats.salvageCollectedTotal,
      criticalCollisionSurvived: this.stats.criticalCollisionSurvived,
      distanceSinceFuelEmptyKm: this.stats.distanceSinceFuelEmptyKm,
    }, (def) => this.ui.toast('ACHIEVEMENT UNLOCKED', def.name));

    this._bestSaveAccum += dt;
    if (this._bestSaveAccum > 1) {
      this._bestSaveAccum = 0;
      SaveData.setBestDistanceKm(kmNow);
      this.stats.bestKm = Math.max(this.stats.bestKm, SaveData.getBestDistanceKm());
    }

    this.camera.update(dt, player.x, player.y, player.vx, player.vy, this.settings.screenShake);
    particles.update(dt);

    this._updateWarnings(nearby);

    if (player.destroyed) this._endRun('SHIP DESTROYED');
  }

  _collectPickup(p) {
    p.collected = true;
    this.player.collect(p.type, p.value);
    this.stats.resourcesCollected++;
    if (p.type === 'salvage' || p.type === 'rarecore') this.stats.salvageCollectedTotal += p.value;
    this.sound.playPickup(p.type);
    this.particles.burst(p.x, p.y, 10, { speedMin: 30, speedMax: 120, lifeMin: 0.25, lifeMax: 0.5, sizeMin: 1, sizeMax: 2.5, color: p.color, optional: true });
  }

  _resolveAsteroidCollision(a, cp) {
    const player = this.player;
    const dx = player.x - a.x, dy = player.y - a.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const nx = dx / d, ny = dy / d;
    const rvx = player.vx - a.vx, rvy = player.vy - a.vy;
    const closingSpeed = Math.max(0, -(rvx * nx + rvy * ny));
    const relSpeed = Math.hypot(rvx, rvy);
    const sizeFactor = clamp(a.radius / 30, 0.4, 3);
    const severity = clamp((relSpeed / 480) * sizeFactor, 0, 3);
    const damage = 5 + severity * 32;

    const { hullDamage } = player.applyDamage(damage);
    player.invulnTime = 0.35;
    this.stats.asteroidsHit++;
    if (!player.destroyed && player.hull / player.maxHull < 0.15 && hullDamage > 0) this.stats.criticalCollisionSurvived = true;

    const bounceSpeed = Math.max(closingSpeed, 60) * 0.6;
    player.vx += nx * bounceSpeed;
    player.vy += ny * bounceSpeed;
    a.vx -= nx * 18; a.vy -= ny * 18;

    const overlap = (player.radius + a.radius) - d;
    if (overlap > 0) { player.x += nx * overlap; player.y += ny * overlap; }

    this.sound.playCollision(clamp(severity / 3, 0, 1));
    this.particles.burst(cp.x, cp.y, 14, { speedMin: 60, speedMax: 260, lifeMin: 0.25, lifeMax: 0.6, sizeMin: 1.5, sizeMax: 3.5, color: '255,200,150' });
    this.camera.addShake(clamp(severity * 4, 1, 14), 0.25);

    if (severity > 1.3 && a.sizeClass !== 'large') {
      a.dead = true;
      const rng = mulberry32(hashSeed('frag', Math.round(a.x), Math.round(a.y), Math.round(this.time * 1000)));
      const frags = fragmentAsteroid(a, rng);
      for (const f of frags) this.world.injectAsteroid(f);
      if (rng() < a.resourceChance) {
        const key = weightedPick(rng, [{ key: 'salvage', weight: 3 }, { key: 'fuel', weight: 1 }, { key: 'energy', weight: 1 }]).key;
        this.world.injectPickup(new Pickup(a.x, a.y, key, rng));
      }
    } else if (severity > 2.0 && a.sizeClass === 'large') {
      a.hp -= 1;
      if (a.hp <= 0) {
        a.dead = true;
        this.particles.burst(a.x, a.y, 24, { speedMin: 80, speedMax: 260, lifeMin: 0.3, lifeMax: 0.7, sizeMin: 2, sizeMax: 4, color: a.color });
      }
    }
  }

  _updateWarnings(nearby) {
    const player = this.player;
    const list = [];
    if (player.fuel <= 0) list.push({ level: 'high', text: 'FUEL EMPTY — DRIFTING' });
    else if (player.fuel / player.maxFuel < 0.15) list.push({ level: 'high', text: 'LOW FUEL' });
    if (player.hull / player.maxHull < 0.25) list.push({ level: 'high', text: 'HULL CRITICAL' });
    if (player.energy < 0.5) list.push({ level: 'mid', text: 'ENERGY DEPLETED' });

    let risk = false;
    for (const a of nearby.asteroids) {
      const d = distance(player.x, player.y, a.x, a.y);
      const closing = -(((player.vx - a.vx) * (a.x - player.x) + (player.vy - a.vy) * (a.y - player.y)) / Math.max(1, d));
      if (d < a.radius + 130 || (d < a.radius + 300 && closing > 160)) { risk = true; break; }
    }
    if (risk) list.push({ level: 'mid', text: 'COLLISION RISK' });

    let hazardNear = false;
    for (const hz of nearby.hazards) {
      if (hz.type === 'mine' && distance(player.x, player.y, hz.x, hz.y) < hz.triggerRadius + 90) { hazardNear = true; break; }
      if ((hz.type === 'debris' || hz.type === 'solar') && distance(player.x, player.y, hz.x, hz.y) < 160) { hazardNear = true; break; }
    }
    if (hazardNear) list.push({ level: 'mid', text: 'HAZARD NEARBY' });

    this.ui.updateWarnings(list.slice(0, 3));
  }

  // ---------------- Render ----------------
  render(renderer, dt) {
    if (!this.player) {
      if (!this._titleCamera) { this._titleCamera = new Camera(); this._titleCamera.reset(0, 0); }
      this._titleCamera.update(dt || 0.016, Math.sin(this.time * 0.05) * 400, Math.cos(this.time * 0.04) * 300, 0, 0, false);
      renderer.draw({
        player: { destroyed: true, x: 0, y: 0, angle: 0, damageFlash: 0, draw: () => {} },
        world: { draw: () => {} },
        camera: this._titleCamera,
        particles: this.particles,
        starfield: this.starfield,
        time: this.time,
        sectorInfo: null,
        reducedMotion: this.settings.reducedMotion,
        insideIonCloud: false,
      });
      return;
    }
    renderer.draw({
      player: this.player,
      world: this.world,
      camera: this.camera,
      particles: this.particles,
      starfield: this.starfield,
      time: this.time,
      sectorInfo: getSectorInfo(pxToKm(this.stats.distancePx)),
      reducedMotion: this.settings.reducedMotion,
      insideIonCloud: this._insideIonCloud,
    });
  }
}
