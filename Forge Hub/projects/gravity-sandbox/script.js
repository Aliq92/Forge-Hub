(() => {
'use strict';

/* ============================= CONSTANTS ============================= */

const G = 6000;
const SOFTENING = 14;
const MAX_ACCEL = 260000;
const MAX_SPEED = 6000;
const FIXED_DT = 1 / 120;
const MAX_STEPS_PER_FRAME = 60;
const TRAIL_MAX = 80;
const LAUNCH_SCALE = 1.8;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 6;

const TYPE_LABEL = { planet: 'Planet', moon: 'Moon', star: 'Star', blackhole: 'Black Hole' };

const MASS_RANGE = {
  planet:    { min: 5,    max: 400,   step: 1,   def: 60 },
  moon:      { min: 2,    max: 80,    step: 1,   def: 12 },
  star:      { min: 500,  max: 12000, step: 10,  def: 3000 },
  blackhole: { min: 3000, max: 60000, step: 50,  def: 15000 },
};

/* ============================= CANVAS SETUP ============================ */

const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');

let dpr = Math.min(window.devicePixelRatio || 1, 2);
let width = window.innerWidth;
let height = window.innerHeight;
let bgGradient = null;
let stars = [];

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  bgGradient = makeBgGradient();
  stars = makeStars(clamp(Math.floor((width * height) / 6000), 80, 420));
}

function makeBgGradient() {
  const g = ctx.createRadialGradient(width / 2, height * 0.32, 0, width / 2, height * 0.32, Math.max(width, height) * 0.85);
  g.addColorStop(0, '#0b1128');
  g.addColorStop(0.55, '#060811');
  g.addColorStop(1, '#020207');
  return g;
}

function makeStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.3 + 0.3,
    baseAlpha: Math.random() * 0.5 + 0.15,
    speed: Math.random() * 1.1 + 0.25,
    phase: Math.random() * Math.PI * 2,
  }));
}

window.addEventListener('resize', resize);
resize();

/* ============================== UTILITIES ============================== */

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }

function radiusForMass(mass, type) {
  if (type === 'blackhole') return clamp(6 + Math.cbrt(mass) * 1.4, 9, 70);
  return clamp(Math.cbrt(mass) * 2.3, 5, 90);
}

let nameCounters = { planet: 0, moon: 0, star: 0, blackhole: 0 };
function nextName(type) {
  nameCounters[type]++;
  return `${TYPE_LABEL[type]} ${nameCounters[type]}`;
}

/* ================================ BODY =================================== */

let idCounter = 1;

class Body {
  constructor(x, y, vx, vy, mass, type, name) {
    this.id = idCounter++;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.ax = 0; this.ay = 0;
    this.mass = mass;
    this.type = type;
    this.name = name || nextName(type);
    this.radius = radiusForMass(mass, type);
    this.trail = [];
    this.paletteVariant = Math.random() < 0.5 ? 'a' : 'b';
    this.spinPhase = Math.random() * Math.PI * 2;
  }
}

function palette(b) {
  switch (b.type) {
    case 'planet':
      return b.paletteVariant === 'a'
        ? { c0: '#d7fbee', c1: '#4fbf8f', c2: '#1c5c44', glow: '#59c9a5' }
        : { c0: '#dff1ff', c1: '#4f9fe0', c2: '#1c4a78', glow: '#6ad2ff' };
    case 'moon':
      return { c0: '#ffffff', c1: '#c3c9dc', c2: '#666d88', glow: '#b9c0d4' };
    case 'star':
      return { c0: '#fffdf2', c1: '#ffd27a', c2: '#ff9d3f', glow: '#ffcf7a' };
    case 'blackhole':
      return { c0: '#241238', c1: '#0c0616', c2: '#000000', glow: '#b98bff', ring2: '#6ad2ff' };
  }
}

/* ============================== WORLD STATE ============================== */

let bodies = [];
let selected = null;
let running = true;
let speedMultiplier = 1;
let simTime = 0;
let accumulator = 0;
let initialSnapshot = [];

const camera = { x: 0, y: 0, zoom: 1 };

const display = { trails: true, labels: true, vectors: false, com: false };

let currentSpawnType = 'planet';

/* ============================ COORD TRANSFORMS =========================== */

function worldToScreen(x, y) {
  return { x: width / 2 + (x - camera.x) * camera.zoom, y: height / 2 + (y - camera.y) * camera.zoom };
}
function screenToWorld(x, y) {
  return { x: (x - width / 2) / camera.zoom + camera.x, y: (y - height / 2) / camera.zoom + camera.y };
}

