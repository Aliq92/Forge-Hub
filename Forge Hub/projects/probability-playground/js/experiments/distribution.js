/* distribution.js — Probability Distribution Builder */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, statGrid, standardEducation, runControls, clear } = PP.ui;
  const { pickWeighted } = PP.random;

  let idCounter = 0;
  function nextLabel(n) {
    return `Outcome ${String.fromCharCode(65 + (n % 26))}`;
  }

  function init(stageEl, panelEl) {
    const state = {
      outcomes: [
        { id: idCounter++, label: 'Outcome A', weight: 50 },
        { id: idCounter++, label: 'Outcome B', weight: 30 },
        { id: idCounter++, label: 'Outcome C', weight: 20 },
      ],
      counts: {},
      draws: 0,
    };
    function resetCounts() {
      state.counts = {};
      state.outcomes.forEach((o) => (state.counts[o.id] = 0));
      state.draws = 0;
    }
    resetCounts();

    /* ---------- Stage ---------- */
    stageEl.appendChild(el('div', { class: 'section-title', text: 'Define your outcomes' }));
    const builder = el('div', { class: 'card', style: 'margin-bottom:16px;' });
    stageEl.appendChild(builder);
    const addBtn = el('button', { class: 'btn small', text: '+ Add outcome', onclick: () => {
      state.outcomes.push({ id: idCounter++, label: nextLabel(state.outcomes.length), weight: 10 });
      resetCounts();
      renderBuilder();
      draw();
      pushShare();
    } });

    function renderBuilder() {
      clear(builder);
      const totalW = state.outcomes.reduce((s, o) => s + Math.max(0, o.weight), 0) || 1;
      state.outcomes.forEach((o) => {
        const pct = (Math.max(0, o.weight) / totalW) * 100;
        const row = el('div', { class: 'builder-row' }, [
          el('input', { type: 'text', value: o.label, 'aria-label': 'Outcome label', oninput: (e) => { o.label = e.target.value; draw(); pushShare(); } }),
          el('input', { type: 'number', min: '0', step: '1', value: o.weight, 'aria-label': 'Outcome weight', oninput: (e) => {
            o.weight = Math.max(0, Number(e.target.value) || 0);
            resetCounts();
            renderBuilder();
            draw();
            pushShare();
          } }),
          el('span', { class: 'badge', style: 'min-width:52px;text-align:center;', text: fmtPct(pct, 1) }),
          el('button', { class: 'remove-row', text: '×', 'aria-label': `Remove ${o.label}`, disabled: state.outcomes.length <= 1, onclick: () => {
            state.outcomes = state.outcomes.filter((x) => x.id !== o.id);
            resetCounts();
            renderBuilder();
            draw();
            pushShare();
          } }),
        ]);
        builder.appendChild(row);
      });
      builder.appendChild(addBtn);
    }
    renderBuilder();

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Expected vs. observed frequency' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:260px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Amber marks show the expected count based on your weights; teal bars show what actually happened across your draws.' }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Draw ×1',
      quickAmounts: [10, 100, 1000],
      quickLabelFn: (n) => `Draw ×${fmtNum(n)}`,
      onQuick: (n) => { doDraws(n); draw(); pushShare(); },
      onStep: () => { doDraws(1); draw(); pushShare(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => { resetCounts(); loop.pause(); rc.setPlayingUI(false); draw(); pushShare(); },
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'draws', label: 'Total draws', value: '0' },
      { key: 'outcomes', label: 'Outcomes defined', value: '3' },
      { key: 'topExpected', label: 'Most likely outcome', value: '—' },
      { key: 'topObserved', label: 'Most drawn outcome', value: '—' },
    ]);

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'You assign a relative weight to each outcome (like loot-table odds in a game, or ticket odds in a raffle). Weights are normalized into probabilities automatically.',
      theory: 'Each outcome\'s probability = its weight ÷ the sum of all weights. This is exactly how weighted randomness works in many games, loot boxes, and simulations.',
      notice: 'With few draws, rare outcomes may not appear at all, or common outcomes may be under-represented. As draws increase, observed frequencies converge toward the weighted probabilities.',
    });

    /* ---------- Simulation ---------- */
    function doDraws(n) {
      const items = state.outcomes.map((o) => ({ value: o.id, weight: Math.max(0, o.weight) }));
      if (!items.some((i) => i.weight > 0)) return;
      for (let i = 0; i < n; i++) {
        const id = pickWeighted(items);
        state.counts[id] = (state.counts[id] || 0) + 1;
        state.draws++;
      }
    }

    function draw() {
      const totalW = state.outcomes.reduce((s, o) => s + Math.max(0, o.weight), 0) || 1;
      let topExpected = null, topExpectedV = -1, topObserved = null, topObservedV = -1;
      state.outcomes.forEach((o) => {
        const expPct = (Math.max(0, o.weight) / totalW) * 100;
        if (expPct > topExpectedV) { topExpectedV = expPct; topExpected = o.label; }
        const c = state.counts[o.id] || 0;
        if (c > topObservedV) { topObservedV = c; topObserved = o.label; }
      });

      stats.update('draws', fmtNum(state.draws));
      stats.update('outcomes', String(state.outcomes.length));
      stats.update('topExpected', topExpected || '—');
      stats.update('topObserved', state.draws ? (topObserved || '—') : '—');

      const bars = state.outcomes.map((o) => ({ label: o.label, value: state.counts[o.id] || 0 }));
      const theoretical = state.outcomes.map((o) => ({ value: (Math.max(0, o.weight) / totalW) * state.draws }));
      PP.charts.barChart(canvas, { bars, theoretical, yFormat: (v) => fmtNum(Math.round(v)) });
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doDraws(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return {}; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'distribution',
    group: 'extra',
    name: 'Distribution Builder',
    tagline: 'Design your own weighted-random outcomes and see how draw frequencies match your assigned probabilities.',
    init,
  });
})(window);
