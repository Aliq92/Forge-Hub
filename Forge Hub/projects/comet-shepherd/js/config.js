// Central tunables. Keep gameplay-relevant numbers here so balance passes stay easy.

export const CONFIG = {
  G: 5400,                    // gravitational scale constant (abstract units, tuned so close passes bend visibly)
  MIN_SOFTEN: 18,             // softening radius added to r^2 to avoid singularities
  MAX_ACCEL: 3400,            // hard clamp on acceleration from any single body (px/s^2)
  PHYSICS_DT: 1/120,          // fixed physics substep
  MAX_SUBSTEPS: 8,

  COMET_START_RADIUS: 9,
  COMET_START_ICE: 100,
  COMET_START_ENERGY: 100,
  COMET_START_COLLECT_RADIUS: 58,
  COMET_MASS: 1,

  CORRECTION_MAX_IMPULSE: 210,   // px/s delta-v at full drag
  CORRECTION_MIN_DRAG: 10,       // px of drag before a correction registers
  CORRECTION_MAX_DRAG: 160,      // px of drag for full-power correction
  CORRECTION_ENERGY_PER_IMPULSE: 42, // energy cost at full power, scales down with drag amount
  CORRECTION_COOLDOWN: 0.12,

  NUDGE_IMPULSE: 34,          // px/s delta-v for arrow/AD taps
  NUDGE_ENERGY_COST: 6,
  NUDGE_COOLDOWN: 0.16,

  EMERGENCY_IMPULSE: 430,
  EMERGENCY_ENERGY_COST: 62,
  EMERGENCY_COOLDOWN: 6.5,

  ENERGY_REGEN_PER_SEC: 3.2,

  HEAT_COLD_MAX: 25,
  HEAT_WARM_MAX: 50,
  HEAT_HOT_MAX: 80,
  HEAT_COOL_RATE: 9,           // per second baseline cooling in deep space
  HEAT_ICE_LOSS_THRESHOLD: 45,
  HEAT_ICE_LOSS_RATE: 3.4,     // ice/sec at heat=100 above threshold, scales linearly

  ICE_REGEN_RATE: 1.4,         // per second when heat is low & upgrade purchased (base 0 without upgrade)

  PREVIEW_BASE_STEPS: 130,
  PREVIEW_STEP_DT: 1/22,
  PREVIEW_STEPS_PER_LEVEL: 45,

  ASSIST_MIN_SPEED_DELTA_PCT: 0.055,
  ASSIST_INFLUENCE_MULT: 6.2,   // multiple of planet radius that counts as "close pass" zone

  CAMERA_LERP: 4.2,
  CAMERA_LOOKAHEAD: 90,
  ZOOM_MIN: 0.55,
  ZOOM_MAX: 1.15,

  STARFIELD_LAYERS: [
    { parallax: 0.05, density: 0.00022, size: [0.6, 1.4], alpha: 0.5 },
    { parallax: 0.14, density: 0.00016, size: [0.8, 1.8], alpha: 0.75 },
    { parallax: 0.30, density: 0.00009, size: [1.0, 2.4], alpha: 1.0 },
  ],

  MILESTONE_SYSTEM: 10,

  STORAGE_BEST: 'cometShepherd.bestRun.v1',
  STORAGE_SETTINGS: 'cometShepherd.settings.v1',
};

export const STAR_CONFIG = {
  massRange: [820, 1250],
  radiusRange: [85, 120],
  heatRadiusMult: 9.5,
  dangerRadiusMult: 3.4,
  colorSets: [
    { core:'#fff6d8', mid:'#ffd27a', outer:'#ff9d4d' },
    { core:'#ffffff', mid:'#bfe0ff', outer:'#7fa8ff' },
    { core:'#ffe9e0', mid:'#ff9d7a', outer:'#ff5a4e' },
  ],
};

export const PLANET_TYPES = {
  ROCKY:   { key:'ROCKY',   massRange:[22, 42],   radiusRange:[16, 27], colors:['#c98a5b','#a8734a','#8a5a3c'], rim:'#ffcf9e', gravity:'moderate' },
  GAS:     { key:'GAS',     massRange:[150, 260],  radiusRange:[42, 64], colors:['#e0a35c','#d68a6b','#f0c98a'], rim:'#ffe6b0', gravity:'very high' },
  ICE:     { key:'ICE',     massRange:[30, 55],   radiusRange:[19, 30], colors:['#8fd6ff','#bfeeff','#6fb8e6'], rim:'#eaffff', gravity:'moderate' },
  BARREN:  { key:'BARREN',  massRange:[10, 22],   radiusRange:[13, 22], colors:['#8a8a90','#6d6d74','#a3a3aa'], rim:'#d6d6dc', gravity:'low' },
  RINGED:  { key:'RINGED',  massRange:[95, 175],  radiusRange:[30, 46], colors:['#e8d3a0','#c9b58a','#f2e6c0'], rim:'#fff2cf', gravity:'high' },
};

export const UPGRADE_IDS = [
  'LONGER_VISION','FROZEN_CORE','DEEP_RESERVOIR','GENTLE_TOUCH','GRAVITY_SENSE',
  'MAGNETIC_TAIL','HEAT_SHIELD','ICE_REGENERATION','EMERGENCY_BURST','SLINGSHOT_MASTERY','STAR_HARVEST'
];
