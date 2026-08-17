/* lln.js — Law of Large Numbers */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, runControls, HistoryBuffer } = PP.ui;
  const { chance } = PP.random;

  function init(stageEl, panelEl, params) {
    const state = {
      p: params.p !== undefined ? Math.min(0.99, Math.max(0.01, parseFloat(params.p))) : 0.5,
      trials: 0,
      successes: 0,
      history: new HistoryBuffer(600),
    };
    if (!isFinite(state.p)) state.p = 0.5;

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const pField = el('div', { class: 'field', style: 'min-width:220px;' }, [
      el('label', { class: 'field-label', text: `Event probability: ${Math.round(state.p * 100)}%` }),
      (() => {
        const range = el('input', { type: 'range', min: 1, max: 99, value: Math.round(state.p * 100) });
        range.addEventListener('input', (e) => {
          state.p = Number(e.target.value) / 100;
          pField.querySelector('label').textContent = `Event probability: ${e.target.value}%`;
          draw();
          pushShare();
        });
        return range;
      })(),
    ]);
    const presetField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Presets' }),
      el('div', { class: 'pill-group' }, [10, 25, 50, 70, 90].map((v) =>
        el('button', { text: `${v}%`, onclick: () => setP(v / 100) })
      )),
    ]);
    toolbar.appendChild(pField);
    toolbar.appendChild(presetField);
    stageEl.appendChild(toolbar);

    function setP(p) {
      state.p = p;
      pField.querySelector('input[type=range]').value = Math.round(p * 100);
      pField.querySelector('label').textContent = `Event probability: ${Math.round(p * 100)}%`;
      draw();
      pushShare();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Observed probability over time' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:280px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Each "trial" is a single independent event that succeeds with the probability above. Watch the teal line swing wildly over the first few dozen trials, then flatten out toward the amber theoretical line as trials accumulate.' }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Trial ×1',
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

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'trials', label: 'Trials', value: '0' },
      { key: 'successes', label: 'Successes', value: '0' },
      { key: 'obs', label: 'Observed probability', value: '—' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical probability', observedLabel: 'Observed probability' });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'Each trial is a Bernoulli event: it succeeds with a fixed probability p and fails otherwise, independent of every other trial — like a weighted coin flip.',
      theory: `The theoretical (long-run) success probability is fixed at <strong>${fmtPct(state.p * 100)}</strong> by design. It never changes — only your estimate of it, based on observed trials, changes.`,
      notice: 'The Law of Large Numbers says the observed proportion converges to the true probability as trials grow — it does not say early fluctuations get "corrected." A run of bad luck is simply diluted by the volume of later trials, not cancelled out.',
    });

    /* ---------- Simulation ---------- */
    function doTrials(n) {
      for (let i = 0; i < n; i++) {
        if (chance(state.p)) state.successes++;
        state.trials++;
        state.history.push(state.trials, state.successes / state.trials);
      }
    }

    function draw() {
      const obs = state.trials ? (state.successes / state.trials) * 100 : NaN;
      const theo = state.p * 100;
      stats.update('trials', fmtNum(state.trials));
      stats.update('successes', fmtNum(state.successes));
      stats.update('obs', state.trials ? fmtPct(obs) : '—', undefined, 'accent');

      theory.update({
        theoretical: fmtPct(theo),
        observed: state.trials ? fmtPct(obs) : '—',
        diff: state.trials ? fmtSigned(obs - theo, 2, ' pts') : '—',
        trials: fmtNum(state.trials),
      });
      theory.updateBar(state.trials ? obs : 0, theo, 100);

      PP.charts.lineChart(canvas, {
        series: [{ points: state.history.points, color: '#4fd1c5' }],
        refLines: [{ y: state.p, color: '#f0a500', label: `theoretical p=${state.p.toFixed(2)}` }],
        yMin: 0, yMax: 1,
        yFormat: (v) => `${Math.round(v * 100)}%`,
        xFormat: (v) => `n=${fmtNum(Math.round(v))}`,
      });
    }

    function reset() {
      state.trials = 0;
      state.successes = 0;
      state.history.reset();
      loop.pause();
      rc.setPlayingUI(false);
      draw();
      pushShare();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doTrials(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { p: state.p.toFixed(2) }; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'lln',
    group: 'core',
    name: 'Law of Large Numbers',
    tagline: 'Run repeated independent trials and watch the observed probability settle toward the true value.',
    init,
  });
})(window);
