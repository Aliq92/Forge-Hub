// Keyboard + touch input handling.

export class InputSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedOnce = new Set();
    this.touch = { move: { active: false, dx: 0, dy: 0 }, flare: false, interact: false, pause: false };
    this._touchMoveId = null;
    this._touchOrigin = null;
    this.moveVec = { x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressedOnce.add(k);
      this.keys.add(k);
    }, { passive: false });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  consumePressed(key) {
    if (this.pressedOnce.has(key)) { this.pressedOnce.delete(key); return true; }
    return false;
  }

  isDown(key) { return this.keys.has(key); }

  getMoveAxis() {
    let x = 0, y = 0;
    if (this.isDown('w') || this.isDown('arrowup')) y -= 1;
    if (this.isDown('s') || this.isDown('arrowdown')) y += 1;
    if (this.isDown('a') || this.isDown('arrowleft')) x -= 1;
    if (this.isDown('d') || this.isDown('arrowright')) x += 1;
    if (this.touch.move.active) { x += this.touch.move.dx; y += this.touch.move.dy; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  wantsFlare() {
    const kb = this.consumePressed(' ');
    const t = this.touch.flare;
    this.touch.flare = false;
    return kb || t;
  }

  wantsInteract() {
    const kb = this.consumePressed('e');
    const t = this.touch.interact;
    this.touch.interact = false;
    return kb || t;
  }

  wantsPause() {
    const kb = this.consumePressed('escape');
    const t = this.touch.pause;
    this.touch.pause = false;
    return kb || t;
  }

  wantsModeToggle() { return this.consumePressed('f'); }

  clearFrame() { this.pressedOnce.clear(); }
}

export function setupTouchControls(input) {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  const layer = document.getElementById('touch-controls');
  layer.classList.remove('hidden');
  document.body.classList.add('touch-active');

  const stickZone = document.getElementById('touch-stick-zone');
  const stick = document.getElementById('touch-stick');
  const stickKnob = document.getElementById('touch-stick-knob');
  let stickTouchId = null;
  let originX = 0, originY = 0;
  let maxR = 44;

  function stickStart(e) {
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    const rect = stick.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
    maxR = rect.width * 0.42;
    input.touch.move.active = true;
    e.preventDefault();
  }
  function stickMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        let dx = t.clientX - originX;
        let dy = t.clientY - originY;
        const len = Math.hypot(dx, dy);
        if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
        stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.touch.move.dx = dx / maxR;
        input.touch.move.dy = dy / maxR;
        e.preventDefault();
      }
    }
  }
  function stickEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickTouchId) {
        stickTouchId = null;
        input.touch.move.active = false;
        input.touch.move.dx = 0; input.touch.move.dy = 0;
        stickKnob.style.transform = 'translate(0px, 0px)';
      }
    }
  }
  stickZone.addEventListener('touchstart', stickStart, { passive: false });
  stickZone.addEventListener('touchmove', stickMove, { passive: false });
  stickZone.addEventListener('touchend', stickEnd, { passive: false });
  stickZone.addEventListener('touchcancel', stickEnd, { passive: false });

  const btnFlare = document.getElementById('touch-flare');
  const btnInteract = document.getElementById('touch-interact');
  const btnPause = document.getElementById('touch-pause');
  btnFlare.addEventListener('touchstart', e => { input.touch.flare = true; e.preventDefault(); }, { passive: false });
  btnInteract.addEventListener('touchstart', e => { input.touch.interact = true; e.preventDefault(); }, { passive: false });
  btnPause.addEventListener('touchstart', e => { input.touch.pause = true; e.preventDefault(); }, { passive: false });
}
