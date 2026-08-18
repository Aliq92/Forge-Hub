// Procedural drum synthesis. Every trigger function builds a small disposable node
// graph and connects it straight to `dest` (the track's mix bus).

function noiseSource(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const maxStart = Math.max(0, buffer.duration - 1.0);
  src.loop = false;
  if (maxStart > 0) src.playbackRate.value = 1;
  return src;
}

function satCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount * 50 + 1;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export function triggerKick(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const {
    pitch = 155, pitchEnd = 48, decay = 0.34, drive = 0.15, click = 0.22,
  } = opts;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(pitchEnd, 20), time + 0.085);

  const shaper = ctx.createWaveShaper();
  shaper.curve = satCurve(drive);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.05, vel), time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  osc.connect(shaper);
  shaper.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + decay + 0.05);

  if (click > 0) {
    const src = noiseSource(ctx, noiseBuffer);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(click * vel, time);
    cg.gain.exponentialRampToValueAtTime(0.001, time + 0.018);
    src.connect(hp);
    hp.connect(cg);
    cg.connect(dest);
    src.start(time);
    src.stop(time + 0.03);
  }
}

export function triggerSnare(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const {
    decay = 0.16, tone = 190, toneDecay = 0.09, noiseAmt = 0.9,
  } = opts;

  const src = noiseSource(ctx, noiseBuffer);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.9;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(noiseAmt * vel, time);
  ng.gain.exponentialRampToValueAtTime(0.001, time + decay);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(dest);
  src.start(time);
  src.stop(time + decay + 0.03);

  [tone, tone * 1.65].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    const og = ctx.createGain();
    const amt = i === 0 ? 0.55 : 0.25;
    og.gain.setValueAtTime(amt * vel, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
    osc.connect(og);
    og.connect(dest);
    osc.start(time);
    osc.stop(time + toneDecay + 0.02);
  });
}

// Six inharmonic square oscillators through band/high-pass filters — the classic
// analog-drum-machine hi-hat trick. Shared by closed and open hat, differing mainly
// in decay time.
function hatVoice(ctx, dest, time, vel, decay, level) {
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
  const fundamental = 42;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 9000;
  bandpass.Q.value = 0.7;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level * vel, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  bandpass.connect(highpass);
  highpass.connect(g);
  g.connect(dest);

  ratios.forEach((r) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = fundamental * r;
    osc.connect(bandpass);
    osc.start(time);
    osc.stop(time + decay + 0.03);
  });
}

export function triggerClosedHat(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const { decay = 0.055, level = 0.55 } = opts;
  hatVoice(ctx, dest, time, vel, decay, level);
}

export function triggerOpenHat(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const { decay = 0.32, level = 0.5 } = opts;
  hatVoice(ctx, dest, time, vel, decay, level);
}

export function triggerClap(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const { decay = 0.22, spread = 0.011 } = opts;
  const bursts = [0, spread, spread * 2, spread * 3.4];
  bursts.forEach((offset, i) => {
    const t = time + offset;
    const src = noiseSource(ctx, noiseBuffer);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    const isLast = i === bursts.length - 1;
    const burstDecay = isLast ? decay : 0.02;
    g.gain.setValueAtTime(vel * (isLast ? 0.9 : 0.65), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + burstDecay);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + burstDecay + 0.03);
  });
}

export function triggerPerc(ctx, noiseBuffer, dest, time, vel, opts = {}) {
  const {
    pitch = 260, pitchEnd = 190, decay = 0.16, noiseAmt = 0.35,
  } = opts;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, time);
  osc.frequency.exponentialRampToValueAtTime(pitchEnd, time + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.8, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + decay + 0.03);

  if (noiseAmt > 0) {
    const src = noiseSource(ctx, noiseBuffer);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(noiseAmt * vel, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.5);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(dest);
    src.start(time);
    src.stop(time + decay * 0.5 + 0.02);
  }
}

export const DRUM_TRIGGERS = {
  kick: triggerKick,
  snare: triggerSnare,
  chat: triggerClosedHat,
  ohat: triggerOpenHat,
  clap: triggerClap,
  perc: triggerPerc,
};
