(function (global) {
  "use strict";

  var TEAM_COLORS = {
    blue: { core: "#4aa3ff", dark: "#1c5fa8", glow: "rgba(74,163,255,0.5)", light: "#bfe0ff" },
    red: { core: "#ff5f5f", dark: "#a52424", glow: "rgba(255,95,95,0.5)", light: "#ffcccc" }
  };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.terrainCache = null;
    this.terrainCacheKey = null;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
  }

  Renderer.prototype.resize = function (cssW, cssH) {
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.viewW = cssW;
    this.viewH = cssH;
  };

  Renderer.prototype.worldToScreen = function (wx, wy) {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.viewW / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.viewH / 2
    };
  };

  Renderer.prototype.screenToWorld = function (sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.viewH / 2) / this.camera.zoom + this.camera.y
    };
  };

  Renderer.prototype.fitToWorld = function () {
    var T = global.BS.Terrain.CONFIG;
    var zx = this.viewW / T.WORLD_W;
    var zy = this.viewH / T.WORLD_H;
    this.camera.zoom = Math.max(0.12, Math.min(zx, zy) * 0.94);
    this.camera.x = T.WORLD_W / 2;
    this.camera.y = T.WORLD_H / 2;
  };

  Renderer.prototype.clampCamera = function () {
    var T = global.BS.Terrain.CONFIG;
    this.camera.zoom = Math.max(0.12, Math.min(2.6, this.camera.zoom));
    var margin = 200;
    this.camera.x = Math.max(-margin, Math.min(T.WORLD_W + margin, this.camera.x));
    this.camera.y = Math.max(-margin, Math.min(T.WORLD_H + margin, this.camera.y));
  };

  Renderer.prototype.buildTerrainCache = function (map) {
    var Terrain = global.BS.Terrain;
    var off = document.createElement("canvas");
    off.width = map.cols * map.tileSize;
    off.height = map.rows * map.tileSize;
    var c = off.getContext("2d");
    for (var y = 0; y < map.rows; y++) {
      for (var x = 0; x < map.cols; x++) {
        var t = Terrain.tileAtCell(map, x, y);
        var info = Terrain.TILE_INFO[t];
        c.fillStyle = info.color;
        c.fillRect(x * map.tileSize, y * map.tileSize, map.tileSize, map.tileSize);
      }
    }
    c.strokeStyle = "rgba(255,255,255,0.02)";
    c.lineWidth = 1;
    for (var gx = 0; gx <= map.cols; gx += 4) {
      c.beginPath(); c.moveTo(gx * map.tileSize, 0); c.lineTo(gx * map.tileSize, off.height); c.stroke();
    }
    for (var gy = 0; gy <= map.rows; gy += 4) {
      c.beginPath(); c.moveTo(0, gy * map.tileSize); c.lineTo(off.width, gy * map.tileSize); c.stroke();
    }
    for (var y2 = 0; y2 < map.rows; y2++) {
      for (var x2 = 0; x2 < map.cols; x2++) {
        var t2 = Terrain.tileAtCell(map, x2, y2);
        if (t2 === Terrain.TILE.HILLS) {
          c.strokeStyle = "rgba(255,255,255,0.08)";
          c.lineWidth = 1;
          var cx = x2 * map.tileSize + map.tileSize / 2, cy = y2 * map.tileSize + map.tileSize / 2;
          c.beginPath(); c.arc(cx, cy, map.tileSize * 0.32, Math.PI, 0); c.stroke();
        } else if (t2 === Terrain.TILE.FOREST) {
          c.fillStyle = "rgba(90,160,110,0.55)";
          var cx2 = x2 * map.tileSize + map.tileSize * 0.5, cy2 = y2 * map.tileSize + map.tileSize * 0.55;
          c.beginPath(); c.arc(cx2, cy2, map.tileSize * 0.24, 0, Math.PI * 2); c.fill();
        } else if (t2 === Terrain.TILE.ROCKS) {
          c.fillStyle = "rgba(160,160,170,0.5)";
          c.beginPath();
          var bx = x2 * map.tileSize + map.tileSize * 0.5, by = y2 * map.tileSize + map.tileSize * 0.5;
          c.moveTo(bx - 6, by + 5); c.lineTo(bx - 1, by - 6); c.lineTo(bx + 6, by + 4); c.closePath(); c.fill();
        }
      }
    }
    this.terrainCache = off;
  };

  function shapeInfantry(ctx, r, colors) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.core;
    ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function shapeArcher(ctx, r, colors) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = colors.core;
    ctx.fill();
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, -0.9, 0.9);
    ctx.stroke();
  }

  function shapeHeavy(ctx, r, colors) {
    var s = r * 1.35;
    ctx.beginPath();
    ctx.moveTo(-s, -s); ctx.lineTo(s, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath();
    ctx.fillStyle = colors.core;
    ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function shapeCavalry(ctx, r, colors) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.7, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors.core;
    ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 1.7, 0); ctx.lineTo(r * 0.9, -r * 0.6); ctx.lineTo(r * 0.9, r * 0.6); ctx.closePath();
    ctx.fillStyle = colors.light;
    ctx.fill();
    ctx.restore();
  }

  function shapeTank(ctx, r, colors) {
    var w = r * 1.6, h = r * 1.2;
    ctx.fillStyle = colors.dark;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.strokeStyle = colors.core;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w, -h, w * 2, h * 2);
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w * 1.5, 0); ctx.stroke();
  }

  function shapeDrone(ctx, r, colors) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 1.1, r * 0.9); ctx.lineTo(-r * 1.1, r * 0.9); ctx.closePath();
    ctx.fillStyle = colors.core;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function shapeMedic(ctx, r, colors) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#eef3ea";
    ctx.fill();
    ctx.strokeStyle = colors.core;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = colors.core;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
    ctx.stroke();
  }

  var SHAPES = {
    infantry: shapeInfantry, archer: shapeArcher, heavy: shapeHeavy,
    cavalry: shapeCavalry, tank: shapeTank, drone: shapeDrone, medic: shapeMedic
  };

  var BASE_RADIUS = { infantry: 5.5, archer: 5, heavy: 7, cavalry: 6, tank: 7.5, drone: 4.5, medic: 5.5 };

  Renderer.prototype.drawUnit = function (ctx, u, selected, hovered) {
    var pos = this.worldToScreen(u.x, u.y);
    var z = this.camera.zoom;
    if (pos.x < -30 || pos.x > this.viewW + 30 || pos.y < -30 || pos.y > this.viewH + 30) return;
    var colors = TEAM_COLORS[u.team];
    var r = BASE_RADIUS[u.type] * Math.max(0.75, Math.min(1.4, z));

    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (u.type === "cavalry" || u.type === "drone") ctx.rotate(u.facing);

    if (u.state === "retreating") ctx.globalAlpha = 0.55;

    if (u.isVeteran) {
      ctx.save();
      ctx.rotate(u.type === "cavalry" || u.type === "drone" ? -u.facing : 0);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,210,80,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    if (u.hitFlash > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10;
    }

    var shapeFn = SHAPES[u.type] || shapeInfantry;
    shapeFn(ctx, r, colors);
    ctx.shadowBlur = 0;

    if (selected || hovered) {
      ctx.rotate(u.type === "cavalry" || u.type === "drone" ? -u.facing : 0);
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.3, 0, Math.PI * 2);
      ctx.strokeStyle = selected ? "#ffe066" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.setLineDash(selected ? [] : [3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    var showBar = selected || hovered || u.hp < u.maxHp * 0.999;
    if (showBar && z > 0.45) {
      var bw = 18 * Math.max(0.8, z);
      var bh = 3;
      var bx = pos.x - bw / 2;
      var by = pos.y - r - 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx, by, bw, bh);
      var frac = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = frac > 0.5 ? "#5ad16a" : frac > 0.22 ? "#f0c33c" : "#e4483f";
      ctx.fillRect(bx, by, bw * frac, bh);
    }

    if (u.state === "retreating" && z > 0.5) {
      ctx.fillStyle = "rgba(255,220,120,0.9)";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↓", pos.x, pos.y - r - 13);
    }
  };

  Renderer.prototype.drawProjectile = function (ctx, p) {
    var pos = this.worldToScreen(p.x, p.y);
    if (pos.x < -20 || pos.x > this.viewW + 20 || pos.y < -20 || pos.y > this.viewH + 20) return;
    var ang = Math.atan2(p.vy, p.vx);
    var colors = TEAM_COLORS[p.team];
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(ang);
    if (p.type === "arrow") {
      ctx.strokeStyle = colors.light;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = colors.light;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(5, -2.5); ctx.lineTo(5, 2.5); ctx.closePath(); ctx.fill();
    } else if (p.type === "shell") {
      ctx.shadowColor = colors.core;
      ctx.shadowBlur = 10;
      ctx.fillStyle = colors.light;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-2, 0); ctx.stroke();
    } else {
      ctx.fillStyle = colors.core;
      ctx.shadowColor = colors.core;
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  };

  Renderer.prototype.drawDeathMarker = function (ctx, m) {
    var pos = this.worldToScreen(m.x, m.y);
    if (pos.x < -20 || pos.x > this.viewW + 20 || pos.y < -20 || pos.y > this.viewH + 20) return;
    var frac = m.life / m.maxLife;
    var colors = TEAM_COLORS[m.team];
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, frac) * 0.9;
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1.5;
    var s = 5 * this.camera.zoom;
    ctx.beginPath();
    ctx.moveTo(pos.x - s, pos.y - s); ctx.lineTo(pos.x + s, pos.y + s);
    ctx.moveTo(pos.x + s, pos.y - s); ctx.lineTo(pos.x - s, pos.y + s);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawParticle = function (ctx, p) {
    var pos = this.worldToScreen(p.x, p.y);
    var colors = TEAM_COLORS[p.team];
    var frac = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (1 - frac) * 12 * this.camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawDeployZones = function (ctx, map) {
    var Terrain = global.BS.Terrain;
    var dzPx = Terrain.deployZoneCols() * map.tileSize;
    var topLeft = this.worldToScreen(0, 0);
    var bottomRightBlue = this.worldToScreen(dzPx, Terrain.CONFIG.WORLD_H);
    ctx.fillStyle = "rgba(74,163,255,0.10)";
    ctx.fillRect(topLeft.x, topLeft.y, bottomRightBlue.x - topLeft.x, bottomRightBlue.y - topLeft.y);
    ctx.strokeStyle = "rgba(74,163,255,0.4)";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRightBlue.x - topLeft.x, bottomRightBlue.y - topLeft.y);

    var redX0 = Terrain.CONFIG.WORLD_W - dzPx;
    var topLeftRed = this.worldToScreen(redX0, 0);
    var bottomRightRed = this.worldToScreen(Terrain.CONFIG.WORLD_W, Terrain.CONFIG.WORLD_H);
    ctx.fillStyle = "rgba(255,95,95,0.10)";
    ctx.fillRect(topLeftRed.x, topLeftRed.y, bottomRightRed.x - topLeftRed.x, bottomRightRed.y - topLeftRed.y);
    ctx.strokeStyle = "rgba(255,95,95,0.4)";
    ctx.strokeRect(topLeftRed.x, topLeftRed.y, bottomRightRed.x - topLeftRed.x, bottomRightRed.y - topLeftRed.y);
    ctx.setLineDash([]);
  };

  Renderer.prototype.render = function (battle, ui) {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (this.terrainCache) {
      var tl = this.worldToScreen(0, 0);
      var w = this.terrainCache.width * this.camera.zoom;
      var h = this.terrainCache.height * this.camera.zoom;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.terrainCache, tl.x, tl.y, w, h);
    }

    if (ui.phase === "deploy") {
      this.drawDeployZones(ctx, battle.map);
    }

    for (var d = 0; d < battle.deathMarkers.length; d++) {
      this.drawDeathMarker(ctx, battle.deathMarkers[d]);
    }

    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead) continue;
      this.drawUnit(ctx, u, ui.selectedId === u.id, ui.hoveredId === u.id);
    }
    for (var j = 0; j < battle.projectiles.length; j++) {
      this.drawProjectile(ctx, battle.projectiles[j]);
    }
    for (var k = 0; k < battle.particles.length; k++) {
      this.drawParticle(ctx, battle.particles[k]);
    }

    if (ui.placementPreview) {
      var pv = ui.placementPreview;
      var pos = this.worldToScreen(pv.x, pv.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10 * this.camera.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = pv.valid ? "rgba(120,255,150,0.8)" : "rgba(255,90,90,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  global.BS = global.BS || {};
  global.BS.Renderer = Renderer;
  global.BS.TEAM_COLORS = TEAM_COLORS;
})(window);
