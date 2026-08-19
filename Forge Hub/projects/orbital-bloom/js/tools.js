// Orbital Bloom - pointer/tool interaction layer (placement, spawning, erase, impulse, move)
import { state, clamp } from './config.js';
import { createAttractor, attractors, removeAttractor, nearestAttractor } from './attractors.js';
import * as P from './particles.js';

function bucketNear(wx, wy, maxDist = 380) {
  const a = nearestAttractor(wx, wy, maxDist);
  return a ? P.bucketIndexForColor(a.color) : undefined;
}

// Read by renderer.js to draw live drag previews (radius circles, velocity arrows, etc.)
export const previewState = { active: false, kind: null };

export const emitters = []; // continuous stream emitters {x,y,mode,angle,radius,spin,speed,rate,acc,life}
let nextEmitterId = 1;

let cam = null;
let canvasEl = null;

// Multi-touch pinch-to-zoom tracking (keyed by pointerId)
const activePointers = new Map();
let pinchActive = false;
let pinchLastDist = null;

const pointer = {
  down: false, mode: null,
  startX: 0, startY: 0, curX: 0, curY: 0,
  lastScreenX: 0, lastScreenY: 0,
  target: null, spawnKind: null,
  impulsePoints: [], lastImpulseX: 0, lastImpulseY: 0,
  moveHistory: [],
};

export function initTools(canvasElement, cameraRef) {
  canvasEl = canvasElement;
  cam = cameraRef;
  canvasEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvasEl.addEventListener('wheel', onWheel, { passive: false });
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
  canvasEl.addEventListener('dblclick', onDoubleClick);
}

function rectAndWorld(e) {
  const rect = canvasEl.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const [wx, wy] = cam.screenToWorld(sx, sy, rect.width, rect.height);
  return { rect, sx, sy, wx, wy };
}

function hitTestAttractor(wx, wy, extraPx = 0) {
  const tolerance = (14 + extraPx) / cam.zoom;
  let best = null, bestD = Infinity;
  for (const a of attractors) {
    const d = Math.hypot(a.x - wx, a.y - wy);
    const r = a.radius + tolerance;
    if (d < r && d < bestD) { bestD = d; best = a; }
  }
  return best;
}

function dispatchSelection(id) {
  state.selectedAttractorId = id;
  window.dispatchEvent(new CustomEvent('ob:selection-changed', { detail: { id } }));
}

function onPointerDown(e) {
  if (e.target !== canvasEl) return;
  const { sx, sy, wx, wy } = rectAndWorld(e);

  if (e.pointerType === 'touch') {
    activePointers.set(e.pointerId, { x: sx, y: sy });
    if (activePointers.size >= 2) {
      // A second finger just touched down: abandon any in-progress single-touch
      // tool action and switch to pinch-zoom for the duration of the gesture.
      pointer.down = false;
      pointer.mode = null;
      previewState.active = false;
      pinchActive = true;
      const pts = [...activePointers.values()];
      pinchLastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      return;
    }
  }

  pointer.down = true;
  pointer.startX = wx; pointer.startY = wy;
  pointer.curX = wx; pointer.curY = wy;
  pointer.lastScreenX = sx; pointer.lastScreenY = sy;
  pointer.moveHistory = [{ x: wx, y: wy, t: performance.now() }];

  if (e.button === 2 || e.button === 1) { pointer.mode = 'pan'; return; }

  const tool = state.currentTool;

  if (tool === 'select') {
    const hit = hitTestAttractor(wx, wy);
    if (hit) {
      dispatchSelection(hit.id);
      if (e.altKey) { pointer.mode = 'moveAttractor'; pointer.target = hit; }
      else pointer.mode = 'idle';
    } else {
      dispatchSelection(null);
      pointer.mode = 'pan';
    }
  } else if (tool === 'move') {
    const hit = hitTestAttractor(wx, wy, 30);
    if (hit) { pointer.mode = 'moveAttractor'; pointer.target = hit; dispatchSelection(hit.id); }
    else pointer.mode = 'pan';
  } else if (tool === 'star' || tool === 'planet' || tool === 'heavyCore' || tool === 'anchor') {
    const fixed = tool === 'anchor' ? true : state.attractorFixed;
    const a = createAttractor(tool, wx, wy, { fixed });
    pointer.mode = fixed ? 'idle' : 'placeVelocity';
    pointer.target = a;
    dispatchSelection(a.id);
  } else if (tool === 'point') {
    const n = Math.round(clamp(state.spawnAmount / 10, 8, 150));
    P.spawnPattern({
      cx: wx, cy: wy, count: n, mode: 'disc',
      radius: 14, spread: 0.5, spin: 0, speed: 12,
      colorBucket: bucketNear(wx, wy),
    });
    pointer.mode = 'idle';
  } else if (tool === 'cloud' || tool === 'ring' || tool === 'disc' || tool === 'jet' || tool === 'stream') {
    pointer.mode = 'spawn';
    pointer.spawnKind = tool;
    previewState.active = true;
    previewState.kind = 'spawn';
    previewState.cx = wx; previewState.cy = wy; previewState.radius = 4;
  } else if (tool === 'erase') {
    pointer.mode = 'erase';
    eraseAttractorAt(wx, wy);
    eraseParticlesAt(wx, wy);
    previewState.active = true; previewState.kind = 'erase';
    previewState.cx = wx; previewState.cy = wy; previewState.radius = eraseRadius();
  } else if (tool === 'impulse') {
    pointer.mode = 'impulse';
    pointer.impulsePoints = [wx, wy];
    pointer.lastImpulseX = wx; pointer.lastImpulseY = wy;
    previewState.active = true; previewState.kind = 'impulse'; previewState.points = [wx, wy];
  }
}

