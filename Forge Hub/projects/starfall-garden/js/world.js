// The planet: a grid of terrain patches inside a circle, biome rings, restoration & health.
SG.World = class {
  constructor(radius) {
    this.radius = radius;
    this.cellSize = (radius * 2) / SG.CONFIG.gridCellsAcross;
    this.patches = [];
    this.map = new Map();
    this.unlockedRadius = radius * SG.CONFIG.rings[0].rMax;
    this._unlockedTarget = this.unlockedRadius;
    this.totalPatches = 0;
    this.restoredCount = 0;
    this.plantsAlive = 0;
    this.scorchEvents = 0;
    this._generate();
  }

  _biomeFor(ringId, angle) {
    if (ringId === 0) return 'ashwastes';
    if (ringId === 2) return 'voidedge';
    // ring 1: split into 3 sectors
    const a = ((angle % SG.util.TAU) + SG.util.TAU) % SG.util.TAU;
    const third = SG.util.TAU / 3;
    if (a < third) return 'meadow';
    if (a < third * 2) return 'crystalgrove';
    return 'frostedridge';
  }

  _generate() {
    const R = this.radius;
    const cs = this.cellSize;
    const cols = SG.CONFIG.gridCellsAcross;
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = -R + cs * (col + 0.5);
        const cy = -R + cs * (row + 0.5);
        const d = Math.sqrt(cx * cx + cy * cy);
        if (d > R - cs * 0.35) continue;
        const frac = d / R;
        let ring = SG.CONFIG.rings[SG.CONFIG.rings.length - 1];
        for (const r of SG.CONFIG.rings) { if (frac <= r.rMax) { ring = r; break; } }
        const angle = Math.atan2(cy, cx);
        const patch = {
          col, row, x: cx, y: cy, dist: d, frac,
          ring: ring.id, biome: this._biomeFor(ring.id, angle),
          state: SG.TERRAIN.DEAD,
          plant: null,
          scorchTimer: 0,
          restoreFx: 0, // 0..1 animation for restoration ring pulse
          jitter: Math.random() * SG.util.TAU,
          sizeJitter: SG.util.rand(0.85, 1.05),
        };
        this.patches.push(patch);
        this.map.set(`${col}_${row}`, patch);
        this.totalPatches++;
      }
    }
  }

  patchAtLocal(x, y) {
    const cs = this.cellSize;
    const col = Math.floor((x + this.radius) / cs);
    const row = Math.floor((y + this.radius) / cs);
    return this.map.get(`${col}_${row}`) || null;
  }

  isUnlocked(patch) { return patch.dist <= this.unlockedRadius + 0.01; }

  currentUnlockTargetRadius(healthPct) {
    let maxR = SG.CONFIG.rings[0].rMax;
    for (const r of SG.CONFIG.rings) if (healthPct >= r.unlockHealth) maxR = Math.max(maxR, r.rMax);
    return this.radius * maxR;
  }

  nextLockedRing(healthPct) {
    for (const r of SG.CONFIG.rings) if (healthPct < r.unlockHealth) return r;
    return null;
  }

  restoreAreaPercent() { return this.totalPatches ? (this.restoredCount / this.totalPatches) * 100 : 0; }

  canRestore(patch) {
    return patch && this.isUnlocked(patch) && patch.state === SG.TERRAIN.DEAD;
  }

  restorePatch(patch, toCrystal) {
    if (!this.canRestore(patch)) return false;
    patch.state = toCrystal ? SG.TERRAIN.CRYSTAL : SG.TERRAIN.RESTORED;
    patch.restoreFx = 1;
    this.restoredCount++;
    return true;
  }

  markBlooming(patch) {
    if (patch.state === SG.TERRAIN.RESTORED || patch.state === SG.TERRAIN.CRYSTAL) {
      if (patch.state === SG.TERRAIN.RESTORED) patch.state = SG.TERRAIN.BLOOMING;
    }
  }

  scorchPatch(patch) {
    const wasAlive = patch.state === SG.TERRAIN.RESTORED || patch.state === SG.TERRAIN.BLOOMING || patch.state === SG.TERRAIN.CRYSTAL;
    if (wasAlive) {
      this.restoredCount = Math.max(0, this.restoredCount - 1);
      patch.state = SG.TERRAIN.SCORCHED;
      patch.scorchTimer = SG.CONFIG.scorchHealSeconds;
      this.scorchEvents++;
      return true;
    }
    return false;
  }

  update(dt, healthPct) {
    this._unlockedTarget = this.currentUnlockTargetRadius(healthPct);
    if (Math.abs(this.unlockedRadius - this._unlockedTarget) > 0.5) {
      this.unlockedRadius = SG.util.lerp(this.unlockedRadius, this._unlockedTarget, Math.min(1, dt * 0.8));
    } else {
      this.unlockedRadius = this._unlockedTarget;
    }

    for (const p of this.patches) {
      if (p.restoreFx > 0) p.restoreFx = Math.max(0, p.restoreFx - dt * 1.4);
      if (p.state === SG.TERRAIN.SCORCHED) {
        p.scorchTimer -= dt;
        if (p.scorchTimer <= 0) p.state = SG.TERRAIN.DEAD;
      }
    }
  }

  reset() {
    for (const p of this.patches) {
      p.state = SG.TERRAIN.DEAD;
      p.plant = null;
      p.scorchTimer = 0;
      p.restoreFx = 0;
    }
    this.restoredCount = 0;
    this.plantsAlive = 0;
    this.scorchEvents = 0;
    this.unlockedRadius = this.radius * SG.CONFIG.rings[0].rMax;
    this._unlockedTarget = this.unlockedRadius;
  }
};
