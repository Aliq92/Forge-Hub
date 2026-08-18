// Main game controller: state machine, update loop, wiring all systems together.
SG.Game = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new SG.Renderer(canvas);
    this.renderer.worldRadius = 260;
    this.particles = new SG.ParticleSystem();
    this.world = new SG.World(this.renderer.worldRadius);
    this.player = new SG.Player();
    this.resources = new SG.ResourceManager(this.world);
    this.meteors = new SG.MeteorManager(this.world);
    this.upgrades = new SG.UpgradeManager();
    this.audio = new SG.Audio();

    this.state = SG.STATE.TITLE;
    this.runActive = false;
    this.hardMode = false;
    this.endlessMode = false;
    this.selectedPlant = 'glowgrass';
    this.currentUpgradeChoices = [];
    this.elapsedTime = 0;
    this.timeBloomTimer = 0;
    this.runStats = { fragmentsCollected: 0, plantsGrown: 0, plantsDestroyed: 0 };
    this.fps = 60;
    this._fpsAccum = 0; this._fpsFrames = 0;

    this.ui = new SG.UI(this._buildHandlers());
    this.particles.setDensity(this.ui.save.settings.particles);
    this.audio.setVolumes(this.ui.save.settings.musicVol, this.ui.save.settings.sfxVol);

    this.input = new SG.Input({
      onDash: () => this._onDash(),
      onInteract: () => this._onInteract(),
      onSelectPlant: (idx) => this._onSelectDigit(idx),
      onEscape: () => this._onEscape(),
    });

    this._initTitlePreview();
    this._bindResize();
    this._resize();
  }

  // ---------------- UI handler wiring ----------------
  _buildHandlers() {
    return {
      begin: (diff) => this._startRun(diff === 'hard', false),
      beginEndless: () => this._startRun(this.hardMode, true),
      resume: () => this._resume(),
      restart: () => this._startRun(this.hardMode, this.endlessMode),
      toTitle: () => this._toTitle(),
      closeOverlay: () => this.ui.show(this.ui._returnToPause ? 'pause' : 'title'),
      pauseToggle: () => { if (this.state === SG.STATE.PLAYING) this._pause(); else if (this.state === SG.STATE.PAUSED) this._resume(); },
      continueEndless: () => this._continueEndless(),
      onSelectPlantClick: (id) => { if (this.state === SG.STATE.PLAYING) this.selectedPlant = id; },
      onSettingsChanged: (s) => {
        this.particles.setDensity(s.particles);
        this.audio.setVolumes(s.musicVol, s.sfxVol);
      },
    };
  }

  _onDash() { if (this.state === SG.STATE.PLAYING) { if (this.player.tryDash()) this.audio.dash(); } }

  _onInteract() {
    if (this.state !== SG.STATE.PLAYING) return;
    const patch = this.world.patchAtLocal(this.player.x, this.player.y);
    if (!patch) return;
    if (patch.state === SG.TERRAIN.DEAD && this.world.isUnlocked(patch)) {
      const cost = SG.Plants.restoreCost(this.world, this.player.x, this.player.y, SG.CONFIG.restoreCost, this.player);
      if (this.player.fragments >= cost) {
        this.player.fragments -= cost;
        this.world.restorePatch(patch, patch.biome === 'crystalgrove' && Math.random() < 0.35);
        this.audio.restore();
        this.particles.burst(patch.x, patch.y, 16, { color: SG.COLORS.healthyCyan, life: 0.6, size: 4, speedMin: 20, speedMax: 90, glow: true });
      }
    } else if (SG.Plants.canPlant(patch)) {
      const result = SG.Plants.tryPlant(this.world, patch, this.selectedPlant, this.player);
      if (result.ok) {
        this.runStats.plantsGrown++;
        this.audio.plant();
        this.particles.burst(patch.x, patch.y, 10, { color: SG.PLANT_TYPES[this.selectedPlant].color, life: 0.5, size: 3, speedMin: 15, speedMax: 60, glow: true });
        if (this.player.timeBloomActive) this.timeBloomTimer = 4;
        if (this.runStats.plantsGrown === 1) this._unlockAchievement('first_bloom');
      }
    }
  }

  _onSelectDigit(idx) {
    if (this.state === SG.STATE.UPGRADE) {
      const u = this.currentUpgradeChoices[idx];
      if (u) this._applyUpgradeChoice(u.id);
    } else if (this.state === SG.STATE.PLAYING) {
      const types = Object.values(SG.PLANT_TYPES);
      if (types[idx]) this.selectedPlant = types[idx].id;
    }
  }

  _onEscape() {
    const screen = this.ui.currentScreen;
    if (screen === 'howto' || screen === 'settings') {
      this.ui.show(this.ui._returnToPause ? 'pause' : (this.runActive ? null : 'title'));
    } else if (screen === 'pause') {
      this._resume();
    } else if (!screen && this.state === SG.STATE.PLAYING) {
      this._pause();
    }
  }

  // ---------------- Run lifecycle ----------------
  _startRun(hardMode, endless) {
    this.hardMode = hardMode;
    this.endlessMode = endless;
    this.world.reset();
    this.player.reset();
    this.resources.reset();
    this.meteors.reset();
    this.meteors.spawningDisabled = false;
    this.upgrades.reset();
    this.particles.clear();
    this.selectedPlant = 'glowgrass';
    this.runStats = { fragmentsCollected: 0, plantsGrown: 0, plantsDestroyed: 0 };
    this.elapsedTime = 0;
    this.timeBloomTimer = 0;
    this.victoryTriggered = false;
    this.victoryAnimTimer = 0;
    this.state = SG.STATE.PLAYING;
    this.runActive = true;
    this.ui.hideAllScreens();
    this.ui.setHudVisible(true);
    this.ui.setMobileControlsVisible(this._shouldShowMobileControls());
    this.audio.unlock();
    this.audio.startDrone();
  }

  _continueEndless() {
    this.endlessMode = true;
    this.meteors.spawningDisabled = false;
    this.meteors._setPhase(SG.PHASE.CALM, 0, this.hardMode);
    this.state = SG.STATE.PLAYING;
    this.ui.hideAllScreens();
  }

  _pause() { this.state = SG.STATE.PAUSED; this.ui.show('pause'); }
  _resume() { this.state = SG.STATE.PLAYING; this.ui.hideAllScreens(); }

  _toTitle() {
    this.state = SG.STATE.TITLE;
    this.runActive = false;
    this.ui.setHudVisible(false);
    this.ui.setMobileControlsVisible(false);
    this.ui.show('title');
    this.audio.stopDrone();
  }

  _applyUpgradeChoice(id) {
    this.upgrades.apply(id, this.player);
    this.audio.upgrade();
    this.state = SG.STATE.PLAYING;
    this.ui.hideAllScreens();
  }

  _unlockAchievement(id) {
    const list = this.ui.save.stats.achievements;
    if (!list.includes(id)) { list.push(id); SG.storage.save(this.ui.save); }
  }

  // ---------------- Update ----------------
  update(dt) {
    if (this.state === SG.STATE.TITLE) this._updateTitlePreview(dt);
    if (this.state !== SG.STATE.PLAYING) return;

    this.elapsedTime += dt;
    const move = this.input.getMoveVector();
    this.player.setInput(move.x, move.y);

    const auras = SG.Plants.getAuraEffects(this.world, this.player.x, this.player.y);
    this.player.energyRegenMul = 1 + auras.energyRegenBonus;
    if (auras.healBonus > 0) this.player.heal(auras.healBonus * dt);
    const effectiveCollectRadius = this.player.collectRadius + auras.magnetBonus;

    this.player.update(dt, this.world);

    this.resources.update(dt, this.meteors.phase, this.player, effectiveCollectRadius, this.particles, (f) => {
      let val = f.value;
      let bonus = false;
      if (Math.random() < this.player.fragmentBonusChance) { val *= 2; bonus = true; }
      this.player.fragments += val;
      this.runStats.fragmentsCollected++;
      this.audio.pickup(f.typeKey === 'ancient' ? 2 : f.typeKey === 'bright' ? 1 : 0);
    });

    SG.Plants.update(dt, this.world, this.particles);

    if (this.timeBloomTimer > 0) this.timeBloomTimer -= dt;
    const fallSlowMul = this.timeBloomTimer > 0 ? 0.6 : 1;

    const healthPct = this.world.restoreAreaPercent();
    const self = this;
    this.meteors.update(dt, this.player, this.particles, this.resources, this.world, {
      onWarning: () => { this._warningTextTimer = 2.5; this.audio.warning(); },
      onImpact: (m, hitPlayer) => {
        this.audio.impact(m.typeKey === 'large');
        if (hitPlayer) this.audio.hit();
        this.renderer.updateShake(this.meteors.shakeAmount, this.ui.save.settings.screenShake);
      },
      onPlantDestroyed: (type) => {
        this.runStats.plantsDestroyed++;
      },
    }, healthPct, this.hardMode, fallSlowMul);

    this.world.update(dt, healthPct);
    this.particles.update(dt);

    if (this._warningTextTimer > 0) this._warningTextTimer -= dt;

    if (healthPct >= 50) this._unlockAchievement('gardener');
    if (this.meteors.stats.meteorsDodged >= 40) this._unlockAchievement('star_dancer');

    if (!this.endlessMode && !this.victoryTriggered && this.upgrades.checkMilestone(healthPct)) {
      this.currentUpgradeChoices = this.upgrades.rollChoices(3);
      this.state = SG.STATE.UPGRADE;
      this.ui.showUpgradeChoices(this.currentUpgradeChoices, (id) => this._applyUpgradeChoice(id));
      return;
    }

    if (!this.player.alive) {
      this._onGameOver(healthPct);
      return;
    }

    if (!this.endlessMode && !this.victoryTriggered && healthPct >= 99.999) {
      this._triggerVictory();
    } else if (this.endlessMode && healthPct >= 99.999 && !this._endlessCelebrated) {
      this._endlessCelebrated = true;
      this._unlockAchievement('the_garden_lives');
      this.audio.victory();
    } else if (healthPct < 99.999) {
      this._endlessCelebrated = false;
    }

    if (this.victoryTriggered) {
      this.victoryAnimTimer -= dt;
      if (Math.random() < dt * 6) {
        const p = SG.util.choice(this.world.patches);
        this.particles.burst(p.x, p.y, 4, { color: SG.util.choice(['#f0c96e', '#6ff0e8', '#c98cf0']), life: 1.1, size: 3, speedMin: 10, speedMax: 60, glow: true, gravity: -15 });
      }
      if (this.victoryAnimTimer <= 0) this._onVictoryComplete(healthPct);
    }
  }

  _triggerVictory() {
    this.victoryTriggered = true;
    this.victoryAnimTimer = 2.4;
    this.meteors.meteors = [];
    this.meteors.spawningDisabled = true;
    this.audio.victory();
    this._unlockAchievement('the_garden_lives');
    if (this.hardMode) this._unlockAchievement('void_bloom');
    if (this.runStats.plantsDestroyed === 0) this._unlockAchievement('unbroken');
  }

  _onVictoryComplete(healthPct) {
    this.state = SG.STATE.VICTORY;
    const stats = {
      timeSec: this.elapsedTime, cyclesCompleted: this.meteors.cyclesCompleted,
      fragmentsCollected: this.runStats.fragmentsCollected, plantsGrown: this.runStats.plantsGrown,
      meteorsDodged: this.meteors.stats.meteorsDodged, meteorHits: this.meteors.stats.meteorHits,
    };
    this.ui.saveStatsIfBest(healthPct, true, this.elapsedTime);
    this.ui.showVictory(stats);
  }

  _onGameOver(healthPct) {
    this.state = SG.STATE.GAMEOVER;
    const stats = {
      healthPct, cyclesCompleted: this.meteors.cyclesCompleted,
      fragmentsCollected: this.runStats.fragmentsCollected, plantsGrown: this.runStats.plantsGrown,
      meteorsDodged: this.meteors.stats.meteorsDodged, meteorHits: this.meteors.stats.meteorHits,
    };
    this.ui.saveStatsIfBest(healthPct, false, this.elapsedTime);
    this.ui.showGameOver(stats);
  }

  // ---------------- Title preview ----------------
  _initTitlePreview() {
    const canvas = document.getElementById('title-canvas');
    this.titleRenderer = new SG.Renderer(canvas);
    this.titleRenderer.worldRadius = 200;
    this.titleWorld = new SG.World(200);
    for (const p of this.titleWorld.patches) {
      const r = Math.random();
      if (r < 0.55) p.state = r < 0.4 ? SG.TERRAIN.BLOOMING : SG.TERRAIN.RESTORED;
      if (Math.random() < 0.05 && p.state !== SG.TERRAIN.DEAD) p.state = SG.TERRAIN.CRYSTAL;
    }
    this.titleWorld.restoredCount = this.titleWorld.patches.filter(p => p.state !== SG.TERRAIN.DEAD).length;
    this.titleWorld.unlockedRadius = this.titleWorld.radius;
    let planted = 0;
    for (const p of this.titleWorld.patches) {
      if (planted > 26) break;
      if ((p.state === SG.TERRAIN.RESTORED || p.state === SG.TERRAIN.CRYSTAL) && Math.random() < 0.12) {
        const types = Object.keys(SG.PLANT_TYPES);
        p.plant = { type: SG.util.choice(types), growth: 1, growTime: 1, health: 100, maxHealth: 100, alive: true, pulsePhase: Math.random() * SG.util.TAU, damagedFlash: 0 };
        planted++;
      }
    }
    this._titleResizeCanvas();
  }

  _titleResizeCanvas() {
    const canvas = document.getElementById('title-canvas');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(rect.width, 320);
    this.titleRenderer.resize(size, size, dpr);
  }

  _updateTitlePreview(dt) {
    this.titleWorld.update(dt, 100);
    SG.Plants.update(dt, this.titleWorld, this.particles);
    this.titleRenderer.time += dt;
  }

  // ---------------- Render ----------------
  render(dt) {
    if (this.state === SG.STATE.TITLE) {
      const ctx = this.titleRenderer.ctx;
      ctx.clearRect(0, 0, this.titleRenderer.cssW, this.titleRenderer.cssH);
      this.titleRenderer.drawPlanet(this.titleWorld, 92, this.ui.save.settings.reducedMotion);
      return;
    }
    if (!this.runActive) return;

    const reducedMotion = this.ui.save.settings.reducedMotion;
    const parX = SG.util.clamp(this.player.x / this.world.radius, -1, 1);
    const parY = SG.util.clamp(this.player.y / this.world.radius, -1, 1);
    this.renderer.drawBackground(dt, parX, parY, reducedMotion);
    this.renderer.updateShake(this.meteors.shakeAmount, this.ui.save.settings.screenShake);
    this.renderer.drawPlanet(this.world, this.world.restoreAreaPercent(), reducedMotion);
    this.renderer.drawFragments(this.resources);
    this.renderer.drawMeteors(this.meteors, reducedMotion);
    this.renderer.drawParticles(this.particles);
    this.renderer.drawPlayer(this.player, reducedMotion);

    this._updateHudDom();
  }

  _updateHudDom() {
    const healthPct = this.world.restoreAreaPercent();
    let warningText = '';
    if (!this.player.alive) warningText = '';
    else if (this.player.health < this.player.maxHealth * 0.25) warningText = 'LOW HEALTH';
    else if (this._warningTextTimer > 0) warningText = 'STARFALL INCOMING';

    this.ui.updateHUD({
      health: this.player.health, maxHealth: this.player.maxHealth,
      energy: this.player.energy, maxEnergy: this.player.maxEnergy,
      fragments: this.player.fragments, plantsAlive: this.world.plantsAlive,
      healthPct, phase: this.meteors.phase, phaseLabel: this.meteors.getPhaseLabel(),
      phaseTimer: Math.max(0, this.meteors.phaseTimer),
      warningText, selectedPlant: this.selectedPlant, plantCostMul: this.player.plantCostMul,
      showFPS: this.ui.save.settings.showFPS, fps: this.fps,
    });
  }

  // ---------------- Loop / resize ----------------
  _bindResize() { window.addEventListener('resize', () => this._resize()); }

  _shouldShowMobileControls() {
    return this.input.isTouchLike || window.innerWidth <= 900 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(window.innerWidth, window.innerHeight, dpr);
    this._titleResizeCanvas();
    if (this.runActive && this.state !== SG.STATE.TITLE) {
      this.ui.setMobileControlsVisible(this._shouldShowMobileControls());
    }
  }

  tick(dt) {
    this._fpsAccum += dt; this._fpsFrames++;
    if (this._fpsAccum >= 0.5) { this.fps = this._fpsFrames / this._fpsAccum; this._fpsAccum = 0; this._fpsFrames = 0; }
    const clamped = Math.min(dt, 1 / 20);
    this.update(clamped);
    this.render(clamped);
  }
};
