// A lightweight paintable grid mask, shared by both the obstacle layer and
// the hazard layer. Backed by a single Uint8Array (no per-cell objects, no
// DOM), brush-painted by the user and sampled by ants for both hard
// collision (obstacles) and soft avoidance (obstacles + hazards).
class MaskGrid {
  constructor(width, height, cellSize) {
    this.reset(width, height, cellSize);
  }

  reset(width, height, cellSize) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    const old = this.cells;
    const oldCols = this.oldCols;
    this.cells = new Uint8Array(this.cols * this.rows);
    // Best-effort preserve existing paint through a resize instead of wiping
    // everything the user drew.
    if (old && oldCols) {
      const oldRows = old.length / oldCols;
      for (let cy = 0; cy < Math.min(this.rows, oldRows); cy++) {
        for (let cx = 0; cx < Math.min(this.cols, oldCols); cx++) {
          this.cells[cy * this.cols + cx] = old[cy * oldCols + cx];
        }
      }
    }
    this.oldCols = this.cols;
  }

  cellCoords(x, y) {
    const cx = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return [cx, cy];
  }

  index(cx, cy) {
    return cy * this.cols + cx;
  }

  isSet(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const [cx, cy] = this.cellCoords(x, y);
    return this.cells[this.index(cx, cy)] === 1;
  }

  setCell(cx, cy, value) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    this.cells[this.index(cx, cy)] = value;
  }

  paintCircle(x, y, radius, value) {
    const [ccx, ccy] = this.cellCoords(x, y);
    const rCells = Math.max(1, Math.round(radius / this.cellSize));
    for (let dy = -rCells; dy <= rCells; dy++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        if (dx * dx + dy * dy > rCells * rCells) continue;
        this.setCell(ccx + dx, ccy + dy, value);
      }
    }
  }

  paintRect(x0, y0, x1, y1, value) {
    const [c0x, c0y] = this.cellCoords(Math.min(x0, x1), Math.min(y0, y1));
    const [c1x, c1y] = this.cellCoords(Math.max(x0, x1), Math.max(y0, y1));
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) this.setCell(cx, cy, value);
    }
  }

  clear() {
    this.cells.fill(0);
  }

  isEmpty() {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) return false;
    return true;
  }

  // Draws every set cell as a flat-shaded block. Cheap: only iterates once,
  // and callers should skip this entirely when the layer is empty.
  draw(ctx, fillStyle) {
    const { cols, rows, cellSize, cells } = this;
    ctx.fillStyle = fillStyle;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (!cells[cy * cols + cx]) continue;
        ctx.fillRect(cx * cellSize, cy * cellSize, cellSize + 0.5, cellSize + 0.5);
      }
    }
  }
}
