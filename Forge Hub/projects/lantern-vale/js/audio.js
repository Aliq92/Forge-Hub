// Lightweight procedural Web Audio sound effects and ambient drone.
// No external assets. Lazily initialized on first user gesture.

export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ready = false;
    this._droneNodes = null;
  }

  init() {
    if (this.ready) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicVolume;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.soundVolume;
      this.sfxGain.connect(this.master);
      this.ready = true;
      this.startAmbient();
    } catch (e) { this.ready = false; }
  }

  setVolumes(settings) {
    this.settings = settings;
    if (!this.ready) return;
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, this.ctx.currentTime, 0.2);
    this.sfxGain.gain.setTargetAtTime(settings.soundVolume, this.ctx.currentTime, 0.2);
  }

  startAmbient() {
    if (!this.ready || this._droneNodes) return;
    const ctx = this.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 82.5;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(this.musicGain);
    o1.start(); o2.start(); lfo.start();
    this._droneNodes = { o1, o2, g, lfo };
  }

  _blip({ freq = 440, dur = 0.15, type = 'sine', gain = 0.15, glideTo = null, delay = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  footstep() { this._blip({ freq: 120 + Math.random() * 20, dur: 0.06, type: 'triangle', gain: 0.04 }); }
  fireflyPickup() { this._blip({ freq: 660, dur: 0.18, type: 'sine', gain: 0.12, glideTo: 1100 }); }
  shrineActivate() {
    this._blip({ freq: 220, dur: 1.1, type: 'sine', gain: 0.18, glideTo: 660 });
    this._blip({ freq: 330, dur: 1.3, type: 'triangle', gain: 0.1, glideTo: 880, delay: 0.15 });
  }
  shadowWhisper() { this._blip({ freq: 90, dur: 0.4, type: 'sawtooth', gain: 0.05, glideTo: 40 }); }
  flare() {
    this._blip({ freq: 180, dur: 0.4, type: 'square', gain: 0.14, glideTo: 500 });
  }
  hurt() { this._blip({ freq: 200, dur: 0.25, type: 'sawtooth', gain: 0.15, glideTo: 80 }); }
  upgrade() { this._blip({ freq: 440, dur: 0.5, type: 'sine', gain: 0.15, glideTo: 880 }); }
  victory() {
    [0, 0.15, 0.3, 0.5].forEach((d, i) => this._blip({ freq: 330 * (1 + i * 0.25), dur: 0.8, type: 'sine', gain: 0.16, glideTo: 660 * (1 + i * 0.25), delay: d }));
  }
}
