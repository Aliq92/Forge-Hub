// main.js — bootstraps the canvas, the fixed-timestep loop, and wires everything together.
import { Game } from './game.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { TouchControls } from './touch.js';
import { renderRoom, renderRewindTransition, clear, drawBackgroundGrid, drawEcho, drawPlayer } from './renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const LOGICAL_W = 960, LOGICAL_H = 540;

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL_W * dpr;
  canvas.height = LOGICAL_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const game = new Game({ width: LOGICAL_W, height: LOGICAL_H });
const audio = new AudioEngine(game.settings);
const ui = new UI(game, audio);
const touch = new TouchControls(game);

// Exposed for debugging/support only — harmless in production, never referenced by game logic.
window.echoRunnerDebug = { game, ui, audio, touch, canvas, ctx };

document.addEventListener('pointerdown', () => audio.resume(), { once: true });
document.addEventListener('keydown', () => audio.resume(), { once: true });

let musicStarted = false;
game.on((evt) => {
  if (!musicStarted && (evt.type === 'recordStart' || evt.type === 'roomComplete')) {
    musicStarted = true;
    audio.startMusic();
  }
});

// -------------------------------------------------------------- menu background
let menuT = 0;
function renderMenuBackground(dt) {
  menuT += dt;
  clear(ctx, LOGICAL_W, LOGICAL_H);
  drawBackgroundGrid(ctx, LOGICAL_W, LOGICAL_H, 0, '#7fd7ff');

  const reduced = game.settings.reducedMotion;
  const speed = reduced ? 0 : 46;
  const span = 640;
  const baseX = 160 + ((menuT * speed) % span);
  const y = LOGICAL_H * 0.62;
  const runner = { x: baseX, y, w: 22, h: 34, facing: 1, landedThisTick: false, jumpedThisTick: false };
  runner.y += Math.sin(menuT * 6) * 3;

  const delays = [0.35, 0.7, 1.05];
  delays.forEach((d, i) => {
    const ex = 160 + (((menuT - d) * speed + span * 20) % span);
    const echo = {
      x: ex, y: y + Math.sin((menuT - d) * 6) * 3, w: 22, h: 34,
      facing: 1, echoIndex: i, landedThisTick: false, jumpedThisTick: false,
    };
    drawEcho(ctx, echo, menuT, reduced ? 0.4 : 1);
  });
  drawPlayer(ctx, runner, menuT);
}

// -------------------------------------------------------------- main loop
let lastTime = performance.now();
let fpsAccum = 0, fpsFrames = 0, fpsLast = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  game.update(dt);

  if (game.state === 'playing' || game.state === 'paused') {
    renderRoom(ctx, LOGICAL_W, LOGICAL_H, game);
    if (game.transition && game.transition.type === 'rewind') {
      renderRewindTransition(ctx, LOGICAL_W, LOGICAL_H, game.transition.t / game.transition.duration, game.settings.reducedMotion);
    }
  } else {
    renderMenuBackground(dt);
  }

  ui.syncScreens();
  ui.syncHUD();
  touch.sync();

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) {
    fpsLast = Math.round(fpsFrames / fpsAccum);
    ui.setFPS(fpsLast);
    fpsAccum = 0; fpsFrames = 0;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
