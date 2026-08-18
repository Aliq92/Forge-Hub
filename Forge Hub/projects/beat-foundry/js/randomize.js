import { scaleNotes } from './bass.js';

// Intelligent-ish randomization: strong beats get higher probability for kicks,
// backbeats for snares, hats stay busy, claps stay sparse, perc leans syncopated.
// `density` is 0..100 and scales every base probability.

function chance(p) {
  return Math.random() < Math.max(0, Math.min(1, p));
}

function densityScale(density) {
  return density / 50; // 50 = neutral (base probabilities as authored below)
}

const STRONG_BEATS = new Set([0, 4, 8, 12]);
const BACKBEATS = new Set([4, 12]);
const OFFBEATS = new Set([2, 6, 10, 14, 3, 7, 11, 15]);

export function randomizeKick(steps, density) {
  const scale = densityScale(density);
  for (let i = 0; i < 16; i += 1) {
    const base = STRONG_BEATS.has(i) ? 0.62 : (i % 4 === 2 ? 0.18 : 0.08);
    const on = chance(base * scale);
    steps[i] = on ? { on: true, vel: STRONG_BEATS.has(i) ? 1 : 0.85 } : { on: false, vel: 1 };
  }
}

export function randomizeSnare(steps, density) {
  const scale = densityScale(density);
  for (let i = 0; i < 16; i += 1) {
    const base = BACKBEATS.has(i) ? 0.82 : 0.07;
    const on = chance(base * scale);
    steps[i] = on ? { on: true, vel: BACKBEATS.has(i) ? 1 : 0.7 } : { on: false, vel: 1 };
  }
}

export function randomizeHat(steps, density, open = false) {
  const scale = densityScale(density);
  for (let i = 0; i < 16; i += 1) {
    const base = open ? 0.16 : 0.6;
    const on = chance(base * scale);
    steps[i] = on ? { on: true, vel: i % 4 === 0 ? 1 : 0.75 } : { on: false, vel: 1 };
  }
}

export function randomizeClap(steps, density) {
  const scale = densityScale(density);
  for (let i = 0; i < 16; i += 1) {
    const base = BACKBEATS.has(i) ? 0.35 : 0.05;
    const on = chance(base * scale);
    steps[i] = on ? { on: true, vel: 0.9 } : { on: false, vel: 1 };
  }
}

export function randomizePerc(steps, density) {
  const scale = densityScale(density);
  for (let i = 0; i < 16; i += 1) {
    const base = OFFBEATS.has(i) ? 0.32 : 0.1;
    const on = chance(base * scale);
    steps[i] = on ? { on: true, vel: 0.8 } : { on: false, vel: 1 };
  }
}

const RANDOMIZERS = {
  kick: randomizeKick,
  snare: randomizeSnare,
  chat: (steps, density) => randomizeHat(steps, density, false),
  ohat: (steps, density) => randomizeHat(steps, density, true),
  clap: randomizeClap,
  perc: randomizePerc,
};

export function randomizeDrums(pattern, density = 50) {
  Object.keys(RANDOMIZERS).forEach((track) => {
    RANDOMIZERS[track](pattern.drums[track], density);
  });
}

export function randomizeBass(pattern, root, scaleId, density = 50) {
  const scale = densityScale(density);
  const inScaleEntries = scaleNotes(root, scaleId).filter((n) => n.inScale);
  const notes = inScaleEntries.map((n) => n.note);
  const lowNotes = notes.filter((n) => /2$/.test(n));
  const pool = lowNotes.length ? lowNotes : notes;
  const rootEntry = inScaleEntries.find((n) => n.isRoot && /2$/.test(n.note)) || inScaleEntries.find((n) => n.isRoot);
  const rootNote = (rootEntry && rootEntry.note) || pool[0];
  for (let i = 0; i < 16; i += 1) {
    const base = STRONG_BEATS.has(i) ? 0.55 : 0.22;
    const on = chance(base * scale);
    if (on) {
      const useRoot = STRONG_BEATS.has(i) && chance(0.6);
      const note = useRoot ? rootNote : pool[Math.floor(Math.random() * pool.length)];
      pattern.bass.steps[i] = { on: true, vel: 1 };
      pattern.bass.notes[i] = note;
    } else {
      pattern.bass.steps[i] = { on: false, vel: 1 };
    }
  }
}

export function randomizeAll(pattern, root, scaleId, density = 50) {
  randomizeDrums(pattern, density);
  randomizeBass(pattern, root, scaleId, density);
}
