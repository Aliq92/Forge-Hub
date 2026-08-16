(function (WF) {
  'use strict';

  const { GRID_W, GRID_H, TERRAIN, TERRAIN_INFO, MANMADE, mulberry32, fractalNoiseField } = WF;

  function idx(x, y) { return y * GRID_W + x; }

  function majorityBoolSmooth(mask, w, h, iterations) {
    let cur = mask;
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(cur.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let count = 0, total = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              total++;
              if (cur[ny * w + nx]) count++;
            }
          }
          next[y * w + x] = count / total >= 0.5 ? 1 : 0;
        }
      }
      cur = next;
    }
    return cur;
  }

  function majorityVegSmooth(veg, water, rock, w, h, iterations) {
    let cur = veg;
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(cur.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (water[i] || rock[i]) { next[i] = cur[i]; continue; }
          const counts = new Map();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const ni = ny * w + nx;
              if (water[ni] || rock[ni]) continue;
              counts.set(cur[ni], (counts.get(cur[ni]) || 0) + 1);
            }
          }
          let best = cur[i], bestCount = -1;
          for (const [type, c] of counts) {
            if (c > bestCount) { bestCount = c; best = type; }
          }
          next[i] = best;
        }
      }
      cur = next;
    }
    return cur;
  }

  function generateTerrain(seed) {
    const w = GRID_W, h = GRID_H;
    const rng = mulberry32(seed);

    const elevation = fractalNoiseField(rng, w, h, [
      { freq: 4, weight: 0.5 },
      { freq: 8, weight: 0.3 },
      { freq: 16, weight: 0.2 },
    ]);

    const waterNoise = fractalNoiseField(rng, w, h, [
      { freq: 5, weight: 0.6 },
      { freq: 10, weight: 0.4 },
    ]);

    const vegNoise = fractalNoiseField(rng, w, h, [
      { freq: 6, weight: 0.45 },
      { freq: 12, weight: 0.35 },
      { freq: 24, weight: 0.2 },
    ]);

    // Water bodies: low waterNoise AND low-ish elevation (avoid lakes on peaks)
    let waterMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      waterMask[i] = (waterNoise[i] < 0.20 && elevation[i] < 0.55) ? 1 : 0;
    }
    waterMask = majorityBoolSmooth(waterMask, w, h, 2);

    // Rock: high elevation, not water
    let rockMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      rockMask[i] = (!waterMask[i] && elevation[i] > 0.76) ? 1 : 0;
    }
    rockMask = majorityBoolSmooth(rockMask, w, h, 1);
    for (let i = 0; i < w * h; i++) if (waterMask[i]) rockMask[i] = 0;

    // Vegetation classes for remaining cells
    let veg = new Uint8Array(w * h); // TERRAIN enum values
    for (let i = 0; i < w * h; i++) {
      if (waterMask[i] || rockMask[i]) { veg[i] = TERRAIN.BARE; continue; }
      const v = vegNoise[i];
      if (v > 0.60) veg[i] = TERRAIN.FOREST;
      else if (v > 0.40) veg[i] = TERRAIN.SCRUB;
      else if (v > 0.16) veg[i] = TERRAIN.GRASS;
      else veg[i] = TERRAIN.BARE;
    }
    veg = majorityVegSmooth(veg, waterMask, rockMask, w, h, 2);

    const terrain = new Uint8Array(w * h);
    const fuel = new Float32Array(w * h);
    const maxFuel = new Float32Array(w * h);
    const baseMoisture = new Float32Array(w * h);
    const manmade = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      let type;
      if (waterMask[i]) type = TERRAIN.WATER;
      else if (rockMask[i]) type = TERRAIN.ROCK;
      else type = veg[i];

      terrain[i] = type;
      const info = TERRAIN_INFO[type];
      baseMoisture[i] = info.moisture * (0.85 + rng() * 0.3);
      if (info.burnable) {
        const variance = 0.82 + rng() * 0.36;
        maxFuel[i] = info.baseFuel * variance;
        fuel[i] = maxFuel[i];
      } else {
        maxFuel[i] = 0;
        fuel[i] = 0;
      }
      manmade[i] = MANMADE.NONE;
    }

    let burnableTotal = 0;
    let totalMaxFuel = 0;
    for (let i = 0; i < w * h; i++) {
      if (TERRAIN_INFO[terrain[i]].burnable) { burnableTotal++; totalMaxFuel += maxFuel[i]; }
    }

    return {
      w, h, seed,
      elevation, terrain, fuel, maxFuel, baseMoisture, manmade,
      burnableTotal, totalMaxFuel,
    };
  }

  Object.assign(WF, { generateTerrain, gridIdx: idx });
})(window.WF = window.WF || {});
