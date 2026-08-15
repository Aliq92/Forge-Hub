// Food: simple stationary particles that prey consume for energy.

export class Food {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.alive = true;
    // small per-particle size wobble so a field of food doesn't look uniform
    this.sizeJitter = 0.6 + Math.random() * 0.8;
  }

  static spawnRandom(worldWidth, worldHeight) {
    return new Food(Math.random() * worldWidth, Math.random() * worldHeight);
  }
}
