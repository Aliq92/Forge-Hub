"use strict";
/*
 * Moonlit Terrarium — Seven Quiet Nights
 * v0.1 — plain HTML/CSS/JS, no frameworks, no external assets.
 *
 * File layout of this module (top to bottom):
 *   1. Constants & tuning numbers
 *   2. Utility helpers
 *   3. World / state factory
 *   4. Mote behaviour (decision + movement + needs)
 *   5. Intervention effects
 *   6. Rendering (procedural canvas)
 *   7. Input handling (Pointer Events)
 *   8. UI / DOM updates
 *   9. Game progression (nights, win/loss, pause, restart)
 *  10. Main loop
 */

(function () {
  // ---------------------------------------------------------------------
  // 1. Constants & tuning numbers
  // ---------------------------------------------------------------------

  const WORLD_W = 960;
  const WORLD_H = 600;
  const NIGHT_DURATION = 40; // seconds per night
  const TOTAL_NIGHTS = 7;
  const MAX_DT = 0.12; // clamp large frame gaps (tab suspend, etc.)

  // Habitable area inside the glass frame (keeps decorations/critters off the frame).
  const HABITAT = { x: 30, y: 30, w: WORLD_W - 60, h: WORLD_H - 60 };

  const INTERACTION_RADIUS = 46; // px, "in range" of an intervention
  const LAMP_RADIUS = 130;

  const NEED = {
    hungerRate: 0.9,      // per second, while not eating
    thirstRate: 0.8,      // per second, while not drinking
    energyDecayBase: 0.34,
    energyDecayNeedy: 0.42, // extra decay added when hunger/thirst is high
    energyIdleRegen: 0.22,  // slow passive regen when needs are low
    foodRate: 9,           // hunger reduced per second while eating
    waterRate: 9,          // thirst reduced per second while drinking
    shelterRate: 7,        // energy restored per second while sheltering
    lampDecayMultiplier: 0.3, // multiply energy decay for motes near the lamp
  };

  const THRESH = {
    hungerUrgent: 82,
    thirstUrgent: 82,
    energyUrgent: 16,
    hungerSeek: 55,
    thirstSeek: 55,
    energySeek: 38,
    foodSatisfied: 25,
    waterSatisfied: 25,
    shelterSatisfied: 80,
  };

  const MOTE_DEFS = [
    { name: "Ember", color: "#ffb35c", glow: "rgba(255,179,92,0.55)", size: 11 },
    { name: "Pip", color: "#7fe0c4", glow: "rgba(127,224,196,0.55)", size: 9 },
    { name: "Sable", color: "#c9a4ff", glow: "rgba(201,164,255,0.55)", size: 10 },
    { name: "Wren", color: "#ff9db5", glow: "rgba(255,157,181,0.55)", size: 9.5 },
  ];

  const ACTIVITY_LABEL = {
    wandering: "Wandering",
    seekingFood: "Seeking food",
    eating: "Eating",
    seekingWater: "Seeking water",
    drinking: "Drinking",
    seekingShelter: "Seeking shelter",
    resting: "Resting in shelter",
    gatheringMoon: "Gathering in moonlight",
    gatheringMote: "Gathering near another Mote",
    exhausted: "Exhausted",
  };

  // ---------------------------------------------------------------------
  // 2. Utility helpers
  // ---------------------------------------------------------------------

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------------
  // 3. World / state factory
  // ---------------------------------------------------------------------

  function createMote(def, index) {
    const total = MOTE_DEFS.length;
    const angle = (index / total) * Math.PI * 2;
    const cx = HABITAT.x + HABITAT.w / 2;
    const cy = HABITAT.y + HABITAT.h / 2 + 40;
    return {
      id: index,
      name: def.name,
      color: def.color,
      glow: def.glow,
      size: def.size,
      x: cx + Math.cos(angle) * 90,
      y: cy + Math.sin(angle) * 50,
      vx: 0,
      vy: 0,
      hunger: rand(28, 46),
      thirst: rand(22, 40),
      energy: rand(68, 90),
      activity: "wandering",
      lockedType: null, // "food" | "water" | "shelter" while committed
      wanderTarget: null,
      wanderTimer: rand(0.5, 2),
      bobPhase: Math.random() * Math.PI * 2,
      facing: 1,
      exhaustedFlicker: Math.random() * Math.PI * 2,
    };
  }

  function createState() {
    return {
      started: false,
      paused: false,
      manualPause: false,
      ended: false,
      outcome: null, // "victory" | "loss"

      night: 1,
      timeLeft: NIGHT_DURATION,
      interventionUsedThisNight: false,
      pendingInterventionType: null, // selected in UI, not yet placed

      motes: MOTE_DEFS.map(createMote),
      interventions: [], // { type, x, y, id }
      particles: [],

      selectedMoteId: null,
      messages: [],
      messageCooldowns: {},

      lastFrameTime: null,
    };
  }

  let state = createState();

  function pushMessage(text, key, cooldown = 6) {
    const now = (state.night - 1) * NIGHT_DURATION + (NIGHT_DURATION - state.timeLeft);
    if (key) {
      const last = state.messageCooldowns[key];
      if (last !== undefined && now - last < cooldown) return;
      state.messageCooldowns[key] = now;
    }
    state.messages.push(text);
    if (state.messages.length > 40) state.messages.shift();
    renderHappenings();
  }

  // ---------------------------------------------------------------------
  // 4. Mote behaviour
  // ---------------------------------------------------------------------

  function findIntervention(type) {
    // Most recently placed of that type, if several exist.
    for (let i = state.interventions.length - 1; i >= 0; i--) {
      if (state.interventions[i].type === type) return state.interventions[i];
    }
    return null;
  }

  function nearestOfType(mote, type) {
    let best = null;
    let bestD = Infinity;
    for (const iv of state.interventions) {
      if (iv.type !== type) continue;
      const d = dist(mote.x, mote.y, iv.x, iv.y);
      if (d < bestD) {
        bestD = d;
        best = iv;
      }
    }
    return best;
  }

  function inRange(mote, iv) {
    return iv && dist(mote.x, mote.y, iv.x, iv.y) <= INTERACTION_RADIUS;
  }

  function decideActivity(mote, dt) {
    const exhausted = mote.energy <= 0;
    const hungerUrgent = mote.hunger >= THRESH.hungerUrgent;
    const thirstUrgent = mote.thirst >= THRESH.thirstUrgent;
    const energyUrgent = exhausted || mote.energy <= THRESH.energyUrgent;

    // Currently committed to a care activity — keep going unless it
    // becomes invalid, or a genuinely more urgent need appears AND that
    // need's gift actually exists (an urgent need with nothing to act on
    // must not knock a Mote out of a care activity it can still use).
    if (mote.lockedType) {
      const iv = nearestOfType(mote, mote.lockedType);
      const stillGood =
        iv &&
        !(mote.lockedType === "food" && mote.hunger <= THRESH.foodSatisfied) &&
        !(mote.lockedType === "water" && mote.thirst <= THRESH.waterSatisfied) &&
        !(mote.lockedType === "shelter" && mote.energy >= THRESH.shelterSatisfied);

      const overriddenByUrgency =
        (exhausted && mote.lockedType !== "shelter" && !!nearestOfType(mote, "shelter")) ||
        (mote.lockedType !== "water" && thirstUrgent && !!nearestOfType(mote, "water")) ||
        (mote.lockedType !== "food" && hungerUrgent && !!nearestOfType(mote, "food")) ||
        (mote.lockedType !== "shelter" && energyUrgent && !!nearestOfType(mote, "shelter"));

      if (stillGood && !overriddenByUrgency) {
        pursue(mote, iv, dt);
        return;
      }
      mote.lockedType = null;
    }

    // Priority order of needs, most urgent first. An exhausted Mote
    // (energy at 0) always prioritises Shelter above everything else so
    // it is never permanently stuck idle. Each want is only acted on if
    // its gift actually exists in the world; otherwise the next-highest
    // want that does have a gift available is tried, so a Mote never
    // ignores an available Shelter/Food/Water just because a different,
    // technically more urgent need has nothing to satisfy it with.
    const wants = [];
    if (exhausted) wants.push("shelter");
    if (thirstUrgent) wants.push("water");
    if (hungerUrgent) wants.push("food");
    if (energyUrgent) wants.push("shelter");
    if (mote.thirst >= THRESH.thirstSeek) wants.push("water");
    if (mote.hunger >= THRESH.hungerSeek) wants.push("food");
    if (mote.energy <= THRESH.energySeek) wants.push("shelter");

    for (const want of wants) {
      const iv = nearestOfType(mote, want);
      if (iv) {
        mote.lockedType = want;
        pursue(mote, iv, dt);
        return;
      }
    }

    ambientBehaviour(mote, dt);
  }

  function pursue(mote, iv, dt) {
    const seekingLabel =
      mote.lockedType === "food" ? "seekingFood" :
      mote.lockedType === "water" ? "seekingWater" : "seekingShelter";
    const usingLabel =
      mote.lockedType === "food" ? "eating" :
      mote.lockedType === "water" ? "drinking" : "resting";

    if (inRange(mote, iv)) {
      mote.activity = usingLabel;
      moveToward(mote, iv.x, iv.y, dt, 0.35); // gentle settle, mostly still
      applyIntervention(mote, iv, dt);
    } else {
      mote.activity = seekingLabel;
      const speedMul = mote.energy <= 0 ? 0.35 : 1;
      moveToward(mote, iv.x, iv.y, dt, 1 * speedMul);
    }
  }

  function ambientBehaviour(mote, dt) {
    if (mote.energy <= 0) {
      // Exhausted with nowhere to go yet: drift very slowly, stay visible.
      mote.activity = "exhausted";
      mote.wanderTimer -= dt;
      if (mote.wanderTimer <= 0 || !mote.wanderTarget) {
        mote.wanderTarget = randomHabitatPoint();
        mote.wanderTimer = rand(2, 4);
      }
      moveToward(mote, mote.wanderTarget.x, mote.wanderTarget.y, dt, 0.25);
      return;
    }

    const lamp = state.interventions.find((iv) => iv.type === "lamp");
    if (lamp && mote.energy > 40 && mote.hunger < 60 && mote.thirst < 60 && dist(mote.x, mote.y, lamp.x, lamp.y) < LAMP_RADIUS * 1.4) {
      mote.activity = "gatheringMoon";
      moveToward(mote, lamp.x, lamp.y, dt, 0.55);
      return;
    }

    // Occasionally gather near another content mote for ambience.
    if (mote.activity === "gatheringMote") {
      const buddy = mote.gatherBuddy;
      if (buddy && dist(mote.x, mote.y, buddy.x, buddy.y) < 90 && mote.wanderTimer > 0) {
        mote.wanderTimer -= dt;
        moveToward(mote, buddy.x + 30, buddy.y, dt, 0.4);
        return;
      }
      mote.activity = "wandering";
    }

    mote.wanderTimer -= dt;
    if (mote.wanderTimer <= 0 || !mote.wanderTarget) {
      if (Math.random() < 0.18) {
        const others = state.motes.filter((m) => m.id !== mote.id);
        const buddy = pick(others);
        mote.activity = "gatheringMote";
        mote.gatherBuddy = buddy;
        mote.wanderTimer = rand(2, 4);
      } else {
        mote.activity = "wandering";
        mote.wanderTarget = randomHabitatPoint();
        mote.wanderTimer = rand(2, 4.5);
      }
    }
    if (mote.activity === "wandering") {
      moveToward(mote, mote.wanderTarget.x, mote.wanderTarget.y, dt, 0.5);
    }
  }

  function randomHabitatPoint() {
    return {
      x: rand(HABITAT.x + 40, HABITAT.x + HABITAT.w - 40),
      y: rand(HABITAT.y + 70, HABITAT.y + HABITAT.h - 30),
    };
  }

  function moveToward(mote, tx, ty, dt, speedMul) {
    const d = dist(mote.x, mote.y, tx, ty);
    const baseSpeed = 46; // px/sec
    const speed = baseSpeed * speedMul;
    if (d > 1.5) {
      const dx = (tx - mote.x) / d;
      const dy = (ty - mote.y) / d;
      mote.facing = dx >= 0 ? 1 : -1;
      const step = Math.min(speed * dt, d);
      mote.x += dx * step;
      mote.y += dy * step;
      mote.vx = dx * speed;
      mote.vy = dy * speed;
    } else {
      mote.vx = 0;
      mote.vy = 0;
    }
    mote.x = clamp(mote.x, HABITAT.x + 14, HABITAT.x + HABITAT.w - 14);
    mote.y = clamp(mote.y, HABITAT.y + 50, HABITAT.y + HABITAT.h - 14);
  }

  function updateNeeds(mote, dt) {
    const eating = mote.activity === "eating";
    const drinking = mote.activity === "drinking";
    const resting = mote.activity === "resting";

    if (!eating) mote.hunger = clamp(mote.hunger + NEED.hungerRate * dt, 0, 100);
    if (!drinking) mote.thirst = clamp(mote.thirst + NEED.thirstRate * dt, 0, 100);

    if (!resting && mote.energy > 0) {
      const needy = mote.hunger > 70 || mote.thirst > 70;
      let decay = needy ? NEED.energyDecayNeedy : NEED.energyDecayBase;

      const lamp = state.interventions.find((iv) => iv.type === "lamp");
      if (lamp && dist(mote.x, mote.y, lamp.x, lamp.y) < LAMP_RADIUS) {
        decay *= NEED.lampDecayMultiplier;
      }

      if (mote.hunger < 40 && mote.thirst < 40) {
        mote.energy = clamp(mote.energy + NEED.energyIdleRegen * dt, 0, 100);
      } else {
        mote.energy = clamp(mote.energy - decay * dt, 0, 100);
      }
    }
  }

  // ---------------------------------------------------------------------
  // 5. Intervention effects
  // ---------------------------------------------------------------------

  function applyIntervention(mote, iv, dt) {
    if (iv.type === "food") {
      mote.hunger = clamp(mote.hunger - NEED.foodRate * dt, 0, 100);
      spawnParticle(iv.x, iv.y - 6, "#ffcf7a");
      if (mote.hunger <= THRESH.foodSatisfied) {
        pushMessage(`${mote.name} finished eating.`, `fed-${mote.id}`, 8);
      }
    } else if (iv.type === "water") {
      mote.thirst = clamp(mote.thirst - NEED.waterRate * dt, 0, 100);
      spawnParticle(iv.x, iv.y - 4, "#8fe0ff");
      if (mote.thirst <= THRESH.waterSatisfied) {
        pushMessage(`${mote.name} had a good drink.`, `water-${mote.id}`, 8);
      }
    } else if (iv.type === "shelter") {
      const wasExhausted = mote.energy <= 0;
      mote.energy = clamp(mote.energy + NEED.shelterRate * dt, 0, 100);
      spawnParticle(iv.x, iv.y - 10, "#bfe8bf");
      if (wasExhausted && mote.energy > 0) {
        pushMessage(`${mote.name} is recovering in shelter.`, `recover-${mote.id}`, 10);
      }
      if (mote.energy >= THRESH.shelterSatisfied) {
        pushMessage(`${mote.name} feels rested.`, `rested-${mote.id}`, 8);
      }
    }
  }

  function spawnParticle(x, y, color) {
    if (state.particles.length > 60) return;
    state.particles.push({
      x: x + rand(-6, 6),
      y: y + rand(-4, 4),
      vy: rand(-14, -22),
      life: 1,
      color,
    });
  }

  // ---------------------------------------------------------------------
  // 6. Rendering
  // ---------------------------------------------------------------------

  let canvas, ctx;
  let drawScale = 1;
  let bgStars = [];
  let bgMoss = [];

  function setupCanvas() {
    canvas = document.getElementById("terrarium");
    ctx = canvas.getContext("2d");
    initDecor();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function initDecor() {
    bgStars = [];
    for (let i = 0; i < 26; i++) {
      bgStars.push({
        x: rand(HABITAT.x, HABITAT.x + HABITAT.w),
        y: rand(HABITAT.y, HABITAT.y + HABITAT.h * 0.55),
        r: rand(0.6, 1.8),
        phase: Math.random() * Math.PI * 2,
      });
    }
    bgMoss = [];
    for (let i = 0; i < 10; i++) {
      bgMoss.push({
        x: rand(HABITAT.x + 10, HABITAT.x + HABITAT.w - 10),
        r: rand(18, 42),
        tone: rand(0, 1),
      });
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    drawScale = (w / WORLD_W) * dpr;
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
  }

  function render(t) {
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    drawBackground(t);
    drawInterventions(t);
    drawParticles();
    drawMotes(t);
    drawGlassOverlay();
  }

  function drawBackground(t) {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, "#0d1330");
    g.addColorStop(0.55, "#0a0f24");
    g.addColorStop(1, "#141024");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Soft moonlight glow, top-right
    const moonX = HABITAT.x + HABITAT.w - 90;
    const moonY = HABITAT.y + 60;
    const mg = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 220);
    mg.addColorStop(0, "rgba(210,220,255,0.22)");
    mg.addColorStop(1, "rgba(210,220,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = "rgba(235,240,255,0.85)";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Stars / drifting dust
    for (const s of bgStars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 1.2 + s.phase);
      ctx.globalAlpha = 0.25 + tw * 0.4;
      ctx.fillStyle = "#dfe6ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y + Math.sin(t * 0.3 + s.phase) * 4, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Soil layer
    const soilTop = HABITAT.y + HABITAT.h - 70;
    const soilGrad = ctx.createLinearGradient(0, soilTop, 0, HABITAT.y + HABITAT.h);
    soilGrad.addColorStop(0, "#241c22");
    soilGrad.addColorStop(1, "#150f14");
    ctx.fillStyle = soilGrad;
    ctx.fillRect(HABITAT.x, soilTop, HABITAT.w, HABITAT.y + HABITAT.h - soilTop);

    // Moss mounds along the soil line
    for (const m of bgMoss) {
      ctx.fillStyle = m.tone > 0.5 ? "rgba(76,110,78,0.55)" : "rgba(58,88,63,0.55)";
      ctx.beginPath();
      ctx.ellipse(m.x, soilTop + 4, m.r, m.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few small stones
    ctx.fillStyle = "rgba(90,92,102,0.6)";
    [
      [HABITAT.x + 70, soilTop - 4, 10, 6],
      [HABITAT.x + HABITAT.w - 130, soilTop - 2, 14, 7],
      [HABITAT.x + HABITAT.w / 2 + 40, soilTop - 6, 8, 5],
    ].forEach(([x, y, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // A couple of simple plant silhouettes rising from the soil
    drawPlant(HABITAT.x + 34, soilTop + 2, t, 1);
    drawPlant(HABITAT.x + HABITAT.w - 46, soilTop + 2, t, -1);
    drawPlant(HABITAT.x + HABITAT.w * 0.62, soilTop + 4, t, 1, 0.7);
  }

  function drawPlant(x, y, t, dir, scale = 1) {
    const sway = Math.sin(t * 0.8 + x) * 3 * dir;
    ctx.strokeStyle = "rgba(84,120,90,0.7)";
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const h = (34 + i * 8) * scale;
      const lean = (sway + i * 4 * dir);
      ctx.beginPath();
      ctx.moveTo(x + i * 6 * dir, y);
      ctx.quadraticCurveTo(x + i * 6 * dir + lean, y - h * 0.6, x + i * 6 * dir + lean * 1.4, y - h);
      ctx.stroke();
    }
  }

  function drawInterventions(t) {
    for (const iv of state.interventions) {
      switch (iv.type) {
        case "food": drawFood(iv, t); break;
        case "water": drawWater(iv, t); break;
        case "shelter": drawShelter(iv, t); break;
        case "lamp": drawLamp(iv, t); break;
      }
    }
  }

  function drawFood(iv, t) {
    const { x, y } = iv;
    ctx.fillStyle = "#5a3d24";
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a5330";
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // food pieces
    const bob = Math.sin(t * 2) * 1;
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = "#ffcf7a";
      ctx.beginPath();
      ctx.arc(x + i * 7, y + bob, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWater(iv, t) {
    const { x, y } = iv;
    ctx.fillStyle = "rgba(90,180,220,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(120,210,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // ripple rings
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.6 + i * 0.5) % 1.4;
      ctx.strokeStyle = `rgba(180,230,255,${0.35 * (1 - phase / 1.4)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + phase * 22, 4 + phase * 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawShelter(iv, t) {
    const { x, y } = iv;
    ctx.fillStyle = "#3a2f22";
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // dome hut body
    ctx.fillStyle = "#4c5b3d";
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 12);
    ctx.quadraticCurveTo(x - 24, y - 26, x, y - 30);
    ctx.quadraticCurveTo(x + 24, y - 26, x + 26, y + 12);
    ctx.closePath();
    ctx.fill();
    // leaf roof texture
    ctx.fillStyle = "#5f7a4c";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 9, y - 6 + Math.abs(i) * 4, 9, 5, 0.3 * i, 0, Math.PI * 2);
      ctx.fill();
    }
    // dark entrance
    const glow = 0.4 + 0.15 * Math.sin(t * 1.5);
    ctx.fillStyle = "#0c0a08";
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,207,122,${glow * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLamp(iv, t) {
    const { x, y } = iv;
    // glow
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.4);
    const g = ctx.createRadialGradient(x, y - 34, 2, x, y - 34, LAMP_RADIUS * 0.6);
    g.addColorStop(0, `rgba(214,179,255,${0.35 * pulse})`);
    g.addColorStop(1, "rgba(214,179,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 34, LAMP_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // pole
    ctx.strokeStyle = "#5a5468";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x, y - 28);
    ctx.stroke();
    // base
    ctx.fillStyle = "#3f3a4a";
    ctx.beginPath();
    ctx.ellipse(x, y + 15, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // crescent lamp head
    ctx.save();
    ctx.translate(x, y - 34);
    ctx.fillStyle = "#f4e4ff";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d1330";
    ctx.beginPath();
    ctx.arc(4, -2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(t) {
    for (const m of state.motes) {
      const bob = Math.sin(t * 2.2 + m.bobPhase) * 2.5;
      const isExhausted = m.energy <= 0;
      const flicker = isExhausted ? 0.45 + 0.2 * Math.sin(t * 5 + m.exhaustedFlicker) : 1;

      ctx.save();
      ctx.translate(m.x, m.y + bob);

      // glow halo
      const glowR = m.size * (isExhausted ? 2.4 : 3.4);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      g.addColorStop(0, m.glow.replace(/0\.55\)/, `${0.55 * flicker})`));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // body
      ctx.globalAlpha = flicker;
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.size, m.size * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      // small trailing fin to sell direction/species difference
      ctx.fillStyle = m.color;
      ctx.globalAlpha = flicker * 0.7;
      ctx.beginPath();
      ctx.moveTo(-m.facing * m.size * 0.9, 0);
      ctx.quadraticCurveTo(-m.facing * m.size * 1.8, m.size * 0.6, -m.facing * m.size * 1.2, m.size * 1.1);
      ctx.quadraticCurveTo(-m.facing * m.size * 0.6, m.size * 0.5, -m.facing * m.size * 0.9, 0);
      ctx.fill();

      // eye glimmer
      ctx.globalAlpha = flicker;
      ctx.fillStyle = "#fffdf5";
      ctx.beginPath();
      ctx.arc(m.facing * m.size * 0.3, -m.size * 0.15, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();

      // selection ring
      if (state.selectedMoteId === m.id) {
        ctx.strokeStyle = "rgba(255,207,122,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y + bob, m.size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawGlassOverlay() {
    // subtle top highlight sweep + edge vignette to sell "glass tank"
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H * 0.4);
    g.addColorStop(0, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H * 0.4);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 40;
    ctx.strokeRect(20, 20, WORLD_W - 40, WORLD_H - 40);

    const vg = ctx.createRadialGradient(
      WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.3,
      WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.75
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  // ---------------------------------------------------------------------
  // 7. Input handling (Pointer Events)
  // ---------------------------------------------------------------------

  function worldPointFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD_W / rect.width;
    const scaleY = WORLD_H / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  function setupInput() {
    canvas.addEventListener("pointerdown", onCanvasPointerDown);

    document.getElementById("btnFood").addEventListener("pointerdown", () => selectIntervention("food"));
    document.getElementById("btnWater").addEventListener("pointerdown", () => selectIntervention("water"));
    document.getElementById("btnShelter").addEventListener("pointerdown", () => selectIntervention("shelter"));
    document.getElementById("btnLamp").addEventListener("pointerdown", () => selectIntervention("lamp"));

    document.getElementById("pauseBtn").addEventListener("pointerdown", togglePause);
    document.getElementById("restartBtn").addEventListener("pointerdown", restartGame);
    document.getElementById("restartBtnVictory").addEventListener("pointerdown", restartGame);
    document.getElementById("restartBtnLoss").addEventListener("pointerdown", restartGame);
    document.getElementById("startBtn").addEventListener("pointerdown", beginGame);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        state.autoPaused = state.started && !state.ended && !state.paused;
        if (state.autoPaused) state.paused = true;
      } else if (state.autoPaused) {
        state.autoPaused = false;
        if (!state.manualPause) state.paused = false;
      }
      updatePauseUI();
    });
  }

  function onCanvasPointerDown(evt) {
    if (!state.started || state.ended || state.paused) return;
    const p = worldPointFromEvent(evt);

    if (state.pendingInterventionType && !state.interventionUsedThisNight) {
      if (p.x >= HABITAT.x + 20 && p.x <= HABITAT.x + HABITAT.w - 20 &&
          p.y >= HABITAT.y + 20 && p.y <= HABITAT.y + HABITAT.h - 10) {
        placeIntervention(state.pendingInterventionType, p.x, p.y);
      }
      return;
    }

    // Otherwise try to select a mote.
    let closest = null;
    let closestD = 26;
    for (const m of state.motes) {
      const d = dist(p.x, p.y, m.x, m.y);
      if (d < closestD) {
        closestD = d;
        closest = m;
      }
    }
    state.selectedMoteId = closest ? closest.id : state.selectedMoteId;
    renderMoteInfo();
  }

  function selectIntervention(type) {
    if (state.interventionUsedThisNight || !state.started || state.ended) return;
    state.pendingInterventionType = state.pendingInterventionType === type ? null : type;
    updateInterventionButtons();
  }

  function placeIntervention(type, x, y) {
    state.interventions.push({ type, x, y, id: Date.now() + Math.random() });
    state.interventionUsedThisNight = true;
    state.pendingInterventionType = null;
    updateInterventionButtons();
    const label = { food: "Food", water: "Water", shelter: "Shelter", lamp: "A moon lamp" }[type];
    pushMessage(`${label} placed for the colony tonight.`, null);
  }

  // ---------------------------------------------------------------------
  // 8. UI / DOM updates
  // ---------------------------------------------------------------------

  let dom = {};

  function cacheDom() {
    dom = {
      nightValue: document.getElementById("nightValue"),
      timeValue: document.getElementById("timeValue"),
      colonyValue: document.getElementById("colonyValue"),
      moteInfo: document.getElementById("moteInfo"),
      happeningsList: document.getElementById("happeningsList"),
      interventionHint: document.getElementById("interventionHint"),
      pauseBtn: document.getElementById("pauseBtn"),
      pauseBanner: document.getElementById("pauseBanner"),
      startOverlay: document.getElementById("startOverlay"),
      victoryOverlay: document.getElementById("victoryOverlay"),
      lossOverlay: document.getElementById("lossOverlay"),
      btnFood: document.getElementById("btnFood"),
      btnWater: document.getElementById("btnWater"),
      btnShelter: document.getElementById("btnShelter"),
      btnLamp: document.getElementById("btnLamp"),
    };
  }

  function updateInterventionButtons() {
    const map = { food: dom.btnFood, water: dom.btnWater, shelter: dom.btnShelter, lamp: dom.btnLamp };
    for (const [type, btn] of Object.entries(map)) {
      btn.disabled = state.interventionUsedThisNight;
      btn.classList.toggle("selected", state.pendingInterventionType === type);
    }
    dom.interventionHint.textContent = state.interventionUsedThisNight
      ? "Tonight's gift has been placed. More choices arrive at dawn."
      : state.pendingInterventionType
        ? "Tap inside the terrarium to place it."
        : "Choose a gift, then tap inside the terrarium to place it.";
  }

  function renderMoteInfo() {
    const m = state.motes.find((mm) => mm.id === state.selectedMoteId);
    if (!m) {
      dom.moteInfo.innerHTML = `<p>Tap a Mote in the terrarium to see how it's doing.</p>`;
      dom.moteInfo.classList.add("mote-info--empty");
      return;
    }
    dom.moteInfo.classList.remove("mote-info--empty");
    const activityText = ACTIVITY_LABEL[m.activity] || "Wandering";
    dom.moteInfo.innerHTML = `
      <div class="mote-info-name" style="color:${m.color}">${m.name}</div>
      <div class="mote-info-activity">${activityText}</div>
      ${meterRow("Hunger", m.hunger, "hunger")}
      ${meterRow("Thirst", m.thirst, "thirst")}
      ${meterRow("Energy", m.energy, "energy")}
    `;
  }

  function meterRow(label, value, cls) {
    const v = clamp(value, 0, 100);
    return `
      <div class="meter-row">
        <div class="meter-label"><span>${label}</span><span>${Math.round(v)}</span></div>
        <div class="meter-track"><div class="meter-fill ${cls}" style="width:${v}%"></div></div>
      </div>
    `;
  }

  function renderHappenings() {
    dom.happeningsList.textContent = state.messages.slice(-4).join("  •  ");
  }

  function colonyConditionText() {
    if (!state.started) return "Settling in…";
    const active = state.motes.filter((m) => m.energy > 0);
    if (active.length === 0) return "Colony still";
    const avg = active.reduce((s, m) => s + (100 - m.hunger) + (100 - m.thirst) + m.energy, 0) / (active.length * 3);
    if (avg > 70) return "Thriving";
    if (avg > 45) return "Steady";
    if (avg > 25) return "Struggling";
    return "Critical";
  }

  function updateTopBar() {
    dom.nightValue.textContent = `${Math.min(state.night, TOTAL_NIGHTS)} / ${TOTAL_NIGHTS}`;
    dom.timeValue.textContent = fmtTime(state.timeLeft);
    dom.colonyValue.textContent = colonyConditionText();
  }

  function updatePauseUI() {
    dom.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    dom.pauseBanner.classList.toggle("hidden", !state.paused || state.ended || !state.started);
  }

  // ---------------------------------------------------------------------
  // 9. Game progression
  // ---------------------------------------------------------------------

  function beginGame() {
    if (state.started) return;
    state.started = true;
    dom.startOverlay.classList.add("hidden");
    pushMessage("Night 1 begins. The terrarium stirs to life.", null);
    updateTopBar();
  }

  function togglePause() {
    if (!state.started || state.ended) return;
    state.manualPause = !state.manualPause;
    state.paused = state.manualPause;
    updatePauseUI();
  }

  function restartGame() {
    state = createState();
    cacheDomInvalidateSelection();
    dom.startOverlay.classList.remove("hidden");
    dom.victoryOverlay.classList.add("hidden");
    dom.lossOverlay.classList.add("hidden");
    dom.pauseBanner.classList.add("hidden");
    dom.pauseBtn.textContent = "Pause";
    updateInterventionButtons();
    renderMoteInfo();
    renderHappenings();
    updateTopBar();
  }

  function cacheDomInvalidateSelection() {
    // no-op placeholder kept for clarity / future teardown hooks
  }

  function advanceNight() {
    if (state.night >= TOTAL_NIGHTS) {
      endGame(checkAnyActive() ? "victory" : "loss");
      return;
    }
    state.night += 1;
    state.timeLeft = NIGHT_DURATION;
    state.interventions = [];
    for (const m of state.motes) m.lockedType = null;
    state.interventionUsedThisNight = false;
    state.pendingInterventionType = null;
    updateInterventionButtons();
    pushMessage(`Night ${state.night} begins.`, null);
  }

  function checkAnyActive() {
    return state.motes.some((m) => m.energy > 0);
  }

  function endGame(outcome) {
    state.ended = true;
    state.outcome = outcome;
    if (outcome === "victory") {
      dom.victoryOverlay.classList.remove("hidden");
    } else {
      dom.lossOverlay.classList.remove("hidden");
    }
  }

  // ---------------------------------------------------------------------
  // 10. Main loop
  // ---------------------------------------------------------------------

  function tick(now) {
    requestAnimationFrame(tick);

    if (state.lastFrameTime === null) state.lastFrameTime = now;
    let dt = (now - state.lastFrameTime) / 1000;
    state.lastFrameTime = now;
    dt = clamp(dt, 0, MAX_DT);

    const tSec = now / 1000;

    if (state.started && !state.paused && !state.ended) {
      update(dt);
    }

    render(tSec);
    updateTopBar();
    if (state.selectedMoteId !== null) renderMoteInfo();
  }

  function update(dt) {
    for (const m of state.motes) {
      decideActivity(m, dt);
      updateNeeds(m, dt);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.y += p.vy * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    if (!checkAnyActive()) {
      endGame("loss");
      return;
    }

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      advanceNight();
    }
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  function boot() {
    cacheDom();
    setupCanvas();
    setupInput();
    updateInterventionButtons();
    renderMoteInfo();
    updateTopBar();
    updatePauseUI();
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
