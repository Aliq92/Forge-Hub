import {
  TRACK_IDS, TRACK_LABELS, TRACK_KEYS, PATTERN_IDS, SCALES, SCALE_LABELS, NOTE_NAMES,
  NUM_STEPS, defaultState, demoState, clonePattern,
} from './state.js';
import { createAudioEngine } from './audioEngine.js';
import { Scheduler } from './scheduler.js';
import { DRUM_TRIGGERS } from './drums.js';
import { triggerBass, scaleNotes } from './bass.js';
import { delayTimeForBpm, duckGain } from './effects.js';
import { clearTrack, clearPattern, duplicateInto } from './patterns.js';
import { randomizeDrums, randomizeBass, randomizeAll } from './randomize.js';
import { PRESETS, PRESET_IDS } from './presets.js';
import { KITS, KIT_IDS } from './kits.js';
import * as storage from './storage.js';
import { createVisualizer } from './visualizer.js';

const ALL_MIX_IDS = [...TRACK_IDS, 'bass'];
const TUTORIAL_FLAG = 'beatFoundry.tutorialSeen';

export function initApp() {
  // ---------------------------------------------------------------- state
  let state = storage.hasSavedProject() ? mergeWithDefaults(storage.loadProject()) : demoState();

  // ---------------------------------------------------------- audio engine
  let engine = null;
  let scheduler = null;
  let visualizer = null;
  const trackBuses = {};
  let queuedPattern = null;
  let chainPos = 0;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let perfMuteAll = false;
  let bassCutActive = false;

  // visual sync queues, populated by the (audio-thread-timed) scheduler callback
  // and drained by requestAnimationFrame — audio timing never depends on this.
  const stepQueue = [];
  const patternChangeQueue = [];
  let currentPlayheadStep = -1;
  let rafHandle = null;

  let selectedBassStep = null;

  // ---------------------------------------------------------------- DOM refs
  const els = {};
  [
    'projectName', 'btnSave', 'btnLoad', 'btnNew', 'saveStatus', 'btnHelp', 'btnReducedMotion',
    'audioGate', 'btnEnableAudio',
    'btnPlay', 'btnStop', 'btnReset', 'bpmRange', 'bpmValue', 'swingRange', 'swingValue',
    'stepReadout', 'patternReadout', 'nextPatternChip', 'nextPatternReadout',
    'rulerSteps', 'sequencerGrid', 'padsGrid',
    'waveformSelect', 'cutoffRange', 'resonanceRange', 'decayRange', 'driveRange',
    'rootSelect', 'scaleSelect', 'notePickerLabel', 'notePicker',
    'patternTabs', 'btnDuplicate', 'btnClearPattern',
    'btnRandomizeDrums', 'btnRandomizeBass', 'btnRandomizeAll', 'densityRange',
    'chainEnabled', 'chainAdd', 'chainList',
    'presetsGrid',
    'masterVolumeRange', 'masterFilterRange', 'masterResonanceRange', 'kitSelect', 'sidechainSelect',
    'delayAmountRange', 'delayFeedbackRange', 'delayTimeSelect',
    'reverbAmountRange', 'reverbSizeRange', 'visualizer',
    'btnMuteAll', 'btnBassCut', 'btnDrop', 'btnBeatRepeat', 'filterSweepRange',
    'helpDialog', 'closeHelp', 'tutorial', 'closeTutorial', 'tutorialStart', 'dontShowTutorial',
  ].forEach((id) => { els[id] = document.getElementById(id); });

  const stepButtonsByTrack = {}; // trackId -> [btn x16]

  // ================================================================= INIT
  buildStaticOptions();
  buildRuler();
  buildPads();
  buildPatternTabs();
  buildChainAdd();
  buildPresets();
  renderSequencer();
  renderChain();
  renderNotePicker();
  syncControlsFromState();
  updateNextChip();
  applyReducedMotion();
  els.projectName.value = state.projectName;

  wireEvents();

  // ============================================================== AUDIO INIT
  async function ensureAudioStarted() {
    if (!engine) {
      engine = createAudioEngine();
      TRACK_IDS.forEach((id) => { trackBuses[id] = engine.getTrackBus(id); });
      trackBuses.bass = engine.getTrackBus('bass', { duck: true });
      updateAllTrackGains();
      applyEngineParams();

      scheduler = new Scheduler(engine.ctx, onStep);
      scheduler.setBpm(state.bpm);
      scheduler.setSwing(state.swing);

      visualizer = createVisualizer(els.visualizer, engine.analyser, () => reducedMotion);
      startVisualLoop();

      els.audioGate.hidden = true;
      maybeShowTutorial();
    }
    try { await engine.resume(); } catch (e) { /* ignore: user-gesture resume can be retried */ }
  }

  function applyEngineParams() {
    if (!engine) return;
    engine.setMasterVolume(state.master.volume);
    engine.setMasterFilter(state.fx.filter.cutoff, state.fx.filter.resonance);
    engine.setDelaySend(state.fx.delay.amount);
    engine.setDelayFeedback(state.fx.delay.feedback);
    engine.setDelayTime(delayTimeForBpm(state.bpm, state.fx.delay.time));
    engine.setReverbSend(state.fx.reverb.amount);
    engine.setReverbSize(state.fx.reverb.size);
  }

  function isTrackMuted(id) {
    const anySolo = ALL_MIX_IDS.some((t) => state.mixer[t].solo);
    const m = state.mixer[id];
    return anySolo ? !m.solo : m.mute;
  }

  function updateAllTrackGains() {
    if (!engine) return;
    ALL_MIX_IDS.forEach((id) => {
      const m = state.mixer[id];
      let target = isTrackMuted(id) ? 0 : m.vol;
      if (perfMuteAll && id !== 'bass') target = 0;
      if (bassCutActive && id === 'bass') target = 0;
      trackBuses[id].gain.gain.setTargetAtTime(Math.max(0, target), engine.ctx.currentTime, 0.012);
    });
  }

  function playDrum(id, time, vel) {
    const kitParams = (KITS[state.kit] || KITS.clean)[id];
    DRUM_TRIGGERS[id](engine.ctx, engine.noiseBuffer, trackBuses[id].gain, time, vel, kitParams);
  }

  // ============================================================ SCHEDULER CB
  function onStep(stepIndex, time) {
    if (stepIndex === 0) {
      if (state.chainEnabled && state.chain.length) {
        state.currentPattern = state.chain[chainPos % state.chain.length];
        chainPos = (chainPos + 1) % state.chain.length;
        patternChangeQueue.push({ time, id: state.currentPattern });
      } else if (queuedPattern) {
        state.currentPattern = queuedPattern;
        queuedPattern = null;
        patternChangeQueue.push({ time, id: state.currentPattern });
      }
    }

    const pattern = state.patterns[state.currentPattern];
    const stepDur = scheduler.sixteenthDuration();
    let kickHit = false;

    TRACK_IDS.forEach((id) => {
      const step = pattern.drums[id][stepIndex];
      if (step && step.on) {
        playDrum(id, time, step.vel);
        if (id === 'kick') kickHit = true;
      }
    });

    const bstep = pattern.bass.steps[stepIndex];
    if (bstep && bstep.on) {
      triggerBass(engine.ctx, trackBuses.bass.gain, time, pattern.bass.notes[stepIndex], bstep.vel, state.bassParams, stepDur);
    }

    if (kickHit && state.sidechain !== 'off' && trackBuses.bass.duck) {
      const depth = state.sidechain === 'high' ? 0.55 : 0.28;
      duckGain(engine.ctx, trackBuses.bass.duck.gain, time, depth);
    }

    stepQueue.push({ step: stepIndex, time });
  }

  // ============================================================ VISUAL LOOP
  function startVisualLoop() {
    const tick = () => {
      rafHandle = requestAnimationFrame(tick);
      if (!engine) return;
      const now = engine.ctx.currentTime;

      let patChange = null;
      while (patternChangeQueue.length && patternChangeQueue[0].time <= now) {
        patChange = patternChangeQueue.shift();
      }
      if (patChange) {
        renderSequencer();
        buildPatternTabs();
        els.patternReadout.textContent = patChange.id;
        currentPlayheadStep = -1;
        updateNextChip();
      }

      let latest = null;
      while (stepQueue.length && stepQueue[0].time <= now) {
        latest = stepQueue.shift();
      }
      if (latest) {
        setPlayheadColumn(latest.step);
        els.stepReadout.textContent = String(latest.step + 1);
      }
    };
    tick();
  }

  function setPlayheadColumn(step) {
    if (step === currentPlayheadStep) return;
    if (currentPlayheadStep >= 0) {
      Object.values(stepButtonsByTrack).forEach((btns) => {
        const b = btns[currentPlayheadStep];
        if (b) b.classList.remove('playing');
      });
    }
    Object.values(stepButtonsByTrack).forEach((btns) => {
      const b = btns[step];
      if (b) b.classList.add('playing');
    });
    currentPlayheadStep = step;
  }

  function clearPlayhead() {
    if (currentPlayheadStep >= 0) {
      Object.values(stepButtonsByTrack).forEach((btns) => {
        const b = btns[currentPlayheadStep];
        if (b) b.classList.remove('playing');
      });
    }
    currentPlayheadStep = -1;
    stepQueue.length = 0;
    patternChangeQueue.length = 0;
    els.stepReadout.textContent = '1';
  }

  // ================================================================ BUILDERS
  function buildStaticOptions() {
    els.rootSelect.innerHTML = NOTE_NAMES.map((n) => `<option value="${n}">${n}</option>`).join('');
    els.scaleSelect.innerHTML = Object.keys(SCALES).map((s) => `<option value="${s}">${SCALE_LABELS[s]}</option>`).join('');
    els.kitSelect.innerHTML = KIT_IDS.map((k) => `<option value="${k}">${KITS[k].label}</option>`).join('');
  }

  function buildRuler() {
    els.rulerSteps.innerHTML = '';
    for (let i = 0; i < NUM_STEPS; i += 1) {
      const span = document.createElement('span');
      span.textContent = String(i + 1);
      if (i % 4 === 0) span.classList.add('beat-mark');
      els.rulerSteps.appendChild(span);
    }
  }

  function buildPads() {
    els.padsGrid.innerHTML = '';
    TRACK_IDS.forEach((id) => {
      const btn = document.createElement('button');
      btn.className = 'pad-btn';
      btn.type = 'button';
      btn.dataset.track = id;
      btn.innerHTML = `<span>${TRACK_LABELS[id]}</span><span class="pad-key">${TRACK_KEYS[id]}</span>`;
      btn.addEventListener('pointerdown', () => triggerPad(id, btn));
      els.padsGrid.appendChild(btn);
    });
  }

  function triggerPad(id, btnEl) {
    flashPad(btnEl);
    ensureAudioStarted().then(() => {
      const t = engine.ctx.currentTime + 0.006;
      playDrum(id, t, 1);
    });
  }

  function flashPad(btnEl) {
    btnEl.classList.add('active');
    setTimeout(() => btnEl.classList.remove('active'), 110);
  }

  function buildPatternTabs() {
    els.patternTabs.innerHTML = '';
    PATTERN_IDS.forEach((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pattern-tab';
      btn.setAttribute('aria-pressed', String(id === state.currentPattern));
      btn.innerHTML = `${id}<span class="dot"></span>`;
      if (patternHasContent(state.patterns[id])) btn.querySelector('.dot').parentElement.classList.add('has-content');
      btn.addEventListener('click', () => selectPattern(id));
      els.patternTabs.appendChild(btn);
    });
  }

  function patternHasContent(pattern) {
    const drumsActive = TRACK_IDS.some((id) => pattern.drums[id].some((s) => s.on));
    const bassActive = pattern.bass.steps.some((s) => s.on);
    return drumsActive || bassActive;
  }

  function selectPattern(id) {
    if (id === state.currentPattern && !queuedPattern) return;
    if (scheduler && scheduler.playing && !state.chainEnabled) {
      queuedPattern = id;
      updateNextChip();
    } else {
      state.currentPattern = id;
      queuedPattern = null;
      selectedBassStep = null;
      renderSequencer();
      renderNotePicker();
      buildPatternTabs();
      els.patternReadout.textContent = id;
      updateNextChip();
    }
    autosave();
  }

  function updateNextChip() {
    if (!state.chainEnabled && queuedPattern) {
      els.nextPatternChip.hidden = false;
      els.nextPatternReadout.textContent = queuedPattern;
    } else {
      els.nextPatternChip.hidden = true;
    }
  }

  function buildChainAdd() {
    els.chainAdd.innerHTML = '';
    PATTERN_IDS.forEach((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-ghost';
      btn.textContent = `+${id}`;
      btn.addEventListener('click', () => {
        if (state.chain.length >= 12) return;
        state.chain.push(id);
        renderChain();
        autosave();
      });
      els.chainAdd.appendChild(btn);
    });
  }

  function renderChain() {
    els.chainList.innerHTML = '';
    if (!state.chain.length) {
      const span = document.createElement('span');
      span.className = 'panel-sub';
      span.textContent = 'Empty — add A, B, C, D above to build a chain.';
      els.chainList.appendChild(span);
      return;
    }
    state.chain.forEach((id, idx) => {
      const chip = document.createElement('span');
      chip.className = 'chain-chip';
      chip.innerHTML = `${id}`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `Remove ${id} from chain at position ${idx + 1}`);
      rm.addEventListener('click', () => {
        state.chain.splice(idx, 1);
        chainPos = 0;
        renderChain();
        autosave();
      });
      chip.appendChild(rm);
      els.chainList.appendChild(chip);
    });
  }

  function buildPresets() {
    els.presetsGrid.innerHTML = '';
    PRESET_IDS.forEach((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-btn';
      btn.dataset.preset = id;
      btn.textContent = PRESETS[id].label;
      btn.addEventListener('click', () => applyPreset(id));
      els.presetsGrid.appendChild(btn);
    });
  }

  function applyPreset(id) {
    const preset = PRESETS[id];
    state.bpm = preset.bpm;
    state.swing = preset.swing;
    state.kit = preset.kit;
    state.scale = preset.scale;
    state.root = preset.root;
    state.patterns[state.currentPattern] = {
      drums: JSON.parse(JSON.stringify(preset.drums)),
      bass: { steps: JSON.parse(JSON.stringify(preset.bass.steps)), notes: [...preset.bass.notes] },
    };
    state.fx.delay = { ...preset.fx.delay };
    state.fx.reverb = { ...preset.fx.reverb };
    state.fx.filter = { ...state.fx.filter, cutoff: preset.fx.filter.cutoff, resonance: preset.fx.filter.resonance };
    selectedBassStep = null;

    syncControlsFromState();
    applyEngineParams();
    if (scheduler) { scheduler.setBpm(state.bpm); scheduler.setSwing(state.swing); }
    renderSequencer();
    renderNotePicker();
    buildPatternTabs();
    els.presetsGrid.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === id));
    autosave();
  }

  // ================================================================ SEQUENCER
  function renderSequencer() {
    els.sequencerGrid.innerHTML = '';
    Object.keys(stepButtonsByTrack).forEach((k) => delete stepButtonsByTrack[k]);
    const pattern = state.patterns[state.currentPattern];
    TRACK_IDS.forEach((id) => {
      els.sequencerGrid.appendChild(buildTrackRow(id, pattern.drums[id]));
    });
    els.sequencerGrid.appendChild(buildBassRow(pattern.bass));
    els.patternReadout.textContent = state.currentPattern;
  }

  function buildMixerHead(id, label, onNameClick) {
    const head = document.createElement('div');
    head.className = 'track-head';

    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'track-name-btn';
    nameBtn.textContent = label;
    nameBtn.title = 'Click to clear this track';
    nameBtn.addEventListener('click', onNameClick);
    head.appendChild(nameBtn);

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'track-mini-btn mute';
    muteBtn.textContent = 'M';
    muteBtn.setAttribute('aria-pressed', String(state.mixer[id].mute));
    muteBtn.setAttribute('aria-label', `Mute ${label}`);
    muteBtn.addEventListener('click', () => {
      state.mixer[id].mute = !state.mixer[id].mute;
      muteBtn.setAttribute('aria-pressed', String(state.mixer[id].mute));
      updateAllTrackGains();
      autosave();
    });
    head.appendChild(muteBtn);

    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'track-mini-btn solo';
    soloBtn.textContent = 'S';
    soloBtn.setAttribute('aria-pressed', String(state.mixer[id].solo));
    soloBtn.setAttribute('aria-label', `Solo ${label}`);
    soloBtn.addEventListener('click', () => {
      state.mixer[id].solo = !state.mixer[id].solo;
      soloBtn.setAttribute('aria-pressed', String(state.mixer[id].solo));
      updateAllTrackGains();
      autosave();
    });
    head.appendChild(soloBtn);

    const vol = document.createElement('input');
    vol.type = 'range';
    vol.className = 'track-vol';
    vol.min = '0'; vol.max = '1'; vol.step = '0.01';
    vol.value = String(state.mixer[id].vol);
    vol.setAttribute('aria-label', `${label} volume`);
    vol.addEventListener('input', () => {
      state.mixer[id].vol = Number(vol.value);
      updateAllTrackGains();
      autosave();
    });
    head.appendChild(vol);

    return head;
  }

  function makeStepButton(trackId, index, step, isBass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step-btn';
    if (index % 4 === 0) btn.classList.add('beat-start');
    btn.setAttribute('aria-pressed', String(!!step.on));
    btn.setAttribute('aria-label', `${TRACK_LABELS[trackId] || 'Bass'} step ${index + 1}`);

    if (isBass) {
      const tag = document.createElement('span');
      tag.className = 'note-tag';
      tag.textContent = state.patterns[state.currentPattern].bass.notes[index];
      btn.appendChild(tag);
    }

    applyStepVisual(btn, step);

    btn.addEventListener('click', () => {
      step.on = !step.on;
      if (step.on && !step.vel) step.vel = 1;
      applyStepVisual(btn, step);
      if (isBass) {
        selectedBassStep = index;
        highlightBassSelection();
        renderNotePicker();
      }
      buildPatternTabs();
      autosave();
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!step.on) return;
      const levels = [0.65, 1, 1.3];
      const cur = levels.reduce((closest, l) => (Math.abs(l - step.vel) < Math.abs(closest - step.vel) ? l : closest), levels[0]);
      const next = levels[(levels.indexOf(cur) + 1) % levels.length];
      step.vel = next;
      applyStepVisual(btn, step);
      autosave();
    });

    if (isBass) {
      btn.addEventListener('dblclick', (e) => { e.preventDefault(); });
    }

    return btn;
  }

  function applyStepVisual(btn, step) {
    btn.setAttribute('aria-pressed', String(!!step.on));
    btn.classList.remove('vel-soft', 'vel-accent');
    if (step.on) {
      if (step.vel <= 0.75) btn.classList.add('vel-soft');
      else if (step.vel >= 1.15) btn.classList.add('vel-accent');
    }
  }

  function highlightBassSelection() {
    const btns = stepButtonsByTrack.bass || [];
    btns.forEach((b, i) => b.classList.toggle('bass-selected', i === selectedBassStep));
  }

  function buildTrackRow(id, steps) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.appendChild(buildMixerHead(id, TRACK_LABELS[id], () => {
      if (confirm(`Clear all ${TRACK_LABELS[id]} steps in Pattern ${state.currentPattern}?`)) {
        clearTrack(state.patterns[state.currentPattern], id);
        renderSequencer();
        buildPatternTabs();
        autosave();
      }
    }));

    const stepsRow = document.createElement('div');
    stepsRow.className = 'steps-row';
    const btns = [];
    steps.forEach((step, i) => {
      const btn = makeStepButton(id, i, step, false);
      stepsRow.appendChild(btn);
      btns.push(btn);
    });
    stepButtonsByTrack[id] = btns;
    row.appendChild(stepsRow);
    return row;
  }

  function buildBassRow(bass) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.appendChild(buildMixerHead('bass', TRACK_LABELS.bass, () => {
      if (confirm(`Clear all BASS steps in Pattern ${state.currentPattern}?`)) {
        clearTrack(state.patterns[state.currentPattern], 'bass');
        renderSequencer();
        buildPatternTabs();
        autosave();
      }
    }));

    const stepsRow = document.createElement('div');
    stepsRow.className = 'steps-row';
    const btns = [];
    bass.steps.forEach((step, i) => {
      const btn = makeStepButton('bass', i, step, true);
      stepsRow.appendChild(btn);
      btns.push(btn);
    });
    stepButtonsByTrack.bass = btns;
    row.appendChild(stepsRow);
    if (selectedBassStep !== null) highlightBassSelection();
    return row;
  }

  // ================================================================ NOTE PICKER
  function renderNotePicker() {
    if (selectedBassStep === null) {
      els.notePickerLabel.textContent = 'Select a bass step on the grid to edit its note';
      els.notePicker.innerHTML = '';
      return;
    }
    const pattern = state.patterns[state.currentPattern];
    els.notePickerLabel.textContent = `Editing note for bass step ${selectedBassStep + 1}`;
    const notes = scaleNotes(state.root, state.scale);
    const current = pattern.bass.notes[selectedBassStep];
    els.notePicker.innerHTML = '';
    notes.forEach(({ note, inScale, isRoot }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-btn';
      if (inScale) btn.classList.add('in-scale');
      if (isRoot && inScale) btn.classList.add('root-note');
      btn.setAttribute('aria-pressed', String(note === current));
      btn.textContent = note;
      btn.addEventListener('click', () => {
        pattern.bass.notes[selectedBassStep] = note;
        renderNotePicker();
        const tag = stepButtonsByTrack.bass[selectedBassStep].querySelector('.note-tag');
        if (tag) tag.textContent = note;
        autosave();
      });
      els.notePicker.appendChild(btn);
    });
  }

  // ================================================================ TRANSPORT
  function play() {
    ensureAudioStarted().then(() => {
      scheduler.start();
      els.btnPlay.setAttribute('aria-pressed', 'true');
    });
  }

  function stop() {
    if (scheduler) scheduler.stop();
    els.btnPlay.setAttribute('aria-pressed', 'false');
    clearPlayhead();
  }

  function resetPlayhead() {
    if (!scheduler) { clearPlayhead(); return; }
    const wasPlaying = scheduler.playing;
    scheduler.stop();
    clearPlayhead();
    if (wasPlaying) scheduler.start();
  }

  // ================================================================ SYNC UI
  function syncControlsFromState() {
    els.bpmRange.value = String(state.bpm);
    els.bpmValue.textContent = String(state.bpm);
    els.swingRange.value = String(state.swing);
    els.swingValue.textContent = `${state.swing}%`;

    els.waveformSelect.value = state.bassParams.waveform;
    els.cutoffRange.value = String(state.bassParams.cutoff);
    els.resonanceRange.value = String(state.bassParams.resonance);
    els.decayRange.value = String(state.bassParams.decay);
    els.driveRange.value = String(state.bassParams.drive);

    els.rootSelect.value = state.root;
    els.scaleSelect.value = state.scale;
    els.kitSelect.value = state.kit;
    els.sidechainSelect.value = state.sidechain;

    els.masterVolumeRange.value = String(state.master.volume);
    els.masterFilterRange.value = String(state.fx.filter.cutoff);
    els.masterResonanceRange.value = String(state.fx.filter.resonance);
    els.filterSweepRange.value = '1';

    els.delayAmountRange.value = String(state.fx.delay.amount);
    els.delayFeedbackRange.value = String(state.fx.delay.feedback);
    els.delayTimeSelect.value = state.fx.delay.time;

    els.reverbAmountRange.value = String(state.fx.reverb.amount);
    els.reverbSizeRange.value = String(state.fx.reverb.size);

    els.chainEnabled.checked = state.chainEnabled;
    updateAllTrackGains();
  }

  function autosave() {
    storage.scheduleAutosave(state, flashSaved);
  }

  function flashSaved() {
    els.saveStatus.textContent = 'Saved';
    els.saveStatus.classList.add('show');
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(() => els.saveStatus.classList.remove('show'), 1400);
  }

  function afterStateReplaced() {
    if (scheduler) scheduler.stop();
    els.btnPlay.setAttribute('aria-pressed', 'false');
    queuedPattern = null; chainPos = 0; selectedBassStep = null;
    clearPlayhead();
    els.projectName.value = state.projectName;
    syncControlsFromState();
    applyEngineParams();
    if (scheduler) { scheduler.setBpm(state.bpm); scheduler.setSwing(state.swing); }
    renderSequencer();
    renderChain();
    renderNotePicker();
    buildPatternTabs();
    els.presetsGrid.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
  }

  // ================================================================ REDUCED MOTION
  function applyReducedMotion() {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));
    els.btnReducedMotion.setAttribute('aria-pressed', String(reducedMotion));
  }

  // ================================================================ TUTORIAL / HELP
  function maybeShowTutorial() {
    if (!localStorage.getItem(TUTORIAL_FLAG)) {
      els.tutorial.hidden = false;
    }
  }
  function closeTutorial() {
    if (els.dontShowTutorial.checked) localStorage.setItem(TUTORIAL_FLAG, '1');
    els.tutorial.hidden = true;
  }

  // ================================================================ PERFORMANCE FX
  function toggleMuteAll() {
    perfMuteAll = !perfMuteAll;
    els.btnMuteAll.classList.toggle('active', perfMuteAll);
    els.btnMuteAll.setAttribute('aria-pressed', String(perfMuteAll));
    updateAllTrackGains();
  }

  function setBassCut(active) {
    bassCutActive = active;
    els.btnBassCut.classList.toggle('active', active);
    updateAllTrackGains();
  }

  function doDrop() {
    if (!engine) return;
    const wasMute = perfMuteAll;
    perfMuteAll = true;
    updateAllTrackGains();
    const barMs = (scheduler ? scheduler.sixteenthDuration() : 0.125) * 16 * 1000;
    setTimeout(() => {
      perfMuteAll = wasMute;
      updateAllTrackGains();
    }, Math.max(200, barMs));
  }

  function doBeatRepeat() {
    if (!engine || !scheduler) return;
    const pattern = state.patterns[state.currentPattern];
    const col = Math.max(0, currentPlayheadStep);
    const stepDur = scheduler.sixteenthDuration();
    for (let r = 0; r < 4; r += 1) {
      const t = engine.ctx.currentTime + 0.01 + r * (stepDur / 2);
      TRACK_IDS.forEach((id) => {
        const step = pattern.drums[id][col];
        if (step && step.on) playDrum(id, t, step.vel * 0.9);
      });
    }
  }

  // ================================================================ EVENTS
  function wireEvents() {
    els.btnEnableAudio.addEventListener('click', () => ensureAudioStarted());
    els.btnPlay.addEventListener('click', play);
    els.btnStop.addEventListener('click', stop);
    els.btnReset.addEventListener('click', resetPlayhead);

    els.bpmRange.addEventListener('input', () => {
      const v = Number(els.bpmRange.value);
      state.bpm = v;
      els.bpmValue.textContent = String(v);
      if (scheduler) scheduler.setBpm(v);
      if (engine) engine.setDelayTime(delayTimeForBpm(v, state.fx.delay.time));
      autosave();
    });

    els.swingRange.addEventListener('input', () => {
      const v = Number(els.swingRange.value);
      state.swing = v;
      els.swingValue.textContent = `${v}%`;
      if (scheduler) scheduler.setSwing(v);
      autosave();
    });

    // bass params
    els.waveformSelect.addEventListener('change', () => { state.bassParams.waveform = els.waveformSelect.value; autosave(); });
    els.cutoffRange.addEventListener('input', () => { state.bassParams.cutoff = Number(els.cutoffRange.value); autosave(); });
    els.resonanceRange.addEventListener('input', () => { state.bassParams.resonance = Number(els.resonanceRange.value); autosave(); });
    els.decayRange.addEventListener('input', () => { state.bassParams.decay = Number(els.decayRange.value); autosave(); });
    els.driveRange.addEventListener('input', () => { state.bassParams.drive = Number(els.driveRange.value); autosave(); });

    els.rootSelect.addEventListener('change', () => { state.root = els.rootSelect.value; renderNotePicker(); autosave(); });
    els.scaleSelect.addEventListener('change', () => { state.scale = els.scaleSelect.value; renderNotePicker(); autosave(); });
    els.kitSelect.addEventListener('change', () => { state.kit = els.kitSelect.value; autosave(); });
    els.sidechainSelect.addEventListener('change', () => { state.sidechain = els.sidechainSelect.value; autosave(); });

    // master / fx
    els.masterVolumeRange.addEventListener('input', () => {
      state.master.volume = Number(els.masterVolumeRange.value);
      if (engine) engine.setMasterVolume(state.master.volume);
      autosave();
    });
    els.masterFilterRange.addEventListener('input', () => {
      state.fx.filter.cutoff = Number(els.masterFilterRange.value);
      if (engine) engine.setMasterFilter(state.fx.filter.cutoff, state.fx.filter.resonance);
      autosave();
    });
    els.masterResonanceRange.addEventListener('input', () => {
      state.fx.filter.resonance = Number(els.masterResonanceRange.value);
      if (engine) engine.setMasterFilter(state.fx.filter.cutoff, state.fx.filter.resonance);
      autosave();
    });
    els.filterSweepRange.addEventListener('input', () => {
      const v = Number(els.filterSweepRange.value);
      const cutoff = 200 * ((20000 / 200) ** v);
      els.masterFilterRange.value = String(cutoff);
      state.fx.filter.cutoff = cutoff;
      if (engine) engine.setMasterFilter(cutoff, state.fx.filter.resonance);
    });

    els.delayAmountRange.addEventListener('input', () => {
      state.fx.delay.amount = Number(els.delayAmountRange.value);
      if (engine) engine.setDelaySend(state.fx.delay.amount);
      autosave();
    });
    els.delayFeedbackRange.addEventListener('input', () => {
      state.fx.delay.feedback = Number(els.delayFeedbackRange.value);
      if (engine) engine.setDelayFeedback(state.fx.delay.feedback);
      autosave();
    });
    els.delayTimeSelect.addEventListener('change', () => {
      state.fx.delay.time = els.delayTimeSelect.value;
      if (engine) engine.setDelayTime(delayTimeForBpm(state.bpm, state.fx.delay.time));
      autosave();
    });

    els.reverbAmountRange.addEventListener('input', () => {
      state.fx.reverb.amount = Number(els.reverbAmountRange.value);
      if (engine) engine.setReverbSend(state.fx.reverb.amount);
      autosave();
    });
    let reverbSizeTimer = null;
    els.reverbSizeRange.addEventListener('input', () => {
      state.fx.reverb.size = Number(els.reverbSizeRange.value);
      if (reverbSizeTimer) clearTimeout(reverbSizeTimer);
      reverbSizeTimer = setTimeout(() => { if (engine) engine.setReverbSize(state.fx.reverb.size); }, 70);
      autosave();
    });

    // patterns
    els.btnDuplicate.addEventListener('click', () => {
      const idx = PATTERN_IDS.indexOf(state.currentPattern);
      const target = PATTERN_IDS[(idx + 1) % PATTERN_IDS.length];
      state.patterns[target] = duplicateInto(state.patterns[state.currentPattern]);
      state.currentPattern = target;
      selectedBassStep = null;
      renderSequencer();
      renderNotePicker();
      buildPatternTabs();
      autosave();
    });
    els.btnClearPattern.addEventListener('click', () => {
      if (confirm(`Clear all steps in Pattern ${state.currentPattern}? This cannot be undone.`)) {
        clearPattern(state.patterns[state.currentPattern]);
        renderSequencer();
        buildPatternTabs();
        autosave();
      }
    });

    els.btnRandomizeDrums.addEventListener('click', () => {
      randomizeDrums(state.patterns[state.currentPattern], Number(els.densityRange.value));
      renderSequencer();
      buildPatternTabs();
      autosave();
    });
    els.btnRandomizeBass.addEventListener('click', () => {
      randomizeBass(state.patterns[state.currentPattern], state.root, state.scale, Number(els.densityRange.value));
      selectedBassStep = null;
      renderSequencer();
      renderNotePicker();
      buildPatternTabs();
      autosave();
    });
    els.btnRandomizeAll.addEventListener('click', () => {
      randomizeAll(state.patterns[state.currentPattern], state.root, state.scale, Number(els.densityRange.value));
      selectedBassStep = null;
      renderSequencer();
      renderNotePicker();
      buildPatternTabs();
      autosave();
    });

    els.chainEnabled.addEventListener('change', () => {
      state.chainEnabled = els.chainEnabled.checked;
      chainPos = 0;
      updateNextChip();
      autosave();
    });

    // project management
    els.projectName.addEventListener('input', () => { state.projectName = els.projectName.value || 'Untitled Beat'; autosave(); });
    els.btnSave.addEventListener('click', () => { storage.saveProject(state); flashSaved(); });
    els.btnLoad.addEventListener('click', () => {
      if (!storage.hasSavedProject()) { alert('No saved project found yet — try Save first.'); return; }
      if (confirm('Load the saved project? Unsaved changes here will be lost.')) {
        state = mergeWithDefaults(storage.loadProject());
        afterStateReplaced();
      }
    });
    els.btnNew.addEventListener('click', () => {
      if (confirm('Start a new, empty project? Unsaved changes will be lost.')) {
        state = defaultState();
        afterStateReplaced();
      }
    });

    // help / tutorial
    els.btnHelp.addEventListener('click', () => { els.helpDialog.hidden = false; });
    els.closeHelp.addEventListener('click', () => { els.helpDialog.hidden = true; });
    els.helpDialog.addEventListener('click', (e) => { if (e.target === els.helpDialog) els.helpDialog.hidden = true; });
    els.closeTutorial.addEventListener('click', closeTutorial);
    els.tutorialStart.addEventListener('click', closeTutorial);
    els.tutorial.addEventListener('click', (e) => { if (e.target === els.tutorial) closeTutorial(); });

    els.btnReducedMotion.addEventListener('click', () => {
      reducedMotion = !reducedMotion;
      applyReducedMotion();
    });

    // performance mode
    els.btnMuteAll.addEventListener('click', toggleMuteAll);
    els.btnBassCut.addEventListener('pointerdown', () => setBassCut(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => els.btnBassCut.addEventListener(ev, () => setBassCut(false)));
    els.btnDrop.addEventListener('click', doDrop);
    els.btnBeatRepeat.addEventListener('click', doBeatRepeat);

    // keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        if (scheduler && scheduler.playing) stop(); else play();
        return;
      }
      const trackForKey = Object.keys(TRACK_KEYS).find((id) => TRACK_KEYS[id].toLowerCase() === key);
      if (trackForKey) {
        const btn = els.padsGrid.querySelector(`[data-track="${trackForKey}"]`);
        triggerPad(trackForKey, btn);
        return;
      }
      if (key === 'r') {
        randomizeAll(state.patterns[state.currentPattern], state.root, state.scale, Number(els.densityRange.value));
        renderSequencer();
        buildPatternTabs();
        autosave();
      }
    });

    document.addEventListener('visibilitychange', () => {
      // Audio timing is unaffected by tab visibility; this just guarantees the
      // playhead snaps back in sync with ctx.currentTime the moment we're visible
      // again, instead of animating from a stale position.
      if (document.visibilityState === 'visible' && engine && scheduler && scheduler.playing) {
        currentPlayheadStep = -1;
      }
    });
  }

  return { getState: () => state };
}

function mergeWithDefaults(loaded) {
  const base = defaultState();
  if (!loaded || typeof loaded !== 'object') return demoState();
  const merged = { ...base, ...loaded };
  merged.patterns = { ...base.patterns, ...(loaded.patterns || {}) };
  merged.mixer = { ...base.mixer, ...(loaded.mixer || {}) };
  merged.bassParams = { ...base.bassParams, ...(loaded.bassParams || {}) };
  merged.fx = {
    delay: { ...base.fx.delay, ...((loaded.fx || {}).delay || {}) },
    reverb: { ...base.fx.reverb, ...((loaded.fx || {}).reverb || {}) },
    filter: { ...base.fx.filter, ...((loaded.fx || {}).filter || {}) },
  };
  merged.master = { ...base.master, ...(loaded.master || {}) };
  merged.chain = Array.isArray(loaded.chain) && loaded.chain.length ? loaded.chain : base.chain;
  return merged;
}
