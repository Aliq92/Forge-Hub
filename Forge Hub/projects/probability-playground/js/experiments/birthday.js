/* birthday.js — Birthday Paradox */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, challengeBox, runControls, clear } = PP.ui;
  const { randInt } = PP.random;
  const DAYS = 365;

  function theoreticalProb(n) {
    if (n > DAYS) return 1;
    let p = 1;
    for (let i = 0; i < n; i++) p *= (DAYS - i) / DAYS;
    return 1 - p;
  }
  function firstNAtOrAbove(threshold) {
    for (let n = 1; n <= DAYS; n++) if (theoreticalProb(n) >= threshold) return n;
    return DAYS;
  }

  function init(stageEl, panelEl, params) {
    const state = {
      n: params.people ? Math.min(100, Math.max(2, parseInt(params.people, 10))) : 23,
      trials: 0,
      collisions: 0,
      lastDays: [],
      lastCollision: null,
    };

    const curve = [];
    for (let n = 1; n <= 100; n++) curve.push({ x: n, y: theoreticalProb(n) });
    const n50 = firstNAtOrAbove(0.5);

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const sizeField = el('div', { class: 'field', style: 'min-width:220px;' }, [
      el('label', { class: 'field-label', text: `Group size: ${state.n} people` }),
      (() => {
        const range = el('input', { type: 'range', min: 2, max: 100, value: state.n });
        range.addEventListener('input', (e) => {
          state.n = Number(e.target.value);
          sizeField.querySelector('label').textContent = `Group size: ${state.n} people`;
          draw();
          pushShare();
        });
        return range;
      })(),
    ]);
    const presetField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Presets' }),
      el('div', { class: 'pill-group' }, [10, 20, 23, 30, 50].map((v) =>
        el('button', { text: String(v), onclick: () => setN(v) })
      )),
    ]);
    toolbar.appendChild(sizeField);
    toolbar.appendChild(presetField);
    stageEl.appendChild(toolbar);

    function setN(v) {
      state.n = v;
      sizeField.querySelector('input[type=range]').value = v;
      sizeField.querySelector('label').textContent = `Group size: ${state.n} people`;
      draw();
      pushShare();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Latest group' }));
    const grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:5px;min-height:44px;margin-bottom:6px;' });
    stageEl.appendChild(grid);
    const resultLine = el('p', { class: 'hint' });
    stageEl.appendChild(resultLine);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Probability of a shared birthday vs. group size' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:250px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: `The amber curve is the exact theoretical probability. It crosses 50% at just ${n50} people — far fewer than most people guess, because you're comparing every pair in the group, not just one person's birthday against everyone else's.` }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Run One Group',
      quickAmounts: [10, 100, 1000, 10000],
      quickLabelFn: (n) => `Run ×${fmtNum(n)}`,
      onQuick: (n) => { doTrials(n); draw(); pushShare(); },
      onStep: () => { doTrials(1); draw(); pushShare(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => reset(),
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    const challengeContainer = el('div');
    stageEl.appendChild(challengeContainer);
    challengeBox(challengeContainer, {
      question: 'How many people are needed before a shared birthday becomes MORE LIKELY than not (>50% chance)?',
      options: [{ label: '183 (half of 365)', v: 183 }, { label: '23', v: 23 }, { label: '50', v: 50 }, { label: '100', v: 100 }],
      onAnswer: (opt) => {
        if (opt.v === 23) return `Correct — it's 23. It feels too low because we're comparing every pair of people (23 people = 253 pairs), not just one birthday against 364 others.`;
        return `It's actually 23, not ${opt.label}. With 23 people there are 253 distinct pairs of birthdays to compare, and that's enough pairs to push the collision probability above 50%. Set the slider to 23 and run some batches below.`;
      },
    });

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'trials', label: 'Groups simulated', value: '0' },
      { key: 'collisions', label: 'Groups with a match', value: '0' },
      { key: 'rate', label: 'Observed match rate', value: '—' },
      { key: 'last', label: 'Last group result', value: '—' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical match probability', observedLabel: 'Observed match rate' });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);

    /* ---------- Simulation ---------- */
    function runOnce() {
      const days = [];
      const seen = new Set();
      let collision = false;
      for (let i = 0; i < state.n; i++) {
        const d = randInt(1, DAYS);
        days.push(d);
        if (seen.has(d)) collision = true;
        seen.add(d);
      }
      state.trials++;
      if (collision) state.collisions++;
      return { days, collision };
    }
    function doTrials(n) {
      let last;
      for (let i = 0; i < n; i++) last = runOnce();
      state.lastDays = last.days;
      state.lastCollision = last.collision;
    }

    function renderGrid() {
      clear(grid);
      const dupDays = new Set();
      const counts = {};
      state.lastDays.forEach((d) => { counts[d] = (counts[d] || 0) + 1; if (counts[d] > 1) dupDays.add(d); });
      state.lastDays.forEach((d) => {
        const isDup = dupDays.has(d);
        grid.appendChild(el('div', {
          title: `Day ${d} of 365`,
          style: `width:16px;height:16px;border-radius:4px;font-size:0;` +
            (isDup ? 'background:var(--rose);box-shadow:0 0 6px rgba(239,111,122,0.7);' : 'background:var(--bg-3);border:1px solid var(--border);'),
        }));
      });
      resultLine.textContent = state.lastDays.length
        ? (state.lastCollision ? `Match found! Highlighted squares share a birthday.` : `No shared birthday in this group of ${state.lastDays.length}.`)
        : 'Run a group to see individual birthdays plotted here.';
    }

    function draw() {
      const theoP = theoreticalProb(state.n) * 100;
      const obsP = state.trials ? (state.collisions / state.trials) * 100 : NaN;

      stats.update('trials', fmtNum(state.trials));
      stats.update('collisions', fmtNum(state.collisions));
      stats.update('rate', state.trials ? fmtPct(obsP) : '—', undefined, 'accent');
      stats.update('last', state.lastDays.length ? (state.lastCollision ? 'Match ✓' : 'No match') : '—', undefined, state.lastCollision ? 'rose' : undefined);

      theory.update({
        theoretical: fmtPct(theoP),
        observed: state.trials ? fmtPct(obsP) : '—',
        diff: state.trials ? fmtSigned(obsP - theoP, 2, ' pts') : '—',
        trials: fmtNum(state.trials),
      });
      theory.updateBar(state.trials ? obsP : 0, theoP, 100);

      renderGrid();

      const series = [{ points: curve, color: '#f0a500', label: 'theoretical' }];
      if (state.trials) series.push({ points: [{ x: state.n, y: obsP / 100 }], color: '#4fd1c5', marker: true, markerRadius: 6, label: 'observed' });
      PP.charts.lineChart(canvas, {
        series,
        refLines: [
          { x: n50, color: 'rgba(255,255,255,0.3)', label: `50% at n=${n50}` },
          { x: state.n, color: '#a78bfa', label: `n=${state.n}` },
        ],
        yMin: 0, yMax: 1, xMin: 1, xMax: 100,
        yFormat: (v) => `${Math.round(v * 100)}%`,
        xFormat: (v) => `${Math.round(v)}`,
      });

      standardEducation(eduContainer, {
        what: `Each simulated "group" gives every one of ${state.n} people a uniformly random birthday from 365 days (leap days ignored). We check whether any two people share a day.`,
        theory: `Theoretical probability = 1 &minus; P(all different). For n=${state.n} that works out to <strong>${fmtPct(theoP)}</strong>.`,
        notice: 'The probability rises much faster than intuition suggests, because the number of *pairs* of people grows quadratically with group size — n people form n(n&minus;1)/2 pairs, and any one of those pairs can collide.',
      });
    }

    function reset() {
      state.trials = 0;
      state.collisions = 0;
      state.lastDays = [];
      state.lastCollision = null;
      loop.pause();
      rc.setPlayingUI(false);
      draw();
      pushShare();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doTrials(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { people: state.n }; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'birthday',
    group: 'core',
    name: 'Birthday Paradox',
    tagline: 'Simulate random birthdays in a group and see how quickly a shared birthday becomes likely.',
    init,
  });
})(window);
