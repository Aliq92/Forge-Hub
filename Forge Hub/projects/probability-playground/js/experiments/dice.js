/* dice.js — Dice Lab */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, challengeBox, runControls, clear } = PP.ui;
  const { randInt } = PP.random;

  function theoreticalDistribution(n, sides) {
    let dist = { 0: 1 };
    for (let d = 0; d < n; d++) {
      const next = {};
      Object.keys(dist).forEach((sStr) => {
        const s = Number(sStr);
        const p = dist[s];
        for (let face = 1; face <= sides; face++) {
          const ns = s + face;
          next[ns] = (next[ns] || 0) + p / sides;
        }
      });
      dist = next;
    }
    return dist;
  }

  function init(stageEl, panelEl, params) {
    const state = {
      numDice: params.n ? Math.min(3, Math.max(1, parseInt(params.n, 10))) : 2,
      sides: params.sides ? parseInt(params.sides, 10) : 6,
      rolls: 0,
      sumTotal: 0,
      freq: {},
      lastRoll: [],
    };
    if (![4, 6, 8, 10, 12, 20].includes(state.sides)) state.sides = 6;

    function resetFreq() {
      state.freq = {};
      for (let s = state.numDice; s <= state.numDice * state.sides; s++) state.freq[s] = 0;
    }
    resetFreq();

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const numField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Number of dice' }),
      el('div', { class: 'pill-group' }, [1, 2, 3].map((n) =>
        el('button', { text: String(n), class: n === state.numDice ? 'active' : '', onclick: (e) => setNumDice(n, e.target) })
      )),
    ]);
    const sidesField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Die size' }),
      el('div', { class: 'pill-group' }, [4, 6, 8, 10, 12, 20].map((s) =>
        el('button', { text: `D${s}`, class: s === state.sides ? 'active' : '', onclick: (e) => setSides(s, e.target) })
      )),
    ]);
    const presetField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Preset' }),
      el('div', { class: 'pill-group' }, [
        el('button', { text: 'Single D6', onclick: () => applyPreset(1, 6) }),
        el('button', { text: 'Two D6', onclick: () => applyPreset(2, 6) }),
        el('button', { text: 'D20', onclick: () => applyPreset(1, 20) }),
      ]),
    ]);
    toolbar.appendChild(numField);
    toolbar.appendChild(sidesField);
    toolbar.appendChild(presetField);
    stageEl.appendChild(toolbar);

    function refreshPillActive(field, value) {
      field.querySelectorAll('.pill-group button').forEach((b) => b.classList.toggle('active', b.textContent === String(value) || b.textContent === `D${value}`));
    }
    function setNumDice(n) {
      state.numDice = n;
      resetFreq();
      refreshPillActive(numField, n);
      updateHistTheory();
      draw();
      pushShare();
    }
    function setSides(s) {
      state.sides = s;
      resetFreq();
      refreshPillActive(sidesField, s);
      updateHistTheory();
      draw();
      pushShare();
    }
    function applyPreset(n, s) {
      state.numDice = n;
      state.sides = s;
      resetFreq();
      refreshPillActive(numField, n);
      refreshPillActive(sidesField, s);
      updateHistTheory();
      draw();
      pushShare();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Latest roll' }));
    const diceRow = el('div', { class: 'dice-row' });
    stageEl.appendChild(diceRow);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Sum frequency distribution' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:260px;' });
    stageEl.appendChild(canvas);
    const histHint = el('p', { class: 'hint' });
    stageEl.appendChild(histHint);

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Roll ×1',
      quickAmounts: [10, 100, 1000],
      quickLabelFn: (n) => `Roll ×${fmtNum(n)}`,
      onQuick: (n) => { doRolls(n); draw(); pushShare(); },
      onStep: () => { doRolls(1); draw(); pushShare(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => reset(),
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    const challengeContainer = el('div');
    stageEl.appendChild(challengeContainer);
    function showChallenge() {
      clear(challengeContainer);
      if (state.numDice !== 2 || state.sides !== 6) return;
      challengeBox(challengeContainer, {
        question: 'Rolling two D6 dice, which sum do you think will come up most often?',
        options: [2, 5, 7, 9, 12].map((v) => ({ label: String(v), v })),
        onAnswer: (opt) => {
          if (opt.v === 7) return 'Correct! There are 6 ways to make a 7 (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) — more than any other sum — which is why the distribution peaks in the middle and tapers toward 2 and 12.';
          return `7 is actually the most likely sum — it has 6 different dice combinations that produce it, more than any other total. Roll a few hundred times below and watch the histogram peak there.`;
        },
      });
    }
    showChallenge();

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'rolls', label: 'Rolls', value: '0' },
      { key: 'avg', label: 'Average sum', value: '—' },
      { key: 'mode', label: 'Most frequent sum', value: '—' },
      { key: 'last', label: 'Last roll', value: '—' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical average sum', observedLabel: 'Observed average sum', showBar: false });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    let theoDist = theoreticalDistribution(state.numDice, state.sides);

    function updateHistTheory() {
      theoDist = theoreticalDistribution(state.numDice, state.sides);
      const isD6pair = state.numDice === 2 && state.sides === 6;
      histHint.textContent = isD6pair
        ? 'Notice the triangular, bell-like shape: sums near 7 have many more dice combinations than sums near 2 or 12.'
        : `Each face of a D${state.sides} is equally likely, but sums of multiple dice cluster toward the middle — more combinations add up to a middle value than to an extreme one.`;
      standardEducation(eduContainer, {
        what: `You're rolling ${state.numDice} × D${state.sides} and looking at the sum. Each die is fair — every face has probability 1/${state.sides} — but the <em>sum</em> of several dice is not uniform.`,
        theory: `The theoretical average sum is ${state.numDice} × (${state.sides}+1)/2 = <strong>${(state.numDice * (state.sides + 1) / 2).toFixed(2)}</strong>. The full theoretical distribution (amber marks on the chart) is computed exactly by counting combinations, not simulated.`,
        notice: state.numDice === 1
          ? 'With a single die every face should occur about equally often — any single face standing out early is just small-sample noise.'
          : 'With 2+ dice, middle sums are far more common than extreme ones, because there are more ways to combine dice values to reach a middle sum. Watch the histogram bars approach the amber theoretical marks as rolls accumulate.',
      });
    }
    updateHistTheory();

    /* ---------- Simulation ---------- */
    function rollOnce() {
      const faces = [];
      for (let i = 0; i < state.numDice; i++) faces.push(randInt(1, state.sides));
      const sum = faces.reduce((a, b) => a + b, 0);
      state.rolls++;
      state.sumTotal += sum;
      state.freq[sum] = (state.freq[sum] || 0) + 1;
      state.lastRoll = faces;
      return { faces, sum };
    }
    function doRolls(n) {
      let last;
      for (let i = 0; i < n; i++) last = rollOnce();
      return last;
    }

    function renderDice() {
      clear(diceRow);
      state.lastRoll.forEach((f) => diceRow.appendChild(el('div', { class: 'die-face', text: String(f) })));
      if (state.lastRoll.length) diceRow.appendChild(el('div', { class: 'dice-sum', text: `= ${state.lastRoll.reduce((a, b) => a + b, 0)}` }));
    }

    function draw() {
      const avg = state.rolls ? state.sumTotal / state.rolls : 0;
      const theoAvg = state.numDice * (state.sides + 1) / 2;
      let modeSum = null, modeCount = -1;
      Object.keys(state.freq).forEach((s) => { if (state.freq[s] > modeCount) { modeCount = state.freq[s]; modeSum = s; } });

      stats.update('rolls', fmtNum(state.rolls));
      stats.update('avg', state.rolls ? avg.toFixed(2) : '—');
      stats.update('mode', state.rolls ? `${modeSum} (${fmtNum(modeCount)}×)` : '—');
      stats.update('last', state.lastRoll.length ? `${state.lastRoll.join(' + ')} = ${state.lastRoll.reduce((a, b) => a + b, 0)}` : '—');

      theory.update({
        theoretical: theoAvg.toFixed(2),
        observed: state.rolls ? avg.toFixed(2) : '—',
        diff: state.rolls ? fmtSigned(avg - theoAvg, 2) : '—',
        trials: fmtNum(state.rolls),
      });

      renderDice();

      const sums = Object.keys(state.freq).map(Number).sort((a, b) => a - b);
      const bars = sums.map((s) => ({ label: s, value: state.freq[s] || 0 }));
      const theoretical = sums.map((s) => ({ value: (theoDist[s] || 0) * state.rolls }));
      PP.charts.barChart(canvas, { bars, theoretical, yFormat: (v) => fmtNum(Math.round(v)) });
    }

    function reset() {
      state.rolls = 0;
      state.sumTotal = 0;
      resetFreq();
      state.lastRoll = [];
      loop.pause();
      rc.setPlayingUI(false);
      draw();
      pushShare();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doRolls(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { n: state.numDice, sides: state.sides }; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'dice',
    group: 'core',
    name: 'Dice Lab',
    tagline: 'Roll 1–3 dice of any common size and watch the sum distribution take shape.',
    init,
  });
})(window);
