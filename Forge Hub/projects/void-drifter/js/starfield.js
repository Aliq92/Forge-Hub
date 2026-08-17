// ---------------- Parallax starfield + nebula haze (tiled, camera-relative, infinite) ----------------
class StarField {
  constructor() {
    this.layers = [
      { count: 90, tile: 2200, parallax: 0.15, size: [0.6, 1.3], color: '160,190,220', alpha: 0.55 },
      { count: 70, tile: 2600, parallax: 0.35, size: [0.9, 1.8], color: '190,220,255', alpha: 0.75 },
      { count: 45, tile: 3000, parallax: 0.6, size: [1.2, 2.4], color: '220,240,255', alpha: 0.95 },
    ];
    this.stars = this.layers.map((layer) => {
      const rng = mulberry32(hashSeed('stars', layer.tile));
      const arr = [];
      for (let i = 0; i < layer.count; i++) {
        arr.push({
          x: randRange(rng, 0, layer.tile),
          y: randRange(rng, 0, layer.tile),
          r: randRange(rng, layer.size[0], layer.size[1]),
          tw: randRange(rng, 0, TAU),
          tws: randRange(rng, 0.5, 1.6),
        });
      }
      return arr;
    });

    this.nebulaCellSize = 4200;
    this._nebulaCache = new Map();
  }

  _getNebulaCell(cx, cy) {
    const key = cx + ',' + cy;
    if (this._nebulaCache.has(key)) return this._nebulaCache.get(key);
    const rng = mulberry32(hashSeed('neb', cx, cy));
    const has = rng() < 0.55;
    let cell = null;
    if (has) {
      const hues = ['99,110,220', '170,100,220', '90,170,220', '200,110,150'];
      cell = {
        x: cx * this.nebulaCellSize + randRange(rng, 0, this.nebulaCellSize),
        y: cy * this.nebulaCellSize + randRange(rng, 0, this.nebulaCellSize),
        r: randRange(rng, 500, 1100),
        color: pick(rng, hues),
        alpha: randRange(rng, 0.04, 0.11),
      };
    }
    this._nebulaCache.set(key, cell);
    if (this._nebulaCache.size > 400) {
      // prevent unbounded growth on very long runs
      const firstKey = this._nebulaCache.keys().next().value;
      this._nebulaCache.delete(firstKey);
    }
    return cell;
  }

  drawNebula(ctx, camera, w, h, reducedMotion) {
    const cs = this.nebulaCellSize;
    const parallax = 0.08;
    const viewX = camera.x * parallax;
    const viewY = camera.y * parallax;
    const minCx = Math.floor((viewX - w) / cs) - 1;
    const maxCx = Math.floor((viewX + w) / cs) + 1;
    const minCy = Math.floor((viewY - h) / cs) - 1;
    const maxCy = Math.floor((viewY + h) / cs) + 1;
    ctx.save();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this._getNebulaCell(cx, cy);
        if (!cell) continue;
        const sx = cell.x - viewX + w / 2;
        const sy = cell.y - viewY + h / 2;
        if (sx < -cell.r - 100 || sx > w + cell.r + 100 || sy < -cell.r - 100 || sy > h + cell.r + 100) continue;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, cell.r);
        grad.addColorStop(0, `rgba(${cell.color},${cell.alpha})`);
        grad.addColorStop(1, `rgba(${cell.color},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(sx - cell.r, sy - cell.r, cell.r * 2, cell.r * 2);
      }
    }
    ctx.restore();
  }

  drawStars(ctx, camera, w, h, time, reducedMotion) {
    ctx.save();
    for (const layer of this.layers) {
      const idx = this.layers.indexOf(layer);
      const stars = this.stars[idx];
      const tile = layer.tile;
      const viewX = camera.x * layer.parallax;
      const viewY = camera.y * layer.parallax;
      const originX = -((viewX % tile) + tile) % tile;
      const originY = -((viewY % tile) + tile) % tile;
      const tilesX = Math.ceil(w / tile) + 2;
      const tilesY = Math.ceil(h / tile) + 2;
      for (let tx = -1; tx < tilesX; tx++) {
        for (let ty = -1; ty < tilesY; ty++) {
          const baseX = originX + tx * tile;
          const baseY = originY + ty * tile;
          for (const s of stars) {
            const sx = baseX + s.x;
            const sy = baseY + s.y;
            if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;
            let alpha = layer.alpha;
            if (!reducedMotion) alpha *= 0.65 + 0.35 * Math.sin(time * s.tws + s.tw);
            ctx.fillStyle = `rgba(${layer.color},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  }
}
