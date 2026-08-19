// Orbital Bloom - simplified, stabilized Newtonian gravity
import { CONSTANTS, state, stats } from './config.js';
import * as P from './particles.js';
import { attractors, massToRadius, removeAttractor } from './attractors.js';

const SOFT2 = CONSTANTS.SOFTENING * CONSTANTS.SOFTENING;

// Sum acceleration on a point from all attractors. Returns [ax, ay, localG]
export function accelAt(x, y, g, skipId = -1) {
  let ax = 0, ay = 0, localG = 0;
  for (let i = 0; i < attractors.length; i++) {
    const a = attractors[i];
    if (a.id === skipId) continue;
    const dx = a.x - x, dy = a.y - y;
    const distSq = dx * dx + dy * dy + SOFT2;
    const invDist = 1 / Math.sqrt(distSq);
    const invDist3 = invDist * invDist * invDist;
    const f = g * a.mass * invDist3;
    ax += dx * f; ay += dy * f;
    const gAtPoint = g * a.mass * invDist * invDist;
    if (gAtPoint > localG) localG = gAtPoint;
  }
  return [ax, ay, localG];
}

export function stepAttractors(dt, g) {
  const n = attractors.length;
  if (n === 0) return;
  const fx = new Float64Array(n), fy = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const a = attractors[i];
    if (a.fixed) continue;
    let ax = 0, ay = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = attractors[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distSq = dx * dx + dy * dy + SOFT2 * 4;
      const invDist = 1 / Math.sqrt(distSq);
      const invDist3 = invDist * invDist * invDist;
      const f = g * b.mass * invDist3;
      ax += dx * f; ay += dy * f;
    }
    fx[i] = ax; fy[i] = ay;
  }

  for (let i = 0; i < n; i++) {
    const a = attractors[i];
    if (a.fixed) continue;
    a.vx += fx[i] * dt;
    a.vy += fy[i] * dt;
    const speed = Math.hypot(a.vx, a.vy);
    if (speed > CONSTANTS.MAX_ATTRACTOR_SPEED) {
      const s = CONSTANTS.MAX_ATTRACTOR_SPEED / speed;
      a.vx *= s; a.vy *= s;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    if (!state.reducedMotion) {
      a.trail.push(a.x, a.y);
      if (a.trail.length > 120) a.trail.splice(0, a.trail.length - 120);
    }
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt * 2.2);
  }
}

export function handleAttractorCollisions(callbacks = {}) {
  const mode = state.collisionMode || 'merge';
  if (mode === 'ignore') return;
  const { onMerge, onBounce, onDestroy } = callbacks;

  for (let i = attractors.length - 1; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      const a = attractors[i], b = attractors[j];
      if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < (a.radius + b.radius) * 0.72) {
        if (mode === 'bounce') bounceAttractors(a, b, dist, dx, dy, onBounce);
        else if (mode === 'destroy') destroyAttractors(a, b, onDestroy);
        else mergeAttractors(a, b, onMerge);
        break;
      }
    }
  }
}

function mergeAttractors(a, b, onMerge) {
  const totalMass = a.mass + b.mass;
  const nx = (a.x * a.mass + b.x * b.mass) / totalMass;
  const ny = (a.y * a.mass + b.y * b.mass) / totalMass;
  const nvx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
  const nvy = (a.vy * a.mass + b.vy * b.mass) / totalMass;

  const keepFixed = a.fixed || b.fixed;
  const survivor = a.mass >= b.mass ? a : b;
  const other = survivor === a ? b : a;

  survivor.mass = Math.min(totalMass, CONSTANTS.MAX_MASS);
  survivor.radius = massToRadius(survivor.mass, survivor.type);
  survivor.x = nx; survivor.y = ny;
  survivor.vx = keepFixed ? 0 : nvx;
  survivor.vy = keepFixed ? 0 : nvy;
  survivor.fixed = keepFixed;
  survivor.flash = 1;

  const idx = attractors.indexOf(other);
  if (idx >= 0) attractors.splice(idx, 1);

  if (onMerge) onMerge(survivor, nx, ny);
}

function bounceAttractors(a, b, dist, dx, dy, onBounce) {
  const d = Math.max(dist, 0.001);
  const nx = dx / d, ny = dy / d;
  const overlap = (a.radius + b.radius) * 0.72 - d;

  if (!a.fixed && !b.fixed) {
    a.x += nx * overlap * 0.5; a.y += ny * overlap * 0.5;
    b.x -= nx * overlap * 0.5; b.y -= ny * overlap * 0.5;
  } else if (!a.fixed) { a.x += nx * overlap; a.y += ny * overlap; }
  else if (!b.fixed) { b.x -= nx * overlap; b.y -= ny * overlap; }

  const rvx = a.vx - b.vx, rvy = a.vy - b.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal < 0) {
    const restitution = 0.72;
    const invMassA = a.fixed ? 0 : 1 / a.mass, invMassB = b.fixed ? 0 : 1 / b.mass;
    const invSum = invMassA + invMassB;
    if (invSum > 0) {
      const j = -(1 + restitution) * velAlongNormal / invSum;
      a.vx += j * invMassA * nx; a.vy += j * invMassA * ny;
      b.vx -= j * invMassB * nx; b.vy -= j * invMassB * ny;
    }
  }
  a.flash = Math.max(a.flash, 0.6);
  b.flash = Math.max(b.flash, 0.6);
  if (onBounce) onBounce(a, b, (a.x + b.x) / 2, (a.y + b.y) / 2);
}

