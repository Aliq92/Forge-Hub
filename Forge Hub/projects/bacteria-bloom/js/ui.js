/* Bacteria Bloom - UI wiring: toolbar, controls, stats, inspect, mobile sheets */
(function (BB) {
  'use strict';
  const STRAIN_ORDER = BB.Strains.STRAIN_ORDER;
  const STRAINS = BB.Strains.STRAINS;

  const BRUSH_RADII = { small: 7, medium: 13, large: 20 };

  function fmtTime(totalSeconds) {
    const s = Math.floor(totalSeconds);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function growthLabel(tempFactor, nutrient) {
    const g = tempFactor * (0.3 + 0.7 * nutrient);
    if (g < 0.12) return 'Dormant';
    if (g < 0.4) return 'Slow';
    if (g < 0.75) return 'Moderate';
    return 'Vigorous';
  }
  function stressLabel(stress) {
    if (stress < 0.15) return 'None';
    if (stress < 0.4) return 'Mild';
    if (stress < 0.7) return 'High';
    return 'Severe';
  }

  function UI() {}

  UI.prototype.init = function (sim, env, renderer) {
    this.sim = sim; this.env = env; this.renderer = renderer;

    this.state = {
      tool: 'inoculate',
      strain: 'rapida',
      brush: 'medium',
      inspectIdx: null
    };

    const saved = BB.Storage.loadSettings() || {};
    if (saved.strain) this.state.strain = saved.strain;
    if (saved.brush) this.state.brush = saved.brush;
    this.visualMode = saved.visualMode || 'normal';
    renderer.visualMode = this.visualMode;

    this._cacheDom();
    this._buildPresetOptions();
    this._bindToolbar();
    this._bindExperimentPanel();
    this._bindDishPointer();
    this._bindMobileSheets();
    this._bindGuide(saved);

    this._renderToolOptions();
    this._syncVisualModeUI();
    this._syncTempUI();
    this._syncSpeedUI();

    if (saved.mutationRate) { sim.mutationRate = saved.mutationRate; this.el.mutationSelect.value = saved.mutationRate; }
    if (saved.nutrientRegen) { env.nutrientRegen = saved.nutrientRegen; this.el.regenSelect.value = saved.nutrientRegen; }

    setInterval(() => this.updateStats(), 500);
    this.updateStats();
  };

  UI.prototype._cacheDom = function () {
    this.el = {
      toolRow: document.getElementById('toolRow'),
      toolOptions: document.getElementById('toolOptions'),
      dishWrap: document.getElementById('dishWrap'),
      canvas: document.getElementById('dishCanvas'),
      inspectTooltip: document.getElementById('inspectTooltip'),
      tempReadout: document.getElementById('tempReadout'),
      tempSlider: document.getElementById('tempSlider'),
      tempValue: document.getElementById('tempValue'),
      tempLabel: document.getElementById('tempLabel'),
      speedGroup: document.getElementById('speedGroup'),
      mutationSelect: document.getElementById('mutationSelect'),
      regenSelect: document.getElementById('regenSelect'),
      presetSelect: document.getElementById('presetSelect'),
      visualModeGroup: document.getElementById('visualModeGroup'),
      visualModeToggle: document.getElementById('visualModeToggle'),
      resetDishBtn: document.getElementById('resetDishBtn'),
      newDishBtn: document.getElementById('newDishBtn'),
      saveDishBtn: document.getElementById('saveDishBtn'),
      loadDishBtn: document.getElementById('loadDishBtn'),
      statCoverage: document.getElementById('statCoverage'),
      statMass: document.getElementById('statMass'),
      statNutrient: document.getElementById('statNutrient'),
      statTime: document.getElementById('statTime'),
      statDominant: document.getElementById('statDominant'),
      statTemp: document.getElementById('statTemp'),
      strainStats: document.getElementById('strainStats'),
      guideOverlay: document.getElementById('firstRunGuide'),
      guideBtn: document.getElementById('guideBtn'),
      guideDismiss: document.getElementById('guideDismiss'),
      mobileSheetTabs: document.getElementById('mobileSheetTabs'),
      sheetScrim: document.getElementById('sheetScrim')
    };
  };

  /* ---------------- settings persistence ---------------- */
  UI.prototype._saveSettings = function () {
    BB.Storage.saveSettings({
      strain: this.state.strain,
      brush: this.state.brush,
      visualMode: this.visualMode,
      mutationRate: this.sim.mutationRate,
      nutrientRegen: this.env.nutrientRegen,
      guideDismissed: this._guideDismissed
    });
  };

  /* ---------------- toolbar ---------------- */
  UI.prototype._bindToolbar = function () {
    this.el.toolRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (!btn) return;
      this.el.toolRow.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.state.tool = btn.dataset.tool;
      this._hideInspect();
      this._renderToolOptions();
    });
  };

  UI.prototype._renderToolOptions = function () {
    const tool = this.state.tool;
    const box = this.el.toolOptions;
    if (tool === 'inoculate') {
      box.innerHTML = '<h3>Strain</h3>' + STRAIN_ORDER.map(key => {
        const s = STRAINS[key];
        const active = key === this.state.strain ? ' active' : '';
        return `<button class="strain-btn${active}" data-strain="${key}" style="--sw:${BB.Strains.strainColor(s)}">
          <span class="strain-swatch"></span>
          <span class="strain-meta"><span class="strain-name">${s.name}</span><span class="strain-tag">${s.tagline}</span></span>
        </button>`;
      }).join('');
      box.querySelectorAll('.strain-btn').forEach(b => {
        b.addEventListener('click', () => {
          this.state.strain = b.dataset.strain;
          this._saveSettings();
          this._renderToolOptions();
        });
      });
    } else if (tool === 'nutrient' || tool === 'inhibitor' || tool === 'erase') {
      const label = tool === 'nutrient' ? 'Nutrient Brush' : tool === 'inhibitor' ? 'Inhibitor Zone' : 'Erase Brush';
      box.innerHTML = `<h3>${label} Size</h3><div class="btn-group" id="brushGroup">
        <button data-b="small">Small</button><button data-b="medium">Medium</button><button data-b="large">Large</button>
      </div><p class="strain-tag" style="margin-top:8px;line-height:1.5">${
        tool === 'nutrient' ? 'Click or drag on the agar to enrich nutrient levels.' :
        tool === 'inhibitor' ? 'Click or drag to paint an inhibition zone.' :
        'Click or drag to clear colony material and inhibitor zones.'
      }</p>`;
      box.querySelectorAll('#brushGroup button').forEach(b => {
        if (b.dataset.b === this.state.brush) b.classList.add('active');
        b.addEventListener('click', () => {
          this.state.brush = b.dataset.b;
          this._saveSettings();
          box.querySelectorAll('#brushGroup button').forEach(x => x.classList.toggle('active', x === b));
        });
      });
    } else if (tool === 'inspect') {
      box.innerHTML = `<h3>Inspect</h3><p class="strain-tag" style="line-height:1.5">Tap any point on the dish to see strain, age, nutrient level, growth rate and stress.</p>`;
    }
  };

  /* ---------------- dish pointer interaction ---------------- */
  UI.prototype._bindDishPointer = function () {
    const canvas = this.el.canvas;
    let painting = false;

    const applyToolAt = (gx, gy) => {
      const tool = this.state.tool;
      const r = BRUSH_RADII[this.state.brush];
      if (tool === 'inoculate') {
        const colony = this.sim.inoculate(this.state.strain, gx, gy);
        if (colony) {
          const strain = STRAINS[this.state.strain];
          this.renderer.addPing(gx, gy, BB.Strains.strainColor(strain));
        }
      } else if (tool === 'nutrient') {
        this.env.addNutrient(gx, gy, r, 1);
      } else if (tool === 'inhibitor') {
        this.env.addInhibitor(gx, gy, r, 1);
      } else if (tool === 'erase') {
        this.sim.eraseAt(gx, gy, r);
      } else if (tool === 'inspect') {
        this._showInspect(gx, gy);
      }
    };

    canvas.addEventListener('pointerdown', (e) => {
      const p = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (!p.inDish) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer session (e.g. synthetic event) */ }
      if (this.state.tool !== 'inspect') { painting = true; }
      applyToolAt(p.x, p.y);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (['nutrient', 'inhibitor', 'erase'].includes(this.state.tool)) {
        if (p.inDish) {
          this.renderer.setBrushPreview({ gx: p.x, gy: p.y, radiusCells: BRUSH_RADII[this.state.brush], color: this._toolColor() });
        } else {
          this.renderer.setBrushPreview(null);
        }
      } else {
        this.renderer.setBrushPreview(null);
      }
      if (painting && p.inDish) applyToolAt(p.x, p.y);
      if (painting) e.preventDefault();
    });

    const endPaint = () => { painting = false; };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);
    canvas.addEventListener('pointerleave', () => { endPaint(); this.renderer.setBrushPreview(null); });
  };

  UI.prototype._toolColor = function () {
    const tool = this.state.tool;
    if (tool === 'nutrient') return 'rgba(180,210,120,0.85)';
    if (tool === 'inhibitor') return 'rgba(200,140,210,0.85)';
    if (tool === 'erase') return 'rgba(255,255,255,0.6)';
    return 'rgba(255,255,255,0.7)';
  };

  UI.prototype._showInspect = function (gx, gy) {
    const info = this.sim.getCellInfo(gx, gy);
    const tip = this.el.inspectTooltip;
    if (!info) { tip.classList.add('hidden'); return; }

    let html;
    if (info.empty) {
      html = `<div class="row"><span>Agar</span><b>Open</b></div>
        <div class="row"><span>Nutrient</span><b>${Math.round(info.nutrient * 100)}%</b></div>
        <div class="row"><span>Inhibitor</span><b>${Math.round(info.inhibitor * 100)}%</b></div>`;
    } else {
      html = `<div class="row"><span>Strain</span><b>${info.strainName}</b></div>
        <div class="row"><span>Colony Age</span><b>${fmtTime(info.colonyAge)}</b></div>
        <div class="row"><span>Local Nutrient</span><b>${Math.round(info.nutrient * 100)}%</b></div>
        <div class="row"><span>Growth Rate</span><b>${info.dead ? 'None (dead)' : growthLabel(info.tempFactor, info.nutrient)}</b></div>
        <div class="row"><span>Stress</span><b>${stressLabel(info.stress)}</b></div>
        ${info.mutation ? `<div class="row"><span>Mutation</span><b>Variant #${info.mutation.id}</b></div>` : ''}`;
    }
    tip.innerHTML = html;
    tip.classList.remove('hidden');

    const wrapRect = this.el.dishWrap.getBoundingClientRect();
    const csspos = this.renderer._gridToCss(gx, gy);
    let left = csspos.x + 14, top = csspos.y - 10;
    left = Math.min(left, wrapRect.width - 190);
    top = Math.max(6, Math.min(top, wrapRect.height - 140));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };

  UI.prototype._hideInspect = function () {
    this.el.inspectTooltip.classList.add('hidden');
  };

  /* ---------------- experiment panel ---------------- */
  UI.prototype._bindExperimentPanel = function () {
    const el = this.el, sim = this.sim, env = this.env;

    el.tempSlider.addEventListener('input', () => {
      env.temperature = Number(el.tempSlider.value);
      this._syncTempUI();
    });

    el.speedGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      sim.speedMultiplier = Number(btn.dataset.speed);
      this._syncSpeedUI();
    });

    el.mutationSelect.addEventListener('change', () => {
      sim.mutationRate = el.mutationSelect.value;
      this._saveSettings();
    });
    el.regenSelect.addEventListener('change', () => {
      env.nutrientRegen = el.regenSelect.value;
      this._saveSettings();
    });

    el.presetSelect.addEventListener('change', () => {
      const key = el.presetSelect.value;
      const preset = BB.Presets.PRESETS[key];
      if (!preset) return;
      preset.apply(sim, env);
      this.renderer.rebuildAgar();
      this.renderer.pings = [];
      this._hideInspect();
      this._syncTempUI();
      el.mutationSelect.value = sim.mutationRate;
      el.regenSelect.value = env.nutrientRegen;
      this.updateStats();
    });

    el.visualModeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      this.setVisualMode(btn.dataset.mode);
    });
    el.visualModeToggle.addEventListener('click', () => {
      const modes = ['normal', 'nutrients', 'stress', 'age'];
      const next = modes[(modes.indexOf(this.visualMode) + 1) % modes.length];
      this.setVisualMode(next);
    });

    el.resetDishBtn.addEventListener('click', () => {
      sim.resetDish();
      this.renderer.pings = [];
      this._hideInspect();
      this.updateStats();
    });
    el.newDishBtn.addEventListener('click', () => {
      sim.newDish();
      this.renderer.rebuildAgar();
      this.renderer.pings = [];
      this._hideInspect();
      this._syncTempUI();
      this.updateStats();
    });

    el.saveDishBtn.addEventListener('click', () => {
      const ok = BB.Storage.saveDish(sim, env);
      this._flashButton(el.saveDishBtn, ok ? 'Saved!' : 'Failed');
    });
    el.loadDishBtn.addEventListener('click', () => {
      const ok = BB.Storage.loadDish(sim, env, this.renderer);
      this._flashButton(el.loadDishBtn, ok ? 'Loaded!' : 'No Save');
      if (ok) { this._syncTempUI(); this.updateStats(); }
    });
  };

  UI.prototype._flashButton = function (btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = original; }, 1200);
  };

  UI.prototype.setVisualMode = function (mode) {
    this.visualMode = mode;
    this.renderer.visualMode = mode;
    this._syncVisualModeUI();
    this._saveSettings();
  };

  UI.prototype._syncVisualModeUI = function () {
    this.el.visualModeGroup.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === this.visualMode));
    this.el.visualModeToggle.textContent = this.visualMode.charAt(0).toUpperCase() + this.visualMode.slice(1);
  };

  UI.prototype._syncSpeedUI = function () {
    this.el.speedGroup.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === this.sim.speedMultiplier));
  };

  UI.prototype._syncTempUI = function () {
    const t = Math.round(this.env.temperature);
    this.el.tempSlider.value = t;
    this.el.tempValue.textContent = t + '°C';
    const label = this.env.tempLabel();
    this.el.tempLabel.textContent = label;
    this.el.tempReadout.textContent = `${t}°C — ${label}`;
  };

  UI.prototype._buildPresetOptions = function () {
    this.el.presetSelect.innerHTML = BB.Presets.PRESET_ORDER
      .map(key => `<option value="${key}">${BB.Presets.PRESETS[key].label}</option>`).join('');
  };

  /* ---------------- stats ---------------- */
  UI.prototype.updateStats = function () {
    const stats = this.sim.computeStats();
    this.el.statCoverage.textContent = Math.round(stats.coverage * 100) + '%';
    this.el.statMass.textContent = Math.round(stats.totalMass).toLocaleString();
    this.el.statNutrient.textContent = Math.round(stats.avgNutrient * 100) + '%';
    this.el.statTime.textContent = fmtTime(stats.simTime);
    this.el.statDominant.textContent = stats.dominant ? STRAINS[stats.dominant].name : '—';
    this.el.statTemp.textContent = `${Math.round(stats.temperature)}°C · ${this.env.tempLabel()}`;

    this.el.strainStats.innerHTML = stats.perStrain.map(s => {
      const strain = STRAINS[s.key];
      const pct = Math.round(s.coverage * 100);
      return `<div class="strain-stat-row" style="--sw:${BB.Strains.strainColor(strain)}">
        <span class="dot"></span><span class="name">${strain.name}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.min(100, pct * 2.2)}%"></span></span>
        <span class="pct">${pct}%</span>
      </div>`;
    }).join('');
  };

  /* ---------------- guide ---------------- */
  UI.prototype._bindGuide = function (saved) {
    this._guideDismissed = !!saved.guideDismissed;
    if (!this._guideDismissed) this.el.guideOverlay.classList.remove('hidden');
    this.el.guideDismiss.addEventListener('click', () => {
      this._guideDismissed = true;
      this.el.guideOverlay.classList.add('hidden');
      this._saveSettings();
    });
    this.el.guideBtn.addEventListener('click', () => this.el.guideOverlay.classList.remove('hidden'));
    this.el.guideOverlay.addEventListener('click', (e) => {
      if (e.target === this.el.guideOverlay) this.el.guideOverlay.classList.add('hidden');
    });
  };

  /* ---------------- mobile bottom sheets ---------------- */
  UI.prototype._bindMobileSheets = function () {
    const tabs = this.el.mobileSheetTabs;
    const setSheet = (name) => {
      const current = document.body.getAttribute('data-active-sheet');
      if (current === name) {
        document.body.removeAttribute('data-active-sheet');
        tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        return;
      }
      document.body.setAttribute('data-active-sheet', name);
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sheet === name));
    };
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      setSheet(btn.dataset.sheet);
    });
    this.el.sheetScrim.addEventListener('click', () => {
      document.body.removeAttribute('data-active-sheet');
      tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    });
  };

  BB.UI = new UI();

})(window.BB = window.BB || {});
