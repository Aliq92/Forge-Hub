// Lightweight synthesized audio (no external assets).
SG.Audio = class {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.droneNodes = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.7;
    this.unlocked = false;
  }

  ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol * 0.35;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
  }

  unlock() {
    this.ensureCtx();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  setVolumes(musicPct, sfxPct) {
    this.musicVol = musicPct / 100;
    this.sfxVol = sfxPct / 100;
    if (this.musicGain) this.musicGain.gain.value = this.musicVol * 0.35;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
  }

  startDrone() {
    if (!this.ctx || this.droneNodes) return;
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    osc2.type = 'sine'; osc2.frequency.value = 82.5;
    gain.gain.value = 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 400;
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(gain); gain.connect(this.musicGain);
    osc1.start(); osc2.start();
    this.droneNodes = { osc1, osc2, gain, filter };
  }

  stopDrone() {
    if (!this.droneNodes) return;
    try { this.droneNodes.osc1.stop(); this.droneNodes.osc2.stop(); } catch (e) {}
    this.droneNodes = null;
  }

  tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.3, slideTo = null, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, gain = 0.25, delay = 0, filterFreq = 1200 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  pickup(valueTier = 0) { this.tone({ freq: 660 + valueTier * 140, dur: 0.12, type: 'sine', gain: 0.22, slideTo: 940 + valueTier * 140 }); }
  restore() { this.tone({ freq: 220, dur: 0.35, type: 'sine', gain: 0.2, slideTo: 440 }); this.noise({ dur: 0.3, gain: 0.05 }); }
  plant() { this.tone({ freq: 300, dur: 0.25, type: 'triangle', gain: 0.2, slideTo: 520 }); }
  dash() { this.noise({ dur: 0.15, gain: 0.15, filterFreq: 2200 }); }
  warning() { this.tone({ freq: 180, dur: 0.4, type: 'sawtooth', gain: 0.12 }); }
  impact(big = false) {
    this.noise({ dur: big ? 0.5 : 0.28, gain: big ? 0.35 : 0.22, filterFreq: 700 });
    this.tone({ freq: big ? 90 : 140, dur: big ? 0.5 : 0.28, type: 'sine', gain: 0.25, slideTo: 40 });
  }
  hit() { this.tone({ freq: 150, dur: 0.2, type: 'square', gain: 0.2, slideTo: 60 }); }
  upgrade() { this.tone({ freq: 440, dur: 0.15, gain: 0.2, delay: 0 }); this.tone({ freq: 660, dur: 0.2, gain: 0.2, delay: 0.1 }); this.tone({ freq: 880, dur: 0.3, gain: 0.2, delay: 0.2 }); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.22, delay: i * 0.15 })); }
};
