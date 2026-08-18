import { makeRng, randRange, randInt, TAU, pick, normalize, dist } from './utils.js';
import { CONFIG, PLANET_TYPES, STAR_CONFIG } from './config.js';
import { createResource } from './resources.js';
import { createAsteroidBelt, FlareController } from './hazards.js';

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function generateSystem(systemNumber, seed){
  const rng = makeRng(seed);
  const difficulty = systemNumber;

  const star = {
    x: 0, y: 0,
    mass: randRange(rng, STAR_CONFIG.massRange[0], STAR_CONFIG.massRange[1]) * (1 + (difficulty - 1) * 0.03),
    radius: randRange(rng, STAR_CONFIG.radiusRange[0], STAR_CONFIG.radiusRange[1]),
    colors: pick(rng, STAR_CONFIG.colorSets),
  };
  star.heatRadius = star.radius * STAR_CONFIG.heatRadiusMult;
  star.dangerRadius = star.radius * STAR_CONFIG.dangerRadiusMult;

  const planetCount = clampInt(4 + Math.floor(difficulty / 2) + randInt(rng, 0, 1), 4, 9);
  const planets = [];
  let orbitRadius = randRange(rng, 480, 620);
  const typeKeys = Object.keys(PLANET_TYPES);
  for(let i = 0; i < planetCount; i++){
    const typeKey = pick(rng, typeKeys);
    const type = PLANET_TYPES[typeKey];
    const radius = randRange(rng, type.radiusRange[0], type.radiusRange[1]);
    const mass = randRange(rng, type.massRange[0], type.massRange[1]);
    const angle0 = randRange(rng, 0, TAU);
    const orbitSpeed = (0.10 / Math.sqrt(orbitRadius / 500)) * (rng() < 0.5 ? 1 : -1) * randRange(rng, 0.85, 1.15);
    const color = pick(rng, type.colors);
    const planet = {
      id: `p${i}`, typeKey, radius, mass, orbitRadius, angle0, angle: angle0, orbitSpeed,
      color, rim: type.rim,
      x: star.x + Math.cos(angle0) * orbitRadius, y: star.y + Math.sin(angle0) * orbitRadius,
      hasRing: typeKey === 'RINGED' || (typeKey === 'GAS' && rng() < 0.3),
      moons: [],
    };
    if(typeKey === 'GAS' && rng() < 0.55){
      const moonAngle0 = randRange(rng, 0, TAU);
      const moonOrbitRadius = radius + randRange(rng, 26, 44);
      planet.moons.push({
        orbitRadius: moonOrbitRadius,
        angle: moonAngle0,
        orbitSpeed: randRange(rng, 1.4, 2.4) * (rng() < 0.5 ? 1 : -1),
        radius: randRange(rng, 4, 8),
        x: planet.x + Math.cos(moonAngle0) * moonOrbitRadius,
        y: planet.y + Math.sin(moonAngle0) * moonOrbitRadius,
      });
    }
    planets.push(planet);
    orbitRadius += randRange(rng, 260, 400) + planet.radius * 2 + difficulty * 6;
  }

  // Asteroid belts fill wide gaps between consecutive planet orbits, each with a guaranteed clear channel.
  const belts = [];
  const beltCount = clampInt(1 + Math.floor(difficulty / 3), 1, 3);
  const gapCandidates = [];
  for(let i = 0; i < planets.length - 1; i++){
    const a = planets[i].orbitRadius, b = planets[i + 1].orbitRadius;
    if(b - a > 220) gapCandidates.push((a + b) / 2);
  }
  for(let i = 0; i < beltCount && gapCandidates.length; i++){
    const idx = randInt(rng, 0, gapCandidates.length - 1);
    const r = gapCandidates.splice(idx, 1)[0];
    const count = clampInt(14 + difficulty * 3, 14, 46);
    belts.push(createAsteroidBelt(r, 100, count, rng, star.mass));
  }

  const outerR = planets.length ? planets[planets.length - 1].orbitRadius : 900;
  const gateRadius = outerR + randRange(rng, 420, 620);
  const gateAngle = randRange(rng, 0, TAU);
  const gate = {
    x: Math.cos(gateAngle) * gateRadius, y: Math.sin(gateAngle) * gateRadius,
    radius: 46, angle: gateAngle, activated: false,
  };

  const resources = [];
  scatterResources(resources, rng, star, planets, gateRadius, difficulty);

  const flare = new FlareController(rng, difficulty);

  const bounds = { radius: gateRadius + 500 };

  const spawnAngle = randRange(rng, 0, TAU);
  const spawnR = outerR + randRange(rng, 160, 260);
  const spawn = { x: Math.cos(spawnAngle) * spawnR, y: Math.sin(spawnAngle) * spawnR };
  const inward = normalize(-spawn.x, -spawn.y);
  const tangent = { x: -inward.y, y: inward.x };
  const speed0 = randRange(rng, 70, 95);
  const tangentDir = rng() < 0.5 ? 1 : -1;
  const vel = {
    x: inward.x * speed0 * 0.45 + tangent.x * speed0 * tangentDir,
    y: inward.y * speed0 * 0.45 + tangent.y * speed0 * tangentDir,
  };

  return { seed, systemNumber, star, planets, belts, gate, resources, flare, bounds, spawn, vel };
}

