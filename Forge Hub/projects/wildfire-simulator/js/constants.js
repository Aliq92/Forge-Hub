// Grid + timing constants
(function (WF) {
  'use strict';

  const GRID_W = 120;
  const GRID_H = 76;
  const CELL_PX = 8;

  const SIM_HZ = 24;           // fixed simulation steps per second (at 1x speed)
  const SIM_STEP = 1 / SIM_HZ;
  const MAX_STEPS_PER_FRAME = 10;

  const AREA_PER_CELL_HA = 0.22; // notional hectares per cell, for flavor stats

  // Terrain enum
  const TERRAIN = {
    WATER: 0,
    ROCK: 1,
    BARE: 2,
    GRASS: 3,
    SCRUB: 4,
    FOREST: 5,
  };

  const TERRAIN_INFO = {
    [TERRAIN.WATER]:  { name: 'Water',      burnable: false, color: [42, 98, 140],  moisture: 1.0 },
    [TERRAIN.ROCK]:   { name: 'Rock',       burnable: false, color: [96, 92, 88],   moisture: 0.1 },
    [TERRAIN.BARE]:   { name: 'Bare Ground',burnable: false, color: [124, 106, 78], moisture: 0.15 },
    [TERRAIN.GRASS]:  { name: 'Grassland',  burnable: true,  color: [178, 186, 84], moisture: 0.22,
                         flammability: 0.95, baseFuel: 34, burnDuration: 3.2, smolderDuration: 2.0,
                         intensityPeak: 0.62, igniteDuration: 0.35 },
    [TERRAIN.SCRUB]:  { name: 'Scrub',      burnable: true,  color: [132, 142, 70], moisture: 0.30,
                         flammability: 0.68, baseFuel: 58, burnDuration: 7.5, smolderDuration: 3.5,
                         intensityPeak: 0.82, igniteDuration: 0.5 },
    [TERRAIN.FOREST]: { name: 'Forest',     burnable: true,  color: [32, 90, 56],  moisture: 0.38,
                         flammability: 0.48, baseFuel: 105, burnDuration: 15.0, smolderDuration: 6.0,
                         intensityPeak: 1.0, igniteDuration: 0.8 },
  };

  const FIRE_STATE = {
    UNBURNED: 0,
    IGNITING: 1,
    BURNING: 2,
    SMOLDERING: 3,
    BURNED: 4,
  };

  const MANMADE = {
    NONE: 0,
    FIREBREAK: 1,
    CONTAINMENT: 2,
  };

  const TOOLS = ['ignite', 'firebreak', 'water', 'clear', 'containment'];

  const PRESETS = {
    calm:      { dryness: 30, moisture: 55, windStrength: 15, temperature: 45, label: 'Calm Day' },
    hotdry:    { dryness: 75, moisture: 20, windStrength: 35, temperature: 75, label: 'Hot & Dry' },
    windstorm: { dryness: 55, moisture: 30, windStrength: 85, temperature: 55, label: 'Windstorm' },
    drought:   { dryness: 92, moisture: 8,  windStrength: 25, temperature: 80, label: 'Drought' },
  };

  const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  function dirToCompass(angleRad) {
    // angleRad: 0 = North, clockwise positive
    const deg = ((angleRad * 180 / Math.PI) % 360 + 360) % 360;
    const idx = Math.round(deg / 45) % 8;
    return COMPASS_DIRS[idx];
  }

  Object.assign(WF, {
    GRID_W, GRID_H, CELL_PX,
    SIM_HZ, SIM_STEP, MAX_STEPS_PER_FRAME,
    AREA_PER_CELL_HA,
    TERRAIN, TERRAIN_INFO, FIRE_STATE, MANMADE,
    TOOLS, PRESETS, COMPASS_DIRS, dirToCompass,
  });
})(window.WF = window.WF || {});
