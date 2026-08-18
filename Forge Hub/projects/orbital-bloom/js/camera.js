// Orbital Bloom - camera: pan, zoom, smooth focus/reset
import { CONSTANTS, clamp } from './config.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this._animT = null; // active animation {fromX,fromY,fromZ,toX,toY,toZ,dur,elapsed}
  }

  worldToScreen(wx, wy, w, h) {
    return [
      (wx - this.x) * this.zoom + w / 2,
      (wy - this.y) * this.zoom + h / 2,
    ];
  }

  screenToWorld(sx, sy, w, h) {
    return [
      (sx - w / 2) / this.zoom + this.x,
      (sy - h / 2) / this.zoom + this.y,
    ];
  }

  pan(dxScreen, dyScreen) {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this._animT = null;
  }

  zoomAt(sx, sy, factor, w, h) {
    const [wx, wy] = this.screenToWorld(sx, sy, w, h);
    this.zoom = clamp(this.zoom * factor, CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM);
    const [nx, ny] = this.screenToWorld(sx, sy, w, h);
    this.x -= (nx - wx);
    this.y -= (ny - wy);
    this._animT = null;
  }

  reset(instant = false) {
    this.animateTo(0, 0, 1, instant ? 0 : 0.6);
  }

  focusOn(x, y, zoom, instant = false) {
    this.animateTo(x, y, zoom ?? this.zoom, instant ? 0 : 0.6);
  }

  animateTo(tx, ty, tz, dur) {
    if (dur <= 0) {
      this.x = tx; this.y = ty; this.zoom = clamp(tz, CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM);
      this._animT = null;
      return;
    }
    this._animT = {
      fromX: this.x, fromY: this.y, fromZ: this.zoom,
      toX: tx, toY: ty, toZ: clamp(tz, CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM),
      dur, elapsed: 0,
    };
  }

  update(dt) {
    if (!this._animT) return false;
    const a = this._animT;
    a.elapsed += dt;
    const t = clamp(a.elapsed / a.dur, 0, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
    this.x = a.fromX + (a.toX - a.fromX) * e;
    this.y = a.fromY + (a.toY - a.fromY) * e;
    this.zoom = a.fromZ + (a.toZ - a.fromZ) * e;
    if (t >= 1) this._animT = null;
    return true;
  }

  fitBounds(minX, minY, maxX, maxY, w, h, padding = 0.18) {
    const bw = Math.max(maxX - minX, 60);
    const bh = Math.max(maxY - minY, 60);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const zx = w / (bw * (1 + padding * 2));
    const zy = h / (bh * (1 + padding * 2));
    const z = clamp(Math.min(zx, zy), CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM);
    this.animateTo(cx, cy, z, 0.6);
  }
}
