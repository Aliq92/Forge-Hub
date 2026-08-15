// human.js — individual villager behavior state machine

const HUMAN_SPEED = 34; // pixels per second
const CARRY_CAPACITY = 10;
const GATHER_DURATION = 1.4; // seconds spent chopping/mining/picking
const BUILD_RATE = 1; // work units per second per builder
const ARRIVE_DIST = 4;

const TASK_COLORS = {
  idle: '#d8d8d8',
  wander: '#d8d8d8',
  moveToResource: '#e8c96a',
  gathering: '#e8c96a',
  returning: '#e8c96a',
  moveToBuild: '#e29a4d',
  building: '#e29a4d'
};

const CARRY_COLORS = { wood: '#8a5a2c', food: '#c9425a', stone: '#9aa0a6' };

let __humanId = 0;

class Human {
  constructor(x, y) {
    this.id = ++__humanId;
    this.x = x;
    this.y = y;
    this.age = 0;
    this.hunger = 100;
    this.health = 100;
    this.state = 'wander';
    this.task = null; // { type: 'wood'|'food'|'stone' } or build site ref
    this.target = null; // { x, y, tile? }
    this.carrying = null; // { type, amount }
    this.gatherTimer = 0;
    this.wanderTimer = Math.random() * 2;
    this.wanderTarget = { x, y };
    this.dead = false;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.constructionSite = null;
  }

  distTo(x, y) {
    return Math.hypot(this.x - x, this.y - y);
  }

  moveToward(x, y, dt) {
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const step = HUMAN_SPEED * dt;
    if (step >= d) {
      this.x = x;
      this.y = y;
      return true;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.walkPhase += dt * 10;
    return false;
  }

  update(dt, world, settlement) {
    if (this.dead) return;

    this.age += dt;
    this.hunger = Math.max(0, this.hunger - dt * (100 / 180)); // empties in 3 minutes
    if (this.hunger <= 0) {
      this.health -= dt * 20;
      if (this.health <= 0) {
        this.dead = true;
        return;
      }
    } else if (this.health < 100) {
      this.health = Math.min(100, this.health + dt * 2);
    }

    switch (this.state) {
      case 'wander':
      case 'idle':
        this._doWander(dt, settlement);
        break;
      case 'moveToResource':
        this._doMoveToResource(dt, world, settlement);
        break;
      case 'gathering':
        this._doGathering(dt, world);
        break;
      case 'returning':
        this._doReturning(dt, settlement);
        break;
      case 'moveToBuild':
        this._doMoveToBuild(dt);
        break;
      case 'building':
        this._doBuilding(dt, settlement);
        break;
    }
  }

  _doWander(dt, settlement) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      settlement.requestTask(this);
      if (this.state !== 'wander' && this.state !== 'idle') return;
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      this.wanderTarget = {
        x: Math.min(world_bounds_x(), Math.max(0, this.x + Math.cos(angle) * dist)),
        y: Math.min(world_bounds_y(), Math.max(0, this.y + Math.sin(angle) * dist))
      };
      this.wanderTimer = 2 + Math.random() * 2;
    }
    this.moveToward(this.wanderTarget.x, this.wanderTarget.y, dt);
  }

  _doMoveToResource(dt, world, settlement) {
    if (!this.target || !this.target.tile.resource || this.target.tile.resource.amount <= 0) {
      this.state = 'wander';
      this.target = null;
      return;
    }
    if (this.moveToward(this.target.x, this.target.y, dt)) {
      this.state = 'gathering';
      this.gatherTimer = GATHER_DURATION;
    }
  }

  _doGathering(dt, world) {
    if (!this.target || !this.target.tile.resource) {
      this.state = 'wander';
      this.target = null;
      return;
    }
    this.gatherTimer -= dt;
    if (this.gatherTimer <= 0) {
      const amt = world.harvest(this.target.tile, this.task.type);
      this.carrying = { type: this.task.type, amount: amt };
      this.state = 'returning';
    }
  }

  _doReturning(dt, settlement) {
    if (this.moveToward(settlement.center.x, settlement.center.y, dt)) {
      if (this.carrying) {
        settlement.deposit(this.carrying.type, this.carrying.amount);
        this.carrying = null;
      }
      this.task = null;
      this.target = null;
      this.state = 'wander';
      this.wanderTimer = 0.3;
    }
  }

  _doMoveToBuild(dt) {
    if (!this.constructionSite || this.constructionSite.complete) {
      this.state = 'wander';
      this.constructionSite = null;
      return;
    }
    if (this.moveToward(this.constructionSite.x, this.constructionSite.y, dt)) {
      this.state = 'building';
    }
  }

  _doBuilding(dt, settlement) {
    if (!this.constructionSite || this.constructionSite.complete) {
      this.state = 'wander';
      this.constructionSite = null;
      this.wanderTimer = 0.3;
      return;
    }
    this.constructionSite.progress += BUILD_RATE * dt;
  }

  assignGather(type, targetInfo) {
    this.task = { type };
    this.target = targetInfo;
    this.state = 'moveToResource';
  }

  assignBuild(site) {
    this.constructionSite = site;
    site.workers.add(this);
    this.state = 'moveToBuild';
  }

  render(ctx) {
    const bob = Math.sin(this.walkPhase) * 1.4;
    const color = TASK_COLORS[this.state] || '#d8d8d8';

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 5, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y + bob, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(this.x, this.y - 3 + bob, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // carried resource indicator
    if (this.carrying) {
      ctx.fillStyle = CARRY_COLORS[this.carrying.type] || '#fff';
      ctx.beginPath();
      ctx.arc(this.x + 5, this.y - 6 + bob, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // low hunger warning
    if (this.hunger < 25) {
      ctx.fillStyle = 'rgba(255,60,60,0.9)';
      ctx.beginPath();
      ctx.arc(this.x - 5, this.y - 6 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function world_bounds_x() { return WORLD_COLS * TILE_SIZE; }
function world_bounds_y() { return WORLD_ROWS * TILE_SIZE; }
