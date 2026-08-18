// Top-level orchestration: state machine, main loop wiring, camera, stats,
// achievements and persistence.
import { World } from './world.js';
import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { LightingSystem } from './lighting.js';
import { ParticleSystem } from './particles.js';
import { FireflyManager } from './fireflies.js';
import { ShadowManager } from './shadows.js';
import { PlantManager } from './plants.js';
import { ShrineManager } from './shrines.js';
import { UI } from './ui.js';
import { InputSystem, setupTouchControls } from './input.js';
import { AudioSystem } from './audio.js';
import { loadSettings, saveSettings, loadProgress, saveProgress, loadAchievements, saveAchievements } from './storage.js';
import { UPGRADE_POOL, SHRINE_COUNT, TILE } from './config.js';
import { clamp, dist, mulberry32, pick } from './utils.js';

const PIXELS_PER_METER = 26;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = loadSettings();
    this.progress = loadProgress();
    this.achievements = loadAchievements();
    this.stats = freshStats();

    this.audio = new AudioSystem(this.settings);
    this.input = new InputSystem(canvas);
    setupTouchControls(this.input);
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    this.ui = new UI(this);
    this.ui.setBestJourney(this.progress);

    this.state = 'title';
    this.mode = 'journey';
    this.world = null;
    this.shake = { time: 0, mag: 0 };
    this.darkWalkerDist = 0;

    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', () => this.audio.init(), { once: true });
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    document.getElementById('fps-counter').classList.toggle('hidden', !this.settings.showFPS);
    this._fpsAccum = 0; this._fpsFrames = 0; this._fpsLast = 0;
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    saveSettings(this.settings);
    this.audio.setVolumes(this.settings);
    document.getElementById('fps-counter').classList.toggle('hidden', !this.settings.showFPS);
  }

  startJourney(mode) {
    this.mode = mode || 'journey';
    this._newGame();
    this.state = 'playing';
    this.ui.stopTitleBg();
    this.ui.showHUD();
  }

  restartJourney() { this.startJourney(this.mode); }

  _newGame() {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.world = new World(seed);
    this.particles = new ParticleSystem();
    this.player = new Player(this.world.spawn.x, this.world.spawn.y);
    this.fireflies = new FireflyManager(this.world, this.particles, this.rng);
    this.plants = new PlantManager(this.world, this.particles);
    this.shadows = new ShadowManager(this.world, this.particles, this.rng);
    this.shrines = new ShrineManager(this.world, this.particles, this.plants);
    this.lighting = new LightingSystem(this.world);

    if (this.mode === 'peaceful') {
      this.player.lantern.drainRate *= 0.8;
      this.shadows.difficultyMul = 0.5;
    } else if (this.mode === 'deepnight') {
      this.player.lantern.drainRate *= 1.4;
      this.shadows.difficultyMul = 1.6;
    }

    this.stats = freshStats();
    this.darkWalkerDist = 0;
    this._lastPos = { x: this.player.x, y: this.player.y };
    this.world.markExplored(this.player.x, this.player.y, 6);
  }

  pauseToggle() {
    if (this.state === 'playing') { this.state = 'paused'; this.ui.show('screen-pause'); }
    else if (this.state === 'paused') { this.resume(); }
  }

  resume() { this.state = 'playing'; this.ui.showHUD(); }

  returnToTitle() {
    this.state = 'title';
    this.world = null;
    this.ui.setBestJourney(this.progress);
    this.ui.show('screen-title');
    this.ui.startTitleBg();
  }

  continueExploring() {
    this.state = 'playing';
    this.ui.showHUD();
  }

  // ---------------- main loop ----------------
  update(dt) {
    dt = Math.min(dt, 0.05);
    this._updateFps(dt);

    if (this.state === 'playing') this._updatePlaying(dt);

    if (this.settings.showFPS) {
      document.getElementById('fps-counter').textContent = `${Math.round(this._fps || 0)} FPS`;
    }
  }

  _updateFps(dt) {
    this._fpsAccum += dt; this._fpsFrames++;
    if (this._fpsAccum >= 0.5) { this._fps = this._fpsFrames / this._fpsAccum; this._fpsAccum = 0; this._fpsFrames = 0; }
  }

  _updatePlaying(dt) {
    const { player, world, shadows, fireflies, plants, shrines, particles, lighting } = this;

    player.update(dt, this.input, world);

    const inSafeZone = shrines.safeZones.some(z => dist(player.x, player.y, z.x, z.y) < z.radius);
    player.inSafeZone = inSafeZone;
    player.lantern.update(dt, { inSafeZone, flickerEnabled: this.settings.lanternFlicker, lastEmber: player.lastEmber });

    if (this.input.wantsFlare()) {
      if (player.lantern.tryFlare()) {
        this.stats.flares++;
        this.audio.flare();
        this._triggerShake(0.25, 6);
      }
    }

    let interactHint = null;
    const shrineNear = shrines.nearestUnactivated(player, 60);
    const reedNear = world.objects.emberReeds.find(er => er.ready && dist(er.x, er.y, player.x, player.y) < 46);
    if (shrineNear) interactHint = shrineNear.id === 'heart' ? 'Activate the <b>Heart Lantern</b>' : 'Activate the Shrine';
    else if (reedNear) interactHint = 'Draw energy from the Ember Reed';
    this.ui.setInteractPrompt(!!interactHint, interactHint ? `Press <span class="key">E</span> — ${interactHint}` : '');

    if (this.input.wantsInteract()) {
      if (shrineNear) this._activateShrine(shrineNear);
      else if (reedNear) plants.tryInteract(player);
    }

    if (this.input.wantsPause()) this.pauseToggle();
    if (this.state !== 'playing') return; // an interaction may have opened the upgrade/pause screen

    fireflies.update(dt, player, (energy) => {
      player.lantern.recharge(energy);
      this.stats.fireflies++;
      this.progress.totalFireflies = (this.progress.totalFireflies || 0) + 1;
      this.audio.fireflyPickup();
    });

    plants.update(dt, player);
    this.stats.hiddenPaths = plants.hiddenPathsFound;

    shadows.update(dt, player, shrines.safeZones, player.lantern.flareTimer > 0);
    this.stats.encounters = shadows.encounterCount;

    shrines.update(dt);

    if (player.hitEvent) {
      player.hitEvent = false;
      this.audio.hurt();
      this._triggerShake(0.3, 8);
    }

    const revealRadius = Math.max(3, Math.round(player.lantern.radius / TILE) + 1);
    world.markExplored(player.x, player.y, revealRadius);
    lighting.updateMemory(dt, player);

    if (player.footstepParticleTimer <= 0 && player.moving) {
      player.footstepParticleTimer = 0.26;
      particles.spawn({
        x: player.x + (Math.random() - 0.5) * 6, y: player.y + 8,
        vx: (Math.random() - 0.5) * 8, vy: -4,
        life: 0, maxLife: 0.5, size: 2, color: 'rgba(200,190,160,0.5)', gravity: 10, drag: 0.9
      });
      if (Math.random() < 0.5) this.audio.footstep();
    }

    particles.update(dt);

    const d = dist(this._lastPos.x, this._lastPos.y, player.x, player.y);
    this.stats.distance += d / PIXELS_PER_METER;
    this._lastPos = { x: player.x, y: player.y };
    this.stats.timeSec += dt;

    if (player.lantern.criticalEnergy && player.moving) {
      this.darkWalkerDist += d / PIXELS_PER_METER;
      if (this.darkWalkerDist > 60) this._unlockAchievement('dark_walker');
    }

    if ((this.progress.totalFireflies || 0) >= 100) this._unlockAchievement('firefly_friend');
    if (this.stats.hiddenPaths >= 5) this._unlockAchievement('pathfinder');

    if (this.shake.time > 0) this.shake.time = Math.max(0, this.shake.time - dt);

    if (player.health <= 0) this._triggerGameOver();
  }

  _activateShrine(shrine) {
    const wasCritical = this.player.lantern.criticalEnergy;
    const result = this.shrines.activate(shrine);
    this.audio.shrineActivate();

    if (result === 'shrine') {
      this.stats.shrinesActivated = this.shrines.activatedCount;
      if (this.stats.shrinesActivated === 1) this._unlockAchievement('first_light');
      if (wasCritical) this._unlockAchievement('no_shadow_fears');

      const options = pickUpgrades(this.rng, 3);
      this.state = 'upgrade';
      this.ui.showUpgradeChoice('Shrine Awakened', options, (opt) => {
        opt.apply(this.player);
        this.audio.upgrade();
        this.state = 'playing';
        this.ui.showHUD();
      });
    } else if (result === 'heart') {
      this._unlockAchievement('keeper_of_light');
      this._triggerVictory();
    }
  }

  _triggerVictory() {
    this.state = 'victory';
    this.progress.victories = (this.progress.victories || 0) + 1;
    this.progress.bestShrines = SHRINE_COUNT;
    if (!this.progress.bestTimeSec || this.stats.timeSec < this.progress.bestTimeSec) {
      this.progress.bestTimeSec = this.stats.timeSec;
    }
    saveProgress(this.progress);
    this.audio.victory();
    this.ui.showVictory(this.stats);
  }

  _triggerGameOver() {
    this.state = 'gameover';
    this.progress.bestShrines = Math.max(this.progress.bestShrines || 0, this.shrines.activatedCount);
    saveProgress(this.progress);
    this.ui.showGameOver(this.stats);
  }

  _unlockAchievement(id) {
    if (this.achievements[id]) return;
    this.achievements[id] = true;
    saveAchievements(this.achievements);
    this.ui.achievementToast(id);
  }

  _triggerShake(time, mag) {
    if (!this.settings.screenShake) return;
    this.shake.time = time; this.shake.mag = mag;
  }

  // ---------------- render ----------------
  render(nowSec) {
    const r = this.renderer;
    if (!this.world) return;

    r.setTime(nowSec);
    r.clear();

    let camX = this.player.x - r.viewW / 2;
    let camY = this.player.y - r.viewH / 2;
    if (this.shake.time > 0) {
      camX += (Math.random() - 0.5) * this.shake.mag * (this.shake.time / 0.3);
      camY += (Math.random() - 0.5) * this.shake.mag * (this.shake.time / 0.3);
    }

    r.drawTerrain(this.world, camX, camY);
    r.drawObjects(this.world, camX, camY, this.plants);
    this.fireflies.render(r.ctx, camX, camY, nowSec);
    this.shadows.render(r.ctx, camX, camY, nowSec);
    this.shrines.render(r.ctx, camX, camY, nowSec);
    this.particles.render(r.ctx, camX, camY);
    r.drawPlayer(this.player);

    const sources = this._buildLightSources(camX, camY, r.viewW, r.viewH);
    let depth = this.world.depthAt(this.player.x, this.player.y);
    depth = clamp(depth - this.shrines.activatedCount * 0.035, 0, 1);
    this.lighting.composite(r.ctx, camX, camY, r.viewW, r.viewH, sources, this.player, depth, this.settings);

    r.drawFog(this.settings, camX, camY);

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'upgrade') {
      const compassTarget = this._compassTarget();
      this.ui.updateHUD(this.player, this.shrines, this.world, compassTarget, this._objectiveText());
    }
  }

  _buildLightSources(camX, camY, viewW, viewH) {
    const sources = [];
    const p = this.player;
    sources.push({ x: p.x, y: p.y, radius: p.lantern.radius, intensity: p.lantern.intensity });

    for (const s of this.shrines.shrines) {
      if (!s.activated) continue;
      sources.push({ x: s.x, y: s.y, radius: 44 + s.safeRadius * 0.62, intensity: 0.95 });
    }
    const h = this.shrines.heart;
    if (h.activated) sources.push({ x: h.x, y: h.y, radius: 70 + h.safeRadius * 0.6, intensity: 1 });

    for (const lt of this.world.objects.lumenTrees) {
      if (lt.discovered) sources.push({ x: lt.x, y: lt.y, radius: 120, intensity: 0.8 });
    }
    for (const f of this.world.objects.moonflowers) {
      if (f.awake) sources.push({ x: f.x, y: f.y, radius: 42, intensity: 0.5 });
    }
    for (const fly of this.fireflies.list) {
      sources.push({ x: fly.x, y: fly.y, radius: 16, intensity: 0.35 });
    }
    return sources;
  }

  _compassTarget() {
    const near = this.shrines.nearestUnactivated(this.player, Infinity);
    if (near) return near;
    if (this.shrines.activatedCount >= SHRINE_COUNT && !this.shrines.heart.activated) return this.shrines.heart;
    return null;
  }

  _objectiveText() {
    const count = this.shrines.activatedCount;
    if (count < SHRINE_COUNT) return `Activate the shrines (${count}/${SHRINE_COUNT})`;
    if (!this.shrines.heart.activated) return 'The path has opened. Find the Heart Lantern.';
    return 'The Vale remembers the light.';
  }
}

function freshStats() {
  return { distance: 0, shrinesActivated: 0, fireflies: 0, hiddenPaths: 0, encounters: 0, flares: 0, timeSec: 0 };
}

function pickUpgrades(rng, n) {
  const pool = [...UPGRADE_POOL];
  const chosen = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}
