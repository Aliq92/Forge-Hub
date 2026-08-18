import { stepsFrom, emptySteps } from './state.js';

function bassSteps(indices, notes) {
  const steps = emptySteps();
  const noteArr = Array.from({ length: 16 }, () => 'C2');
  indices.forEach((i, idx) => {
    steps[i - 1] = { on: true, vel: 1 };
    noteArr[i - 1] = notes[idx % notes.length];
  });
  return { steps, notes: noteArr };
}

function drumPattern(spec) {
  return {
    kick: stepsFrom(spec.kick || [], 1),
    snare: stepsFrom(spec.snare || [], 1),
    chat: stepsFrom(spec.chat || [], spec.chatVel || 0.8),
    ohat: stepsFrom(spec.ohat || [], 0.85),
    clap: stepsFrom(spec.clap || [], 0.9),
    perc: stepsFrom(spec.perc || [], 0.75),
  };
}

export const PRESETS = {
  lofi: {
    label: 'LO-FI',
    bpm: 76, swing: 55, kit: 'dusty', scale: 'minor', root: 'C',
    drums: drumPattern({
      kick: [1, 9, 12], snare: [5, 13], chat: [1, 3, 5, 7, 9, 11, 13, 15], chatVel: 0.55, ohat: [15], clap: [13], perc: [4, 8, 11],
    }),
    bass: bassSteps([1, 9], ['C2', 'D#2']),
    fx: { delay: { amount: 0.25, feedback: 0.32, time: '1/8' }, reverb: { amount: 0.32, size: 0.5 }, filter: { cutoff: 7500, resonance: 0.7 } },
  },
  house: {
    label: 'HOUSE',
    bpm: 124, swing: 8, kit: 'clean', scale: 'minor', root: 'A',
    drums: drumPattern({
      kick: [1, 5, 9, 13], snare: [], chat: [3, 7, 11, 15], chatVel: 0.7, ohat: [16], clap: [5, 13], perc: [2, 10],
    }),
    bass: bassSteps([1, 4, 7, 9, 12, 14], ['A1', 'A1', 'C2', 'A1', 'E2', 'A1']),
    fx: { delay: { amount: 0.12, feedback: 0.25, time: '1/8' }, reverb: { amount: 0.2, size: 0.35 }, filter: { cutoff: 17000, resonance: 0.5 } },
  },
  techno: {
    label: 'TECHNO',
    bpm: 128, swing: 4, kit: 'electro', scale: 'minor', root: 'C',
    drums: drumPattern({
      kick: [1, 5, 9, 13], snare: [], chat: [1, 3, 5, 7, 9, 11, 13, 15], chatVel: 0.5, ohat: [8, 16], clap: [], perc: [3, 7, 11, 15],
    }),
    bass: bassSteps([1, 3, 5, 7, 9, 11, 13, 15], ['C2', 'C2', 'A#1', 'C2']),
    fx: { delay: { amount: 0.15, feedback: 0.35, time: '1/8' }, reverb: { amount: 0.14, size: 0.3 }, filter: { cutoff: 13000, resonance: 1.2 } },
  },
  trap: {
    label: 'TRAP',
    bpm: 70, swing: 10, kit: 'electro', scale: 'minor', root: 'F',
    drums: drumPattern({
      kick: [1, 4, 7, 11], snare: [9], chat: [1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16], chatVel: 0.65, ohat: [8, 16], clap: [9], perc: [6, 14],
    }),
    bass: bassSteps([1, 7, 9, 13], ['F1', 'F1', 'D#1', 'C2']),
    fx: { delay: { amount: 0.1, feedback: 0.28, time: '1/8' }, reverb: { amount: 0.12, size: 0.25 }, filter: { cutoff: 15000, resonance: 0.6 } },
  },
  funk: {
    label: 'FUNK',
    bpm: 102, swing: 30, kit: 'soft', scale: 'major', root: 'E',
    drums: drumPattern({
      kick: [1, 4, 7, 11, 13], snare: [5, 13], chat: [1, 3, 5, 7, 9, 11, 13, 15], chatVel: 0.75, ohat: [4, 15], clap: [], perc: [2, 6, 10, 14],
    }),
    bass: bassSteps([1, 3, 4, 7, 9, 11, 12, 15], ['E2', 'E2', 'G2', 'E2', 'B1', 'E2', 'D2', 'E2']),
    fx: { delay: { amount: 0.14, feedback: 0.3, time: '1/8d' }, reverb: { amount: 0.16, size: 0.3 }, filter: { cutoff: 16000, resonance: 0.6 } },
  },
  ambient: {
    label: 'AMBIENT',
    bpm: 66, swing: 0, kit: 'deep', scale: 'pentatonicMinor', root: 'D',
    drums: drumPattern({
      kick: [1], snare: [], chat: [9], chatVel: 0.35, ohat: [], clap: [], perc: [5, 13],
    }),
    bass: bassSteps([1], ['D2']),
    fx: { delay: { amount: 0.32, feedback: 0.42, time: '1/4' }, reverb: { amount: 0.62, size: 0.85 }, filter: { cutoff: 6000, resonance: 0.5 } },
  },
  breakbeat: {
    label: 'BREAKBEAT',
    bpm: 132, swing: 12, kit: 'dusty', scale: 'minor', root: 'C',
    drums: drumPattern({
      kick: [1, 7, 10], snare: [5, 13, 14], chat: [1, 3, 5, 7, 9, 11, 13, 15], chatVel: 0.6, ohat: [8], clap: [13], perc: [4, 12],
    }),
    bass: bassSteps([1, 9], ['C2', 'A#1']),
    fx: { delay: { amount: 0.18, feedback: 0.3, time: '1/8' }, reverb: { amount: 0.22, size: 0.4 }, filter: { cutoff: 14000, resonance: 0.6 } },
  },
  minimal: {
    label: 'MINIMAL',
    bpm: 118, swing: 6, kit: 'clean', scale: 'minor', root: 'G',
    drums: drumPattern({
      kick: [1, 9], snare: [], chat: [5, 13], chatVel: 0.5, ohat: [], clap: [9], perc: [],
    }),
    bass: bassSteps([1], ['G1']),
    fx: { delay: { amount: 0.08, feedback: 0.2, time: '1/8' }, reverb: { amount: 0.1, size: 0.25 }, filter: { cutoff: 18000, resonance: 0.4 } },
  },
};

export const PRESET_IDS = Object.keys(PRESETS);
