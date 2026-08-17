(function (global) {
  "use strict";

  var TILE = { OPEN: 0, FOREST: 1, HILLS: 2, ROCKS: 3, WATER: 4 };

  var CONFIG = {
    TILE_SIZE: 20,
    COLS: 80,
    ROWS: 45
  };
  CONFIG.WORLD_W = CONFIG.COLS * CONFIG.TILE_SIZE;
  CONFIG.WORLD_H = CONFIG.ROWS * CONFIG.TILE_SIZE;
  CONFIG.DEPLOY_FRAC = 0.16;

  var TILE_INFO = {};
  TILE_INFO[TILE.OPEN] = { passable: true, speed: 1.0, rangedDefense: 0, color: "#213024", label: "Open Ground" };
  TILE_INFO[TILE.FOREST] = { passable: true, speed: 0.6, rangedDefense: 0.35, color: "#1a3323", label: "Forest" };
  TILE_INFO[TILE.HILLS] = { passable: true, speed: 0.85, rangedDefense: 0, rangeBonus: 0.2, color: "#3a3623", label: "Hills" };
  TILE_INFO[TILE.ROCKS] = { passable: false, speed: 0, rangedDefense: 0, color: "#2b2b30", label: "Rocks" };
  TILE_INFO[TILE.WATER] = { passable: false, speed: 0.2, rangedDefense: 0, color: "#122a38", label: "Water" };

  function idx(cols, cx, cy) { return cy * cols + cx; }

  function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function stampBlob(grid, cols, rows, cx, cy, rx, ry, tileType, density) {
    density = density === undefined ? 0.85 : density;
    var x0 = clampInt(Math.floor(cx - rx), 0, cols - 1);
    var x1 = clampInt(Math.ceil(cx + rx), 0, cols - 1);
    var y0 = clampInt(Math.floor(cy - ry), 0, rows - 1);
    var y1 = clampInt(Math.ceil(cy + ry), 0, rows - 1);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var nx = (x - cx) / rx, ny = (y - cy) / ry;
        var d = Math.sqrt(nx * nx + ny * ny);
        if (d <= 1 && Math.random() < density * (1 - d * 0.6)) {
          grid[idx(cols, x, y)] = tileType;
        }
      }
    }
  }

  function fill(grid, tileType) {
    for (var i = 0; i < grid.length; i++) grid[i] = tileType;
  }

  function scatterBlobs(grid, cols, rows, count, tileType, rMin, rMax, density, xRange) {
    for (var i = 0; i < count; i++) {
      var xr = xRange || [0, cols];
      var cx = xr[0] + Math.random() * (xr[1] - xr[0]);
      var cy = Math.random() * rows;
      var rx = rMin + Math.random() * (rMax - rMin);
      var ry = rMin + Math.random() * (rMax - rMin);
      stampBlob(grid, cols, rows, cx, cy, rx, ry, tileType, density);
    }
  }

  function clearDeployZones(grid, cols, rows) {
    var dz = Math.floor(cols * CONFIG.DEPLOY_FRAC);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < dz; x++) {
        var i = idx(cols, x, y);
        if (grid[i] === TILE.ROCKS || grid[i] === TILE.WATER) {
          if (Math.random() < 0.75) grid[i] = TILE.OPEN;
        }
      }
      for (var x2 = cols - dz; x2 < cols; x2++) {
        var i2 = idx(cols, x2, y);
        if (grid[i2] === TILE.ROCKS || grid[i2] === TILE.WATER) {
          if (Math.random() < 0.75) grid[i2] = TILE.OPEN;
        }
      }
    }
  }

  function genOpen(grid, cols, rows) {
    fill(grid, TILE.OPEN);
    scatterBlobs(grid, cols, rows, 5, TILE.FOREST, 2, 4, 0.8);
    scatterBlobs(grid, cols, rows, 4, TILE.HILLS, 2, 3.5, 0.8);
    scatterBlobs(grid, cols, rows, 3, TILE.ROCKS, 1, 2, 0.9);
  }

  function genWoodland(grid, cols, rows) {
    fill(grid, TILE.OPEN);
    scatterBlobs(grid, cols, rows, 7, TILE.FOREST, 4, 9, 0.9, [cols * 0.2, cols * 0.8]);
    scatterBlobs(grid, cols, rows, 3, TILE.FOREST, 2, 4, 0.8);
    scatterBlobs(grid, cols, rows, 3, TILE.HILLS, 2, 3.5, 0.75);
    scatterBlobs(grid, cols, rows, 3, TILE.ROCKS, 1, 2, 0.85);
  }

  function genRiver(grid, cols, rows) {
    fill(grid, TILE.OPEN);
    var bandCenter = cols * (0.42 + Math.random() * 0.16);
    var bandHalfW = cols * 0.045;
    for (var y = 0; y < rows; y++) {
      var wobble = Math.sin(y * 0.35) * 1.4;
      var x0 = clampInt(Math.floor(bandCenter + wobble - bandHalfW), 0, cols - 1);
      var x1 = clampInt(Math.ceil(bandCenter + wobble + bandHalfW), 0, cols - 1);
      for (var x = x0; x <= x1; x++) grid[idx(cols, x, y)] = TILE.WATER;
    }
    var crossings = 3 + Math.floor(Math.random() * 3);
    for (var c = 0; c < crossings; c++) {
      var cy = 2 + Math.random() * (rows - 4);
      var width = 2 + Math.random() * 1.5;
      for (var yy = Math.floor(cy - width); yy <= Math.ceil(cy + width); yy++) {
        if (yy < 0 || yy >= rows) continue;
        var wobble2 = Math.sin(yy * 0.35) * 1.4;
        var x0b = clampInt(Math.floor(bandCenter + wobble2 - bandHalfW - 1), 0, cols - 1);
        var x1b = clampInt(Math.ceil(bandCenter + wobble2 + bandHalfW + 1), 0, cols - 1);
        for (var xx = x0b; xx <= x1b; xx++) grid[idx(cols, xx, yy)] = TILE.OPEN;
      }
    }
    scatterBlobs(grid, cols, rows, 4, TILE.FOREST, 2, 4, 0.8, [0, cols * 0.4]);
    scatterBlobs(grid, cols, rows, 4, TILE.FOREST, 2, 4, 0.8, [cols * 0.6, cols]);
    scatterBlobs(grid, cols, rows, 3, TILE.HILLS, 1.5, 3, 0.75);
  }

  function genBroken(grid, cols, rows) {
    fill(grid, TILE.OPEN);
    scatterBlobs(grid, cols, rows, 10, TILE.ROCKS, 1, 2.4, 0.85, [cols * 0.15, cols * 0.85]);
    scatterBlobs(grid, cols, rows, 6, TILE.FOREST, 2, 4, 0.8);
    scatterBlobs(grid, cols, rows, 3, TILE.HILLS, 1.5, 3, 0.75);
  }

  function genRandom(grid, cols, rows) {
    var picks = [genOpen, genWoodland, genRiver, genBroken];
    var a = picks[Math.floor(Math.random() * picks.length)];
    var b = picks[Math.floor(Math.random() * picks.length)];
    a(grid, cols, rows);
    if (Math.random() < 0.5) {
      var tmp = new Uint8Array(grid.length);
      b(tmp, cols, rows);
      for (var i = 0; i < grid.length; i++) {
        if (tmp[i] !== TILE.OPEN && Math.random() < 0.35) grid[i] = tmp[i];
      }
    }
  }

  var GENERATORS = {
    open: genOpen,
    woodland: genWoodland,
    river: genRiver,
    broken: genBroken,
    random: genRandom
  };

  function generate(mapType) {
    var cols = CONFIG.COLS, rows = CONFIG.ROWS;
    var grid = new Uint8Array(cols * rows);
    var gen = GENERATORS[mapType] || genOpen;
    gen(grid, cols, rows);
    clearDeployZones(grid, cols, rows);
    return { type: mapType, cols: cols, rows: rows, tileSize: CONFIG.TILE_SIZE, grid: grid };
  }

  function tileAtCell(map, cx, cy) {
    if (cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows) return TILE.ROCKS;
    return map.grid[idx(map.cols, cx, cy)];
  }

  function tileAt(map, worldX, worldY) {
    var cx = Math.floor(worldX / map.tileSize);
    var cy = Math.floor(worldY / map.tileSize);
    return tileAtCell(map, cx, cy);
  }

  function isPassable(tileType, flying) {
    if (flying) return tileType !== TILE.ROCKS;
    return TILE_INFO[tileType].passable;
  }

  function speedMult(tileType, flying) {
    if (flying) return tileType === TILE.ROCKS ? 0 : 1.0;
    return TILE_INFO[tileType].speed;
  }

  function rangedDefenseBonus(tileType) {
    return TILE_INFO[tileType].rangedDefense || 0;
  }

  function rangeBonus(tileType) {
    return TILE_INFO[tileType].rangeBonus || 0;
  }

  function deployZoneCols() {
    return Math.floor(CONFIG.COLS * CONFIG.DEPLOY_FRAC);
  }

  function isInDeployZone(worldX, team) {
    var dzPx = deployZoneCols() * CONFIG.TILE_SIZE;
    if (team === "blue") return worldX <= dzPx;
    return worldX >= CONFIG.WORLD_W - dzPx;
  }

  global.BS = global.BS || {};
  global.BS.Terrain = {
    TILE: TILE,
    TILE_INFO: TILE_INFO,
    CONFIG: CONFIG,
    generate: generate,
    tileAt: tileAt,
    tileAtCell: tileAtCell,
    isPassable: isPassable,
    speedMult: speedMult,
    rangedDefenseBonus: rangedDefenseBonus,
    rangeBonus: rangeBonus,
    deployZoneCols: deployZoneCols,
    isInDeployZone: isInDeployZone
  };
})(window);
