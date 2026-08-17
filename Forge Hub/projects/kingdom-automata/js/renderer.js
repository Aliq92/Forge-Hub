// ============================================================
// renderer.js — canvas rendering: terrain layer, political
// overlay, settlements, borders, war markers, camera.
// ============================================================

const BASE_CELL = 8; // px per world cell at zoom 1, in the offscreen layers

const HEAT_LOW = [70, 130, 220];   // cool blue
const HEAT_MID = [235, 200, 70];   // amber
const HEAT_HIGH = [220, 70, 70];   // red

function heatColor(t) {
  t = clamp(t, 0, 1);
  const c = t < 0.5
    ? [lerp(HEAT_LOW[0], HEAT_MID[0], t * 2), lerp(HEAT_LOW[1], HEAT_MID[1], t * 2), lerp(HEAT_LOW[2], HEAT_MID[2], t * 2)]
    : [lerp(HEAT_MID[0], HEAT_HIGH[0], (t - 0.5) * 2), lerp(HEAT_MID[1], HEAT_HIGH[1], (t - 0.5) * 2), lerp(HEAT_MID[2], HEAT_HIGH[2], (t - 0.5) * 2)];
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}
function stabilityColor(t) {
  // low stability = red, high = green
  t = clamp(t, 0, 1);
  const r = lerp(210, 70, t), g = lerp(70, 195, t), b = lerp(70, 110, t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

class Renderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = sim;
    this.mapMode = 'political';
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.selectedKingdomId = null;
    this.hoverCell = null;
    this.terrainLayer = null;
    this.overlayLayer = null;
    this.overlayMode = null;
    this.overlayDirty = true;
  }

  worldPxSize() { return { w: this.sim.world.width * BASE_CELL, h: this.sim.world.height * BASE_CELL }; }

  fitCamera() {
    const { w, h } = this.worldPxSize();
    const rect = this.canvas.getBoundingClientRect();
    const zoom = Math.min(rect.width / w, rect.height / h) * 0.94;
    this.camera.zoom = clamp(zoom, 0.05, 8);
    this.camera.x = (rect.width - w * this.camera.zoom) / 2;
    this.camera.y = (rect.height - h * this.camera.zoom) / 2;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.dpr = dpr;
  }

  screenToWorld(sx, sy) {
    return { x: (sx - this.camera.x) / this.camera.zoom, y: (sy - this.camera.y) / this.camera.zoom };
  }
  screenToCell(sx, sy) {
    const p = this.screenToWorld(sx, sy);
    const gx = Math.floor(p.x / BASE_CELL), gy = Math.floor(p.y / BASE_CELL);
    const w = this.sim.world;
    if (gx < 0 || gy < 0 || gx >= w.width || gy >= w.height) return null;
    return { x: gx, y: gy, i: cellIndex(w, gx, gy) };
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.15, 14);
    const after = this.screenToWorld(sx, sy);
    this.camera.x += (after.x - before.x) * this.camera.zoom;
    this.camera.y += (after.y - before.y) * this.camera.zoom;
  }
  pan(dx, dy) { this.camera.x += dx; this.camera.y += dy; }

  // ---- terrain (static) layer ----
  buildTerrainLayer() {
    const w = this.sim.world;
    const cnv = document.createElement('canvas');
    cnv.width = w.width * BASE_CELL; cnv.height = w.height * BASE_CELL;
    const ctx = cnv.getContext('2d');
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const i = cellIndex(w, x, y);
        const t = w.terrain[i];
        ctx.fillStyle = TERRAIN_COLOR[t];
        ctx.fillRect(x * BASE_CELL, y * BASE_CELL, BASE_CELL, BASE_CELL);
        // subtle texture speckle
        if (t !== TERRAIN.WATER) {
          const speck = (x * 37 + y * 17) % 5;
          if (speck === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(x * BASE_CELL + 1, y * BASE_CELL + 1, BASE_CELL - 2, BASE_CELL - 2);
          } else if (speck === 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.fillRect(x * BASE_CELL, y * BASE_CELL, BASE_CELL, BASE_CELL);
          }
        }
        if (w.resource[i]) {
          ctx.fillStyle = 'rgba(255,214,102,0.55)';
          const cx = x * BASE_CELL + BASE_CELL / 2, cy = y * BASE_CELL + BASE_CELL / 2;
          ctx.beginPath(); ctx.arc(cx, cy, BASE_CELL * 0.22, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // rivers as a stroke pass
    ctx.strokeStyle = 'rgba(90,160,220,0.85)';
    ctx.lineWidth = Math.max(1, BASE_CELL * 0.22);
    ctx.lineCap = 'round';
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const i = cellIndex(w, x, y);
        if (!w.river[i]) continue;
        const cx = x * BASE_CELL + BASE_CELL / 2, cy = y * BASE_CELL + BASE_CELL / 2;
        ctx.beginPath(); ctx.arc(cx, cy, BASE_CELL * 0.16, 0, Math.PI * 2); ctx.fill();
        for (const nb of neighbors4(w, i)) if (w.river[nb]) {
          const [nx, ny] = cellXY(w, nb);
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx * BASE_CELL + BASE_CELL / 2, ny * BASE_CELL + BASE_CELL / 2); ctx.stroke();
        }
      }
    }
    this.terrainLayer = cnv;
  }

  markOverlayDirty() { this.overlayDirty = true; }

  // ---- political / heat overlay layer ----
  buildOverlayLayer() {
    const w = this.sim.world;
    const cnv = document.createElement('canvas');
    cnv.width = w.width * BASE_CELL; cnv.height = w.height * BASE_CELL;
    const ctx = cnv.getContext('2d');
    const mode = this.mapMode;

    if (mode === 'terrain') { this.overlayLayer = cnv; this.overlayDirty = false; this.overlayMode = mode; return; }

    let maxDensity = 0.001, maxWealth = 0.001;
    if (mode === 'population' || mode === 'wealth') {
      for (const k of this.sim.aliveKingdoms()) {
        if (!k.territory.size) continue;
        if (mode === 'population') maxDensity = Math.max(maxDensity, k.population / k.territory.size);
        else maxWealth = Math.max(maxWealth, k.treasury / k.territory.size);
      }
    }

    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const i = cellIndex(w, x, y);
        const ownerId = w.owner[i];
        if (ownerId === -1) continue;
        const k = this.sim.kingdoms.get(ownerId);
        if (!k) continue;
        let color, alpha;
        if (mode === 'political' || mode === 'war') {
          color = k.color; alpha = mode === 'war' ? 0.32 : 0.58;
        } else if (mode === 'population') {
          color = heatColor((k.population / k.territory.size) / maxDensity); alpha = 0.62;
        } else if (mode === 'wealth') {
          color = heatColor((k.treasury / k.territory.size) / maxWealth); alpha = 0.62;
        } else if (mode === 'stability') {
          color = stabilityColor(k.stability / 100); alpha = 0.62;
        } else { color = k.color; alpha = 0.5; }
        ctx.fillStyle = withAlphaRaw(color, alpha);
        ctx.fillRect(x * BASE_CELL, y * BASE_CELL, BASE_CELL, BASE_CELL);
      }
    }

    // borders
    ctx.lineWidth = Math.max(1, BASE_CELL * 0.16);
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const i = cellIndex(w, x, y);
        const own = w.owner[i];
        if (own === -1) continue;
        const px = x * BASE_CELL, py = y * BASE_CELL;
        const right = x + 1 < w.width ? w.owner[cellIndex(w, x + 1, y)] : -2;
        const down = y + 1 < w.height ? w.owner[cellIndex(w, x, y + 1)] : -2;
        if (right !== own) {
          const k = this.sim.kingdoms.get(own);
          ctx.strokeStyle = right === -1 ? withAlphaRaw(k?.color || '#fff', 0.9) : 'rgba(8,8,10,0.9)';
          ctx.beginPath(); ctx.moveTo(px + BASE_CELL, py); ctx.lineTo(px + BASE_CELL, py + BASE_CELL); ctx.stroke();
        }
        if (down !== own) {
          const k = this.sim.kingdoms.get(own);
          ctx.strokeStyle = down === -1 ? withAlphaRaw(k?.color || '#fff', 0.9) : 'rgba(8,8,10,0.9)';
          ctx.beginPath(); ctx.moveTo(px, py + BASE_CELL); ctx.lineTo(px + BASE_CELL, py + BASE_CELL); ctx.stroke();
        }
      }
    }
    this.overlayLayer = cnv;
    this.overlayDirty = false;
    this.overlayMode = mode;
  }

  setMapMode(mode) { this.mapMode = mode; this.overlayDirty = true; }

  ensureLayers() {
    if (!this.terrainLayer) this.buildTerrainLayer();
    if (!this.overlayLayer || this.overlayDirty || this.overlayMode !== this.mapMode) this.buildOverlayLayer();
  }

  render(now) {
    this.ensureLayers();
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.imageSmoothingEnabled = this.camera.zoom < 1;
    ctx.drawImage(this.terrainLayer, 0, 0);
    if (this.mapMode !== 'terrain') ctx.drawImage(this.overlayLayer, 0, 0);

    this.drawSettlements(ctx, now);
    if (this.mapMode === 'war') this.drawWarFronts(ctx, now);
    if (this.selectedKingdomId != null) this.drawSelection(ctx);
    ctx.restore();
  }

  drawSettlements(ctx, now) {
    for (const s of this.sim.settlements.values()) {
      const k = this.sim.kingdoms.get(s.kingdomId);
      if (!k || !k.alive) continue;
      const cx = s.x * BASE_CELL + BASE_CELL / 2, cy = s.y * BASE_CELL + BASE_CELL / 2;
      const r = s.type === 'capital' ? BASE_CELL * 0.62 : s.type === 'city' ? BASE_CELL * 0.42 : BASE_CELL * 0.28;
      ctx.beginPath();
      if (s.type === 'capital') {
        this.drawStar(ctx, cx, cy, r, r * 0.45, 5);
      } else {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#0b0d12';
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, BASE_CELL * 0.09);
      ctx.strokeStyle = k.colorLight;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = k.colorLight;
      ctx.fill();
      if (k.id === this.selectedKingdomId && s.id === k.capitalSettlementId) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 300);
        ctx.beginPath(); ctx.arc(cx, cy, r + 3 + pulse * 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.4 + pulse * 0.3})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }

  drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  drawWarFronts(ctx, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    for (const k of this.sim.aliveKingdoms()) {
      if (!k.warTargets) continue;
      for (const [enemyId, cells] of k.warTargets) {
        for (const cell of cells) {
          const [x, y] = cellXY(this.sim.world, cell);
          ctx.fillStyle = `rgba(255,60,50,${0.35 + pulse * 0.35})`;
          ctx.fillRect(x * BASE_CELL, y * BASE_CELL, BASE_CELL, BASE_CELL);
        }
      }
    }
  }

  drawSelection(ctx) {
    const k = this.sim.kingdoms.get(this.selectedKingdomId);
    if (!k) return;
    ctx.lineWidth = Math.max(1, BASE_CELL * 0.2);
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    for (const cell of k.territory) {
      const [x, y] = cellXY(this.sim.world, cell);
      let border = false;
      for (const nb of neighbors4(this.sim.world, cell)) if (this.sim.world.owner[nb] !== k.id) border = true;
      if (x === 0 || y === 0 || x === this.sim.world.width - 1 || y === this.sim.world.height - 1) border = true;
      if (border) ctx.strokeRect(x * BASE_CELL + 0.5, y * BASE_CELL + 0.5, BASE_CELL - 1, BASE_CELL - 1);
    }
    ctx.globalAlpha = 1;
  }
}

function withAlphaRaw(hexOrRgb, a) {
  if (hexOrRgb.startsWith('#')) return withAlpha(hexOrRgb, a);
  return hexOrRgb;
}
