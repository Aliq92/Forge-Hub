// effects.js — god powers' visual/physical effects: lightning, fire, rain

const FIRE_BURN_DURATION = 7; // seconds a tile burns before extinguishing
const FIRE_SPREAD_CHANCE = 0.18; // chance per second per burning neighbor
const LIGHTNING_KILL_RADIUS = 30;
const LIGHTNING_DAMAGE_RADIUS = 70;
const RAIN_DURATION = 16;

class Effects {
  constructor(world) {
    this.world = world;
    this.bolts = []; // { x, y, life }
    this.fires = []; // { col, row, life, spreadAccum }
    this.rainActive = false;
    this.rainTimer = 0;
    this.raindrops = [];
  }

  // ---- lightning ----------------------------------------------------------

  strikeLightning(x, y, humans) {
    this.bolts.push({ x, y, life: 0.35 });

    for (const h of humans) {
      if (h.dead) continue;
      const d = h.distTo(x, y);
      if (d < LIGHTNING_KILL_RADIUS) {
        h.health = 0;
        h.dead = true;
      } else if (d < LIGHTNING_DAMAGE_RADIUS) {
        h.health -= 50;
        if (h.health <= 0) h.dead = true;
      }
    }

    const { col, row } = this.world.tileCoordAtPixel(x, y);
    const reach = Math.ceil(LIGHTNING_DAMAGE_RADIUS / TILE_SIZE);
    for (let r = -reach; r <= reach; r++) {
      for (let c = -reach; c <= reach; c++) {
        const tile = this.world.getTile(col + c, row + r);
        if (!tile || !tile.resource || tile.resource.type !== 'tree') continue;
        const p = this.world.tileCenterPixel(col + c, row + r);
        if (Math.hypot(p.x - x, p.y - y) < LIGHTNING_DAMAGE_RADIUS && Math.random() < 0.5) {
          this.startFire(col + c, row + r);
        }
      }
    }
  }

  // ---- fire -----------------------------------------------------------------

  startFire(col, row) {
    const tile = this.world.getTile(col, row);
    if (!tile || tile.burning || !tile.resource || tile.resource.type !== 'tree') return;
    tile.burning = true;
    this.fires.push({ col, row, life: FIRE_BURN_DURATION, spreadAccum: 0 });
  }

  igniteNear(x, y) {
    const { col, row } = this.world.tileCoordAtPixel(x, y);
    // search a small radius for the nearest tree to ignite
    for (let radius = 0; radius <= 3; radius++) {
      for (let r = -radius; r <= radius; r++) {
        for (let c = -radius; c <= radius; c++) {
          const tile = this.world.getTile(col + c, row + r);
          if (tile && tile.resource && tile.resource.type === 'tree') {
            this.startFire(col + c, row + r);
            return;
          }
        }
      }
    }
  }

  _updateFires(dt, humans) {
    for (const f of this.fires) {
      f.life -= dt;
      f.spreadAccum += dt;

      // damage humans standing on/near a burning tile
      const p = this.world.tileCenterPixel(f.col, f.row);
      for (const h of humans) {
        if (h.dead) continue;
        if (h.distTo(p.x, p.y) < TILE_SIZE) {
          h.health -= 12 * dt;
          if (h.health <= 0) h.dead = true;
        }
      }

      if (f.spreadAccum >= 1) {
        f.spreadAccum -= 1;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (Math.random() < FIRE_SPREAD_CHANCE) {
            this.startFire(f.col + dc, f.row + dr);
          }
        }
      }
    }

    const stillBurning = [];
    for (const f of this.fires) {
      if (f.life <= 0) {
        const tile = this.world.getTile(f.col, f.row);
        if (tile) {
          tile.burning = false;
          tile.resource = null; // burned away
        }
      } else {
        stillBurning.push(f);
      }
    }
    this.fires = stillBurning;
  }

  // ---- rain -------------------------------------------------------------

  startRain() {
    this.rainActive = true;
    this.rainTimer = RAIN_DURATION;
    if (this.raindrops.length === 0) {
      const w = WORLD_COLS * TILE_SIZE;
      const h = WORLD_ROWS * TILE_SIZE;
      for (let i = 0; i < 140; i++) {
        this.raindrops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: 250 + Math.random() * 150,
          len: 6 + Math.random() * 6
        });
      }
    }
  }

  _updateRain(dt) {
    if (this.rainActive) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) this.rainActive = false;
    }
    if (this.rainActive) {
      const w = WORLD_COLS * TILE_SIZE;
      const h = WORLD_ROWS * TILE_SIZE;
      for (const d of this.raindrops) {
        d.y += d.speed * dt;
        d.x -= 40 * dt;
        if (d.y > h) {
          d.y = -10;
          d.x = Math.random() * w;
        }
        if (d.x < 0) d.x = w;
      }
    }
  }

  // ---- update / render ----------------------------------------------------

  update(dt, humans) {
    this._updateFires(dt, humans);
    this._updateRain(dt);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
  }

  render(ctx) {
    if (this.rainActive) {
      ctx.strokeStyle = 'rgba(150,190,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.raindrops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 3, d.y + d.len);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,160,220,0.06)';
      ctx.fillRect(0, 0, WORLD_COLS * TILE_SIZE, WORLD_ROWS * TILE_SIZE);
    }

    for (const b of this.bolts) this._renderBolt(ctx, b);
  }

  _renderBolt(ctx, b) {
    const alpha = Math.max(0, b.life / 0.35);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let x = b.x, y = 0;
    ctx.moveTo(x, y);
    while (y < b.y) {
      x += (Math.random() - 0.5) * 18;
      y += 14 + Math.random() * 10;
      ctx.lineTo(x, Math.min(y, b.y));
    }
    ctx.stroke();

    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, LIGHTNING_DAMAGE_RADIUS);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, LIGHTNING_DAMAGE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
