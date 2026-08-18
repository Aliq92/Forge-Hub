import { NOTE_NAMES, SCALES } from './state.js';

export function noteToFreq(note) {
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) return 110;
  const idx = NOTE_NAMES.indexOf(m[1]);
  const octave = parseInt(m[2], 10);
  const midi = (octave + 1) * 12 + idx;
  return 440 * (2 ** ((midi - 69) / 12));
}

// Builds the list of note names (e.g. "C2") available in the note picker for a
// given root + scale across a musically useful bass range.
export function scaleNotes(root, scaleId) {
  const scale = SCALES[scaleId] || SCALES.minor;
  const rootIdx = NOTE_NAMES.indexOf(root);
  const notes = [];
  for (let octave = 1; octave <= 4; octave += 1) {
    for (let semitone = 0; semitone < 12; semitone += 1) {
      const name = NOTE_NAMES[semitone];
      const pitchClass = (semitone - rootIdx + 12) % 12;
      const inScale = scale.includes(pitchClass);
      const noteName = `${name}${octave}`;
      const freq = noteToFreq(noteName);
      if (freq >= 55 && freq <= 300) {
        notes.push({ note: noteName, inScale, isRoot: pitchClass === 0 });
      }
    }
  }
  return notes;
}

function satCurve(amount) {
  const n = 512;
  const curve = new Float32Array(n);
  const k = amount * 40 + 1;
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export function triggerBass(ctx, dest, time, note, vel, params, stepDur) {
  const {
    waveform = 'sawtooth', cutoff = 1400, resonance = 3, decay = 0.32, drive = 0,
  } = params;
  const freq = noteToFreq(note);

  const osc = ctx.createOscillator();
  osc.type = waveform;
  osc.frequency.setValueAtTime(freq, time);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq / 2, time);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.32;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(80, cutoff), time);
  filter.Q.setValueAtTime(Math.max(0.1, resonance), time);

  const shaper = ctx.createWaveShaper();
  shaper.curve = satCurve(drive);
  shaper.oversample = '2x';

  const g = ctx.createGain();
  const sustain = Math.max(0.06, Math.min(decay, stepDur * 3));
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.05, vel * 0.9), time + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, time + sustain);

  osc.connect(filter);
  sub.connect(subGain);
  subGain.connect(filter);
  filter.connect(shaper);
  shaper.connect(g);
  g.connect(dest);

  osc.start(time);
  sub.start(time);
  const stopTime = time + sustain + 0.08;
  osc.stop(stopTime);
  sub.stop(stopTime);
}
