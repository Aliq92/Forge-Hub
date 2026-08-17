// ============================================================
// world.js — procedural terrain generation
// ============================================================

const TERRAIN = { WATER: 0, PLAINS: 1, FOREST: 2, MOUNTAIN: 3, DESERT: 4 };
const TERRAIN_NAMES = { 0: 'Water', 1: 'Plains', 2: 'Forest', 3: 'Mountains', 4: 'Desert' };

// Base terrain colors (political/terrain map use these as ground truth).
const TERRAIN_COLOR = {
  0: '#0d2438',
  1: '#3a5f3a',
  2: '#25462b',
  3: '#4a4640',
  4: '#6b5a3a',
};

const WORLD_SIZES = {
  small: { w: 72, h: 46 },
  medium: { w: 104, h: 66 },
  large: { w: 136, h: 86 },
};

// Land quality per terrain — used by expansion/population scoring elsewhere.
const TERRAIN_QUALITY = {
  0: 0,     // water — impassable
  1: 1.0,   // plains — best
  2: 0.7,   // forest
  3: 0.25,  // mountains — harsh
  4: 0.35,  // desert — harsh
};
const TERRAIN_EXPANSION_COST = {
  0: Infinity,
  1: 1.0,
  2: 1.3,
  3: 2.6,
  4: 2.2,
};

function generateWorld(config) {
  const { w, h } = WORLD_SIZES[config.worldSize] || WORLD_SIZES.medium;
  const rng = makeRNG(config.seed);

  const elevNoise = [
    { noise: new ValueNoise(rng, w, h, Math.max(3, w / 7)), amp: 1.0 },
    { noise: new ValueNoise(rng, w, h, Math.max(2, w / 14)), amp: 0.5 },
    { noise: new ValueNoise(rng, w, h, Math.max(2, w / 28)), amp: 0.25 },
  ];
  const moistNoise = [
    { noise: new ValueNoise(rng, w, h, Math.max(3, w / 9)), amp: 1.0 },
    { noise: new ValueNoise(rng, w, h, Math.max(2, w / 20)), amp: 0.4 },
  ];
  const resourceNoise = new ValueNoise(rng, w, h, Math.max(2, w / 16));

  const elevation = new Float32Array(w * h);
  const moisture = new Float32Array(w * h);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let e = fbm(elevNoise, x, y);
      const r = Math.sqrt(dist2(x, y, cx, cy)) / maxR;
      const falloff = smoothstep(clamp(1 - (r - 0.55) / 0.5, 0, 1));
      e = e * 0.65 + falloff * 0.5;
      elevation[i] = e;
      moisture[i] = fbm(moistNoise, x, y);
    }
  }

  // Determine sea level from desired land percentage.
  const sorted = Float32Array.from(elevation).sort();
  const landPct = clamp(config.landPercentage ?? 55, 10, 90) / 100;
  const seaIdx = clamp(Math.floor((1 - landPct) * sorted.length), 0, sorted.length - 1);
  const seaLevel = sorted[seaIdx];

  // Mountain threshold: upper quantile among land cells, tuned by mountainFrequency (0..100).
  const landElevs = [];
  for (let i = 0; i < elevation.length; i++) if (elevation[i] > seaLevel) landElevs.push(elevation[i]);
  landElevs.sort((a, b) => a - b);
  const mtnFreq = clamp(config.mountainFrequency ?? 30, 0, 100) / 100;
  const mtnIdx = clamp(Math.floor((1 - mtnFreq * 0.6) * landElevs.length), 0, Math.max(0, landElevs.length - 1));
  const mountainLevel = landElevs.length ? landElevs[mtnIdx] : 1.0;

  const terrain = new Uint8Array(w * h);
  for (let i = 0; i < terrain.length; i++) {
    if (elevation[i] <= seaLevel) { terrain[i] = TERRAIN.WATER; continue; }
    if (elevation[i] >= mountainLevel) { terrain[i] = TERRAIN.MOUNTAIN; continue; }
    const m = moisture[i];
    if (m < 0.34) terrain[i] = TERRAIN.DESERT;
    else if (m > 0.6) terrain[i] = TERRAIN.FOREST;
    else terrain[i] = TERRAIN.PLAINS;
  }

  // --- Rivers: trace steepest-descent paths from mountain sources to water. ---
  const river = new Uint8Array(w * h);
  const numRivers = Math.max(2, Math.round((w * h) / 1800));
  const mountainCells = [];
  for (let i = 0; i < terrain.length; i++) if (terrain[i] === TERRAIN.MOUNTAIN) mountainCells.push(i);
  for (let n = 0; n < numRivers && mountainCells.length; n++) {
    let idx = rngPick(rng, mountainCells);
    let x = idx % w, y = Math.floor(idx / w);
    let steps = 0;
    const visited = new Set();
    while (steps++ < w + h) {
      const i = y * w + x;
      if (visited.has(i)) break;
      visited.add(i);
      if (terrain[i] !== TERRAIN.MOUNTAIN) river[i] = 1;
      if (terrain[i] === TERRAIN.WATER) break;
      let bestI = -1, bestE = elevation[i];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (elevation[ni] < bestE) { bestE = elevation[ni]; bestI = ni; }
      }
      if (bestI < 0) break;
      x = bestI % w; y = Math.floor(bestI / w);
    }
  }

  // --- Resource-rich regions: clustered via noise, land only. ---
  const resource = new Uint8Array(w * h);
  const abundance = clamp(config.resourceAbundance ?? 30, 0, 100) / 100;
  const resThreshold = 0.72 - abundance * 0.28;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (terrain[i] === TERRAIN.WATER) continue;
      if (resourceNoise.sample(x, y) > resThreshold) resource[i] = 1;
    }
  }

  return {
    width: w, height: h,
    terrain, elevation, moisture, river, resource,
    owner: new Int16Array(w * h).fill(-1),
    settlementAt: new Int16Array(w * h).fill(-1),
    seed: config.seed,
  };
}

function inBounds(world, x, y) { return x >= 0 && y >= 0 && x < world.width && y < world.height; }
function cellIndex(world, x, y) { return y * world.width + x; }
function cellXY(world, i) { return [i % world.width, Math.floor(i / world.width)]; }

function* neighbors4(world, i) {
  const [x, y] = cellXY(world, i);
  const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx, dy] of deltas) {
    const nx = x + dx, ny = y + dy;
    if (inBounds(world, nx, ny)) yield cellIndex(world, nx, ny);
  }
}

function isLand(world, i) { return world.terrain[i] !== TERRAIN.WATER; }
