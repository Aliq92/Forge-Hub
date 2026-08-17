(function () {
  "use strict";

  var Terrain = window.BS.Terrain;
  var Units = window.BS.Units;
  var Battle = window.BS.Battle;
  var Renderer = window.BS.Renderer;
  var TEAM_COLORS = window.BS.TEAM_COLORS;

  var canvas = document.getElementById("battlefield");
  var renderer = new Renderer(canvas);

  var ui = {
    faction: "blue",
    unitType: "infantry",
    tool: "place",
    budgetMode: "balanced",
    budgetCap: 500,
    sandboxEditing: false,
    selectedId: null,
    hoveredId: null,
    painting: false,
    erasing: false,
    lastPlacePos: null,
    placementPreview: null,
    panning: false,
    panLast: null,
    phase: "deploy"
  };

  var currentMapType = "random";
  var map = Terrain.generate(currentMapType);
  var battle = new Battle(map);
  renderer.buildTerrainCache(map);

  var cameraUserAdjusted = false;

  function resizeCanvas() {
    var rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    renderer.resize(rect.width, rect.height);
    if (!cameraUserAdjusted) {
      renderer.fitToWorld();
    } else {
      renderer.clampCamera();
    }
  }
  window.addEventListener("resize", resizeCanvas);
  if (window.ResizeObserver) {
    new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
  }
  resizeCanvas();
  renderer.fitToWorld();

  var $ = function (id) { return document.getElementById(id); };

  var btnStart = $("btnStart"), btnPause = $("btnPause"), btnResume = $("btnResume"),
    btnReset = $("btnReset"), btnClearAll = $("btnClearAll"), btnClearTeam = $("btnClearTeam"),
    btnNewMap = $("btnNewMap"), speedSelect = $("speedSelect"), sandboxEditChk = $("sandboxEdit"),
    phaseTag = $("phaseTag"), clockTag = $("clockTag"), mapSelect = $("mapSelect"),
    factionBlueBtn = $("factionBlue"), factionRedBtn = $("factionRed"), budgetLabel = $("budgetLabel"),
    modeBalancedBtn = $("modeBalanced"), modeSandboxBtn = $("modeSandbox"), budgetCapInput = $("budgetCap"),
    unitPalette = $("unitPalette"), toolPlace = $("toolPlace"), toolErase = $("toolErase"),
    presetSelect = $("presetSelect"), btnLoadPreset = $("btnLoadPreset"),
    commanderBlue = $("commanderBlue"), commanderRed = $("commanderRed"),
    camZoomIn = $("camZoomIn"), camZoomOut = $("camZoomOut"), camFit = $("camFit"), camReset = $("camReset"),
    battleLog = $("battleLog"), endScreen = $("endScreen"), endTitle = $("endTitle"),
    endStats = $("endStats"), btnEndClose = $("btnEndClose"), statsPanel = $("statsPanel"),
    inspectorPanel = $("inspectorPanel");

  function buildPalette() {
    unitPalette.innerHTML = "";
    Units.TYPE_ORDER.forEach(function (type) {
      var def = Units.DEFS[type];
      var card = document.createElement("div");
      card.className = "unit-card" + (type === ui.unitType ? " active" : "");
      card.dataset.type = type;
      var colorHex = TEAM_COLORS.blue.core;
      card.innerHTML =
        '<div class="swatch" style="background:' + colorHex + '"></div>' +
        '<div class="info"><div class="name">' + def.name + '</div>' +
        '<div class="cost">Cost ' + def.cost + '</div></div>';
      card.addEventListener("click", function () {
        ui.unitType = type;
        refreshPalette();
      });
      unitPalette.appendChild(card);
    });
  }
  function refreshPalette() {
    var cards = unitPalette.querySelectorAll(".unit-card");
    cards.forEach(function (c) {
      c.classList.toggle("active", c.dataset.type === ui.unitType);
    });
  }
  buildPalette();

  function setPlacementEnabled(enabled) {
    unitPalette.style.opacity = enabled ? 1 : 0.4;
    unitPalette.style.pointerEvents = enabled ? "auto" : "none";
    toolPlace.style.opacity = enabled ? 1 : 0.4;
    toolErase.style.opacity = enabled ? 1 : 0.4;
    toolPlace.style.pointerEvents = enabled ? "auto" : "none";
    toolErase.style.pointerEvents = enabled ? "auto" : "none";
  }

  function placementEnabled() {
    return !battle.started || ui.sandboxEditing;
  }

  factionBlueBtn.addEventListener("click", function () {
    ui.faction = "blue";
    factionBlueBtn.classList.add("active");
    factionRedBtn.classList.remove("active");
    updateBudgetLabel();
  });
  factionRedBtn.addEventListener("click", function () {
    ui.faction = "red";
    factionRedBtn.classList.add("active");
    factionBlueBtn.classList.remove("active");
    updateBudgetLabel();
  });

  modeBalancedBtn.addEventListener("click", function () {
    ui.budgetMode = "balanced";
    modeBalancedBtn.classList.add("active");
    modeSandboxBtn.classList.remove("active");
    updateBudgetLabel();
  });
  modeSandboxBtn.addEventListener("click", function () {
    ui.budgetMode = "sandbox";
    modeSandboxBtn.classList.add("active");
    modeBalancedBtn.classList.remove("active");
    updateBudgetLabel();
  });
  budgetCapInput.addEventListener("input", function () {
    ui.budgetCap = Math.max(0, parseInt(budgetCapInput.value, 10) || 0);
    updateBudgetLabel();
  });

  toolPlace.addEventListener("click", function () {
    ui.tool = "place";
    toolPlace.classList.add("active");
    toolErase.classList.remove("active");
  });
  toolErase.addEventListener("click", function () {
    ui.tool = "erase";
    toolErase.classList.add("active");
    toolPlace.classList.remove("active");
  });

  function updateBudgetLabel() {
    var spent = battle.pointsSpent(ui.faction);
    var factionLabel = ui.faction === "blue" ? "Blue" : "Red";
    if (ui.budgetMode === "sandbox") {
      budgetLabel.textContent = factionLabel + " Points: " + spent + " (unlimited)";
      budgetLabel.style.color = "";
    } else {
      budgetLabel.textContent = factionLabel + " Points: " + spent + " / " + ui.budgetCap;
      budgetLabel.style.color = spent > ui.budgetCap ? "var(--bad)" : "";
    }
  }

  commanderBlue.addEventListener("change", function () { battle.commander.blue = commanderBlue.value; });
  commanderRed.addEventListener("change", function () { battle.commander.red = commanderRed.value; });

  function regenerateMap(type) {
    currentMapType = type;
    map = Terrain.generate(type);
    battle = new Battle(map);
    battle.commander.blue = commanderBlue.value;
    battle.commander.red = commanderRed.value;
    renderer.buildTerrainCache(map);
    ui.selectedId = null;
    updateBudgetLabel();
  }

  mapSelect.addEventListener("change", function () {
    regenerateMap(mapSelect.value);
  });
  btnNewMap.addEventListener("click", function () {
    regenerateMap(mapSelect.value);
  });
  btnClearAll.addEventListener("click", function () {
    battle.clearAll();
    updateBudgetLabel();
  });
  btnClearTeam.addEventListener("click", function () {
    battle.clearTeam(ui.faction);
    updateBudgetLabel();
  });

  sandboxEditChk.addEventListener("change", function () {
    ui.sandboxEditing = sandboxEditChk.checked;
  });

  speedSelect.addEventListener("change", function () {
    battle.speed = parseFloat(speedSelect.value);
  });

  btnStart.addEventListener("click", function () {
    if (battle.units.length === 0) return;
    battle.start();
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnResume.disabled = true;
  });
  btnPause.addEventListener("click", function () {
    battle.paused = true;
    btnPause.disabled = true;
    btnResume.disabled = false;
  });
  btnResume.addEventListener("click", function () {
    if (battle.ended) return;
    battle.paused = false;
    btnResume.disabled = true;
    btnPause.disabled = false;
  });
  btnReset.addEventListener("click", function () {
    resetBattleKeepDeployment();
  });

  function resetBattleKeepDeployment() {
    battle.units.forEach(function (u) {
      u.hp = u.maxHp;
      u.x = u.spawnX; u.y = u.spawnY;
      u.vx = 0; u.vy = 0;
      u.state = "idle";
      u.targetId = null; u._targetRef = null;
      u.healTargetId = null; u._healRef = null;
      u.kills = 0; u.damageDealt = 0; u.isVeteran = false;
      u.morale = 80 + Math.random() * 15;
      u.dead = false;
      u.engagedSince = -1;
      u.retreatUntil = 0;
      u.lastScan = -999;
      u.atkCdTimer = Math.random() * Units.DEFS[u.type].atkCd;
    });
    battle.projectiles = [];
    battle.particles = [];
    battle.deathMarkers = [];
    battle.time = 0;
    battle.started = false;
    battle.ended = false;
    battle.paused = true;
    battle.winner = null;
    battle.log = [];
    battle._logFlags = {};
    battle.stats = {
      blue: { alive: 0, dead: 0, strength: 0, morale: 100, damageDealt: 0, kills: 0 },
      red: { alive: 0, dead: 0, strength: 0, morale: 100, damageDealt: 0, kills: 0 }
    };
    btnStart.disabled = false;
    btnPause.disabled = true;
    btnResume.disabled = true;
    endScreen.classList.add("hidden");
    ui.selectedId = null;
  }

  camZoomIn.addEventListener("click", function () {
    cameraUserAdjusted = true;
    zoomAtCenter(1.2);
  });
  camZoomOut.addEventListener("click", function () {
    cameraUserAdjusted = true;
    zoomAtCenter(1 / 1.2);
  });
  camFit.addEventListener("click", function () {
    cameraUserAdjusted = false;
    renderer.fitToWorld();
  });
  camReset.addEventListener("click", function () {
    cameraUserAdjusted = true;
    renderer.camera.zoom = 1;
    renderer.camera.x = Terrain.CONFIG.WORLD_W / 2;
    renderer.camera.y = Terrain.CONFIG.WORLD_H / 2;
    renderer.clampCamera();
  });
  function zoomAtCenter(factor) {
    renderer.camera.zoom *= factor;
    renderer.clampCamera();
  }

  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    cameraUserAdjusted = true;
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    var before = renderer.screenToWorld(sx, sy);
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    renderer.camera.zoom *= factor;
    renderer.clampCamera();
    var after = renderer.screenToWorld(sx, sy);
    renderer.camera.x += before.x - after.x;
    renderer.camera.y += before.y - after.y;
    renderer.clampCamera();
  }, { passive: false });

  function mouseWorldPos(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    return renderer.screenToWorld(sx, sy);
  }

  var MIN_SPACING = 16;

  function nearestUnitDist(x, y, excludeTeamFilter) {
    var best = Infinity;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead) continue;
      var dx = u.x - x, dy = u.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
    return best;
  }

  function nearestEnemyDist(x, y, team) {
    var best = Infinity;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead || u.team === team) continue;
      var dx = u.x - x, dy = u.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
    return best;
  }

  function canPlaceAt(x, y, team, type) {
    if (x < 6 || y < 6 || x > Terrain.CONFIG.WORLD_W - 6 || y > Terrain.CONFIG.WORLD_H - 6) return false;
    if (!Terrain.isInDeployZone(x, team)) return false;
    var flying = Units.DEFS[type].flying;
    var tile = Terrain.tileAt(map, x, y);
    if (!Terrain.isPassable(tile, flying)) return false;
    if (nearestUnitDist(x, y) < MIN_SPACING) return false;
    if (nearestEnemyDist(x, y, team) < 70) return false;
    if (ui.budgetMode === "balanced") {
      var spent = battle.pointsSpent(team);
      if (spent + Units.DEFS[type].cost > ui.budgetCap) return false;
    }
    return true;
  }

  function tryPlace(x, y) {
    if (canPlaceAt(x, y, ui.faction, ui.unitType)) {
      battle.addUnit(ui.unitType, ui.faction, x, y);
      updateBudgetLabel();
      return true;
    }
    return false;
  }

  function tryErase(x, y) {
    return battle.removeUnitAt(x, y, 18);
  }

  function paintAlongLine(fromPt, toPt, spacing, fn) {
    var dx = toPt.x - fromPt.x, dy = toPt.y - fromPt.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < spacing) { fn(toPt.x, toPt.y); return toPt; }
    var steps = Math.floor(dist / spacing);
    var last = fromPt;
    for (var i = 1; i <= steps; i++) {
      var px = fromPt.x + dx * (i * spacing / dist);
      var py = fromPt.y + dy * (i * spacing / dist);
      fn(px, py);
      last = { x: px, y: py };
    }
    return last;
  }

  canvas.addEventListener("mousedown", function (e) {
    if (e.button === 2 || e.button === 1) {
      ui.panning = true;
      ui.panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;

    if (placementEnabled()) {
      var wp = mouseWorldPos(e);
      ui.painting = true;
      ui.lastPlacePos = wp;
      if (ui.tool === "place") tryPlace(wp.x, wp.y);
      else tryErase(wp.x, wp.y);
    } else {
      var wp2 = mouseWorldPos(e);
      selectNearestUnit(wp2.x, wp2.y);
    }
  });

  window.addEventListener("mousemove", function (e) {
    if (ui.painting && (e.buttons & 1) === 0) {
      ui.painting = false;
    }
    if (ui.panning && (e.buttons & 6) === 0) {
      ui.panning = false;
      ui.panLast = null;
    }
    if (ui.panning && ui.panLast) {
      cameraUserAdjusted = true;
      var dxScreen = e.clientX - ui.panLast.x;
      var dyScreen = e.clientY - ui.panLast.y;
      renderer.camera.x -= dxScreen / renderer.camera.zoom;
      renderer.camera.y -= dyScreen / renderer.camera.zoom;
      renderer.clampCamera();
      ui.panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    var rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      ui.placementPreview = null;
      return;
    }
    var wp = mouseWorldPos(e);

    if (ui.painting && placementEnabled()) {
      var spacing = ui.tool === "place" ? MIN_SPACING + 4 : 14;
      ui.lastPlacePos = paintAlongLine(ui.lastPlacePos, wp, spacing, function (px, py) {
        if (ui.tool === "place") tryPlace(px, py);
        else tryErase(px, py);
      });
    }

    if (placementEnabled() && ui.tool === "place") {
      ui.placementPreview = { x: wp.x, y: wp.y, valid: canPlaceAt(wp.x, wp.y, ui.faction, ui.unitType) };
    } else {
      ui.placementPreview = null;
    }

    if (!placementEnabled()) {
      updateHover(wp.x, wp.y);
    }
  });

  window.addEventListener("mouseup", function () {
    ui.painting = false;
    ui.panning = false;
    ui.panLast = null;
  });
  window.addEventListener("blur", function () {
    ui.painting = false;
    ui.panning = false;
    ui.panLast = null;
  });

  function selectNearestUnit(x, y) {
    var best = null, bestD = 22;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead) continue;
      var dx = u.x - x, dy = u.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = u; }
    }
    ui.selectedId = best ? best.id : null;
  }

  function updateHover(x, y) {
    var best = null, bestD = 20;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead) continue;
      var dx = u.x - x, dy = u.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = u; }
    }
    ui.hoveredId = best ? best.id : null;
  }

  function placeFormation(team, type, count, xFracA, xFracB, yFracA, yFracB) {
    var W = Terrain.CONFIG.WORLD_W, H = Terrain.CONFIG.WORLD_H;
    var x0 = W * xFracA, x1 = W * xFracB;
    var y0 = H * yFracA, y1 = H * yFracB;
    var placed = 0, attempts = 0, maxAttempts = count * 20;
    var flying = Units.DEFS[type].flying;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      var x = x0 + Math.random() * (x1 - x0);
      var y = y0 + Math.random() * (y1 - y0);
      var tile = Terrain.tileAt(map, x, y);
      if (!Terrain.isPassable(tile, flying)) continue;
      if (nearestUnitDist(x, y) < MIN_SPACING) continue;
      battle.addUnit(type, team, x, y);
      placed++;
    }
    return placed;
  }

  function loadPreset(name) {
    battle.clearAll();
    ui.budgetMode = "sandbox";
    modeSandboxBtn.classList.add("active");
    modeBalancedBtn.classList.remove("active");

    if (name === "infantry_clash") {
      placeFormation("blue", "infantry", 40, 0.02, 0.15, 0.08, 0.92);
      placeFormation("red", "infantry", 40, 0.85, 0.98, 0.08, 0.92);
    } else if (name === "archers_vs_cavalry") {
      placeFormation("blue", "infantry", 8, 0.10, 0.15, 0.15, 0.85);
      placeFormation("blue", "archer", 24, 0.02, 0.09, 0.1, 0.9);
      placeFormation("red", "cavalry", 20, 0.85, 0.98, 0.15, 0.85);
    } else if (name === "fortress_line") {
      placeFormation("blue", "heavy", 14, 0.10, 0.15, 0.15, 0.85);
      placeFormation("blue", "archer", 16, 0.02, 0.09, 0.15, 0.85);
      placeFormation("red", "infantry", 26, 0.88, 0.98, 0.1, 0.9);
      placeFormation("red", "cavalry", 10, 0.85, 0.94, 0.35, 0.65);
    } else if (name === "armored_assault") {
      placeFormation("red", "tank", 8, 0.90, 0.98, 0.2, 0.8);
      placeFormation("red", "infantry", 20, 0.85, 0.95, 0.1, 0.9);
      placeFormation("blue", "infantry", 20, 0.02, 0.12, 0.1, 0.9);
      placeFormation("blue", "heavy", 10, 0.10, 0.15, 0.25, 0.75);
      placeFormation("blue", "archer", 10, 0.02, 0.08, 0.2, 0.8);
    } else if (name === "chaos") {
      var types = Units.TYPE_ORDER;
      ["blue", "red"].forEach(function (team) {
        types.forEach(function (type) {
          var count = Math.floor(Math.random() * 12) + 2;
          var xa = team === "blue" ? 0.02 : 0.85;
          var xb = team === "blue" ? 0.15 : 0.98;
          placeFormation(team, type, count, xa, xb, 0.06, 0.94);
        });
      });
    }
    updateBudgetLabel();
  }

  btnLoadPreset.addEventListener("click", function () {
    if (presetSelect.value) loadPreset(presetSelect.value);
  });

  function fmtTime(t) {
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  var lastLogCount = 0;
  function renderLog() {
    if (battle.log.length === lastLogCount) return;
    lastLogCount = battle.log.length;
    battleLog.innerHTML = "";
    var entries = battle.log.slice(-40);
    for (var i = entries.length - 1; i >= 0; i--) {
      var e = entries[i];
      var div = document.createElement("div");
      div.className = "log-entry";
      div.innerHTML = '<span class="t">' + fmtTime(e.t) + '</span>' + e.msg;
      battleLog.appendChild(div);
    }
  }

  function computeStrength(team) {
    var s = 0;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (u.dead || u.team !== team) continue;
      s += (u.hp / u.maxHp) * Units.DEFS[u.type].cost;
    }
    return Math.round(s);
  }

  function renderStats() {
    var b = battle.stats.blue, r = battle.stats.red;
    var bStr = computeStrength("blue"), rStr = computeStrength("red");
    statsPanel.innerHTML =
      '<div class="stat-row team-blue"><span class="lbl">Blue Remaining</span><span>' + battle.countAlive("blue") + '</span></div>' +
      '<div class="stat-row team-red"><span class="lbl">Red Remaining</span><span>' + battle.countAlive("red") + '</span></div>' +
      '<div class="divider"></div>' +
      '<div class="stat-row team-blue"><span class="lbl">Blue Casualties</span><span>' + b.dead + '</span></div>' +
      '<div class="stat-row team-red"><span class="lbl">Red Casualties</span><span>' + r.dead + '</span></div>' +
      '<div class="divider"></div>' +
      '<div class="stat-row team-blue"><span class="lbl">Blue Strength</span><span>' + bStr + '</span></div>' +
      '<div class="stat-row team-red"><span class="lbl">Red Strength</span><span>' + rStr + '</span></div>' +
      '<div class="divider"></div>' +
      '<div class="stat-row"><span class="lbl">Battle Duration</span><span>' + fmtTime(battle.time) + '</span></div>' +
      '<div class="stat-row"><span class="lbl">Total Projectiles</span><span>' + battle.projectiles.length + '</span></div>' +
      '<div class="divider"></div>' +
      '<div class="stat-row team-blue"><span class="lbl">Blue Morale</span><span>' + Math.round(b.morale) + '%</span></div>' +
      '<div class="morale-bar-track"><div class="morale-bar-fill" style="width:' + b.morale + '%;background:#4aa3ff"></div></div>' +
      '<div class="stat-row team-red"><span class="lbl">Red Morale</span><span>' + Math.round(r.morale) + '%</span></div>' +
      '<div class="morale-bar-track"><div class="morale-bar-fill" style="width:' + r.morale + '%;background:#ff5f5f"></div></div>';
  }

  function findUnitById(id) {
    for (var i = 0; i < battle.units.length; i++) {
      if (battle.units[i].id === id) return battle.units[i];
    }
    return null;
  }

  function renderInspector() {
    if (!ui.selectedId) {
      inspectorPanel.innerHTML = '<p class="muted">Select a unit to inspect it.</p>';
      return;
    }
    var u = findUnitById(ui.selectedId);
    if (!u) {
      inspectorPanel.innerHTML = '<p class="muted">Unit no longer exists.</p>';
      return;
    }
    var def = Units.DEFS[u.type];
    var hpFrac = Math.max(0, u.hp / u.maxHp);
    var hpColor = hpFrac > 0.5 ? "#5ad16a" : hpFrac > 0.22 ? "#f0c33c" : "#e4483f";
    var targetLabel = "None";
    if (u._targetRef && !u._targetRef.dead) targetLabel = Units.DEFS[u._targetRef.type].name + " (#" + u._targetRef.id + ")";
    else if (u._healRef && !u._healRef.dead) targetLabel = "Healing " + Units.DEFS[u._healRef.type].name + " (#" + u._healRef.id + ")";

    inspectorPanel.innerHTML =
      '<div class="insp-row"><span>Faction</span><span>' + (u.team === "blue" ? "Blue" : "Red") + (u.isVeteran ? " ★ Veteran" : "") + '</span></div>' +
      '<div class="insp-row"><span>Unit Type</span><span>' + def.name + '</span></div>' +
      '<div class="insp-hpbar"><div class="insp-hpfill" style="width:' + (hpFrac * 100) + '%;background:' + hpColor + '"></div></div>' +
      '<div class="insp-row"><span>Health</span><span>' + Math.max(0, Math.round(u.hp)) + ' / ' + u.maxHp + '</span></div>' +
      '<div class="insp-row"><span>Morale</span><span>' + Math.round(u.morale) + '%</span></div>' +
      '<div class="insp-row"><span>Damage</span><span>' + u.dmg + '</span></div>' +
      '<div class="insp-row"><span>Range</span><span>' + Math.round(u.range) + '</span></div>' +
      '<div class="insp-row"><span>State</span><span>' + u.state + '</span></div>' +
      '<div class="insp-row"><span>Target</span><span>' + targetLabel + '</span></div>' +
      '<div class="insp-row"><span>Kills</span><span>' + u.kills + '</span></div>';
  }

  function updatePhaseTag() {
    var text, cls;
    if (!battle.started) { text = "DEPLOYMENT"; cls = "tag-deploy"; }
    else if (battle.ended) { text = "BATTLE ENDED"; cls = "tag-ended"; }
    else if (battle.paused) { text = "PAUSED"; cls = "tag-paused"; }
    else { text = "BATTLE"; cls = "tag-battle"; }
    phaseTag.textContent = text;
    phaseTag.className = "tag " + cls;
    clockTag.textContent = fmtTime(battle.time);
    setPlacementEnabled(placementEnabled());
  }

  function mostEffectiveUnit() {
    var best = null, bestScore = -1;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      var score = u.kills * 60 + (u.damageDealt || 0);
      if (score > bestScore) { bestScore = score; best = u; }
    }
    return best;
  }
  function mostKillsUnit() {
    var best = null;
    for (var i = 0; i < battle.units.length; i++) {
      var u = battle.units[i];
      if (!best || u.kills > best.kills) best = u;
    }
    return best;
  }

  var endShown = false;
  function checkEndScreen() {
    if (battle.ended && !endShown) {
      endShown = true;
      var winnerText = battle.winner === "draw" ? "MUTUAL DESTRUCTION" : (battle.winner === "blue" ? "BLUE ARMY VICTORIOUS" : "RED ARMY VICTORIOUS");
      endTitle.textContent = winnerText;
      endTitle.style.color = battle.winner === "blue" ? "#4aa3ff" : battle.winner === "red" ? "#ff5f5f" : "#f0c33c";
      var eff = mostEffectiveUnit();
      var mk = mostKillsUnit();
      var rows = [
        ["Battle Duration", fmtTime(battle.time)],
        ["Blue Survivors", battle.countAlive("blue")],
        ["Red Survivors", battle.countAlive("red")],
        ["Blue Casualties", battle.stats.blue.dead],
        ["Red Casualties", battle.stats.red.dead],
        ["Blue Damage Dealt", Math.round(battle.stats.blue.damageDealt)],
        ["Red Damage Dealt", Math.round(battle.stats.red.damageDealt)],
        ["Blue Army Value Remaining", computeStrength("blue")],
        ["Red Army Value Remaining", computeStrength("red")],
        ["Most Effective Unit", eff ? (Units.DEFS[eff.type].name + " (" + (eff.team === "blue" ? "Blue" : "Red") + ") — " + eff.kills + " kills" + (eff.dead ? ", died" : ", survived")) : "N/A"],
        ["Most Kills", mk ? (mk.kills + " (" + Units.DEFS[mk.type].name + ", " + (mk.team === "blue" ? "Blue" : "Red") + ")") : "0"]
      ];
      endStats.innerHTML = rows.map(function (r) {
        return '<div class="row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>';
      }).join("");
      endScreen.classList.remove("hidden");
      btnPause.disabled = true;
      btnResume.disabled = true;
    } else if (!battle.ended) {
      endShown = false;
    }
  }

  btnEndClose.addEventListener("click", function () {
    endScreen.classList.add("hidden");
  });

  var FIXED_DT = 1 / 30;
  var MAX_STEPS = 10;
  var accumulator = 0;
  var lastFrame = performance.now();

  function loop(now) {
    var dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!battle.paused && battle.started && !battle.ended) {
      accumulator += dt * battle.speed;
      var steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
        battle.tick(FIXED_DT);
        accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) accumulator = 0;
    } else {
      accumulator = 0;
    }

    ui.phase = placementEnabled() ? "deploy" : "battle";
    renderer.render(battle, ui);
    renderLog();
    renderStats();
    renderInspector();
    updatePhaseTag();
    checkEndScreen();

    requestAnimationFrame(loop);
  }

  updateBudgetLabel();
  requestAnimationFrame(loop);
})();
