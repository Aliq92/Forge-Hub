import { CONFIG } from './config.js';
import { clamp } from './utils.js';

// Returns {ax, ay} acceleration on a point at (x,y) from a single massive body.
export function gravityFrom(body, x, y){
  const dx = body.x - x, dy = body.y - y;
  const r2 = dx*dx + dy*dy;
  const soften = CONFIG.MIN_SOFTEN + body.radius * 0.28;
  const denom = r2 + soften*soften;
  let a = (CONFIG.G * body.mass) / denom;
  a = clamp(a, 0, CONFIG.MAX_ACCEL);
  const r = Math.sqrt(r2) || 1;
  return { ax: (dx / r) * a, ay: (dy / r) * a, r };
}

// Sums gravity from all major bodies (star + planets, optionally moons) at a point.
export function totalGravity(bodies, x, y){
  let ax = 0, ay = 0;
  for(const b of bodies){
    const g = gravityFrom(b, x, y);
    ax += g.ax; ay += g.ay;
  }
  if(!Number.isFinite(ax) || !Number.isFinite(ay)) return { ax: 0, ay: 0 };
  return { ax, ay };
}

// Advances a position/velocity pair by dt seconds using semi-implicit Euler.
export function integrate(state, ax, ay, dt){
  state.vx += ax * dt;
  state.vy += ay * dt;
  state.x += state.vx * dt;
  state.y += state.vy * dt;
}

export function speed(vx, vy){ return Math.hypot(vx, vy); }
