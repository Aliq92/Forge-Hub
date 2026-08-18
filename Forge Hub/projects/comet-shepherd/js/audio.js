// Lightweight Web Audio SFX/ambience. Synthesized only — no external assets, never blocks gameplay.

export class AudioEngine{
  constructor(){
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.7;
    this.humOsc = null;
    this.ready = false;
  }

  init(){
    if(this.ready) return;
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol * 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      this.ready = true;
      this._startHum();
    } catch(e){ this.ready = false; }
  }

  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{}); }

  setMusicVolume(v01){ this.musicVol = v01; if(this.musicGain) this.musicGain.gain.value = v01 * 0.5; }
  setSoundVolume(v01){ this.sfxVol = v01; if(this.sfxGain) this.sfxGain.gain.value = v01; }

  _startHum(){
    if(!this.ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 68;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    osc.connect(gain); gain.connect(this.musicGain);
    osc.start(); lfo.start();
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
    this.humOsc = { osc, gain, lfo };
  }

  setHumIntensity(t01){
    if(!this.humOsc || !Number.isFinite(t01)) return;
    const base = 0.035 + t01 * 0.06;
    this.humOsc.gain.gain.setTargetAtTime(base, this.ctx.currentTime, 0.6);
    this.humOsc.osc.frequency.setTargetAtTime(58 + t01 * 40, this.ctx.currentTime, 0.6);
  }

  _tone(freq, dur, type='sine', vol=0.25, glideTo=null){
    if(!this.ready) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if(glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20,glideTo), ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }

  correctionPulse(){ this._tone(340, 0.14, 'triangle', 0.14, 260); }
  nudge(){ this._tone(420, 0.08, 'sine', 0.1, 380); }
  emergency(){ this._tone(180, 0.35, 'sawtooth', 0.2, 60); }
  pickupIce(){ this._tone(720, 0.16, 'sine', 0.16, 880); }
  pickupEnergy(){ this._tone(500, 0.14, 'triangle', 0.16, 720); }
  pickupStardust(){ this._tone(980, 0.1, 'sine', 0.12, 1200); }
  pickupCore(){ this._tone(600, 0.4, 'sine', 0.2, 1000); }
  assistChime(){
    if(!this.ready) return;
    this._tone(660, 0.25, 'sine', 0.18, 990);
    setTimeout(()=>this._tone(880,0.3,'sine',0.14,1320), 80);
  }
  flareWarning(){ this._tone(220, 0.5, 'square', 0.1, 220); }
  impact(strength=1){ this._tone(120, 0.25, 'sawtooth', Math.min(0.3,0.12+strength*0.1), 40); }
  gateActivate(){
    if(!this.ready) return;
    this._tone(300,0.6,'sine',0.16,700);
    setTimeout(()=>this._tone(500,0.6,'sine',0.14,1000),150);
    setTimeout(()=>this._tone(800,0.8,'sine',0.12,1500),300);
  }
  upgradeSelect(){ this._tone(440, 0.2, 'triangle', 0.18, 660); }
  breakApart(){
    if(!this.ready) return;
    this._tone(200, 0.8, 'sawtooth', 0.22, 30);
    setTimeout(()=>this._tone(140,0.6,'square',0.16,20),100);
  }
}
