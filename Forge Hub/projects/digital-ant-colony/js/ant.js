// A single ant. Behaviour is a small state machine (searching / returning,
// plus a transient "fleeing" reaction to danger) driven entirely by local
// information: what it can sense right where it is standing. There is no
// global pathfinding and no memory of a route — any efficient paths that
// appear are an emergent side effect of pheromone reinforcement, exactly as
// in a real colony.
class Ant {
  constructor(x, y, role) {
    this.x = x;
    this.y = y;
    this.role = role && CONFIG.roles[role] ? role : pickWeighted({
      scout: CONFIG.roles.scout.ratio,
      worker: CONFIG.roles.worker.ratio,
      carrier: CONFIG.roles.carrier.ratio,
    });
    const roleDef = CONFIG.roles[this.role];

    this.heading = rand(0, TAU);
    this.speed =
      (CONFIG.ant.baseSpeed + rand(-CONFIG.ant.speedVariance, CONFIG.ant.speedVariance)) *
      roleDef.speedMult;
    this.state = "searching"; // "searching" | "returning"

    // Per-ant trait: how strongly this individual bends toward pheromone
    // trails. Low-affinity ants behave like scouts, high-affinity ants
    // behave like recruits — a cheap way to keep the colony varied, seeded
    // from the ant's role so scouts/workers/carriers read differently.
    this.pheromoneAffinity = rand(roleDef.affinity[0], roleDef.affinity[1]);

    this.carryingType = null;
    this.carryingValue = 0;

    this.fleeTimer = 0;
    this.fleeHeading = 0;
    this.dangerExposure = 0;
    this.dead = false;
    this.fadeT = 0;

    this._avoidBias = 0;
    this._stuckTimer = rand(0, CONFIG.ant.stuckCheckInterval);
    this._lastCheckX = x;
    this._lastCheckY = y;
    this.age = 0;
  }

  get carrying() {
    return this.state === "returning";
  }

  get stateLabel() {
    if (this.dead) return "FADING";
    if (this.fleeTimer > 0) return "AVOIDING_DANGER";
    return this.state === "returning" ? "RETURNING_HOME" : "SEARCHING";
  }

  update(dt, colony) {
    if (this.dead) {
      this.fadeT += dt;
      return;
    }

    this.age += dt;
    this.handleHazards(dt, colony);

    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      this.heading = turnToward(this.heading, this.fleeHeading, CONFIG.ant.fleeSteerPerSecond * dt);
      this.heading += (Math.random() * 2 - 1) * CONFIG.ant.wanderJitter * 0.4 * dt;
    } else if (this.state === "searching") {
      this.updateSearching(dt, colony);
    } else {
      this.updateReturning(dt, colony);
    }

    this.avoidObstacles(dt, colony);
    this.steerFromEdges(dt, colony.world);
    this.updateStuck(dt);

    const roleDef = CONFIG.roles[this.role];
    let speed = this.speed;
    if (this.carrying && this.carryingType) {
      const weight = CONFIG.foodTypes[this.carryingType].weight;
      speed *= roleDef.loadedSpeedMult * (1 - weight);
    }

