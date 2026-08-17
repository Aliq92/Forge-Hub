(function (global) {
  "use strict";

  var Terrain, AI, Units;

  var SCAN_INTERVAL = 0.4;
  var MORALE_REGEN = 3.5;
  var LOW_HP_MORALE_FRAC = 0.25;

  function Battle(map) {
    Terrain = global.BS.Terrain;
    AI = global.BS.AI;
    Units = global.BS.Units;

    this.map = map;
    this.units = [];
    this.projectiles = [];
    this.particles = [];
    this.deathMarkers = [];
    this.time = 0;
    this.paused = true;
    this.started = false;
    this.ended = false;
    this.speed = 1;
    this.log = [];
    this._logFlags = {};
    this.commander = { blue: "balanced", red: "balanced" };
    this.stats = {
      blue: { alive: 0, dead: 0, strength: 0, morale: 100, damageDealt: 0, kills: 0 },
      red: { alive: 0, dead: 0, strength: 0, morale: 100, damageDealt: 0, kills: 0 }
    };
    this.totalProjectiles = 0;
    this.winner = null;
    this._grid = null;
  }

  Battle.prototype.addUnit = function (type, team, x, y) {
    var u = Units.create(type, team, x, y);
    this.units.push(u);
    return u;
  };

  Battle.prototype.removeUnitAt = function (x, y, radius, team) {
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.dead) continue;
      if (team && u.team !== team) continue;
      var dx = u.x - x, dy = u.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        this.units.splice(i, 1);
        return true;
      }
    }
    return false;
  };

  Battle.prototype.clearTeam = function (team) {
    this.units = this.units.filter(function (u) { return u.team !== team; });
  };

  Battle.prototype.clearAll = function () {
    this.units = [];
    this.projectiles = [];
    this.particles = [];
  };

  Battle.prototype.pointsSpent = function (team) {
    var sum = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.team === team) sum += Units.DEFS[u.type].cost;
    }
    return sum;
  };

  Battle.prototype.log_ = function (msg) {
    this.log.push({ t: this.time, msg: msg });
    if (this.log.length > 200) this.log.shift();
  };

  Battle.prototype.logOnce = function (key, msg) {
    if (this._logFlags[key]) return;
    this._logFlags[key] = true;
    this.log_(msg);
  };

  Battle.prototype.start = function () {
    this.started = true;
    this.paused = false;
    this.ended = false;
    this.time = 0;
    this._logFlags = {};
    this.log = [];
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      u.state = "idle";
      u.targetId = null;
      u._targetRef = null;
      u.lastScan = -999;
    }
    this.log_("Battle started. Blue " + this.countAlive("blue") + " units vs Red " + this.countAlive("red") + " units.");
  };

  Battle.prototype.countAlive = function (team) {
    var c = 0;
    for (var i = 0; i < this.units.length; i++) {
      if (!this.units[i].dead && this.units[i].team === team) c++;
    }
    return c;
  };

  Battle.prototype.countCombatCapable = function (team) {
    var c = 0;
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (!u.dead && u.team === team && u.type !== "medic") c++;
    }
    return c;
  };

  function applyDamage(battle, unit, dmg, attacker, isRanged) {
    var tile = Terrain.tileAt(battle.map, unit.x, unit.y);
    if (isRanged) dmg *= (1 - Terrain.rangedDefenseBonus(tile));
    dmg *= (1 - unit.defense);
    dmg = Math.max(0.5, dmg);
    unit.hp -= dmg;
    unit.hitFlash = 0.2;
    unit.morale -= Math.min(14, dmg * 0.18);
    if (attacker) {
      var teamKey = attacker.team;
      battle.stats[teamKey].damageDealt += dmg;
      attacker.damageDealt = (attacker.damageDealt || 0) + dmg;
    }
    if (unit.hp <= 0 && !unit.dead) {
      killUnit(battle, unit, attacker);
    }
  }

  function killUnit(battle, unit, attacker) {
    unit.hp = 0;
    unit.dead = true;
    unit.state = "dead";
    unit.deathTime = battle.time;
    battle.deathMarkers.push({ x: unit.x, y: unit.y, team: unit.team, type: unit.type, life: 1.6, maxLife: 1.6 });
    if (battle.deathMarkers.length > 400) battle.deathMarkers.shift();
    battle.stats[unit.team].dead++;
    if (attacker && !attacker.dead) {
      attacker.kills++;
      battle.stats[attacker.team].kills++;
      if (attacker.kills >= 5) attacker.isVeteran = true;
    }
    var grid = battle._grid;
    if (grid) {
      AI.forEachNear(grid, unit.x, unit.y, 130, function (o) {
        if (!o.dead && o.team === unit.team && o !== unit) {
          o.morale -= 7;
        }
      });
    }
    if (unit.type === "tank") {
      battle.log_((unit.team === "blue" ? "Blue" : "Red") + " tank destroyed.");
    }
    checkCasualtyMilestones(battle, unit.team);
  }

  function checkCasualtyMilestones(battle, team) {
    var total = battle.stats[team].dead + battle.countAlive(team);
    if (total <= 0) return;
    var pct = battle.stats[team].dead / total;
    var teamName = team === "blue" ? "Blue" : "Red";
    if (pct >= 0.25) battle.logOnce(team + "_25", teamName + " has taken heavy losses (25%).");
    if (pct >= 0.5) battle.logOnce(team + "_50", teamName + " has lost 50% of its forces.");
    if (pct >= 0.75) battle.logOnce(team + "_75", teamName + " is on the verge of collapse.");
  }

  function spawnProjectile(battle, source, target) {
    var def = Units.DEFS[source.type];
    var type = def.projectile || "arrow";
    var speedMap = { arrow: 380, shell: 300, drone: 430 };
    var dx = target.x - source.x, dy = target.y - source.y;
    var leadT = Math.sqrt(dx * dx + dy * dy) / speedMap[type];
    var aimX = target.x + target.vx * leadT * 0.5;
    var aimY = target.y + target.vy * leadT * 0.5;
    var ang = Math.atan2(aimY - source.y, aimX - source.x);
    var spd = speedMap[type];
    var p = {
      id: battle.totalProjectiles++,
      team: source.team,
      type: type,
      x: source.x, y: source.y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      dmg: source.dmg,
      sourceId: source.id,
      _sourceRef: source,
      targetId: target.id,
      _targetRef: target,
      life: 3.5,
      dead: false
    };
    battle.projectiles.push(p);
  }

  function tryAttack(battle, unit, target) {
    if (unit.atkCdTimer > 0) return;
    var d2 = AI.dist2(unit.x, unit.y, target.x, target.y);
    var effRange = unit.range;
    var tile = Terrain.tileAt(battle.map, unit.x, unit.y);
    if (unit.kind === "ranged") effRange *= (1 + Terrain.rangeBonus(tile));
    if (d2 > effRange * effRange) return;

    unit.atkCdTimer = Units.DEFS[unit.type].atkCd;

    if (unit.kind === "melee") {
      var dmg = unit.dmg;
      if (unit.type === "cavalry") {
        var spd = Math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
        var def = Units.DEFS.cavalry;
        if (spd > unit.speed * def.chargeMinFrac && unit.engagedSince < 0) {
          dmg *= def.chargeMult;
        }
        if (unit.engagedSince >= 0 && (battle.time - unit.engagedSince) > def.fatigueAfter) {
          dmg *= def.fatigueMult;
        }
        if (unit.engagedSince < 0) unit.engagedSince = battle.time;
      }
      applyDamage(battle, target, dmg, unit, false);
      unit.state = "attacking";
    } else if (unit.kind === "ranged") {
      spawnProjectile(battle, unit, target);
      unit.state = "attacking";
    } else if (unit.type === "medic") {
      unit.state = "attacking";
    }
  }

  function tryHeal(battle, unit, ally, dt) {
    var d2 = AI.dist2(unit.x, unit.y, ally.x, ally.y);
    var def = Units.DEFS.medic;
    if (d2 > def.healRange * def.healRange) return false;
    ally.hp = Math.min(ally.maxHp, ally.hp + def.healRate * dt);
    unit.state = "attacking";
    return true;
  }

  function updateProjectiles(battle, dt) {
    var arr = battle.projectiles;
    for (var i = arr.length - 1; i >= 0; i--) {
      var p = arr[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      var hit = false;

      var tgt = p._targetRef;
      if (tgt && !tgt.dead) {
        var d2 = AI.dist2(p.x, p.y, tgt.x, tgt.y);
        if (d2 <= 14 * 14) {
          applyDamage(battle, tgt, p.dmg, p._sourceRef && !p._sourceRef.dead ? p._sourceRef : null, true);
          spawnImpact(battle, p.x, p.y, p.team);
          hit = true;
        }
      }

      if (!hit && (p.life <= 0 ||
        p.x < -20 || p.y < -20 || p.x > Terrain.CONFIG.WORLD_W + 20 || p.y > Terrain.CONFIG.WORLD_H + 20)) {
        hit = true;
      }

      if (hit) arr.splice(i, 1);
    }
  }

  function spawnImpact(battle, x, y, team) {
    battle.particles.push({ x: x, y: y, life: 0.35, maxLife: 0.35, team: team });
    if (battle.particles.length > 300) battle.particles.shift();
  }

  function updateParticles(battle, dt) {
    var arr = battle.particles;
    for (var i = arr.length - 1; i >= 0; i--) {
      arr[i].life -= dt;
      if (arr[i].life <= 0) arr.splice(i, 1);
    }
  }

  function updateDeathMarkers(battle, dt) {
    var arr = battle.deathMarkers;
    for (var i = arr.length - 1; i >= 0; i--) {
      arr[i].life -= dt;
      if (arr[i].life <= 0) arr.splice(i, 1);
    }
  }

  function updateMorale(battle, unit, dt, grid) {
    if (unit.hp / unit.maxHp < LOW_HP_MORALE_FRAC) unit.morale -= 6 * dt;
    else unit.morale += MORALE_REGEN * dt;

    var enemyCount = 0, allyCount = 0;
    AI.forEachNear(grid, unit.x, unit.y, 110, function (o) {
      if (o.dead) return;
      if (o.team === unit.team) allyCount++; else enemyCount++;
    });
    if (enemyCount > allyCount * 1.6 && enemyCount >= 2) unit.morale -= 4 * dt;

    unit.morale = Math.max(0, Math.min(100, unit.morale));
  }

  function updateFactionMorale(battle) {
    var sums = { blue: 0, red: 0 };
    var counts = { blue: 0, red: 0 };
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead) continue;
      sums[u.team] += u.morale;
      counts[u.team]++;
    }
    ["blue", "red"].forEach(function (team) {
      battle.stats[team].morale = counts[team] > 0 ? sums[team] / counts[team] : 0;
    });
    if (battle.stats.blue.morale < 25 && counts.blue > 3) battle.logOnce("blue_moralebreak", "Blue morale is breaking.");
    if (battle.stats.red.morale < 25 && counts.red > 3) battle.logOnce("red_moralebreak", "Red morale is breaking.");
  }

  function updateUnitAI(battle, unit, dt, grid, now) {
    if (unit.dead) return;

    if (unit.targetId != null) {
      var t = unit._targetRef;
      if (!t || t.dead) { unit.targetId = null; unit._targetRef = null; unit.engagedSince = -1; }
    }
    if (unit.healTargetId != null) {
      var ht = unit._healRef;
      if (!ht || ht.dead || ht.hp >= ht.maxHp) { unit.healTargetId = null; unit._healRef = null; }
    }

    var cmdKey = battle.commander[unit.team] || "balanced";
    var cmd = AI.COMMANDER_DEFAULTS[cmdKey];

    var wasRetreating = unit.state === "retreating";
    var shouldRetreat = unit.morale < cmd.retreatThreshold || (unit.hp / unit.maxHp < 0.12 && unit.morale < 50);

    if (shouldRetreat && !wasRetreating) {
      unit.state = "retreating";
      unit.retreatUntil = now + 2.5 + Math.random() * 2.5;
      var nearestEnemy = null, nd = Infinity;
      AI.forEachNear(grid, unit.x, unit.y, 220, function (o) {
        if (o.dead || o.team === unit.team) return;
        var d2 = AI.dist2(unit.x, unit.y, o.x, o.y);
        if (d2 < nd) { nd = d2; nearestEnemy = o; }
      });
      unit._nearestThreatRef = nearestEnemy;
    } else if (wasRetreating) {
      if (now > unit.retreatUntil && unit.morale > cmd.retreatThreshold + 15) {
        unit.state = "idle";
        unit.targetId = null;
        unit._targetRef = null;
      } else {
        unit.state = "retreating";
      }
    }

    if (unit.state !== "retreating") {
      if (now - unit.lastScan > SCAN_INTERVAL + Math.random() * 0.15) {
        unit.lastScan = now;
        if (unit.type === "medic") {
          if (!unit._healRef) {
            var h = AI.pickHealTarget(unit, grid);
            unit.healTargetId = h ? h.id : null;
            unit._healRef = h;
          }
        } else {
          if (!unit._targetRef) {
            var picked = AI.pickTarget(unit, grid, cmd);
            unit.targetId = picked ? picked.id : null;
            unit._targetRef = picked;
            if (!picked) unit.engagedSince = -1;
          }
        }
      }
    }

    AI.steer(unit, dt, battle.map, grid, battle.time, cmd);
    AI.moveWithCollision(unit, dt, battle.map);

    if (unit.state !== "retreating") {
      if (unit.type === "medic") {
        if (unit._healRef && !unit._healRef.dead) {
          tryHeal(battle, unit, unit._healRef, dt);
        }
        unit.state = unit._healRef ? unit.state : (Math.abs(unit.vx) + Math.abs(unit.vy) > 2 ? "moving" : "idle");
      } else if (unit._targetRef) {
        var target = unit._targetRef;
        var d2t = AI.dist2(unit.x, unit.y, target.x, target.y);
        var effRange = unit.range;
        if (unit.kind === "ranged") {
          var tile = Terrain.tileAt(battle.map, unit.x, unit.y);
          effRange *= (1 + Terrain.rangeBonus(tile));
        }
        if (d2t <= effRange * effRange) {
          tryAttack(battle, unit, target);
          if (unit.state !== "attacking") unit.state = "engaging";
        } else {
          unit.state = "moving";
          if (unit.type === "cavalry") unit.engagedSince = -1;
        }
      } else {
        unit.state = (Math.abs(unit.vx) + Math.abs(unit.vy) > 2) ? "moving" : "idle";
      }
    }

    if (unit.atkCdTimer > 0) unit.atkCdTimer -= dt;
    if (unit.hitFlash > 0) unit.hitFlash -= dt;

    updateMorale(battle, unit, dt, grid);
  }

  Battle.prototype.tick = function (dt) {
    if (this.paused || this.ended) return;
    this.time += dt;
    var grid = AI.buildGrid(this.units);
    this._grid = grid;
    var now = this.time;

    for (var i = 0; i < this.units.length; i++) {
      updateUnitAI(this, this.units[i], dt, grid, now);
    }

    updateProjectiles(this, dt);
    updateParticles(this, dt);
    updateDeathMarkers(this, dt);
    updateFactionMorale(this);

    var blueAlive = this.countCombatCapable("blue");
    var redAlive = this.countCombatCapable("red");
    this.stats.blue.alive = this.countAlive("blue");
    this.stats.red.alive = this.countAlive("red");

    if (this.started && !this.ended && (blueAlive === 0 || redAlive === 0)) {
      this.ended = true;
      this.paused = true;
      this.winner = blueAlive === 0 && redAlive === 0 ? "draw" : (blueAlive === 0 ? "red" : "blue");
      this.log_(this.winner === "draw" ? "Battle ended in a draw." : ((this.winner === "blue" ? "Blue" : "Red") + " Army victorious."));
    }
  };

  global.BS = global.BS || {};
  global.BS.Battle = Battle;
})(window);
