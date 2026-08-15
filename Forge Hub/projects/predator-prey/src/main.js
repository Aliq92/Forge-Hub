// Entry point: wires up the canvas, HUD, controls, and drives the animation
// loop. Simulation logic itself lives in simulation.js.

import { CONFIG } from './config.js';
import { Simulation } from './simulation.js';

const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

const statPrey = document.getElementById('stat-prey');
const statPredator = document.getElementById('stat-predator');
const statFood = document.getElementById('stat-food');
const statTime = document.getElementById('stat-time');
const statFps = document.getElementById('stat-fps');
const btnPause = document.getElementById('btn-pause');
const btnRestart = document.getElementById('btn-restart');
const speedButtons = Array.from(document.querySelectorAll('.speed-btn'));
const extinctionBanner = document.getElementById('extinction-banner');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (simulation) simulation.resize(canvas.width, canvas.height);
}

let simulation = new Simulation(window.innerWidth, window.innerHeight);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let running = true;
let speedMultiplier = CONFIG.simulation.speeds[CONFIG.simulation.defaultSpeedIndex];

const FIXED_STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 8; // guards against a "spiral of death" after a long stall
let accumulatorMs = 0;
let lastTimestamp = performance.now();

let fps = 0;
let fpsFrameCount = 0;
let fpsLastSample = performance.now();

function formatTime(seconds) {
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function updateHud() {
  const stats = simulation.getStats();
  statPrey.textContent = stats.preyCount;
  statPredator.textContent = stats.predatorCount;
  statFood.textContent = stats.foodCount;
  statTime.textContent = formatTime(stats.elapsedSeconds);
  statFps.textContent = fps;

  if (stats.predatorCount === 0 && stats.preyCount === 0) {
    extinctionBanner.textContent = 'Both populations have gone extinct. Restart to try again.';
    extinctionBanner.classList.remove('hidden');
  } else if (stats.predatorCount === 0) {
    extinctionBanner.textContent = 'Predators are extinct — prey population is unchecked.';
    extinctionBanner.classList.remove('hidden');
  } else if (stats.preyCount === 0) {
    extinctionBanner.textContent = 'Prey are extinct — predators are starving.';
    extinctionBanner.classList.remove('hidden');
  } else {
    extinctionBanner.classList.add('hidden');
  }
}

function loop(timestamp) {
  requestAnimationFrame(loop);

  const rawDelta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  fpsFrameCount++;
  if (timestamp - fpsLastSample >= 500) {
    fps = Math.round((fpsFrameCount * 1000) / (timestamp - fpsLastSample));
    fpsFrameCount = 0;
    fpsLastSample = timestamp;
  }

  if (running) {
    accumulatorMs += rawDelta * speedMultiplier;
    let steps = 0;
    while (accumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      simulation.update();
      accumulatorMs -= FIXED_STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulatorMs = 0;
  }

  simulation.render(ctx);
  updateHud();
}

btnPause.addEventListener('click', () => {
  running = !running;
  btnPause.textContent = running ? 'Pause' : 'Resume';
  if (running) lastTimestamp = performance.now();
});

btnRestart.addEventListener('click', () => {
  simulation.reset();
  simulation.resize(canvas.width, canvas.height);
  accumulatorMs = 0;
  running = true;
  btnPause.textContent = 'Pause';
});

speedButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    speedMultiplier = parseFloat(btn.dataset.speed);
    speedButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

requestAnimationFrame(loop);
