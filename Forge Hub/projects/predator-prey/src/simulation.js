// Simulation: owns all entities and world state, advances the ecosystem one
// fixed tick at a time, and renders the current state onto a canvas.
// Update (logic) and render (drawing) are kept as separate methods so the
// simulation can, in principle, run its logic independent of how/when it's drawn.

import { CONFIG } from './config.js';
import { Prey } from './prey.js';
import { Predator } from './predator.js';
import { Food } from './food.js';

const TWO_PI = Math.PI * 2;

function createGlowSprite(size, color, glowColor) {
  const canvasSize = Math.ceil(size * 8);
  const c = document.createElement('canvas');
  c.width = canvasSize;
  c.height = canvasSize;
  const ctx = c.getContext('2d');
  const center = canvasSize / 2;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, size * 3.2);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, size * 3.2, 0, TWO_PI);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, size, 0, TWO_PI);
  ctx.fill();

  return c;
}

export class Simulation {
  constructor(width, height) {
    this.world = { width, height, wrapEdges: CONFIG.world.wrapEdges };
    this.tick = 0;
    this.sprites = {
      prey: createGlowSprite(CONFIG.prey.size, CONFIG.prey.color, CONFIG.prey.glowColor),
      predator: createGlowSprite(CONFIG.predator.size, CONFIG.predator.color, CONFIG.predator.glowColor),
      food: createGlowSprite(CONFIG.food.size, CONFIG.food.color, CONFIG.food.glowColor),
    };
    this.reset();
  }

  reset() {
    this.tick = 0;
    this.prey = [];
    this.predators = [];
    this.food = [];

    for (let i = 0; i < CONFIG.prey.startCount; i++) {
      this.prey.push(
        new Prey(Math.random() * this.world.width, Math.random() * this.world.height, CONFIG.prey)
      );
    }
    for (let i = 0; i < CONFIG.predator.startCount; i++) {
      this.predators.push(
        new Predator(Math.random() * this.world.width, Math.random() * this.world.height, CONFIG.predator)
      );
    }
    for (let i = 0; i < CONFIG.food.startCount; i++) {
      this.food.push(Food.spawnRandom(this.world.width, this.world.height));
    }
  }

  resize(width, height) {
    this.world.width = width;
    this.world.height = height;
  }

  // Advances the ecosystem by exactly one fixed simulation tick.
  update() {
    this.tick++;
    const cfg = CONFIG;

    // --- Food spawning ---
    if (this.food.length < cfg.food.maxCount) {
      const expected = cfg.food.spawnPerFrame;
      const spawnCount = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
      for (let i = 0; i < spawnCount && this.food.length < cfg.food.maxCount; i++) {
        this.food.push(Food.spawnRandom(this.world.width, this.world.height));
      }
    }

    // --- Prey update ---
    const newPrey = [];
    for (const p of this.prey) {
      p.update(cfg.prey, this.world, this.predators, this.food);
      if (p.alive && p.canReproduce(cfg.prey, this.prey.length + newPrey.length)) {
        newPrey.push(p.reproduce(cfg.prey));
      }
    }
    if (newPrey.length) this.prey.push(...newPrey);
    this.prey = this.prey.filter((p) => p.alive);

    // --- Predator update ---
    const newPredators = [];
    for (const pr of this.predators) {
      pr.update(cfg.predator, this.world, this.prey);
      if (pr.alive && pr.canReproduce(cfg.predator, this.predators.length + newPredators.length)) {
        newPredators.push(pr.reproduce(cfg.predator));
      }
    }
    if (newPredators.length) this.predators.push(...newPredators);
    this.predators = this.predators.filter((pr) => pr.alive);

    // --- Remove eaten food ---
    if (this.food.some((f) => !f.alive)) {
      this.food = this.food.filter((f) => f.alive);
    }
  }

  render(ctx) {
    const { width, height } = this.world;

    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';

    const foodSprite = this.sprites.food;
    const foodHalf = foodSprite.width / 2;
    for (const f of this.food) {
      ctx.drawImage(foodSprite, f.x - foodHalf, f.y - foodHalf);
    }

    const preySprite = this.sprites.prey;
    const preyHalf = preySprite.width / 2;
    for (const p of this.prey) {
      ctx.drawImage(preySprite, p.x - preyHalf, p.y - preyHalf);
    }

    const predatorSprite = this.sprites.predator;
    const predatorHalf = predatorSprite.width / 2;
    for (const pr of this.predators) {
      ctx.drawImage(predatorSprite, pr.x - predatorHalf, pr.y - predatorHalf);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  getStats() {
    return {
      preyCount: this.prey.length,
      predatorCount: this.predators.length,
      foodCount: this.food.length,
      elapsedSeconds: this.tick / 60,
    };
  }
}
