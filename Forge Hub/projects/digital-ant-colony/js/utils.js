// Shared math helpers and tunable simulation constants.
// Loaded first (classic scripts share one global scope, so later files can
// use TAU, CONFIG, rand(), etc. without any import/export wiring).

const TAU = Math.PI * 2;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Shortest signed angular difference from a to b, in (-PI, PI].
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Rotate `angle` toward `target` by at most `maxStep` radians.
function turnToward(angle, target, maxStep) {
  const diff = angleDiff(angle, target);
  if (Math.abs(diff) <= maxStep) return angle + diff;
  return angle + Math.sign(diff) * maxStep;
}

// Weighted-random pick from a plain {key: weight} map.
function pickWeighted(weights) {
  const keys = Object.keys(weights);
  let total = 0;
  for (const k of keys) total += weights[k];
  let r = Math.random() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

// Central tuning knobs for the whole simulation. Kept in one place so the
// colony/ant/pheromone behaviour can be balanced without hunting through files.
const CONFIG = {
  pheromone: {
    cellSize: 9,          // px per grid cell
    max: 8,                // clamp per-cell trail strength (food + home)
    dangerMax: 6,           // clamp per-cell danger strength
    evaporationPerSecond: 0.985,  // food/home trail decay multiplier per simulated second
    dangerEvaporationPerSecond: 0.965, // danger fades faster than route trails
    depositAmount: 3.2,    // food-trail strength added per second while returning with food
    homeDepositAmount: 2.1, // home-trail strength added per second while searching/returning
    dangerDepositAmount: 5, // danger strength added per second while inside a hazard
    senseDistance: 22,     // how far ahead ants sample trails
    senseSpread: Math.PI / 3.4,
    minSenseValue: 0.06,   // ignore trails weaker than this (keeps wandering organic)
    homeReturnBlend: 0.32,  // 0 = pure home-pheromone following, 1 = pure beeline to nest
  },
  ant: {
    baseSpeed: 46,         // px/sec
    speedVariance: 14,
    wanderJitter: 1.1,     // rad/sec random-walk strength while searching
    returnJitter: 0.35,    // rad/sec wiggle strength while returning
    sensorRadius: 15,      // food-detection radius
    nestSteerPerSecond: 1.6, // how eagerly a returning ant turns toward the nest
    pheromoneSteerPerSecond: 2.2,
    edgeMargin: 26,
    edgeSteerPerSecond: 3.2,
    obstacleSenseDistance: 20,   // how far ahead ants probe for walls
    obstacleSteerPerSecond: 5.2, // how hard they bend away from a wall
    dangerSenseDistance: 26,     // how far ahead ants probe for danger trail
    dangerSteerPerSecond: 3.8,
    fleeSteerPerSecond: 6.5,     // turn rate while actively fleeing a hazard
    fleeDuration: 1.1,           // seconds a flee reaction lasts once triggered
    stuckCheckInterval: 1.4,     // seconds between stuck checks
    stuckDistance: 9,            // px an ant must move in that window or be "stuck"
    stuckKick: 2.6,               // rad, random heading jump applied when stuck
  },
  roles: {
    // Ratios should sum to ~1; used to assign a role at spawn time.
    scout: {
      ratio: 0.2,
      affinity: [0.05, 0.32],
      wanderMult: 1.55,
      sensorMult: 1.35,
      speedMult: 1.08,
      loadedSpeedMult: 0.85,
    },
    worker: {
      ratio: 0.55,
      affinity: [0.35, 0.75],
      wanderMult: 1,
      sensorMult: 1,
      speedMult: 1,
      loadedSpeedMult: 0.82,
    },
    carrier: {
      ratio: 0.25,
      affinity: [0.65, 1],
      wanderMult: 0.8,
      sensorMult: 0.9,
      speedMult: 0.96,
      loadedSpeedMult: 0.62,
    },
  },
  foodTypes: {
    crumbs: { label: "Crumbs", amount: [16, 30], value: 1, weight: 0.02, color: "170, 150, 120" },
    sugar: { label: "Sugar", amount: [26, 50], value: 1.4, weight: 0.08, color: "225, 232, 210" },
    fruit: { label: "Fruit", amount: [55, 95], value: 2, weight: 0.18, color: "214, 96, 96" },
    protein: { label: "Protein", amount: [40, 75], value: 2.6, weight: 0.32, color: "150, 90, 150" },
  },
  obstacle: {
    cellSize: 9,
    brush: { small: 12, medium: 22, large: 36 },
  },
  hazard: {
    cellSize: 9,
    brush: { small: 16, medium: 28, large: 44 },
    exposureLimit: 3.2,   // seconds of continuous exposure before an ant fades out
    fadeDuration: 0.8,
  },
  colony: {
    initialAnts: 50,
    maxAntsDesktop: 500,
    maxAntsMobile: 180,
    initialFood: 6,
    growthFoodPerAnt: 16,   // stored food spent to raise one new ant
    growthEnabled: true,
    nestRadius: 24,
    depositRadius: 26,      // distance to nest center counted as "arrived"
  },
  world: {
    minFoodAmount: 45,
    maxFoodAmount: 120,
    minFoodDistFromNest: 130,
    edgePadding: 40,
  },
};
