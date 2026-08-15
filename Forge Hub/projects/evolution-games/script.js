"use strict";

/* =========================================================================
   Evolution Games — Natural Selection Playground
   A lightweight canvas-based evolution simulation.
   Sections: Utilities -> Food -> Creature -> Simulation -> UI wiring
   ========================================================================= */

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------
const Util = {
  rand(min, max) {
    return min + Math.random() * (max - min);
  },
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },
  dist2(x1, y1, x2, y2) {
    const dx = x1 - x2, dy = y1 - y2;
    return dx * dx + dy * dy;
  }
};

// Trait ranges — tuned so no single trait dominates.
// Higher speed / vision / size all raise energy cost; efficiency offsets cost.
const TRAITS = {
  speed:      { min: 18,  max: 95  },  // px / second
  vision:     { min: 35,  max: 190 }, // px radius
  size:       { min: 4,   max: 15  }, // px radius (also collision radius)
  efficiency: { min: 0.6, max: 1.6 }  // energy cost divider (higher = cheaper)
};

function randomTraits() {
  return {
    speed: Util.rand(TRAITS.speed.min, TRAITS.speed.max),
    vision: Util.rand(TRAITS.vision.min, TRAITS.vision.max),
    size: Util.rand(TRAITS.size.min, TRAITS.size.max),
    efficiency: Util.rand(TRAITS.efficiency.min, TRAITS.efficiency.max)
  };
}

function mutateTraits(parentTraits, mutationRate) {
  const child = {};
  for (const key in TRAITS) {
    let value = parentTraits[key];
    if (Math.random() < mutationRate) {
      const range = TRAITS[key].max - TRAITS[key].min;
      const delta = (Math.random() * 2 - 1) * range * 0.18; // jitter magnitude
      value = Util.clamp(value + delta, TRAITS[key].min, TRAITS[key].max);
    }
    child[key] = value;
  }
  return child;
}

// ---------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------
class Food {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 2.5;
    this.energy = Util.rand(22, 34);
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#6ee7a0";
    ctx.shadowColor = "#6ee7a0";
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ---------------------------------------------------------------------
// Creature
// ---------------------------------------------------------------------
let creatureIdCounter = 1;

class Creature {
  constructor(x, y, traits) {
    this.id = creatureIdCounter++;
    this.x = x;
    this.y = y;
    this.traits = traits;
    this.energy = 100;
    this.age = 0; // seconds alive
    this.angle = Math.random() * Math.PI * 2;
    this.wanderTarget = Math.random() * Math.PI * 2;
    this.wanderTimer = Util.rand(0.5, 2);
    this.alive = true;
    this.foodEaten = 0;
  }

  // Energy cost per second, shaped so every trait has a real tradeoff.
  costPerSecond() {
    const { speed, vision, size, efficiency } = this.traits;
    const raw = 0.5 + speed * 0.045 + size * 0.16 + vision * 0.009;
    return raw / efficiency;
  }

  // Find nearest visible food within vision range.
  findNearestFood(foodList) {
    let nearest = null;
    let nearestD2 = this.traits.vision * this.traits.vision;
    for (const f of foodList) {
      const d2 = Util.dist2(this.x, this.y, f.x, f.y);
      if (d2 < nearestD2) {
        nearestD2 = d2;
        nearest = f;
      }
    }
    return nearest;
  }

  update(dt, world, foodList) {
    if (!this.alive) return;

    this.age += dt;

    const target = this.findNearestFood(foodList);
    let desiredAngle;

    if (target) {
      desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
    } else {
      // Wander: periodically pick a new drifting direction.
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTarget = this.angle + Util.rand(-1.2, 1.2);
        this.wanderTimer = Util.rand(0.6, 1.8);
      }
      desiredAngle = this.wanderTarget;
    }

    // Smooth turning toward desired angle.
    let diff = desiredAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 4.5; // radians/sec max turn
    this.angle += Util.clamp(diff, -turnRate * dt, turnRate * dt);

    // Move.
    const speedPxPerSec = this.traits.speed;
    this.x += Math.cos(this.angle) * speedPxPerSec * dt;
    this.y += Math.sin(this.angle) * speedPxPerSec * dt;

    // Bounce off world boundaries.
    const r = this.traits.size;
    if (this.x < r) { this.x = r; this.angle = Math.PI - this.angle; }
    if (this.x > world.width - r) { this.x = world.width - r; this.angle = Math.PI - this.angle; }
    if (this.y < r) { this.y = r; this.angle = -this.angle; }
    if (this.y > world.height - r) { this.y = world.height - r; this.angle = -this.angle; }

