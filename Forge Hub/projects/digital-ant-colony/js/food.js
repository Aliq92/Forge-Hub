// A single food source: a finite cluster of nutrients that ants whittle
// down one unit at a time. Visually it's a small cluster of organic blobs
// that shrink together as the source is depleted. `type` selects one of
// CONFIG.foodTypes, which drives its size, colony value, and how much it
// slows an ant down while being carried.
class FoodSource {
  constructor(x, y, amount, type) {
    this.x = x;
    this.y = y;
    this.type = type && CONFIG.foodTypes[type] ? type : "crumbs";
    this.maxAmount = amount;
    this.amount = amount;
    this.discovered = false;
    this.depleted = false;

    // Precompute a handful of irregular blob offsets so the cluster reads as
    // organic rather than a perfect circle, and shrinks in place consistently.
    const blobCount = randInt(5, 8);
    this.blobs = [];
    for (let i = 0; i < blobCount; i++) {
      const angle = rand(0, TAU);
      const d = rand(0, this.baseRadius() * 0.6);
      this.blobs.push({
        ox: Math.cos(angle) * d,
        oy: Math.sin(angle) * d,
        r: rand(3, 6),
      });
    }
  }

  get def() {
    return CONFIG.foodTypes[this.type];
  }

  baseRadius() {
    const scale = this.type === "fruit" ? 1.35 : this.type === "protein" ? 1.15 : this.type === "sugar" ? 0.9 : 0.75;
    return (6 + Math.sqrt(this.maxAmount) * 1.6) * scale;
  }

  get radius() {
    return Math.max(4, this.baseRadius() * this.fraction());
  }

  fraction() {
    return this.amount / this.maxAmount;
  }

  takeUnit() {
    if (this.amount <= 0) return false;
    this.amount -= 1;
    if (this.amount <= 0) {
      this.amount = 0;
      this.depleted = true;
    }
    return true;
  }

  draw(ctx) {
    const f = Math.max(0.12, this.fraction());
    const rgb = this.def.color;
    const alpha = this.discovered ? 0.92 : 0.78;
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    for (const b of this.blobs) {
      ctx.beginPath();
      ctx.arc(this.x + b.ox * f, this.y + b.oy * f, b.r * f, 0, TAU);
      ctx.fill();
    }
    if (this.type === "sugar") {
      // Bright granular cluster: a scatter of tiny crystal points on top.
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * f})`;
      for (const b of this.blobs) {
        ctx.beginPath();
        ctx.arc(this.x + b.ox * f * 0.6, this.y + b.oy * f * 0.6, Math.max(0.6, b.r * f * 0.25), 0, TAU);
        ctx.fill();
      }
    }
    if (this.discovered) {
      ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.baseRadius() * f + 5, 0, TAU);
      ctx.stroke();
    }
  }
}
