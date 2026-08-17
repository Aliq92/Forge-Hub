/* expectedValue.js — Expected Value Lab */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, runControls, HistoryBuffer, clear } = PP.ui;
  const { pickWeighted } = PP.random;

  let idCounter = 0;
  function outcome(label, prob, reward) {
    return { id: idCounter++, label, prob, reward };
  }
  const PRESETS = {
    fair: () => [outcome('Win', 50, 10), outcome('Lose', 50, -10)],
    positive: () => [outcome('Win', 50, 10), outcome('Lose', 50, -8)],
    negative: () => [outcome('Win', 50, 8), outcome('Lose', 50, -12)],
  };

  function init(stageEl, panelEl) {
    const state = {
      outcomes: PRESETS.positive(),
      plays: 0,
      cumulative: 0,
      history: new HistoryBuffer(500),
    };

    /* ---------- Stage ---------- */
    const presetRow = el('div', { class: 'toolbar' }, [
      el('div', { class: 'field' }, [
        el('label', { class: 'field-label', text: 'Presets' }),
        el('div', { class: 'pill-group' }, [
          el('button', { text: 'Fair Game', onclick: () => applyPreset('fair') }),
          el('button', { text: 'Positive EV', onclick: () => applyPreset('positive') }),
          el('button', { text: 'Negative EV', onclick: () => applyPreset('negative') }),
        ]),
      ]),
    ]);
    stageEl.appendChild(presetRow);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Build your game' }));
    const builder = el('div', { class: 'card', style: 'margin-bottom:8px;' });
    stageEl.appendChild(builder);
    const addBtn = el('button', { class: 'btn small', text: '+ Add outcome', onclick: () => {
      state.outcomes.push(outcome(`Outcome ${state.outcomes.length + 1}`, 10, 0));
      renderBuilder();
      resetPlays();
    } });

    function renderBuilder() {
      clear(builder);
      builder.appendChild(el('div', { style: 'display:flex;gap:8px;font-family:var(--mono);font-size:10.5px;color:var(--text-2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;padding-left:2px;' }, [
        el('span', { style: 'flex:1;', text: 'Outcome' }),
        el('span', { style: 'width:90px;', text: 'Prob. weight' }),
        el('span', { style: 'width:90px;', text: 'Reward ($)' }),
        el('span', { style: 'width:52px;', text: '%' }),
      ]));
      const totalW = state.outcomes.reduce((s, o) => s + Math.max(0, o.prob), 0) || 1;
      state.outcomes.forEach((o) => {
        const pct = (Math.max(0, o.prob) / totalW) * 100;
        const row = el('div', { class: 'builder-row' }, [
          el('input', { type: 'text', value: o.label, oninput: (e) => { o.label = e.target.value; draw(); } }),
          el('input', { type: 'number', min: '0', step: '1', value: o.prob, style: 'width:90px;', oninput: (e) => { o.prob = Math.max(0, Number(e.target.value) || 0); renderBuilder(); resetPlays(); } }),
          el('input', { type: 'number', step: '1', value: o.reward, style: 'width:90px;', oninput: (e) => { o.reward = Number(e.target.value) || 0; draw(); } }),
          el('span', { class: 'badge', style: 'width:52px;text-align:center;', text: fmtPct(pct, 0) }),
          el('button', { class: 'remove-row', text: '×', disabled: state.outcomes.length <= 1, onclick: () => { state.outcomes = state.outcomes.filter((x) => x.id !== o.id); renderBuilder(); resetPlays(); } }),
        ]);
        builder.appendChild(row);
      });
      builder.appendChild(addBtn);
    }
    renderBuilder();

    function applyPreset(key) {
      state.outcomes = PRESETS[key]();
      renderBuilder();
      resetPlays();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Running average payout per play' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:230px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Fictional money for illustration only. The amber line is the mathematical Expected Value — what the average payout per play converges to over many plays.' }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Play ×1',
      quickAmounts: [10, 100, 1000],
      quickLabelFn: (n) => `Play ×${fmtNum(n)}`,
      onQuick: (n) => { doPlays(n); draw(); },
      onStep: () => { doPlays(1); draw(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => resetPlays(),
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'ev', label: 'Expected value / play', value: '—' },
      { key: 'plays', label: 'Plays', value: '0' },
      { key: 'cumulative', label: 'Cumulative total', value: '$0' },
      { key: 'avg', label: 'Observed average / play', value: '—' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Expected value / play', observedLabel: 'Observed average / play', showBar: false });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);

    /* ---------- Simulation ---------- */
    function computeEV() {
      const totalW = state.outcomes.reduce((s, o) => s + Math.max(0, o.prob), 0) || 1;
      return state.outcomes.reduce((s, o) => s + (Math.max(0, o.prob) / totalW) * o.reward, 0);
    }

    function doPlays(n) {
      const items = state.outcomes.map((o) => ({ value: o.reward, weight: Math.max(0, o.prob) }));
      if (!items.some((i) => i.weight > 0)) return;
      for (let i = 0; i < n; i++) {
        const reward = pickWeighted(items);
        state.cumulative += reward;
        state.plays++;
        state.history.push(state.plays, state.cumulative / state.plays);
      }
    }

    function draw() {
      const ev = computeEV();
      const avg = state.plays ? state.cumulative / state.plays : NaN;

      stats.update('ev', `${ev >= 0 ? '+' : '−'}$${fmtNum(Math.abs(ev), 2)}`, undefined, ev > 0 ? 'accent' : ev < 0 ? 'rose' : undefined);
      stats.update('plays', fmtNum(state.plays));
      stats.update('cumulative', `${state.cumulative >= 0 ? '' : '−'}$${fmtNum(Math.abs(state.cumulative), 2)}`, undefined, state.cumulative >= 0 ? 'accent' : 'rose');
      stats.update('avg', state.plays ? `${avg >= 0 ? '' : '−'}$${fmtNum(Math.abs(avg), 2)}` : '—');

      theory.update({
        theoretical: `${ev >= 0 ? '+' : '−'}$${fmtNum(Math.abs(ev), 2)}`,
        observed: state.plays ? `${avg >= 0 ? '+' : '−'}$${fmtNum(Math.abs(avg), 2)}` : '—',
        diff: state.plays ? `${(avg - ev) >= 0 ? '+' : '−'}$${fmtNum(Math.abs(avg - ev), 2)}` : '—',
        trials: fmtNum(state.plays),
      });

      PP.charts.lineChart(canvas, {
        series: [{ points: state.history.points, color: '#4fd1c5' }],
        refLines: [{ y: ev, color: '#f0a500', label: `EV = ${ev >= 0 ? '+' : '−'}$${Math.abs(ev).toFixed(2)}` }],
        yFormat: (v) => `$${v.toFixed(1)}`,
        xFormat: (v) => `play ${fmtNum(Math.round(v))}`,
      });

      const verdict = ev > 0.001 ? 'a <strong>positive</strong>' : ev < -0.001 ? 'a <strong>negative</strong>' : 'a <strong>break-even</strong>';
      standardEducation(eduContainer, {
        what: 'You built a game with a few possible outcomes, each with a probability weight and a fictional dollar reward (or loss). Playing repeatedly samples from that distribution.',
        theory: `Expected Value = Σ (probability × reward) for every outcome. For this exact game, EV = <strong>${ev >= 0 ? '+' : '−'}$${Math.abs(ev).toFixed(2)}</strong> per play — ${verdict} expected value.`,
        notice: 'A game can feel exciting (frequent small wins, or one big possible payout) while still having negative expected value overall — and vice versa. Only the long-run average, not any single play, reveals which.',
      });
    }

    function resetPlays() {
      state.plays = 0;
      state.cumulative = 0;
      state.history.reset();
      loop.pause();
      rc.setPlayingUI(false);
      draw();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doPlays(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    draw();

    return {
      destroy() { loop.destroy(); },
      getShareParams() { return {}; },
      onResize() { draw(); },
    };
  }

  PP.registerExperiment({
    id: 'expectedvalue',
    group: 'extra',
    name: 'Expected Value Lab',
    tagline: 'Design a simple game of chance, compute its expected value, then play it thousands of times to see the math play out.',
    init,
  });
})(window);
