import { totalGravity } from './physics.js';
import { gravityBodies } from './systemGenerator.js';
import { dist } from './utils.js';
import { CONFIG } from './config.js';

// Simulates a simplified forward path for the trajectory preview.
// Uses current planet positions (not their future orbital motion) — accurate enough
// for short-to-medium horizon slingshot judgement without heavy recomputation.
export function computeTrajectory(comet, system, pendingImpulse, qualityMult=1){
  const gsFactor = 1 + comet.gravitySenseLevel * 0.18;
  const steps = Math.round((CONFIG.PREVIEW_BASE_STEPS + comet.previewLevel * CONFIG.PREVIEW_STEPS_PER_LEVEL) * gsFactor * qualityMult);
  const dt = CONFIG.PREVIEW_STEP_DT / gsFactor;
  const bodies = gravityBodies(system);
  let x = comet.x, y = comet.y;
  let vx = comet.vx + (pendingImpulse ? pendingImpulse.x : 0);
  let vy = comet.vy + (pendingImpulse ? pendingImpulse.y : 0);
  const pts = [{ x, y, danger: false }];
  let collided = null;

  for(let i = 0; i < steps; i++){
    const g = totalGravity(bodies, x, y);
    vx += g.ax * dt; vy += g.ay * dt;
    x += vx * dt; y += vy * dt;

    if(!Number.isFinite(x) || !Number.isFinite(y)) break;

    let danger = false;
    if(dist(x, y, system.star.x, system.star.y) < system.star.dangerRadius) danger = true;
    if(!danger){
      for(const b of bodies){
        if(b === system.star) continue;
        if(dist(x, y, b.x, b.y) < b.radius * 2.1){ danger = true; break; }
      }
    }

    pts.push({ x, y, danger });

    if(dist(x, y, system.star.x, system.star.y) < system.star.radius){ collided = 'star'; break; }
    let hitPlanet = false;
    for(const p of bodies){
      if(p === system.star) continue;
      if(dist(x, y, p.x, p.y) < p.radius + 3){ hitPlanet = true; break; }
    }
    if(hitPlanet){ collided = 'planet'; break; }
    if(dist(x, y, system.star.x, system.star.y) > system.bounds.radius * 1.4) break;
  }

  pts.collided = collided;
  return pts;
}
