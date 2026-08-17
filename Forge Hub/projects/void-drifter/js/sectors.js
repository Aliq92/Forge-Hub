// ---------------- Sector table: difficulty & feel scale with distance from origin ----------------
const SECTORS = [
  {
    name: 'QUIET VOID', min: 0, max: 8,
    asteroidMin: 1, asteroidMax: 3, largeChance: 0.08, mediumChance: 0.28,
    resourceMin: 3, resourceMax: 6, hazards: [],
    diffMult: 1.0, fog: 0, bgTint: '8,12,22',
    desc: 'Sparse asteroids. A calm place to learn your ship.',
  },
  {
    name: 'ROCK BELT', min: 8, max: 22,
    asteroidMin: 7, asteroidMax: 12, largeChance: 0.16, mediumChance: 0.4,
    resourceMin: 3, resourceMax: 6, hazards: [{ type: 'debris', min: 0, max: 2, chance: 0.5 }],
    diffMult: 1.15, fog: 0, bgTint: '14,12,18',
    desc: 'A dense asteroid field. Watch your line.',
  },
  {
    name: 'DUST CLOUD', min: 22, max: 38,
    asteroidMin: 5, asteroidMax: 9, largeChance: 0.14, mediumChance: 0.35,
    resourceMin: 2, resourceMax: 5, hazards: [{ type: 'debris', min: 0, max: 2, chance: 0.4 }],
    diffMult: 1.3, fog: 0.5, bgTint: '20,17,26',
    desc: 'Visibility is reduced. Fly cautiously.',
  },
  {
    name: 'DEBRIS FIELD', min: 38, max: 58,
    asteroidMin: 6, asteroidMax: 10, largeChance: 0.2, mediumChance: 0.4,
    resourceMin: 5, resourceMax: 9, hazards: [{ type: 'debris', min: 1, max: 4, chance: 0.6 }, { type: 'mine', min: 0, max: 1, chance: 0.25 }],
    diffMult: 1.45, fog: 0.12, bgTint: '18,16,13',
    desc: 'Broken hulls and scattered salvage.',
  },
  {
    name: 'ION STORM', min: 58, max: 82,
    asteroidMin: 5, asteroidMax: 9, largeChance: 0.16, mediumChance: 0.4,
    resourceMin: 2, resourceMax: 5, hazards: [{ type: 'ioncloud', min: 1, max: 3, chance: 0.7 }, { type: 'mine', min: 0, max: 2, chance: 0.3 }],
    diffMult: 1.65, fog: 0.2, bgTint: '22,13,28', ionFlicker: true,
    desc: 'Electrical interference drains your systems.',
  },
  {
    name: 'GRAVITY WELL', min: 82, max: 110,
    asteroidMin: 6, asteroidMax: 10, largeChance: 0.26, mediumChance: 0.4,
    resourceMin: 2, resourceMax: 5, hazards: [{ type: 'debris', min: 0, max: 2, chance: 0.4 }],
    diffMult: 1.85, fog: 0, bgTint: '10,14,22', gravityWells: true,
    desc: 'A massive body bends everything nearby.',
  },
  {
    name: 'DEEP VOID', min: 110, max: Infinity,
    asteroidMin: 3, asteroidMax: 7, largeChance: 0.3, mediumChance: 0.38,
    resourceMin: 1, resourceMax: 3, hazards: [{ type: 'solar', min: 0, max: 2, chance: 0.4 }, { type: 'mine', min: 0, max: 2, chance: 0.3 }],
    diffMult: 2.1, fog: 0.08, bgTint: '5,7,13',
    desc: 'Resources are scarce out here. Ration everything.',
  },
];

function getSectorInfo(km) {
  let base = SECTORS[0];
  for (const s of SECTORS) { if (km >= s.min && km < s.max) { base = s; break; } base = s; }
  let diffMult = base.diffMult;
  if (km > 110) {
    const extra = km - 110;
    diffMult = base.diffMult * (1 + Math.min(1.4, extra / 240));
  }
  return { ...base, diffMult, km };
}

function sectorIndexOf(name) { return SECTORS.findIndex((s) => s.name === name); }
