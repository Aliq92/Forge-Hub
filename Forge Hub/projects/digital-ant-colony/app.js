// Wires the Colony simulation up to the canvas, the HUD, and the controls.
// Nothing simulation-related lives here — this file only renders state and
// forwards user input, so the actual behaviour stays in js/*.js.

(function () {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const SETTINGS_KEY = "digitalAntColony.settings.v1";
  const HINT_KEY = "digitalAntColony.hintDismissed";
  const OVERLAY_ORDER = ["off", "food", "home", "danger", "all"];

  const els = {
    population: document.getElementById("statPopulation"),
    stored: document.getElementById("statStored"),
    collected: document.getElementById("statCollected"),
    foodSources: document.getElementById("statFoodSources"),
    time: document.getElementById("statTime"),
    scouts: document.getElementById("statScouts"),
    workers: document.getElementById("statWorkers"),
    carriers: document.getElementById("statCarriers"),
    trail: document.getElementById("statTrail"),
    eventLog: document.getElementById("eventLog"),
    presetLabel: document.getElementById("presetLabel"),
    presetSelect: document.getElementById("presetSelect"),
    btnPause: document.getElementById("btnPause"),
    btnAddAnt: document.getElementById("btnAddAnt"),
    btnGrowth: document.getElementById("btnGrowth"),
    btnReset: document.getElementById("btnReset"),
    btnCinematic: document.getElementById("btnCinematic"),
    btnExitCinematic: document.getElementById("btnExitCinematic"),
    btnCinematicOverlay: document.getElementById("btnCinematicOverlay"),
    cinematicBar: document.getElementById("cinematicBar"),
    btnPanelHandle: document.getElementById("btnPanelHandle"),
    panel: document.getElementById("panel"),
    hint: document.getElementById("hint"),
    btnDismissHint: document.getElementById("btnDismissHint"),
    speedButtons: Array.from(document.querySelectorAll(".speed-btn")),
    toolButtons: Array.from(document.querySelectorAll(".tool-btn")),
    foodChips: Array.from(document.querySelectorAll("#foodOptions .chip")),
    brushChips: Array.from(document.querySelectorAll("#brushOptions .chip")),
    overlayChips: Array.from(document.querySelectorAll("#overlayGroup .chip")),
    foodOptions: document.getElementById("foodOptions"),
    brushOptions: document.getElementById("brushOptions"),
  };

  let colony = null;
  let paused = false;
  let speedMultiplier = 1;
  let lastTime = null;
  let hudTimer = 0;
  let lastLoggedEvent = null;
  let clickMarkers = [];
  let nestMotes = [];
  let nestMoteTimer = 0;

  let currentTool = "food";
  let currentFoodType = "crumbs";
  let currentBrush = "medium";
  let currentPresetKey = "simpleForage";

  const MAX_DPR = 2;

  function sizeCanvasToContainer() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(200, Math.round(rect.width));
    const height = Math.max(200, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function pickMaxAnts() {
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    return narrow && coarse ? CONFIG.colony.maxAntsMobile : CONFIG.colony.maxAntsDesktop;
  }

  function init() {
    const { width, height } = sizeCanvasToContainer();
    colony = new Colony(width, height, { maxAnts: pickMaxAnts() });
    applyPreset(colony, currentPresetKey);
    els.presetLabel.textContent = `Project Forge · ${colony.presetName}`;

    bindControls();
    loadSettingsIntoUI();
    applyHintDismissedState();
    applyMobilePanelDefault();

    // A ResizeObserver on the stage (rather than just `window.resize`) also
    // catches size changes with no window resize event at all — entering
    // cinematic mode or collapsing the mobile panel.
    const debouncedResize = debounce(handleResize, 150);
    if ("ResizeObserver" in window) {
      new ResizeObserver(debouncedResize).observe(document.querySelector(".stage"));
    } else {
      window.addEventListener("resize", debouncedResize);
      window.addEventListener("orientationchange", debouncedResize);
    }
    // Belt-and-suspenders: if the very first layout pass wasn't ready yet
    // when sizeCanvasToContainer() ran above (slow CSS/font load, or a tab
    // that hasn't been painted yet), self-correct shortly after instead of
    // staying stuck at the fallback size until something else resizes it.
    setTimeout(handleResize, 60);
    setTimeout(handleResize, 500);

    requestAnimationFrame(frame);
  }

  function handleResize() {
    const { width, height } = sizeCanvasToContainer();
    colony.resizeWorld(width, height);
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ---------- Main loop ----------

  function frame(now) {
    requestAnimationFrame(frame);
    if (lastTime === null) {
      lastTime = now;
      return;
    }
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.05); // guard against tab-backgrounding jumps

    updateMarkers(dt);
    if (!paused) {
      colony.update(dt * speedMultiplier);
      updateNestMotes(dt * speedMultiplier);
    }

    render();

    hudTimer += dt;
    if (hudTimer > 0.2) {
      hudTimer = 0;
      updateHud();
    }
    if (colony.events[0] && colony.events[0] !== lastLoggedEvent) {
      lastLoggedEvent = colony.events[0];
      renderEventLog();
    }
  }

  // ---------- Rendering ----------

  function render() {
    const { width, height } = colony.world;
    ctx.fillStyle = "#0b0906";
    ctx.fillRect(0, 0, width, height);

    drawPheromoneOverlay();
    if (!colony.obstacles.isEmpty()) colony.obstacles.draw(ctx, "rgba(107, 94, 80, 0.94)");
    drawHazards();

    for (const food of colony.food) food.draw(ctx);

    drawNest();
    drawNestMotes();
    drawAnts();
    drawMarkers();
  }

  function drawPheromoneOverlay() {
    const mode = colony.overlayMode;
    if (mode === "off") return;
    const inAll = mode === "all";
    if (mode === "food" || inAll) colony.foodGrid.draw(ctx, "64, 226, 199", inAll ? 0.85 : 1);
    if (mode === "home" || inAll) colony.homeGrid.draw(ctx, "255, 196, 110", inAll ? 0.75 : 1);
    if (mode === "danger" || inAll) colony.dangerGrid.draw(ctx, "224, 74, 74", 1);
  }

  function drawHazards() {
    if (colony.hazards.isEmpty()) return;
    const pulse = 0.16 + Math.sin(colony.elapsed * 2) * 0.05;
    colony.hazards.draw(ctx, `rgba(196, 64, 56, ${pulse.toFixed(3)})`);
  }

  function drawNest() {
    const { x, y, radius } = colony.nest;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.4);
    glow.addColorStop(0, "rgba(255, 166, 71, 0.5)");
    glow.addColorStop(0.45, "rgba(255, 120, 40, 0.18)");
    glow.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.4, 0, TAU);
    ctx.fill();

    // Ground mound beneath the entrance.
    ctx.fillStyle = "#241a10";
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.35, radius * 1.12, 0, 0, TAU);
    ctx.fill();

    // Storage ring: how close the colony is to its next growth threshold.
    if (colony.growthEnabled) {
      const frac = clamp(colony.storedFood / CONFIG.colony.growthFoodPerAnt, 0, 1);
      if (frac > 0.02) {
        ctx.strokeStyle = "rgba(255, 210, 120, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#3b2415";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#140c07";
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.4, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 186, 110, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
  }

  function updateNestMotes(dt) {
    nestMoteTimer += dt;
    if (nestMoteTimer > 1.5) {
      nestMoteTimer = 0;
      const angle = rand(0, TAU);
      const r = colony.nest.radius * 0.5;
      nestMotes.push({
        x: colony.nest.x + Math.cos(angle) * r,
        y: colony.nest.y + Math.sin(angle) * r,
        vx: Math.cos(angle) * 7,
        vy: Math.sin(angle) * 7,
        age: 0,
      });
    }
    for (const m of nestMotes) {
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    if (nestMotes.length) nestMotes = nestMotes.filter((m) => m.age < 2.2);
  }

  function drawNestMotes() {
    for (const m of nestMotes) {
      const t = m.age / 2.2;
      ctx.fillStyle = `rgba(255, 202, 130, ${((1 - t) * 0.5).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.4, 0, TAU);
      ctx.fill();
    }
  }

  const ROLE_COLORS = {
    scout: "rgba(210, 196, 224, 0.92)",
    worker: "#d9b98a",
    carrier: "#b98a52",
  };

  function drawAnts() {
    for (const role of ["scout", "worker", "carrier"]) {
      ctx.beginPath();
      for (const ant of colony.ants) {
        if (!ant.dead && !ant.carrying && ant.role === role) ant.appendShape(ctx);
      }
      ctx.fillStyle = ROLE_COLORS[role];
      ctx.fill();
    }

    ctx.beginPath();
    for (const ant of colony.ants) {
      if (!ant.dead && ant.carrying) ant.appendShape(ctx);
    }
    ctx.fillStyle = "#ffd25c";
    ctx.fill();

    for (const ant of colony.ants) {
      if (!ant.dead && ant.carrying) ant.drawCarryMarker(ctx);
    }

    for (const ant of colony.ants) {
      if (!ant.dead) continue;
      const t = clamp(ant.fadeT / CONFIG.hazard.fadeDuration, 0, 1);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ant.appendShape(ctx);
      ctx.fillStyle = "#e2694f";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function updateMarkers(dt) {
    for (const m of clickMarkers) m.age += dt;
    if (clickMarkers.length) clickMarkers = clickMarkers.filter((m) => m.age < 0.6);
  }

  function drawMarkers() {
    for (const m of clickMarkers) {
      const t = m.age / 0.6;
      ctx.strokeStyle = `rgba(255, 210, 120, ${(1 - t).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 10 + t * 26, 0, TAU);
      ctx.stroke();
    }
  }

  // ---------- HUD ----------

  function updateHud() {
    els.population.textContent = colony.ants.length;
    els.stored.textContent = Math.floor(colony.storedFood);
    els.collected.textContent = Math.floor(colony.foodCollectedTotal);
    els.foodSources.textContent = colony.food.length;
    els.time.textContent = formatTime(colony.elapsed);

    const counts = colony.roleCounts();
    els.scouts.textContent = counts.scout;
    els.workers.textContent = counts.worker;
    els.carriers.textContent = counts.carrier;
    els.trail.textContent = `${Math.round(colony.trailStrengthFraction() * 100)}%`;
  }

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function renderEventLog() {
    els.eventLog.innerHTML = "";
    for (const evt of colony.events) {
      const li = document.createElement("li");
      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = formatTime(evt.time);
      const msg = document.createElement("span");
      msg.className = "log-msg";
      msg.textContent = evt.message;
      li.appendChild(time);
      li.appendChild(msg);
      els.eventLog.appendChild(li);
    }
  }

  // ---------- World editing (food / obstacle / hazard / erase tools) ----------

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function applyToolAt(x, y, isFirst) {
    switch (currentTool) {
      case "food": {
        const amount = isFirst
          ? randInt(CONFIG.world.minFoodAmount, CONFIG.world.maxFoodAmount)
          : randInt(6, 14);
        colony.addFoodAt(x, y, amount, currentFoodType);
        break;
      }
      case "obstacle": {
        colony.obstacles.paintCircle(x, y, CONFIG.obstacle.brush[currentBrush], 1);
        break;
      }
      case "hazard": {
        colony.hazards.paintCircle(x, y, CONFIG.hazard.brush[currentBrush], 1);
        break;
      }
      case "erase": {
        const r = CONFIG.obstacle.brush[currentBrush];
        colony.obstacles.paintCircle(x, y, r, 0);
        colony.hazards.paintCircle(x, y, r, 0);
        colony.food = colony.food.filter((f) => dist(f.x, f.y, x, y) > f.radius + r * 0.5);
        break;
      }
    }
  }

  function paintAlongPath(p0, p1) {
    const d = dist(p0.x, p0.y, p1.x, p1.y);
    const steps = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      applyToolAt(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, false);
    }
  }

  let isPointerDown = false;
  let activePointerId = null;
  let lastPaintPoint = null;
  let lastFoodSprinklePoint = null;

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    isPointerDown = true;
    activePointerId = e.pointerId;
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    const p = getCanvasPoint(e);
    applyToolAt(p.x, p.y, true);
    lastPaintPoint = p;
    lastFoodSprinklePoint = p;
    clickMarkers.push({ x: p.x, y: p.y, age: 0 });
  }

  function onPointerMove(e) {
    if (!isPointerDown || e.pointerId !== activePointerId) return;
    const p = getCanvasPoint(e);
    if (currentTool === "food") {
      if (dist(p.x, p.y, lastFoodSprinklePoint.x, lastFoodSprinklePoint.y) > 16) {
        applyToolAt(p.x, p.y, false);
        lastFoodSprinklePoint = p;
      }
    } else {
      paintAlongPath(lastPaintPoint, p);
      lastPaintPoint = p;
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    isPointerDown = false;
    activePointerId = null;
    lastPaintPoint = null;
    lastFoodSprinklePoint = null;
  }

  // ---------- Controls ----------

  function bindControls() {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    els.btnPause.addEventListener("click", togglePause);

    els.speedButtons.forEach((btn) => {
      btn.addEventListener("click", () => setSpeed(parseFloat(btn.dataset.speed)));
    });

    els.toolButtons.forEach((btn) => {
      btn.addEventListener("click", () => setTool(btn.dataset.tool));
    });
    els.foodChips.forEach((btn) => {
      btn.addEventListener("click", () => setFoodType(btn.dataset.food));
    });
    els.brushChips.forEach((btn) => {
      btn.addEventListener("click", () => setBrush(btn.dataset.brush));
    });
    els.overlayChips.forEach((btn) => {
      btn.addEventListener("click", () => setOverlay(btn.dataset.overlay));
    });

    els.btnAddAnt.addEventListener("click", () => colony.spawnAnt());
    els.btnGrowth.addEventListener("click", () => setGrowth(!colony.growthEnabled));
    els.btnReset.addEventListener("click", triggerReset);

    els.presetSelect.addEventListener("change", () => {
      currentPresetKey = els.presetSelect.value;
      applyPreset(colony, currentPresetKey);
      els.presetLabel.textContent = `Project Forge · ${colony.presetName}`;
      lastLoggedEvent = null;
      renderEventLog();
      updateHud();
    });

    els.btnCinematic.addEventListener("click", () => setCinematic(true));
    els.btnExitCinematic.addEventListener("click", () => setCinematic(false));
    els.btnCinematicOverlay.addEventListener("click", cycleOverlay);

    els.btnPanelHandle.addEventListener("click", togglePanelCollapsed);
    els.btnDismissHint.addEventListener("click", dismissHint);

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "SELECT" || e.target.tagName === "INPUT")) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePause();
          break;
        case "1":
          setSpeed(0.5);
          break;
        case "2":
          setSpeed(1);
          break;
        case "3":
          setSpeed(2);
          break;
        case "4":
          setSpeed(4);
          break;
        case "5":
          setSpeed(8);
          break;
        case "a":
        case "A":
          colony.spawnAnt();
          break;
        case "p":
        case "P":
          cycleOverlay();
          break;
        case "r":
        case "R":
          triggerReset();
          break;
        case "c":
        case "C":
          setCinematic(!document.getElementById("app").classList.contains("cinematic"));
          break;
      }
    });
  }

  function togglePause() {
    paused = !paused;
    els.btnPause.textContent = paused ? "Resume" : "Pause";
    els.btnPause.classList.toggle("active", paused);
  }

  function setSpeed(value) {
    speedMultiplier = value;
    els.speedButtons.forEach((btn) => {
      btn.classList.toggle("active", parseFloat(btn.dataset.speed) === value);
    });
    saveSettings();
  }

  function setTool(tool) {
    currentTool = tool;
    els.toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
    els.foodOptions.hidden = tool !== "food";
    els.brushOptions.hidden = tool === "food";
    saveSettings();
  }

  function setFoodType(type) {
    currentFoodType = type;
    els.foodChips.forEach((btn) => btn.classList.toggle("active", btn.dataset.food === type));
    saveSettings();
  }

  function setBrush(size) {
    currentBrush = size;
    els.brushChips.forEach((btn) => btn.classList.toggle("active", btn.dataset.brush === size));
    saveSettings();
  }

  function setOverlay(mode) {
    colony.overlayMode = mode;
    els.overlayChips.forEach((btn) => btn.classList.toggle("active", btn.dataset.overlay === mode));
    els.btnCinematicOverlay.textContent = `Pheromones: ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
    saveSettings();
  }

  function cycleOverlay() {
    const idx = OVERLAY_ORDER.indexOf(colony.overlayMode);
    setOverlay(OVERLAY_ORDER[(idx + 1) % OVERLAY_ORDER.length]);
  }

  function setGrowth(on) {
    colony.growthEnabled = on;
    els.btnGrowth.textContent = `Growth: ${on ? "On" : "Off"}`;
    els.btnGrowth.classList.toggle("active", on);
    els.btnGrowth.setAttribute("aria-pressed", String(on));
  }

  function setCinematic(on) {
    document.getElementById("app").classList.toggle("cinematic", on);
    els.cinematicBar.hidden = !on;
    if (on) els.btnCinematicOverlay.textContent = `Pheromones: ${colony.overlayMode.charAt(0).toUpperCase()}${colony.overlayMode.slice(1)}`;
    // The stage changes size via CSS grid here; don't just wait for the
    // ResizeObserver to notice — getBoundingClientRect() below forces a
    // synchronous layout, so resizing right away reads the new dimensions
    // immediately instead of a frame late.
    handleResize();
  }

  function togglePanelCollapsed() {
    const collapsed = els.panel.classList.toggle("collapsed");
    els.btnPanelHandle.setAttribute("aria-expanded", String(!collapsed));
    handleResize();
  }

  function applyMobilePanelDefault() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      els.panel.classList.add("collapsed");
      els.btnPanelHandle.setAttribute("aria-expanded", "false");
    }
  }

  function dismissHint() {
    els.hint.classList.add("hint-hidden");
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch (err) {
      /* ignore */
    }
  }

  function applyHintDismissedState() {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(HINT_KEY) === "1";
    } catch (err) {
      /* ignore */
    }
    if (dismissed) els.hint.classList.add("hint-hidden");
  }

  let resetArmed = false;
  let resetArmTimeout = null;

  function triggerReset() {
    if (!resetArmed) {
      resetArmed = true;
      els.btnReset.textContent = "Confirm Reset?";
      els.btnReset.classList.add("confirm");
      resetArmTimeout = setTimeout(disarmReset, 3000);
      return;
    }
    clearTimeout(resetArmTimeout);
    disarmReset();
    applyPreset(colony, currentPresetKey);
    els.presetLabel.textContent = `Project Forge · ${colony.presetName}`;
    nestMotes = [];
    clickMarkers = [];
    lastLoggedEvent = null;
    renderEventLog();
    updateHud();
    if (paused) togglePause();
    setSpeed(1);
  }

  function disarmReset() {
    resetArmed = false;
    els.btnReset.textContent = "Reset Colony";
    els.btnReset.classList.remove("confirm");
  }

  // ---------- Settings persistence ----------

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          overlayMode: colony ? colony.overlayMode : "food",
          speedMultiplier,
          tool: currentTool,
          foodType: currentFoodType,
          brushSize: currentBrush,
        })
      );
    } catch (err) {
      /* ignore (private browsing / file:// restrictions) */
    }
  }

  function loadSettingsIntoUI() {
    const s = loadSettings();
    setTool(s.tool || "food");
    setFoodType(s.foodType || "crumbs");
    setBrush(s.brushSize || "medium");
    setOverlay(s.overlayMode || "food");
    setSpeed(s.speedMultiplier || 1);
  }

  init();
})();
