// ---------------- Drifting stations: rare safe havens to repair, refuel, and upgrade ----------------
class Station {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.type = 'station';
    this.radius = 46;
    this.dockRadius = 110;
    this.rotation = 0;
    this.spin = randRange(rng, -0.15, 0.15);
    this.dead = false;
  }
  update(dt) { this.rotation += this.spin * dt; }
  draw(ctx, camera, w, h, time) {
    const sx = this.x - camera.x + w / 2, sy = this.y - camera.y + h / 2;
    if (sx < -160 || sx > w + 160 || sy < -160 || sy > h + 160) return;
    ctx.save();
    ctx.translate(sx, sy);

    const pulse = 0.6 + 0.4 * Math.sin(time * 1.5);
    ctx.strokeStyle = `rgba(100,224,255,${0.12 + pulse * 0.06})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, this.dockRadius, 0, TAU); ctx.stroke();

    ctx.rotate(this.rotation);
    ctx.strokeStyle = 'rgba(160,200,220,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.55, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * this.radius * 0.55, Math.sin(a) * this.radius * 0.55);
      ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(100,224,255,${0.5 + pulse * 0.4})`;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function maybeGenerateStation(seed, cx, cy, chunkSize, originClearRadius) {
  const rng = mulberry32(hashSeed(seed, cx, cy, 'station'));
  if (rng() > 0.045) return null;
  const x = cx * chunkSize + randRange(rng, chunkSize * 0.2, chunkSize * 0.8);
  const y = cy * chunkSize + randRange(rng, chunkSize * 0.2, chunkSize * 0.8);
  if (originClearRadius && Math.hypot(x, y) < originClearRadius * 1.5) return null;
  return new Station(x, y, rng);
}

function stationRepairCost(player) {
  const missing = player.maxHull - player.hull;
  return Math.max(0, Math.ceil(missing * 0.7));
}
function stationRefuelCost(player) {
  const missing = player.maxFuel - player.fuel;
  return Math.max(0, Math.ceil(missing * 0.5));
}
