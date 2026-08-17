(function (global) {
  "use strict";

  var DEFS = {
    infantry: {
      name: "Infantry", cost: 10, maxHp: 100, dmg: 13, range: 24, atkCd: 0.8,
      speed: 62, sight: 190, kind: "melee", flying: false, defense: 0.05,
      cssColorRole: "core"
    },
    archer: {
      name: "Archer", cost: 15, maxHp: 55, dmg: 10, range: 175, atkCd: 1.05,
      speed: 56, sight: 230, kind: "ranged", projectile: "arrow", flying: false,
      defense: 0, meleeDmg: 5, meleeRange: 20
    },
    heavy: {
      name: "Heavy Infantry", cost: 26, maxHp: 235, dmg: 19, range: 26, atkCd: 1.0,
      speed: 37, sight: 170, kind: "melee", flying: false, defense: 0.3
    },
    cavalry: {
      name: "Cavalry", cost: 32, maxHp: 140, dmg: 24, range: 26, atkCd: 0.85,
      speed: 122, sight: 230, kind: "melee", flying: false, defense: 0.05,
      chargeMult: 1.9, chargeMinFrac: 0.55, fatigueAfter: 4.5, fatigueMult: 0.6
    },
    tank: {
      name: "Tank", cost: 55, maxHp: 330, dmg: 44, range: 205, atkCd: 2.6,
      speed: 22, sight: 260, kind: "ranged", projectile: "shell", flying: false,
      defense: 0.15
    },
    drone: {
      name: "Drone", cost: 30, maxHp: 38, dmg: 8, range: 145, atkCd: 0.65,
      speed: 96, sight: 250, kind: "ranged", projectile: "drone", flying: true,
      defense: 0
    },
    medic: {
      name: "Medic", cost: 22, maxHp: 75, dmg: 4, range: 22, atkCd: 1.2,
      speed: 58, sight: 210, kind: "support", flying: false, defense: 0,
      healRange: 85, healRate: 9
    }
  };

  var TYPE_ORDER = ["infantry", "archer", "heavy", "cavalry", "tank", "drone", "medic"];

  var _id = 1;
  function nextId() { return _id++; }

  function create(type, team, x, y) {
    var def = DEFS[type];
    var u = {
      id: nextId(),
      type: type,
      team: team,
      x: x, y: y,
      vx: 0, vy: 0,
      facing: team === "blue" ? 0 : Math.PI,
      hp: def.maxHp,
      maxHp: def.maxHp,
      dmg: def.dmg,
      range: def.range,
      atkCdMax: def.atkCd,
      atkCdTimer: Math.random() * def.atkCd,
      speed: def.speed,
      sight: def.sight,
      kind: def.kind,
      flying: !!def.flying,
      defense: def.defense || 0,
      morale: 80 + Math.random() * 15,
      state: "idle",
      targetId: null,
      moveTargetX: null,
      moveTargetY: null,
      lastScan: -999,
      engagedSince: -1,
      retreatUntil: 0,
      kills: 0,
      damageDealt: 0,
      isVeteran: false,
      flashTimer: 0,
      spawnX: x, spawnY: y,
      hitFlash: 0,
      healTargetId: null,
      dead: false,
      deathTime: 0,
      moveSpeedAtTick: 0
    };
    return u;
  }

  global.BS = global.BS || {};
  global.BS.Units = {
    DEFS: DEFS,
    TYPE_ORDER: TYPE_ORDER,
    create: create
  };
})(window);