function destroyAttractors(a, b, onDestroy) {
  const survivor = a.mass >= b.mass ? a : b;
  const doomed = survivor === a ? b : a;
  survivor.flash = 1;
  const idx = attractors.indexOf(doomed);
  if (idx >= 0) attractors.splice(idx, 1);
  if (onDestroy) onDestroy(survivor, doomed.x, doomed.y, doomed.color);
}

let slingshotCooldown = 0;

export function stepParticles(dt, g, onSlingshot) {
  const n = attractors.length;
  const absorb = state.absorbMode === 'absorb';
  slingshotCooldown = Math.max(0, slingshotCooldown - dt);
  const slingshotThreshold = CONSTANTS.MAX_PARTICLE_SPEED * 0.62;

  for (let i = P.count - 1; i >= 0; i--) {
    P.pPrevX[i] = P.px[i];
    P.pPrevY[i] = P.py[i];

    let ax = 0, ay = 0, localG = 0;
    let absorbed = false;
    let strongCount = 0;
    let maxForce = 0, secondForce = 0;
    let dominantDist = Infinity, dominantMass = 0, dominantDx = 0, dominantDy = 0;

    for (let k = 0; k < n; k++) {
      const a = attractors[k];
      const dx = a.x - P.px[i], dy = a.y - P.py[i];
      const trueDistSq = dx * dx + dy * dy;
      const distSq = trueDistSq + SOFT2;
      const dist = Math.sqrt(distSq);

      if (trueDistSq < (a.radius * 0.85) * (a.radius * 0.85)) {
        if (absorb) { absorbed = true; break; }
      }

      const invDist = 1 / dist;
      const invDist3 = invDist * invDist * invDist;
      const f = g * a.mass * invDist3;
      ax += dx * f; ay += dy * f;

      const gAtPoint = g * a.mass * invDist * invDist;
      if (gAtPoint > localG) localG = gAtPoint;

      if (gAtPoint > maxForce) {
        secondForce = maxForce; maxForce = gAtPoint;
        dominantDist = dist; dominantMass = a.mass;
        dominantDx = dx; dominantDy = dy;
      } else if (gAtPoint > secondForce) secondForce = gAtPoint;
      if (gAtPoint > 0.02) strongCount++;
    }

    if (absorbed) {
      P.removeAt(i);
      stats.absorbedCount++;
      continue;
    }

    P.pvx[i] += ax * dt;
    P.pvy[i] += ay * dt;

    const speed = Math.hypot(P.pvx[i], P.pvy[i]);
    if (speed > CONSTANTS.MAX_PARTICLE_SPEED) {
      const s = CONSTANTS.MAX_PARTICLE_SPEED / speed;
      P.pvx[i] *= s; P.pvy[i] *= s;
    }

    P.px[i] += P.pvx[i] * dt;
    P.py[i] += P.pvy[i] * dt;

    if (!isFinite(P.px[i]) || !isFinite(P.py[i])) {
      P.removeAt(i);
      continue;
    }

    P.page[i] += dt;
    const finalSpeed = Math.hypot(P.pvx[i], P.pvy[i]);
    P.pspeed[i] = finalSpeed;
    P.pgrav[i] = localG;

    if (P.plife[i] >= 0 && P.page[i] > P.plife[i]) {
      P.removeAt(i);
      continue;
    }

    if (dominantMass > 0) {
      const safeDist = Math.max(dominantDist, CONSTANTS.SOFTENING);
      P.pdist[i] = safeDist;
      P.penergy[i] = 0.5 * finalSpeed * finalSpeed - (g * dominantMass) / safeDist;

      const vEsc = Math.sqrt(2 * g * dominantMass / safeDist);
      const radialVel = (P.pvx[i] * dominantDx + P.pvy[i] * dominantDy) / safeDist;

      if (secondForce > maxForce * 0.35 && strongCount >= 2) P.pclass[i] = 3; // chaotic
      else if (finalSpeed > vEsc * 1.05) P.pclass[i] = 2; // escaping
      else if (radialVel > finalSpeed * 0.55 && finalSpeed > 8) P.pclass[i] = 1; // falling
      else P.pclass[i] = 0; // bound

      if (onSlingshot && slingshotCooldown <= 0 && finalSpeed > slingshotThreshold && localG > 0.4) {
        onSlingshot(P.px[i], P.py[i]);
        slingshotCooldown = 2.5;
      }
    } else {
      P.pdist[i] = Infinity;
      P.penergy[i] = 0.5 * finalSpeed * finalSpeed;
      P.pclass[i] = 2;
    }
  }
}

export function nearbyParticleCount(a, radius) {
  let c = 0;
  const r2 = radius * radius;
  for (let i = 0; i < P.count; i++) {
    const dx = P.px[i] - a.x, dy = P.py[i] - a.y;
    if (dx * dx + dy * dy <= r2) c++;
  }
  return c;
}
