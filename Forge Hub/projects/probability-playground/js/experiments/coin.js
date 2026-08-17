/* coin.js — Coin Flip Lab */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, challengeBox, runControls, HistoryBuffer } = PP.ui;
  const { randFloat } = PP.random;

  function init(stageEl, panelEl, params) {
    const state = {
      p: params.p !== undefined ? Math.min(0.95, Math.max(0.05, parseFloat(params.p))) : 0.5,
      heads: 0, tails: 0,
      curType: null, curStreak: 0,
      longestHeads: 0, longestTails: 0,
      history: new HistoryBuffer(500),
      recentFlips: [],
    };
    if (!isFinite(state.p)) state.p = 0.5;

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const pField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Heads probability' }),
      (() => {
        const wrap = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
        const range = el('input', { type: 'range', min: 5, max: 95, value: Math.round(state.p * 100) });
        const readout = el('span', { class: 'badge', text: `${Math.round(state.p * 100)}% H / ${100 - Math.round(state.p * 100)}% T` });
        range.addEventListener('input', (e) => {
          state.p = Number(e.target.value) / 100;
          readout.textContent = `${e.target.value}% H / ${100 - e.target.value}% T`;
          draw();
          pushShare();
        });
        wrap.appendChild(range);
        wrap.appendChild(readout);
        return wrap;
      })(),
    ]);
    const presetField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Preset' }),
      el('div', { class: 'pill-group' }, [
        el('button', { text: 'Fair Coin', onclick: () => setP(0.5) }),
        el('button', { text: 'Biased 70/30', onclick: () => setP(0.7) }),
      ]),
    ]);
    toolbar.appendChild(pField);
    toolbar.appendChild(presetField);
    stageEl.appendChild(toolbar);

    function setP(p) {
      state.p = p;
      pField.querySelector('input[type=range]').value = Math.round(p * 100);
      pField.querySelector('.badge').textContent = `${Math.round(p * 100)}% H / ${Math.round((1 - p) * 100)}% T`;
      draw();
      pushShare();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Recent flips' }));
    const flipStrip = el('div', { class: 'flip-strip' });
    stageEl.appendChild(flipStrip);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Running proportion of heads' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:230px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'The dashed amber line marks the theoretical probability. Watch the teal line wander early on, then settle in as trials accumulate — that settling is the Law of Large Numbers in action.' }));

    const runControlsHost = el('div');
    stageEl.appendChild(runControlsHost);
    const rc = runControls(runControlsHost, {
      stepLabel: 'Flip ×1',
      quickAmounts: [10, 100, 1000],
      quickLabelFn: (n) => `Flip ×${fmtNum(n)}`,
      onQuick: (n) => { doFlips(n); draw(); pushShare(); },
      onStep: () => { doFlips(1); draw(); pushShare(); },
      onPlay: () => loop.play(),
      onPause: () => loop.pause(),
      onReset: () => reset(),
      speeds: [1, 10, 100, 1000],
    });
    rc.onSpeedChange((s) => loop.setSpeed(s));

    const challengeContainer = el('div');
    stageEl.appendChild(challengeContainer);
    let challengeShown = false;
    function maybeShowChallenge() {
      if (challengeShown || state.heads + state.tails > 0) return;
      challengeShown = true;
      challengeBox(challengeContainer, {
        question: 'Before you flip: after 10 flips of this coin, how many heads do you expect?',
        options: [
          { label: '~5', v: 5 }, { label: '~7', v: 7 }, { label: 'Exactly 5, always', v: 'always5' },
        ],
        onAnswer: (opt) => {
          if (opt.v === 'always5') {
            return 'Close, but not quite — 5 is the most likely single outcome, yet real runs of 10 flips land on other counts more often than not. Try "Flip ×10" a few times and watch the count jump around.';
          }
          const target = Math.round(state.p * 10);
          return `Reasonable guess! The expected count is p × 10 ≈ ${target}. Individual runs of 10 will still bounce around that number — try it and see.`;
        },
      });
    }
    maybeShowChallenge();

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'heads', label: 'Heads', value: '0' },
      { key: 'tails', label: 'Tails', value: '0' },
      { key: 'headsPct', label: 'Heads %', value: '—' },
      { key: 'tailsPct', label: 'Tails %', value: '—' },
      { key: 'streakH', label: 'Longest heads streak', value: '0' },
      { key: 'streakT', label: 'Longest tails streak', value: '0' },
      { key: 'total', label: 'Total flips', value: '0' },
      { key: 'rngMode', label: 'RNG source', value: PP.random.isHighQuality() ? 'crypto' : 'Math.random' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical heads %', observedLabel: 'Observed heads %' });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'Each flip is an independent random event. With probability <strong>p</strong> the coin lands heads, and with probability <strong>1&minus;p</strong> it lands tails — the coin has no memory of past flips.',
      theory: 'For a coin with heads probability <strong>p</strong>, the theoretical long-run heads percentage is simply <strong>p × 100%</strong>. Over many flips, the observed percentage should approach this value.',
      notice: 'Early on, the observed proportion can swing wildly (100% heads after 1 flip is common!). As the flip count grows into the hundreds and thousands, the line stabilizes and hugs the theoretical value — short streaks are normal noise, not a sign the coin is "due" for a correction.',
    });

    /* ---------- Simulation ---------- */
    function doFlips(n) {
      for (let i = 0; i < n; i++) {
        const isHeads = randFloat() < state.p;
        if (isHeads) state.heads++; else state.tails++;
        if (state.curType === (isHeads ? 'H' : 'T')) state.curStreak++;
        else { state.curType = isHeads ? 'H' : 'T'; state.curStreak = 1; }
        if (state.curType === 'H') state.longestHeads = Math.max(state.longestHeads, state.curStreak);
        else state.longestTails = Math.max(state.longestTails, state.curStreak);
        const total = state.heads + state.tails;
        state.history.push(total, state.heads / total);
        state.recentFlips.push(isHeads ? 'H' : 'T');
      }
      if (state.recentFlips.length > 60) state.recentFlips = state.recentFlips.slice(-60);
    }

    function renderFlipStrip() {
      flipStrip.innerHTML = '';
      state.recentFlips.slice(-40).forEach((f) => {
        flipStrip.appendChild(el('div', { class: `flip-chip ${f === 'H' ? 'heads' : 'tails'}`, text: f }));
      });
    }

    function draw() {
      const total = state.heads + state.tails;
      const headsPct = total ? (state.heads / total) * 100 : 0;
      const tailsPct = total ? (state.tails / total) * 100 : 0;
      const theoPct = state.p * 100;
      stats.update('heads', fmtNum(state.heads));
      stats.update('tails', fmtNum(state.tails));
      stats.update('headsPct', total ? fmtPct(headsPct) : '—', undefined, 'amber');
      stats.update('tailsPct', total ? fmtPct(tailsPct) : '—', undefined, 'accent');
      stats.update('streakH', fmtNum(state.longestHeads));
      stats.update('streakT', fmtNum(state.longestTails));
      stats.update('total', fmtNum(total));
      stats.update('rngMode', PP.random.isHighQuality() ? 'crypto' : 'Math.random');

      theory.update({
        theoretical: fmtPct(theoPct),
        observed: total ? fmtPct(headsPct) : '—',
        diff: total ? fmtSigned(headsPct - theoPct, 2, ' pts') : '—',
        trials: fmtNum(total),
      });
      theory.updateBar(headsPct, theoPct, 100);

      renderFlipStrip();

      PP.charts.lineChart(canvas, {
        series: [{ points: state.history.points, color: '#4fd1c5', label: 'Observed heads %' }],
        refLines: [{ y: state.p, color: '#f0a500', label: `theoretical p=${state.p.toFixed(2)}` }],
        yMin: 0, yMax: 1,
        yFormat: (v) => `${Math.round(v * 100)}%`,
        xFormat: (v) => `n=${Math.round(v)}`,
      });
    }

    function reset() {
      state.heads = 0; state.tails = 0;
      state.curType = null; state.curStreak = 0;
      state.longestHeads = 0; state.longestTails = 0;
      state.history.reset();
      state.recentFlips = [];
      loop.pause();
      rc.setPlayingUI(false);
      draw();
      pushShare();
    }

    const loop = new PP.ui.RunLoop({
      step: (n) => doFlips(n),
      draw: () => draw(),
      speeds: [1, 10, 100, 1000],
    });

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() {
      return { p: state.p.toFixed(2) };
    }

    draw();

    return {
      destroy() { loop.destroy(); },
      getShareParams,
      onResize() { draw(); },
    };
  }

  PP.registerExperiment({
    id: 'coin',
    group: 'core',
    name: 'Coin Flip Lab',
    tagline: 'Flip a coin (fair or biased) and watch the observed heads rate converge on the true probability.',
    init,
  });
})(window);
