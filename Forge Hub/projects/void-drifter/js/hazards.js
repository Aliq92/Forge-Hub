// ---------------- Hazards: mines, ion clouds, debris, solar fragments ----------------
class Mine {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.type = 'mine';
    this.radius = 11;
    this.triggerRadius = 70;
    this.vx = randRange(rng, -8, 8);
    this.vy = randRange(rng, -8, 8);
    this.armed = true;
    this.exploded = false;
    this.dead = false;
    this.pulse = randRange(rng, 0, TAU);
  }
  update(dt, player) {
    if (this.exploded) return;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.pulse += dt * 4;
  }
  draw(ctx, camera, w, h) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) return;
    ctx.save();
    ctx.translate(sx, sy);
    const p = 0.5 + 0.5 * Math.sin(this.pulse);
    ctx.strokeStyle = `rgba(255,80,80,${0.25 + p * 0.25})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, this.triggerRadius, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,${60 + p * 40},60,0.95)`;
    drawPoly(ctx, 6, this.radius, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,200,0.8)';
    ctx.stroke();
    ctx.restore();
  }
}

class IonCloud {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.type = 'ioncloud';
    this.radius = randRange(rng, 160, 320);
    this.vx = randRange(rng, -5, 5);
    this.vy = randRange(rng, -5, 5);
    this.drainPerSec = 14;
    this.dead = false;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
  containsPoint(px, py) { return dist2(this.x, this.y, px, py) < this.radius * this.radius; }
  draw(ctx, camera, w, h, time) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -this.radius - 40 || sx > w + this.radius + 40 || sy < -this.radius - 40 || sy > h + this.radius + 40) return;
    ctx.save();
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.radius);
    const flicker = 0.7 + 0.3 * Math.sin(time * 6 + this.x);
    grad.addColorStop(0, `rgba(160,110,255,${0.16 * flicker})`);
    grad.addColorStop(0.7, `rgba(120,90,220,${0.1 * flicker})`);
    grad.addColorStop(1, 'rgba(120,90,220,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

class Debris {
  constructor(x, y, rng, diffMult) {
    this.x = x; this.y = y;
    this.type = 'debris';
    this.radius = randRange(rng, 5, 10);
    const spd = randRange(rng, 90, 190) * clamp(diffMult, 1, 2);
    const dir = randRange(rng, 0, TAU);
    this.vx = Math.cos(dir) * spd;
    this.vy = Math.sin(dir) * spd;
    this.rotation = 0;
    this.angularVelocity = randRange(rng, -4, 4);
    this.mass = 0.5;
    this.dead = false;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.rotation += this.angularVelocity * dt; }
  draw(ctx, camera, w, h) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) return;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(this.rotation);
    ctx.fillStyle = 'rgba(200,200,210,0.85)';
    ctx.fillRect(-this.radius, -this.radius * 0.4, this.radius * 2, this.radius * 0.8);
    ctx.restore();
  }
}

class SolarFragment {
  constructor(x, y, rng, diffMult) {
    this.x = x; this.y = y;
    this.type = 'solar';
    this.radius = randRange(rng, 12, 20);
    const spd = randRange(rng, 140, 260) * clamp(diffMult, 1, 1.8);
    const dir = randRange(rng, 0, TAU);
    this.vx = Math.cos(dir) * spd;
    this.vy = Math.sin(dir) * spd;
    this.mass = 3;
    this.trail = [];
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
  }
  draw(ctx, camera, w, h) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) return;
    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const tx = t.x - camera.x + w / 2, ty = t.y - camera.y + h / 2;
      const a = (i / this.trail.length) * 0.4;
      ctx.fillStyle = `rgba(255,140,60,${a})`;
      ctx.beginPath(); ctx.arc(tx, ty, this.radius * (i / this.trail.length), 0, TAU); ctx.fill();
    }
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.radius * 2.2);
    grad.addColorStop(0, 'rgba(255,200,120,0.9)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.radius * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.95)';
    ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

class GravityWell {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.type = 'gravitywell';
    this.radius = randRange(rng, 26, 40);
    this.influenceRadius = randRange(rng, 420, 640);
    // tuned so pull is a gentle curve near the edge of influence but a real hazard close to the core
    this.strength = randRange(rng, 1600000, 2800000);
    this.rotation = 0;
    this.dead = false;
  }
  update(dt) { this.rotation += dt * 0.3; }
  // acceleration applied to an object at (px,py); safe (never infinite) due to min-distance clamp
  pullOn(px, py) {
    const dx = this.x - px, dy = this.y - py;
    const d = Math.max(60, Math.hypot(dx, dy));
    if (d > this.influenceRadius) return { ax: 0, ay: 0 };
    const falloff = 1 - d / this.influenceRadius;
    const a = (this.strength / (d * d)) * falloff;
    return { ax: (dx / d) * a, ay: (dy / d) * a };
  }
  draw(ctx, camera, w, h, time) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -this.influenceRadius || sx > w + this.influenceRadius || sy < -this.influenceRadius || sy > h + this.influenceRadius) return;
    ctx.save();
    const grad = ctx.createRadialGradient(sx, sy, this.radius, sx, sy, this.influenceRadius);
    grad.addColorStop(0, 'rgba(120,80,200,0.16)');
    grad.addColorStop(1, 'rgba(120,80,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, this.influenceRadius, 0, TAU); ctx.fill();

    ctx.translate(sx, sy); ctx.rotate(this.rotation);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(180,140,255,${0.4 - i * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, this.radius * (1.4 + i * 0.5), this.radius * (0.5 + i * 0.18), i, 0, TAU); ctx.stroke();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    core.addColorStop(0, 'rgba(20,10,40,1)');
    core.addColorStop(1, 'rgba(90,50,160,0.9)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function maybeGenerateGravityWell(seed, cx, cy, chunkSize, sectorInfo, originClearRadius) {
  if (!sectorInfo.gravityWells) return null;
  const rng = mulberry32(hashSeed(seed, cx, cy, 'gwell'));
  if (rng() > 0.12) return null;
  const x = cx * chunkSize + randRange(rng, chunkSize * 0.25, chunkSize * 0.75);
  const y = cy * chunkSize + randRange(rng, chunkSize * 0.25, chunkSize * 0.75);
  if (originClearRadius && Math.hypot(x, y) < originClearRadius) return null;
  return new GravityWell(x, y, rng);
}

function generateHazardsForChunk(seed, cx, cy, chunkSize, sectorInfo, originClearRadius) {
  const rng = mulberry32(hashSeed(seed, cx, cy, 'haz'));
  const list = [];
  const originX = cx * chunkSize, originY = cy * chunkSize;
  const spawn = (type) => {
    const x = originX + randRange(rng, 0, chunkSize);
    const y = originY + randRange(rng, 0, chunkSize);
    if (originClearRadius && Math.hypot(x, y) < originClearRadius) return null;
    if (type === 'mine') return new Mine(x, y, rng);
    if (type === 'ioncloud') return new IonCloud(x, y, rng);
    if (type === 'debris') return new Debris(x, y, rng, sectorInfo.diffMult);
    if (type === 'solar') return new SolarFragment(x, y, rng, sectorInfo.diffMult);
    return null;
  };
  for (const hzType of sectorInfo.hazards || []) {
    const count = randInt(rng, hzType.min, hzType.max);
    for (let i = 0; i < count; i++) {
      if (rng() < hzType.chance) {
        const h = spawn(hzType.type);
        if (h) list.push(h);
      }
    }
  }
  return list;
}
