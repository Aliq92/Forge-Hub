/* rareEvent.js — Rare Event Visualizer */
(function (global) {
  const PP = global.PP;
  const { el, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, HistoryBuffer, clear } = PP.ui;
  const { chance } = PP.random;

  function init(stageEl, panelEl, params) {
    const state = {
      N: params.n ? Math.min(100000000, Math.max(2, parseInt(params.n, 10))) : 1000,
      totalAttempts: 0,
      currentRun: 0,
      successCount: 0,
      sumCompletedRunLengths: 0,
      bestRun: Infinity,
      worstRun: 0,
      history: new HistoryBuffer(300),
      running: false,
    };

    /* ---------- Stage ---------- */
    const toolbar = el('div', { class: 'toolbar' });
    const presetField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Probability of success' }),
      el('div', { class: 'pill-group' }, [10, 100, 1000, 1000000].map((v) =>
        el('button', { text: `1 in ${fmtNum(v)}`, class: v === state.N ? 'active' : '', onclick: (e) => setN(v, e.target) })
      )),
    ]);
    let customField_input;
    const customField = el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'Custom: 1 in N' }),
      (() => {
        const inp = el('input', { type: 'number', min: '2', max: '100000000', value: state.N, style: 'width:120px;' });
        inp.addEventListener('change', (e) => setN(Math.min(100000000, Math.max(2, parseInt(e.target.value, 10) || 2))));
        customField_input = inp;
        return inp;
      })(),
    ]);
    toolbar.appendChild(presetField);
    toolbar.appendChild(customField);
    stageEl.appendChild(toolbar);

    function setN(v) {
      state.N = v;
      presetField.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.textContent === `1 in ${fmtNum(v)}`));
      if (customField_input) customField_input.value = v;
      resetAll();
    }

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Attempts required for each success' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:230px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Each bar is one completed run: how many attempts it took to hit the rare event. The dashed line marks the theoretical average (= N attempts).' }));

    const progressLine = el('p', { class: 'hint', style: 'font-family:var(--mono);' });
    stageEl.appendChild(progressLine);

    const controlsRow = el('div', { class: 'run-bar' });
    const tryBtn = el('button', { class: 'btn', text: 'Try Once', onclick: () => { attemptOnce(); draw(); } });
    const runNextBtn = el('button', { class: 'btn primary', text: 'Run to Next Success', onclick: () => startRun((success) => success) });
    const run10Btn = el('button', { class: 'btn', text: 'Run 10 Successes', onclick: () => { let c = 0; startRun((success) => { if (success) c++; return c >= 10; }); } });
    const run100Btn = el('button', { class: 'btn', text: 'Run 100 Successes', onclick: () => { let c = 0; startRun((success) => { if (success) c++; return c >= 100; }); } });
    const stopBtn = el('button', { class: 'btn danger-outline', text: 'Stop', onclick: () => { state.running = false; updateButtons(); } });
    const resetBtn = el('button', { class: 'btn danger-outline', text: '⟲ Reset', onclick: () => resetAll() });
    controlsRow.appendChild(tryBtn);
    controlsRow.appendChild(runNextBtn);
    controlsRow.appendChild(run10Btn);
    controlsRow.appendChild(run100Btn);
    controlsRow.appendChild(stopBtn);
    controlsRow.appendChild(el('div', { class: 'spacer' }));
    controlsRow.appendChild(resetBtn);
    stageEl.appendChild(controlsRow);

    function updateButtons() {
      [tryBtn, runNextBtn, run10Btn, run100Btn].forEach((b) => (b.disabled = state.running));
      stopBtn.style.display = state.running ? '' : 'none';
    }
    updateButtons();

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'attempts', label: 'Total attempts', value: '0' },
      { key: 'expected', label: 'Expected attempts / success', value: '—' },
      { key: 'current', label: 'Current run (no success yet)', value: '0' },
      { key: 'best', label: 'Best run (fewest attempts)', value: '—' },
      { key: 'successes', label: 'Successful events', value: '0' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Expected attempts / success', observedLabel: 'Observed avg attempts / success', showBar: false });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: `Each attempt independently succeeds with probability 1/${fmtNum(state.N)}. This follows a geometric distribution — like rolling for a rare drop, or any repeated low-probability event.`,
      theory: `The expected number of attempts before a success is exactly <strong>N = ${fmtNum(state.N)}</strong>. That's the mean of a geometric distribution with success probability 1/N.`,
      notice: `Even at this "expected" rate, individual runs vary hugely — some succeed almost immediately, others take several times the average. That's why "1 in a million" events still occasionally happen on the very first try, and also why they can take many millions of tries.`,
    });

    /* ---------- Simulation ---------- */
    function attemptOnce() {
      state.totalAttempts++;
      state.currentRun++;
      const success = chance(1 / state.N);
      if (success) {
        state.successCount++;
        state.sumCompletedRunLengths += state.currentRun;
        state.bestRun = Math.min(state.bestRun, state.currentRun);
        state.worstRun = Math.max(state.worstRun, state.currentRun);
        state.history.push(state.successCount, state.currentRun);
        state.currentRun = 0;
      }
      return success;
    }

    function startRun(shouldStop) {
      state.running = true;
      updateButtons();
      const budgetMs = 14;
      function frame() {
        if (!state.running) { draw(); return; }
        const start = performance.now();
        let stop = false;
        while (performance.now() - start < budgetMs) {
          const success = attemptOnce();
          if (shouldStop(success)) { stop = true; break; }
        }
        draw();
        if (stop) { state.running = false; updateButtons(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function draw() {
      const theoAvg = state.N;
      const obsAvg = state.successCount ? state.sumCompletedRunLengths / state.successCount : NaN;

      stats.update('attempts', fmtNum(state.totalAttempts));
      stats.update('expected', fmtNum(theoAvg));
      stats.update('current', fmtNum(state.currentRun));
      stats.update('best', isFinite(state.bestRun) ? fmtNum(state.bestRun) : '—', undefined, 'accent');
      stats.update('successes', fmtNum(state.successCount));

      theory.update({
        theoretical: fmtNum(theoAvg),
        observed: state.successCount ? fmtNum(Math.round(obsAvg)) : '—',
        diff: state.successCount ? fmtSigned(obsAvg - theoAvg, 0) : '—',
        trials: fmtNum(state.successCount),
      });

      progressLine.textContent = state.running
        ? `Running… ${fmtNum(state.totalAttempts)} attempts so far, ${fmtNum(state.successCount)} successes.`
        : (state.totalAttempts ? `${fmtNum(state.totalAttempts)} attempts recorded.` : 'No attempts yet — try one, or run to the next success.');

      const bars = state.history.points.slice(-40).map((p) => ({ label: p.x, value: p.y }));
      PP.charts.barChart(canvas, {
        bars,
        theoretical: bars.map(() => ({ value: theoAvg })),
        yFormat: (v) => fmtNum(Math.round(v)),
        emptyLabel: 'Run some attempts to see results here',
      });
    }

    function resetAll() {
      state.totalAttempts = 0;
      state.currentRun = 0;
      state.successCount = 0;
      state.sumCompletedRunLengths = 0;
      state.bestRun = Infinity;
      state.worstRun = 0;
      state.history.reset();
      state.running = false;
      updateButtons();
      standardEducation(eduContainer, {
        what: `Each attempt independently succeeds with probability 1/${fmtNum(state.N)}. This follows a geometric distribution — like rolling for a rare drop, or any repeated low-probability event.`,
        theory: `The expected number of attempts before a success is exactly <strong>N = ${fmtNum(state.N)}</strong>. That's the mean of a geometric distribution with success probability 1/N.`,
        notice: `Even at this "expected" rate, individual runs vary hugely — some succeed almost immediately, others take several times the average. That's why "1 in a million" events still occasionally happen on the very first try, and also why they can take many millions of tries.`,
      });
      draw();
      pushShare();
    }

    const pushShare = PP.ui.debounce(() => PP.app.updateShareParams(getShareParams()), 200);
    function getShareParams() { return { n: state.N }; }

    draw();

    return {
      destroy() { state.running = false; },
      getShareParams,
      onResize() { draw(); },
    };
  }

  PP.registerExperiment({
    id: 'rareevent',
    group: 'extra',
    name: 'Rare Event Visualizer',
    tagline: 'Set a probability as small as 1-in-a-million and simulate attempts until it actually happens.',
    init,
  });
})(window);
