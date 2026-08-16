/*
 * Small World (HTML Edition)
 * A self-contained browser reinterpretation of the Small World Unity life-sim.
 * Worldlings wander a little habitat, eat, sleep, befriend each other, raise
 * families, grow old, and occasionally get spooked by forest ghosts at night.
 * Not a port of the Unity project's code -- an original implementation
 * inspired by its systems (needs, moods, day/night cycle, ghosts, houses,
 * food regrowth, families, lifecycle, save/load).
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const choice = (arr) => arr[randInt(0, arr.length - 1)];
  let idCounter = 0;
  const uid = (prefix) => `${prefix}-${(idCounter++).toString(36)}`;

  function lerpColor(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ---------------------------------------------------------------------
  // World geometry
  // ---------------------------------------------------------------------
  const W = 960, H = 600;
  const BOUNDS = { x0: 40, y0: 100, x1: 930, y1: 575 };
  const FOREST = { x0: 690, y0: 90, x1: 935, y1: 580 };
  const LAKE = { x: 825, y: 470, rx: 72, ry: 40 };
  const FIRE = { x: 430, y: 330, r: 20 };
  const HOUSES = [
    { id: 'house-a', x: 70, y: 120, w: 132, h: 92, door: { x: 136, y: 214 }, capacity: 9 },
    { id: 'house-b', x: 70, y: 372, w: 132, h: 92, door: { x: 136, y: 466 }, capacity: 9 },
  ];
  const FOOD_SPOTS = [
    { x: 330, y: 150 }, { x: 575, y: 175 }, { x: 605, y: 420 },
    { x: 330, y: 505 }, { x: 480, y: 250 }, { x: 260, y: 330 },
  ];

  const TREES = Array.from({ length: 26 }, () => ({
    x: rand(FOREST.x0 + 10, FOREST.x1 - 10),
    y: rand(FOREST.y0 + 10, FOREST.y1 - 10),
    r: rand(10, 22),
    tone: rand(0, 1),
  })).filter(t => dist(t.x, t.y, LAKE.x, LAKE.y) > LAKE.rx + 24);

  function inLake(x, y) {
    const dx = (x - LAKE.x) / (LAKE.rx + 18), dy = (y - LAKE.y) / (LAKE.ry + 18);
    return dx * dx + dy * dy < 1;
  }

  function randomWanderTarget(fromForest) {
    let x, y, tries = 0;
    do {
      if (fromForest && Math.random() < 0.22) {
        x = rand(FOREST.x0 + 20, FOREST.x1 - 20);
        y = rand(FOREST.y0 + 20, FOREST.y1 - 20);
      } else {
        x = rand(BOUNDS.x0 + 20, 660);
        y = rand(BOUNDS.y0 + 20, BOUNDS.y1 - 20);
      }
      tries++;
    } while (inLake(x, y) && tries < 6);
    return { x, y };
  }

  // ---------------------------------------------------------------------
  // Simulation clock (dawn / day / dusk / night)
  // ---------------------------------------------------------------------
  const CYCLE = { dawn: 7, day: 42, dusk: 7, night: 34 };
  const CYCLE_LENGTH = CYCLE.dawn + CYCLE.day + CYCLE.dusk + CYCLE.night;

  const SimClock = {
    elapsed: 0,
    speed: 1,
    dayNumber() { return Math.floor(this.elapsed / CYCLE_LENGTH) + 1; },
    isColdNight() { return this.dayNumber() % 4 === 0; },
    phase() {
      let t = this.elapsed % CYCLE_LENGTH;
      if (t < CYCLE.dawn) return 'Dawn';
      t -= CYCLE.dawn;
      if (t < CYCLE.day) return 'Day';
      t -= CYCLE.day;
      if (t < CYCLE.dusk) return 'Dusk';
      return 'Night';
    },
    phaseProgress() {
      let t = this.elapsed % CYCLE_LENGTH;
      if (t < CYCLE.dawn) return t / CYCLE.dawn;
      t -= CYCLE.dawn;
      if (t < CYCLE.day) return t / CYCLE.day;
      t -= CYCLE.day;
      if (t < CYCLE.dusk) return t / CYCLE.dusk;
      t -= CYCLE.dusk;
      return clamp(t / CYCLE.night, 0, 1);
    },
    nightFactor() {
      const phase = this.phase(), p = this.phaseProgress();
      if (phase === 'Day') return 0;
      if (phase === 'Night') return 1;
      if (phase === 'Dawn') return 1 - p;
      return p; // Dusk
    },
  };

  const PHASE_ICON = { Dawn: '🌅', Day: '☀️', Dusk: '🌇', Night: '🌙' };
  const SKY_TOP = { Day: '#5fa8dd', Dawn: '#e08a5f', Dusk: '#4a3f74', Night: '#0a1020' };
  const SKY_BOTTOM = { Day: '#bfe3f0', Dawn: '#f4c58a', Dusk: '#8f6aa8', Night: '#141b2c' };

  function skyColors() {
    const phase = SimClock.phase(), p = SimClock.phaseProgress();
    const order = ['Dawn', 'Day', 'Dusk', 'Night'];
    const idx = order.indexOf(phase);
    const next = order[(idx + 1) % order.length];
    // Only blend within the *last* portion of a phase for a smoother feel.
    const t = phase === 'Night' ? 0 : p;
    return {
      top: lerpColor(SKY_TOP[phase], SKY_TOP[next], t * 0.35),
      bottom: lerpColor(SKY_BOTTOM[phase], SKY_BOTTOM[next], t * 0.35),
    };
  }

  // ---------------------------------------------------------------------
  // Food sources
  // ---------------------------------------------------------------------
  class FoodSource {
    constructor(x, y) {
      this.id = uid('food');
      this.x = x; this.y = y;
      this.max = 100;
      this.nutrition = rand(60, 100);
    }
    get isAvailable() { return this.nutrition > 12; }
    tick(dt) {
      if (this.nutrition < this.max) this.nutrition = clamp(this.nutrition + 2.1 * dt, 0, this.max);
    }
    consume(amount) {
      const taken = Math.min(amount, this.nutrition);
      this.nutrition -= taken;
      return taken;
    }
  }

  // ---------------------------------------------------------------------
  // Forest ghosts
  // ---------------------------------------------------------------------
  class Ghost {
    constructor() {
      this.id = uid('ghost');
      this.x = rand(FOREST.x0 + 20, FOREST.x1 - 20);
      this.y = rand(FOREST.y0 + 20, FOREST.y1 - 20);
      this.wanderTarget = { x: this.x, y: this.y };
      this.age = 0;
      this.life = rand(18, 28);
      this.fadeIn = 2.2; this.fadeOut = 3;
      this.fearRadius = 46;
      this.awareRadius = 115;
      this.speed = 18;
      this.bob = rand(0, Math.PI * 2);
    }
    get alpha() {
      if (this.age < this.fadeIn) return this.age / this.fadeIn;
      if (this.age > this.life - this.fadeOut) return clamp((this.life - this.age) / this.fadeOut, 0, 1);
      return 1;
    }
    get expired() { return this.age >= this.life; }
    tick(dt) {
      this.age += dt;
      this.bob += dt;
      if (dist(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y) < 10) {
        let tx, ty, tries = 0;
        do {
          tx = rand(FOREST.x0 + 20, FOREST.x1 - 20);
          ty = rand(FOREST.y0 + 20, FOREST.y1 - 20);
          tries++;
        } while ((inLake(tx, ty) || dist(tx, ty, FIRE.x, FIRE.y) < 140) && tries < 8);
        this.wanderTarget = { x: tx, y: ty };
      }
      const dx = this.wanderTarget.x - this.x, dy = this.wanderTarget.y - this.y, d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
    }
  }

  // ---------------------------------------------------------------------
  // Worldling
  // ---------------------------------------------------------------------
  const CHILD_NAMES = ['Fern', 'Tavi', 'Nori', 'Kiko', 'Rue', 'Miri', 'Sol', 'Bram', 'Fia', 'Nim', 'Clover', 'Ari', 'Pip', 'Wisp'];
  const FOUNDER_NAMES = ['Wren', 'Sage', 'Oak', 'Iris', 'Moss', 'Reed'];

  const LIFE_STAGE = {
    child: CYCLE_LENGTH * 1.3,
    adult: CYCLE_LENGTH * 8.5,
    elder: CYCLE_LENGTH * 2.6,
  };
  const NATURAL_LIFESPAN = LIFE_STAGE.child + LIFE_STAGE.adult + LIFE_STAGE.elder;
  const POP_CAP = 16;

  const MOOD_ICON = {
    Neutral: '', Playful: '🙂', Afraid: '😨', Bored: '💤',
    Curious: '🤔', Lonely: '💧', Hungry: '🍽️', Tired: '😴', Loving: '💕',
  };

  class Worldling {
    constructor(opts) {
      this.uidKey = uid('wl');
      this.stableId = opts.stableId;
      this.name = opts.name;
      this.generation = opts.generation || 0;
      this.parentIds = opts.parentIds || [];
      this.childIds = [];
      this.x = opts.x; this.y = opts.y;
      this.hue = opts.hue;
      this.sat = opts.sat;
      this.light = opts.light;
      this.traits = opts.traits || { curiosity: rand(30, 70), appetite: rand(30, 70), restfulness: rand(30, 70) };
      this.hunger = opts.hunger ?? rand(10, 30);
      this.energy = opts.energy ?? rand(70, 95);
      this.social = opts.social ?? rand(45, 80);
      this.stage = opts.stage || 'child';
      this.age = opts.age || 0;
      this.mood = 'Neutral';
      this.state = 'wander';
      this.stateTimer = 0;
      this.target = { x: opts.x, y: opts.y };
      this.targetFoodId = null;
      this.partnerId = null;
      this.houseId = opts.houseId || null;
      this.bonds = new Map();
      this.familyCooldowns = new Map();
      this.nextSocialAttemptAt = rand(2, 10);
      this.wanderPauseUntil = 0;
      this.dead = false;
      this.departing = false;
      this.departTimer = 0;
      this.sameStateElapsed = 0;
      this.lastFleeAt = -999;
      this.zzzAt = 0;
      this.bornOnDay = opts.bornOnDay || 1;
    }

    get radius() {
      if (this.stage === 'child') return 7;
      if (this.stage === 'elder') return 9.5;
      return 9;
    }
    get baseSpeed() {
      if (this.stage === 'child') return 46;
      if (this.stage === 'elder') return 26;
      return 36;
    }
    get colorCss() { return `hsl(${this.hue} ${this.sat}% ${this.light}%)`; }
    get isAdult() { return this.stage === 'adult' || this.stage === 'elder'; }
    get isAvailableForFamily() {
      return this.stage === 'adult' && !this.partnerId &&
        (this.state === 'wander' || this.state === 'idle') &&
        this.hunger < 58 && this.energy > 45;
    }
    bondWith(otherId) { return this.bonds.get(otherId) || 0; }
    adjustBond(otherId, amount) {
      const v = clamp(this.bondWith(otherId) + amount, 0, 100);
      this.bonds.set(otherId, v);
    }
  }

  // ---------------------------------------------------------------------
  // World state
  // ---------------------------------------------------------------------
  const World = {
    worldlings: [],
    foods: [],
    ghosts: [],
    fx: [],
    log: [],
    nextSeq: 1,
    totalBirths: 0,
    totalDeaths: 0,
    peakPopulation: 0,
    nextGhostCheckAt: 0,
    coldNightAnnouncedFor: -1,
    selectedId: null,
  };

  function logEvent(text, type = 'info') {
    World.log.push({ day: SimClock.dayNumber(), text, type });
    if (World.log.length > 60) World.log.shift();
    renderLog();
  }

  function spawnFx(kind, x, y, text) {
    World.fx.push({ kind, x, y, age: 0, life: kind === 'text' ? 1.6 : 1.1, text });
  }

  function inheritColor(a, b) {
    let hue = (a.hue + b.hue) / 2;
    if (Math.abs(a.hue - b.hue) > 180) hue = (hue + 180) % 360;
    hue = (hue + rand(-10, 10) + 360) % 360;
    return {
      hue,
      sat: clamp((a.sat + b.sat) / 2 + rand(-6, 6), 35, 85),
      light: clamp((a.light + b.light) / 2 + rand(-6, 6), 45, 70),
    };
  }

  function inheritTraits(a, b) {
    return {
      curiosity: clamp((a.traits.curiosity + b.traits.curiosity) / 2 + rand(-8, 8), 5, 95),
      appetite: clamp((a.traits.appetite + b.traits.appetite) / 2 + rand(-8, 8), 5, 95),
      restfulness: clamp((a.traits.restfulness + b.traits.restfulness) / 2 + rand(-8, 8), 5, 95),
    };
  }

  function assignHouse(preferredParentId) {
    const occ = { 'house-a': 0, 'house-b': 0 };
    for (const w of World.worldlings) if (w.houseId) occ[w.houseId] = (occ[w.houseId] || 0) + 1;
    if (preferredParentId) {
      const parent = World.worldlings.find(w => w.stableId === preferredParentId);
      if (parent && parent.houseId) {
        const cap = HOUSES.find(h => h.id === parent.houseId).capacity;
        if (occ[parent.houseId] < cap) return parent.houseId;
      }
    }
    return occ['house-a'] <= occ['house-b'] ? 'house-a' : 'house-b';
  }

  function createFounder(index, stage) {
    const hue = rand(0, 360);
    const isChild = stage === 'child';
    const w = new Worldling({
      stableId: `SW-G0-${String(index).padStart(3, '0')}`,
      name: isChild ? pickUniqueChildName() : FOUNDER_NAMES[index % FOUNDER_NAMES.length],
      generation: 0,
      x: rand(160, 400), y: rand(160, 480),
      hue, sat: rand(45, 75), light: rand(50, 65),
      stage,
      age: stage === 'adult' ? rand(LIFE_STAGE.child + 20, LIFE_STAGE.child + LIFE_STAGE.adult * 0.12) : rand(20, LIFE_STAGE.child * 0.6),
      bornOnDay: 1,
    });
    w.houseId = assignHouse(null);
    return w;
  }

  function createChild(a, b) {
    if (World.worldlings.length >= POP_CAP) return null;
    const color = inheritColor(a, b);
    const traits = inheritTraits(a, b);
    const gen = Math.max(a.generation, b.generation) + 1;
    const child = new Worldling({
      stableId: `SW-G${gen}-${String(World.nextSeq++).padStart(3, '0')}`,
      name: pickUniqueChildName(),
      generation: gen,
      parentIds: [a.stableId, b.stableId],
      x: (a.x + b.x) / 2 + rand(-14, 14),
      y: (a.y + b.y) / 2 + rand(-14, 14),
      hue: color.hue, sat: color.sat, light: color.light,
      traits,
      stage: 'child', age: 0,
      hunger: 20, energy: 90, social: 70,
      bornOnDay: SimClock.dayNumber(),
    });
    child.houseId = assignHouse(a.stableId);
    a.childIds.push(child.stableId);
    b.childIds.push(child.stableId);
    World.worldlings.push(child);
    World.totalBirths++;
    World.peakPopulation = Math.max(World.peakPopulation, World.worldlings.length);
    return child;
  }

  function pickUniqueChildName() {
    const used = new Set(World.worldlings.map(w => w.name));
    const pool = CHILD_NAMES.filter(n => !used.has(n));
    if (pool.length) return choice(pool);
    return `${choice(CHILD_NAMES)} ${randInt(2, 9)}`;
  }

  function findByStableId(id) { return World.worldlings.find(w => w.stableId === id); }

  function areRelated(a, b) {
    if (a === b) return true;
    if (a.parentIds.includes(b.stableId) || b.parentIds.includes(a.stableId)) return true;
    if (a.childIds.includes(b.stableId) || b.childIds.includes(a.stableId)) return true;
    if (a.parentIds.length && b.parentIds.length && a.parentIds.some(p => b.parentIds.includes(p))) return true;
    return false;
  }

  function relationshipLabel(owner, otherId) {
    if (owner.parentIds.includes(otherId)) return 'Parent';
    if (owner.childIds.includes(otherId)) return 'Child';
    const other = findByStableId(otherId);
    if (other && owner.parentIds.length && other.parentIds.length && owner.parentIds.some(p => other.parentIds.includes(p))) return 'Sibling';
    const bond = owner.bondWith(otherId);
    if (bond >= 55) return 'Partner';
    if (bond >= 32) return 'Friend';
    if (bond >= 12) return 'Acquaintance';
    return 'Stranger';
  }

  // ---------------------------------------------------------------------
  // Needs / lifecycle
  // ---------------------------------------------------------------------
  function tickNeeds(w, dt) {
    const sleeping = w.state === 'sleeping';
    if (sleeping) {
      w.hunger = clamp(w.hunger + 0.55 * 0.5 * dt, 0, 100);
      w.energy = clamp(w.energy + 9.5 * dt, 0, 100);
    } else {
      const nearFire = dist(w.x, w.y, FIRE.x, FIRE.y) < 90;
      const cold = SimClock.isColdNight() && SimClock.phase() === 'Night' && !nearFire;
      w.hunger = clamp(w.hunger + (0.6 + w.traits.appetite * 0.004) * dt, 0, 100);
      w.energy = clamp(w.energy - (0.42 * (cold ? 1.6 : 1)) * dt, 0, 100);
    }
    const socializing = w.state === 'socializing' || w.state === 'familyEvent' || w.state === 'fireGather';
    w.social = clamp(w.social + (socializing ? 8 : -0.45) * dt, 0, 100);
  }

  function updateMood(w) {
    if (w.state === 'fleeing') { w.mood = 'Afraid'; return; }
    if (w.state === 'familyEvent') { w.mood = 'Loving'; return; }
    if (w.state === 'socializing' || w.state === 'fireGather') { w.mood = 'Playful'; return; }
    if (w.state === 'sleeping') { w.mood = 'Tired'; return; }
    if (w.hunger > 72) { w.mood = 'Hungry'; return; }
    if (w.energy < 28) { w.mood = 'Tired'; return; }
    if (w.social < 25) { w.mood = 'Lonely'; return; }
    if (w.sameStateElapsed > 16 && w.state === 'wander') { w.mood = 'Bored'; return; }
    if (w.traits.curiosity > 65 && Math.random() < 0.002) { w.mood = 'Curious'; return; }
    w.mood = 'Neutral';
  }

  function updateLifecycle(w, dt) {
    w.age += dt;
    if (w.stage === 'child' && w.age >= LIFE_STAGE.child) {
      w.stage = 'adult';
      logEvent(`${w.name} grew into an adult.`, 'growth');
    } else if (w.stage === 'adult' && w.age >= LIFE_STAGE.child + LIFE_STAGE.adult) {
      w.stage = 'elder';
      logEvent(`${w.name} became an elder.`, 'growth');
    } else if (w.stage === 'elder' && w.age >= NATURAL_LIFESPAN && !w.departing) {
      beginNaturalDeath(w);
    }
  }

  function beginNaturalDeath(w) {
    w.departing = true;
    w.departTimer = 0;
    World.totalDeaths++;
    logEvent(`${w.name} passed peacefully after a long life.`, 'death');
    spawnFx('text', w.x, w.y - 18, '✨');
  }

  // ---------------------------------------------------------------------
  // AI / state machine
  // ---------------------------------------------------------------------
  function moveToward(w, tx, ty, dt, speedMult = 1) {
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const nightMod = SimClock.phase() === 'Night' ? 0.72 : 1;
    const s = w.baseSpeed * speedMult * nightMod;
    w.x += (dx / d) * s * dt;
    w.y += (dy / d) * s * dt;
    w.x = clamp(w.x, BOUNDS.x0, BOUNDS.x1);
    w.y = clamp(w.y, BOUNDS.y0, BOUNDS.y1);
    return false;
  }

  function houseOf(id) { return HOUSES.find(h => h.id === id); }

  function findNearestFood(w) {
    let best = null, bestD = Infinity;
    for (const f of World.foods) {
      if (!f.isAvailable) continue;
      const d = dist(w.x, w.y, f.x, f.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  function nearestGhostInfo(w) {
    let best = null, bestD = Infinity;
    for (const g of World.ghosts) {
      const d = dist(w.x, w.y, g.x, g.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    return best ? { ghost: best, d: bestD } : null;
  }

  function foodCapacityOk(extra) {
    const nutrition = World.foods.reduce((sum, f) => sum + f.nutrition, 0);
    return nutrition >= (World.worldlings.length + extra) * 22;
  }

  function findSocialCandidate(w) {
    let best = null, bestScore = -Infinity;
    for (const other of World.worldlings) {
      if (other === w || other.dead || other.departing || other.partnerId) continue;
      if (other.state !== 'wander' && other.state !== 'idle') continue;
      if (other.hunger > 80 || other.energy < 18) continue;
      const d = dist(w.x, w.y, other.x, other.y);
      if (d > 260) continue;
      const bond = w.bondWith(other.stableId);
      const score = bond - d * 0.05;
      if (score > bestScore) { bestScore = score; best = other; }
    }
    return best;
  }

  function familyPairQualifies(a, b) {
    if (a === b || areRelated(a, b) || a.stage !== 'adult' || b.stage !== 'adult') return false;
    if (a.partnerId || b.partnerId) return false;
    if (a.hunger > 55 || b.hunger > 55 || a.energy < 48 || b.energy < 48) return false;
    if (a.social < 30 || b.social < 30) return false;
    if (w_bondLow(a, b)) return false;
    const cdKey = pairKey(a.stableId, b.stableId);
    const cd = a.familyCooldowns.get(cdKey);
    if (cd && SimClock.elapsed < cd) return false;
    if (World.worldlings.length >= POP_CAP) return false;
    if (!foodCapacityOk(1)) return false;
    return true;
  }
  function w_bondLow(a, b) { return a.bondWith(b.stableId) < 46 || b.bondWith(a.stableId) < 46; }
  function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  function enterState(w, state) {
    if (w.state !== state) w.sameStateElapsed = 0;
    w.state = state;
    w.stateTimer = 0;
  }

  function evaluateGoals(w) {
    // Fear check (forest ghosts)
    const gi = nearestGhostInfo(w);
    if (gi && gi.d < gi.ghost.awareRadius && gi.ghost.alpha > 0.4) {
      if (gi.d < gi.ghost.fearRadius) {
        beginFlee(w, gi.ghost);
        return;
      }
    }
    if (w.state === 'fleeing') return; // handled in updateState until timer elapses

    // Already actively resolving hunger/energy: let updateState run its course instead of
    // re-triggering seekFood/seekRest every tick, which would otherwise stop the eating/sleeping
    // case from ever executing its own consume/recover logic.
    if (w.state === 'eating') return;
    if (w.state === 'sleeping' && w.energy < 92) return;

    // Survival: hunger
    const hungerThreshold = clamp(66 - w.traits.appetite * 0.14, 46, 78);
    if (w.hunger >= hungerThreshold && w.state !== 'seekFood') {
      const food = findNearestFood(w);
      if (food) {
        releasePartner(w);
        w.targetFoodId = food.id;
        enterState(w, 'seekFood');
        return;
      }
    }
    if (w.state === 'seekFood') {
      if (!w.targetFoodId || !World.foods.find(f => f.id === w.targetFoodId && f.isAvailable)) {
        enterState(w, 'wander');
      } else {
        return; // still travelling toward the food, don't reconsider every tick
      }
    }

    // Survival: energy
    const restThreshold = clamp(30 + w.traits.restfulness * 0.12, 24, 46);
    if (w.energy <= restThreshold && w.state !== 'seekRest') {
      releasePartner(w);
      enterState(w, 'seekRest');
      return;
    }
    if (w.state === 'seekRest') {
      // still travelling toward home, don't reconsider every tick
      return;
    }

    // Optional: socialize
    if ((w.state === 'wander' || w.state === 'idle') && !w.partnerId && w.social < 62 &&
      SimClock.elapsed >= w.nextSocialAttemptAt) {
      const candidate = findSocialCandidate(w);
      if (candidate && !candidate.partnerId) {
        beginSocialize(w, candidate);
        return;
      }
      w.nextSocialAttemptAt = SimClock.elapsed + rand(2, 5);
    }

    // Optional: family event
    if ((w.state === 'wander' || w.state === 'idle') && w.isAvailableForFamily) {
      for (const other of World.worldlings) {
        if (other === w) continue;
        if (dist(w.x, w.y, other.x, other.y) > 90) continue;
        if (familyPairQualifies(w, other) && familyPairQualifies(other, w)) {
          beginFamilyEvent(w, other);
          return;
        }
      }
    }

    // Optional: gather at the fire on cold/night hours
    if ((w.state === 'wander' || w.state === 'idle') && !w.partnerId &&
      SimClock.phase() === 'Night' && Math.random() < 0.0018 &&
      dist(w.x, w.y, FIRE.x, FIRE.y) > 40) {
      enterState(w, 'seekFire');
      return;
    }

    // These optional activities run their own course in updateState (approach, interact, resolve);
    // don't let the wander fallback below reclaim control while they're in progress.
    if (w.state === 'seekCompany' || w.state === 'socializing' || w.state === 'familyEvent' ||
      w.state === 'seekFire' || w.state === 'fireGather') {
      return;
    }

    // Default: wander
    if (w.state !== 'wander' || (w.wanderPauseUntil && SimClock.elapsed >= w.wanderPauseUntil &&
      dist(w.x, w.y, w.target.x, w.target.y) < 8)) {
      w.target = randomWanderTarget(w.traits.curiosity > 60);
      w.wanderPauseUntil = 0;
      enterState(w, 'wander');
    }
  }

  function beginFlee(w, ghost) {
    if (SimClock.elapsed - w.lastFleeAt < 0.4 && w.state === 'fleeing') return;
    w.lastFleeAt = SimClock.elapsed;
    releasePartner(w);
    // Flee target: away from the ghost, biased toward the nearest house or the fire.
    const away = { x: w.x + (w.x - ghost.x) * 3, y: w.y + (w.y - ghost.y) * 3 };
    const nearestHouse = HOUSES.reduce((best, h) => {
      const d = dist(w.x, w.y, h.door.x, h.door.y);
      return d < best.d ? { h, d } : best;
    }, { h: null, d: Infinity });
    const target = nearestHouse.d < 260 ? { x: nearestHouse.h.door.x, y: nearestHouse.h.door.y } :
      { x: clamp(away.x, BOUNDS.x0, BOUNDS.x1), y: clamp(away.y, BOUNDS.y0, BOUNDS.y1) };
    w.target = target;
    enterState(w, 'fleeing');
    w.stateTimer = 0;
    if (Math.random() < 0.5) spawnFx('text', w.x, w.y - 16, '❗');
  }

  function beginSocialize(w, other) {
    w.partnerId = other.stableId;
    other.partnerId = w.stableId;
    enterState(w, 'seekCompany');
    enterState(other, 'seekCompany');
    w.nextSocialAttemptAt = SimClock.elapsed + rand(8, 14);
    other.nextSocialAttemptAt = SimClock.elapsed + rand(8, 14);
  }

  function releasePartner(w) {
    if (w.partnerId) {
      const other = findByStableId(w.partnerId);
      if (other && other.partnerId === w.stableId) {
        other.partnerId = null;
        if (other.state === 'seekCompany' || other.state === 'socializing' || other.state === 'familyEvent') {
          enterState(other, 'wander');
        }
      }
      w.partnerId = null;
    }
  }

  function beginFamilyEvent(w, other) {
    w.partnerId = other.stableId;
    other.partnerId = w.stableId;
    w.familyIntent = true;
    other.familyIntent = true;
    enterState(w, 'seekCompany');
    enterState(other, 'seekCompany');
  }

  function completeSocial(w, other) {
    const isFamily = w.familyIntent && other.familyIntent;
    if (isFamily) {
      enterState(w, 'familyEvent');
      enterState(other, 'familyEvent');
      w.stateTimer = 0; other.stateTimer = 0;
      spawnFx('text', (w.x + other.x) / 2, (w.y + other.y) / 2 - 16, '💕');
      return;
    }
    enterState(w, 'socializing');
    enterState(other, 'socializing');
    w.stateTimer = 0; other.stateTimer = 0;
  }

  function updateState(w, dt) {
    switch (w.state) {
      case 'wander': {
        const arrived = moveToward(w, w.target.x, w.target.y, dt, 1);
        if (arrived && !w.wanderPauseUntil) w.wanderPauseUntil = SimClock.elapsed + rand(1.5, 4.5);
        break;
      }
      case 'seekFood': {
        const food = World.foods.find(f => f.id === w.targetFoodId);
        if (!food || !food.isAvailable) { enterState(w, 'wander'); break; }
        const arrived = moveToward(w, food.x, food.y, dt, 1);
        if (arrived) enterState(w, 'eating');
        break;
      }
      case 'eating': {
        const food = World.foods.find(f => f.id === w.targetFoodId);
        if (!food || !food.isAvailable || w.hunger <= 16) { enterState(w, 'wander'); w.targetFoodId = null; break; }
        const eaten = food.consume(20 * dt);
        w.hunger = clamp(w.hunger - eaten, 0, 100);
        if (Math.random() < 0.01) spawnFx('text', w.x, w.y - 14, '🍃');
        break;
      }
      case 'seekRest': {
        const house = houseOf(w.houseId) || HOUSES[0];
        const arrived = moveToward(w, house.door.x, house.door.y, dt, 1);
        if (arrived) enterState(w, 'sleeping');
        break;
      }
      case 'sleeping': {
        if (w.energy >= 92 || (SimClock.phase() === 'Day' && w.energy >= 70)) { enterState(w, 'wander'); break; }
        w.zzzAt -= dt;
        if (w.zzzAt <= 0) { spawnFx('text', w.x, w.y - 14, '💤'); w.zzzAt = rand(2.5, 4.5); }
        break;
      }
      case 'seekFire': {
        if (!w.target || !w.target.__fire) {
          w.target = { x: FIRE.x + rand(-34, 34), y: FIRE.y + rand(-34, 34), __fire: true };
        }
        moveToward(w, w.target.x, w.target.y, dt, 1);
        if (dist(w.x, w.y, FIRE.x, FIRE.y) < 42) { enterState(w, 'fireGather'); w.stateTimer = rand(4, 9); }
        break;
      }
      case 'fireGather': {
        w.stateTimer -= dt;
        if (w.stateTimer <= 0 || w.hunger > 70 || w.energy < 30) enterState(w, 'wander');
        break;
      }
      case 'seekCompany': {
        const other = findByStableId(w.partnerId);
        if (!other || other.partnerId !== w.stableId) { w.partnerId = null; w.familyIntent = false; enterState(w, 'wander'); break; }
        moveToward(w, other.x, other.y, dt, 1);
        w.stateTimer += dt;
        if (dist(w.x, w.y, other.x, other.y) < 26 && other.state === 'seekCompany') {
          completeSocial(w, other);
        } else if (w.stateTimer > 14) {
          w.partnerId = null; w.familyIntent = false; enterState(w, 'wander');
        }
        break;
      }
      case 'socializing': {
        const other = findByStableId(w.partnerId);
        if (!other) { enterState(w, 'wander'); break; }
        w.stateTimer += dt;
        w.adjustBond(other.stableId, 5.5 * dt);
        if (w.stateTimer >= 3.2) {
          logSocialOutcome(w, other);
          w.partnerId = null; other.partnerId = null;
          w.familyIntent = false; other.familyIntent = false;
          enterState(w, 'wander'); enterState(other, 'wander');
        }
        break;
      }
      case 'familyEvent': {
        const other = findByStableId(w.partnerId);
        if (!other) { enterState(w, 'wander'); break; }
        w.stateTimer += dt;
        if (w.stateTimer >= 3.2) {
          finishFamilyEvent(w, other);
        }
        break;
      }
      case 'fleeing': {
        const arrived = moveToward(w, w.target.x, w.target.y, dt, 1.55);
        w.stateTimer += dt;
        const gi = nearestGhostInfo(w);
        const stillThreatened = gi && gi.d < gi.ghost.awareRadius * 1.1;
        if (w.stateTimer > 2.4 && (arrived || !stillThreatened)) enterState(w, 'wander');
        break;
      }
      default:
        enterState(w, 'wander');
    }
  }

  const socialFlavors = ['chatted', 'played together', 'shared a laugh', 'told stories', 'greeted each other warmly'];
  function logSocialOutcome(w, other) {
    // Keep the log from getting spammy: only log a fraction of everyday interactions.
    if (Math.random() < 0.12) {
      logEvent(`${w.name} and ${other.name} ${choice(socialFlavors)}.`, 'social');
    }
  }

  function finishFamilyEvent(a, b) {
    a.familyIntent = false; b.familyIntent = false;
    a.partnerId = null; b.partnerId = null;
    const key = pairKey(a.stableId, b.stableId);
    a.familyCooldowns.set(key, SimClock.elapsed + 60);
    b.familyCooldowns.set(key, SimClock.elapsed + 60);
    enterState(a, 'wander'); enterState(b, 'wander');
    if (World.worldlings.length >= POP_CAP || !foodCapacityOk(1)) {
      return;
    }
    const child = createChild(a, b);
    if (child) {
      logEvent(`${a.name} and ${b.name} welcomed a new little one, ${child.name}!`, 'birth');
      spawnFx('text', child.x, child.y - 18, '👶');
    }
  }

  // ---------------------------------------------------------------------
  // Ghost spawner
  // ---------------------------------------------------------------------
  function updateGhosts(dt) {
    for (let i = World.ghosts.length - 1; i >= 0; i--) {
      const g = World.ghosts[i];
      g.tick(dt);
      if (g.expired) World.ghosts.splice(i, 1);
    }
    if (SimClock.elapsed < World.nextGhostCheckAt) return;
    World.nextGhostCheckAt = SimClock.elapsed + rand(3, 6);
    const night = SimClock.nightFactor();
    if (night < 0.35) return;
    const cold = SimClock.isColdNight();
    const maxGhosts = cold ? 3 : 2;
    if (World.ghosts.length >= maxGhosts) return;
    const chance = (cold ? 0.5 : 0.28) * night;
    if (Math.random() < chance) {
      World.ghosts.push(new Ghost());
      if (World.ghosts.length === 1) logEvent('Something stirs in the forest tonight...', 'ghost');
    }
  }

  // ---------------------------------------------------------------------
  // Main update
  // ---------------------------------------------------------------------
  let lastColdCheckDay = -1;
  function update(dt) {
    if (dt <= 0) return;
    SimClock.elapsed += dt;

    const day = SimClock.dayNumber();
    if (day !== lastColdCheckDay) {
      lastColdCheckDay = day;
      if (SimClock.isColdNight()) logEvent(`A freezing night is expected tonight (Day ${day}).`, 'cold');
    }

    for (const f of World.foods) f.tick(dt);
    updateGhosts(dt);

    for (const w of World.worldlings) {
      if (w.dead) continue;
      if (w.departing) {
        w.departTimer += dt;
        continue;
      }
      w.sameStateElapsed += dt;
      tickNeeds(w, dt);
      updateLifecycle(w, dt);
      if (w.departing) continue;
      updateMood(w);
      evaluateGoals(w);
      updateState(w, dt);
    }

    // Remove fully departed worldlings after their fade-out cue.
    for (let i = World.worldlings.length - 1; i >= 0; i--) {
      const w = World.worldlings[i];
      if (w.departing && w.departTimer > 1.1) {
        for (const other of World.worldlings) if (other.partnerId === w.stableId) other.partnerId = null;
        World.worldlings.splice(i, 1);
        if (World.selectedId === w.stableId) World.selectedId = null;
      }
    }

    for (let i = World.fx.length - 1; i >= 0; i--) {
      const fx = World.fx[i];
      fx.age += dt;
      if (fx.age >= fx.life) World.fx.splice(i, 1);
    }

    World.peakPopulation = Math.max(World.peakPopulation, World.worldlings.length);
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');

  function drawSky() {
    const { top, bottom } = skyColors();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (SimClock.phase() === 'Night') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 + 31) % W, sy = (i * 53 + 11) % 180;
        ctx.globalAlpha = 0.25 + ((i * 37) % 100) / 200;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawGround() {
    ctx.fillStyle = SimClock.phase() === 'Night' ? '#2c4634' : SimClock.phase() === 'Dusk' ? '#3c5a3f' : '#4f7a4a';
    ctx.fillRect(BOUNDS.x0 - 10, BOUNDS.y0 - 10, FOREST.x0 - BOUNDS.x0 + 20, BOUNDS.y1 - BOUNDS.y0 + 20);

    // forest patch
    ctx.fillStyle = SimClock.phase() === 'Night' ? '#152a1e' : '#245030';
    ctx.fillRect(FOREST.x0, FOREST.y0 - 10, FOREST.x1 - FOREST.x0, FOREST.y1 - FOREST.y0 + 20);

    for (const t of TREES) {
      ctx.beginPath();
      ctx.fillStyle = t.tone > 0.5 ? '#1c3a24' : '#173019';
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Guardian Lake
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 0, 0, Math.PI * 2);
    const lakeGrad = ctx.createRadialGradient(LAKE.x, LAKE.y, 4, LAKE.x, LAKE.y, LAKE.rx);
    lakeGrad.addColorStop(0, '#8fd9e8');
    lakeGrad.addColorStop(1, '#2f7c94');
    ctx.fillStyle = lakeGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(230,255,240,0.85)';
    ctx.font = '11px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('Guardian Lake', LAKE.x, LAKE.y - LAKE.ry - 8);
  }

  function drawHouse(h) {
    ctx.fillStyle = '#7a5a3d';
    ctx.fillRect(h.x, h.y + 30, h.w, h.h - 30);
    ctx.beginPath();
    ctx.moveTo(h.x - 8, h.y + 32);
    ctx.lineTo(h.x + h.w / 2, h.y - 6);
    ctx.lineTo(h.x + h.w + 8, h.y + 32);
    ctx.closePath();
    ctx.fillStyle = '#9c3f3f';
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(h.door.x - 12, h.door.y - 30, 24, 30);
    ctx.fillStyle = SimClock.phase() === 'Night' ? '#ffd98a' : '#e9d9b8';
    ctx.fillRect(h.x + 16, h.y + 44, 16, 16);
    ctx.fillRect(h.x + h.w - 32, h.y + 44, 16, 16);
  }

  function drawFire() {
    const night = SimClock.phase() === 'Night' || SimClock.phase() === 'Dusk';
    ctx.beginPath();
    ctx.fillStyle = '#5c5044';
    ctx.arc(FIRE.x, FIRE.y, FIRE.r, 0, Math.PI * 2);
    ctx.fill();
    if (night) {
      const glowR = FIRE.r + 60 + Math.sin(SimClock.elapsed * 3) * 6;
      const glow = ctx.createRadialGradient(FIRE.x, FIRE.y, 4, FIRE.x, FIRE.y, glowR);
      glow.addColorStop(0, 'rgba(255,170,70,0.35)');
      glow.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(FIRE.x, FIRE.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    const flick = 10 + Math.sin(SimClock.elapsed * 8) * 3;
    ctx.beginPath();
    ctx.fillStyle = night ? '#ffb347' : '#e8a15c';
    ctx.moveTo(FIRE.x, FIRE.y - flick - 4);
    ctx.quadraticCurveTo(FIRE.x + 9, FIRE.y - 4, FIRE.x, FIRE.y + 6);
    ctx.quadraticCurveTo(FIRE.x - 9, FIRE.y - 4, FIRE.x, FIRE.y - flick - 4);
    ctx.fill();
  }

  function drawFood(f) {
    const t = clamp(f.nutrition / f.max, 0, 1);
    const r = 8 + t * 9;
    ctx.beginPath();
    ctx.fillStyle = t > 0.12 ? `rgba(70,${120 + t * 60},70,1)` : 'rgba(70,90,60,0.6)';
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (t > 0.35) {
      ctx.fillStyle = '#d2445a';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(i * 2.1) * r * 0.5, f.y + Math.sin(i * 2.1) * r * 0.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGhost(g) {
    ctx.save();
    ctx.globalAlpha = g.alpha * 0.9;
    const bob = Math.sin(g.bob * 2) * 3;
    const grad = ctx.createRadialGradient(g.x, g.y + bob, 2, g.x, g.y + bob, 26);
    grad.addColorStop(0, 'rgba(210,190,255,0.55)');
    grad.addColorStop(1, 'rgba(210,190,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(235,230,255,0.9)';
    ctx.beginPath();
    ctx.arc(g.x, g.y + bob - 6, 11, Math.PI, 0);
    ctx.lineTo(g.x + 11, g.y + bob + 12);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(g.x + 11 - (i + 1) * (22 / 4), g.y + bob + (i % 2 === 0 ? 12 : 6));
    }
    ctx.lineTo(g.x - 11, g.y + bob + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(40,30,60,0.8)';
    ctx.beginPath(); ctx.arc(g.x - 4, g.y + bob - 6, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(g.x + 4, g.y + bob - 6, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWorldling(w) {
    const alpha = w.departing ? clamp(1 - w.departTimer / 1.1, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (World.selectedId === w.stableId) {
      ctx.beginPath();
      ctx.strokeStyle = '#fff2b8';
      ctx.lineWidth = 2;
      ctx.arc(w.x, w.y, w.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = w.colorCss;
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = w.stage === 'elder' ? 2.4 : 1.4;
    ctx.strokeStyle = w.stage === 'elder' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
    ctx.stroke();

    if (w.mood !== 'Neutral' && MOOD_ICON[w.mood]) {
      ctx.font = '11px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText(MOOD_ICON[w.mood], w.x, w.y - w.radius - 6);
    }

    if (World.selectedId === w.stableId) {
      ctx.font = '11px "Segoe UI"';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(w.name, w.x, w.y + w.radius + 13);
    }
    ctx.restore();
  }

  function drawFx() {
    for (const fx of World.fx) {
      const t = fx.age / fx.life;
      ctx.save();
      ctx.globalAlpha = clamp(1 - t, 0, 1);
      ctx.font = '14px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText(fx.text, fx.x, fx.y - t * 22);
      ctx.restore();
    }
  }

  function drawSnow() {
    if (!SimClock.isColdNight() || SimClock.phase() !== 'Night') return;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 53 + (SimClock.elapsed * 26)) % (W + 40) - 20;
      const sy = (i * 71 + SimClock.elapsed * 55) % H;
      ctx.globalAlpha = 0.4 + (i % 5) / 12;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawSky();
    drawGround();
    for (const h of HOUSES) drawHouse(h);
    drawFire();
    for (const f of World.foods) drawFood(f);
    const sorted = World.worldlings.slice().sort((a, b) => a.y - b.y);
    for (const w of sorted) drawWorldling(w);
    for (const g of World.ghosts) drawGhost(g);
    drawSnow();
    drawFx();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, 4);
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------
  const dayLabel = document.getElementById('dayLabel');
  const phaseLabel = document.getElementById('phaseLabel');
  const phaseIcon = document.getElementById('phaseIcon');
  const statPop = document.getElementById('statPop');
  const statBirths = document.getElementById('statBirths');
  const statDeaths = document.getElementById('statDeaths');
  const statFood = document.getElementById('statFood');
  const selectionPanel = document.getElementById('selectionPanel');
  const eventLogEl = document.getElementById('eventLog');

  function renderTopbar() {
    dayLabel.textContent = `Day ${SimClock.dayNumber()}`;
    const phase = SimClock.phase();
    phaseLabel.textContent = SimClock.isColdNight() && phase === 'Night' ? 'Freezing Night' : phase;
    phaseIcon.textContent = PHASE_ICON[phase];
  }

  function renderStats() {
    statPop.textContent = World.worldlings.filter(w => !w.departing).length;
    statBirths.textContent = World.totalBirths;
    statDeaths.textContent = World.totalDeaths;
    statFood.textContent = World.foods.filter(f => f.isAvailable).length + '/' + World.foods.length;
  }

  function renderLog() {
    eventLogEl.innerHTML = '';
    for (const entry of World.log) {
      const li = document.createElement('li');
      li.className = entry.type === 'birth' ? 'log-birth' : entry.type === 'death' ? 'log-death' :
        entry.type === 'ghost' ? 'log-ghost' : '';
      li.innerHTML = `<span class="log-day">D${entry.day}</span>${entry.text}`;
      eventLogEl.appendChild(li);
    }
  }

  function renderSidebar() {
    const w = World.selectedId ? findByStableId(World.selectedId) : null;
    if (!w || w.departing) {
      selectionPanel.innerHTML = '<div class="panel-empty">Click a Worldling to observe them.</div>';
      return;
    }
    const stageLabel = w.stage.charAt(0).toUpperCase() + w.stage.slice(1);
    const activity = ACTIVITY_LABEL[w.state] || 'Going about their day';
    const relations = World.worldlings
      .filter(o => o !== w && !o.departing && (w.bondWith(o.stableId) > 4 || areRelated(w, o)))
      .map(o => ({ name: o.name, tag: relationshipLabel(w, o.stableId), bond: w.bondWith(o.stableId) }))
      .sort((a, b) => b.bond - a.bond)
      .slice(0, 6);

    selectionPanel.innerHTML = `
      <div class="wl-header">
        <div class="wl-dot" style="background:${w.colorCss}"></div>
        <div>
          <div class="wl-name">${w.name}</div>
          <div class="wl-sub">${stageLabel} &middot; Gen ${w.generation} &middot; ${w.stableId}</div>
        </div>
      </div>
      <div class="wl-activity">${activity}</div>
      ${needBarRow('Hunger', w.hunger, 'fill-hunger', true)}
      ${needBarRow('Energy', w.energy, 'fill-energy', false)}
      ${needBarRow('Social', w.social, 'fill-social', false)}
      <div class="wl-section-title">Relationships</div>
      ${relations.length ? `<ul class="wl-relations">${relations.map(r =>
        `<li><span class="rel-name">${r.name}</span><span class="rel-tag">${r.tag}</span></li>`).join('')}</ul>`
        : '<div class="panel-empty">No notable relationships yet.</div>'}
    `;
  }

  const ACTIVITY_LABEL = {
    wander: 'Exploring the habitat', idle: 'Taking a quiet moment',
    seekFood: 'Looking for food', eating: 'Eating nearby food',
    seekRest: 'Feeling tired, heading home', sleeping: 'Resting at home',
    seekFire: 'Heading toward the fire', fireGather: 'Gathered by the fire',
    seekCompany: 'Approaching a friend', socializing: 'Spending time with a friend',
    familyEvent: 'Sharing a family moment', fleeing: 'Fleeing something in the forest',
  };

  function needBarRow(label, value, cls, invert) {
    const pct = clamp(value, 0, 100);
    const warn = invert ? pct > 70 : pct < 30;
    return `<div class="needbar-row">
      <div class="needbar-label"><span>${label}</span><span>${Math.round(pct)}${warn ? ' ⚠' : ''}</span></div>
      <div class="needbar"><div class="needbar-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }

  // ---- canvas click selection ----
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
    let best = null, bestD = 22;
    for (const w of World.worldlings) {
      if (w.departing) continue;
      const d = dist(mx, my, w.x, w.y);
      if (d < bestD) { bestD = d; best = w; }
    }
    World.selectedId = best ? best.stableId : null;
    renderSidebar();
  });

  // ---- speed controls ----
  const speedButtons = Array.from(document.querySelectorAll('.speedBtn'));
  function setSpeed(v) {
    SimClock.speed = v;
    for (const btn of speedButtons) btn.classList.toggle('active', Number(btn.dataset.speed) === v);
  }
  for (const btn of speedButtons) btn.addEventListener('click', () => setSpeed(Number(btn.dataset.speed)));

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------
  const SAVE_KEY = 'smallWorldHTML.save.v1';

  function serialize() {
    return {
      elapsed: SimClock.elapsed,
      speed: SimClock.speed,
      nextSeq: World.nextSeq,
      totalBirths: World.totalBirths,
      totalDeaths: World.totalDeaths,
      peakPopulation: World.peakPopulation,
      log: World.log,
      foods: World.foods.map(f => ({ x: f.x, y: f.y, nutrition: f.nutrition })),
      worldlings: World.worldlings.filter(w => !w.departing).map(w => ({
        stableId: w.stableId, name: w.name, generation: w.generation,
        parentIds: w.parentIds, childIds: w.childIds,
        x: w.x, y: w.y, hue: w.hue, sat: w.sat, light: w.light,
        traits: w.traits, hunger: w.hunger, energy: w.energy, social: w.social,
        stage: w.stage, age: w.age, houseId: w.houseId,
        bonds: Array.from(w.bonds.entries()), bornOnDay: w.bornOnDay,
      })),
    };
  }

  function saveGame(silent) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      if (!silent) logEvent('World saved.', 'info');
    } catch (e) {
      if (!silent) logEvent('Could not save (storage unavailable).', 'info');
    }
  }

  function loadFromData(data) {
    SimClock.elapsed = data.elapsed || 0;
    SimClock.speed = data.speed ?? 1;
    setSpeed(SimClock.speed);
    World.nextSeq = data.nextSeq || 1;
    World.totalBirths = data.totalBirths || 0;
    World.totalDeaths = data.totalDeaths || 0;
    World.peakPopulation = data.peakPopulation || 0;
    World.log = data.log || [];
    World.foods = (data.foods || []).map(f => Object.assign(new FoodSource(f.x, f.y), { nutrition: f.nutrition }));
    if (!World.foods.length) World.foods = FOOD_SPOTS.map(p => new FoodSource(p.x, p.y));
    World.worldlings = (data.worldlings || []).map(d => {
      const w = new Worldling({
        stableId: d.stableId, name: d.name, generation: d.generation,
        parentIds: d.parentIds, x: d.x, y: d.y, hue: d.hue, sat: d.sat, light: d.light,
        traits: d.traits, hunger: d.hunger, energy: d.energy, social: d.social,
        stage: d.stage, age: d.age, houseId: d.houseId, bornOnDay: d.bornOnDay,
      });
      w.childIds = d.childIds || [];
      w.bonds = new Map(d.bonds || []);
      return w;
    });
    World.selectedId = null;
    lastColdCheckDay = -1;
    renderLog();
  }

  function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { logEvent('No saved world found.', 'info'); return false; }
    try {
      loadFromData(JSON.parse(raw));
      logEvent('World loaded.', 'info');
      return true;
    } catch (e) {
      logEvent('Save file could not be read.', 'info');
      return false;
    }
  }

  function newWorld() {
    World.worldlings = [];
    World.foods = FOOD_SPOTS.map(p => new FoodSource(p.x, p.y));
    World.ghosts = [];
    World.fx = [];
    World.log = [];
    World.nextSeq = 10;
    World.totalBirths = 0;
    World.totalDeaths = 0;
    World.peakPopulation = 0;
    World.selectedId = null;
    SimClock.elapsed = 0;
    lastColdCheckDay = -1;

    let idx = 1;
    World.worldlings.push(createFounder(idx++, 'adult'));
    World.worldlings.push(createFounder(idx++, 'adult'));
    World.worldlings.push(createFounder(idx++, 'adult'));
    World.worldlings.push(createFounder(idx++, 'adult'));
    World.worldlings.push(createFounder(idx++, 'child'));
    World.worldlings.push(createFounder(idx++, 'child'));
    World.peakPopulation = World.worldlings.length;
    logEvent('A small group of Worldlings settled here to begin a new life.', 'info');
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  document.getElementById('btnSave').addEventListener('click', () => saveGame(false));
  document.getElementById('btnLoad').addEventListener('click', () => { loadGame(); renderSidebar(); });
  document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm('Start a brand new world? This replaces your current world (your saved file stays until you Save again).')) {
      newWorld();
      renderSidebar();
    }
  });

  const introOverlay = document.getElementById('introOverlay');
  document.getElementById('btnStart').addEventListener('click', () => {
    introOverlay.classList.add('hidden');
  });

  function boot() {
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    if (hasSave) {
      loadGame();
    } else {
      newWorld();
    }
    setSpeed(1);
    renderSidebar();
  }
  boot();

  let last = performance.now();
  setInterval(() => saveGame(true), 20000);
  window.addEventListener('beforeunload', () => saveGame(true));

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);
    update(dt * SimClock.speed);
    render();
    renderTopbar();
    renderStats();
    if (World.selectedId) renderSidebar();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