/* ================================ PHYSICS ================================= */

function computeAccelerations() {
  for (const b of bodies) { b.ax = 0; b.ay = 0; }
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distSq = dx * dx + dy * dy + SOFTENING * SOFTENING;
      const dist = Math.sqrt(distSq);
      const invDist3 = 1 / (distSq * dist);
      const fa = G * b.mass * invDist3;
      const fb = G * a.mass * invDist3;
      a.ax += fa * dx; a.ay += fa * dy;
      b.ax -= fb * dx; b.ay -= fb * dy;
    }
    const accelMag = Math.hypot(a.ax, a.ay);
    if (accelMag > MAX_ACCEL) {
      const s = MAX_ACCEL / accelMag;
      a.ax *= s; a.ay *= s;
    }
  }
}

function integrate(dt) {
  for (const b of bodies) {
    b.vx += b.ax * dt;
    b.vy += b.ay * dt;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      const s = MAX_SPEED / speed;
      b.vx *= s; b.vy *= s;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

function handleCollisions() {
  let mergedAny = true;
  while (mergedAny) {
    mergedAny = false;
    outer:
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const minDist = (a.radius + b.radius) * 0.92;
        if (dist2(a.x, a.y, b.x, b.y) < minDist * minDist) {
          mergeBodies(i, j);
          mergedAny = true;
          break outer;
        }
      }
    }
  }
}

function mergeBodies(i, j) {
  const a = bodies[i], b = bodies[j];
  const totalMass = a.mass + b.mass;
  const dominant = a.mass >= b.mass ? a : b;
  const isBH = a.type === 'blackhole' || b.type === 'blackhole';
  const bhParent = a.type === 'blackhole' ? a : (b.type === 'blackhole' ? b : dominant);
  const newType = isBH ? 'blackhole' : dominant.type;

  const merged = new Body(
    (a.x * a.mass + b.x * b.mass) / totalMass,
    (a.y * a.mass + b.y * b.mass) / totalMass,
    (a.vx * a.mass + b.vx * b.mass) / totalMass,
    (a.vy * a.mass + b.vy * b.mass) / totalMass,
    totalMass,
    newType,
    isBH ? bhParent.name : dominant.name
  );
  merged.paletteVariant = dominant.paletteVariant;
  merged.trail = dominant.trail;

  const wasSelected = selected === a || selected === b;
  bodies.splice(j, 1);
  bodies.splice(i, 1);
  bodies.push(merged);
  if (wasSelected) selectBody(merged);
}

function physicsStep(dt) {
  computeAccelerations();
  integrate(dt);
  handleCollisions();
  simTime += dt;
}

/* ============================== TRAILS =================================== */

function pushTrailPoints() {
  for (const b of bodies) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > TRAIL_MAX) b.trail.shift();
  }
}

/* =============================== PRESETS ================================= */

function softenedOrbitalSpeed(centralMass, r) {
  const distSq = r * r + SOFTENING * SOFTENING;
  const dist = Math.sqrt(distSq);
  const accel = G * centralMass * r / (distSq * dist);
  return Math.sqrt(accel * r);
}

function twoBodyOrbit(m1, m2, separation) {
  const totalMass = m1 + m2;
  const r1 = separation * m2 / totalMass;
  const r2 = separation * m1 / totalMass;
  const vRel = softenedOrbitalSpeed(totalMass, separation);
  const v1 = vRel * m2 / totalMass;
  const v2 = vRel * m1 / totalMass;
  return {
    pos1: { x: -r1, y: 0 }, pos2: { x: r2, y: 0 },
    vel1: { x: 0, y: -v1 }, vel2: { x: 0, y: v2 },
  };
}

function circularVelocity(centralMass, r) {
  return softenedOrbitalSpeed(centralMass, r);
}

