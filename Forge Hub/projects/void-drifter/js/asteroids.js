// ---------------- Asteroids: irregular polygons, procedural per-chunk ----------------
const ASTEROID_SIZES = {
  small: { r: [14, 26], hp: 1, mass: 1 },
  medium: { r: [28, 48], hp: 2, mass: 2.4 },
  large: { r: [52, 92], hp: 3, mass: 5 },
};

class Asteroid {
  constructor(x, y, sizeClass, rng, diffMult) {
    this.x = x; this.y = y;
    this.sizeClass = sizeClass;
    const def = ASTEROID_SIZES[sizeClass];
    this.radius = randRange(rng, def.r[0], def.r[1]) * clamp(1 + (diffMult - 1) * 0.18, 1, 1.6);
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.mass = def.mass;

    const baseSpeed = randRange(rng, 4, 26) * clamp(diffMult, 1, 2.2);
    const dir = randRange(rng, 0, TAU);
    this.vx = Math.cos(dir) * baseSpeed;
    this.vy = Math.sin(dir) * baseSpeed;

    this.rotation = randRange(rng, 0, TAU);
    this.angularVelocity = randRange(rng, -0.6, 0.6);

    const vertCount = randInt(rng, 8, 13);
    this.verts = [];
    for (let i = 0; i < vertCount; i++) {
      const a = (i / vertCount) * TAU;
      const jitter = randRange(rng, 0.72, 1.16);
      this.verts.push({ a, r: this.radius * jitter });
    }

    const grays = ['150,150,160', '140,130,125', '120,135,140', '160,140,120'];
    this.color = pick(rng, grays);
    this.resourceChance = sizeClass === 'large' ? 0.55 : sizeClass === 'medium' ? 0.32 : 0.14;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;
  }

  draw(ctx, camera, w, h) {
    const sx = this.x - camera.x + w / 2;
    const sy = this.y - camera.y + h / 2;
    const margin = this.radius + 40;
    if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    this.verts.forEach((v, i) => {
      const px = Math.cos(v.a) * v.r;
      const py = Math.sin(v.a) * v.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = `rgba(${this.color},0.9)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,28,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // subtle crater accents
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.radius * 0.2, -this.radius * 0.15, this.radius * 0.22, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function generateAsteroidsForChunk(seed, cx, cy, chunkSize, sectorInfo, originClearRadius) {
  const rng = mulberry32(hashSeed(seed, cx, cy, 'ast'));
  const list = [];
  const baseCount = Math.round(randRange(rng, sectorInfo.asteroidMin, sectorInfo.asteroidMax));
  const originX = cx * chunkSize, originY = cy * chunkSize;
  for (let i = 0; i < baseCount; i++) {
    const x = originX + randRange(rng, 0, chunkSize);
    const y = originY + randRange(rng, 0, chunkSize);
    if (originClearRadius && Math.hypot(x, y) < originClearRadius) continue;
    const sizeRoll = rng();
    const sizeClass = sizeRoll < sectorInfo.largeChance ? 'large' : sizeRoll < sectorInfo.largeChance + sectorInfo.mediumChance ? 'medium' : 'small';
    list.push(new Asteroid(x, y, sizeClass, rng, sectorInfo.diffMult));
  }
  return list;
}

// Splits a destroyed small/medium asteroid into a couple of smaller fragments for satisfying feedback.
function fragmentAsteroid(asteroid, rng) {
  if (asteroid.sizeClass === 'small') return [];
  const childSize = asteroid.sizeClass === 'large' ? 'medium' : 'small';
  const frags = [];
  const count = randInt(rng, 2, 3);
  for (let i = 0; i < count; i++) {
    const a = new Asteroid(
      asteroid.x + randRange(rng, -10, 10),
      asteroid.y + randRange(rng, -10, 10),
      childSize, rng, 1
    );
    const ang = randRange(rng, 0, TAU);
    const spd = randRange(rng, 40, 110);
    a.vx = asteroid.vx * 0.4 + Math.cos(ang) * spd;
    a.vy = asteroid.vy * 0.4 + Math.sin(ang) * spd;
    frags.push(a);
  }
  return frags;
}