function onPointerMove(e) {
  const rect = canvasEl.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: sx, y: sy });

  if (pinchActive) {
    if (activePointers.size >= 2) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      if (pinchLastDist && dist > 0) {
        const factor = clamp(dist / pinchLastDist, 0.85, 1.18);
        cam.zoomAt(midX, midY, factor, rect.width, rect.height);
      }
      pinchLastDist = dist;
    }
    return;
  }

  if (!pointer.down) return;
  const [wx, wy] = cam.screenToWorld(sx, sy, rect.width, rect.height);
  pointer.curX = wx; pointer.curY = wy;
  pointer.moveHistory.push({ x: wx, y: wy, t: performance.now() });
  if (pointer.moveHistory.length > 6) pointer.moveHistory.shift();

  switch (pointer.mode) {
    case 'pan':
      cam.pan(sx - pointer.lastScreenX, sy - pointer.lastScreenY);
      break;
    case 'moveAttractor':
      if (pointer.target) { pointer.target.x = wx; pointer.target.y = wy; }
      break;
    case 'placeVelocity':
      previewState.active = true; previewState.kind = 'velocity';
      previewState.cx = pointer.target.x; previewState.cy = pointer.target.y;
      previewState.ex = wx; previewState.ey = wy;
      break;
    case 'spawn': {
      const dx = wx - pointer.startX, dy = wy - pointer.startY;
      const r = Math.hypot(dx, dy);
      previewState.radius = Math.max(r, 8);
      if (pointer.spawnKind === 'jet' || pointer.spawnKind === 'stream') {
        previewState.dirX = dx; previewState.dirY = dy;
      } else {
        previewState.dirX = undefined;
      }
      break;
    }
    case 'erase':
      eraseParticlesAt(wx, wy);
      previewState.cx = wx; previewState.cy = wy;
      break;
    case 'impulse': {
      applyImpulseAt(pointer.lastImpulseX, pointer.lastImpulseY, wx, wy);
      pointer.impulsePoints.push(wx, wy);
      if (pointer.impulsePoints.length > 40) pointer.impulsePoints.splice(0, pointer.impulsePoints.length - 40);
      previewState.points = pointer.impulsePoints;
      pointer.lastImpulseX = wx; pointer.lastImpulseY = wy;
      break;
    }
  }
  pointer.lastScreenX = sx; pointer.lastScreenY = sy;
}

function onPointerUp(e) {
  if (e && activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);
  if (pinchActive) {
    if (activePointers.size < 2) { pinchActive = false; pinchLastDist = null; }
    return;
  }

  switch (pointer.mode) {
    case 'placeVelocity': {
      const a = pointer.target;
      if (a && !a.fixed) {
        a.vx = clamp((pointer.curX - pointer.startX) * 1.4, -900, 900);
        a.vy = clamp((pointer.curY - pointer.startY) * 1.4, -900, 900);
      }
      break;
    }
    case 'moveAttractor': {
      const a = pointer.target;
      if (a && !a.fixed && pointer.moveHistory.length >= 2) {
        const h = pointer.moveHistory;
        const first = h[0], last = h[h.length - 1];
        const dt = Math.max((last.t - first.t) / 1000, 0.001);
        if (last.t - first.t < 400) {
          a.vx = clamp((last.x - first.x) / dt * 0.4, -900, 900);
          a.vy = clamp((last.y - first.y) / dt * 0.4, -900, 900);
        }
      }
      break;
    }
    case 'spawn':
      doSpawn();
      break;
  }
  pointer.down = false;
  pointer.mode = null;
  pointer.target = null;
  previewState.active = false;
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvasEl.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const factor = Math.pow(1.0018, -e.deltaY);
  cam.zoomAt(sx, sy, factor, rect.width, rect.height);
}

