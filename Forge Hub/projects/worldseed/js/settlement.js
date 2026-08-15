// settlement.js — the village: inventory, houses, construction, feeding, reproduction

const HOUSE_COST = { wood: 20, stone: 10 };
const HOUSE_BUILD_WORK = 12; // worker-seconds required
const BASE_HOUSING_CAPACITY = 6;
const HOUSING_PER_HOUSE = 4;
const FEED_INTERVAL = 6; // seconds between feeding rounds
const FEED_AMOUNT_PER_FOOD = 40; // hunger restored per food unit
const REPRO_INTERVAL = 9; // seconds between reproduction checks
const REPRO_FOOD_COST = 15;
const REPRO_CHANCE = 0.5;
const MAX_POPULATION = 60;

class Settlement {
  constructor(world) {
    this.world = world;
    this.center = { x: world.center.x, y: world.center.y };
    this.inventory = { wood: 30, food: 40, stone: 15 };
    this.houses = [];
    this.constructionSites = [];
    this.feedTimer = FEED_INTERVAL;
    this.reproTimer = REPRO_INTERVAL;
    this.day = 1;
    this.year = 1;
    this._dayClock = 0;
    this.dayLength = 18; // seconds per in-game day at 1x speed
  }

  deposit(type, amount) {
    this.inventory[type] = (this.inventory[type] || 0) + amount;
  }

  housingCapacity() {
    return BASE_HOUSING_CAPACITY + this.houses.length * HOUSING_PER_HOUSE;
  }

  // Decide what an idle human should do next.
  requestTask(human) {
    // 1. Building takes priority if a site needs hands.
    const openSite = this.constructionSites.find(s => !s.complete && s.workers.size < s.maxWorkers);
    if (openSite) {
      human.assignBuild(openSite);
      return;
    }

    // 2. Otherwise gather whichever resource is most needed.
    const targetWood = 60;
    const targetStone = 50;
    const targetFood = 20 + this._populationCount() * 6;

    const weights = {
      wood: Math.max(4, targetWood - this.inventory.wood),
      stone: Math.max(4, targetStone - this.inventory.stone),
      food: Math.max(6, (targetFood - this.inventory.food) * 1.5)
    };

    const type = this._weightedPick(weights);
    const node = this.world.findNearestResource(type, human.x, human.y);
    if (!node) return; // nothing to gather right now, keep wandering

    human.assignGather(type, node);
  }

  _weightedPick(weights) {
    const total = weights.wood + weights.stone + weights.food;
    let r = Math.random() * total;
    for (const key of ['wood', 'stone', 'food']) {
      if (r < weights[key]) return key;
      r -= weights[key];
    }
    return 'wood';
  }

  _populationCount() {
    return this._humansRef ? this._humansRef.length : 0;
  }

  tryStartConstruction() {
    if (this.constructionSites.some(s => !s.complete)) return;
    if (this.inventory.wood < HOUSE_COST.wood || this.inventory.stone < HOUSE_COST.stone) return;

    // Keep a small buffer of empty housing, but don't build far beyond what
    // the current population could ever fill.
    const popCount = this._populationCount();
    if (this.houses.length >= 3 && this.housingCapacity() - popCount > 8) return;

    const spot = this._findBuildSpot();
    if (!spot) return;

    this.inventory.wood -= HOUSE_COST.wood;
    this.inventory.stone -= HOUSE_COST.stone;

    this.constructionSites.push({
      x: spot.x,
      y: spot.y,
      col: spot.col,
      row: spot.row,
      progress: 0,
      required: HOUSE_BUILD_WORK,
      maxWorkers: 3,
      workers: new Set(),
      complete: false
    });
  }

