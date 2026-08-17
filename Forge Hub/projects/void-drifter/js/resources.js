// ---------------- Collectible pickups: fuel, energy, salvage, repair, rare core ----------------
const PICKUP_DEFS = {
  fuel: { color: '255,179,71', value: 30, radius: 10, weight: 34 },
  energy: { color: '100,224,255', value: 28, radius: 10, weight: 30 },
  salvage: { color: '160,255,190', value: [8, 22], radius: 8, weight: 28 },
  repair: { color: '255,110,110', value: 24, radius: 10, weight: 12 },
  rarecore: { color: '220,150,255', value: [60, 110], radius: 13, weight: 3 },
};

class Pickup {
  constructor(x, y, type, rng) {
    this.x = x; this.y = y;
    this.type = type;
    const def = PICKUP_DEFS[type];
    this.radius = def.radius;
    this.value = Array.isArray(def.value) ? Math.round(randRange(rng, def.value[0], def.value[1])) : def.value;
    this.color = def.color;
    this.vx = randRange(rng, -6, 6);
    this.vy = randRange(rng, -6, 6);
    this.bob = randRange(rng, 0, TAU);
    this.collected = false;
    this.magnetized = false;
  }

  update(dt, player, magnetRadius, time) {
    const d = distance(this.x, this.y, player.x, player.y);
    if (d < magnetRadius) {
      this.magnetized = true;
      const pull = clamp(1 - d / magnetRadius, 0, 1) * 620;
      const ang = Math.atan2(player.y - this.y, player.x - this.x);
      this.x += Math.cos(ang) * pull * dt;
      this.y += Math.sin(ang) * pull * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  draw(ctx, camera, w, h, time) {
    const sx = this.x - camera.x + w / 2;
    const sy = this.y - camera.y + h / 2;
    if (sx < -30 || sx > w + 30 || sy < -30 || sy > h + 30) return;
    const bobOffset = Math.sin(time * 2.2 + this.bob) * 3;
    ctx.save();
    ctx.translate(sx, sy + bobOffset);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 3.2);
    glow.addColorStop(0, `rgba(${this.color},0.35)`);
    glow.addColorStop(1, `rgba(${this.color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 3.2, 0, TAU);
    ctx.fill();

    ctx.rotate(time * 1.4 + this.bob);
    ctx.fillStyle = `rgba(${this.color},0.95)`;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;

    switch (this.type) {
      case 'fuel':
        drawPoly(ctx, 4, this.radius, Math.PI / 4);
        break;
      case 'energy':
        drawPoly(ctx, 6, this.radius, 0);
        break;
      case 'salvage':
        drawPoly(ctx, 4, this.radius * 0.9, 0);
        break;
      case 'repair':
        ctx.rotate(-time * 1.4 - this.bob);
        ctx.fillRect(-this.radius * 0.22, -this.radius, this.radius * 0.44, this.radius * 2);
        ctx.fillRect(-this.radius, -this.radius * 0.22, this.radius * 2, this.radius * 0.44);
        ctx.restore();
        return;
      case 'rarecore':
        drawPoly(ctx, 8, this.radius, 0);
        break;
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawPoly(ctx, sides, r, rotOffset) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotOffset + (i / sides) * TAU;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function generateResourcesForChunk(seed, cx, cy, chunkSize, sectorInfo, originClearRadius) {
  const rng = mulberry32(hashSeed(seed, cx, cy, 'res'));
  const list = [];
  const count = Math.round(randRange(rng, sectorInfo.resourceMin, sectorInfo.resourceMax));
  const originX = cx * chunkSize, originY = cy * chunkSize;
  const weighted = Object.keys(PICKUP_DEFS).map((k) => ({ key: k, weight: PICKUP_DEFS[k].weight }));
  for (let i = 0; i < count; i++) {
    const x = originX + randRange(rng, 0, chunkSize);
    const y = originY + randRange(rng, 0, chunkSize);
    if (originClearRadius && Math.hypot(x, y) < originClearRadius * 0.4) continue;
    const type = weightedPick(rng, weighted).key;
    list.push(new Pickup(x, y, type, rng));
  }
  return list;
}
