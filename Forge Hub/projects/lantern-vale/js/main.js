import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

// Some embedding contexts report a 0x0 layout on the very first script tick;
// re-fire resize once the browser has settled so canvases pick up real size.
requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  game.render(now / 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
