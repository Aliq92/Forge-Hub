// player.js — live player input capture and entity factory.
import { makeEntityPhysicsState } from './physics.js';

export function createPlayerEntity(spawn) {
  const p = makeEntityPhysicsState(spawn.x, spawn.y);
  p.type = 'player';
  return p;
}

export function createEchoEntity(spawn, echoIndex) {
  const e = makeEntityPhysicsState(spawn.x, spawn.y);
  e.type = 'echo';
  e.echoIndex = echoIndex;
  return e;
}

// Tracks raw keyboard state and produces one deterministic input snapshot per tick.
export class InputTracker {
  constructor() {
    this.keys = new Set();
    this._prevJump = false;
    this._prevInteract = false;
  }

  bind(target = window) {
    this._onDown = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let form controls behave normally
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
    };
    this._onUp = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.delete(e.code);
    };
    target.addEventListener('keydown', this._onDown);
    target.addEventListener('keyup', this._onUp);
  }

  unbind(target = window) {
    target.removeEventListener('keydown', this._onDown);
    target.removeEventListener('keyup', this._onUp);
  }

  isDown(codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Produces the per-tick snapshot used for physics AND recording.
  // Must be called exactly once per simulation tick.
  sampleTick() {
    const left = this.isDown(['ArrowLeft', 'KeyA']);
    const right = this.isDown(['ArrowRight', 'KeyD']);
    const jumpHeld = this.isDown(['ArrowUp', 'KeyW', 'Space']);
    const interactHeld = this.isDown(['KeyE']);

    const jumpPressed = jumpHeld && !this._prevJump;
    const interactPressed = interactHeld && !this._prevInteract;

    this._prevJump = jumpHeld;
    this._prevInteract = interactHeld;

    return { left, right, jumpPressed, jumpHeld, interactPressed };
  }

  // one-shot edge checks for non-gameplay keys (menus etc.) — not part of the tick sample
  wasJustPressed(code, state) {
    const now = this.keys.has(code);
    const was = state.has(code);
    if (now) state.add(code); else state.delete(code);
    return now && !was;
  }
}