function scatterResources(resources, rng, star, planets, gateRadius, difficulty){
  const density = Math.max(0.55, 1 - difficulty * 0.035);
  const laneCount = Math.round((10 + planets.length * 2) * density);
  const outerBound = gateRadius * 0.9;

  for(let i = 0; i < laneCount; i++){
    const r = randRange(rng, 350, outerBound);
    const angle = randRange(rng, 0, TAU);
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if(dist(x, y, star.x, star.y) < star.dangerRadius * 1.3) continue;
    const roll = rng();
    let type = 'STARDUST';
    if(roll < 0.16) type = 'ICE_FRAGMENT';
    else if(roll < 0.30) type = 'ENERGY_SHARD';
    else if(roll < 0.335) type = 'ANCIENT_CORE';
    resources.push(createResource(type, x, y, rng));
  }

  const fieldCount = clampInt(2 + Math.floor(planets.length / 3), 2, 5);
  for(let f = 0; f < fieldCount; f++){
    let cx, cy;
    if(f % 2 === 0 && planets.length){
      const p = planets[randInt(rng, 0, planets.length - 1)];
      const a = p.angle0 + randRange(rng, -0.6, 0.6);
      const r = p.orbitRadius + randRange(rng, p.radius * 3, p.radius * 5.5);
      cx = Math.cos(a) * r; cy = Math.sin(a) * r;
    } else {
      const a = randRange(rng, 0, TAU);
      const r = randRange(rng, 500, outerBound);
      cx = Math.cos(a) * r; cy = Math.sin(a) * r;
    }
    const n = randInt(rng, 6, 11);
    for(let i = 0; i < n; i++){
      const a2 = randRange(rng, 0, TAU), r2 = randRange(rng, 0, 70);
      resources.push(createResource('ICE_FRAGMENT', cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2, rng));
    }
  }
}

export function updateOrbits(system, dt){
  for(const p of system.planets){
    p.angle += p.orbitSpeed * dt;
    p.x = system.star.x + Math.cos(p.angle) * p.orbitRadius;
    p.y = system.star.y + Math.sin(p.angle) * p.orbitRadius;
    for(const m of p.moons){
      m.angle += m.orbitSpeed * dt;
      m.x = p.x + Math.cos(m.angle) * m.orbitRadius;
      m.y = p.y + Math.sin(m.angle) * m.orbitRadius;
    }
  }
}

export function gravityBodies(system){
  const bodies = [system.star];
  for(const p of system.planets) bodies.push(p);
  return bodies;
}
