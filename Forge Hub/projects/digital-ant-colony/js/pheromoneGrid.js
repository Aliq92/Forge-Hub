// A simple 2D grid of pheromone strength. One instance per channel (food,
// home, danger) — ants deposit into it, it evaporates every tick, and
// ants/UI sample or draw it. Kept generic so all three channels share one
// implementation instead of three near-duplicate ones.
class PheromoneGrid {
  constructor(width, height, cellSize, capValue) {
    this.capValue = capValue || CONFIG.pheromone.max;
    this.reset(width, height, cellSize);
  }

  reset(width, height, cellSize) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cells = new Float32Array(this.cols * this.rows);
  }

  cellIndex(x, y) {
    const cx = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return cy * this.cols + cx;
  }

  deposit(x, y, amount) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.cellIndex(x, y);
    const next = this.cells[i] + amount;
    this.cells[i] = next > this.capValue ? this.capValue : next;
  }

  sampleAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.cells[this.cellIndex(x, y)];
  }

  evaporate(factor) {
    const cells = this.cells;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === 0) continue;
      const next = cells[i] * factor;
      cells[i] = next < 0.01 ? 0 : next;
    }
  }

  maxValue() {
    let max = 0;
    const cells = this.cells;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] > max) max = cells[i];
    }
    return max;
  }

  // Draws every non-trivial cell as a soft glowing tile in the given RGB
  // color. Cheap enough at the grid sizes this simulation uses (a few
  // thousand cells) to run every frame. `alphaScale` lets the caller mute a
  // layer (e.g. when several overlays are shown at once in ALL mode).
  draw(ctx, colorRgb, alphaScale) {
    const { cols, rows, cellSize, cells } = this;
    const scale = alphaScale === undefined ? 1 : alphaScale;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const v = cells[cy * cols + cx];
        if (v < 0.05) continue;
        const alpha = Math.min(0.55, v / this.capValue) * 0.6 * scale;
        if (alpha < 0.01) continue;
        ctx.fillStyle = `rgba(${colorRgb}, ${alpha.toFixed(3)})`;
        ctx.fillRect(cx * cellSize, cy * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }
  }
}
