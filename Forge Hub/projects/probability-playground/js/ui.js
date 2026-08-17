/* ui.js — shared DOM builders and small utilities used by every lab.
   Keeps each experiment module focused on its own logic instead of
   re-implementing stat cards, theory-vs-observed boxes, education
   accordions, run controls, etc. */
(function (global) {
  const PP = (global.PP = global.PP || {});

  PP.experiments = [];
  PP.registerExperiment = (exp) => PP.experiments.push(exp);

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
        else if (typeof attrs[k] === 'boolean') { if (attrs[k]) node.setAttribute(k, ''); else node.removeAttribute(k); }
        else if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function fmtPct(x, digits) {
    if (!isFinite(x)) return '—';
    return `${x.toFixed(digits === undefined ? 2 : digits)}%`;
  }
  function fmtNum(x, digits) {
    if (!isFinite(x)) return '—';
    if (digits === undefined) digits = Number.isInteger(x) ? 0 : 2;
    return x.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function fmtSigned(x, digits, suffix) {
    if (!isFinite(x)) return '—';
    const s = x > 0 ? '+' : '';
    return `${s}${x.toFixed(digits === undefined ? 2 : digits)}${suffix || ''}`;
  }

  /* ---------------- Stat grid ---------------- */
  function statGrid(container, items) {
    clear(container);
    const grid = el('div', { class: 'stat-grid' });
    const refs = {};
    items.forEach((it) => {
      const valueEl = el('div', { class: 'value' + (it.tone ? ' ' + it.tone : ''), text: it.value !== undefined ? it.value : '—' });
      const subEl = it.sub !== undefined ? el('div', { class: 'sub', text: it.sub }) : null;
      const card = el('div', { class: 'stat-card' }, [
        el('div', { class: 'label', text: it.label }),
        valueEl,
        subEl,
      ]);
      grid.appendChild(card);
      refs[it.key || it.label] = { valueEl, subEl, card };
    });
    container.appendChild(grid);
    return {
      update(key, value, sub, tone) {
        const r = refs[key];
        if (!r) return;
        r.valueEl.textContent = value;
        if (tone) r.valueEl.className = 'value ' + tone;
        if (sub !== undefined && r.subEl) r.subEl.textContent = sub;
      },
    };
  }

  /* ---------------- Theory vs Observed ---------------- */
  function theoryBox(container, opts) {
    clear(container);
    const box = el('div', { class: 'theory-box' });
    box.appendChild(el('div', { class: 'section-title', text: 'Theory vs. Experiment' }));
    const theoRow = el('div', { class: 'theory-row theoretical' }, [
      el('span', { class: 't-label', text: opts.theoreticalLabel || 'Theoretical' }),
      el('span', { class: 't-value', text: '—' }),
    ]);
    const obsRow = el('div', { class: 'theory-row observed' }, [
      el('span', { class: 't-label', text: opts.observedLabel || 'Observed' }),
      el('span', { class: 't-value', text: '—' }),
    ]);
    const diffRow = el('div', { class: 'theory-row diff' }, [
      el('span', { class: 't-label', text: 'Difference' }),
      el('span', { class: 't-value', text: '—' }),
    ]);
    const trialsRow = opts.showTrials === false ? null : el('div', { class: 'theory-row' }, [
      el('span', { class: 't-label', text: 'Trials' }),
      el('span', { class: 't-value', text: '0' }),
    ]);
    const barWrap = el('div', { class: 'theory-bar-wrap' }, [
      el('div', { class: 'bar-observed' }),
      el('div', { class: 'marker-theory' }),
    ]);
    box.appendChild(theoRow);
    box.appendChild(obsRow);
    box.appendChild(diffRow);
    if (trialsRow) box.appendChild(trialsRow);
    if (opts.showBar !== false) box.appendChild(barWrap);
    container.appendChild(box);
    return {
      update({ theoretical, observed, diff, trials, barMax }) {
        theoRow.querySelector('.t-value').textContent = theoretical;
        obsRow.querySelector('.t-value').textContent = observed;
        diffRow.querySelector('.t-value').textContent = diff;
        if (trialsRow && trials !== undefined) trialsRow.querySelector('.t-value').textContent = trials;
        if (opts.showBar !== false && typeof opts.observedFrac === 'function') {
          // handled externally via updateBar
        }
      },
      updateBar(observedPct, theoreticalPct, max) {
        const m = max || 100;
        barWrap.querySelector('.bar-observed').style.width = `${Math.max(0, Math.min(100, (observedPct / m) * 100))}%`;
        barWrap.querySelector('.marker-theory').style.left = `${Math.max(0, Math.min(100, (theoreticalPct / m) * 100))}%`;
      },
    };
  }

  /* ---------------- Education accordion ---------------- */
  function educationPanel(container, sections, opts) {
    clear(container);
    container.appendChild(el('div', { class: 'section-title', text: 'Learn' }));
    const wrap = el('div', { class: 'edu-accordion' });
    sections.forEach((s, i) => {
      const body = el('div', { class: 'edu-body', html: s.body });
      const details = el('details', { class: 'edu-item' }, [
        el('summary', { text: s.title }),
        body,
      ]);
      if (i === 0 && !(opts && opts.collapsedFirst)) details.open = true;
      wrap.appendChild(details);
    });
    container.appendChild(wrap);
  }

  function standardEducation(container, { what, theory, notice }) {
    educationPanel(container, [
      { title: 'What is happening?', body: what },
      { title: 'What should theory predict?', body: theory },
      { title: 'What should I notice?', body: notice },
    ]);
  }

  /* ---------------- Challenge box ---------------- */
  function challengeBox(container, { question, options, onAnswer }) {
    clear(container);
    const resultEl = el('div', { class: 'c-result hidden' });
    resultEl.style.display = 'none';
    const optsWrap = el('div', { class: 'c-options' });
    const box = el('div', { class: 'challenge-box' }, [
      el('div', { class: 'c-label', text: '🎯 Predict before you peek' }),
      el('div', { class: 'c-question', text: question }),
      optsWrap,
      resultEl,
    ]);
    options.forEach((opt) => {
      const btn = el('button', { class: 'btn small', text: opt.label, onclick: () => {
        Array.from(optsWrap.children).forEach((b) => (b.disabled = true));
        const msg = onAnswer ? onAnswer(opt) : '';
        resultEl.style.display = 'block';
        resultEl.textContent = msg || '';
      } });
      optsWrap.appendChild(btn);
    });
    container.appendChild(box);
    return {
      reset() {
        Array.from(optsWrap.children).forEach((b) => (b.disabled = false));
        resultEl.style.display = 'none';
      },
    };
  }

  /* ---------------- Run loop (Step / Play / Pause / Reset + speed) ---------------- */
  function RunLoop({ step, draw, speeds }) {
    this.step = step;
    this.draw = draw;
    this.speeds = speeds || [1, 10, 100, 1000];
    this.speed = this.speeds[0];
    this.playing = false;
    this._raf = null;
    this._tick = this._tick.bind(this);
  }
  RunLoop.prototype._tick = function () {
    if (!this.playing) return;
    this.step(this.speed);
    this.draw();
    this._raf = requestAnimationFrame(this._tick);
  };
  RunLoop.prototype.play = function () {
    if (this.playing) return;
    this.playing = true;
    this._tick();
  };
  RunLoop.prototype.pause = function () {
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };
  RunLoop.prototype.stepOnce = function (n) {
    this.step(n || 1);
    this.draw();
  };
  RunLoop.prototype.setSpeed = function (s) {
    this.speed = s;
  };
  RunLoop.prototype.destroy = function () {
    this.pause();
  };

  function runControls(container, { onStep, onPlay, onPause, onReset, speeds, stepLabel, quickAmounts, onQuick, quickLabelFn }) {
    clear(container);
    let playing = false;

    if (quickAmounts && quickAmounts.length) {
      const quickWrap = el('div', { class: 'quick-buttons' });
      quickAmounts.forEach((n) => {
        quickWrap.appendChild(
          el('button', {
            class: 'btn small',
            text: quickLabelFn ? quickLabelFn(n) : `+${fmtNum(n)}`,
            onclick: () => onQuick && onQuick(n),
          })
        );
      });
      container.appendChild(quickWrap);
    }

    const bar = el('div', { class: 'run-bar' });
    const stepBtn = el('button', { class: 'btn', text: stepLabel || 'Step' });
    const playBtn = el('button', { class: 'btn primary', text: '▶ Play' });
    const resetBtn = el('button', { class: 'btn danger-outline', text: '⟲ Reset' });
    stepBtn.addEventListener('click', () => onStep && onStep());
    playBtn.addEventListener('click', () => {
      playing = !playing;
      if (playing) {
        playBtn.textContent = '⏸ Pause';
        onPlay && onPlay();
      } else {
        playBtn.textContent = '▶ Play';
        onPause && onPause();
      }
    });
    resetBtn.addEventListener('click', () => {
      if (playing) {
        playing = false;
        playBtn.textContent = '▶ Play';
        onPause && onPause();
      }
      onReset && onReset();
    });

    bar.appendChild(stepBtn);
    bar.appendChild(playBtn);
    bar.appendChild(resetBtn);
    bar.appendChild(el('div', { class: 'spacer' }));

    if (speeds && speeds.length) {
      const speedWrap = el('div', { class: 'speed-select' });
      speedWrap.appendChild(el('span', { text: 'Speed' }));
      const select = el('select', {
        onchange: (e) => container._onSpeedChange && container._onSpeedChange(Number(e.target.value)),
      });
      speeds.forEach((s) => select.appendChild(el('option', { value: s, text: `${s}×` })));
      speedWrap.appendChild(select);
      bar.appendChild(speedWrap);
      container._speedSelect = select;
    }

    container.appendChild(bar);
    return {
      setPlayingUI(v) {
        playing = v;
        playBtn.textContent = v ? '⏸ Pause' : '▶ Play';
      },
      onSpeedChange(fn) {
        container._onSpeedChange = fn;
      },
      elements: { stepBtn, playBtn, resetBtn },
    };
  }

  /* ---------------- Downsampling history buffer ---------------- */
  function HistoryBuffer(maxPoints) {
    this.max = maxPoints || 600;
    this.points = [];
  }
  HistoryBuffer.prototype.push = function (x, y) {
    this.points.push({ x, y });
    if (this.points.length > this.max * 2) {
      const kept = [];
      for (let i = 0; i < this.points.length; i += 2) kept.push(this.points[i]);
      this.points = kept;
    }
  };
  HistoryBuffer.prototype.reset = function () {
    this.points = [];
  };

  /* ---------------- misc ---------------- */
  function toggle(el, show) {
    el.style.display = show ? '' : 'none';
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  PP.ui = {
    el, clear, fmtPct, fmtNum, fmtSigned,
    statGrid, theoryBox, educationPanel, standardEducation, challengeBox,
    RunLoop, runControls, HistoryBuffer, toggle, debounce,
  };
})(window);
