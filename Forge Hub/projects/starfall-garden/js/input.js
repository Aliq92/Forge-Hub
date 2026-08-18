// Keyboard, mouse, and touch input including a virtual joystick for mobile.
SG.Input = class {
  constructor(callbacks) {
    this.callbacks = callbacks || {};
    this.keys = new Set();
    this.moveX = 0; this.moveY = 0;
    this.joyActive = false;
    this.joyX = 0; this.joyY = 0;
    this.joyPointerId = null;
    this._selectDebounce = {};
    this.isTouchLike = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('blur', () => this.keys.clear());

    const joyZone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    if (joyZone) {
      const start = (e) => {
        const t = e.touches ? e.touches[0] : e;
        this.joyPointerId = e.pointerId !== undefined ? e.pointerId : (e.touches ? t.identifier : 'mouse');
        this.joyActive = true;
        this._updateJoy(t, joyZone, stick);
        e.preventDefault();
      };
      const move = (e) => {
        if (!this.joyActive) return;
        const t = e.touches ? [...e.touches].find(x => x.identifier === this.joyPointerId) || e.touches[0] : e;
        this._updateJoy(t, joyZone, stick);
        e.preventDefault();
      };
      const end = (e) => {
        this.joyActive = false; this.joyX = 0; this.joyY = 0;
        if (stick) stick.style.transform = 'translate(-50%, -50%)';
        e.preventDefault();
      };
      joyZone.addEventListener('touchstart', start, { passive: false });
      joyZone.addEventListener('touchmove', move, { passive: false });
      joyZone.addEventListener('touchend', end, { passive: false });
      joyZone.addEventListener('touchcancel', end, { passive: false });
      joyZone.addEventListener('mousedown', start);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
    }

    const dashBtn = document.getElementById('btn-mobile-dash');
    if (dashBtn) {
      const trigger = (e) => { e.preventDefault(); this.callbacks.onDash && this.callbacks.onDash(); };
      dashBtn.addEventListener('touchstart', trigger, { passive: false });
      dashBtn.addEventListener('mousedown', trigger);
    }
    const interactBtn = document.getElementById('btn-mobile-interact');
    if (interactBtn) {
      const trigger = (e) => { e.preventDefault(); this.callbacks.onInteract && this.callbacks.onInteract(); };
      interactBtn.addEventListener('touchstart', trigger, { passive: false });
      interactBtn.addEventListener('mousedown', trigger);
    }
  }

  _updateJoy(t, zone, stick) {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const maxR = rect.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
    this.joyX = dx / maxR; this.joyY = dy / maxR;
    if (stick) {
      const half = stick.offsetWidth / 2;
      stick.style.transform = `translate(${dx - half}px, ${dy - half}px)`;
    }
  }

  _onKeyDown(e) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
    if (this.keys.has(code)) return; // ignore auto-repeat for edge triggers
    this.keys.add(code);

    if (code === 'Space') this.callbacks.onDash && this.callbacks.onDash();
    else if (code === 'KeyE') this.callbacks.onInteract && this.callbacks.onInteract();
    else if (code === 'Escape') this.callbacks.onEscape && this.callbacks.onEscape();
    else if (code === 'Digit1') this.callbacks.onSelectPlant && this.callbacks.onSelectPlant(0);
    else if (code === 'Digit2') this.callbacks.onSelectPlant && this.callbacks.onSelectPlant(1);
    else if (code === 'Digit3') this.callbacks.onSelectPlant && this.callbacks.onSelectPlant(2);
    else if (code === 'Digit4') this.callbacks.onSelectPlant && this.callbacks.onSelectPlant(3);
  }

  _onKeyUp(e) { this.keys.delete(e.code); }

  getMoveVector() {
    if (this.joyActive && (Math.abs(this.joyX) > 0.06 || Math.abs(this.joyY) > 0.06)) {
      return { x: this.joyX, y: this.joyY };
    }
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return { x, y };
  }
};
