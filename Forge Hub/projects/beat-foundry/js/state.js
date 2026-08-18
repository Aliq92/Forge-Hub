// Central data model for Beat Foundry. Plain objects only (serializable to localStorage/JSON).

export const NUM_STEPS = 16;

export const TRACK_IDS = ['kick', 'snare', 'chat', 'ohat', 'clap', 'perc'];

export const TRACK_LABELS = {
  kick: 'KICK',
  snare: 'SNARE',
  chat: 'CL HAT',
  ohat: 'OP HAT',
  clap: 'CLAP',
  perc: 'PERC',
  bass: 'BASS',
};

export const TRACK_KEYS = { kick: 'A', snare: 'S', chat: 'D', ohat: 'F', clap: 'G', perc: 'H' };

export const PATTERN_IDS = ['A', 'B', 'C', 'D'];

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonicMinor: [0, 3, 5, 7, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_LABELS = {
  minor: 'Minor',
  major: 'Major',
  pentatonicMinor: 'Pentatonic Minor',
  pentatonicMajor: 'Pentatonic Major',
  chromatic: 'Chromatic',
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function emptyStep() {
  return { on: false, vel: 1 };
}

export function emptySteps() {
  return Array.from({ length: NUM_STEPS }, emptyStep);
}

export function emptyPattern() {
  const drums = {};
  TRACK_IDS.forEach((id) => { drums[id] = emptySteps(); });
  const bass = {
    steps: emptySteps(),
    notes: Array.from({ length: NUM_STEPS }, () => 'C2'),
  };
  return { drums, bass };
}

export function clonePattern(p) {
  return JSON.parse(JSON.stringify(p));
}

export function stepsFrom(indices1based, vel = 1) {
  const s = emptySteps();
  indices1based.forEach((i) => { s[i - 1] = { on: true, vel }; });
  return s;
}

function defaultMixer() {
  const m = {};
  TRACK_IDS.forEach((id) => { m[id] = { mute: false, solo: false, vol: 0.85 }; });
  m.bass = { mute: false, solo: false, vol: 0.8 };
  return m;
}

export function defaultState() {
  return {
    projectName: 'Untitled Beat',
    bpm: 120,
    swing: 0,
    scale: 'minor',
    root: 'C',
    kit: 'clean',
    patterns: {
      A: emptyPattern(), B: emptyPattern(), C: emptyPattern(), D: emptyPattern(),
    },
    currentPattern: 'A',
    chain: ['A'],
    chainEnabled: false,
    mixer: defaultMixer(),
    bassParams: {
      waveform: 'sawtooth', cutoff: 1400, resonance: 3, decay: 0.32, drive: 0,
    },
    fx: {
      delay: { amount: 0.0, feedback: 0.32, time: '1/8' },
      reverb: { amount: 0.0, size: 0.4 },
      filter: { cutoff: 20000, resonance: 0.6 },
    },
    master: { volume: 0.82 },
    sidechain: 'off', // off | low | high
  };
}

// A tasteful default demo groove so the app never opens empty.
export function demoState() {
  const s = defaultState();
  const p = s.patterns.A;
  p.drums.kick = stepsFrom([1, 9], 1);
  p.drums.kick[6] = { on: true, vel: 0.8 }; // step 7 ghost-ish
  p.drums.snare = stepsFrom([5, 13], 1);
  p.drums.chat = stepsFrom([1, 3, 5, 7, 9, 11, 13, 15], 0.85);
  p.drums.chat[14] = { on: true, vel: 1 };
  p.drums.ohat = stepsFrom([15], 0.9);
  p.drums.clap = stepsFrom([13], 0.9);
  p.drums.perc = stepsFrom([4, 11], 0.75);
  p.bass.steps = stepsFrom([1, 7, 9, 12], 1);
  p.bass.notes[0] = 'C2';
  p.bass.notes[6] = 'D#2';
  p.bass.notes[8] = 'C2';
  p.bass.notes[11] = 'G2';
  s.fx.delay.amount = 0.16;
  s.fx.reverb.amount = 0.18;
  return s;
}
