import { clamp, dist, randRange } from './utils.js';

export const RESOURCE_TYPES = {
  ICE_FRAGMENT:  { key:'ICE_FRAGMENT',  color:'150,225,255', radius:5, glowColor:'#96e1ff', valueRange:[5,10] },
  ENERGY_SHARD:  { key:'ENERGY_SHARD',  color:'190,160,255', radius:5, glowColor:'#c9a4ff', valueRange:[14,24] },
  STARDUST:      { key:'STARDUST',      color:'255,225,160', radius:3.4, glowColor:'#ffe6a0', valueRange:[1,4] },
  ANCIENT_CORE:  { key:'ANCIENT_CORE',  color:'255,150,230', radius:8, glowColor:'#ff9bdc', valueRange:[24,42] },
};

let nextId = 1;

export function createResource(type, x, y, rng){
  const def = RESOURCE_TYPES[type];
  return {
    id: nextId++,
    type,
    x, y,
    baseX: x, baseY: y,
    vx: randRange(rng, -6, 6), vy: randRange(rng, -6, 6),
    radius: def.radius,
    value: randRange(rng, def.valueRange[0], def.valueRange[1]),
    phase: randRange(rng, 0, Math.PI*2),
    bobAmp: randRange(rng, 6, 16),
    bobSpeed: randRange(rng, 0.3, 0.7),
    collected: false,
    age: 0,
    magnetized: false,
  };
}

export function updateResources(resources, comet, dt, onCollect){
  for(const r of resources){
    if(r.collected) continue;
    r.age += dt;
    const d = dist(r.x, r.y, comet.x, comet.y);
    if(d < comet.radius + r.radius){
      r.collected = true;
      onCollect(r);
      continue;
    }
    if(d < comet.collectRadius){
      r.magnetized = true;
      const pullStrength = clamp((comet.collectRadius - d) / comet.collectRadius, 0, 1);
      const dx = comet.x - r.x, dy = comet.y - r.y;
      const l = Math.hypot(dx,dy) || 1;
      r.vx += (dx/l) * pullStrength * 620 * dt;
      r.vy += (dy/l) * pullStrength * 620 * dt;
    } else {
      r.magnetized = false;
      // gentle drift bob around base position
      r.vx += Math.cos(r.age*r.bobSpeed + r.phase) * 4 * dt;
      r.vy += Math.sin(r.age*r.bobSpeed*1.3 + r.phase) * 4 * dt;
      r.vx *= 0.994; r.vy *= 0.994;
    }
    r.x += r.vx * dt;
    r.y += r.vy * dt;
  }
}
