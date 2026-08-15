// world.js — tile grid generation, resources, and world rendering

const TILE_SIZE = 20;
const WORLD_COLS = 48;
const WORLD_ROWS = 32;

const RESOURCE_LIMITS = {
  tree: { max: 40, harvest: 10, regen: 0 },
  stone: { max: 9999, harvest: 10, regen: 0 },
  bush: { max: 30, harvest: 8, regen: 0.5 } // per second, boosted during rain
};

// Humans/settlement think in game-resource terms (wood/food/stone); tiles
// store world-entity terms (tree/bush/stone). Map between the two here.
const TASK_TO_RESOURCE = { wood: 'tree', food: 'bush', stone: 'stone' };

class World {
  constructor() {
    this.cols = WORLD_COLS;
    this.rows = WORLD_ROWS;
    this.tiles = [];
    this.center = { x: (this.cols * TILE_SIZE) / 2, y: (this.rows * TILE_SIZE) / 2 };
    this.generate();
  }

  // ---- generation -------------------------------------------------------

  generate() {
    this.tiles = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({ type: 'grass', resource: null, burning: false });
      }
      this.tiles.push(row);
    }

    this._carveLakes();
    this._clearSettlementZone();
    this._scatterClusters('tree', 9, 6, 15, 4);
    this._scatterClusters('stone', 5, 4, 8, 3);
    this._scatterClusters('bush', 14, 2, 4, 2);
    this._clearSettlementZone(); // guarantee buildable space around the settlement
  }

  _inBounds(c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  _carveLakes() {
    const lakeCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < lakeCount; i++) {
      let c = 5 + Math.floor(Math.random() * (this.cols - 10));
      let r = 5 + Math.floor(Math.random() * (this.rows - 10));
      const steps = 60 + Math.floor(Math.random() * 60);
      for (let s = 0; s < steps; s++) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (Math.random() < 0.6 && this._inBounds(c + dc, r + dr)) {
              this.tiles[r + dr][c + dc].type = 'water';
            }
          }
        }
        c += Math.floor(Math.random() * 3) - 1;
        r += Math.floor(Math.random() * 3) - 1;
        c = Math.max(2, Math.min(this.cols - 3, c));
        r = Math.max(2, Math.min(this.rows - 3, r));
      }
    }
  }

  _clearSettlementZone() {
    const cc = Math.floor(this.cols / 2);
    const cr = Math.floor(this.rows / 2);
    const radius = 4;
    for (let r = -radius; r <= radius; r++) {
      for (let c = -radius; c <= radius; c++) {
        if (!this._inBounds(cc + c, cr + r)) continue;
        if (c * c + r * r <= radius * radius) {
          const tile = this.tiles[cr + r][cc + c];
          tile.type = 'grass';
          tile.resource = null;
        }
      }
    }
  }

  _scatterClusters(resourceType, clusterCount, minSize, maxSize, spread) {
    let placed = 0;
    let attempts = 0;
    while (placed < clusterCount && attempts < clusterCount * 20) {
      attempts++;
      const cc = Math.floor(Math.random() * this.cols);
      const cr = Math.floor(Math.random() * this.rows);
      if (!this._inBounds(cc, cr) || this.tiles[cr][cc].type !== 'grass') continue;

      const size = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
      let put = 0;
      let tries = 0;
      while (put < size && tries < size * 8) {
        tries++;
        const c = cc + Math.floor(Math.random() * spread * 2) - spread;
        const r = cr + Math.floor(Math.random() * spread * 2) - spread;
        if (!this._inBounds(c, r)) continue;
        const tile = this.tiles[r][c];
        if (tile.type !== 'grass' || tile.resource) continue;
        const limits = RESOURCE_LIMITS[resourceType];
        tile.resource = { type: resourceType, amount: limits.max, max: limits.max };
        put++;
      }
      placed++;
    }
  }

  reset() {
    this.generate();
  }

  // ---- queries ------------------------------------------------------------

  getTile(c, r) {
    if (!this._inBounds(c, r)) return null;
    return this.tiles[r][c];
  }

  tileAtPixel(x, y) {
    return this.getTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  }

  tileCoordAtPixel(x, y) {
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  tileCenterPixel(c, r) {
    return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
  }

  // Find the nearest tile carrying a resource for the given task type
  // ('wood'/'food'/'stone') with amount > 0.
  findNearestResource(taskType, fromX, fromY) {
    const resType = TASK_TO_RESOURCE[taskType] || taskType;
    let best = null;
    let bestDist = Infinity;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.tiles[r][c];
        if (tile.resource && tile.resource.type === resType && tile.resource.amount > 0) {
          const p = this.tileCenterPixel(c, r);
          const d = (p.x - fromX) ** 2 + (p.y - fromY) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = { col: c, row: r, x: p.x, y: p.y, tile };
          }
        }
      }
    }
    return best;
  }

  // taskType is 'wood'/'food'/'stone' as used by humans/settlement.
  harvest(tile, taskType) {
    const resType = TASK_TO_RESOURCE[taskType] || taskType;
    if (!tile.resource || tile.resource.type !== resType) return 0;
    const limits = RESOURCE_LIMITS[resType];
    const amt = Math.min(limits.harvest, tile.resource.amount);
    tile.resource.amount -= amt;
    if (tile.resource.amount <= 0 && resType !== 'bush' && resType !== 'stone') {
      tile.resource = null; // trees vanish once depleted
    }
    return amt;
  }

  growForestAt(x, y) {
    const { col, row } = this.tileCoordAtPixel(x, y);
    let put = 0;
    let tries = 0;
    while (put < 6 && tries < 40) {
      tries++;
      const c = col + Math.floor(Math.random() * 6) - 3;
      const r = row + Math.floor(Math.random() * 6) - 3;
      const tile = this.getTile(c, r);
      if (!tile || tile.type !== 'grass' || tile.resource) continue;
      tile.resource = { type: 'tree', amount: RESOURCE_LIMITS.tree.max, max: RESOURCE_LIMITS.tree.max };
      put++;
    }
  }

  update(dt, rainActive) {
    const bushRegen = RESOURCE_LIMITS.bush.regen * (rainActive ? 4 : 1);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const res = this.tiles[r][c].resource;
        if (res && res.type === 'bush' && res.amount < res.max) {
          res.amount = Math.min(res.max, res.amount + bushRegen * dt);
        }
      }
    }
  }

  // ---- rendering ------------------------------------------------------------

  render(ctx) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.tiles[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile.type === 'water') {
          ctx.fillStyle = '#2b6ea8';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x, y + 2, TILE_SIZE, 2);
        } else {
          const shade = (c + r) % 2 === 0 ? '#3a6b45' : '#375f3f';
          ctx.fillStyle = tile.burning ? '#5a3a1c' : shade;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }

        if (tile.resource) this._renderResource(ctx, tile.resource, x, y);
        if (tile.burning) this._renderFireOverlay(ctx, x, y);
      }
    }
  }

  _renderResource(ctx, res, x, y) {
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const ratio = res.amount / res.max;

    if (res.type === 'tree') {
      const trunkH = 5;
      ctx.fillStyle = '#5b3a20';
      ctx.fillRect(cx - 2, y + TILE_SIZE - trunkH - 2, 4, trunkH);
      ctx.fillStyle = '#2f7a3d';
      const r = 6 + 3 * ratio;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (res.type === 'stone') {
      ctx.fillStyle = '#8a8f96';
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy + 6);
      ctx.lineTo(cx - 4, cy - 6);
      ctx.lineTo(cx + 3, cy - 7);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6c7076';
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 2);
      ctx.lineTo(cx + 3, cy - 7);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.lineTo(cx + 1, cy + 6);
      ctx.closePath();
      ctx.fill();
    } else if (res.type === 'bush') {
      ctx.fillStyle = '#2f6b32';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      if (ratio > 0.3) {
        ctx.fillStyle = '#c9425a';
        const berries = Math.ceil(ratio * 4);
        for (let i = 0; i < berries; i++) {
          const ang = (i / berries) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 4, cy + Math.sin(ang) * 4, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _renderFireOverlay(ctx, x, y) {
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const flick = 4 + Math.random() * 3;
    ctx.fillStyle = 'rgba(255,120,20,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,80,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, flick * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
