// audio.js — small WebAudio synth. No bundled assets, everything generated.
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.musicNodes = null;
    this.musicOn = false;
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfxVolume;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicVolume;
    this.musicGain.connect(this.master);
    return this.ctx;
  }

  resume() {
    const ctx = this._ensure();
    if (ctx.state === 'suspended') ctx.resume();
  }

  setVolumes(settings) {
    this.settings = settings;
    if (!this.ctx) return;
    this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, this.ctx.currentTime, 0.05);
  }

  _tone(freq, dur, type = 'sine', gainPeak = 0.18, opts = {}) {
    const ctx = this._ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  jump() { this._tone(420, 0.14, 'triangle', 0.16, { slideTo: 720 }); }
  land() { this._tone(160, 0.1, 'sine', 0.14, { slideTo: 90 }); }
  footstep() { this._tone(200 + Math.random() * 40, 0.04, 'square', 0.03); }
  recordStart() { this._tone(300, 0.09, 'sawtooth', 0.1, { slideTo: 620 }); this._tone(900, 0.09, 'sine', 0.05); }
  recordStop() { this._tone(620, 0.12, 'sawtooth', 0.1, { slideTo: 260 }); }
  rewind() {
    const ctx = this._ensure();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.4);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + 0.45);
  }
  echoMaterialize() { this._tone(500, 0.3, 'sine', 0.1, { slideTo: 900 }); this._tone(750, 0.3, 'triangle', 0.06, { slideTo: 1300 }); }
  switchClick() { this._tone(700, 0.05, 'square', 0.08); }
  doorMove() { this._tone(140, 0.2, 'square', 0.05, { slideTo: 200 }); }
  laserHum() { /* looped hum omitted for simplicity; contact uses death() */ }
  death() { this._tone(180, 0.25, 'sawtooth', 0.14, { slideTo: 60 }); }
  levelComplete() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.28, 'sine', 0.12), i * 90));
  }
  uiClick() { this._tone(500, 0.05, 'sine', 0.06); }

  startMusic() {
    if (this.musicOn) return;
    const ctx = this._ensure();
    this.musicOn = true;
    const notes = [220, 261.6, 293.7, 329.6, 246.9];
    let i = 0;
    const playNote = () => {
      if (!this.musicOn) return;
      const f = notes[i % notes.length];
      i++;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f / 2;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.05, t0 + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
      osc.connect(gain).connect(this.musicGain);
      osc.start(t0); osc.stop(t0 + 3.7);
      this._musicTimer = setTimeout(playNote, 2600 + Math.random() * 800);
    };
    playNote();
  }

  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
  }
}