function onDoubleClick(e) {
  const { wx, wy } = rectAndWorld(e);
  P.spawnPattern({
    cx: wx, cy: wy,
    count: Math.min(state.spawnAmount, 500),
    mode: 'disc', radius: 55, spread: 0.4,
    spin: 0, speed: 140,
    colorBucket: bucketNear(wx, wy),
  });
}

function eraseRadius() { return 34 / cam.zoom; }

function eraseAttractorAt(wx, wy) {
  const hit = hitTestAttractor(wx, wy, 8);
  if (hit) {
    removeAttractor(hit.id);
    if (state.selectedAttractorId === hit.id) dispatchSelection(null);
  }
}

function eraseParticlesAt(wx, wy) {
  P.clearNear(wx, wy, eraseRadius());
  for (let i = emitters.length - 1; i >= 0; i--) {
    const em = emitters[i];
    if (Math.hypot(em.x - wx, em.y - wy) < eraseRadius() + 20) emitters.splice(i, 1);
  }
}

function applyImpulseAt(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dlen = Math.hypot(dx, dy);
  if (dlen < 0.001) return;
  const ux = dx / dlen, uy = dy / dlen;
  const radius = 85;
  const r2 = radius * radius;
  const strength = clamp(dlen * 5, 0, 260);
  for (let i = 0; i < P.count; i++) {
    const ddx = P.px[i] - x2, ddy = P.py[i] - y2;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 <= r2) {
      const falloff = 1 - Math.sqrt(d2) / radius;
      P.pvx[i] += ux * strength * falloff;
      P.pvy[i] += uy * strength * falloff;
    }
  }
}

function doSpawn() {
  const dx = pointer.curX - pointer.startX, dy = pointer.curY - pointer.startY;
  const dragLen = Math.hypot(dx, dy);
  const kind = pointer.spawnKind;
  const isDirectional = kind === 'jet' || kind === 'stream';
  const mode = kind === 'cloud' ? state.spawnMode : (kind === 'stream' ? 'jet' : kind);

  const opts = {
    cx: pointer.startX, cy: pointer.startY,
    count: state.spawnAmount,
    mode,
    radius: kind === 'jet' ? Math.max(state.spawnRadius * 0.35, 20)
      : kind === 'stream' ? Math.max(state.spawnRadius * 0.6, 34)
      : Math.max(dragLen, state.spawnRadius * 0.4, 24),
    spread: state.spawnSpread,
    spin: state.spawnSpin,
    speed: isDirectional ? clamp(dragLen * (kind === 'jet' ? 2.2 : 1.5), 60, 900) : state.spawnSpeed,
    angle: isDirectional ? Math.atan2(dy, dx) : 0,
    coneSpread: kind === 'stream' ? 0.7 : 0.4,
    colorBucket: bucketNear(pointer.startX, pointer.startY),
  };

  if (state.continuousStream) {
    emitters.push({
      id: nextEmitterId++,
      x: opts.cx, y: opts.cy, mode: opts.mode,
      radius: opts.radius, spread: opts.spread, spin: opts.spin,
      speed: opts.speed, angle: opts.angle, coneSpread: opts.coneSpread,
      colorBucket: opts.colorBucket,
      rate: Math.max(state.spawnAmount / 3, 12),
      acc: 0,
    });
  } else {
    P.spawnPattern(opts);
  }
}

export function tickEmitters(dt) {
  for (const em of emitters) {
    em.acc += em.rate * dt;
    while (em.acc >= 1) {
      em.acc -= 1;
      P.spawnPattern({
        cx: em.x, cy: em.y, count: 1, mode: em.mode,
        radius: em.radius, spread: em.spread, spin: em.spin,
        speed: em.speed, angle: em.angle, coneSpread: em.coneSpread,
        colorBucket: em.colorBucket,
      });
    }
  }
}

export function clearEmitters() { emitters.length = 0; }

export function focusOnSelected(camera) {
  const a = attractors.find(a => a.id === state.selectedAttractorId);
  if (a) camera.focusOn(a.x, a.y, Math.max(camera.zoom, 1.4));
}
