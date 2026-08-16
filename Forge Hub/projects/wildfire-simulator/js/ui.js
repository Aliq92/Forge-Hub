(function (WF) {
  'use strict';

  const { dirToCompass } = WF;

  function $(id) { return document.getElementById(id); }

  const el = {
    btnPlay: $('btn-play'),
    btnReset: $('btn-reset'),
    btnNewTerrain: $('btn-new-terrain'),
    btnMenuToggle: $('btn-menu-toggle'),
    speedButtons: $('speed-buttons'),
    seedDisplay: $('seed-display'),

    toolGrid: $('tool-grid'),
    toolRadius: $('tool-radius'),
    toolRadiusVal: $('tool-radius-val'),

    presetGrid: $('preset-grid'),
    dryness: $('dryness'), drynessVal: $('dryness-val'),
    moisture: $('moisture'), moistureVal: $('moisture-val'),
    temperature: $('temperature'), temperatureVal: $('temperature-val'),
    windStrength: $('wind-strength'), windStrengthVal: $('wind-strength-val'),
    windCompass: $('wind-compass'),
    windArrow: $('wind-arrow'),

    terrainCanvas: $('terrain-canvas'),
    fireCanvas: $('fire-canvas'),
    smokeCanvas: $('smoke-canvas'),
    fxCanvas: $('fx-canvas'),
    canvasStage: $('canvas-stage'),
    canvasWrap: $('canvas-wrap'),
    viewButtons: $('view-buttons'),
    camZoomIn: $('cam-zoom-in'),
    camZoomOut: $('cam-zoom-out'),
    camReset: $('cam-reset'),
    windIndicator: $('wind-indicator'),
    windIndicatorArrow: $('wind-indicator-arrow'),
    windIndicatorText: $('wind-indicator-text'),
    ignitionCursor: $('ignition-cursor'),

    statActiveFires: $('stat-active-fires'),
    statBurning: $('stat-burning'),
    statBurnedArea: $('stat-burned-area'),
    statBurnedPct: $('stat-burned-pct'),
    statVegLeft: $('stat-veg-left'),
    statContainment: $('stat-containment'),
    statTime: $('stat-time'),
    statWind: $('stat-wind'),

    eventLog: $('event-log'),

    summaryModal: $('summary-modal'),
    summaryGrid: $('summary-grid'),
    summaryClose: $('summary-close'),
    summaryNew: $('summary-new'),

    panelLeft: $('panel-left'),
    panelRight: $('panel-right'),
  };

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function setActive(container, selector, predicate) {
    container.querySelectorAll(selector).forEach((btn) => {
      btn.classList.toggle('active', predicate(btn));
    });
  }

  function renderStats(stats) {
    el.statActiveFires.textContent = stats.activeFires;
    el.statBurning.textContent = stats.burningCells;
    el.statBurnedArea.textContent = stats.burnedArea.toFixed(1) + ' ha';
    el.statBurnedPct.textContent = stats.burnedPct.toFixed(1) + '%';
    el.statVegLeft.textContent = stats.vegPct.toFixed(0) + '%';
    el.statContainment.textContent = stats.containmentPct.toFixed(0) + '%';
    el.statTime.textContent = formatTime(stats.simTime);
  }

  function updateWindDisplay(dirRad, strength01) {
    const deg = dirRad * 180 / Math.PI;
    el.windArrow.setAttribute('transform', `rotate(${deg} 60 60)`);
    el.windIndicatorArrow.setAttribute('transform', `rotate(${deg} 20 20)`);
    const compass = dirToCompass(dirRad);
    const text = `${compass} · ${Math.round(strength01 * 100)}%`;
    el.windIndicatorText.textContent = text;
    el.statWind.textContent = text;
  }

  let logCount = 0;
  function clearLog() {
    el.eventLog.innerHTML = '';
    logCount = 0;
  }

  function logEvent(message, category, simTime) {
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (category || '');
    const t = document.createElement('span');
    t.className = 'log-time';
    t.textContent = formatTime(simTime || 0);
    entry.appendChild(t);
    entry.appendChild(document.createTextNode(message));
    el.eventLog.appendChild(entry);
    logCount++;
    if (logCount > 60) {
      el.eventLog.removeChild(el.eventLog.firstChild);
      logCount--;
    }
  }

  function showSummary(data) {
    el.summaryGrid.innerHTML = '';
    const rows = [
      ['Total Area Burned', data.burnedArea.toFixed(1) + ' ha'],
      ['Percentage Burned', data.burnedPct.toFixed(1) + '%'],
      ['Simulation Duration', formatTime(data.simTime)],
      ['Peak Active Fire Cells', String(data.peakActiveCells)],
      ['Ignition Points', String(data.ignitionPoints)],
      ['Water Drops Used', String(data.waterDropsUsed)],
      ['Firebreak Length', data.firebreakLength + ' cells'],
      ['Containment Result', data.containmentPct.toFixed(0) + '%'],
    ];
    for (const [label, value] of rows) {
      const tile = document.createElement('div');
      tile.className = 'stat-tile';
      tile.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
      el.summaryGrid.appendChild(tile);
    }
    el.summaryModal.classList.remove('hidden');
  }

  function hideSummary() {
    el.summaryModal.classList.add('hidden');
  }

  Object.assign(WF, {
    $, el, formatTime, setActive, renderStats, updateWindDisplay,
    clearLog, logEvent, showSummary, hideSummary,
  });
})(window.WF = window.WF || {});
