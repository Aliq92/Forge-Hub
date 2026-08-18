// Global configuration, palette and tunable constants for Lantern Vale.

export const TILE = 40;
export const WORLD_W = 110; // tiles
export const WORLD_H = 110; // tiles

export const COLORS = {
  dark: {
    deepNavy: '#070a14',
    black: '#020204',
    charcoal: '#12131c',
    coldPurple: '#221a38'
  },
  lantern: {
    amber: '#ffb457',
    gold: '#ffd98a',
    orange: '#ff8c4a'
  },
  magic: {
    cyan: '#7fe7dc',
    violet: '#b48cff',
    green: '#8be79f',
    paleBlue: '#a9c9ff'
  }
};

export const TERRAIN = {
  PATH: 'path',
  GRASS: 'grass',
  MEADOW: 'meadow',
  TALLGRASS: 'tallgrass',
  WATER: 'water',
  DEEPWATER: 'deepwater',
  MUD: 'mud',
  SHADOWGROUND: 'shadowground',
  RUINS: 'ruins',
  WALL: 'wall',
  CAVE: 'cave',
  BRIDGE: 'bridge',
  SHRINE: 'shrine_area',
  STONE: 'stone'
};

// Movement speed multipliers per terrain (mild penalties only)
export const TERRAIN_SPEED = {
  [TERRAIN.PATH]: 1.0,
  [TERRAIN.STONE]: 1.0,
  [TERRAIN.BRIDGE]: 1.0,
  [TERRAIN.GRASS]: 0.95,
  [TERRAIN.MEADOW]: 1.0,
  [TERRAIN.TALLGRASS]: 0.82,
  [TERRAIN.WATER]: 0.7,
  [TERRAIN.DEEPWATER]: 0.55,
  [TERRAIN.MUD]: 0.68,
  [TERRAIN.SHADOWGROUND]: 0.8,
  [TERRAIN.RUINS]: 0.9,
  [TERRAIN.SHRINE]: 1.0,
  [TERRAIN.CAVE]: 0.92,
  [TERRAIN.WALL]: 0
};

export const SOLID_TERRAIN = new Set([TERRAIN.WALL]);

export const LANTERN_MODES = {
  NORMAL: { name: 'Normal', radiusMul: 1.0, drainMul: 1.0, protectMul: 1.0 },
  FOCUS: { name: 'Focus', radiusMul: 0.62, drainMul: 0.78, protectMul: 1.6 },
  WIDE: { name: 'Wide Glow', radiusMul: 1.55, drainMul: 1.65, protectMul: 0.85 }
};

export const DEFAULT_SETTINGS = {
  musicVolume: 0.35,
  soundVolume: 0.6,
  screenShake: true,
  fogDensity: 0.6,
  particleDensity: 1.0,
  reducedMotion: false,
  showFPS: false,
  lanternFlicker: true
};

export const UPGRADE_POOL = [
  { id: 'wider_glow', name: 'Wider Glow', desc: 'Increase lantern radius.', apply: p => { p.lantern.baseRadius += 34; } },
  { id: 'deeper_flame', name: 'Deeper Flame', desc: 'Increase maximum lantern energy.', apply: p => { p.lantern.maxEnergy += 30; p.lantern.energy = Math.min(p.lantern.maxEnergy, p.lantern.energy + 30); } },
  { id: 'slow_burn', name: 'Slow Burn', desc: 'Reduce lantern drain rate.', apply: p => { p.lantern.drainRate *= 0.85; } },
  { id: 'firefly_call', name: 'Firefly Call', desc: 'Increase firefly collection radius.', apply: p => { p.fireflyRadius += 22; } },
  { id: 'bright_flare', name: 'Bright Flare', desc: 'Increase flare burst radius.', apply: p => { p.lantern.flareRadius += 60; } },
  { id: 'quick_spark', name: 'Quick Spark', desc: 'Reduce flare cooldown.', apply: p => { p.lantern.flareCooldownMax *= 0.8; } },
  { id: 'steady_heart', name: 'Steady Heart', desc: 'Increase maximum health.', apply: p => { p.maxHealth += 1; p.health = Math.min(p.maxHealth, p.health + 1); } },
  { id: 'moonstep', name: 'Moonstep', desc: 'Increase movement speed slightly.', apply: p => { p.speed *= 1.08; } },
  { id: 'shadow_ward', name: 'Shadow Ward', desc: 'Light repels shadows from farther away.', apply: p => { p.shadowWard += 40; } },
  { id: 'afterglow', name: 'Afterglow', desc: 'Objects stay visible briefly after leaving light.', apply: p => { p.afterglow += 1.6; } },
  { id: 'guiding_light', name: 'Guiding Light', desc: 'Hidden paths are easier to detect.', apply: p => { p.guidingLight += 1; } },
  { id: 'last_ember', name: 'Last Ember', desc: 'Emergency glow is stronger when energy is empty.', apply: p => { p.lastEmber += 14; } }
];

export const ACHIEVEMENTS = {
  first_light: { name: 'First Light', desc: 'Activate your first shrine.' },
  firefly_friend: { name: 'Firefly Friend', desc: 'Collect 100 fireflies.' },
  pathfinder: { name: 'Pathfinder', desc: 'Discover several hidden paths.' },
  no_shadow_fears: { name: 'No Shadow Fears', desc: 'Activate a shrine at critical lantern energy.' },
  keeper_of_light: { name: 'Keeper of Light', desc: 'Activate the Heart Lantern.' },
  dark_walker: { name: 'Dark Walker', desc: 'Travel far with the lantern nearly empty.' }
};

export const SHRINE_COUNT = 5; // major shrines before the Heart Lantern
