/* gambler.js — Gambler's Fallacy */
(function (global) {
  const PP = global.PP;
  const { el, fmtPct, fmtNum, statGrid, standardEducation, clear } = PP.ui;
  const { chance } = PP.random;
  const STREAK_THRESHOLD = 3;

  function init(stageEl, panelEl) {
    const state = {
      flips: [],
      heads: 0, tails: 0,
      curType: null, curStreak: 0,
      longestStreak: 0,
      prompts: 0, reversalGuesses: 0, continuationGuesses: 0, fiftyFiftyGuesses: 0,
      awaiting: false,
      promptedForThisStreak: false,
    };

    /* ---------- Stage ---------- */
    stageEl.appendChild(el('div', { class: 'section-title', text: 'Flip sequence' }));
    const flipStrip = el('div', { class: 'flip-strip' });
    stageEl.appendChild(flipStrip);
    const streakLine = el('p', { class: 'hint', style: 'font-size:13.5px;' });
    stageEl.appendChild(streakLine);

    const actionRow = el('div', { class: 'run-bar' });
    const flipBtn = el('button', { class: 'btn primary', text: 'Flip Coin', onclick: () => doFlip() });
    const resetBtn = el('button', { class: 'btn danger-outline', text: '⟲ Reset', onclick: () => reset() });
    actionRow.appendChild(flipBtn);
    actionRow.appendChild(resetBtn);
    stageEl.appendChild(actionRow);

    const challengeContainer = el('div');
    stageEl.appendChild(challengeContainer);

    stageEl.appendChild(el('div', { class: 'section-title', text: 'Your prediction pattern' }));
    const canvas = el('canvas', { class: 'chart-canvas', style: 'height:200px;' });
    stageEl.appendChild(canvas);
    stageEl.appendChild(el('p', { class: 'hint', text: `This is a fair coin — every flip is 50/50 no matter what came before. Whenever a streak of ${STREAK_THRESHOLD}+ reaches you'll be asked to predict the next flip; this chart shows whether you tend to predict a reversal ("it's due to flip") or a continuation.` }));

    /* ---------- Panel ---------- */
    const statsContainer = el('div');
    panelEl.appendChild(statsContainer);
    const stats = statGrid(statsContainer, [
      { key: 'total', label: 'Total flips', value: '0' },
      { key: 'longest', label: 'Longest streak seen', value: '0' },
      { key: 'prompts', label: 'Predictions made', value: '0' },
      { key: 'reversalPct', label: 'Predicted reversal', value: '—' },
    ]);

    const eduContainer = el('div');
    panelEl.appendChild(eduContainer);
    standardEducation(eduContainer, {
      what: 'This is a fair, independent coin. Streaks of heads or tails happen naturally in random sequences — a run of 4 heads in a row is not a sign anything is "wrong" with the coin.',
      theory: 'No matter how long the current streak is, the probability of the next flip being heads stays exactly <strong>50%</strong>. The coin has no memory; each flip is a fresh, independent event.',
      notice: 'The <strong>gambler\'s fallacy</strong> is the mistaken belief that a streak makes the opposite outcome "due." In truth, streaks of moderate length are common in random sequences — expecting a reversal is a very human, very wrong instinct.',
    });

    /* ---------- Simulation ---------- */
    function doFlip() {
      const isHeads = chance(0.5);
      if (isHeads) state.heads++; else state.tails++;
      if (state.curType === (isHeads ? 'H' : 'T')) state.curStreak++;
      else { state.curType = isHeads ? 'H' : 'T'; state.curStreak = 1; state.promptedForThisStreak = false; }
      state.longestStreak = Math.max(state.longestStreak, state.curStreak);
      state.flips.push(isHeads ? 'H' : 'T');
      if (state.flips.length > 60) state.flips = state.flips.slice(-60);
      draw();

      if (state.curStreak >= STREAK_THRESHOLD && !state.promptedForThisStreak) {
        state.promptedForThisStreak = true;
        showChallenge();
      }
    }

    function showChallenge() {
      state.awaiting = true;
      flipBtn.disabled = true;
      const streakWord = state.curType === 'H' ? 'heads' : 'tails';
      clear(challengeContainer);
      PP.ui.challengeBox(challengeContainer, {
        question: `You've just seen ${state.curStreak} ${streakWord} in a row. What do you predict for the NEXT flip?`,
        options: [
          { label: state.curType === 'H' ? 'Heads (continue streak)' : 'Tails (continue streak)', v: 'continue' },
          { label: state.curType === 'H' ? 'Tails (reverse)' : 'Heads (reverse)', v: 'reverse' },
          { label: "It's still 50/50", v: '5050' },
        ],
        onAnswer: (opt) => {
          state.prompts++;
          if (opt.v === 'reverse') state.reversalGuesses++;
          else if (opt.v === 'continue') state.continuationGuesses++;
          else state.fiftyFiftyGuesses++;

          const nextIsHeads = chance(0.5);
          state.heads += nextIsHeads ? 1 : 0;
          state.tails += nextIsHeads ? 0 : 1;
          const nextType = nextIsHeads ? 'H' : 'T';
          if (state.curType === nextType) state.curStreak++;
          else { state.curType = nextType; state.curStreak = 1; }
          state.longestStreak = Math.max(state.longestStreak, state.curStreak);
          state.flips.push(nextType);
          if (state.flips.length > 60) state.flips = state.flips.slice(-60);

          state.promptedForThisStreak = state.curStreak >= STREAK_THRESHOLD;
          state.awaiting = false;
          flipBtn.disabled = false;
          draw();

          const actual = nextIsHeads ? 'Heads' : 'Tails';
          let verdict;
          if (opt.v === '5050') verdict = `The flip landed ${actual}. Recognizing it's still 50/50 either way is exactly right — the streak had no influence.`;
          else verdict = `The flip landed ${actual}. Whether that matched your guess or not, the true probability going in was 50/50 — the previous streak couldn't influence this outcome either way.`;
          return verdict;
        },
      });
    }

    function renderFlipStrip() {
      clear(flipStrip);
      state.flips.slice(-40).forEach((f, idx, arr) => {
        flipStrip.appendChild(el('div', { class: `flip-chip ${f === 'H' ? 'heads' : 'tails'}`, text: f }));
      });
      streakLine.textContent = state.curType
        ? `Current streak: ${state.curStreak} × ${state.curType === 'H' ? 'heads' : 'tails'}${state.curStreak >= STREAK_THRESHOLD ? '  — a prediction moment!' : ''}`
        : 'Flip the coin to begin.';
    }

    function draw() {
      renderFlipStrip();
      stats.update('total', fmtNum(state.heads + state.tails));
      stats.update('longest', fmtNum(state.longestStreak));
      stats.update('prompts', fmtNum(state.prompts));
      stats.update('reversalPct', state.prompts ? fmtPct((state.reversalGuesses / state.prompts) * 100) : '—', undefined, 'amber');

      PP.charts.barChart(canvas, {
        bars: [
          { label: 'Reversal', value: state.reversalGuesses, color: '#ef6f7a' },
          { label: 'Continue', value: state.continuationGuesses, color: '#f0a500' },
          { label: "50/50", value: state.fiftyFiftyGuesses, color: '#4fd1c5' },
        ],
        yFormat: (v) => fmtNum(Math.round(v)),
      });
    }

    function reset() {
      state.flips = [];
      state.heads = 0; state.tails = 0;
      state.curType = null; state.curStreak = 0;
      state.longestStreak = 0;
      state.prompts = 0; state.reversalGuesses = 0; state.continuationGuesses = 0; state.fiftyFiftyGuesses = 0;
      state.awaiting = false; state.promptedForThisStreak = false;
      flipBtn.disabled = false;
      clear(challengeContainer);
      draw();
    }

    draw();

    return { destroy() {}, getShareParams() { return {}; }, onResize() { draw(); } };
  }

  PP.registerExperiment({
    id: 'gambler',
    group: 'extra',
    name: "Gambler's Fallacy",
    tagline: 'A fair coin has no memory. See if streaks tempt you into predicting a reversal that isn’t actually more likely.',
    init,
  });
})(window);