    const nx = this.x + Math.cos(this.heading) * speed * dt;
    const ny = this.y + Math.sin(this.heading) * speed * dt;
    this.moveWithCollision(nx, ny, colony);
  }

  moveWithCollision(nx, ny, colony) {
    // Clamp to world bounds *before* the obstacle check: MaskGrid.isSet()
    // treats out-of-world coordinates as "not blocked" (there's nothing to
    // paint there), so checking an unclamped point lets an ant tunnel along
    // the outside of a wall that touches the world edge and then get
    // clamped straight into it.
    nx = clamp(nx, 0, colony.world.width);
    ny = clamp(ny, 0, colony.world.height);

    const obstacles = colony.obstacles;
    let finalX = nx;
    let finalY = ny;
    if (obstacles && obstacles.isSet(nx, ny)) {
      if (!obstacles.isSet(nx, this.y)) {
        finalY = this.y;
      } else if (!obstacles.isSet(this.x, ny)) {
        finalX = this.x;
      } else {
        finalX = this.x;
        finalY = this.y;
        this.heading += rand(-2.4, 2.4);
      }
    }
    this.x = finalX;
    this.y = finalY;
  }

  updateSearching(dt, colony) {
    const roleDef = CONFIG.roles[this.role];

    // Organic random walk.
    this.heading += (Math.random() * 2 - 1) * CONFIG.ant.wanderJitter * roleDef.wanderMult * dt;

    // Lay a thin "how I got here" trail so a later trip back (by this ant or
    // any other) has a real breadcrumb to follow instead of an omniscient
    // beeline to the nest.
    colony.homeGrid.deposit(this.x, this.y, CONFIG.pheromone.homeDepositAmount * dt);

    // Sample the food trail slightly ahead-left / ahead / ahead-right and
    // bend gently toward whichever direction smells strongest. Deliberately
    // imperfect: it only ever nudges the heading, so ants still wander off
    // real trails fairly often.
    const grid = colony.foodGrid;
    const d = CONFIG.pheromone.senseDistance;
    const spread = CONFIG.pheromone.senseSpread;
    const left = grid.sampleAt(
      this.x + Math.cos(this.heading - spread) * d,
      this.y + Math.sin(this.heading - spread) * d
    );
    const center = grid.sampleAt(
      this.x + Math.cos(this.heading) * d,
      this.y + Math.sin(this.heading) * d
    );
    const right = grid.sampleAt(
      this.x + Math.cos(this.heading + spread) * d,
      this.y + Math.sin(this.heading + spread) * d
    );
    const strongest = Math.max(left, center, right);
    if (strongest > CONFIG.pheromone.minSenseValue) {
      let turnDir = 0;
      if (left > center && left >= right) turnDir = -1;
      else if (right > center && right > left) turnDir = 1;
      if (turnDir !== 0) {
        this.heading +=
          turnDir * this.pheromoneAffinity * CONFIG.ant.pheromoneSteerPerSecond * dt;
      }
    }

    this.avoidDanger(dt, colony);
    this.trySenseFood(colony, roleDef);
  }

  trySenseFood(colony, roleDef) {
    const sensor = CONFIG.ant.sensorRadius * roleDef.sensorMult;
    for (const food of colony.food) {
      if (food.amount <= 0) continue;
      const reach = sensor + food.radius;
      if (dist(this.x, this.y, food.x, food.y) > reach) continue;

      if (!food.discovered) {
        food.discovered = true;
        colony.pushEvent(`${food.def.label} source discovered`);
      }

      if (food.takeUnit()) {
        this.state = "returning";
        this.carryingType = food.type;
        this.carryingValue = food.def.value;
        const toNest = Math.atan2(colony.nest.y - this.y, colony.nest.x - this.x);
        this.heading = toNest + rand(-0.4, 0.4);
        if (food.depleted) colony.pushEvent(`${food.def.label} source exhausted`);
      }
      break;
    }
  }

  updateReturning(dt, colony) {
    const beeline = Math.atan2(colony.nest.y - this.y, colony.nest.x - this.x);

    // Follow the home-pheromone trail this (or another) ant laid on the way
    // out, the same way a searching ant follows a food trail. This is what
    // lets a physically longer detour around an obstacle earn a weaker trail
    // than a short one — route quality emerges instead of being hard-coded.
    const grid = colony.homeGrid;
    const d = CONFIG.pheromone.senseDistance;
    const spread = CONFIG.pheromone.senseSpread;
    const left = grid.sampleAt(
      this.x + Math.cos(this.heading - spread) * d,
      this.y + Math.sin(this.heading - spread) * d
    );
    const center = grid.sampleAt(
      this.x + Math.cos(this.heading) * d,
      this.y + Math.sin(this.heading) * d
    );
    const right = grid.sampleAt(
      this.x + Math.cos(this.heading + spread) * d,
      this.y + Math.sin(this.heading + spread) * d
    );
    const strongest = Math.max(left, center, right);
    if (strongest > CONFIG.pheromone.minSenseValue) {
      let turnDir = 0;
      if (left > center && left >= right) turnDir = -1;
      else if (right > center && right > left) turnDir = 1;
      if (turnDir !== 0) {
        this.heading += turnDir * this.pheromoneAffinity * CONFIG.ant.pheromoneSteerPerSecond * dt;
      }
    }

    // Small homing bias toward the nest so ants never get permanently lost
    // if the trail they're on has fully evaporated or been erased.
    this.heading = turnToward(
      this.heading,
      beeline,
      CONFIG.pheromone.homeReturnBlend * CONFIG.ant.nestSteerPerSecond * dt
    );
    this.heading += (Math.random() * 2 - 1) * CONFIG.ant.returnJitter * dt;

    colony.foodGrid.deposit(this.x, this.y, CONFIG.pheromone.depositAmount * dt);
    this.avoidDanger(dt, colony);

    if (dist(this.x, this.y, colony.nest.x, colony.nest.y) <= CONFIG.colony.depositRadius) {
      colony.deliverFood(this.carryingValue, this.role);
      this.state = "searching";
      this.carryingType = null;
      this.carryingValue = 0;
      this.heading = rand(0, TAU);
    }
  }

  avoidDanger(dt, colony) {
    const grid = colony.dangerGrid;
    const d = CONFIG.ant.dangerSenseDistance;
    const spread = CONFIG.pheromone.senseSpread;
    const left = grid.sampleAt(
      this.x + Math.cos(this.heading - spread) * d,
      this.y + Math.sin(this.heading - spread) * d
    );
    const center = grid.sampleAt(
      this.x + Math.cos(this.heading) * d,
      this.y + Math.sin(this.heading) * d
    );
    const right = grid.sampleAt(
      this.x + Math.cos(this.heading + spread) * d,
      this.y + Math.sin(this.heading + spread) * d
    );
    const strongest = Math.max(left, center, right);
    if (strongest <= CONFIG.pheromone.minSenseValue * 1.5) return;

    let turnDir = 0;
    if (left > center && left >= right) turnDir = 1; // danger on the left -> steer right
    else if (right > center && right > left) turnDir = -1;
    else turnDir = this._avoidBias || (this._avoidBias = Math.random() < 0.5 ? -1 : 1);
    this.heading += turnDir * CONFIG.ant.dangerSteerPerSecond * dt;
  }

  handleHazards(dt, colony) {
    if (colony.hazards.isSet(this.x, this.y)) {
      colony.dangerGrid.deposit(this.x, this.y, CONFIG.pheromone.dangerDepositAmount * dt);
      this.dangerExposure += dt;
      if (this.fleeTimer <= 0) {
        this.fleeHeading = this.heading + Math.PI + rand(-0.5, 0.5);
      }
      this.fleeTimer = CONFIG.ant.fleeDuration;
      if (this.dangerExposure > CONFIG.hazard.exposureLimit && !this.dead) {
        this.dead = true;
        colony.pushEvent("An ant was lost to a hazard");
      }
    } else if (this.dangerExposure > 0) {
      this.dangerExposure = Math.max(0, this.dangerExposure - dt * 2);
    }
  }

  avoidObstacles(dt, colony) {
    const g = colony.obstacles;
    if (!g || g.isEmpty()) return;
    const d = CONFIG.ant.obstacleSenseDistance;
    const spread = CONFIG.pheromone.senseSpread;
    const leftBlocked = g.isSet(this.x + Math.cos(this.heading - spread) * d, this.y + Math.sin(this.heading - spread) * d);
    const centerBlocked = g.isSet(this.x + Math.cos(this.heading) * d, this.y + Math.sin(this.heading) * d);
    const rightBlocked = g.isSet(this.x + Math.cos(this.heading + spread) * d, this.y + Math.sin(this.heading + spread) * d);

    let turnDir = 0;
    if (leftBlocked && !rightBlocked) {
      turnDir = 1;
      this._avoidBias = 0;
    } else if (rightBlocked && !leftBlocked) {
      turnDir = -1;
      this._avoidBias = 0;
    } else if (leftBlocked || rightBlocked || centerBlocked) {
      turnDir = this._avoidBias || (this._avoidBias = Math.random() < 0.5 ? -1 : 1);
    } else {
      this._avoidBias = 0;
    }
    if (turnDir !== 0) this.heading += turnDir * CONFIG.ant.obstacleSteerPerSecond * dt;
  }

  updateStuck(dt) {
    this._stuckTimer += dt;
    if (this._stuckTimer < CONFIG.ant.stuckCheckInterval) return;
    this._stuckTimer = 0;
    const moved = dist(this.x, this.y, this._lastCheckX, this._lastCheckY);
    if (moved < CONFIG.ant.stuckDistance) {
      this.heading += (Math.random() < 0.5 ? -1 : 1) * CONFIG.ant.stuckKick + rand(-0.3, 0.3);
    }
    this._lastCheckX = this.x;
    this._lastCheckY = this.y;
  }

  steerFromEdges(dt, world) {
    const m = CONFIG.ant.edgeMargin;
    let pushX = 0;
    let pushY = 0;
    if (this.x < m) pushX += 1;
    if (this.x > world.width - m) pushX -= 1;
    if (this.y < m) pushY += 1;
    if (this.y > world.height - m) pushY -= 1;
    if (pushX !== 0 || pushY !== 0) {
      const target = Math.atan2(pushY, pushX);
      this.heading = turnToward(this.heading, target, CONFIG.ant.edgeSteerPerSecond * dt);
    }
  }

  // Adds this ant's body as a closed subpath to `ctx` without filling it,
  // so the caller can batch many ants into a single fill() call.
  appendShape(ctx) {
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const len = 4.6;
    const wid = 1.9;
    const tipX = this.x + c * len;
    const tipY = this.y + s * len;
    const backX = this.x - c * len * 0.75;
    const backY = this.y - s * len * 0.75;
    const leftX = this.x - s * wid;
    const leftY = this.y + c * wid;
    const rightX = this.x + s * wid;
    const rightY = this.y - c * wid;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(backX, backY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
  }

  // A small food marker riding just behind the head, only meaningful while
  // carrying — this is what makes "that ant found food" readable at a glance.
  drawCarryMarker(ctx) {
    if (!this.carrying || !this.carryingType) return;
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    const mx = this.x - c * 2.6;
    const my = this.y - s * 2.6;
    ctx.fillStyle = `rgba(${CONFIG.foodTypes[this.carryingType].color}, 0.95)`;
    ctx.beginPath();
    ctx.arc(mx, my, 1.7, 0, TAU);
    ctx.fill();
  }
}
