// game.js — state machine, room simulation loop, save data. This is the integration
// point between physics/objects/levels and the renderer/ui/audio layers.
import { TICK_RATE, DT, aabbOverlap, stepEntity } from './physics.js';
import { createPlayerEntity, createEchoEntity, InputTracker } from './player.js';
import { Recorder, echoInputAt } from './recorder.js';
import { createRoomRuntime, evaluateTriggers, movingPlatformRectAt, laserActiveAt, doorSolidRect } from './objects.js';
import { LEVELS, levelById, chapterOf } from './levels.js';

const SAVE_KEY = 'echoRunner.progress.v1';
const SETTINGS_KEY = 'echoRunner.settings.v1';

const DEFAULT_SETTINGS = {
  musicVolume: 0.4,
  sfxVolume: 0.7,
  screenShake: true,
  echoTrailIntensity: 1,
  reducedMotion: false,
  showFPS: false,
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return Object.assign({}, fallback, JSON.parse(raw));
  } catch {
    return { ...fallback };
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new InputTracker();
    this.input.bind(window);
    this._edgeKeys = new Set();

    this.settings = loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
    this.progress = loadJSON(SAVE_KEY, { unlockedLevel: 1, completed: {} });

    this.state = 'title'; // title | levelSelect | howToPlay | settings | playing | paused | roomComplete
    this.previousMenuState = 'title';

    this.accumulator = 0;
    this.transition = null; // { type, t, duration, onDone }
    this.toast = null; // { text, t }
    this.listeners = new Set();

    this.levelDef = null;
    this.recorder = null;
    this.player = null;
    this.echoes = [];
    this.roomRuntime = null;
    this.attemptTick = 0;
    this.roomElapsedTicks = 0;
    this.attemptCount = 0;
    this.hintsShown = new Set();
    this.activeHints = [];
    this.mpPrevRects = {};
    this.particles = [];
    this.camera = { x: 0 };
    this.deathFlashT = 0;
    this.completeStats = null;

    window.addEventListener('keydown', (e) => this._onRawKeyDown(e));
  }

  on(fn) { this.listeners.add(fn); }
  emit(evt) { for (const l of this.listeners) l(evt); }

  saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); }
  saveProgress() { localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress)); }

  _onRawKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  // ---------------------------------------------------------------- flow
  goTitle() { this.state = 'title'; }
  goLevelSelect() { this.state = 'levelSelect'; }
  goHowToPlay() { this.previousMenuState = this.state === 'howToPlay' ? this.previousMenuState : this.state; this.state = 'howToPlay'; }
  goSettings() { this.previousMenuState = this.state === 'settings' ? this.previousMenuState : this.state; this.state = 'settings'; }
  backFromSubmenu() { this.state = this.previousMenuState; }

  pause() { if (this.state === 'playing') { this.state = 'paused'; } }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.accumulator = 0; } }
  quitToLevelSelect() { this.state = 'levelSelect'; }
  quitToTitle() { this.state = 'title'; }

  isLevelUnlocked(id) { return id <= this.progress.unlockedLevel; }

  loadLevel(id) {
    const def = levelById(id);
    if (!def) return;
    this.levelDef = def;
    this.recorder = new Recorder(Math.round(def.recordingTime * TICK_RATE));
    this.hintsShown = new Set();
    this.roomElapsedTicks = 0;
    this.attemptCount = 0;
    this.completeStats = null;
    this.toast = null;
    this.transition = null;
    this.accumulator = 0;
    this._resetAttempt(true);
    this.state = 'playing';
    this._queueHints('enter');
  }

  restartRoom() { this.loadLevel(this.levelDef.id); }

  clearLastEcho() {
    if (!this.recorder.echoes.length) return;
    this.recorder.removeLastEcho();
    this._resetAttempt(false);
  }

  clearAllEchoes() {
    if (!this.recorder.echoes.length) return;
    this.recorder.clearEchoes();
    this._resetAttempt(false);
  }

  // ------------------------------------------------------------- attempt
  _resetAttempt(isFirstLoad) {
    const def = this.levelDef;
    this.recorder.cancel();
    this.attemptTick = 0;
    this.attemptCount++;
    this.player = createPlayerEntity(def.spawn);
    this.roomRuntime = createRoomRuntime(def);
    this.deathFlashT = 0;
    this.camera.x = this._clampCamera(def.spawn.x - this.canvas.width / 2);

    this.echoes = this.recorder.echoes.map((echoDef, idx) => {
      const e = createEchoEntity(def.spawn, idx);
      e.echoDef = echoDef;
      e.trail = [];
      return e;
    });

    this.mpPrevRects = {};
    for (const mp of def.movingPlatforms || []) this.mpPrevRects[mp.id] = movingPlatformRectAt(mp, 0);

    if (!isFirstLoad && this.echoes.length > 0) {
      this._spawnMaterializeBurst(def.spawn);
    }
  }

  _clampCamera(x) {
    const w = this.levelDef.width;
    return Math.max(0, Math.min(x, Math.max(0, w - this.canvas.width)));
  }

  _spawnMaterializeBurst(pos) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.particles.push({
        x: pos.x + 11, y: pos.y + 17, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
        life: 0.5, maxLife: 0.5, color: 'echo',
      });
    }
  }

  _queueHints(showOn) {
    const def = this.levelDef;
    for (const h of def.hints || []) {
      if (h.showOn !== showOn) continue;
      const key = `${showOn}:${h.text}`;
      if (this.hintsShown.has(key)) continue;
      this.hintsShown.add(key);
      this.activeHints.push({ text: h.text, delay: h.delay || 0, t: 0, shown: false, duration: 4 });
    }
  }

  // -------------------------------------------------------------- input actions
  toggleRecording() {
    if (this.state !== 'playing') return;
    const def = this.levelDef;
    if (!this.recorder.isRecording) {
      if (def.maxEchoes === 0) { this._showToast('RECORDING UNAVAILABLE IN THIS ROOM'); return; }
      if (this.recorder.echoes.length >= def.maxEchoes) { this._showToast('MAX ECHOES REACHED — CLEAR ONE FIRST'); return; }
      this.recorder.start();
      this.emit({ type: 'recordStart' });
      this._queueHints('firstRecord');
    } else {
      const echo = this.recorder.stop();
      if (echo) {
        this.emit({ type: 'recordStop' });
        this._beginRewindTransition();
      }
    }
  }

  _showToast(text) { this.toast = { text, t: 0 }; }

  _beginRewindTransition() {
    this.transition = { type: 'rewind', t: 0, duration: 0.5 };
  }

  // ------------------------------------------------------------------ update
  update(dtSeconds) {
    if (this.toast) { this.toast.t += dtSeconds; if (this.toast.t > 2.2) this.toast = null; }
    for (const h of this.activeHints) if (h.shown) h.t += dtSeconds;
    for (const h of this.activeHints) if (!h.shown && h.delay <= 0) h.shown = true; else if (!h.shown) h.delay -= dtSeconds;
    this.activeHints = this.activeHints.filter((h) => !h.shown || h.t < h.duration);

    this._updateParticles(dtSeconds);
    if (this.deathFlashT > 0) this.deathFlashT = Math.max(0, this.deathFlashT - dtSeconds);

    if (this.state !== 'playing') { this.accumulator = 0; return; }

    if (this.transition) {
      this.transition.t += dtSeconds;
      if (this.transition.t >= this.transition.duration) {
        const type = this.transition.type;
        this.transition = null;
        if (type === 'rewind') { this._resetAttempt(false); this._queueHints('firstEcho'); }
      }
      return;
    }

    this.accumulator += dtSeconds;
    let steps = 0;
    while (this.accumulator >= DT && steps < 8 && !this.transition && this.state === 'playing') {
      this._tick();
      this.accumulator -= DT;
      steps++;
    }

    // camera follow (rooms wider than the canvas)
    const targetCamX = this.player.x + this.player.w / 2 - this.canvas.width / 2;
    this.camera.x += (this._clampCamera(targetCamX) - this.camera.x) * Math.min(1, dtSeconds * 6);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  _tick() {
    const def = this.levelDef;
    const tick = this.attemptTick;

    const playerInput = this.input.sampleTick();
    const rPressed = this.input.wasJustPressed('KeyR', this._edgeKeys);
    const qPressed = this.input.wasJustPressed('KeyQ', this._edgeKeys);

    // ---- environment (pure function of tick) ----
    const mpRects = {};
    for (const mp of def.movingPlatforms || []) mpRects[mp.id] = movingPlatformRectAt(mp, tick);

    const solids = [...def.tiles];
    for (const id in mpRects) solids.push(mpRects[id]);
    for (const door of def.doors || []) {
      const r = doorSolidRect(door, this.roomRuntime);
      if (r) solids.push(r);
    }
    for (const cf of def.crumblingFloors || []) {
      if (!this.roomRuntime.crumbling[cf.id].broken) solids.push(cf);
    }
    // level boundary walls keep everything inside the readable camera area
    solids.push({ x: -40, y: -1000, w: 40, h: def.height + 2000 });
    solids.push({ x: def.width, y: -1000, w: 40, h: def.height + 2000 });

    const entities = [this.player, ...this.echoes];
    const inputsThisTick = new Map();
    inputsThisTick.set(this.player, playerInput);

    // carry entities riding moving platforms, then step physics
    for (const ent of entities) {
      if (ent.standingOn && this.mpPrevRects[ent.standingOn] && mpRects[ent.standingOn]) {
        const prev = this.mpPrevRects[ent.standingOn];
        const cur = mpRects[ent.standingOn];
        ent.x += cur.x - prev.x;
        ent.y += cur.y - prev.y;
      }
    }
    stepEntity(this.player, playerInput, solids);
    for (const echo of this.echoes) {
      const input = echoInputAt(echo.echoDef, tick);
      inputsThisTick.set(echo, input);
      stepEntity(echo, input, solids);
      if (tick % 2 === 0) {
        echo.trail.push({ x: echo.x + echo.w / 2, y: echo.y + echo.h });
        if (echo.trail.length > 10) echo.trail.shift();
      }
    }
    this.mpPrevRects = mpRects;

    // ---- hazards (evaluated against PRE-update trigger state, matches door timing) ----
    let died = false;
    for (const ent of entities) {
      if (ent.y > def.height + 120) died = true;
      for (const s of def.hazards || []) if (aabbOverlap(ent, s)) died = true;
      for (const l of def.lasers || []) {
        if (laserActiveAt(l, tick, this.roomRuntime) && aabbOverlap(ent, l)) died = true;
      }
    }

    // ---- evaluate triggers for next tick's world state ----
    const events = [];
    evaluateTriggers(def, this.roomRuntime, entities, inputsThisTick, tick, events);
    if (events.length) this.emit({ type: 'objectEvents', events });

    // ---- exit check ----
    if (aabbOverlap(this.player, def.exit)) {
      this._completeRoom();
      return;
    }

    if (died) {
      this.emit({ type: 'death' });
      this.deathFlashT = 0.3;
      this._resetAttempt(false);
      return;
    }

    // ---- recording capture / expiry ----
    if (this.recorder.isRecording) {
      const capped = this.recorder.captureTick(playerInput);
      if (capped) {
        this.recorder.cancel();
        this.emit({ type: 'recordExpired' });
        this._showToast('RECORDING EXPIRED');
        this._resetAttempt(false);
        return;
      }
    }

    if (rPressed) this.toggleRecording();
    if (qPressed) { this.emit({ type: 'manualReset' }); this._resetAttempt(false); return; }

    this.attemptTick++;
    this.roomElapsedTicks++;
  }

  _completeRoom() {
    const def = this.levelDef;
    const timeSec = this.roomElapsedTicks / TICK_RATE;
    const echoesUsed = this.recorder.echoes.length;
    const recordingSec = this.recorder.echoes.reduce((s, e) => s + e.inputs.length, 0) / TICK_RATE;

    const prev = this.progress.completed[def.id];
    const best = prev ? Math.min(prev.bestTimeSec, timeSec) : timeSec;
    this.progress.completed[def.id] = { bestTimeSec: best, bestEchoes: prev ? Math.min(prev.bestEchoes, echoesUsed) : echoesUsed };
    this.progress.unlockedLevel = Math.max(this.progress.unlockedLevel, Math.min(def.id + 1, LEVELS.length));
    this.saveProgress();

    this.completeStats = {
      timeSec, echoesUsed, recordingSec,
      isBest: !prev || timeSec <= prev.bestTimeSec,
      mastered: def.parEchoes != null && echoesUsed <= def.parEchoes,
      isLast: def.id >= LEVELS.length,
      nextId: def.id + 1,
    };
    this.emit({ type: 'roomComplete' });
    this.state = 'roomComplete';
  }

  nextLevel() {
    const nextId = this.completeStats?.nextId;
    if (nextId && nextId <= LEVELS.length) this.loadLevel(nextId);
    else this.state = 'levelSelect';
  }
}
