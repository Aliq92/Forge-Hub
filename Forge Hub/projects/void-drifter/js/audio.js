// ---------------- Web Audio synthesized sound engine (no external assets) ----------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    this.thrustNode = null;
    this.hummer = null;
    this.enabled = true;
    this._noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.35;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this._buildNoiseBuffer();
      this._startAmbientHum();
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMusicVolume(v01) { this.musicVolume = v01; if (this.musicGain) this.musicGain.gain.value = v01 * 0.35; }
  setSfxVolume(v01) { this.sfxVolume = v01; if (this.sfxGain) this.sfxGain.gain.value = v01; }

  _buildNoiseBuffer() {
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  _startAmbientHum() {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.value = 42;
    osc2.type = 'sine'; osc2.frequency.value = 63;
    gain.gain.value = 0.4;
    osc1.connect(gain); osc2.connect(gain);
    gain.connect(this.musicGain);
    osc1.start(); osc2.start();
    this.hummer = { osc1, osc2, gain };
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }

  _tone(freq, dur, type = 'sine', vol = 0.3, glideTo = null, out = null) {
    if (!this.ctx) return;
    const t0 = this._now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(out || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.3, filterFreq = 1200, out = null) {
    if (!this.ctx || !this._noiseBuffer) return;
    const t0 = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(out || this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playPickup(type = 'fuel') {
    const map = { fuel: 520, energy: 660, salvage: 440, repair: 340, rarecore: 880 };
    const f = map[type] || 500;
    this._tone(f, 0.14, 'triangle', 0.22, f * 1.8);
    this._tone(f * 1.5, 0.18, 'sine', 0.12, f * 2.2);
  }

  playCollision(severity = 0.5) {
    this._noise(0.25 + severity * 0.2, 0.15 + severity * 0.35, 500 + severity * 800);
    this._tone(90 - severity * 40, 0.2, 'sawtooth', 0.15 * severity, 40);
  }

  playUpgrade() {
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.2), i * 70);
    });
  }

  playWarning() {
    this._tone(220, 0.12, 'square', 0.12, 180);
  }

  playDestruction() {
    this._noise(0.9, 0.4, 900);
    this._tone(120, 0.9, 'sawtooth', 0.3, 30);
  }

  playBoost() {
    this._tone(180, 0.3, 'sawtooth', 0.15, 420);
  }

  playShieldHit() {
    this._tone(700, 0.15, 'sine', 0.18, 300);
  }

  playDock() {
    this._tone(300, 0.3, 'sine', 0.2, 500);
  }

  setThrust(active, boosting) {
    if (!this.ctx) return;
    if (active && !this.thrustNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.09, this._now() + 0.15);
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      src.start();
      this.thrustNode = { src, gain, filter };
    } else if (!active && this.thrustNode) {
      const { src, gain } = this.thrustNode;
      const t0 = this._now();
      gain.gain.cancelScheduledValues(t0);
      gain.gain.setValueAtTime(gain.gain.value, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      setTimeout(() => { try { src.stop(); } catch (e) {} }, 250);
      this.thrustNode = null;
    }
    if (this.thrustNode) {
      this.thrustNode.filter.frequency.value = boosting ? 900 : 380;
      this.thrustNode.gain.gain.value = boosting ? 0.16 : 0.09;
    }
  }
}