  _findBuildSpot() {
    const world = this.world;
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 60;
      const x = this.center.x + Math.cos(angle) * dist;
      const y = this.center.y + Math.sin(angle) * dist;
      const { col, row } = world.tileCoordAtPixel(x, y);
      const tile = world.getTile(col, row);
      if (!tile || tile.type !== 'grass' || tile.resource) continue;
      if (this.houses.some(h => Math.hypot(h.x - x, h.y - y) < 22)) continue;
      if (this.constructionSites.some(s => Math.hypot(s.x - x, s.y - y) < 22)) continue;
      const p = world.tileCenterPixel(col, row);
      return { x: p.x, y: p.y, col, row };
    }
    return null;
  }

  update(dt, humans) {
    this._humansRef = humans;

    // day/year clock
    this._dayClock += dt;
    if (this._dayClock >= this.dayLength) {
      this._dayClock -= this.dayLength;
      this.day++;
      if (this.day > 30) {
        this.day = 1;
        this.year++;
      }
    }

    // construction progress
    for (const site of this.constructionSites) {
      if (site.complete) continue;
      if (site.progress >= site.required) {
        site.complete = true;
        this.houses.push({ x: site.x, y: site.y });
        for (const w of site.workers) {
          w.constructionSite = null;
          w.state = 'wander';
          w.wanderTimer = 0.2;
        }
      }
    }
    this.constructionSites = this.constructionSites.filter(s => !s.complete);

    this.tryStartConstruction();

    // feeding
    this.feedTimer -= dt;
    if (this.feedTimer <= 0) {
      this.feedTimer = FEED_INTERVAL;
      const hungry = humans.filter(h => !h.dead && h.hunger < 100).sort((a, b) => a.hunger - b.hunger);
      for (const h of hungry) {
        if (this.inventory.food < 1) break;
        this.inventory.food -= 1;
        h.hunger = Math.min(100, h.hunger + FEED_AMOUNT_PER_FOOD);
      }
    }

    // reproduction
    this.reproTimer -= dt;
    if (this.reproTimer <= 0) {
      this.reproTimer = REPRO_INTERVAL;
      const alive = humans.filter(h => !h.dead).length;
      if (
        this.inventory.food >= REPRO_FOOD_COST &&
        alive < this.housingCapacity() &&
        alive < MAX_POPULATION &&
        Math.random() < REPRO_CHANCE
      ) {
        this.inventory.food -= REPRO_FOOD_COST;
        humans.push(this._spawnChild());
      }
    }
  }

  _spawnChild() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 12;
    const spot = this.houses.length
      ? this.houses[Math.floor(Math.random() * this.houses.length)]
      : this.center;
    return new Human(spot.x + Math.cos(angle) * dist, spot.y + Math.sin(angle) * dist);
  }

  render(ctx) {
    // settlement flag / center marker
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5b3a20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.center.x, this.center.y - 6);
    ctx.lineTo(this.center.x, this.center.y - 16);
    ctx.stroke();
    ctx.fillStyle = '#c94040';
    ctx.beginPath();
    ctx.moveTo(this.center.x, this.center.y - 16);
    ctx.lineTo(this.center.x + 10, this.center.y - 12);
    ctx.lineTo(this.center.x, this.center.y - 8);
    ctx.closePath();
    ctx.fill();

    // completed houses
    for (const h of this.houses) this._renderHouse(ctx, h.x, h.y, 1);

    // construction sites (scaffolding that fills in with progress)
    for (const s of this.constructionSites) {
      const ratio = Math.min(1, s.progress / s.required);
      this._renderHouse(ctx, s.x, s.y, ratio, true);
    }
  }

  _renderHouse(ctx, x, y, ratio, underConstruction = false) {
    const w = 16, h = 12;
    const top = y - h * ratio;

    if (underConstruction) {
      ctx.strokeStyle = 'rgba(200,200,200,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2, y - h, w, h);
    }

    ctx.fillStyle = '#a97c50';
    ctx.fillRect(x - w / 2, top, w, h * ratio);

    if (ratio > 0.8) {
      ctx.fillStyle = '#7a3b2e';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 2, y - h);
      ctx.lineTo(x, y - h - 8);
      ctx.lineTo(x + w / 2 + 2, y - h);
      ctx.closePath();
      ctx.fill();
    }
  }
}
