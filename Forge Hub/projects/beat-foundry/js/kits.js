// Sound kit parameter sets. Kits tweak the synthesis parameters passed into drums.js
// triggers — no external samples, just different oscillator/filter/envelope values.

export const KITS = {
  clean: {
    label: 'CLEAN',
    kick: { pitch: 155, pitchEnd: 48, decay: 0.34, drive: 0.15, click: 0.22 },
    snare: { decay: 0.16, tone: 190, toneDecay: 0.09, noiseAmt: 0.9 },
    chat: { decay: 0.055, level: 0.55 },
    ohat: { decay: 0.32, level: 0.5 },
    clap: { decay: 0.22, spread: 0.011 },
    perc: { pitch: 260, pitchEnd: 190, decay: 0.16, noiseAmt: 0.35 },
  },
  dusty: {
    label: 'DUSTY',
    kick: { pitch: 130, pitchEnd: 42, decay: 0.4, drive: 0.4, click: 0.12 },
    snare: { decay: 0.14, tone: 165, toneDecay: 0.08, noiseAmt: 0.75 },
    chat: { decay: 0.045, level: 0.4 },
    ohat: { decay: 0.24, level: 0.4 },
    clap: { decay: 0.2, spread: 0.014 },
    perc: { pitch: 220, pitchEnd: 160, decay: 0.14, noiseAmt: 0.5 },
  },
  deep: {
    label: 'DEEP',
    kick: { pitch: 110, pitchEnd: 36, decay: 0.5, drive: 0.25, click: 0.14 },
    snare: { decay: 0.2, tone: 150, toneDecay: 0.12, noiseAmt: 0.8 },
    chat: { decay: 0.06, level: 0.45 },
    ohat: { decay: 0.4, level: 0.45 },
    clap: { decay: 0.26, spread: 0.012 },
    perc: { pitch: 190, pitchEnd: 130, decay: 0.2, noiseAmt: 0.3 },
  },
  electro: {
    label: 'ELECTRO',
    kick: { pitch: 175, pitchEnd: 55, decay: 0.28, drive: 0.5, click: 0.32 },
    snare: { decay: 0.13, tone: 220, toneDecay: 0.07, noiseAmt: 1.0 },
    chat: { decay: 0.04, level: 0.65 },
    ohat: { decay: 0.22, level: 0.6 },
    clap: { decay: 0.18, spread: 0.009 },
    perc: { pitch: 320, pitchEnd: 220, decay: 0.12, noiseAmt: 0.4 },
  },
  soft: {
    label: 'SOFT',
    kick: { pitch: 140, pitchEnd: 44, decay: 0.36, drive: 0.05, click: 0.08 },
    snare: { decay: 0.18, tone: 175, toneDecay: 0.11, noiseAmt: 0.55 },
    chat: { decay: 0.07, level: 0.35 },
    ohat: { decay: 0.36, level: 0.35 },
    clap: { decay: 0.24, spread: 0.013 },
    perc: { pitch: 240, pitchEnd: 175, decay: 0.18, noiseAmt: 0.25 },
  },
};

export const KIT_IDS = Object.keys(KITS);
