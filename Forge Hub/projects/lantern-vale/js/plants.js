// Magical plant life: moonflowers, ember reeds, star moss and lumen trees.
// They wake when touched by lantern light, gradually making the valley feel
// more alive as the player explores and shrines are activated.
import { dist } from './utils.js';
import { COLORS } from './config.js';

const EMBER_REED_ENERGY = 14;
const EMBER_REED_COOLDOWN = 26;

export class PlantManager {
  constructor(world, particles) {
    this.world = world;
    this.particles = particles;
    this.hiddenPathsFound = 0;
  }

  update(dt, player, onInteractRequested) {
    const lr = player.lantern.radius;
    const px = player.x, py = player.y;

    for (const f of this.world.objects.moonflowers) {
      if (!f.awake && dist(f.x, f.y, px, py) < lr * 0.9) {
        f.awake = true;
        this._burst(f.x, f.y, COLORS.magic.paleBlue, 10);
      }
    }

    for (const t of this.world.objects.lumenTrees) {
      if (!t.discovered && dist(t.x, t.y, px, py) < lr) {
        t.discovered = true;
        this._burst(t.x, t.y, COLORS.lantern.gold, 16);
      }
    }

    for (const sm of this.world.objects.starMoss) {
      if (!sm.discovered && dist(sm.x, sm.y, px, py) < lr * 0.85) {
        sm.discovered = true;
      }
    }

    for (const hp of this.world.objects.hiddenPaths) {
      if (hp.discovered) continue;
      const near = hp.points.some(p => dist(p.x, p.y, px, py) < lr * 0.8);
      if (near) { hp.discovered = true; this.hiddenPathsFound++; this._burst(px, py, COLORS.magic.cyan, 6); }
    }

    for (const er of this.world.objects.emberReeds) {
      if (!er.ready) {
        er.cooldown -= dt;
        if (er.cooldown <= 0) er.ready = true;
      }
    }
  }

  tryInteract(player) {
    const reach = 46;
    for (const er of this.world.objects.emberReeds) {
      if (er.ready && dist(er.x, er.y, player.x, player.y) < reach) {
        er.ready = false;
        er.cooldown = EMBER_REED_COOLDOWN;
        player.lantern.recharge(EMBER_REED_ENERGY);
        this._burst(er.x, er.y, COLORS.magic.green, 12);
        return true;
      }
    }
    return false;
  }

  awakenNear(x, y, radius) {
    for (const f of this.world.objects.moonflowers) {
      if (!f.awake && dist(f.x, f.y, x, y) < radius) { f.awake = true; this._burst(f.x, f.y, COLORS.magic.paleBlue, 8); }
    }
  }

  _burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 40;
      this.particles.spawn({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 20,
        life: 0, maxLife: 0.8 + Math.random() * 0.4, size: 2 + Math.random() * 2,
        color, glow: true, gravity: 30, drag: 0.94
      });
    }
  }
}
