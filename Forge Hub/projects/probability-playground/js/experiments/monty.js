/* monty.js — Monty Hall */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, fmtSigned, statGrid, theoryBox, standardEducation, challengeBox, clear } = PP.ui;
  const { randInt } = PP.random;

  function init(stageEl, panelEl) {
    const stats = { stayWins: 0, stayLosses: 0, switchWins: 0, switchLosses: 0 };
    const stayHist = new PP.ui.HistoryBuffer(400);
    const switchHist = new PP.ui.HistoryBuffer(400);

    let game = null; // { car, chosen, revealed, decision, phase }

    function newGame() {
      game = { car: randInt(0, 2), chosen: null, revealed: null, decision: null, phase: 'pick' };
    }
    newGame();

    /* ---------- Stage ---------- */
    stageEl.appendChild(el('div', { class: 'section-title', text: 'Pick a door' }));
    const doorsRow = el('div', { class: 'doors-row' });
    stageEl.appendChild(doorsRow);
    const statusLine = el('p', { class: 'hint', style: 'text-align:center;font-size:14px;color:var(--text-1);min-height:20px;' });
    stageEl.appendChild(statusLine);
    const decisionRow = el('div', { style: 'display:flex;gap:10px;justify-content:center;margin:10px 0;' });
    stageEl.appendChild(decisionRow);

    const challengeContainer = el('div');
    stageEl.appendChild(challengeContainer);
    challengeBox(challengeContainer, {
      question: 'Three doors: one hides a car, two hide goats. You pick a door, the host (who knows what’s behind each) opens a different door revealing a goat. Should you stay with your original pick, or switch?',
      options: [
        { label: 'Stay — odds are the same either way' },
        { label: 'Switch — switching seems better' },
        { label: "Doesn't matter" },
      ],
      onAnswer: () => 'Noted — now play it out below (or run an automated batch) and let the win-rate counters answer for themselves.',
    });

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Automated simulation' }));
    stageEl.appendChild(el('p', { class: 'hint', text: 'Each simulated game is played out once; both the "stay" and "switch" outcomes for that exact game are recorded, so you can compare strategies on identical footing.' }));
    const autoRow = el('div', { class: 'quick-buttons' });
    [10, 100, 1000, 10000].forEach((n) => {
      autoRow.appendChild(el('button', { class: 'btn small', text: `Run ${fmtNum(n)} games`, onclick: () => { runAuto(n); draw(); } }));
    });
    stageEl.appendChild(autoRow);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Win rate over time' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:230px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: 'Reference lines mark the theoretical 33.3% (stay) and 66.7% (switch) long-run win rates.' }));

    const resetRow = el('div', { style: 'margin-top:14px;' }, [
      el('button', { class: 'btn danger-outline', text: '⟲ Reset all stats', onclick: () => { resetStats(); } }),
    ]);
    stageEl.appendChild(resetRow);

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const statGridCtl = statGrid(statsContainer, [
      { key: 'stayWins', label: 'Stay wins', value: '0' },
      { key: 'stayLosses', label: 'Stay losses', value: '0' },
      { key: 'switchWins', label: 'Switch wins', value: '0' },
      { key: 'switchLosses', label: 'Switch losses', value: '0' },
    ]);

    const theoryContainer = el('div');
    panelEl.appendChild(theoryContainer);
    const theory = theoryBox(theoryContainer, { theoreticalLabel: 'Theoretical switch win rate', observedLabel: 'Observed switch win rate' });

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'You pick one of three doors. The host, who knows where the car is, always opens a different door that has a goat behind it. You then choose to stay with your original pick or switch to the last unopened door.',
      theory: 'Staying wins only if your first pick was the car: probability 1/3. Switching wins whenever your first pick was <em>wrong</em> (a goat): probability 2/3. The host’s guaranteed goat-reveal is what breaks the naive "50/50" intuition.',
      notice: 'Your first pick has a 2-in-3 chance of being a goat. The host revealing a goat door doesn’t change that — it just concentrates the remaining 2/3 probability onto the one door you didn’t pick.',
    });

    /* ---------- Rendering ---------- */
    function doorIcon(i) {
      if (game.phase === 'result') return i === game.car ? '🚗' : '🐐';
      if (game.phase !== 'pick' && i === game.revealed) return '🐐';
      return '❓';
    }
    function renderDoors() {
      clear(doorsRow);
      for (let i = 0; i < 3; i++) {
        const classes = ['door'];
        if (game.phase !== 'pick' && i === game.revealed) classes.push('disabled', 'revealed-goat');
        if (game.chosen === i) classes.push('chosen');
        if (game.phase === 'result') {
          classes.push('disabled');
          const finalDoor = game.decision === 'switch' ? (3 - game.chosen - game.revealed) : game.chosen;
          if (i === finalDoor) classes.push(i === game.car ? 'result-win' : 'result-loss');
        }
        if (game.phase !== 'pick') classes.push('disabled');
        const d = el('div', {
          class: classes.join(' '),
          role: 'button',
          tabindex: game.phase === 'pick' ? '0' : '-1',
          'aria-label': `Door ${i + 1}`,
          onclick: () => { if (game.phase === 'pick') pickDoor(i); },
          onkeydown: (e) => { if (game.phase === 'pick' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickDoor(i); } },
        }, [
          el('span', { class: 'door-num', text: `${i + 1}` }),
          el('span', { class: 'door-icon', text: doorIcon(i) }),
          el('span', { class: 'door-label', text: game.chosen === i ? 'your pick' : '' }),
        ]);
        doorsRow.appendChild(d);
      }
    }

    function renderStatus() {
      if (game.phase === 'pick') {
        statusLine.textContent = 'Click a door to make your first pick.';
        clear(decisionRow);
      } else if (game.phase === 'decide') {
        statusLine.textContent = `The host opened door ${game.revealed + 1} — a goat. Stay with door ${game.chosen + 1}, or switch to door ${3 - game.chosen - game.revealed + 1}?`;
        clear(decisionRow);
        decisionRow.appendChild(el('button', { class: 'btn primary', text: 'STAY', onclick: () => decide('stay') }));
        decisionRow.appendChild(el('button', { class: 'btn primary', text: 'SWITCH', onclick: () => decide('switch') }));
      } else if (game.phase === 'result') {
        const finalDoor = game.decision === 'switch' ? (3 - game.chosen - game.revealed) : game.chosen;
        const won = finalDoor === game.car;
        statusLine.innerHTML = won
          ? `<strong style="color:var(--accent)">You won the car!</strong> (chose to ${game.decision})`
          : `<strong style="color:var(--rose)">No car this time.</strong> (chose to ${game.decision})`;
        clear(decisionRow);
        decisionRow.appendChild(el('button', { class: 'btn', text: 'Play again ↻', onclick: () => { newGame(); renderDoors(); renderStatus(); } }));
      }
    }

    function pickDoor(i) {
      game.chosen = i;
      const options = [0, 1, 2].filter((d) => d !== i && d !== game.car);
      game.revealed = options[randInt(0, options.length - 1)];
      game.phase = 'decide';
      renderDoors();
      renderStatus();
    }

    function decide(choice) {
      game.decision = choice;
      const finalDoor = choice === 'switch' ? (3 - game.chosen - game.revealed) : game.chosen;
      const won = finalDoor === game.car;
      if (choice === 'stay') { won ? stats.stayWins++ : stats.stayLosses++; recordHist('stay'); }
      else { won ? stats.switchWins++ : stats.switchLosses++; recordHist('switch'); }
      game.phase = 'result';
      renderDoors();
      renderStatus();
      draw();
    }

    function recordHist(which) {
      if (which === 'stay') {
        const total = stats.stayWins + stats.stayLosses;
        stayHist.push(total, stats.stayWins / total);
      } else {
        const total = stats.switchWins + stats.switchLosses;
        switchHist.push(total, stats.switchWins / total);
      }
    }

    function runAuto(n) {
      for (let i = 0; i < n; i++) {
        const car = randInt(0, 2);
        const firstPick = randInt(0, 2);
        const options = [0, 1, 2].filter((d) => d !== firstPick && d !== car);
        const revealed = options[randInt(0, options.length - 1)];
        const switchDoor = 3 - firstPick - revealed;
        const stayWin = firstPick === car;
        const switchWin = switchDoor === car;
        stayWin ? stats.stayWins++ : stats.stayLosses++;
        switchWin ? stats.switchWins++ : stats.switchLosses++;
      }
      const stayTotal = stats.stayWins + stats.stayLosses;
      const switchTotal = stats.switchWins + stats.switchLosses;
      stayHist.push(stayTotal, stats.stayWins / stayTotal);
      switchHist.push(switchTotal, stats.switchWins / switchTotal);
    }

    function draw() {
      statGridCtl.update('stayWins', fmtNum(stats.stayWins));
      statGridCtl.update('stayLosses', fmtNum(stats.stayLosses));
      statGridCtl.update('switchWins', fmtNum(stats.switchWins), undefined, 'accent');
      statGridCtl.update('switchLosses', fmtNum(stats.switchLosses));

      const switchTotal = stats.switchWins + stats.switchLosses;
      const switchRate = switchTotal ? (stats.switchWins / switchTotal) * 100 : NaN;
      theory.update({
        theoretical: fmtPct(200 / 3, 1),
        observed: switchTotal ? fmtPct(switchRate, 1) : '—',
        diff: switchTotal ? fmtSigned(switchRate - 200 / 3, 2, ' pts') : '—',
        trials: fmtNum(switchTotal),
      });
      theory.updateBar(switchTotal ? switchRate : 0, 200 / 3, 100);

      PP.charts.lineChart(canvas, {
        series: [
          { points: stayHist.points, color: '#ef6f7a', label: 'Stay win rate' },
          { points: switchHist.points, color: '#4fd1c5', label: 'Switch win rate' },
        ],
        refLines: [
          { y: 1 / 3, color: 'rgba(239,111,122,0.6)', label: '33.3% (stay)' },
          { y: 2 / 3, color: 'rgba(79,209,197,0.7)', label: '66.7% (switch)' },
        ],
        yMin: 0, yMax: 1, legend: true,
        yFormat: (v) => `${Math.round(v * 100)}%`,
        xFormat: (v) => `n=${Math.round(v)}`,
      });
    }

    function resetStats() {
      stats.stayWins = 0; stats.stayLosses = 0; stats.switchWins = 0; stats.switchLosses = 0;
      stayHist.reset(); switchHist.reset();
      newGame();
      renderDoors();
      renderStatus();
      draw();
    }

    renderDoors();
    renderStatus();
    draw();

    return {
      destroy() {},
      getShareParams() { return {}; },
      onResize() { draw(); },
    };
  }

  PP.registerExperiment({
    id: 'monty',
    group: 'core',
    name: 'Monty Hall',
    tagline: 'Play the classic three-door problem yourself, then run thousands of automated games to see which strategy wins.',
    init,
  });
})(window);
