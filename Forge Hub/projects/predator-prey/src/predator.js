// Predator: wander, chase prey, kill and eat, reproduce, starve.

const TWO_PI = Math.PI * 2;

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

export class Predator {
  constructor(x, y, cfg, energy) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.angle = Math.random() * TWO_PI;
    this.energy = energy !== undefined ? energy : cfg.energyStart;
    this.reproCooldown = Math.floor(Math.random() * cfg.reproduceCooldownFrames);
    this.alive = true;
    this.hunting = false;
  }

  static findNearestPrey(predator, preyList, radius) {
    const radiusSq = radius * radius;
    let nearest = null;
    let nearestDistSq = radiusSq;
    for (const prey of preyList) {
      const dx = prey.x - predator.x;
      const dy = prey.y - predator.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = prey;
      }
    }
    return nearest ? { entity: nearest, distSq: nearestDistSq } : null;
  }

  update(cfg, world, preyList) {
    const target = Predator.findNearestPrey(this, preyList, cfg.visionRadius);

    if (target) {
      this.hunting = true;
      const dx = target.entity.x - this.x;
      const dy = target.entity.y - this.y;
      const chaseAngle = Math.atan2(dy, dx);
      this.angle = turnToward(this.angle, chaseAngle, cfg.turnRate * 1.4);
    } else {
      this.hunting = false;
      this.angle += (Math.random() - 0.5) * cfg.wanderJitter;
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

    this.energy -= cfg.energyDrain;
    if (this.reproCooldown > 0) this.reproCooldown--;

    // Kill nearby prey.
    if (target && target.entity.alive) {
      const dx = target.entity.x - this.x;
      const dy = target.entity.y - this.y;
      if (dx * dx + dy * dy <= cfg.killRadius * cfg.killRadius) {
        target.entity.alive = false;
        this.energy = Math.min(cfg.energyMax, this.energy + cfg.energyFromPrey);
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
    const child = new Predator(
      this.x + Math.cos(offsetAngle) * 5,
      this.y + Math.sin(offsetAngle) * 5,
      cfg,
      cfg.reproduceCost * 0.7
    );
    child.reproCooldown = cfg.reproduceCooldownFrames;
    return child;
  }
}
