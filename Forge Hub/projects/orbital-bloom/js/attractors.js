// Orbital Bloom - attractor bodies (stars, planets, heavy cores, anchors)
import { CONSTANTS, clamp } from './config.js';

let nextId = 1;

export const attractors = [];

export const TYPE_DEFAULTS = {
  star:      { mass: 9000,  baseRadius: 20, color: 'gold',   label: 'Star' },
  planet:    { mass: 2000,  baseRadius: 11, color: 'cyan',   label: 'Planet' },
  heavyCore: { mass: 30000, baseRadius: 15, color: 'violet', label: 'Heavy Core' },
  anchor:    { mass: 6000,  baseRadius: 13, color: 'white',  label: 'Anchor', fixed: true },
};

export function massToRadius(mass, type) {
  const def = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.planet;
  const refMass = def.mass;
  const scale = Math.pow(mass / refMass, 1 / 3);
  return clamp(def.baseRadius * scale, 5, 90);
}

export function createAttractor(type, x, y, overrides = {}) {
  const def = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.planet;
  const mass = clamp(overrides.mass ?? def.mass, CONSTANTS.MIN_MASS, CONSTANTS.MAX_MASS);
  const obj = {
    id: nextId++,
    name: overrides.name || `${def.label} ${nextId - 1}`,
    type,
    x, y,
    vx: overrides.vx || 0,
    vy: overrides.vy || 0,
    mass,
    radius: massToRadius(mass, type),
    color: def.color,
    fixed: overrides.fixed !== undefined ? overrides.fixed : !!def.fixed,
    color: overrides.color || def.color,
    showTrail: overrides.showTrail !== undefined ? overrides.showTrail : true,
    trail: [],
    flash: 0,
    nearbyCount: 0,
  };
  attractors.push(obj);
  return obj;
}

export function removeAttractor(id) {
  const i = attractors.findIndex(a => a.id === id);
  if (i >= 0) attractors.splice(i, 1);
}

export function duplicateAttractor(id, offset = 30) {
  const src = getAttractor(id);
  if (!src) return null;
  const copy = createAttractor(src.type, src.x + offset, src.y + offset, {
    mass: src.mass, vx: src.vx, vy: src.vy, fixed: src.fixed,
    color: src.color, showTrail: src.showTrail, name: `${src.name} copy`,
  });
  copy.radius = src.radius;
  return copy;
}

export function getAttractor(id) {
  return attractors.find(a => a.id === id) || null;
}

export function clearAttractors() {
  attractors.length = 0;
}

export function setMass(a, mass) {
  a.mass = clamp(mass, CONSTANTS.MIN_MASS, CONSTANTS.MAX_MASS);
  a.radius = massToRadius(a.mass, a.type);
}

export function nearestAttractor(x, y, maxDist = Infinity) {
  let best = null, bestD = maxDist;
  for (const a of attractors) {
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}
