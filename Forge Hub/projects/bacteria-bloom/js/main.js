/* Bacteria Bloom - bootstrap & fixed-step simulation loop */
(function (BB) {
  'use strict';

  function boot() {
    const env = new BB.Environment(Date.now() >>> 0);
    const sim = new BB.Simulation(env);
    const canvas = document.getElementById('dishCanvas');
    const renderer = new BB.Renderer(canvas, env, sim);
    const dishWrap = document.getElementById('dishWrap');

    // First-run: single colony preset so growth is visible immediately.
    BB.Presets.PRESETS.single.apply(sim, env);
    renderer.rebuildAgar();

    BB.UI.init(sim, env, renderer);
    BB.instance = { sim, env, renderer };

    function fitCanvas() {
      const rect = dishWrap.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      if (size <= 0) return;
      renderer.resize(size, size);
    }

    fitCanvas();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => fitCanvas());
      ro.observe(dishWrap);
    } else {
      window.addEventListener('resize', fitCanvas);
    }
    window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 200));

    const tickDt = 1 / BB.CONFIG.BASE_TICKS_PER_SEC;
    let lastTime = performance.now();
    let acc = 0;

    function frame(now) {
      const dt = Math.min(0.25, (now - lastTime) / 1000);
      lastTime = now;

      if (sim.speedMultiplier > 0) {
        acc += dt * sim.speedMultiplier;
        let steps = 0;
        while (acc >= tickDt && steps < BB.CONFIG.MAX_TICKS_PER_FRAME) {
          sim.tick();
          acc -= tickDt;
          steps++;
        }
        if (steps >= BB.CONFIG.MAX_TICKS_PER_FRAME) acc = 0;
      }

      renderer.draw(dt);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.BB = window.BB || {});
