// ============================================================
// main.js — UI wiring, game loop, camera controls, panels
// ============================================================

(function () {
  const TICK_MS = 90; // real ms per simulation tick at 1x speed
  const MAX_FRAME_DT = 250; // clamp huge dt (e.g. tab was backgrounded)
  const MAX_TICKS_PER_FRAME = 40;

  const canvas = document.getElementById('worldCanvas');
  const mapWrap = document.getElementById('mapWrap');
  const loadingOverlay = document.getElementById('loadingOverlay');

  let sim = null;
  let renderer = null;
  let lastFrameTime = null;
  let accumulator = 0;
  let selectedKingdomId = null;

  // ---------------------------------------------------------------
  // Config / world generation
  // ---------------------------------------------------------------
  const els = {
    preset: document.getElementById('cfgPreset'),
    worldSize: document.getElementById('cfgWorldSize'),
    numKingdoms: document.getElementById('cfgNumKingdoms'),
    landPct: document.getElementById('cfgLandPct'),
    mtnFreq: document.getElementById('cfgMtnFreq'),
    resAbund: document.getElementById('cfgResAbund'),
    conflict: document.getElementById('cfgConflict'),
    seed: document.getElementById('cfgSeed'),
    outNumKingdoms: document.getElementById('outNumKingdoms'),
    outLandPct: document.getElementById('outLandPct'),
    outMtnFreq: document.getElementById('outMtnFreq'),
    outResAbund: document.getElementById('outResAbund'),
    outConflict: document.getElementById('outConflict'),
  };

  function syncOutputs() {
    els.outNumKingdoms.textContent = els.numKingdoms.value;
    els.outLandPct.textContent = els.landPct.value + '%';
    els.outMtnFreq.textContent = els.mtnFreq.value + '%';
    els.outResAbund.textContent = els.resAbund.value + '%';
    els.outConflict.textContent = els.conflict.value + '%';
  }
  [els.numKingdoms, els.landPct, els.mtnFreq, els.resAbund, els.conflict].forEach(inp => inp.addEventListener('input', syncOutputs));

  els.preset.addEventListener('change', () => {
    const p = PRESETS[els.preset.value];
    if (!p || els.preset.value === 'custom') return;
    els.numKingdoms.value = p.numKingdoms;
    els.landPct.value = p.landPercentage;
    els.mtnFreq.value = p.mountainFrequency;
    els.resAbund.value = p.resourceAbundance;
    els.conflict.value = p.conflictLevel;
    syncOutputs();
  });

  function readConfigFromModal() {
    let seed = els.seed.value.trim();
    if (!seed) seed = 'w' + Math.floor(Math.random() * 1e9).toString(36);
    return {
      preset: els.preset.value,
      worldSize: els.worldSize.value,
      numKingdoms: parseInt(els.numKingdoms.value, 10),
      landPercentage: parseInt(els.landPct.value, 10),
      mountainFrequency: parseInt(els.mtnFreq.value, 10),
      resourceAbundance: parseInt(els.resAbund.value, 10),
      conflictLevel: parseInt(els.conflict.value, 10),
      seed,
      startYear: 800,
    };
  }

  const worldGenModal = document.getElementById('worldGenModal');
  document.getElementById('btnNewWorld').addEventListener('click', () => { syncOutputs(); worldGenModal.classList.remove('hidden'); });
  document.getElementById('btnCancelGen').addEventListener('click', () => worldGenModal.classList.add('hidden'));
  document.getElementById('btnConfirmGen').addEventListener('click', () => {
    worldGenModal.classList.add('hidden');
    startNewWorld(readConfigFromModal());
  });

  function startNewWorld(config) {
    loadingOverlay.classList.remove('hidden');
    setTimeout(() => {
      clearEventLogDom();
      sim = new Simulation();
      sim.onEvent(onSimEvent);
      sim.init(config);
      renderer = new Renderer(canvas, sim);
      selectedKingdomId = null;
      renderer.selectedKingdomId = null;
      hideInspector();
      accumulator = 0;
      lastFrameTime = null;
      resizeCanvas();
      renderer.fitCamera();
      updateStatsPanel();
      updateLegend();
      loadingOverlay.classList.add('hidden');
      setPlaying(false);
    }, 20);
  }

  function resetWorld() {
    if (!sim) return;
    startNewWorld(sim.config);
  }
  document.getElementById('btnReset').addEventListener('click', resetWorld);

  // ---------------------------------------------------------------
  // Play / pause / speed
  // ---------------------------------------------------------------
  const btnPlayPause = document.getElementById('btnPlayPause');
  function setPlaying(v) {
    if (!sim) return;
    sim.running = v;
    btnPlayPause.innerHTML = v ? '&#10074;&#10074;' : '&#9654;';
  }
  btnPlayPause.addEventListener('click', () => setPlaying(!sim.running));

  document.getElementById('speedGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-btn');
    if (!btn || !sim) return;
    sim.speed = parseFloat(btn.dataset.speed);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  // ---------------------------------------------------------------
  // Map modes
  // ---------------------------------------------------------------
  document.getElementById('mapModeBar').addEventListener('click', (e) => {
    const btn = e.target.closest('.mapmode-btn');
    if (!btn || !renderer) return;
    renderer.setMapMode(btn.dataset.mode);
    document.querySelectorAll('.mapmode-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateLegend();
  });

  function updateLegend() {
    const legend = document.getElementById('legend');
    const mode = renderer ? renderer.mapMode : 'political';
    let html = '';
    if (mode === 'terrain') {
      html = Object.entries(TERRAIN_NAMES).map(([k, name]) =>
        `<div class="legend-item"><span class="legend-swatch" style="background:${TERRAIN_COLOR[k]}"></span>${name}</div>`).join('');
    } else if (mode === 'political') {
      html = `<div class="legend-item">Borders show kingdom territory &middot; click land to inspect</div>`;
    } else if (mode === 'population' || mode === 'wealth') {
      html = `<div class="legend-item"><span class="legend-swatch" style="background:rgb(70,130,220)"></span>Low</div>
              <div class="legend-item"><span class="legend-swatch" style="background:rgb(235,200,70)"></span>Mid</div>
              <div class="legend-item"><span class="legend-swatch" style="background:rgb(220,70,70)"></span>High</div>`;
    } else if (mode === 'stability') {
      html = `<div class="legend-item"><span class="legend-swatch" style="background:rgb(210,70,70)"></span>Unstable</div>
              <div class="legend-item"><span class="legend-swatch" style="background:rgb(70,195,110)"></span>Stable</div>`;
    } else if (mode === 'war') {
      html = `<div class="legend-item"><span class="legend-swatch" style="background:#e05a52"></span>Contested front</div>`;
    }
    legend.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Canvas camera controls
  // ---------------------------------------------------------------
  let dragging = false, dragMoved = false, dragStart = null;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; dragMoved = false;
    dragStart = { x: e.offsetX, y: e.offsetY };
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !renderer) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const dx = x - dragStart.x, dy = y - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    if (dragMoved) { renderer.pan(dx, dy); dragStart = { x, y }; }
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  canvas.addEventListener('click', (e) => {
    if (dragMoved || !renderer || !sim) return;
    const cell = renderer.screenToCell(e.offsetX, e.offsetY);
    if (!cell) return;
    const ownerId = sim.world.owner[cell.i];
    if (ownerId === -1) { deselectKingdom(); return; }
    selectKingdom(ownerId);
  });

  canvas.addEventListener('wheel', (e) => {
    if (!renderer) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    renderer.zoomAt(e.offsetX, e.offsetY, factor);
  }, { passive: false });

  // touch support (basic pan + pinch)
  let touchState = null;
  canvas.addEventListener('touchstart', (e) => {
    if (!renderer) return;
    if (e.touches.length === 1) {
      const t = e.touches[0]; const rect = canvas.getBoundingClientRect();
      touchState = { mode: 'pan', x: t.clientX - rect.left, y: t.clientY - rect.top, moved: false };
    } else if (e.touches.length === 2) {
      touchState = { mode: 'pinch', dist: touchDist(e), center: touchCenter(e, canvas) };
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!renderer || !touchState) return;
    const rect = canvas.getBoundingClientRect();
    if (touchState.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const x = t.clientX - rect.left, y = t.clientY - rect.top;
      const dx = x - touchState.x, dy = y - touchState.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) touchState.moved = true;
      renderer.pan(dx, dy);
      touchState.x = x; touchState.y = y;
    } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
      const newDist = touchDist(e);
      const factor = newDist / (touchState.dist || newDist);
      const c = touchState.center;
      renderer.zoomAt(c.x, c.y, factor);
      touchState.dist = newDist;
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (touchState && touchState.mode === 'pan' && !touchState.moved && renderer && sim) {
      const cell = renderer.screenToCell(touchState.x, touchState.y);
      if (cell) {
        const ownerId = sim.world.owner[cell.i];
        if (ownerId !== -1) selectKingdom(ownerId); else deselectKingdom();
      }
    }
    touchState = null;
  });
  function touchDist(e) { const [a, b] = e.touches; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function touchCenter(e, cnv) { const [a, b] = e.touches; const r = cnv.getBoundingClientRect(); return { x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top }; }

  // ---------------------------------------------------------------
  // Resize handling
  // ---------------------------------------------------------------
  function resizeCanvas() {
    if (!renderer) return;
    renderer.resize();
  }
  new ResizeObserver(resizeCanvas).observe(mapWrap);

  // ---------------------------------------------------------------
  // Sidebar toggle (mobile)
  // ---------------------------------------------------------------
  document.getElementById('btnSidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // ---------------------------------------------------------------
  // Kingdom inspector
  // ---------------------------------------------------------------
  const inspPanel = document.getElementById('panelInspector');
  function selectKingdom(id) {
    selectedKingdomId = id;
    renderer.selectedKingdomId = id;
    inspPanel.classList.remove('hidden');
    if (window.innerWidth <= 980) document.getElementById('sidebar').classList.add('open');
    populateInspector();
  }
  function deselectKingdom() {
    selectedKingdomId = null;
    if (renderer) renderer.selectedKingdomId = null;
    hideInspector();
  }
  function hideInspector() { inspPanel.classList.add('hidden'); }
  document.getElementById('btnCloseInspector').addEventListener('click', deselectKingdom);

  function populateInspector() {
    if (!sim) return;
    const k = sim.kingdoms.get(selectedKingdomId);
    if (!k || !k.alive) { deselectKingdom(); return; }
    document.getElementById('inspName').textContent = k.name;
    document.getElementById('inspSwatch').style.background = k.color;
    document.getElementById('inspDynasty').textContent = `House of ${k.dynasty}`;
    document.getElementById('inspPersonality').textContent = PERSONALITIES[k.personality].label;
    document.getElementById('inspAge').textContent = Math.round(sim.year - k.founded) + ' yrs';
    document.getElementById('inspRuler').textContent = k.ruler.display;
    document.getElementById('inspPopulation').textContent = fmtCompact(k.population);
    document.getElementById('inspTreasury').textContent = fmtGold(k.treasury);
    document.getElementById('inspMilitary').textContent = fmtCompact(k.military);
    document.getElementById('inspTech').textContent = k.tech.toFixed(2);
    document.getElementById('inspStability').textContent = Math.round(k.stability) + '%';
    document.getElementById('inspTerritory').textContent = k.territory.size + ' cells';
    const cap = sim.settlements.get(k.capitalSettlementId);
    document.getElementById('inspCapital').textContent = cap ? cap.name : '-';
    document.getElementById('inspSettlements').textContent = k.settlements.length;

    const wars = [], allies = [], rels = [];
    for (const [otherId, rel] of k.relations) {
      const other = sim.kingdoms.get(otherId);
      if (!other || !other.alive) continue;
      if (rel.status === 'war') wars.push(other);
      else if (rel.status === 'allied') allies.push(other);
      else rels.push({ other, rel });
    }
    document.getElementById('inspWars').innerHTML = wars.length
      ? wars.map(o => `<span class="chip war"><span class="dot" style="background:${o.color}"></span>${o.name}</span>`).join('')
      : '<span class="hint">At peace</span>';
    document.getElementById('inspAllies').innerHTML = allies.length
      ? allies.map(o => `<span class="chip ally"><span class="dot" style="background:${o.color}"></span>${o.name}</span>`).join('')
      : '<span class="hint">No allies</span>';
    document.getElementById('inspRelations').innerHTML = rels.length
      ? rels.map(({ other, rel }) => `<span class="chip"><span class="dot" style="background:${other.color}"></span>${other.name} &middot; ${rel.status}</span>`).join('')
      : '<span class="hint">No known neighbors</span>';

    const history = sim.eventLog.filter(ev => ev.kingdomIds.includes(k.id)).slice(-14).reverse();
    document.getElementById('inspHistory').innerHTML = history.length
      ? history.map(ev => `<div class="history-item"><span class="hy">${ev.year}</span>${escapeHtml(ev.text)}</div>`).join('')
      : '<div class="hint">No recorded history yet.</div>';
  }

  // ---------------------------------------------------------------
  // Event log
  // ---------------------------------------------------------------
  const eventLogEl = document.getElementById('eventLog');
  function clearEventLogDom() { eventLogEl.innerHTML = ''; }
  function onSimEvent(ev) {
    const div = document.createElement('div');
    div.className = 'event-item cat-' + ev.category;
    div.innerHTML = `<span class="ey">${ev.year}</span>${escapeHtml(ev.text)}`;
    eventLogEl.appendChild(div);
    while (eventLogEl.children.length > 200) eventLogEl.removeChild(eventLogEl.firstChild);
    eventLogEl.scrollTop = eventLogEl.scrollHeight;
  }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ---------------------------------------------------------------
  // World stats panel
  // ---------------------------------------------------------------
  function updateStatsPanel() {
    if (!sim) return;
    document.getElementById('yearValue').textContent = sim.yearLabel();
    const alive = sim.aliveKingdoms();
    let totalPop = 0, wars = 0, alliances = 0;
    let largest = null, oldest = null;
    for (const k of alive) {
      totalPop += k.population;
      wars += k.atWarCount();
      alliances += k.allyCount();
      if (!largest || k.territory.size > largest.territory.size) largest = k;
      if (!oldest || k.founded < oldest.founded) oldest = k;
    }
    document.getElementById('statKingdoms').textContent = alive.length;
    document.getElementById('statPopulation').textContent = fmtCompact(totalPop);
    document.getElementById('statWars').textContent = Math.round(wars / 2);
    document.getElementById('statAlliances').textContent = Math.round(alliances / 2);
    document.getElementById('statSettlements').textContent = sim.settlements.size;
    document.getElementById('statLargest').textContent = largest ? `${largest.name} (${largest.territory.size})` : '-';
    document.getElementById('statOldest').textContent = oldest ? `${oldest.name} (${Math.round(sim.year - oldest.founded)}y)` : '-';

    if (selectedKingdomId != null) populateInspector();
    updateWarTargetSelect();
  }

  // ---------------------------------------------------------------
  // Observer tools
  // ---------------------------------------------------------------
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => runTool(btn.dataset.tool));
  });
  function runTool(tool) {
    if (!sim) return;
    const id = selectedKingdomId;
    switch (tool) {
      case 'createKingdom': sim.observerCreateKingdom(); renderer.markOverlayDirty(); break;
      case 'destroyKingdom': if (id != null) { sim.observerDestroyKingdom(id); deselectKingdom(); renderer.markOverlayDirty(); } break;
      case 'stabilityUp': if (id != null) sim.observerAdjustStability(id, 15); break;
      case 'stabilityDown': if (id != null) sim.observerAdjustStability(id, -15); break;
      case 'addPopulation': if (id != null) sim.observerAddPopulation(id, 2000); break;
      case 'giveWealth': if (id != null) sim.observerGiveWealth(id, 1500); break;
      case 'createRebellion': if (id != null) { sim.observerCreateRebellion(id); renderer.markOverlayDirty(); } break;
      case 'forcePeace':
        for (const k of sim.aliveKingdoms()) for (const [otherId, rel] of k.relations) if (rel.atWar) sim.makePeace(k, sim.kingdoms.get(otherId), 'by decree');
        break;
    }
    updateStatsPanel();
  }

  const warTargetSelect = document.getElementById('warTargetSelect');
  function updateWarTargetSelect() {
    if (!sim) return;
    const prev = warTargetSelect.value;
    warTargetSelect.innerHTML = '';
    for (const k of sim.aliveKingdoms()) {
      if (k.id === selectedKingdomId) continue;
      const opt = document.createElement('option');
      opt.value = k.id; opt.textContent = k.name;
      warTargetSelect.appendChild(opt);
    }
    if (prev) warTargetSelect.value = prev;
  }
  document.getElementById('btnStartWar').addEventListener('click', () => {
    if (!sim || selectedKingdomId == null || !warTargetSelect.value) return;
    sim.observerStartWar(selectedKingdomId, parseInt(warTargetSelect.value, 10));
    populateInspector();
  });

  // ---------------------------------------------------------------
  // Collapsible panels
  // ---------------------------------------------------------------
  document.querySelectorAll('.collapse-toggle').forEach(h => {
    h.addEventListener('click', () => h.closest('.panel').classList.toggle('collapsed'));
  });

  // ---------------------------------------------------------------
  // World summary modal
  // ---------------------------------------------------------------
  const summaryModal = document.getElementById('summaryModal');
  document.getElementById('btnSummary').addEventListener('click', () => {
    if (!sim) return;
    const s = sim.getSummary();
    const rows = [
      ['Years Simulated', fmtInt(s.yearsSimulated)],
      ['Living Kingdoms', s.livingKingdoms],
      ['Kingdoms Founded', s.kingdomsFounded],
      ['Kingdoms Destroyed', s.kingdomsDestroyed],
      ['Wars Fought', s.warsFought],
      ['Rebellions', s.rebellions],
      ['Largest Empire Ever', `${s.largestEmpireEver.name} (${s.largestEmpireEver.size})`],
      ['Longest-Lived Kingdom', `${s.longestLived.name} (${s.longestLived.years}y)`],
      ['Most Successful Dynasty', s.mostSuccessfulDynasty.name],
      ['Highest Population', fmtCompact(s.highestPopulation.value)],
    ];
    document.getElementById('summaryStats').innerHTML = rows.map(([label, value]) =>
      `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`).join('');

    const timelineCats = new Set(['founding', 'collapse', 'rebellion', 'capital']);
    const timeline = sim.eventLog.filter(ev => timelineCats.has(ev.category)).slice(-40).reverse();
    document.getElementById('summaryTimeline').innerHTML = timeline.length
      ? timeline.map(ev => `<div class="history-item"><span class="hy">${ev.year}</span>${escapeHtml(ev.text)}</div>`).join('')
      : '<div class="hint">No major events recorded yet.</div>';

    summaryModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseSummary').addEventListener('click', () => summaryModal.classList.add('hidden'));

  // ---------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------
  function loop(now) {
    requestAnimationFrame(loop);
    if (!sim || !renderer) return;
    if (lastFrameTime == null) lastFrameTime = now;
    let dt = now - lastFrameTime;
    lastFrameTime = now;
    dt = Math.min(dt, MAX_FRAME_DT);

    if (sim.running) {
      accumulator += dt * sim.speed;
      let ticks = 0;
      while (accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
        sim.tick();
        accumulator -= TICK_MS;
        ticks++;
      }
      if (ticks > 0) {
        if (sim.dirty) { renderer.markOverlayDirty(); sim.dirty = false; }
        updateStatsPanel();
      }
    }
    renderer.render(now);
  }
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  startNewWorld({
    preset: 'balanced',
    worldSize: 'medium',
    numKingdoms: 6,
    landPercentage: 55,
    mountainFrequency: 30,
    resourceAbundance: 30,
    conflictLevel: 45,
    seed: 'kingdomautomata',
    startYear: 800,
  });
})();
