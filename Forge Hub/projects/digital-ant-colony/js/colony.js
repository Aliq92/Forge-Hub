// Orchestrates one ant colony: the nest, every ant, every food source, the
// three pheromone fields (food / home / danger), the obstacle and hazard
// layers, and the running stats/event log the HUD reads from.
class Colony {
  constructor(width, height, opts) {
    opts = opts || {};
    this.world = { width, height };
    this.maxAnts = opts.maxAnts || CONFIG.colony.maxAntsDesktop;
    this.growthEnabled = CONFIG.colony.growthEnabled;
    this.overlayMode = "food"; // 'off' | 'food' | 'home' | 'danger' | 'all'
    this.reset();
  }

  // `nestFracX/Y` (0..1) let a preset place the nest somewhere other than
  // dead center *before* the initial ants and food are generated, so they
  // spawn in the right place instead of needing to be relocated after.
  reset(nestFracX, nestFracY) {
    const { width, height } = this.world;
    const fx = nestFracX === undefined ? 0.5 : nestFracX;
    const fy = nestFracY === undefined ? 0.5 : nestFracY;
    this.nest = { x: width * fx, y: height * fy, radius: CONFIG.colony.nestRadius };
    this.foodGrid = new PheromoneGrid(width, height, CONFIG.pheromone.cellSize, CONFIG.pheromone.max);
    this.homeGrid = new PheromoneGrid(width, height, CONFIG.pheromone.cellSize, CONFIG.pheromone.max);
    this.dangerGrid = new PheromoneGrid(width, height, CONFIG.pheromone.cellSize, CONFIG.pheromone.dangerMax);
    this.obstacles = new MaskGrid(width, height, CONFIG.obstacle.cellSize);
    this.hazards = new MaskGrid(width, height, CONFIG.hazard.cellSize);
    this.ants = [];
    this.food = [];
    this.storedFood = 0;
    this.foodCollectedTotal = 0;
    this.elapsed = 0;
    this.events = [];
    this.presetName = "Simple Forage";
    this._trailCheckTimer = 0;
    this._lastMajorTrailAt = -999;

    for (let i = 0; i < CONFIG.colony.initialAnts; i++) this.spawnAnt();
    for (let i = 0; i < CONFIG.colony.initialFood; i++) this.spawnRandomFood();
  }

  spawnAnt(role) {
    if (this.ants.length >= this.maxAnts) return null;
    const angle = rand(0, TAU);
    const r = this.nest.radius * 0.6;
    const ant = new Ant(this.nest.x + Math.cos(angle) * r, this.nest.y + Math.sin(angle) * r, role);
    this.ants.push(ant);
    return ant;
  }

  addFoodAt(x, y, amount, type) {
    const pad = CONFIG.world.edgePadding;
    const cx = clamp(x, pad, this.world.width - pad);
    const cy = clamp(y, pad, this.world.height - pad);
    const food = new FoodSource(cx, cy, amount, type);
    this.food.push(food);
    return food;
  }

  spawnRandomFood(type) {
    const pad = CONFIG.world.edgePadding;
    let x, y, tries = 0;
    do {
      x = rand(pad, this.world.width - pad);
      y = rand(pad, this.world.height - pad);
      tries++;
    } while (
      (dist(x, y, this.nest.x, this.nest.y) < CONFIG.world.minFoodDistFromNest ||
        this.obstacles.isSet(x, y)) &&
      tries < 25
    );
    const amount = randInt(CONFIG.world.minFoodAmount, CONFIG.world.maxFoodAmount);
    return this.addFoodAt(x, y, amount, type);
  }

  deliverFood(value, role) {
    const before = this.foodCollectedTotal;
    this.storedFood += value;
    this.foodCollectedTotal += value;

    if (Math.floor(this.foodCollectedTotal / 40) > Math.floor(before / 40)) {
      this.pushEvent("Colony stores are growing");
    }

    if (!this.growthEnabled) return;
    while (
      this.storedFood >= CONFIG.colony.growthFoodPerAnt &&
      this.ants.length < this.maxAnts
    ) {
      this.storedFood -= CONFIG.colony.growthFoodPerAnt;
      this.spawnAnt();
    }
  }

  pushEvent(message) {
    this.events.unshift({ message, time: this.elapsed });
    if (this.events.length > 8) this.events.length = 8;
  }

  resizeWorld(width, height) {
    this.world.width = width;
    this.world.height = height;
    this.nest.x = width / 2;
    this.nest.y = height / 2;
    this.foodGrid.reset(width, height, CONFIG.pheromone.cellSize);
    this.homeGrid.reset(width, height, CONFIG.pheromone.cellSize);
    this.dangerGrid.reset(width, height, CONFIG.pheromone.cellSize);
    this.obstacles.reset(width, height, CONFIG.obstacle.cellSize);
    this.hazards.reset(width, height, CONFIG.hazard.cellSize);

    const pad = CONFIG.world.edgePadding;
    for (const ant of this.ants) {
      ant.x = clamp(ant.x, 0, width);
      ant.y = clamp(ant.y, 0, height);
    }
    for (const f of this.food) {
      f.x = clamp(f.x, pad, width - pad);
      f.y = clamp(f.y, pad, height - pad);
    }
  }

  update(dt) {
    this.elapsed += dt;

    const evapFactor = Math.pow(CONFIG.pheromone.evaporationPerSecond, dt);
    const dangerEvapFactor = Math.pow(CONFIG.pheromone.dangerEvaporationPerSecond, dt);
    this.foodGrid.evaporate(evapFactor);
    this.homeGrid.evaporate(evapFactor);
    this.dangerGrid.evaporate(dangerEvapFactor);

    for (const ant of this.ants) ant.update(dt, this);

    if (this.food.some((f) => f.depleted)) {
      this.food = this.food.filter((f) => !f.depleted);
    }
    if (this.ants.some((a) => a.dead && a.fadeT >= CONFIG.hazard.fadeDuration)) {
      this.ants = this.ants.filter((a) => !(a.dead && a.fadeT >= CONFIG.hazard.fadeDuration));
    }

    this._trailCheckTimer += dt;
    if (this._trailCheckTimer > 3) {
      this._trailCheckTimer = 0;
      const maxVal = this.foodGrid.maxValue();
      if (maxVal > CONFIG.pheromone.max * 0.75 && this.elapsed - this._lastMajorTrailAt > 20) {
        this._lastMajorTrailAt = this.elapsed;
        this.pushEvent("Major trail established");
      }
    }
  }

  roleCounts() {
    const counts = { scout: 0, worker: 0, carrier: 0 };
    for (const a of this.ants) if (!a.dead) counts[a.role]++;
    return counts;
  }

  trailStrengthFraction() {
    return clamp(this.foodGrid.maxValue() / CONFIG.pheromone.max, 0, 1);
  }
}
