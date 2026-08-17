// ---------------- Procedural world: chunk streaming, entity registry, collision queries ----------------
const CHUNK_SIZE = 1600;
const LOAD_RADIUS = 2; // chunks around player kept generated (5x5 grid)
const UNLOAD_RADIUS = 3; // chunk chebyshev distance beyond which chunks are discarded
const ORIGIN_CLEAR_RADIUS = 420; // safe bubble around spawn point
const PLAYER_CLEAR_RADIUS = 260; // safety net: never let a freshly generated object land this close to the ship

class World {
  constructor(seed, mode) {
    this.seed = seed;
    this.mode = mode || 'standard';
    this.chunks = new Map();
    this.gravityWells = [];
    this.stationsFlat = [];
  }

  key(cx, cy) { return cx + ',' + cy; }

  chunkCoordFor(x, y) { return [Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)]; }

  _modeAdjust(sectorInfo) {
    const info = { ...sectorInfo };
    if (this.mode === 'zen') {
      info.asteroidMin *= 0.55; info.asteroidMax *= 0.55;
      info.resourceMax *= 1.4; info.diffMult *= 0.7;
      info.hazards = info.hazards.map((h) => ({ ...h, chance: h.chance * 0.4 }));
    } else if (this.mode === 'hard') {
      info.asteroidMin *= 1.3; info.asteroidMax *= 1.35;
      info.resourceMax *= 0.75; info.diffMult *= 1.3;
    } else if (this.mode === 'hell') {
      info.asteroidMin *= 2.1; info.asteroidMax *= 2.3;
      info.resourceMax *= 0.9; info.diffMult *= 1.15;
    }
    return info;
  }

  _generateChunk(cx, cy, playerX, playerY, densityMult) {
    const originX = cx * CHUNK_SIZE, originY = cy * CHUNK_SIZE;
    const centerX = originX + CHUNK_SIZE / 2, centerY = originY + CHUNK_SIZE / 2;
    const km = pxToKm(Math.hypot(centerX, centerY));
    let sectorInfo = this._modeAdjust(getSectorInfo(km));
    if (densityMult && densityMult !== 1) {
      sectorInfo = { ...sectorInfo, asteroidMin: sectorInfo.asteroidMin * densityMult, asteroidMax: sectorInfo.asteroidMax * densityMult };
    }

    const asteroids = generateAsteroidsForChunk(this.seed, cx, cy, CHUNK_SIZE, sectorInfo, ORIGIN_CLEAR_RADIUS);
    const resources = generateResourcesForChunk(this.seed, cx, cy, CHUNK_SIZE, sectorInfo, ORIGIN_CLEAR_RADIUS);
    const hazards = generateHazardsForChunk(this.seed, cx, cy, CHUNK_SIZE, sectorInfo, ORIGIN_CLEAR_RADIUS);
    const station = maybeGenerateStation(this.seed, cx, cy, CHUNK_SIZE, ORIGIN_CLEAR_RADIUS);
    const gwell = maybeGenerateGravityWell(this.seed, cx, cy, CHUNK_SIZE, sectorInfo, ORIGIN_CLEAR_RADIUS);

    // safety net: never let anything spawn directly on top of the player when a chunk pops into existence
    const farEnough = (o) => !isFinite(playerX) || dist2(o.x, o.y, playerX, playerY) > PLAYER_CLEAR_RADIUS * PLAYER_CLEAR_RADIUS;
    const chunk = {
      asteroids: asteroids.filter(farEnough),
      resources: resources.filter(farEnough),
      hazards: hazards.filter(farEnough),
      stations: station && farEnough(station) ? [station] : [],
      gravityWells: gwell && farEnough(gwell) ? [gwell] : [],
      sectorName: sectorInfo.name,
    };
    if (chunk.stations.length) this.stationsFlat.push(chunk.stations[0]);
    if (chunk.gravityWells.length) this.gravityWells.push(chunk.gravityWells[0]);
    return chunk;
  }

  ensureChunksAround(playerX, playerY, densityMult) {
    const [pcx, pcy] = this.chunkCoordFor(playerX, playerY);
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
        const cx = pcx + dx, cy = pcy + dy;
        const k = this.key(cx, cy);
        if (!this.chunks.has(k)) {
          this.chunks.set(k, this._generateChunk(cx, cy, playerX, playerY, densityMult));
        }
      }
    }
  }

  unloadFarChunks(playerX, playerY) {
    const [pcx, pcy] = this.chunkCoordFor(playerX, playerY);
    for (const key of Array.from(this.chunks.keys())) {
      const [cx, cy] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) > UNLOAD_RADIUS) {
        const chunk = this.chunks.get(key);
        this.gravityWells = this.gravityWells.filter((g) => !chunk.gravityWells.includes(g));
        this.stationsFlat = this.stationsFlat.filter((s) => !chunk.stations.includes(s));
        this.chunks.delete(key);
      }
    }
  }

  forEachLoadedChunk(cb) { for (const chunk of this.chunks.values()) cb(chunk); }

  update(dt, player) {
    this.forEachLoadedChunk((chunk) => {
      for (const a of chunk.asteroids) a.update(dt);
      for (const h of chunk.hazards) if (h.update) h.update(dt, player);
      for (const g of chunk.gravityWells) g.update(dt);
      for (const s of chunk.stations) s.update(dt);
      chunk.resources = chunk.resources.filter((r) => !r.collected);
      chunk.hazards = chunk.hazards.filter((h) => !h.dead && !h.exploded);
      chunk.asteroids = chunk.asteroids.filter((a) => !a.dead);
    });
  }

  // returns flat arrays of everything within radius of (x,y) across loaded chunks
  queryNearby(x, y, radius) {
    const r2 = radius * radius;
    const asteroids = [], resources = [], hazards = [], stations = [], gravityWells = [];
    this.forEachLoadedChunk((chunk) => {
      for (const a of chunk.asteroids) if (dist2(a.x, a.y, x, y) <= r2 + a.radius * a.radius) asteroids.push(a);
      for (const r of chunk.resources) if (dist2(r.x, r.y, x, y) <= r2) resources.push(r);
      for (const h of chunk.hazards) if (dist2(h.x, h.y, x, y) <= r2 + (h.radius || 0) * (h.radius || 0)) hazards.push(h);
      for (const s of chunk.stations) if (dist2(s.x, s.y, x, y) <= r2) stations.push(s);
      for (const g of chunk.gravityWells) if (dist2(g.x, g.y, x, y) <= r2) gravityWells.push(g);
    });
    return { asteroids, resources, hazards, stations, gravityWells };
  }

  injectPickup(pickup) {
    const [cx, cy] = this.chunkCoordFor(pickup.x, pickup.y);
    const k = this.key(cx, cy);
    if (!this.chunks.has(k)) this.chunks.set(k, this._generateChunk(cx, cy, NaN, NaN, 1));
    this.chunks.get(k).resources.push(pickup);
  }
  injectAsteroid(asteroid) {
    const [cx, cy] = this.chunkCoordFor(asteroid.x, asteroid.y);
    const k = this.key(cx, cy);
    if (!this.chunks.has(k)) this.chunks.set(k, this._generateChunk(cx, cy, NaN, NaN, 1));
    this.chunks.get(k).asteroids.push(asteroid);
  }

  draw(ctx, camera, w, h, time) {
    this.forEachLoadedChunk((chunk) => {
      for (const gw of chunk.gravityWells) gw.draw(ctx, camera, w, h, time);
      for (const hz of chunk.hazards) if (hz.type === 'ioncloud') hz.draw(ctx, camera, w, h, time);
      for (const st of chunk.stations) st.draw(ctx, camera, w, h, time);
      for (const res of chunk.resources) res.draw(ctx, camera, w, h, time);
      for (const hz of chunk.hazards) if (hz.type !== 'ioncloud') hz.draw(ctx, camera, w, h, time);
      for (const ast of chunk.asteroids) ast.draw(ctx, camera, w, h);
    });
  }

  get loadedChunkCount() { return this.chunks.size; }
}
