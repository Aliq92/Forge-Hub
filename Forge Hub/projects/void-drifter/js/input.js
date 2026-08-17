// ---------------- Input: keyboard + mobile touch buttons ----------------
class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = { thrust: false, reverse: false, left: false, right: false, boost: false };
    this._pauseCb = null;
    this._interactCb = null;
    this._anyKeyCb = null;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('blur', () => this.keys.clear());

    this._bindTouchButton('touchLeft', 'left');
    this._bindTouchButton('touchRight', 'right');
    this._bindTouchButton('touchThrust', 'thrust');
    this._bindTouchButton('touchBoost', 'boost');
  }

  onPause(cb) { this._pauseCb = cb; }
  onInteract(cb) { this._interactCb = cb; }
  onAnyKey(cb) { this._anyKeyCb = cb; }

  _onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (this._anyKeyCb) this._anyKeyCb(e.code);
    if (e.code === 'Escape' && this._pauseCb) this._pauseCb();
    if (e.code === 'KeyE' && this._interactCb) this._interactCb();
  }
  _onKeyUp(e) { this.keys.delete(e.code); }

  _bindTouchButton(id, flag) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => { e.preventDefault(); this.touch[flag] = true; };
    const end = (e) => { e.preventDefault(); this.touch[flag] = false; };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
  }

  isDown(...codes) { return codes.some((c) => this.keys.has(c)); }

  getState() {
    return {
      thrust: this.isDown('KeyW', 'ArrowUp') || this.touch.thrust,
      reverse: this.isDown('KeyS', 'ArrowDown') || this.touch.reverse,
      left: this.isDown('KeyA', 'ArrowLeft') || this.touch.left,
      right: this.isDown('KeyD', 'ArrowRight') || this.touch.right,
      boost: this.isDown('Space') || this.touch.boost,
    };
  }

  clearHeld() { this.keys.clear(); Object.keys(this.touch).forEach((k) => (this.touch[k] = false)); }
}
