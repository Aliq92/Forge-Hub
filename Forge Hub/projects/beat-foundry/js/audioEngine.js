// Owns the AudioContext and the master signal chain:
// track buses -> sum bus --+--> master filter -> compressor -> master gain -> analyser -> destination
//                          |                                        ^
//                          +--> delay send -> delay network ---------+
//                          +--> reverb send -> convolver -----------+

const MAX_DELAY_FEEDBACK = 0.82; // hard clamp so the delay network can never run away

function makeNoiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulseResponse(ctx, size) {
  // size 0..1 -> decay length ~0.4s .. 3.2s. Synthetic exponential-decay noise tail,
  // generated directly (no offline render needed) so it's cheap to regenerate live.
  const duration = 0.4 + size * 2.8;
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      const envelope = (1 - t) ** (2 + size * 2);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }
  return buf;
}

export function createAudioEngine() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const sumBus = ctx.createGain();
  sumBus.gain.value = 1;

  // --- delay send ---
  const delaySend = ctx.createGain();
  delaySend.gain.value = 0;
  const delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.25;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.32;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 5200;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 1;

  delaySend.connect(delayNode);
  delayNode.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode); // feedback loop, clamped in setDelayFeedback
  delayFilter.connect(delayOut);

  // --- reverb send (synthetic IR via ConvolverNode) ---
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.buffer = makeImpulseResponse(ctx, 0.4);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 1;
  reverbSend.connect(convolver);
  convolver.connect(reverbOut);

  // --- master filter / dynamics / gain ---
  const masterFilter = ctx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 20000;
  masterFilter.Q.value = 0.6;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.82;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;

  sumBus.connect(delaySend);
  sumBus.connect(reverbSend);
  sumBus.connect(masterFilter);
  delayOut.connect(masterFilter);
  reverbOut.connect(masterFilter);
  masterFilter.connect(compressor);
  compressor.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(ctx.destination);

  const sharedNoiseBuffer = makeNoiseBuffer(ctx, 2.0);

  // Per-track buses (gain -> pan -> sumBus), used for mute/solo/volume.
  const trackBuses = {};
  function getTrackBus(id) {
    if (trackBuses[id]) return trackBuses[id];
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    gain.connect(sumBus);
    trackBuses[id] = { gain };
    return trackBuses[id];
  }

  function rampGain(param, value, time = 0.02) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(Math.max(0.0001, value), now, time);
  }

  function setDelayTime(seconds) {
    const now = ctx.currentTime;
    delayNode.delayTime.cancelScheduledValues(now);
    delayNode.delayTime.setTargetAtTime(Math.max(0.01, Math.min(1.8, seconds)), now, 0.03);
  }

  function setDelayFeedback(fb) {
    delayFeedback.gain.setTargetAtTime(Math.min(MAX_DELAY_FEEDBACK, Math.max(0, fb)), ctx.currentTime, 0.02);
  }

  function setDelaySend(amount) {
    rampGain(delaySend.gain, amount * 0.9);
  }

  function setReverbSend(amount) {
    rampGain(reverbSend.gain, amount * 1.1);
  }

  function setReverbSize(size) {
    convolver.buffer = makeImpulseResponse(ctx, size);
  }

  function setMasterFilter(cutoff, resonance) {
    const now = ctx.currentTime;
    masterFilter.frequency.cancelScheduledValues(now);
    masterFilter.frequency.setTargetAtTime(cutoff, now, 0.015);
    masterFilter.Q.cancelScheduledValues(now);
    masterFilter.Q.setTargetAtTime(resonance, now, 0.015);
  }

  function setMasterVolume(v) {
    rampGain(masterGain.gain, v, 0.015);
  }

  async function resume() {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  return {
    ctx,
    sumBus,
    noiseBuffer: sharedNoiseBuffer,
    getTrackBus,
    analyser,
    setDelayTime,
    setDelayFeedback,
    setDelaySend,
    setReverbSend,
    setReverbSize,
    setMasterFilter,
    setMasterVolume,
    resume,
  };
}
