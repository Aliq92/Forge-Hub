// Bootstrap: create the game and start the main loop.
(function () {
  const canvas = document.getElementById('game-canvas');
  const game = new SG.Game(canvas);
  window.__starfallGame = game;

  let last = performance.now();
  function loop(now) {
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    try {
      game.tick(dt);
    } catch (err) {
      console.error('Starfall Garden frame error:', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === SG.STATE.PLAYING) {
      game._pause();
    }
  });
})();
