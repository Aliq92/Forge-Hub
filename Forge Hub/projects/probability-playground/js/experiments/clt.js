/* clt.js — Central Limit Theorem */
(function (global) {
  const PP = global.PP;
  const { el, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, runControls, clear } = PP.ui;
  const { pickWeighted } = PP.random;

  // Deliberately skewed, non-normal population.
  const POP = [
    { value: 1, weight: 40 }, { value: 2, weight: 25 }, { value: 3, weight: 15 },
    { value: 5, weight: 10 }, { value: 8, weight: 6 }, { value: 15, weight: 2.5 },
    { value: 30, weight: 1 }, { value: 50, weight: 0.5 },
  ];
  const totalW = POP.reduce((s, p) => s + p.weight, 0);
  const popMean = POP.reduce((s, p) => s + (p.weight / totalW) * p.value, 0);
  const popVar = POP.reduce((s, p) => s + (p.weight / totalW) * (p.value - popMean) ** 2, 0);
  const popSD = Math.sqrt(popVar);
  const POP_MIN = 1, POP_MAX = 50;
  const NUM_BINS = 24;
  const BIN_W = (POP_MAX - POP_MIN) / NUM_BINS;

  function init(stageEl, panelEl, params) {
    const state = {
      n: params.n ? Math.min(50, Math.max(1, parseInt(params.n, 10))) : 5,
      samples: 0,
      bins: new Array(NUM_BINS).fill(0),
      sumMeans: 0, sumSqMeans: 0,
      lastDraw: [], lastMean: null,
    };

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const nField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Sample size (n)' }),
      el('div', { class: 'pill-group' }, [1, 2, 5, 10, 30, 50].map((v) =>
        el('button', { text: String(v), class: v === state.n ? 'active' : '', onclick: (e) => setN(v, e.target) })
      )),
    ]);
    toolbar.appendChild(nField);
    stageEl.appendChild(toolbar);

    function setN(v) {
      state.n = v;
      nField.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === String(v)));
      resetMeans();
      pushShare();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Population distribution (fixed, skewed — not normal)' }));
    const popCanvas = el('canvas', { class: 'chart-canvas', style: 'height:150px;' });
    stageEl.appendChild(popCanvas);

    stageEl.appendChild(el('div', { class: 'section-title', text: `Distribution of sample means (n = ${state.n})` }));
    const meansCanvas = el('canvas', { class: 'chart-canvas', style: 'height:230px;' });
    stageEl.appendChild(meansCanvas);
    const hint = el('p', { class: 'hint' });
    stageEl.appendChild(hint);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Most recent sample' }));
    const drawRow = el('div', { class: 'flip-strip' });
    stageEl.appendChild(drawRow);

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Draw 1 sample',
      quickAmounts: [10, 100, 1000],
      quickLabelFn: (n) => `Draw ×${fmtNum(n)}`,
      onQuick: (n) => { drawSamples(n); draw(); pushShare(); },
      onStep: () => { drawSamples(1); draw(); pushShare(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => resetMeans(),
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'samples', label: 'Samples drawn', value: '0' },
      { key: 'lastMean', label: 'Last sample mean', value: '—' },
      { key: 'obsMean', label: 'Mean of sample means', value: '—' },
      { key: 'obsSD', label: 'SD of sample means', value: '—' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical SE (popSD/√n)', observedLabel: 'Observed SD of means', showBar: false });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: `Each "sample" draws ${state.n} independent value(s) from the skewed population above and averages them. We then plot the distribution of those averages.`,
      theory: `The Central Limit Theorem says that regardless of the population's shape, the distribution of sample means approaches a <strong>bell curve</strong> centered on the population mean (${popMean.toFixed(2)}), with spread (standard error) equal to <strong>population SD / √n</strong>.`,
      notice: `At n=1 the "sample mean" distribution is just the skewed population itself. As you increase n, the histogram narrows and its shape becomes noticeably more symmetric and bell-like — even though the underlying population is heavily skewed.`,
    });

    /* ---------- Population chart (static) ---------- */
    function drawPop() {
      const bars = POP.map((p) => ({ label: p.value, value: (p.weight / totalW) * 100 }));
      PP.charts.barChart(popCanvas, { bars, yFormat: (v) => `${v.toFixed(0)}%`, barColor: '#a78bfa' });
    }

    /* ---------- Simulation ---------- */
    function drawOneSample() {
      const vals = [];
      for (let i = 0; i < state.n; i++) vals.push(pickWeighted(POP));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      state.lastDraw = vals;
      state.lastMean = mean;
      state.samples++;
      state.sumMeans += mean;
      state.sumSqMeans += mean * mean;
      let bin = Math.floor((mean - POP_MIN) / BIN_W);
      bin = Math.max(0, Math.min(NUM_BINS - 1, bin));
      state.bins[bin]++;
    }
    function drawSamples(n) {
      for (let i = 0; i < n; i++) drawOneSample();
    }

    function draw() {
      const obsMean = state.samples ? state.sumMeans / state.samples : NaN;
      const obsVar = state.samples ? state.sumSqMeans / state.samples - obsMean * obsMean : NaN;
      const obsSD = state.samples ? Math.sqrt(Math.max(0, obsVar)) : NaN;
      const theoSE = popSD / Math.sqrt(state.n);

      stats.update('samples', fmtNum(state.samples));
      stats.update('lastMean', state.lastMean !== null ? state.lastMean.toFixed(2) : '—');
      stats.update('obsMean', state.samples ? obsMean.toFixed(2) : '—', undefined, 'accent');
      stats.update('obsSD', state.samples ? obsSD.toFixed(2) : '—');

      theory.update({
        theoretical: theoSE.toFixed(2),
        observed: state.samples ? obsSD.toFixed(2) : '—',
        diff: state.samples ? fmtSigned(obsSD - theoSE, 2) : '—',
        trials: fmtNum(state.samples),
      });

      clear(drawRow);
      state.lastDraw.slice(-30).forEach((v) => drawRow.appendChild(el('div', { class: 'flip-chip heads', style: 'width:auto;min-width:34px;padding:0 6px;border-radius:8px;', text: String(v) })));

      const bars = state.bins.map((c, i) => ({ label: Math.round(POP_MIN + (i + 0.5) * BIN_W), value: c }));
      PP.charts.barChart(meansCanvas, { bars, yFormat: (v) => fmtNum(Math.round(v)) });

      hint.textContent = state.n === 1
        ? 'At n=1 this histogram is just the population distribution — no averaging has happened yet.'
        : `With n=${state.n}, extreme sample means become rare (it's hard for all ${state.n} draws to be large at once), so the histogram bunches up near the population mean (${popMean.toFixed(1)}) and looks increasingly bell-shaped.`;

      drawPop();
    }

    function resetMeans() {
      state.samples = 0;
      state.bins = new Array(NUM_BINS).fill(0);
      state.sumMeans = 0; state.sumSqMeans = 0;
      state.lastDraw = []; state.lastMean = null;
      loop.pause();
      rc.setPlayingUI(false);
      draw();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => drawSamples(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { n: state.n }; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'clt',
    group: 'extra',
    name: 'Central Limit Theorem',
    tagline: 'Average random samples from a skewed population and watch the sample-mean distribution turn bell-shaped.',
    init,
  });
})(window);
