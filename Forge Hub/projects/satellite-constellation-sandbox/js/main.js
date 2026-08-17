// ============================================================
// main.js — application state, simulation loop, and public App API
// consumed by ui.js and presets.js
// ============================================================
const App = {
  state: {
    satellites: [],
    groundStations: [],
    selectedSatId: null,
    selectedGsId: null,
    viewMode: 'orbit',
    toggles: {
      grid: false, atmosphere: true, coverage: true, orbits: true,
      labels: false, groundTracks: false, satLinks: false, sunlight: false
    },
    trailSetting: 'off',
    simElapsedSec: 0,
    simSpeed: 100,
    playing: true,
    satLinkRangeKm: 8000,
    sunDirWorld: { x: 0.86, y: 0.35, z: 0.28 }
  },

  coverageStats: Coverage.result,
  startEpochMs: Date.now(),
  _lastFrameMs: null,
  _fps: 60,
  _fpsSmooth: 60,
  _lastTrailPush: 0,
  compareSnapshots: { A: null, B: null },

  // ---------------- lifecycle ----------------
  init() {
    Renderer.init(document.getElementById('mainCanvas'));
    UI.init(this);
    Coverage.buildGrid();
    this._seedDefault();
    requestAnimationFrame((t) => this._loop(t));
  },

  _seedDefault() {
    const c = Constellation.build({
      name: 'DEMO', count: 18, planes: 4, altitude: 900,
      inclination: 55, coverageAngle: 10, phaseOffsetDeg: 12, colorIndex: 0
    });
    this.addConstellation(c);
  },

  // ---------------- satellite / constellation management ----------------
  addConstellation(c) {
    for (const s of c.sats) this.state.satellites.push(s);
    UI.refreshAll();
  },

  addSingleSatellite(sat) {
    this.state.satellites.push(sat);
    UI.refreshAll();
  },

  removeSatellite(id) {
    const idx = this.state.satellites.findIndex(s => s.id === id);
    if (idx >= 0) this.state.satellites.splice(idx, 1);
    if (this.state.selectedSatId === id) this.state.selectedSatId = null;
    UI.refreshAll();
  },

  removeConstellation(constellationId) {
    this.state.satellites = this.state.satellites.filter(s => s.constellationId !== constellationId);
    if (this.state.selectedSatId) {
      const stillExists = this.state.satellites.some(s => s.id === this.state.selectedSatId);
      if (!stillExists) this.state.selectedSatId = null;
    }
    UI.refreshAll();
  },

  clearSatellites() {
    this.state.satellites = [];
    this.state.selectedSatId = null;
    UI.refreshAll();
  },

  selectSatellite(id) {
    this.state.selectedSatId = id;
    UI.refreshInspector();
    UI.refreshSatList();
  },

  // ---------------- ground stations ----------------
  addGroundStation(gs) {
    this.state.groundStations.push(gs);
    UI.refreshGsList();
  },

  removeGroundStation(id) {
    this.state.groundStations = this.state.groundStations.filter(g => g.id !== id);
    UI.refreshGsList();
  },

  clearGroundStations() {
    this.state.groundStations = [];
    UI.refreshGsList();
  },

  // ---------------- toggles / view ----------------
  setToggle(name, val) {
    this.state.toggles[name] = val;
    UI.syncToggleUI();
  },

  setViewMode(mode) { this.state.viewMode = mode; },

  setTrail(mode) {
    this.state.trailSetting = mode;
    if (mode === 'off') for (const s of this.state.satellites) s.clearTrail();
  },

  setSpeed(x) {
    this.state.simSpeed = x;
    UI.syncSpeedUI();
  },

  togglePlay(force) {
    this.state.playing = (force !== undefined) ? force : !this.state.playing;
    UI.syncPlayUI();
  },

  resetTime() {
    this.state.simElapsedSec = 0;
    this.startEpochMs = Date.now();
    for (const s of this.state.satellites) s.clearTrail();
    for (const g of this.state.groundStations) { g.history = []; g.connectionStartSimSec = null; g.lastLinkedSimSec = null; g.timeSinceCoverageSec = 0; }
  },

  stepForward() {
    this._advance(300); // jump 5 simulated minutes
  },

  // ---------------- simulation loop ----------------
  _loop(nowMs) {
    if (this._lastFrameMs == null) this._lastFrameMs = nowMs;
    const dtMs = Math.min(250, nowMs - this._lastFrameMs);
    this._lastFrameMs = nowMs;

    const instFps = dtMs > 0 ? 1000 / dtMs : 60;
    this._fpsSmooth += (instFps - this._fpsSmooth) * 0.08;
    this._fps = Math.round(this._fpsSmooth);

    if (this.state.playing) {
      const dtSimSec = (dtMs / 1000) * this.state.simSpeed;
      this._advance(dtSimSec);
    } else {
      this._updateDerived(nowMs);
    }

    Renderer.render(this.state);
    UI.updateFrame(nowMs);

    requestAnimationFrame((t) => this._loop(t));
  },

  _advance(dtSimSec) {
    this.state.simElapsedSec += dtSimSec;
    this._updateDerived(performance.now(), dtSimSec);
  },

  _updateDerived(nowMs, dtSimSec) {
    const t = this.state.simElapsedSec;

    // sun direction rotated into the (Earth-fixed) world frame for terminator shading
    const phi = Orbit.earthRotationAngle(t);
    const cosP = Math.cos(phi), sinP = Math.sin(phi);
    const se = { x: 0.86, y: 0.35, z: 0.28 };
    const mag = Math.hypot(se.x, se.y, se.z);
    se.x /= mag; se.y /= mag; se.z /= mag;
    this.state.sunDirWorld = { x: se.x * cosP + se.y * sinP, y: -se.x * sinP + se.y * cosP, z: se.z };

    for (const sat of this.state.satellites) {
      sat.update(t);
      if (this.state.toggles.sunlight) {
        const w = sat.state.world;
        const m = Math.hypot(w.x, w.y, w.z) || 1;
        const dot = (w.x * se.x + w.y * se.y + w.z * se.z) / m; // in ECI-equivalent terms via eci vector instead
        // use ECI position vs fixed ECI sun dir for a frame-consistent eclipse test
        const eci = sat.state.eci;
        const em = Math.hypot(eci.x, eci.y, eci.z) || 1;
        const ndot = (eci.x * se.x + eci.y * se.y + eci.z * se.z) / em;
        if (ndot > 0) {
          sat.sunlit = true;
        } else {
          // behind Earth relative to sun: check perpendicular distance to sun line vs Earth radius
          const perpX = eci.x - ndot * em * se.x;
          const perpY = eci.y - ndot * em * se.y;
          const perpZ = eci.z - ndot * em * se.z;
          const perpDist = Math.hypot(perpX, perpY, perpZ);
          sat.sunlit = perpDist > CONST.EARTH_RADIUS_KM;
        }
      } else {
        sat.sunlit = true;
      }
    }

    // trails: push at a throttled cadence so memory/CPU stay bounded
    const maxLen = CONST.TRAIL_LENGTHS[this.state.trailSetting] || 0;
    if (maxLen && nowMs - this._lastTrailPush > 400) {
      this._lastTrailPush = nowMs;
      for (const sat of this.state.satellites) sat.pushTrail(maxLen);
    }

    // ground stations — throttled inside via real-time interval
    if (!this._lastGsUpdate || nowMs - this._lastGsUpdate > CONST.GS_UPDATE_MS) {
      this._lastGsUpdate = nowMs;
      for (const gs of this.state.groundStations) {
        const evt = GroundStations.update(gs, this.state.satellites, t);
        if (evt === 'connected') UI.showPassToast(`${gs.name} — CONNECTED to ${gs.bestSatName}`);
        else if (evt === 'lost') UI.showPassToast(`${gs.name} — NO LINK`, true);
      }
    }

    // global coverage sampling — throttled
    if (Coverage.maybeUpdate(this.state, nowMs)) {
      this.coverageStats = Coverage.result;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
