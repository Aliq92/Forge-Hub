// Prey: wander, flee predators, seek food, eat, reproduce, die.

const TWO_PI = Math.PI * 2;

// shortest signed distance from angle `a` to angle `b`, in (-PI, PI]
function angleDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

function turnToward(current, target, maxTurn) {
  const diff = angleDiff(current, target);
  if (diff > maxTurn) return current + maxTurn;
  if (diff < -maxTurn) return current - maxTurn;
  return current + diff;
}

let nextId = 1;

export class Prey {
  constructor(x, y, cfg, energy) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.angle = Math.random() * TWO_PI;
    this.energy = energy !== undefined ? energy : cfg.energyStart;
    this.reproCooldown = Math.floor(Math.random() * cfg.reproduceCooldownFrames);
    this.alive = true;
    this.fleeing = false;
  }

  // Finds nearest predator within detection radius; returns {predator, distSq} or null.
  static findNearestPredator(prey, predators, radius) {
    const radiusSq = radius * radius;
    let nearest = null;
    let nearestDistSq = radiusSq;
    for (const predator of predators) {
      const dx = predator.x - prey.x;
      const dy = predator.y - prey.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = predator;
      }
    }
    return nearest ? { entity: nearest, distSq: nearestDistSq } : null;
  }

  // Finds nearest living food within vision radius.
  static findNearestFood(prey, foodList, radius) {
    const radiusSq = radius * radius;
    let nearest = null;
    let nearestDistSq = radiusSq;
    for (const food of foodList) {
      const dx = food.x - prey.x;
      const dy = food.y - prey.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = food;
      }
    }
    return nearest ? { entity: nearest, distSq: nearestDistSq } : null;
  }

  update(cfg, world, predators, foodList) {
    const threat = Prey.findNearestPredator(this, predators, cfg.predatorDetectionRadius);
    let targetFood = null;

    if (threat) {
      // Flee directly away from the nearest predator.
      this.fleeing = true;
      const dx = this.x - threat.entity.x;
      const dy = this.y - threat.entity.y;
      const fleeAngle = Math.atan2(dy, dx);
      this.angle = turnToward(this.angle, fleeAngle, cfg.turnRate * 1.6);
    } else {
      this.fleeing = false;
      targetFood = Prey.findNearestFood(this, foodList, cfg.visionRadius);
      if (targetFood) {
        const dx = targetFood.entity.x - this.x;
        const dy = targetFood.entity.y - this.y;
        const seekAngle = Math.atan2(dy, dx);
        this.angle = turnToward(this.angle, seekAngle, cfg.turnRate);
      } else {
        // Wander: nudge heading with a bit of randomness.
        this.angle += (Math.random() - 0.5) * cfg.wanderJitter;
      }
    }

    const speed = cfg.maxSpeed;
    this.x += Math.cos(this.angle) * speed;
    this.y += Math.sin(this.angle) * speed;

    if (world.wrapEdges) {
      if (this.x < 0) this.x += world.width;
      if (this.x >= world.width) this.x -= world.width;
      if (this.y < 0) this.y += world.height;
      if (this.y >= world.height) this.y -= world.height;
    } else {
      this.x = Math.max(0, Math.min(world.width, this.x));
      this.y = Math.max(0, Math.min(world.height, this.y));
    }

    const drain = this.fleeing ? cfg.energyDrain * cfg.fleeEnergyDrainMultiplier : cfg.energyDrain;
    this.energy -= drain;

    if (this.reproCooldown > 0) this.reproCooldown--;

    // Eat nearby food.
    if (targetFood && targetFood.entity.alive) {
      const dx = targetFood.entity.x - this.x;
      const dy = targetFood.entity.y - this.y;
      if (dx * dx + dy * dy <= cfg.eatRadius * cfg.eatRadius) {
        targetFood.entity.alive = false;
        this.energy = Math.min(cfg.energyMax, this.energy + cfg.energyFromFood);
      }
    }

    if (this.energy <= 0) {
      this.alive = false;
    }
  }

  canReproduce(cfg, currentCount) {
    return (
      this.alive &&
      this.energy >= cfg.reproduceEnergyThreshold &&
      this.reproCooldown <= 0 &&
      currentCount < cfg.maxCount
    );
  }

  reproduce(cfg) {
    this.energy -= cfg.reproduceCost;
    this.reproCooldown = cfg.reproduceCooldownFrames;
    const offsetAngle = Math.random() * TWO_PI;
    const child = new Prey(
      this.x + Math.cos(offsetAngle) * 4,
      this.y + Math.sin(offsetAngle) * 4,
      cfg,
      cfg.reproduceCost * 0.7
    );
    child.reproCooldown = cfg.reproduceCooldownFrames;
    return child;
  }
}
