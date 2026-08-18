// Procedural-but-coherent valley generation: biome fields, a hand-guided shrine
// route carved into natural-looking paths, landmark objects and a gated final
// approach to the Heart Lantern.

import { TILE, WORLD_W, WORLD_H, TERRAIN, TERRAIN_SPEED, SOLID_TERRAIN, SHRINE_COUNT } from './config.js';
import { mulberry32, makeNoise2D, fbm, clamp, lerp, dist, randRange, pick } from './utils.js';

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.noiseElev = makeNoise2D(seed);
    this.noiseMoist = makeNoise2D(seed + 101);
    this.noiseDetail = makeNoise2D(seed + 202);
    this.noiseShadow = makeNoise2D(seed + 303);

    this.w = WORLD_W; this.h = WORLD_H;
    this.pixelW = this.w * TILE; this.pixelH = this.h * TILE;

    this.biome = new Array(this.w * this.h);
    this.overlay = new Array(this.w * this.h).fill(null);
    this.explored = new Uint8Array(this.w * this.h);

    this.objects = {
      moonflowers: [], emberReeds: [], starMoss: [], lumenTrees: [],
      ruinsProps: [], hiddenPaths: [], reeds: []
    };

    this.spawn = { x: this.pixelW * 0.12, y: this.pixelH * 0.5 };
    this.heartLantern = { x: this.pixelW * 0.89, y: this.pixelH * 0.5, activated: false, id: 'heart' };
    this.shrineSpecs = [];
    this.gateTiles = [];
    this.gateOpen = false;

    this._generateBiomes();
    this._buildRoute();
    this._carveBorder();
    this._carveGate();
    this._scatterObjects();
  }

  idx(tx, ty) { return ty * this.w + tx; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  worldToTile(x, y) { return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) }; }

  _generateBiomes() {
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        const nx = tx / this.w, ny = ty / this.h;
        const elev = fbm(this.noiseElev, nx * 3.2, ny * 3.2, 4);
        const moist = fbm(this.noiseMoist, nx * 2.6 + 5, ny * 2.6 + 5, 4);
        const detail = this.noiseDetail(nx * 14, ny * 14);
        const shadowN = fbm(this.noiseShadow, nx * 2.1 + 9, ny * 2.1 + 9, 3);

        const depth = this._depthAt(tx * TILE, ty * TILE);

        let biome;
        if (elev < 0.32 && moist > 0.55) {
          biome = elev < 0.24 ? TERRAIN.DEEPWATER : TERRAIN.WATER;
        } else if (elev < 0.38 && moist > 0.4) {
          biome = TERRAIN.MUD;
        } else if (shadowN > 0.62 && depth > 0.35) {
          biome = TERRAIN.SHADOWGROUND;
        } else if (elev > 0.68 && detail > 0.5) {
          biome = TERRAIN.RUINS;
        } else if (moist > 0.6 && detail > 0.45) {
          biome = TERRAIN.TALLGRASS;
        } else if (moist > 0.45) {
          biome = TERRAIN.MEADOW;
        } else {
          biome = TERRAIN.GRASS;
        }
        this.biome[this.idx(tx, ty)] = biome;
      }
    }
  }

  _depthAt(x, y) {
    const d = dist(x, y, this.spawn.x, this.spawn.y);
    const maxD = dist(this.spawn.x, this.spawn.y, this.heartLantern.x, this.heartLantern.y) * 1.05;
    return clamp(d / maxD, 0, 1);
  }

  // Build a winding, hand-guided route from spawn through shrine anchors to
  // the Heart Lantern, then carve it into the tile grid as natural paths.
  _buildRoute() {
    const n = SHRINE_COUNT;
    const points = [this.spawn];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const baseX = lerp(this.spawn.x, this.heartLantern.x, t);
      const baseY = this.spawn.y + Math.sin(t * Math.PI * 2.1) * this.pixelH * 0.22;
      const jitterX = randRange(this.rng, -0.04, 0.04) * this.pixelW;
      const jitterY = randRange(this.rng, -0.06, 0.06) * this.pixelH;
      const margin = TILE * 6;
      const px = clamp(baseX + jitterX, margin, this.pixelW - margin);
      const py = clamp(baseY + jitterY, margin, this.pixelH - margin);
      const spec = { id: `shrine_${i}`, x: px, y: py, index: i, activated: false };
      points.push(spec);
      this.shrineSpecs.push(spec);
    }
    points.push(this.heartLantern);

    for (let i = 0; i < points.length - 1; i++) {
      this._carvePath(points[i], points[i + 1]);
    }

    // A couple of exploratory branch paths off the main route for variety.
    for (let b = 0; b < 3; b++) {
      const from = pick(this.rng, this.shrineSpecs);
      const angle = this.rng() * Math.PI * 2;
      const len = randRange(this.rng, TILE * 8, TILE * 16);
      const to = {
        x: clamp(from.x + Math.cos(angle) * len, TILE * 3, this.pixelW - TILE * 3),
        y: clamp(from.y + Math.sin(angle) * len, TILE * 3, this.pixelH - TILE * 3)
      };
      this._carvePath(from, to, true);
    }
  }

  _carvePath(a, b, thin = false) {
    const steps = Math.ceil(dist(a.x, a.y, b.x, b.y) / (TILE * 0.6));
    const perpX = -(b.y - a.y), perpY = (b.x - a.x);
    const perpLen = Math.hypot(perpX, perpY) || 1;
    const wiggleAmp = randRange(this.rng, TILE * 1.5, TILE * 3.2);
    const wiggleFreq = randRange(this.rng, 1.5, 3.5);
    const width = thin ? 1 : 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const wiggle = Math.sin(t * Math.PI * wiggleFreq) * wiggleAmp * Math.sin(t * Math.PI);
      const px = lerp(a.x, b.x, t) + (perpX / perpLen) * wiggle;
      const py = lerp(a.y, b.y, t) + (perpY / perpLen) * wiggle;
      this._stampPath(px, py, width);
    }
  }

  _stampPath(x, y, radiusTiles) {
    const { tx, ty } = this.worldToTile(x, y);
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
        const gx = tx + dx, gy = ty + dy;
        if (!this.inBounds(gx, gy)) continue;
        if (Math.hypot(dx, dy) > radiusTiles + 0.4) continue;
        const i = this.idx(gx, gy);
        const under = this.biome[i];
        if (under === TERRAIN.WATER || under === TERRAIN.DEEPWATER) {
          this.overlay[i] = TERRAIN.BRIDGE;
        } else if (under === TERRAIN.RUINS) {
          this.overlay[i] = TERRAIN.STONE;
        } else {
          this.overlay[i] = TERRAIN.PATH;
        }
      }
    }
  }

  _carveBorder() {
    const ring = 2;
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        if (tx < ring || ty < ring || tx >= this.w - ring || ty >= this.h - ring) {
          this.overlay[this.idx(tx, ty)] = TERRAIN.WALL;
        }
      }
    }
  }

  // Narrow guarded corridor just before the Heart Lantern; opens once enough
  // shrines are active.
  _carveGate() {
    const gateX = this.heartLantern.x - TILE * 10;
    const { tx } = this.worldToTile(gateX);
    const { ty: centerTy } = this.worldToTile(this.heartLantern.y);
    const gateWidth = 3;
    for (let gy = centerTy - 4; gy <= centerTy + 4; gy++) {
      for (let gxOff = 0; gxOff < gateWidth; gxOff++) {
        const gx = tx + gxOff;
        if (!this.inBounds(gx, gy)) continue;
        if (Math.abs(gy - centerTy) <= 1) continue; // keep the carved path line open visually
        const i = this.idx(gx, gy);
        this.overlay[i] = TERRAIN.WALL;
        this.gateTiles.push(i);
      }
    }
    // Make the final chamber and corridor read as cave/danger.
    for (let ty = centerTy - 10; ty <= centerTy + 10; ty++) {
      for (let tx2 = tx - 2; tx2 < this.w - 2; tx2++) {
        if (!this.inBounds(tx2, ty)) continue;
        const i = this.idx(tx2, ty);
        if (this.overlay[i] === TERRAIN.PATH) continue;
        if (Math.abs(ty - centerTy) < 6) this.biome[i] = TERRAIN.SHADOWGROUND;
      }
    }
  }

  openGate() {
    if (this.gateOpen) return;
    this.gateOpen = true;
    for (const i of this.gateTiles) this.overlay[i] = TERRAIN.CAVE;
  }

  _scatterObjects() {
    const attempts = 2200;
    for (let a = 0; a < attempts; a++) {
      const tx = Math.floor(this.rng() * this.w);
      const ty = Math.floor(this.rng() * this.h);
      const i = this.idx(tx, ty);
      const terrain = this.overlay[i] || this.biome[i];
      const x = tx * TILE + randRange(this.rng, 6, TILE - 6);
      const y = ty * TILE + randRange(this.rng, 6, TILE - 6);

      if (terrain === TERRAIN.MEADOW && this.rng() < 0.02) {
        this.objects.moonflowers.push({ x, y, awake: false, id: `mf_${a}` });
      } else if ((terrain === TERRAIN.MUD || terrain === TERRAIN.WATER) && this.rng() < 0.015) {
        this.objects.emberReeds.push({ x, y, ready: true, cooldown: 0, id: `er_${a}` });
      } else if (terrain === TERRAIN.TALLGRASS && this.rng() < 0.006) {
        this.objects.moonflowers.push({ x, y, awake: false, id: `mf2_${a}` });
      } else if (terrain === TERRAIN.RUINS && this.rng() < 0.012) {
        this.objects.ruinsProps.push({ x, y, kind: pick(this.rng, ['pillar', 'arch', 'rubble']), id: `rp_${a}` });
      }
    }

    // Lumen trees: a few fixed dramatic landmarks near shrines.
    for (const s of this.shrineSpecs) {
      const angle = this.rng() * Math.PI * 2;
      const r = randRange(this.rng, TILE * 3, TILE * 5);
      this.objects.lumenTrees.push({
        x: clamp(s.x + Math.cos(angle) * r, TILE * 3, this.pixelW - TILE * 3),
        y: clamp(s.y + Math.sin(angle) * r, TILE * 3, this.pixelH - TILE * 3),
        discovered: false, id: `lt_${s.id}`
      });
    }

    // Hidden paths: stepping-stone trails across water/tallgrass, only visible when lit.
    for (let h = 0; h < 10; h++) {
      const startShrine = pick(this.rng, this.shrineSpecs);
      const angle = this.rng() * Math.PI * 2;
      const len = randRange(this.rng, TILE * 5, TILE * 10);
      const points = [];
      const steps = 8;
      const sx = startShrine.x, sy = startShrine.y;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        points.push({
          x: sx + Math.cos(angle) * len * t + Math.sin(t * 6) * TILE * 0.6,
          y: sy + Math.sin(angle) * len * t + Math.cos(t * 6) * TILE * 0.6
        });
      }
      this.objects.hiddenPaths.push({ points, discovered: false, id: `hp_${h}` });
      // Star moss markers along the trail
      for (const p of points) {
        if (this.rng() < 0.5) this.objects.starMoss.push({ x: p.x, y: p.y, discovered: false, id: `sm_${h}_${p.x | 0}` });
      }
    }
  }

  terrainAt(x, y) {
    const { tx, ty } = this.worldToTile(x, y);
    if (!this.inBounds(tx, ty)) return TERRAIN.WALL;
    const i = this.idx(tx, ty);
    return this.overlay[i] || this.biome[i];
  }

  speedMultiplierAt(x, y) {
    const t = this.terrainAt(x, y);
    return TERRAIN_SPEED[t] ?? 1;
  }

  isSolid(x, y) {
    const t = this.terrainAt(x, y);
    return SOLID_TERRAIN.has(t);
  }

  depthAt(x, y) { return this._depthAt(x, y); }

  markExplored(x, y, radiusTiles) {
    const { tx, ty } = this.worldToTile(x, y);
    const r2 = radiusTiles * radiusTiles;
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const gx = tx + dx, gy = ty + dy;
        if (!this.inBounds(gx, gy)) continue;
        this.explored[this.idx(gx, gy)] = 1;
      }
    }
  }

  isExplored(tx, ty) { return this.inBounds(tx, ty) ? this.explored[this.idx(tx, ty)] === 1 : 0; }
}