const PRESETS = {
  'earth-moon': () => {
    const o = twoBodyOrbit(600, 9, 95);
    return {
      zoom: 2.1,
      bodies: [
        new Body(o.pos1.x, o.pos1.y, o.vel1.x, o.vel1.y, 600, 'planet', 'Earth'),
        new Body(o.pos2.x, o.pos2.y, o.vel2.x, o.vel2.y, 9, 'moon', 'Moon'),
      ],
    };
  },
  'solar-system': () => {
    const starMass = 9000;
    const star = new Body(0, 0, 0, 0, starMass, 'star', 'Sol');
    const defs = [
      { r: 100, m: 6,  name: 'Mercuri' },
      { r: 175, m: 10, name: 'Veneris' },
      { r: 260, m: 11, name: 'Terra' },
      { r: 360, m: 16, name: 'Jovis' },
      { r: 470, m: 12, name: 'Saturnus' },
    ];
    const list = [star];
    defs.forEach((d, idx) => {
      const angle = idx * 1.05;
      const v = circularVelocity(starMass, d.r);
      const x = Math.cos(angle) * d.r, y = Math.sin(angle) * d.r;
      const vx = -Math.sin(angle) * v, vy = Math.cos(angle) * v;
      list.push(new Body(x, y, vx, vy, d.m, 'planet', d.name));
    });
    return { zoom: 0.68, bodies: list };
  },
  'binary-stars': () => {
    const o = twoBodyOrbit(2400, 2400, 210);
    return {
      zoom: 1.4,
      bodies: [
        new Body(o.pos1.x, o.pos1.y, o.vel1.x, o.vel1.y, 2400, 'star', 'Alpha'),
        new Body(o.pos2.x, o.pos2.y, o.vel2.x, o.vel2.y, 2400, 'star', 'Beta'),
      ],
    };
  },
  'three-body': () => {
    return {
      zoom: 0.5,
      bodies: [
        new Body(-600, 36, 1.1, 27.5, 242, 'star', 'Chaos-A'),
        new Body(624, -60, -1.65, -29.15, 275, 'star', 'Chaos-B'),
        new Body(24, 690, 34.1, 1.1, 209, 'star', 'Chaos-C'),
      ],
    };
  },
  'empty': () => ({ zoom: 1, bodies: [] }),
};

function loadPreset(key) {
  const builder = PRESETS[key];
  if (!builder) return;
  const result = builder();
  bodies = result.bodies;
  camera.x = 0; camera.y = 0; camera.zoom = result.zoom;
  simTime = 0; accumulator = 0;
  selected = null;
  hideInspector();
  snapshotCurrent();
  running = true;
  updatePlayButton();
}

function snapshotCurrent() {
  initialSnapshot = bodies.map(b => ({
    x: b.x, y: b.y, vx: b.vx, vy: b.vy, mass: b.mass, type: b.type, name: b.name, paletteVariant: b.paletteVariant,
  }));
}

function resetSimulation() {
  bodies = initialSnapshot.map(s => {
    const nb = new Body(s.x, s.y, s.vx, s.vy, s.mass, s.type, s.name);
    nb.paletteVariant = s.paletteVariant;
    return nb;
  });
  simTime = 0; accumulator = 0;
  selected = null;
  hideInspector();
}

function clearAll() {
  bodies = [];
  initialSnapshot = [];
  simTime = 0; accumulator = 0;
  selected = null;
  hideInspector();
}

/* ================================ RENDER ================================= */

