/* ui.js
   All DOM chrome: toolbar wiring, inspector forms, statistics/warnings/log/
   analysis panels, mini charts, scenario & challenge pickers, help modal. */
window.WNS = window.WNS || {};

(function (WNS) {
  'use strict';
  const C = WNS.Components;

  const UI = {};
  let _app = null;
  let _lastSelected = undefined;
  let _slowAcc = 0;

  function h(tag, attrs, children) {
    const e = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach((c) => { if (c) e.appendChild(c); });
    return e;
  }
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------- init
  UI.init = function (app) {
    _app = app;
    bindToolbar(app);
    bindSubbar(app);
    bindLabelsMenu(app);
    bindTabs();
    bindHelp();
    bindToast();
    populateScenarioSelects(app);
    buildHelpContent();
    refreshAll(app);
  };

  function bindToolbar(app) {
    document.querySelectorAll('#buildTools .tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#buildTools .tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        app.setTool(btn.dataset.tool);
        updateCanvasHint(app);
      });
    });
    updateCanvasHint(app);
  }

  function updateCanvasHint(app) {
    const hint = $('canvasHint');
    const msgs = {
      select: 'Click a component to select it. Drag empty space to pan, scroll to zoom.',
      pipe: 'Click a start node, then an end node to create a pipe.',
      delete: 'Click any component to delete it.',
      reservoir: 'Click on the canvas to place a reservoir.',
      pump: 'Click on the canvas to place a pump.',
      tank: 'Click on the canvas to place a storage tank.',
      junction: 'Click on the canvas to place a junction.',
      demand: 'Click on the canvas to place a demand node.',
      valve: 'Click on the canvas to place a valve.'
    };
    hint.textContent = msgs[app.tool] || '';
  }

  function bindSubbar(app) {
    $('btnPlay').addEventListener('click', () => app.setPlaying(true));
    $('btnPause').addEventListener('click', () => app.setPlaying(false));
    $('btnResetSim').addEventListener('click', () => app.resetSimulation());
    $('btnClearNetwork').addEventListener('click', () => {
      if (confirm('Clear the entire network? This cannot be undone.')) app.clearNetwork();
    });

    $('speedSelect').addEventListener('change', (e) => { app.speed = parseFloat(e.target.value); });
    $('demandModeSelect').addEventListener('change', (e) => {
      app.network.demandMode = e.target.value;
      app.network.log(`Demand mode set to ${e.target.value === 'daily' ? 'Daily Cycle' : 'Constant'}.`, 'info');
    });

    $('scenarioSelect').addEventListener('change', (e) => {
      if (!e.target.value) return;
      app.loadScenario(e.target.value);
      e.target.value = '';
    });
    $('challengeSelect').addEventListener('change', (e) => {
      if (!e.target.value) return;
      app.loadChallenge(e.target.value);
      e.target.value = '';
    });

    $('overlaySelect').addEventListener('change', (e) => { app.view.overlay = e.target.value; });
    $('btnFlowAnim').addEventListener('click', () => {
      app.view.flowAnim = !app.view.flowAnim;
      $('btnFlowAnim').classList.toggle('active', app.view.flowAnim);
    });
  }

  function bindLabelsMenu(app) {
    $('btnLabels').addEventListener('click', () => $('labelsMenu').classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
      if (!$('labelsMenu').contains(e.target) && e.target !== $('btnLabels')) $('labelsMenu').classList.add('hidden');
    });
    const map = { lblNames: 'names', lblPressure: 'pressure', lblFlow: 'flow', lblPipeIds: 'pipeIds', lblWarnings: 'warnings' };
    for (const id in map) {
      $(id).addEventListener('change', (e) => { app.view.labels[map[id]] = e.target.checked; });
    }
  }

  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $('tab-' + btn.dataset.tab).classList.add('active');
        const panel = $('bottomPanel');
        panel.classList.remove('collapsed');
      });
    });
    $('btnCollapseBottom').addEventListener('click', () => {
      $('bottomPanel').classList.toggle('collapsed');
    });
  }

  function bindHelp() {
    $('btnHelp').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
    $('btnCloseHelp').addEventListener('click', () => $('helpModal').classList.add('hidden'));
    $('helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') $('helpModal').classList.add('hidden'); });
  }

  let toastTimer = null;
  function bindToast() {}
  UI.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  };

  UI.syncPlayButtons = function (app) {
    $('btnPlay').disabled = app.playing;
    $('btnPause').disabled = !app.playing;
  };

  function populateScenarioSelects(app) {
    const sSel = $('scenarioSelect');
    sSel.innerHTML = '<option value="">New Scenario…</option>';
    WNS.Scenarios.list.forEach((s) => sSel.appendChild(h('option', { value: s.id, text: s.name })));
    const cSel = $('challengeSelect');
    cSel.innerHTML = '<option value="">Failure Challenge…</option>';
    WNS.Scenarios.challenges.forEach((c) => cSel.appendChild(h('option', { value: c.id, text: c.name })));
  }

  // ---------------------------------------------------------- challenge UI
  UI.showChallengeBanner = function (ch) {
    const b = $('challengeBanner');
    b.classList.remove('hidden', 'success');
    b.querySelector('.cb-title').textContent = ch.name;
    b.querySelector('.cb-metric').textContent = ch.brief;
    b.querySelector('.cb-close').onclick = () => UI.hideChallengeBanner();
  };
  UI.hideChallengeBanner = function () {
    $('challengeBanner').classList.add('hidden');
    if (_app) _app.activeChallenge = null;
  };
  function updateChallengeBanner(app) {
    if (!app.activeChallenge) return;
    const res = app.activeChallenge.evaluate(app.network);
    const b = $('challengeBanner');
    b.querySelector('.cb-metric').textContent = app.activeChallenge.brief + '  —  ' + res.metric + (res.success ? '  ✅ Criteria met!' : '');
    b.classList.toggle('success', !!res.success);
  }

  // --------------------------------------------------------------- ticking
  UI.tick = function (app) {
    if (app.network.selectedId !== _lastSelected) {
      _lastSelected = app.network.selectedId;
      refreshInspector(app);
    }
    _slowAcc += 1;
    if (_slowAcc % 6 !== 0) return; // ~10x/sec at 60fps -> throttle DOM-heavy updates
    updateClock(app);
    updateStats(app);
    updateWarnings(app);
    updateEventLog(app);
    updateAnalysis(app);
    updateCharts(app);
    if (app.activeChallenge) updateChallengeBanner(app);
  };
  UI.updateChallengeBanner = updateChallengeBanner;

  function updateClock(app) {
    const h24 = app.network.simHours;
    const hh = Math.floor(h24).toString().padStart(2, '0');
    const mm = Math.floor((h24 % 1) * 60).toString().padStart(2, '0');
    $('simClock').textContent = `t = ${hh}:${mm}${app.network.demandMode === 'daily' ? '' : ' (constant)'}`;
  }

  // -------------------------------------------------------------- stats
  function statCard(k, v) { return h('div', { class: 'stat-card' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v })]); }

  function updateStats(app) {
    const s = app.network.stats || {};
    const badge = $('healthBadge');
    badge.textContent = s.health || 'HEALTHY';
    badge.className = 'health-badge ' + (s.health || 'HEALTHY');
    $('healthReason').textContent = s.healthReason || '';

    const grid = $('statsGrid');
    grid.innerHTML = '';
    const rows = [
      ['Total Demand', fmt(s.totalDemand) + ' L/s'],
      ['Total Supplied Flow', fmt(s.totalSupplied) + ' L/s'],
      ['Unserved Demand', fmt(s.unservedDemand) + ' L/s'],
      ['Source Output', fmt(s.sourceOutput) + ' L/s'],
      ['Water Lost to Leaks', fmt(s.waterLost) + ' L/s'],
      ['Average Pressure', fmt(s.avgPressure) + ' m'],
      ['Lowest Pressure', fmt(s.lowestPressure) + ' m (' + (s.lowestPressureNode || '--') + ')'],
      ['Active Pumps', `${s.activePumps || 0} / ${s.totalPumps || 0}`],
      ['Tank Storage', fmt(s.tankStoragePercent) + ' %'],
      ['Active Leaks', s.activeLeaks || 0],
      ['Simulation Time', fmtHours(app.network.simHours)],
      ['Network Efficiency', fmt(s.efficiency) + ' %']
    ];
    rows.forEach(([k, v]) => grid.appendChild(statCard(k, v)));
  }
  function fmt(v) { return Number.isFinite(v) ? v.toFixed(1) : '0.0'; }
  function fmtHours(h) { const hh = Math.floor(h).toString().padStart(2, '0'); const mm = Math.floor((h % 1) * 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

  function updateWarnings(app) {
    const list = $('warningsList');
    const items = app.network.warnings || [];
    list.innerHTML = '';
    if (!items.length) { list.appendChild(h('li', { class: 'info', text: 'No active warnings.' })); return; }
    items.slice().reverse().forEach((w) => list.appendChild(h('li', { class: w.level }, [document.createTextNode(w.text)])));
  }

  function updateEventLog(app) {
    const list = $('eventLogList');
    list.innerHTML = '';
    app.network.eventLog.slice(-120).forEach((e) => {
      const li = h('li', { class: e.level });
      li.appendChild(h('span', { class: 't', text: fmtHours(e.t) }));
      li.appendChild(document.createTextNode(e.text));
      list.appendChild(li);
    });
  }

  function analysisCard(app, title, value, nodeId) {
    const card = h('div', { class: 'analysis-card' }, [h('div', { class: 'k', text: title }), h('div', { class: 'v', text: value })]);
    if (nodeId) card.addEventListener('click', () => { app.network.selectedId = nodeId; refreshInspector(app); });
    return card;
  }

  function updateAnalysis(app) {
    const net = app.network;
    const nodes = Array.from(net.nodes.values());
    const pipes = Array.from(net.pipes.values());
    const grid = $('analysisCards');
    grid.innerHTML = '';

    const pnodes = nodes.filter((n) => n.type === 'demand' || n.type === 'junction');
    let lowest = null;
    pnodes.forEach((n) => { if (!lowest || (n.pressure || 0) < (lowest.pressure || 0)) lowest = n; });
    grid.appendChild(analysisCard(app, 'Lowest-Pressure Node', lowest ? `${lowest.name} (${fmt(lowest.pressure)} m)` : '--', lowest && lowest.id));

    const demandNodes = nodes.filter((n) => n.type === 'demand');
    let highestDemand = null;
    demandNodes.forEach((n) => { if (!highestDemand || (n.requiredDemand || 0) > (highestDemand.requiredDemand || 0)) highestDemand = n; });
    grid.appendChild(analysisCard(app, 'Highest-Demand Node', highestDemand ? `${highestDemand.name} (${fmt(highestDemand.requiredDemand)} L/s)` : '--', highestDemand && highestDemand.id));

    let busiest = null;
    pipes.forEach((p) => { if (p.enabled && (!busiest || (p.utilization || 0) > (busiest.utilization || 0))) busiest = p; });
    grid.appendChild(analysisCard(app, 'Busiest Pipe', busiest ? `${busiest.name} (${fmt((busiest.utilization || 0) * 100)}% of capacity)` : '--', busiest && busiest.id));

    const isolated = pnodes.filter((n) => !n.hasSupply);
    grid.appendChild(analysisCard(app, 'Isolated Nodes', isolated.length ? isolated.map((n) => n.name).join(', ') : 'None', isolated[0] && isolated[0].id));

    const emptyTanks = nodes.filter((n) => n.type === 'tank' && (n.fillPercent || 0) < 5);
    grid.appendChild(analysisCard(app, 'Empty Tanks', emptyTanks.length ? emptyTanks.map((n) => n.name).join(', ') : 'None', emptyTanks[0] && emptyTanks[0].id));

    const unsupplied = demandNodes.filter((n) => (n.supplyPercent === undefined ? 100 : n.supplyPercent) < 70);
    grid.appendChild(analysisCard(app, 'Undersupplied Customers', unsupplied.length ? unsupplied.map((n) => `${n.name} (${fmt(n.supplyPercent)}%)`).join(', ') : 'None', unsupplied[0] && unsupplied[0].id));
  }

  // -------------------------------------------------------------- charts
  function hexToRgbaStr(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Prepares (clears/resizes) a chart canvas, then draws one or more series
  // on it without clearing between them.
  function drawSpark(canvas, series) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1) return;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const allVals = series.flatMap((s) => s.data || []);
    if (allVals.length < 2) return;
    const max = Math.max(...allVals, 0.001), min = Math.min(...allVals, 0);
    const range = max - min || 1;
    const fillSeries = series.length === 1;

    series.forEach(({ data, color }) => {
      if (!data || data.length < 2) return;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * rect.width;
        const y = rect.height - ((v - min) / range) * (rect.height - 6) - 3;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
      if (fillSeries) {
        ctx.lineTo(rect.width, rect.height); ctx.lineTo(0, rect.height); ctx.closePath();
        ctx.fillStyle = hexToRgbaStr(color, 0.15);
        ctx.fill();
      }
    });
  }

  function updateCharts(app) {
    if ($('tab-charts').classList.contains('active') === false) return;
    const hst = app.network.history;
    drawSpark($('chartDemand'), [{ data: hst.demand, color: '#ffcf4d' }, { data: hst.supply, color: '#59d1a8' }]);
    drawSpark($('chartPressure'), [{ data: hst.avgPressure, color: '#3aa6ff' }]);
    drawSpark($('chartTank'), [{ data: hst.tankLevel, color: '#59d1a8' }]);
    drawSpark($('chartLoss'), [{ data: hst.loss, color: '#ff9d3c' }]);
  }

  // ----------------------------------------------------------- inspector
  function refreshAll(app) { refreshInspector(app); updateStats(app); updateWarnings(app); updateEventLog(app); updateAnalysis(app); }
  UI.refreshAll = refreshAll;

  function row(labelText, control) {
    return h('div', { class: 'insp-row' }, [h('label', { text: labelText }), control]);
  }
  function textInput(value, onChange) {
    const i = h('input', { type: 'text', value });
    i.addEventListener('change', () => onChange(i.value));
    return i;
  }
  function numberInput(value, onChange, opts) {
    opts = opts || {};
    const attrs = { type: 'number', value: String(value) };
    if (opts.min !== undefined) attrs.min = opts.min;
    if (opts.max !== undefined) attrs.max = opts.max;
    if (opts.step !== undefined) attrs.step = opts.step;
    const i = h('input', attrs);
    i.addEventListener('change', () => onChange(parseFloat(i.value) || 0));
    return i;
  }
  function rangeInput(value, min, max, step, onChange) {
    const i = h('input', { type: 'range', value: String(value), min, max, step });
    i.addEventListener('input', () => onChange(parseFloat(i.value)));
    return i;
  }
  function selectInput(value, options, onChange) {
    const s = h('select', {});
    options.forEach((o) => s.appendChild(h('option', { value: o.value, text: o.label, ...(o.value === value ? { selected: 'selected' } : {}) })));
    s.value = value;
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function checkboxRow(labelText, checked, onChange) {
    const box = h('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', () => onChange(box.checked));
    return h('div', { class: 'insp-row checkbox-row' }, [box, h('label', { text: labelText })]);
  }
  function readout(labelText, valueText, subText) {
    const wrap = h('div', { class: 'insp-row' }, [h('label', { text: labelText }), h('div', { class: 'insp-readout', text: valueText })]);
    if (subText) wrap.appendChild(h('div', { class: 'insp-sub', text: subText }));
    return wrap;
  }
  function sectionTitle(t) { return h('div', { class: 'insp-section-title', text: t }); }
  function pill(status) {
    const cls = 'pill-' + status.replace(/\s+/g, '');
    return h('span', { class: 'pill ' + cls, text: status });
  }

  function refreshInspector(app) {
    const body = $('inspectorBody');
    body.innerHTML = '';
    const net = app.network;
    const id = net.selectedId;
    if (!id) { body.appendChild(h('p', { class: 'muted', text: 'Select a component to view and edit its properties.' })); return; }

    if (net.nodes.has(id)) {
      const node = net.getNode(id);
      body.appendChild(h('div', { class: 'insp-header' }, [
        h('div', { class: 'insp-readout', text: node.name }),
        h('div', { class: 'insp-sub', text: C.typeLabel[node.type] + '  ·  ' + node.id })
      ]));
      body.appendChild(row('Name', textInput(node.name, (v) => node.name = v || node.id)));
      switch (node.type) {
        case 'reservoir': buildReservoirInspector(app, node, body); break;
        case 'pump': buildPumpInspector(app, node, body); break;
        case 'tank': buildTankInspector(app, node, body); break;
        case 'junction': buildJunctionInspector(app, node, body); break;
        case 'demand': buildDemandInspector(app, node, body); break;
        case 'valve': buildValveInspector(app, node, body); break;
      }
      const del = h('button', { class: 'ctl-btn warn', text: 'Delete Component', onclick: () => { net.removeNode(node.id); refreshInspector(app); } });
      body.appendChild(h('div', { class: 'btn-row' }, [del]));
    } else if (net.pipes.has(id)) {
      const pipe = net.getPipe(id);
      const from = net.getNode(pipe.from), to = net.getNode(pipe.to);
      body.appendChild(h('div', { class: 'insp-header' }, [
        h('div', { class: 'insp-readout', text: pipe.name }),
        h('div', { class: 'insp-sub', text: `Pipe  ·  ${from ? from.name : '?'} → ${to ? to.name : '?'}` })
      ]));
      body.appendChild(row('Name', textInput(pipe.name, (v) => pipe.name = v || pipe.id)));
      buildPipeInspector(app, pipe, body);
      const del = h('button', { class: 'ctl-btn warn', text: 'Delete Pipe', onclick: () => { net.removePipe(pipe.id); refreshInspector(app); } });
      body.appendChild(h('div', { class: 'btn-row' }, [del]));
    }
  }
  UI.refreshInspector = refreshInspector;

  function buildReservoirInspector(app, node, body) {
    body.appendChild(row('Source Head (m)', numberInput(node.sourceHead, (v) => node.sourceHead = v, { min: 0, max: 300, step: 1 })));
    body.appendChild(row('Elevation (m)', numberInput(node.elevation, (v) => node.elevation = v, { step: 1 })));
    body.appendChild(readout('Output Flow', fmt(outputFlowOf(app, node)) + ' L/s'));
    body.appendChild(readout('Head', fmt(node.head) + ' m'));
    body.appendChild(sectionTitle('Failure Injection'));
    body.appendChild(checkboxRow('Source Loss Active', node.sourceLossActive, (v) => {
      node.sourceLossActive = v;
      app.network.log(v ? `${node.name}: source loss triggered.` : `${node.name}: source restored.`, v ? 'warn' : 'info');
    }));
    body.appendChild(row('Loss Factor (remaining head fraction)', rangeInput(node.sourceLossFactor, 0, 1, 0.05, (v) => node.sourceLossFactor = v)));
  }

  function outputFlowOf(app, node) {
    let total = 0;
    for (const p of app.network.getConnectedPipes(node.id)) {
      if (!p.enabled) continue;
      total += p.from === node.id ? Math.max(p.flow, 0) : Math.max(-p.flow, 0);
    }
    return total;
  }

  function buildPumpInspector(app, node, body) {
    body.appendChild(checkboxRow('Enabled', node.enabled, (v) => { node.enabled = v; app.network.log(`${node.name} switched ${v ? 'ON' : 'OFF'}.`, 'info'); }));
    body.appendChild(row('Pressure Boost (m)', numberInput(node.pressureBoost, (v) => node.pressureBoost = v, { min: 0, max: 200, step: 1 })));
    body.appendChild(row('Max Flow (L/s)', numberInput(node.maxFlow, (v) => node.maxFlow = v, { min: 0, step: 1 })));
    body.appendChild(row('Efficiency', rangeInput(node.efficiency, 0.1, 1, 0.05, (v) => node.efficiency = v)));
    body.appendChild(readout('Current Flow', fmt(outputFlowOf(app, node)) + ' L/s'));
    body.appendChild(readout('Status', node.failed ? 'FAILED' : (node.enabled ? 'RUNNING' : 'OFF')));

    body.appendChild(sectionTitle('Automatic Control'));
    body.appendChild(checkboxRow('Enable Auto Control (by tank level)', node.autoControl.enabled, (v) => node.autoControl.enabled = v));
    const tanks = Array.from(app.network.nodes.values()).filter((n) => n.type === 'tank');
    body.appendChild(row('Linked Tank', selectInput(node.autoControl.tankId || '', [{ value: '', label: '— choose —' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))], (v) => node.autoControl.tankId = v)));
    body.appendChild(row('Start Below (%)', numberInput(node.autoControl.startBelow, (v) => node.autoControl.startBelow = v, { min: 0, max: 100 })));
    body.appendChild(row('Stop Above (%)', numberInput(node.autoControl.stopAbove, (v) => node.autoControl.stopAbove = v, { min: 0, max: 100 })));

    body.appendChild(sectionTitle('Failure Injection'));
    const failBtn = h('button', {
      class: 'ctl-btn btn-fail', text: node.failed ? 'Restore Pump' : 'Fail Pump',
      onclick: () => {
        node.failed = !node.failed;
        if (node.failed) node.enabled = false;
        app.network.log(node.failed ? `${node.name} failed unexpectedly.` : `${node.name} restored to service.`, node.failed ? 'warn' : 'info');
        refreshInspector(app);
      }
    });
    body.appendChild(h('div', { class: 'btn-row' }, [failBtn]));
  }

  function buildTankInspector(app, node, body) {
    body.appendChild(row('Elevation (m)', numberInput(node.elevation, (v) => node.elevation = v, { step: 1 })));
    body.appendChild(row('Capacity (L)', numberInput(node.capacity, (v) => node.capacity = Math.max(1, v), { min: 1, step: 100 })));
    body.appendChild(row('Max Level (m)', numberInput(node.maxLevel, (v) => node.maxLevel = v, { min: 0.1, step: 0.5 })));
    body.appendChild(row('Min Level (m)', numberInput(node.minLevel, (v) => node.minLevel = v, { min: 0, step: 0.5 })));
    body.appendChild(readout('Fill Percentage', fmt(node.fillPercent) + ' %'));
    body.appendChild(readout('Current Volume', Math.round(node.currentVolume).toLocaleString() + ' L'));
    body.appendChild(readout('Water Level', fmt(node.level) + ' m'));
    body.appendChild(readout('Net Flow', fmt(node.netFlow) + ' L/s', node.netFlow >= 0 ? 'Filling' : 'Draining'));
    body.appendChild(sectionTitle('Adjust Storage'));
    body.appendChild(row('Current Volume (L)', numberInput(Math.round(node.currentVolume), (v) => node.currentVolume = Math.max(0, Math.min(node.capacity, v)), { min: 0, step: 100 })));
  }

  function buildJunctionInspector(app, node, body) {
    body.appendChild(row('Elevation (m)', numberInput(node.elevation, (v) => node.elevation = v, { step: 1 })));
    body.appendChild(readout('Pressure', fmt(node.pressure) + ' m', ''));
    body.appendChild(pillRow(node));
  }

  function pillRow(node) {
    const status = C.pressureStatus(node.pressure, node.hasSupply);
    return h('div', { class: 'insp-row' }, [h('label', { text: 'Status' }), pill(status)]);
  }

  function buildDemandInspector(app, node, body) {
    body.appendChild(row('Elevation (m)', numberInput(node.elevation, (v) => node.elevation = v, { step: 1 })));
    body.appendChild(row('Demand Type', selectInput(node.demandType, Object.keys(C.DEMAND_TYPES).map((k) => ({ value: k, label: C.DEMAND_TYPES[k].label })), (v) => {
      node.demandType = v;
      node.baseDemand = C.DEMAND_TYPES[v].base;
      refreshInspector(app);
    })));
    body.appendChild(row('Base Demand (L/s)', numberInput(node.baseDemand, (v) => node.baseDemand = Math.max(0, v), { min: 0, step: 0.5 })));
    body.appendChild(row('Priority', selectInput(node.priority, [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }], (v) => node.priority = v)));

    body.appendChild(sectionTitle('Live Status'));
    body.appendChild(readout('Required Demand', fmt(node.requiredDemand) + ' L/s'));
    body.appendChild(readout('Supplied Flow', fmt(node.suppliedFlow) + ' L/s'));
    body.appendChild(readout('Supply Percentage', fmt(node.supplyPercent) + ' %'));
    body.appendChild(readout('Pressure', fmt(node.pressure) + ' m'));
    body.appendChild(pillRow(node));

    body.appendChild(sectionTitle('Failure Injection'));
    body.appendChild(checkboxRow('Demand Surge Active', node.surgeActive, (v) => {
      node.surgeActive = v;
      app.network.log(v ? `${node.name}: demand surge triggered.` : `${node.name}: demand surge cleared.`, v ? 'warn' : 'info');
    }));
    body.appendChild(row('Surge Multiplier (×)', numberInput(node.surgeMultiplier, (v) => node.surgeMultiplier = Math.max(1, v), { min: 1, max: 10, step: 0.5 })));
  }

  function buildValveInspector(app, node, body) {
    body.appendChild(row('Elevation (m)', numberInput(node.elevation, (v) => node.elevation = v, { step: 1 })));
    body.appendChild(row(`Opening: ${Math.round(node.open)}%`, rangeInput(node.open, 0, 100, 1, (v) => { node.open = v; refreshInspector(app); })));
    body.appendChild(readout('Status', node.open <= 0.5 ? 'CLOSED' : node.open >= 99.5 ? 'FULLY OPEN' : 'PARTIALLY OPEN'));
    body.appendChild(sectionTitle('Failure Injection'));
    const btn = h('button', {
      class: 'ctl-btn btn-fail', text: node.closedByFailure ? 'Restore Valve' : 'Force Closure',
      onclick: () => {
        node.closedByFailure = !node.closedByFailure;
        node.open = node.closedByFailure ? 0 : 100;
        app.network.log(node.closedByFailure ? `${node.name} forced closed.` : `${node.name} restored.`, node.closedByFailure ? 'warn' : 'info');
        refreshInspector(app);
      }
    });
    body.appendChild(h('div', { class: 'btn-row' }, [btn]));
  }

  function buildPipeInspector(app, pipe, body) {
    body.appendChild(row('Length (m)', numberInput(pipe.length, (v) => pipe.length = Math.max(1, v), { min: 1, step: 10 })));
    body.appendChild(row('Diameter (mm)', numberInput(pipe.diameter, (v) => pipe.diameter = Math.max(10, v), { min: 10, step: 10 })));
    body.appendChild(checkboxRow('Enabled (open)', pipe.enabled, (v) => {
      pipe.enabled = v;
      app.network.log(`${pipe.name} ${v ? 'opened' : 'closed'}.`, 'info');
    }));

    body.appendChild(sectionTitle('Live Status'));
    body.appendChild(readout('Current Flow', fmt(pipe.flow) + ' L/s', pipe.flow >= 0 ? `${nodeName(app, pipe.from)} → ${nodeName(app, pipe.to)}` : `${nodeName(app, pipe.to)} → ${nodeName(app, pipe.from)}`));
    body.appendChild(readout('Pressure Loss', fmt(pipe.pressureLoss) + ' m'));
    body.appendChild(readout('Utilization', fmt(pipe.utilization * 100) + ' %'));
    body.appendChild(h('div', { class: 'insp-row' }, [h('label', { text: 'Status' }), pill(pipe.status.toUpperCase().replace('-', ' '))]));

    body.appendChild(sectionTitle('Failure Injection'));
    body.appendChild(checkboxRow('Leak Active', pipe.leak.active, (v) => {
      pipe.leak.active = v;
      app.network.log(v ? `Leak started on ${pipe.name}.` : `Leak on ${pipe.name} repaired.`, v ? 'warn' : 'info');
      refreshInspector(app);
    }));
    if (pipe.leak.active) body.appendChild(row('Leak Severity', rangeInput(pipe.leak.severity, 0.05, 1, 0.05, (v) => pipe.leak.severity = v)));
    body.appendChild(checkboxRow('Pipe Break', pipe.broken, (v) => {
      pipe.broken = v;
      app.network.log(v ? `${pipe.name} has broken.` : `${pipe.name} repaired.`, v ? 'warn' : 'info');
    }));
  }
  function nodeName(app, id) { const n = app.network.getNode(id); return n ? n.name : '?'; }

  // ------------------------------------------------------------- help
  function buildHelpContent() {
    const items = [
      ['Pressure', 'Pressure (shown here as meters of head) is the force pushing water through the pipes to your tap. Too low, and water barely trickles out; too high, and pipes and fixtures are stressed.'],
      ['Flow', 'Flow is how much water is moving through a pipe, in liters per second. It naturally moves from areas of higher pressure toward areas of lower pressure or demand.'],
      ['Demand', 'Demand is how much water homes, businesses, and industry want to consume. When demand is high, pressure tends to drop unless the network can supply enough water.'],
      ['Head Loss', 'As water flows through a pipe, friction against the pipe walls causes it to lose pressure. Longer, narrower, or more restricted pipes lose more pressure for the same flow.'],
      ['Pipe Diameter', 'Larger pipes generally produce less resistance, so they can carry more water with less pressure loss.'],
      ['Pumps', 'Pumps add pressure (head) to move water further or higher than gravity and source pressure alone could manage.'],
      ['Storage Tanks', 'Tanks store extra water when supply exceeds demand and release it when demand spikes, helping stabilize pressure during peak periods.'],
      ['Valves', 'Valves restrict or block flow. Partially closing a valve increases resistance; fully closing one can isolate a section of the network.'],
      ['Leaks', 'A leak continuously loses water from a pipe, reducing the pressure and flow available to everything downstream.']
    ];
    const wrap = $('helpBody');
    wrap.innerHTML = '';
    items.forEach(([t, d]) => wrap.appendChild(h('div', { class: 'help-item' }, [h('h4', { text: t }), h('p', { text: d })])));
    wrap.appendChild(h('p', { class: 'muted small', text: 'This simulator uses a simplified educational hydraulic model. It is not intended for real-world infrastructure design.' }));
  }

  WNS.UI = UI;
})(window.WNS);
