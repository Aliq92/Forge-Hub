// Shared namespace + tunable configuration for Starfall Garden.
const SG = {};

SG.COLORS = {
  spaceBlack: '#05060f',
  spaceNavy: '#0a0e2a',
  spaceViolet: '#1a1440',
  deadCharcoal: '#2a2733',
  deadPurple: '#3a3050',
  scorched: '#4a2418',
  scorchedGlow: '#ff6a3c',
  healthyTeal: '#1fb8a8',
  healthyCyan: '#6ff0e8',
  healthySoil: '#123b3a',
  lifeViolet: '#b98cf0',
  lifeGold: '#f0c96e',
  crystal: '#8fd9ff',
  hazardOrange: '#ff8c3c',
  hazardRed: '#ff4d4d',
  hazardWhite: '#fff6e0',
  textMain: '#eef2ff',
};

SG.STATE = Object.freeze({
  TITLE: 'title',
  HOWTO: 'howto',
  SETTINGS: 'settings',
  PLAYING: 'playing',
  PAUSED: 'paused',
  UPGRADE: 'upgrade',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
});

SG.TERRAIN = Object.freeze({
  DEAD: 'dead',
  RESTORED: 'restored',
  BLOOMING: 'blooming',
  SCORCHED: 'scorched',
  CRYSTAL: 'crystal',
});

SG.PHASE = Object.freeze({
  CALM: 'calm',
  WARNING: 'warning',
  NIGHT: 'night',
  RECOVERY: 'recovery',
});

SG.CONFIG = {
  gridCellsAcross: 18,
  restoreCost: 5,
  scorchHealSeconds: 9,

  player: {
    radius: 11,
    baseSpeed: 152,
    dashSpeed: 560,
    dashDuration: 0.16,
    dashCooldown: 1.15,
    dashEnergyCost: 16,
    baseHealth: 100,
    baseEnergy: 100,
    energyRegen: 6.5,
    baseCollectRadius: 46,
    invulnAfterHit: 0.9,
    shieldEnergyCost: 30,
    shieldDuration: 4.5,
  },

  fragments: {
    types: {
      common: { value: 1, color: '#6ff0e8', radius: 5, weight: 1 },
      bright: { value: 3, color: '#f0c96e', radius: 6.5, weight: 1 },
      ancient: { value: 8, color: '#c98cf0', radius: 8, weight: 1 },
    },
    lifeSeconds: 13,
  },

  rings: [
    { id: 0, name: 'Ash Wastes', rMin: 0, rMax: 0.46, unlockHealth: 0 },
    { id: 1, name: 'Luminous Meadow', rMin: 0.46, rMax: 0.75, unlockHealth: 18 },
    { id: 2, name: 'Void Edge', rMin: 0.75, rMax: 1.0, unlockHealth: 48 },
  ],

  upgradeMilestoneStep: 15,
};

SG.PLANT_TYPES = {
  glowgrass: {
    id: 'glowgrass', name: 'Glowgrass', key: '1', icon: '⚘', cost: 4,
    growTime: 2.6, maxHealth: 30, radius: 9, auraRadius: 0,
    desc: 'Cheap patch of living light.', color: '#6ff0e8',
  },
  starflower: {
    id: 'starflower', name: 'Starflower', key: '2', icon: '❀', cost: 10,
    growTime: 3.6, maxHealth: 45, radius: 12, auraRadius: 70,
    desc: 'Slowly regenerates energy nearby.', color: '#c98cf0',
  },
  luminatree: {
    id: 'luminatree', name: 'Lumina Tree', key: '3', icon: '✵', cost: 22,
    growTime: 5.4, maxHealth: 90, radius: 16, auraRadius: 95,
    desc: 'Draws star fragments from afar.', color: '#f0c96e',
  },
  shieldbloom: {
    id: 'shieldbloom', name: 'Shield Bloom', key: '4', icon: '✡', cost: 16,
    growTime: 4.4, maxHealth: 55, radius: 12, auraRadius: 85,
    desc: 'Weakens meteor damage nearby.', color: '#7ea8ff',
  },
};

SG.clampPlanet = null; // set by world.js helper if needed
