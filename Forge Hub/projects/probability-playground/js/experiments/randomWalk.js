/* randomWalk.js — 2D Random Walk */
(function (global) {
  const PP = global.PP;
  const { el, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, runControls } = PP.ui;
  const { randInt } = PP.random;

  const COLORS = ['#4fd1c5', '#f0a500', '#a78bfa', '#ef6f7a', '#7dd3fc', '#fbbf24', '#34d399', '#f472b6'];

  function trailCapFor(n) {
    if (n <= 1) return 4000;
    if (n <= 10) return 500;
    return 140;
  }

  function init(stageEl, panelEl, params) {
    const state = {
      walkerCount: params.walkers ? Math.min(100, Math.max(1, parseInt(params.walkers, 10))) : 10,
      steps: 0,
      maxDistEver: 0,
      walkers: [],
    };

    function makeWalkers() {
      const cap = trailCapFor(state.walkerCount);
      state.walkers = [];
      for (let i = 0; i < state.walkerCount; i++) {
        state.walkers.push({ x: 0, y: 0, trail: [{ x: 0, y: 0 }], cap, color: COLORS[i % COLORS.length] });
      }
    }
    makeWalkers();

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const walkerField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Walkers' }),
      el('div', { class: 'pill-group' }, [1, 10, 100].map((n) =>
        el('button', { text: String(n), class: n === state.walkerCount ? 'active' : '', onclick: (e) => setWalkers(n, e.target) })
      )),
    ]);
    toolbar.appendChild(walkerField);
    stageEl.appendChild(toolbar);

    function setWalkers(n) {
      state.walkerCount = n;
      walkerField.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === String(n)));
      reset();
    }

    const canvasWrap = el('div', { style: 'position:relative;' });
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:420px;background:var(--bg-2);' });
    canvasWrap.appendChild(canvas);
    stageEl.appendChild(canvasWrap);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Each step, every walker moves one unit up, down, left, or right with equal probability. The view zooms out automatically as walkers wander farther from the center.' }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Step ×1',
      quickAmounts: [100, 1000, 10000],
      quickLabelFn: (n) => `+${fmtNum(n)} steps`,
      onQuick: (n) => { doSteps(n); draw(); pushShare(); },
      onStep: () => { doSteps(1); draw(); pushShare(); },
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
      { key: 'steps', label: 'Steps taken', value: '0' },
      { key: 'dist', label: 'Distance from origin', value: '0.0' },
      { key: 'maxDist', label: 'Maximum distance', value: '0.0' },
      { key: 'avgDist', label: 'Average distance', value: '0.0' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Expected average distance', observedLabel: 'Observed average distance', showBar: false });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'Each walker starts at the center and takes independent random steps: up, down, left, or right, each with probability 1/4. This is a classic 2D lattice random walk.',
      theory: 'The expected squared distance after n steps equals n, and for large n the distance from the origin is approximately Rayleigh-distributed, giving an expected average distance of about <strong>0.886 × √n</strong> — growing much slower than the number of steps itself.',
      notice: 'Individual walkers wander unpredictably and can drift far from center just by chance, but the <em>average</em> distance across many walkers tracks 0.886√n quite closely. Randomness does not mean "stays near the start."',
    });

    /* ---------- Simulation ---------- */
    function stepWalker(w) {
      const dir = randInt(0, 3);
      if (dir === 0) w.y -= 1;
      else if (dir === 1) w.y += 1;
      else if (dir === 2) w.x -= 1;
      else w.x += 1;
      w.trail.push({ x: w.x, y: w.y });
      if (w.trail.length > w.cap) w.trail.shift();
    }
    function doSteps(n) {
      for (let i = 0; i < n; i++) {
        state.walkers.forEach(stepWalker);
        state.steps++;
      }
      let maxNow = 0;
      state.walkers.forEach((w) => { maxNow = Math.max(maxNow, Math.hypot(w.x, w.y)); });
      state.maxDistEver = Math.max(state.maxDistEver, maxNow);
    }

    function draw() {
      const avgDist = state.walkers.reduce((s, w) => s + Math.hypot(w.x, w.y), 0) / state.walkers.length;
      const theoDist = Math.sqrt(Math.PI * state.steps / 4);

      stats.update('steps', fmtNum(state.steps));
      stats.update('dist', avgDist.toFixed(1));
      stats.update('maxDist', state.maxDistEver.toFixed(1), undefined, 'amber');
      stats.update('avgDist', avgDist.toFixed(1), undefined, 'accent');

      theory.update({
        theoretical: theoDist.toFixed(2),
        observed: state.steps ? avgDist.toFixed(2) : '0.00',
        diff: state.steps ? fmtSigned(avgDist - theoDist, 2) : '—',
        trials: fmtNum(state.steps),
      });

      drawCanvas();
    }

    function drawCanvas() {
      const { ctx, w, h } = PP.charts.setupCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;

      const extent = Math.max(8, state.maxDistEver * 1.15);
      const scale = Math.min(w, h) / 2 / extent * 0.92;

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const gridStep = Math.max(1, Math.round(extent / 6));
      for (let g = -Math.ceil(extent / gridStep) * gridStep; g <= extent + gridStep; g += gridStep) {
        ctx.beginPath(); ctx.moveTo(cx + g * scale, 0); ctx.lineTo(cx + g * scale, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, cy + g * scale); ctx.lineTo(w, cy + g * scale); ctx.stroke();
      }
      // axes
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();

      // origin marker
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();

      state.walkers.forEach((wk) => {
        ctx.strokeStyle = wk.color;
        ctx.globalAlpha = state.walkerCount > 10 ? 0.35 : 0.75;
        ctx.lineWidth = state.walkerCount > 10 ? 1 : 1.6;
        ctx.beginPath();
        wk.trail.forEach((p, i) => {
          const px = cx + p.x * scale, py = cy + p.y * scale;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
        const px = cx + wk.x * scale, py = cy + wk.y * scale;
        ctx.fillStyle = wk.color;
        ctx.beginPath();
        ctx.arc(px, py, state.walkerCount > 10 ? 2.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function reset() {
      state.steps = 0;
      state.maxDistEver = 0;
      makeWalkers();
      loop.pause();
      rc.setPlayingUI(false);
      draw();
      pushShare();
    }

    const loop = new PP.ui.RunLoop({ step: (n) => doSteps(n), draw: () => draw(), speeds: [1, 10, 100, 1000] });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { walkers: state.walkerCount }; }

    draw();

    return { destroy() { loop.destroy(); }, getShareParams, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'randomwalk',
    group: 'core',
    name: 'Random Walk',
    tagline: 'Watch one or many particles wander randomly on a 2D grid, and see how far they typically get from start.',
    init,
  });
})(window);
