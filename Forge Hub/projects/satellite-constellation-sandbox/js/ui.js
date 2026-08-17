// ============================================================
// ui.js — DOM wiring: panels, forms, inspector, lists, overlays
// ============================================================
const UI = {
  App: null,
  el: {},

  init(App) {
    this.App = App;
    this._cache();
    this._wirePanelTabs();
    this._wireMobilePanels();
    this._wireCreateMode();
    this._wireSingleForm();
    this._wireConstellationForm();
    this._wirePresetChips();
    this._wirePresetLists();
    this._wireDisplayToggles();
    this._wireTrailSeg();
    this._wireViewModes();
    this._wireCamera();
    this._wireTimeControls();
    this._wireInspector();
    this._wireGroundStations();
    this._wireCompare();
    this._wireChallenges();
    this._wireCanvasSelection();

    this.refreshAll();
    this._updateSingleReadout();
    this._updateConstReadout();
  },

  _cache() {
    const ids = [
      'leftPanel','rightPanel','btnPanelsToggle','btnPanelsToggleRight','mobileBackdrop',
      'createModeSeg','singleName','singleAlt','singleAltVal','singleInc','singleIncVal',
      'singlePhase','singlePhaseVal','singleCov','singleCovVal','singlePeriodReadout','btnCreateSingle',
      'altPresetChips','incPresetChips',
      'constName','constCount','constCountVal','constPlanes','constPlanesVal','constAlt','constAltVal',
      'constInc','constIncVal','constPhase','constPhaseVal','constCov','constCovVal','constSummaryReadout',
      'btnCreateConstellation','constAltPresetChips','constIncPresetChips','btnClearAll',
      'constellationPresetList','demoList',
      'toggleGrid','toggleAtmosphere','toggleCoverage','toggleOrbits','toggleLabels',
      'toggleGroundTracks','toggleSatLinks','toggleSunlight','trailSeg',
      'viewModes','camReset','camEarth','camSat','camZoomIn','camZoomOut',
      'timePlayPause','timeStep','timeReset','speedGroup','clockUtc','clockElapsed',
      'statTotal','statActive','statPlanes','statAvgAlt','statAvgPeriod','statCoverage',
      'statOverlap','statAvgVisible','statMaxVisible','statGsLinked','statSpeed','statFps',
      'inspectorEmpty','inspectorContent','inspName','inspConst','inspActive','inspLat','inspLon',
      'inspSpeed','inspPeriod','inspSunlit','inspLinks','inspAlt','inspAltVal','inspInc','inspIncVal',
      'inspCov','inspCovVal','inspGroundTrack','btnDeleteSat','satList','satListCount',
      'gsName','gsLat','gsLatVal','gsLon','gsLonVal','gsElev','gsElevVal','btnAddGs','gsPresetChips',
      'gsList','gsListCount',
      'toggleCompare','comparePanel','compareA','compareB','btnSnapA','btnSnapB','challengeList',
      'passToast','mainCanvas','viewHint'
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
  },

  // ---------------- generic helpers ----------------
  _wireRange(input, labelEl, fmt, onChange) {
    const sync = () => {
      const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
      const pct = ((val - min) / (max - min)) * 100;
      input.style.setProperty('--fill', pct + '%');
      if (labelEl) labelEl.textContent = fmt(val);
    };
    input.addEventListener('input', () => { sync(); onChange && onChange(parseFloat(input.value)); });
    sync();
    return sync;
  },

  _populateChips(container, presets, unit, onPick) {
    container.innerHTML = '';
    presets.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = p.label;
      chip.addEventListener('click', () => onPick(p.value));
      container.appendChild(chip);
    });
  },

  // ---------------- panel tabs (left/right) ----------------
  _wirePanelTabs() {
    document.querySelectorAll('.side-panel').forEach(panel => {
      const tabs = panel.querySelectorAll('.ptab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          panel.querySelectorAll('.ptab-panel').forEach(p => {
            p.classList.toggle('active', p.dataset.panel === tab.dataset.tab);
          });
        });
      });
    });
  },

  _wireMobilePanels() {
    const open = (panel) => { panel.classList.add('open'); this.el.mobileBackdrop.classList.add('show'); };
    const closeAll = () => {
      this.el.leftPanel.classList.remove('open');
      this.el.rightPanel.classList.remove('open');
      this.el.mobileBackdrop.classList.remove('show');
    };
    this.el.btnPanelsToggle.addEventListener('click', () => {
      this.el.leftPanel.classList.contains('open') ? closeAll() : (closeAll(), open(this.el.leftPanel));
    });
    this.el.btnPanelsToggleRight.addEventListener('click', () => {
      this.el.rightPanel.classList.contains('open') ? closeAll() : (closeAll(), open(this.el.rightPanel));
    });
    this.el.mobileBackdrop.addEventListener('click', closeAll);
    this._closeMobilePanels = closeAll;
  },

  // ---------------- BUILD: mode segment ----------------
  _wireCreateMode() {
    const buttons = this.el.createModeSeg.querySelectorAll('.seg-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.build-mode').forEach(panel => {
          panel.classList.toggle('active', panel.dataset.modePanel === btn.dataset.mode);
        });
      });
    });
  },

  // ---------------- BUILD: single satellite ----------------
  _wireSingleForm() {
    const e = this.el;
    this._wireRange(e.singleAlt, e.singleAltVal, v => Math.round(v) + ' km', () => this._updateSingleReadout());
    this._wireRange(e.singleInc, e.singleIncVal, v => Math.round(v) + '°', () => this._updateSingleReadout());
    this._wireRange(e.singlePhase, e.singlePhaseVal, v => Math.round(v) + '°');
    this._wireRange(e.singleCov, e.singleCovVal, v => Math.round(v) + '°');

    e.btnCreateSingle.addEventListener('click', () => {
      const sat = new Satellite({
        name: e.singleName.value.trim() || undefined,
        altitude: parseFloat(e.singleAlt.value),
        inclination: parseFloat(e.singleInc.value),
        phase: parseFloat(e.singlePhase.value),
        coverageAngle: parseFloat(e.singleCov.value),
        color: CONST.COLORS_BY_CONSTELLATION[this.App.state.satellites.length % CONST.COLORS_BY_CONSTELLATION.length]
      });
      this.App.addSingleSatellite(sat);
      this.App.selectSatellite(sat.id);
      e.singleName.value = '';
    });
  },

  _updateSingleReadout() {
    const alt = parseFloat(this.el.singleAlt.value);
    const T = Orbit.periodSec(alt);
    this.el.singlePeriodReadout.innerHTML = `Orbital period: <strong>${Orbit.formatDuration(T)}</strong> &nbsp;·&nbsp; Speed: <strong>${Orbit.speedKmS(alt).toFixed(2)} km/s</strong>`;
  },

  // ---------------- BUILD: constellation ----------------
  _wireConstellationForm() {
    const e = this.el;
    this._wireRange(e.constCount, e.constCountVal, v => Math.round(v), () => this._updateConstReadout());
    this._wireRange(e.constPlanes, e.constPlanesVal, v => Math.round(v), () => this._updateConstReadout());
    this._wireRange(e.constAlt, e.constAltVal, v => Math.round(v) + ' km', () => this._updateConstReadout());
    this._wireRange(e.constInc, e.constIncVal, v => Math.round(v) + '°');
    this._wireRange(e.constPhase, e.constPhaseVal, v => Math.round(v) + '°');
    this._wireRange(e.constCov, e.constCovVal, v => Math.round(v) + '°');

    e.btnCreateConstellation.addEventListener('click', () => {
      const c = Constellation.build({
        name: e.constName.value.trim() || 'CONST',
        count: parseInt(e.constCount.value, 10),
        planes: parseInt(e.constPlanes.value, 10),
        altitude: parseFloat(e.constAlt.value),
        inclination: parseFloat(e.constInc.value),
        coverageAngle: parseFloat(e.constCov.value),
        phaseOffsetDeg: parseFloat(e.constPhase.value),
        colorIndex: this.App.state.satellites.length
      });
      this.App.addConstellation(c);
      e.constName.value = '';
    });

    e.btnClearAll.addEventListener('click', () => this.App.clearSatellites());
  },

  _updateConstReadout() {
    const count = parseInt(this.el.constCount.value, 10);
    const planes = Math.max(1, Math.min(parseInt(this.el.constPlanes.value, 10), count));
    const perPlane = Math.ceil(count / planes);
    const alt = parseFloat(this.el.constAlt.value);
    const T = Orbit.periodSec(alt);
    this.el.constSummaryReadout.innerHTML = `≈ <strong>${perPlane}</strong> satellites / plane across <strong>${planes}</strong> planes &nbsp;·&nbsp; Period: <strong>${Orbit.formatDuration(T)}</strong>`;
  },

  _wirePresetChips() {
    this._populateChips(this.el.altPresetChips, ALT_PRESETS, 'km', v => {
      this.el.singleAlt.value = v; this.el.singleAlt.dispatchEvent(new Event('input'));
    });
    this._populateChips(this.el.incPresetChips, INC_PRESETS, '°', v => {
      this.el.singleInc.value = v; this.el.singleInc.dispatchEvent(new Event('input'));
    });
    this._populateChips(this.el.constAltPresetChips, ALT_PRESETS, 'km', v => {
      this.el.constAlt.value = v; this.el.constAlt.dispatchEvent(new Event('input'));
    });
    this._populateChips(this.el.constIncPresetChips, INC_PRESETS, '°', v => {
      this.el.constInc.value = v; this.el.constInc.dispatchEvent(new Event('input'));
    });
    this._populateChips(this.el.gsPresetChips, GS_PRESETS.map(p => ({ label: p.label, value: p })), '', p => {
      this.el.gsName.value = p.label;
      this.el.gsLat.value = p.lat; this.el.gsLat.dispatchEvent(new Event('input'));
      this.el.gsLon.value = p.lon; this.el.gsLon.dispatchEvent(new Event('input'));
    });
  },

  // ---------------- PRESETS / DEMOS lists ----------------
  _wirePresetLists() {
    CONSTELLATION_PRESETS.forEach(p => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `<div class="pc-title">${p.title}</div><div class="pc-desc">${p.desc}</div>`;
      card.addEventListener('click', () => p.apply(this.App));
      this.el.constellationPresetList.appendChild(card);
    });
    DEMOS.forEach(d => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `<div class="pc-title">${d.title}</div><div class="pc-desc">${d.desc}</div>`;
      card.addEventListener('click', () => d.apply(this.App));
      this.el.demoList.appendChild(card);
    });
  },

  // ---------------- overlay toggles ----------------
  _wireDisplayToggles() {
    const map = {
      toggleGrid: 'grid', toggleAtmosphere: 'atmosphere', toggleCoverage: 'coverage',
      toggleOrbits: 'orbits', toggleLabels: 'labels', toggleGroundTracks: 'groundTracks',
      toggleSatLinks: 'satLinks', toggleSunlight: 'sunlight'
    };
    Object.keys(map).forEach(id => {
      this.el[id].addEventListener('change', () => this.App.setToggle(map[id], this.el[id].checked));
    });
    this.syncToggleUI();
  },

  syncToggleUI() {
    const t = this.App.state.toggles;
    this.el.toggleGrid.checked = t.grid;
    this.el.toggleAtmosphere.checked = t.atmosphere;
    this.el.toggleCoverage.checked = t.coverage;
    this.el.toggleOrbits.checked = t.orbits;
    this.el.toggleLabels.checked = t.labels;
    this.el.toggleGroundTracks.checked = t.groundTracks;
    this.el.toggleSatLinks.checked = t.satLinks;
    this.el.toggleSunlight.checked = t.sunlight;
  },

  _wireTrailSeg() {
    const buttons = this.el.trailSeg.querySelectorAll('.seg-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.App.setTrail(btn.dataset.trail);
      });
    });
  },

  _wireViewModes() {
    const buttons = this.el.viewModes.querySelectorAll('.view-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.App.setViewMode(btn.dataset.view);
        const hints = {
          orbit: 'Drag to orbit · Scroll to zoom · Click a satellite to inspect',
          coverage: 'Coverage footprints emphasized · toggle layers top-left',
          groundtrack: 'Ground tracks emphasized · enable per-satellite in Inspector',
          network: 'Satellite-to-satellite links emphasized'
        };
        this.el.viewHint.textContent = hints[btn.dataset.view] || '';
      });
    });
  },

  // ---------------- camera ----------------
  _wireCamera() {
    this.el.camReset.addEventListener('click', () => Renderer.resetCamera());
    this.el.camEarth.addEventListener('click', () => Renderer.focusEarth());
    this.el.camSat.addEventListener('click', () => {
      const sat = this.App.state.satellites.find(s => s.id === this.App.state.selectedSatId);
      if (sat) Renderer.focusSatellite(sat);
    });
    this.el.camZoomIn.addEventListener('click', () => Renderer.zoomBy(1.25));
    this.el.camZoomOut.addEventListener('click', () => Renderer.zoomBy(0.8));
  },

  // ---------------- time controls ----------------
  _wireTimeControls() {
    this.el.timePlayPause.addEventListener('click', () => {
      this.App.togglePlay();
    });
    this.el.timeStep.addEventListener('click', () => this.App.stepForward());
    this.el.timeReset.addEventListener('click', () => this.App.resetTime());
    this.el.speedGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => this.App.setSpeed(parseFloat(btn.dataset.speed)));
    });
    this.syncPlayUI();
    this.syncSpeedUI();
  },

  syncPlayUI() {
    this.el.timePlayPause.textContent = this.App.state.playing ? '⏸' : '▶';
  },

  syncSpeedUI() {
    this.el.speedGroup.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === this.App.state.simSpeed);
    });
  },

  // ---------------- inspector ----------------
  _wireInspector() {
    const e = this.el;
    e.inspName.addEventListener('change', () => {
      const sat = this._selectedSat();
      if (sat) { sat.name = e.inspName.value.trim() || sat.name; this.refreshSatList(); }
    });
    e.inspActive.addEventListener('change', () => {
      const sat = this._selectedSat();
      if (sat) sat.active = e.inspActive.checked;
      this.refreshSatList();
    });
    this._wireRange(e.inspAlt, e.inspAltVal, v => Math.round(v) + ' km', v => {
      const sat = this._selectedSat();
      if (sat) { sat.altitude = v; sat.clearTrail(); }
    });
    this._wireRange(e.inspInc, e.inspIncVal, v => Math.round(v) + '°', v => {
      const sat = this._selectedSat();
      if (sat) { sat.inclination = v; sat.clearTrail(); }
    });
    this._wireRange(e.inspCov, e.inspCovVal, v => Math.round(v) + '°', v => {
      const sat = this._selectedSat();
      if (sat) sat.coverageAngle = v;
    });
    e.inspGroundTrack.addEventListener('change', () => {
      const sat = this._selectedSat();
      if (sat) sat.showGroundTrack = e.inspGroundTrack.checked;
    });
    e.btnDeleteSat.addEventListener('click', () => {
      const sat = this._selectedSat();
      if (sat) this.App.removeSatellite(sat.id);
    });
  },

  _selectedSat() {
    return this.App.state.satellites.find(s => s.id === this.App.state.selectedSatId) || null;
  },

  refreshInspector() {
    const sat = this._selectedSat();
    const e = this.el;
    if (!sat) {
      e.inspectorEmpty.classList.remove('hidden');
      e.inspectorContent.classList.add('hidden');
      return;
    }
    e.inspectorEmpty.classList.add('hidden');
    e.inspectorContent.classList.remove('hidden');

    if (document.activeElement !== e.inspName) e.inspName.value = sat.name;
    e.inspConst.textContent = sat.constellationName || 'Standalone';
    e.inspActive.checked = sat.active;

    e.inspAlt.value = sat.altitude; e.inspAlt.dispatchEvent(new Event('input'));
    e.inspInc.value = sat.inclination; e.inspInc.dispatchEvent(new Event('input'));
    e.inspCov.value = sat.coverageAngle; e.inspCov.dispatchEvent(new Event('input'));
    e.inspGroundTrack.checked = sat.showGroundTrack;

    this._refreshInspectorLive();
  },

  _refreshInspectorLive() {
    const sat = this._selectedSat();
    if (!sat || !sat.state) return;
    const e = this.el;
    e.inspLat.textContent = sat.state.lat.toFixed(2) + '°';
    e.inspLon.textContent = sat.state.lon.toFixed(2) + '°';
    e.inspSpeed.textContent = sat.speed.toFixed(2) + ' km/s';
    e.inspPeriod.textContent = Orbit.formatDuration(sat.period);
    e.inspSunlit.textContent = this.App.state.toggles.sunlight ? (sat.sunlit ? 'SUNLIT' : 'ECLIPSED') : '—';

    const linkRange = this.App.state.satLinkRangeKm;
    let links = 0;
    if (sat.state) {
      for (const other of this.App.state.satellites) {
        if (other.id === sat.id || !other.active || !other.state) continue;
        const d = Math.hypot(sat.state.world.x - other.state.world.x, sat.state.world.y - other.state.world.y, sat.state.world.z - other.state.world.z);
        if (d <= linkRange) links++;
      }
    }
    e.inspLinks.textContent = links;
  },

  // ---------------- satellite list ----------------
  refreshSatList() {
    const wrap = this.el.satList;
    wrap.innerHTML = '';
    const sats = this.App.state.satellites;
    this.el.satListCount.textContent = `(${sats.length})`;

    const groups = new Map();
    const singles = [];
    for (const s of sats) {
      if (s.constellationId) {
        if (!groups.has(s.constellationId)) groups.set(s.constellationId, []);
        groups.get(s.constellationId).push(s);
      } else singles.push(s);
    }

    groups.forEach((list, cid) => {
      const header = document.createElement('div');
      header.className = 'sat-row';
      header.style.background = 'rgba(255,255,255,0.04)';
      header.innerHTML = `<span class="srn">▾ ${list[0].constellationName || 'CONSTELLATION'} <span class="srm">(${list.length})</span></span>`;
      const delBtn = document.createElement('button');
      delBtn.className = 'gs-remove'; delBtn.textContent = '✕'; delBtn.title = 'Delete constellation';
      delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this.App.removeConstellation(cid); });
      header.appendChild(delBtn);
      wrap.appendChild(header);
      list.forEach(s => wrap.appendChild(this._satRow(s)));
    });
    singles.forEach(s => wrap.appendChild(this._satRow(s)));
  },

  _satRow(sat) {
    const row = document.createElement('div');
    row.className = 'sat-row' + (sat.id === this.App.state.selectedSatId ? ' selected' : '');
    row.style.opacity = sat.active ? '1' : '0.5';
    row.innerHTML = `<span class="srn"><span class="sat-dot" style="background:${sat.color};color:${sat.color}"></span> ${sat.name}</span><span class="srm">${Math.round(sat.altitude)} km</span>`;
    row.addEventListener('click', () => this.App.selectSatellite(sat.id));
    return row;
  },

  // ---------------- ground stations ----------------
  _wireGroundStations() {
    const e = this.el;
    this._wireRange(e.gsLat, e.gsLatVal, v => Math.round(v) + '°');
    this._wireRange(e.gsLon, e.gsLonVal, v => Math.round(v) + '°');
    this._wireRange(e.gsElev, e.gsElevVal, v => Math.round(v) + '°');
    e.btnAddGs.addEventListener('click', () => {
      const gs = new GroundStation({
        name: e.gsName.value.trim() || undefined,
        lat: parseFloat(e.gsLat.value),
        lon: parseFloat(e.gsLon.value),
        minElevation: parseFloat(e.gsElev.value)
      });
      this.App.addGroundStation(gs);
      e.gsName.value = '';
    });
  },

  refreshGsList() {
    const wrap = this.el.gsList;
    wrap.innerHTML = '';
    const list = this.App.state.groundStations;
    this.el.gsListCount.textContent = `(${list.length})`;
    list.forEach(gs => {
      const card = document.createElement('div');
      card.className = 'gs-card';
      card.innerHTML = `
        <div class="gs-card-head">
          <b>${gs.name}</b>
          <span class="gs-status ${gs.linked ? 'linked' : 'nolink'}">${gs.linked ? 'CONNECTED' : 'NO LINK'}</span>
        </div>
        <div class="gs-card-body">
          <div>Position: <b>${gs.lat.toFixed(1)}°, ${gs.lon.toFixed(1)}°</b> · Min Elev: <b>${gs.minElevation}°</b></div>
          <div>Visible Sats: <b>${gs.visibleCount}</b> · Best: <b>${gs.bestSatName || '—'}</b></div>
          <div>Link Duration: <b>${Orbit.formatDuration(gs.connectionDurationSec)}</b></div>
          <div>Since Last Coverage: <b>${gs.timeSinceCoverageSec ? Orbit.formatDuration(gs.timeSinceCoverageSec) : '—'}</b></div>
          <div>Availability: <b>${gs.availabilityPct.toFixed(0)}%</b></div>
        </div>
      `;
      const rm = document.createElement('button');
      rm.className = 'gs-remove'; rm.textContent = '✕ REMOVE'; rm.style.marginTop = '6px'; rm.style.fontSize = '10px';
      rm.addEventListener('click', () => this.App.removeGroundStation(gs.id));
      card.appendChild(rm);
      wrap.appendChild(card);
    });
  },

  // ---------------- compare mode ----------------
  _wireCompare() {
    this.el.toggleCompare.addEventListener('change', () => {
      this.el.comparePanel.classList.toggle('hidden', !this.el.toggleCompare.checked);
    });
    this.el.btnSnapA.addEventListener('click', () => this._snapshotCompare('A'));
    this.el.btnSnapB.addEventListener('click', () => this._snapshotCompare('B'));
  },

  _snapshotCompare(key) {
    const sats = this.App.state.satellites.filter(s => s.active);
    const n = sats.length;
    const avgAlt = n ? sats.reduce((a, s) => a + s.altitude, 0) / n : 0;
    const avgPeriod = n ? sats.reduce((a, s) => a + s.period, 0) / n : 0;
    const planes = new Set(sats.map(s => Math.round((s.raan || 0) / 3))).size;
    const text =
`Satellites: ${n}
Planes: ${planes}
Avg Altitude: ${Math.round(avgAlt)} km
Avg Period: ${Orbit.formatDuration(avgPeriod)}
Coverage: ${this.App.coverageStats.coveragePct.toFixed(1)}%
Overlap: ${this.App.coverageStats.overlapPct.toFixed(1)}%
Avg Visible: ${this.App.coverageStats.avgVisible.toFixed(2)}`;
    this.App.compareSnapshots[key] = text;
    this.el['compare' + key].textContent = text;
  },

  // ---------------- challenges ----------------
  _wireChallenges() {
    this.el.challengeList.innerHTML = '';
    this._challengeCards = {};
    CHALLENGES.forEach(c => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `<div class="pc-title">${c.title}</div><div class="pc-desc">${c.desc}</div><div class="pc-desc" style="margin-top:5px;"></div>`;
      this.el.challengeList.appendChild(card);
      this._challengeCards[c.id] = card;
    });
  },

  _refreshChallenges() {
    if (!this._challengeCards) return;
    CHALLENGES.forEach(c => {
      const card = this._challengeCards[c.id];
      if (!card) return;
      const res = c.check(this.App);
      const statusEl = card.children[2];
      statusEl.textContent = (res.pass ? '✔ ACHIEVED — ' : '') + res.detail;
      statusEl.style.color = res.pass ? 'var(--accent-green)' : 'var(--text-dim)';
      card.style.borderColor = res.pass ? 'var(--accent-green)' : '';
    });
  },

  // ---------------- canvas selection ----------------
  _wireCanvasSelection() {
    const canvas = this.el.mainCanvas;
    canvas.addEventListener('pointerup', (e) => {
      if (Renderer.dragMoved) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const hit = Renderer.hitTestSatellite(this.App.state, sx, sy);
      if (hit) {
        this.App.selectSatellite(hit.id);
        if (window.innerWidth <= 880) {
          this.el.leftPanel.classList.remove('open');
          this.el.rightPanel.classList.add('open');
          this.el.mobileBackdrop.classList.add('show');
          document.querySelector('#rightPanel .ptab[data-tab="inspector"]').click();
        }
      }
    });
  },

  // ---------------- toasts ----------------
  _toastTimer: null,
  showPassToast(msg, isWarn) {
    const t = this.el.passToast;
    t.textContent = msg;
    t.style.borderColor = isWarn ? 'var(--accent-red)' : 'var(--accent-teal)';
    t.style.color = isWarn ? '#ff8f8f' : 'var(--accent-teal)';
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  },

  // ---------------- periodic frame updates ----------------
  _lastStatsUpdate: 0,
  updateFrame(nowMs) {
    if (nowMs - this._lastStatsUpdate < CONST.STATS_UPDATE_MS) return;
    this._lastStatsUpdate = nowMs;

    this._refreshInspectorLive();
    this._updateStats();
    this._updateClock();
    this.refreshGsList();
    this._refreshChallenges();
  },

  _updateStats() {
    const e = this.el;
    const sats = this.App.state.satellites;
    const active = sats.filter(s => s.active);
    const n = active.length;
    const avgAlt = n ? active.reduce((a, s) => a + s.altitude, 0) / n : 0;
    const avgPeriod = n ? active.reduce((a, s) => a + s.period, 0) / n : 0;
    const planes = new Set(active.map(s => Math.round((s.raan || 0) / 3))).size;
    const cov = this.App.coverageStats;
    const gsLinked = this.App.state.groundStations.filter(g => g.linked).length;

    e.statTotal.textContent = sats.length;
    e.statActive.textContent = n;
    e.statPlanes.textContent = planes;
    e.statAvgAlt.textContent = n ? Math.round(avgAlt) + ' km' : '—';
    e.statAvgPeriod.textContent = n ? Orbit.formatDuration(avgPeriod) : '—';
    e.statCoverage.textContent = cov.coveragePct.toFixed(1) + '%';
    e.statOverlap.textContent = cov.overlapPct.toFixed(1) + '%';
    e.statAvgVisible.textContent = cov.avgVisible.toFixed(2);
    e.statMaxVisible.textContent = cov.maxVisible;
    e.statGsLinked.textContent = `${gsLinked}/${this.App.state.groundStations.length}`;
    e.statSpeed.textContent = this.App.state.simSpeed + '×';
    e.statFps.textContent = this.App._fps;
  },

  _updateClock() {
    const t = this.App.state.simElapsedSec;
    const utcMs = this.App.startEpochMs + t * 1000;
    const d = new Date(utcMs);
    this.el.clockUtc.textContent = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    this.el.clockElapsed.textContent = this._formatElapsed(t);
  },

  _formatElapsed(sec) {
    sec = Math.floor(sec);
    const days = Math.floor(sec / 86400); sec -= days * 86400;
    const hrs = Math.floor(sec / 3600); sec -= hrs * 3600;
    const min = Math.floor(sec / 60); sec -= min * 60;
    const pad = n => String(n).padStart(2, '0');
    return (days > 0 ? days + 'd ' : '') + `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  },

  // ---------------- full refresh (structure changed) ----------------
  refreshAll() {
    this.refreshSatList();
    this.refreshInspector();
    this.refreshGsList();
    this._updateStats();
  }
};