function drawStars(now) {
  for (const s of stars) {
    const alpha = clamp(s.baseAlpha + Math.sin(now / 1000 * s.speed + s.phase) * 0.18, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrail(b) {
  const n = b.trail.length;
  if (n < 2) return;
  const pal = palette(b);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(b.trail[0].x, b.trail[0].y);
  for (let k = 1; k < n; k++) ctx.lineTo(b.trail[k].x, b.trail[k].y);
  ctx.strokeStyle = pal.glow;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = Math.max(1, b.radius * 0.28) / camera.zoom;
  ctx.stroke();

  const headStart = Math.max(0, n - 18);
  if (n - headStart >= 2) {
    ctx.beginPath();
    ctx.moveTo(b.trail[headStart].x, b.trail[headStart].y);
    for (let k = headStart + 1; k < n; k++) ctx.lineTo(b.trail[k].x, b.trail[k].y);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, b.radius * 0.34) / camera.zoom;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBody(b, now) {
  const pal = palette(b);
  ctx.save();
  ctx.translate(b.x, b.y);

  if (b.type === 'blackhole') {
    const ringR = b.radius * 2.3;
    ctx.save();
    ctx.rotate(now / 4000 + b.spinPhase);
    const ringGrad = ctx.createRadialGradient(0, 0, b.radius * 0.85, 0, 0, ringR);
    ringGrad.addColorStop(0, 'rgba(185,139,255,0)');
    ringGrad.addColorStop(0.5, 'rgba(185,139,255,0.5)');
    ringGrad.addColorStop(0.78, 'rgba(106,210,255,0.32)');
    ringGrad.addColorStop(1, 'rgba(185,139,255,0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringR, ringR * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const coreGrad = ctx.createRadialGradient(-b.radius * 0.3, -b.radius * 0.3, 1, 0, 0, b.radius);
    coreGrad.addColorStop(0, pal.c0);
    coreGrad.addColorStop(0.6, pal.c1);
    coreGrad.addColorStop(1, pal.c2);
    ctx.fillStyle = coreGrad;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius * 0.82, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const grad = ctx.createRadialGradient(-b.radius * 0.32, -b.radius * 0.32, b.radius * 0.05, 0, 0, b.radius);
    grad.addColorStop(0, pal.c0);
    grad.addColorStop(0.55, pal.c1);
    grad.addColorStop(1, pal.c2);
    ctx.fillStyle = grad;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = b.type === 'star' ? 46 : b.type === 'planet' ? 16 : 8;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (b === selected) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(106,210,255,0.9)';
    ctx.lineWidth = 1.6 / camera.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius + 5 / camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawVelocityVector(b) {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed < 0.5) return;
  const len = Math.min(speed * 0.12, 140) + b.radius + 4;
  const ang = Math.atan2(b.vy, b.vx);
  const ex = b.x + Math.cos(ang) * len;
  const ey = b.y + Math.sin(ang) * len;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  const headLen = 7 / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - headLen * Math.cos(ang - 0.4), ey - headLen * Math.sin(ang - 0.4));
  ctx.lineTo(ex - headLen * Math.cos(ang + 0.4), ey - headLen * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawLabel(b) {
  ctx.font = `${12 / camera.zoom}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,236,251,0.85)';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4 / camera.zoom;
  ctx.fillText(b.name, b.x, b.y - b.radius - 8 / camera.zoom);
  ctx.shadowBlur = 0;
}

function drawCOM() {
  if (!bodies.length) return;
  let totalMass = 0, cx = 0, cy = 0;
  for (const b of bodies) { totalMass += b.mass; cx += b.x * b.mass; cy += b.y * b.mass; }
  cx /= totalMass; cy /= totalMass;
  const pulse = 1 + Math.sin(performance.now() / 260) * 0.15;
  ctx.strokeStyle = 'rgba(255,209,122,0.85)';
  ctx.lineWidth = 1.4 / camera.zoom;
  const s = 9 * pulse / camera.zoom;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
  ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpawnArrow() {
  if (!gesture || gesture.type !== 'spawn') return;
  const cur = pointers.get(gesture.pointerId);
  if (!cur) return;
  const startS = worldToScreen(gesture.startWorld.x, gesture.startWorld.y);
  const dx = cur.x - startS.x, dy = cur.y - startS.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.strokeStyle = 'rgba(106,210,255,0.9)';
  ctx.fillStyle = 'rgba(106,210,255,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(startS.x, startS.y);
  ctx.lineTo(cur.x, cur.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(cur.x, cur.y);
  ctx.lineTo(cur.x - headLen * Math.cos(ang - 0.4), cur.y - headLen * Math.sin(ang - 0.4));
  ctx.lineTo(cur.x - headLen * Math.cos(ang + 0.4), cur.y - headLen * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(startS.x, startS.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);
  drawStars(now);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  if (display.trails) for (const b of bodies) drawTrail(b);
  if (display.com) drawCOM();
  for (const b of bodies) drawBody(b, now);
  if (display.vectors) for (const b of bodies) drawVelocityVector(b);
  if (display.labels) for (const b of bodies) drawLabel(b);

  ctx.restore();

  drawSpawnArrow();
}

/* ============================== INTERACTION =============================== */

const pointers = new Map();
let gesture = null;

function hitTestBody(sx, sy) {
  let best = null, bestD = Infinity;
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    const s = worldToScreen(b.x, b.y);
    const r = Math.max(b.radius * camera.zoom, 12);
    const d = Math.hypot(sx - s.x, sy - s.y);
    if (d <= r && d < bestD) { best = b; bestD = d; }
  }
  return best;
}

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  camera.zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const after = screenToWorld(sx, sy);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const factor = Math.pow(1.0015, -e.deltaY);
  zoomAt(sx, sy, factor);
}, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  pointers.set(e.pointerId, { x, y });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

  if (pointers.size === 1) {
    if (e.button === 2 || e.button === 1) {
      gesture = { type: 'pan', pointerId: e.pointerId, camX: camera.x, camY: camera.y, sx: x, sy: y };
    } else {
      const hit = hitTestBody(x, y);
      if (hit) {
        selectBody(hit);
        gesture = null;
      } else {
        deselect();
        gesture = { type: 'spawn', pointerId: e.pointerId, startWorld: screenToWorld(x, y) };
      }
    }
  } else if (pointers.size === 2) {
    const pts = [...pointers.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    gesture = {
      type: 'pinch', startDist: Math.max(d, 1), startZoom: camera.zoom,
      startMid: mid, startCamX: camera.x, startCamY: camera.y,
    };
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  pointers.set(e.pointerId, { x, y });

  if (!gesture) return;

  if (gesture.type === 'pan' && e.pointerId === gesture.pointerId) {
    camera.x = gesture.camX - (x - gesture.sx) / camera.zoom;
    camera.y = gesture.camY - (y - gesture.sy) / camera.zoom;
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    camera.zoom = clamp(gesture.startZoom * (d / gesture.startDist), MIN_ZOOM, MAX_ZOOM);
    camera.x = gesture.startCamX - (mid.x - gesture.startMid.x) / camera.zoom;
    camera.y = gesture.startCamY - (mid.y - gesture.startMid.y) / camera.zoom;
  }
  /* spawn gesture: arrow redraw handled each render frame */
});

function endPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;

  if (gesture && gesture.type === 'spawn' && gesture.pointerId === e.pointerId) {
    const endWorld = screenToWorld(x, y);
    const dx = endWorld.x - gesture.startWorld.x;
    const dy = endWorld.y - gesture.startWorld.y;
    const d = Math.hypot(dx, dy);
    const vx = d > 3 ? dx * LAUNCH_SCALE : 0;
    const vy = d > 3 ? dy * LAUNCH_SCALE : 0;
    createBody(gesture.startWorld.x, gesture.startWorld.y, vx, vy);
    gesture = null;
  } else if (gesture && gesture.type === 'pan' && gesture.pointerId === e.pointerId) {
    gesture = null;
  }

  pointers.delete(e.pointerId);
  try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }

  if (gesture && gesture.type === 'pinch' && pointers.size < 2) {
    gesture = null;
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
    deleteSelected();
  } else if (e.key === 'Escape') {
    deselect();
  }
});

/* ============================== BODY CREATION ============================= */

function createBody(x, y, vx, vy) {
  const massVal = Number(elMassSlider.value);
  const b = new Body(x, y, vx, vy, massVal, currentSpawnType);
  bodies.push(b);
  selectBody(b);
  snapshotIfSandbox();
  return b;
}

function snapshotIfSandbox() {
  /* keep sandbox reset behaviour meaningful without a loaded preset */
  if (!initialSnapshot.length && bodies.length === 1) snapshotCurrent();
}

/* =============================== UI WIRING ================================ */

const elPlay = document.getElementById('btn-play');
const elReset = document.getElementById('btn-reset');
const elClear = document.getElementById('btn-clear');
const elCameraReset = document.getElementById('btn-camera-reset');
const elSpeedGroup = document.getElementById('speed-group');
const elTypeGrid = document.getElementById('type-grid');
const elMassSlider = document.getElementById('spawn-mass');
const elMassValue = document.getElementById('spawn-mass-value');
const elToggleHud = document.getElementById('btn-toggle-hud');
const elPanels = document.getElementById('panels');

const elStatBodies = document.getElementById('stat-bodies');
const elStatTime = document.getElementById('stat-time');
const elStatSpeed = document.getElementById('stat-speed');
const elStatFps = document.getElementById('stat-fps');

const elInspector = document.getElementById('inspector');
const elInspName = document.getElementById('insp-name');
const elInspType = document.getElementById('insp-type');
const elInspMass = document.getElementById('insp-mass');
const elInspMassValue = document.getElementById('insp-mass-value');
const elInspVelocity = document.getElementById('insp-velocity');
const elInspSpeed = document.getElementById('insp-speed');
const elInspPosition = document.getElementById('insp-position');
const elBtnDelete = document.getElementById('btn-delete');
const elBtnCloseInspector = document.getElementById('btn-close-inspector');

function updatePlayButton() {
  elPlay.textContent = running ? 'Pause' : 'Play';
}

elPlay.addEventListener('click', () => { running = !running; updatePlayButton(); });
elReset.addEventListener('click', resetSimulation);
elClear.addEventListener('click', clearAll);
elCameraReset.addEventListener('click', () => { camera.x = 0; camera.y = 0; camera.zoom = 1; });

elSpeedGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-speed]');
  if (!btn) return;
  speedMultiplier = Number(btn.dataset.speed);
  [...elSpeedGroup.children].forEach(c => c.classList.toggle('active', c === btn));
});

elTypeGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-type]');
  if (!btn) return;
  currentSpawnType = btn.dataset.type;
  [...elTypeGrid.children].forEach(c => c.classList.toggle('active', c === btn));
  applyMassRange(elMassSlider, elMassValue, MASS_RANGE[currentSpawnType]);
});

function applyMassRange(sliderEl, labelEl, range) {
  sliderEl.min = range.min;
  sliderEl.max = range.max;
  sliderEl.step = range.step;
  sliderEl.value = range.def;
  labelEl.textContent = range.def;
}

elMassSlider.addEventListener('input', () => { elMassValue.textContent = elMassSlider.value; });

document.querySelectorAll('.panel-display .toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.toggle;
    display[key] = !display[key];
    btn.classList.toggle('active', display[key]);
  });
});

document.querySelectorAll('.panel-presets [data-preset]').forEach(btn => {
  btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
});

elToggleHud.addEventListener('click', () => elPanels.classList.toggle('hidden'));

/* ------------------------------ Inspector ------------------------------ */

function selectBody(b) {
  selected = b;
  elInspector.hidden = false;
  elInspName.value = b.name;
  elInspType.textContent = TYPE_LABEL[b.type];
  applyMassRange(elInspMass, elInspMassValue, MASS_RANGE[b.type]);
  elInspMass.value = b.mass;
  elInspMassValue.textContent = Math.round(b.mass);
}

function deselect() {
  selected = null;
  hideInspector();
}

function hideInspector() {
  elInspector.hidden = true;
}

function deleteSelected() {
  if (!selected) return;
  const idx = bodies.indexOf(selected);
  if (idx >= 0) bodies.splice(idx, 1);
  deselect();
}

elInspName.addEventListener('input', () => {
  if (selected) selected.name = elInspName.value.trim() || TYPE_LABEL[selected.type];
});

elInspMass.addEventListener('input', () => {
  if (!selected) return;
  const m = Number(elInspMass.value);
  selected.mass = m;
  selected.radius = radiusForMass(m, selected.type);
  elInspMassValue.textContent = Math.round(m);
});

elBtnDelete.addEventListener('click', deleteSelected);
elBtnCloseInspector.addEventListener('click', deselect);

/* Init default mass range for starting spawn type */
applyMassRange(elMassSlider, elMassValue, MASS_RANGE[currentSpawnType]);

/* =============================== MAIN LOOP ================================= */

let lastTime = performance.now();
let fps = 60;
let statsTimer = 0;
let trailTimer = 0;

function updateInspectorLive() {
  if (!selected || elInspector.hidden) return;
  if (document.activeElement === elInspName) return;
  elInspVelocity.textContent = `${selected.vx.toFixed(1)}, ${selected.vy.toFixed(1)}`;
  elInspSpeed.textContent = Math.hypot(selected.vx, selected.vy).toFixed(1);
  elInspPosition.textContent = `${selected.x.toFixed(0)}, ${selected.y.toFixed(0)}`;
  if (document.activeElement !== elInspMass) {
    elInspMass.value = selected.mass;
    elInspMassValue.textContent = Math.round(selected.mass);
  }
}

function updateStats(realDt) {
  fps = fps * 0.9 + (1 / Math.max(realDt, 0.0001)) * 0.1;
  statsTimer += realDt;
  if (statsTimer >= 0.15) {
    statsTimer = 0;
    elStatBodies.textContent = bodies.length;
    elStatTime.textContent = simTime.toFixed(1) + 's';
    elStatSpeed.textContent = speedMultiplier + 'x';
    elStatFps.textContent = Math.round(fps);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let realDt = (now - lastTime) / 1000;
  lastTime = now;
  realDt = Math.min(realDt, 0.1);

  if (running && bodies.length) {
    accumulator += realDt * speedMultiplier;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      physicsStep(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    trailTimer += realDt;
    if (trailTimer >= 1 / 30) {
      trailTimer = 0;
      pushTrailPoints();
    }
  }

  render(now);
  updateInspectorLive();
  updateStats(realDt);
}

requestAnimationFrame(frame);

})();
