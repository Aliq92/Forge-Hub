// Orbital Bloom - entry point: bootstraps camera, renderer, tools, simulation, UI
import { loadSettings, state } from './config.js';
import { Camera } from './camera.js';
import { initRenderer, resize as resizeRenderer } from './renderer.js';
import { initTools } from './tools.js';
import { initSimulation, startLoop } from './simulation.js';
import { initUI } from './ui.js';

loadSettings();

const simCanvas = document.getElementById('sim-canvas');
const camera = new Camera();

initRenderer(simCanvas);
initTools(simCanvas, camera);
initSimulation(camera, simCanvas);
initUI(camera, simCanvas);

function resizeAll() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = simCanvas.parentElement ? window.innerWidth : window.innerWidth;
  const h = window.innerHeight;
  resizeRenderer(w, h, dpr);
}
window.addEventListener('resize', resizeAll);
resizeAll();

startLoop();
initTitleBackground();

// ---------- Lightweight decorative title-screen background ----------
function initTitleBackground() {
  const canvas = document.getElementById('title-canvas');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * 2000 - 1000, y: Math.random() * 1400 - 700,
      r: 0.5 + Math.random() * 1.6, b: 0.18 + Math.random() * 0.55, phase: Math.random() * Math.PI * 2,
    });
  }
  const orbiters = [
    { angle: 0, radius: 70, speed: 0.22, color: '#ffd27a', size: 5 },
    { angle: 2.1, radius: 130, speed: -0.14, color: '#5be3ff', size: 3.4 },
    { angle: 4.2, radius: 190, speed: 0.09, color: '#b389ff', size: 3 },
  ];

  let t = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!document.getElementById('title-screen') || document.getElementById('title-screen').classList.contains('hidden')) {
      last = now; return;
    }
    const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;

    ctx.fillStyle = '#050611';
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 1;
    for (const s of stars) {
      const x = ((s.x + w / 2) % w + w) % w;
      const y = ((s.y + h / 2) % h + h) % h;
      const tw = state.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t * 0.6 + s.phase);
      ctx.globalAlpha = s.b * tw;
      ctx.fillStyle = '#eef3ff';
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill();
    }

    const cx = w / 2, cy = h * 0.42;
    ctx.globalAlpha = 1;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130);
    core.addColorStop(0, 'rgba(255,210,122,0.32)');
    core.addColorStop(1, 'rgba(255,210,122,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, 130, 0, Math.PI * 2); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    for (const o of orbiters) {
      if (!state.reducedMotion) o.angle += o.speed * dt;
      const x = cx + Math.cos(o.angle) * o.radius * 2.3;
      const y = cy + Math.sin(o.angle) * o.radius * 0.85;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, o.size * 4);
      grad.addColorStop(0, o.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, o.size * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
}
