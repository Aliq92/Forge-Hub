import { Renderer } from './renderer.js';
import { Minimap } from './minimap.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';

window.addEventListener('error', (e) => {
  console.error('Comet Shepherd error:', e.error || e.message);
});

function boot(){
  const gameCanvas = document.getElementById('game-canvas');
  const fxCanvas = document.getElementById('fx-canvas');
  const minimapCanvas = document.getElementById('minimap-canvas');

  const renderer = new Renderer(gameCanvas, fxCanvas);
  const minimap = new Minimap(minimapCanvas);
  const audio = new AudioEngine();
  const input = new InputManager(gameCanvas);
  const ui = new UI();

  const unlockAudio = () => { audio.init(); audio.resume(); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  window.addEventListener('pointerdown', unlockAudio, { once:true });
  window.addEventListener('keydown', unlockAudio, { once:true });

  window.game = new Game(ui, renderer, minimap, audio, input);

  const resyncSize = () => { renderer.resize(); minimap.resize(); };
  window.addEventListener('load', resyncSize);
  setTimeout(resyncSize, 50);
  setTimeout(resyncSize, 300);
  if(window.ResizeObserver){
    new ResizeObserver(resyncSize).observe(document.documentElement);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
