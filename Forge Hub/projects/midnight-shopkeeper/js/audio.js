// Lightweight synthesized sound effects & ambience — no external audio files.
let ctx = null;
let musicGain = null;
let sfxGain = null;
let rainSource = null;
let rainGain = null;
let droneOsc = null;
let droneGain = null;
let enabled = true;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ensureCtx(); }

export function setVolumes(musicVolume, sfxVolume) {
  if (!ensureCtx()) return;
  musicGain.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.05);
  sfxGain.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
}

function envGain(dest, attack, decay, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(peak, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + decay);
  g.connect(dest);
  return g;
}

function tone(freq, attack, decay, peak, type = 'sine', detuneAt) {
  if (!ensureCtx()) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (detuneAt) osc.frequency.exponentialRampToValueAtTime(detuneAt, ctx.currentTime + attack + decay);
  const g = envGain(sfxGain, attack, decay, peak);
  osc.connect(g);
  osc.start();
  osc.stop(ctx.currentTime + attack + decay + 0.05);
}

export function playBell() {
  tone(1300, 0.005, 0.5, 0.22, 'sine');
  tone(1950, 0.005, 0.35, 0.1, 'sine');
}
export function playCoin() {
  tone(1100, 0.002, 0.12, 0.18, 'triangle', 1500);
  setTimeout(() => tone(1500, 0.002, 0.14, 0.14, 'triangle'), 60);
}
export function playPlace() { tone(220, 0.001, 0.08, 0.15, 'sine'); }
export function playDrawer() { tone(90, 0.01, 0.25, 0.2, 'triangle'); }
export function playPage() {
  if (!ensureCtx()) return;
  const bufferSize = ctx.sampleRate * 0.18;
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass'; filt.frequency.value = 2200;
  const g = envGain(sfxGain, 0.005, 0.16, 0.2);
  src.connect(filt); filt.connect(g);
  src.start();
}
export function playChime() {
  [880, 1108, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.005, 0.4, 0.16, 'sine'), i * 110));
}
export function playClick() { tone(500, 0.001, 0.05, 0.08, 'square'); }

export function startAmbience(rainLevel = 1) {
  if (!ensureCtx()) return;
  stopAmbience();
  const bufferSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.2;
  }
  rainSource = ctx.createBufferSource();
  rainSource.buffer = buf;
  rainSource.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 1800;
  rainGain = ctx.createGain();
  rainGain.gain.value = 0.5 * rainLevel;
  rainSource.connect(filt); filt.connect(rainGain); rainGain.connect(musicGain);
  rainSource.start();

  droneOsc = ctx.createOscillator();
  droneOsc.type = 'sine'; droneOsc.frequency.value = 68;
  droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
  droneOsc.connect(droneGain); droneGain.connect(musicGain);
  droneOsc.start();
}

export function stopAmbience() {
  try { rainSource && rainSource.stop(); } catch (e) { /* already stopped */ }
  try { droneOsc && droneOsc.stop(); } catch (e) { /* already stopped */ }
  rainSource = null; droneOsc = null;
}
