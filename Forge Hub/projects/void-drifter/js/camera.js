// ---------------- Smooth-follow camera with velocity look-ahead ----------------
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakeTime = 0;
    this._shakeMag = 0;
  }

  reset(x, y) {
    if (!isFinite(x) || !isFinite(y)) { x = 0; y = 0; }
    this.x = x; this.y = y;
    this._shakeTime = 0; this._shakeMag = 0;
    this.shakeX = 0; this.shakeY = 0;
  }

  addShake(mag, dur = 0.25) {
    this._shakeMag = Math.min(18, Math.max(this._shakeMag, mag));
    this._shakeTime = Math.max(this._shakeTime, dur);
  }

  update(dt, targetX, targetY, targetVx, targetVy, shakeEnabled) {
    if (!isFinite(targetX) || !isFinite(targetY)) { this.reset(0, 0); return; }
    const lookAhead = 0.35;
    const maxLook = 140;
    const lx = clamp(targetVx * lookAhead, -maxLook, maxLook);
    const ly = clamp(targetVy * lookAhead, -maxLook, maxLook);
    const goalX = targetX + lx;
    const goalY = targetY + ly;
    const followSpeed = 3.2;
    const t = 1 - Math.exp(-followSpeed * dt);
    this.x = lerp(this.x, goalX, t);
    this.y = lerp(this.y, goalY, t);
    if (!isFinite(this.x) || !isFinite(this.y)) this.reset(targetX, targetY);

    if (this._shakeTime > 0 && shakeEnabled) {
      this._shakeTime -= dt;
      const s = this._shakeMag * (this._shakeTime > 0 ? 1 : 0);
      this.shakeX = (Math.random() * 2 - 1) * s;
      this.shakeY = (Math.random() * 2 - 1) * s;
    } else {
      this.shakeX = 0; this.shakeY = 0; this._shakeMag = 0;
    }
  }

  get renderX() { return this.x + this.shakeX; }
  get renderY() { return this.y + this.shakeY; }
}
