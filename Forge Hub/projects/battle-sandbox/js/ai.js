(function (global) {
  "use strict";

  var Terrain = null;
  var GRID_CELL = 64;

  function buildGrid(units) {
    var grid = { cell: GRID_CELL, cells: new Map(), allUnits: units };
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.dead) continue;
      var key = cellKey(grid, u.x, u.y);
      var arr = grid.cells.get(key);
      if (!arr) { arr = []; grid.cells.set(key, arr); }
      arr.push(u);
    }
    return grid;
  }

  function findNearestEnemyAnywhere(unit, grid) {
    var all = grid.allUnits;
    var best = null, bestD2 = Infinity;
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      if (o.dead || o.team === unit.team) continue;
      var d2 = dist2(unit.x, unit.y, o.x, o.y);
      if (d2 < bestD2) { bestD2 = d2; best = o; }
    }
    return best;
  }

  function cellKey(grid, x, y) {
    var cx = Math.floor(x / grid.cell);
    var cy = Math.floor(y / grid.cell);
    return cx + "," + cy;
  }

  function forEachNear(grid, x, y, radius, cb) {
    var cx0 = Math.floor((x - radius) / grid.cell);
    var cx1 = Math.floor((x + radius) / grid.cell);
    var cy0 = Math.floor((y - radius) / grid.cell);
    var cy1 = Math.floor((y + radius) / grid.cell);
    for (var cx = cx0; cx <= cx1; cx++) {
      for (var cy = cy0; cy <= cy1; cy++) {
        var arr = grid.cells.get(cx + "," + cy);
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) cb(arr[i]);
      }
    }
  }

  function dist2(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  }

  var COMMANDER_DEFAULTS = {
    aggressive: { retreatThreshold: 12, aggroMult: 1.35, advanceBias: 55, protectBonus: 0 },
    balanced: { retreatThreshold: 22, aggroMult: 1.0, advanceBias: 20, protectBonus: 0 },
    defensive: { retreatThreshold: 32, aggroMult: 0.75, advanceBias: 0, protectBonus: 0 },
    ranged_focus: { retreatThreshold: 24, aggroMult: 0.95, advanceBias: 10, protectBonus: 140 }
  };

  function threatScoreFor(type) {
    switch (type) {
      case "tank": return 5;
      case "cavalry": return 4;
      case "heavy": return 3;
      case "archer": return 2.5;
      case "drone": return 2;
      case "infantry": return 2;
      case "medic": return 1;
      default: return 1;
    }
  }

  function findEnemies(unit, grid, radius) {
    var out = [];
    forEachNear(grid, unit.x, unit.y, radius, function (o) {
      if (o.dead || o.team === unit.team) return;
      var d2 = dist2(unit.x, unit.y, o.x, o.y);
      if (d2 <= radius * radius) out.push({ u: o, d2: d2 });
    });
    return out;
  }

  function findAllies(unit, grid, radius) {
    var out = [];
    forEachNear(grid, unit.x, unit.y, radius, function (o) {
      if (o.dead || o.team !== unit.team || o === unit) return;
      var d2 = dist2(unit.x, unit.y, o.x, o.y);
      if (d2 <= radius * radius) out.push({ u: o, d2: d2 });
    });
    return out;
  }

  function scoreTarget(unit, enemy, d2, cmd, grid) {
    var d = Math.sqrt(d2);
    var hpFrac = enemy.hp / enemy.maxHp;
    var score = 1000 - d * 1.4;
    score += (1 - hpFrac) * 90;
    score += threatScoreFor(enemy.type) * 8;

    switch (unit.type) {
      case "cavalry":
        if (enemy.type === "archer" || enemy.type === "drone" || enemy.type === "medic" || enemy.type === "tank") {
          score += 160;
        }
        if (enemy.kind === "melee") score -= 40;
        break;
      case "heavy":
        score += Math.max(0, 260 - d) * 0.6;
        if (enemy.kind === "melee") score += 50;
        break;
      case "tank":
        score += threatScoreFor(enemy.type) * 30;
        if (d > unit.range * 1.4) score -= 200;
        break;
      case "archer":
        if (enemy.kind === "melee" && d < 90) score -= 70;
        break;
      case "drone":
        if (hpFrac < 0.5) score += 60;
        if (enemy.kind === "ranged" || enemy.type === "medic") score += 40;
        break;
      default:
        break;
    }

    if (cmd.protectBonus > 0) {
      var nearFriendlyRanged = false;
      forEachNear(grid, enemy.x, enemy.y, 90, function (o) {
        if (!o.dead && o.team === unit.team && (o.kind === "ranged" || o.type === "medic")) nearFriendlyRanged = true;
      });
      if (nearFriendlyRanged) score += cmd.protectBonus;
    }
    return score;
  }

  function pickTarget(unit, grid, cmd) {
    var radius = unit.sight * cmd.aggroMult;
    var candidates = findEnemies(unit, grid, radius);
    if (!candidates.length) {
      return findNearestEnemyAnywhere(unit, grid);
    }
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var s = scoreTarget(unit, c.u, c.d2, cmd, grid);
      if (s > bestScore) { bestScore = s; best = c.u; }
    }
    return best;
  }

  function pickHealTarget(unit, grid) {
    var allies = findAllies(unit, grid, unit.sight);
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < allies.length; i++) {
      var a = allies[i].u;
      if (a.type === "medic") continue;
      var frac = a.hp / a.maxHp;
      if (frac >= 0.98) continue;
      var d = Math.sqrt(allies[i].d2);
      var score = (1 - frac) * 200 - d * 0.5;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  function allyCentroid(unit, grid) {
    var allies = findAllies(unit, grid, 260);
    if (!allies.length) return null;
    var sx = 0, sy = 0;
    for (var i = 0; i < allies.length; i++) { sx += allies[i].u.x; sy += allies[i].u.y; }
    return { x: sx / allies.length, y: sy / allies.length };
  }

  function normalize(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.0001) return { x: 0, y: 0, len: 0 };
    return { x: dx / len, y: dy / len, len: len };
  }

  function steer(unit, dt, map, grid, battleTime, cmd) {
    Terrain = global.BS.Terrain;
    var target = unit._targetRef;
    var desiredX = 0, desiredY = 0;
    var wantsToStop = false;

    if (unit.state === "retreating") {
      var threat = target || unit._nearestThreatRef;
      var awayX = unit.x, awayY = unit.y;
      if (threat) {
        var n = normalize(unit.x - threat.x, unit.y - threat.y);
        awayX = unit.x + n.x * 100;
        awayY = unit.y + n.y * 100;
      } else {
        var homeX = unit.team === "blue" ? -400 : Terrain.CONFIG.WORLD_W + 400;
        awayX = homeX; awayY = unit.y;
      }
      var d = normalize(awayX - unit.x, awayY - unit.y);
      desiredX = d.x; desiredY = d.y;
    } else if (unit.type === "medic") {
      if (target) {
        var dm = normalize(target.x - unit.x, target.y - unit.y);
        var distToTarget = Math.sqrt(dist2(unit.x, unit.y, target.x, target.y));
        if (distToTarget > unit.range * 0.7) { desiredX = dm.x; desiredY = dm.y; }
        else wantsToStop = true;
      } else {
        var centroid = allyCentroid(unit, grid);
        if (centroid) {
          var distC = Math.sqrt(dist2(unit.x, unit.y, centroid.x, centroid.y));
          if (distC > 70) {
            var dc = normalize(centroid.x - unit.x, centroid.y - unit.y);
            desiredX = dc.x; desiredY = dc.y;
          } else wantsToStop = true;
        } else wantsToStop = true;
      }
    } else if (target) {
      var dEnemy = Math.sqrt(dist2(unit.x, unit.y, target.x, target.y));
      if (unit.kind === "melee") {
        if (dEnemy > unit.range * 0.85) {
          var dmv = normalize(target.x - unit.x, target.y - unit.y);
          desiredX = dmv.x; desiredY = dmv.y;
        } else wantsToStop = true;
      } else {
        var optMin = unit.range * 0.45;
        var optMax = unit.range * 0.9;
        var kiteThreshold = (unit.type === "archer" || unit.type === "drone") ? 70 : 0;
        var meleeThreatClose = false;
        if (kiteThreshold > 0) {
          forEachNear(grid, unit.x, unit.y, kiteThreshold, function (o) {
            if (!o.dead && o.team !== unit.team && o.kind === "melee") meleeThreatClose = true;
          });
        }
        if (meleeThreatClose) {
          var away = normalize(unit.x - target.x, unit.y - target.y);
          desiredX = away.x; desiredY = away.y;
        } else if (dEnemy < optMin) {
          var awy = normalize(unit.x - target.x, unit.y - target.y);
          desiredX = awy.x * 0.6; desiredY = awy.y * 0.6;
        } else if (dEnemy > optMax) {
          var tow = normalize(target.x - unit.x, target.y - unit.y);
          desiredX = tow.x; desiredY = tow.y;
        } else wantsToStop = true;
      }
    } else {
      var advBias = cmd.advanceBias;
      if (advBias > 0) {
        var fx = unit.team === "blue" ? 1 : -1;
        desiredX = fx * 0.5;
        desiredY = (Math.sin(unit.id * 13.37 + battleTime * 0.05) * 0.25);
      } else {
        wantsToStop = true;
      }
    }

    var sepX = 0, sepY = 0, sepCount = 0;
    forEachNear(grid, unit.x, unit.y, 26, function (o) {
      if (o === unit || o.dead) return;
      var dd2 = dist2(unit.x, unit.y, o.x, o.y);
      if (dd2 < 26 * 26 && dd2 > 0.01) {
        var dd = Math.sqrt(dd2);
        sepX += (unit.x - o.x) / dd;
        sepY += (unit.y - o.y) / dd;
        sepCount++;
      }
    });
    if (sepCount > 0) { sepX /= sepCount; sepY /= sepCount; }

    var finalX = desiredX * 0.72 + sepX * 0.55;
    var finalY = desiredY * 0.72 + sepY * 0.55;
    var fn = normalize(finalX, finalY);

    if (wantsToStop && sepCount === 0) {
      unit.vx *= 0.8; unit.vy *= 0.8;
      return;
    }

    var tile = Terrain.tileAt(map, unit.x, unit.y);
    var speedMul = Terrain.speedMult(tile, unit.flying);
    var spd = unit.speed * (speedMul <= 0 ? 0 : speedMul);
    unit.moveSpeedAtTick = spd;

    var targetVx = fn.x * spd;
    var targetVy = fn.y * spd;
    unit.vx += (targetVx - unit.vx) * Math.min(1, dt * 6);
    unit.vy += (targetVy - unit.vy) * Math.min(1, dt * 6);
  }

  function moveWithCollision(unit, dt, map) {
    Terrain = global.BS.Terrain;
    var nx = unit.x + unit.vx * dt;
    var ny = unit.y + unit.vy * dt;
    var W = Terrain.CONFIG.WORLD_W, H = Terrain.CONFIG.WORLD_H;
    nx = Math.max(4, Math.min(W - 4, nx));
    ny = Math.max(4, Math.min(H - 4, ny));

    var tileX = Terrain.tileAt(map, nx, unit.y);
    if (Terrain.isPassable(tileX, unit.flying)) {
      unit.x = nx;
    } else {
      unit.vx = 0;
    }
    var tileY = Terrain.tileAt(map, unit.x, ny);
    if (Terrain.isPassable(tileY, unit.flying)) {
      unit.y = ny;
    } else {
      unit.vy = 0;
    }
    if (Math.abs(unit.vx) > 1 || Math.abs(unit.vy) > 1) {
      unit.facing = Math.atan2(unit.vy, unit.vx);
    }
  }

  global.BS = global.BS || {};
  global.BS.AI = {
    buildGrid: buildGrid,
    forEachNear: forEachNear,
    findEnemies: findEnemies,
    findAllies: findAllies,
    pickTarget: pickTarget,
    pickHealTarget: pickHealTarget,
    steer: steer,
    moveWithCollision: moveWithCollision,
    COMMANDER_DEFAULTS: COMMANDER_DEFAULTS,
    dist2: dist2
  };
})(window);