    // Energy drain.
    this.energy -= this.costPerSecond() * dt;

    // Eat any food within collision radius.
    for (let i = foodList.length - 1; i >= 0; i--) {
      const f = foodList[i];
      const rr = (r + f.radius) * (r + f.radius);
      if (Util.dist2(this.x, this.y, f.x, f.y) <= rr) {
        this.energy = Math.min(150, this.energy + f.energy);
        this.foodEaten++;
        foodList.splice(i, 1);
      }
    }

    if (this.energy <= 0) {
      this.alive = false;
    }
  }

  draw(ctx, isSelected) {
    const { speed, size, efficiency } = this.traits;

    // Color encodes speed: slow = cool cyan, fast = warm orange/red.
    const speedT = Util.clamp((speed - TRAITS.speed.min) / (TRAITS.speed.max - TRAITS.speed.min), 0, 1);
    const hue = 190 - speedT * 190; // 190 (cyan) -> 0 (red)
    const energyT = Util.clamp(this.energy / 100, 0, 1);
    const lightness = 35 + energyT * 25;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Efficiency ring: brighter/thicker ring = more energy-efficient creature.
    const effT = Util.clamp((efficiency - TRAITS.efficiency.min) / (TRAITS.efficiency.max - TRAITS.efficiency.min), 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, size + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(140, 70%, 60%, ${0.15 + effT * 0.45})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Body.
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 75%, ${lightness}%)`;
    ctx.fill();

    // Direction nub (shows facing/movement).
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(0) * (size + 4), Math.sin(0) * (size + 4));
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(size * 0.2, 0);
    ctx.lineTo(size + 4, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, size + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#4fd8e8";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Show vision radius for the selected creature.
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.traits.vision, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(79, 216, 232, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------
class Simulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = { width: canvas.width, height: canvas.height };

    this.populationTarget = 50;
    this.foodTarget = 130;
    this.foodMax = 160;
    this.generationDuration = 25; // simulated seconds per generation

    this.creatures = [];
    this.food = [];
    this.generation = 1;
    this.genTimer = 0;
    this.deathsThisGen = 0;
    this.paused = false;
    this.speedMultiplier = 1;
    this.mutationRate = 0.10;
    this.selectedCreature = null;

    this.lastGenAverages = null;
    this.lastViableGenePool = null; // backup pool for extinction recovery

    this.onEvent = null; // callback(message, type)
    this.onGenerationEnd = null; // callback(stats)

    this._loggedLowPopThisGen = false;

    this.initPopulation();
    this.spawnFood(this.foodTarget);
  }

  initPopulation() {
    this.creatures = [];
    for (let i = 0; i < this.populationTarget; i++) {
      this.creatures.push(this.spawnCreature(randomTraits()));
    }
  }

  spawnCreature(traits) {
    const margin = 20;
    const x = Util.rand(margin, this.world.width - margin);
    const y = Util.rand(margin, this.world.height - margin);
    return new Creature(x, y, traits);
  }

  spawnFood(count) {
    const margin = 10;
    for (let i = 0; i < count; i++) {
      const x = Util.rand(margin, this.world.width - margin);
      const y = Util.rand(margin, this.world.height - margin);
      this.food.push(new Food(x, y));
    }
  }

  log(message, type) {
    if (this.onEvent) this.onEvent(message, type || "info");
  }

  // Advance simulation by one fixed timestep (seconds).
  step(dt) {
    if (this.paused) return;

    this.genTimer += dt;

    // Trickle food respawn to keep things dynamic without infinite food.
    if (this.food.length < this.foodMax && Math.random() < 0.04) {
      this.spawnFood(1);
    }

    for (const c of this.creatures) {
      c.update(dt, this.world, this.food);
    }

    // Remove the dead, counting them.
    const before = this.creatures.length;
    this.creatures = this.creatures.filter(c => c.alive);
    const diedNow = before - this.creatures.length;
    if (diedNow > 0) this.deathsThisGen += diedNow;

    if (this.selectedCreature && !this.selectedCreature.alive) {
      this.selectedCreature = null;
    }

    // Population-drop notice (once per generation).
    if (!this._loggedLowPopThisGen && this.creatures.length > 0 &&
        this.creatures.length <= Math.floor(this.populationTarget * 0.4)) {
      this.log(`Population dropped to ${this.creatures.length}`, "death");
      this._loggedLowPopThisGen = true;
    }

    // End generation when timer elapses or everyone has died.
    if (this.genTimer >= this.generationDuration || this.creatures.length === 0) {
      this.endGeneration();
    }
  }

  computeAverages(list) {
    if (list.length === 0) return null;
    const sum = { speed: 0, vision: 0, size: 0, efficiency: 0 };
    for (const c of list) {
      sum.speed += c.traits.speed;
      sum.vision += c.traits.vision;
      sum.size += c.traits.size;
      sum.efficiency += c.traits.efficiency;
    }
    const n = list.length;
    return {
      speed: sum.speed / n,
      vision: sum.vision / n,
      size: sum.size / n,
      efficiency: sum.efficiency / n
    };
  }

  endGeneration() {
    const survivors = this.creatures;

    if (survivors.length === 0) {
      this.log(`Generation ${this.generation} wiped out — entire population died`, "death");
      let seedPool = this.lastViableGenePool;
      if (seedPool && seedPool.length > 0) {
        this.log("Regenerating population from the last viable gene pool", "evolve");
        this.creatures = [];
        for (let i = 0; i < this.populationTarget; i++) {
          const parent = seedPool[Math.floor(Math.random() * seedPool.length)];
          this.creatures.push(this.spawnCreature(mutateTraits(parent, this.mutationRate)));
        }
      } else {
        this.log("No prior gene pool available — generating a fresh random population", "evolve");
        this.initPopulation();
      }
    } else {
      // Store this generation's genetics as a recovery backup.
      this.lastViableGenePool = survivors.map(c => c.traits);

      const avgBefore = this.lastGenAverages;
      const avgAfter = this.computeAverages(survivors);

      // Weighted reproduction: fitter (higher energy) survivors are more likely parents.
      const totalFitness = survivors.reduce((s, c) => s + Math.max(1, c.energy), 0);
      const nextPopSize = Util.clamp(Math.round(survivors.length * 2.2), 15, 70);

      const newCreatures = [];
      // Elitism: carry the single fittest creature's traits forward unmutated.
      const fittest = survivors.reduce((a, b) => (a.energy > b.energy ? a : b));
      newCreatures.push(this.spawnCreature({ ...fittest.traits }));

      while (newCreatures.length < nextPopSize) {
        let r = Math.random() * totalFitness;
        let chosen = survivors[survivors.length - 1];
        for (const c of survivors) {
          r -= Math.max(1, c.energy);
          if (r <= 0) { chosen = c; break; }
        }
        newCreatures.push(this.spawnCreature(mutateTraits(chosen.traits, this.mutationRate)));
      }

      this.creatures = newCreatures;

      // Log a notable trait shift (avoid flooding: only log meaningful deltas).
      if (avgBefore && avgAfter) {
        const checks = [
          ["speed", "Average speed"],
          ["vision", "Average vision"],
          ["size", "Average size"],
          ["efficiency", "Average efficiency"]
        ];
        for (const [key, label] of checks) {
          const before = avgBefore[key];
          const after = avgAfter[key];
          const pctChange = (after - before) / before;
          if (Math.abs(pctChange) > 0.06) {
            this.log(`${label} ${pctChange > 0 ? "increased" : "decreased"}`, "evolve");
          }
        }
      }
      this.lastGenAverages = avgAfter;
    }

    this.log(`Generation ${this.generation} completed`, "gen");

    // Reset for next generation.
    this.generation++;
    this.genTimer = 0;
    this.deathsThisGen = 0;
    this._loggedLowPopThisGen = false;
    this.food = [];
    this.spawnFood(this.foodTarget);
    this.selectedCreature = null;

    this.log(`Generation ${this.generation} started`, "gen");

    if (this.onGenerationEnd) this.onGenerationEnd();
  }

  restart() {
    creatureIdCounter = 1;
    this.generation = 1;
    this.genTimer = 0;
    this.deathsThisGen = 0;
    this._loggedLowPopThisGen = false;
    this.lastGenAverages = null;
    this.lastViableGenePool = null;
    this.selectedCreature = null;
    this.food = [];
    this.initPopulation();
    this.spawnFood(this.foodTarget);
    this.log("Simulation restarted", "gen");
    this.log("Generation 1 started", "gen");
  }

  // Find the creature nearest to a world-space click point (within a hit radius).
  pickCreatureAt(x, y) {
    let closest = null;
    let closestD2 = Infinity;
    for (const c of this.creatures) {
      const hitR = c.traits.size + 6;
      const d2 = Util.dist2(x, y, c.x, c.y);
      if (d2 <= hitR * hitR && d2 < closestD2) {
        closestD2 = d2;
        closest = c;
      }
    }
    return closest;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.world.width, this.world.height);

    for (const f of this.food) f.draw(ctx);
    for (const c of this.creatures) c.draw(ctx, c === this.selectedCreature);
  }
}

// ---------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------
(function initUI() {
  const canvas = document.getElementById("world");
  const sim = new Simulation(canvas);

  const el = {
    statGen: document.getElementById("statGen"),
    statPop: document.getElementById("statPop"),
    statFood: document.getElementById("statFood"),
    statDeaths: document.getElementById("statDeaths"),
    statSpeed: document.getElementById("statSpeed"),
    statVision: document.getElementById("statVision"),
    statSize: document.getElementById("statSize"),
    statEfficiency: document.getElementById("statEfficiency"),
    selectedInfo: document.getElementById("selectedInfo"),
    eventLog: document.getElementById("eventLog"),
    btnPause: document.getElementById("btnPause"),
    btnRestart: document.getElementById("btnRestart"),
    speedSelect: document.getElementById("speedSelect"),
    mutationSlider: document.getElementById("mutationSlider"),
    mutationValue: document.getElementById("mutationValue")
  };

  // --- Event log (capped, no per-frame flooding) ---
  const MAX_LOG_ENTRIES = 60;
  sim.onEvent = (message, type) => {
    const entry = document.createElement("div");
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    entry.innerHTML = `<span class="log-tag">[${time}]</span>${message}`;
    el.eventLog.appendChild(entry);
    while (el.eventLog.children.length > MAX_LOG_ENTRIES) {
      el.eventLog.removeChild(el.eventLog.firstChild);
    }
  };
  sim.log("Generation 1 started", "gen");

  // --- Stats panel ---
  function updateStats() {
    el.statGen.textContent = sim.generation;
    el.statPop.textContent = sim.creatures.length;
    el.statFood.textContent = sim.food.length;
    el.statDeaths.textContent = sim.deathsThisGen;

    const avg = sim.computeAverages(sim.creatures);
    if (avg) {
      el.statSpeed.textContent = avg.speed.toFixed(1);
      el.statVision.textContent = avg.vision.toFixed(0);
      el.statSize.textContent = avg.size.toFixed(1);
      el.statEfficiency.textContent = avg.efficiency.toFixed(2);
    } else {
      el.statSpeed.textContent = "0";
      el.statVision.textContent = "0";
      el.statSize.textContent = "0";
      el.statEfficiency.textContent = "0";
    }
  }

  function updateSelectedPanel() {
    const c = sim.selectedCreature;
    if (!c || !c.alive) {
      el.selectedInfo.innerHTML = `<p class="muted">Click a creature to inspect its traits.</p>`;
      return;
    }
    el.selectedInfo.innerHTML = `
      <div class="trait-row"><span>Energy</span><span>${c.energy.toFixed(1)}</span></div>
      <div class="trait-row"><span>Speed</span><span>${c.traits.speed.toFixed(1)}</span></div>
      <div class="trait-row"><span>Vision</span><span>${c.traits.vision.toFixed(0)}</span></div>
      <div class="trait-row"><span>Size</span><span>${c.traits.size.toFixed(1)}</span></div>
      <div class="trait-row"><span>Efficiency</span><span>${c.traits.efficiency.toFixed(2)}</span></div>
      <div class="trait-row"><span>Age</span><span>${c.age.toFixed(1)}s</span></div>
      <div class="trait-row"><span>Food Eaten</span><span>${c.foodEaten}</span></div>
    `;
  }

  // --- Controls ---
  el.btnPause.addEventListener("click", () => {
    sim.paused = !sim.paused;
    el.btnPause.textContent = sim.paused ? "Resume" : "Pause";
    el.btnPause.classList.toggle("active-state", sim.paused);
  });

  el.btnRestart.addEventListener("click", () => {
    sim.restart();
    el.btnPause.textContent = "Pause";
    el.btnPause.classList.remove("active-state");
    sim.paused = false;
  });

  el.speedSelect.addEventListener("change", () => {
    sim.speedMultiplier = parseInt(el.speedSelect.value, 10);
  });

  el.mutationSlider.addEventListener("input", () => {
    const pct = parseInt(el.mutationSlider.value, 10);
    sim.mutationRate = pct / 100;
    el.mutationValue.textContent = `${pct}%`;
  });

  canvas.addEventListener("click", (evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    sim.selectedCreature = sim.pickCreatureAt(x, y);
    updateSelectedPanel();
  });

  // --- Main loop ---
  const FIXED_DT = 1 / 60;
  let lastTime = performance.now();

  function frame(now) {
    const rawDelta = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (!sim.paused) {
      const steps = sim.speedMultiplier;
      for (let i = 0; i < steps; i++) {
        sim.step(FIXED_DT);
      }
    }

    sim.draw();
    updateStats();
    updateSelectedPanel();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
