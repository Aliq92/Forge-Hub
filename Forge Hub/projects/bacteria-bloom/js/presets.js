/* Bacteria Bloom - polished scenario presets */
(function (BB) {
  'use strict';

  function fastForward(sim, ticks) {
    for (let i = 0; i < ticks; i++) sim.tick();
  }

  function pt(env, fracX, fracY) {
    // fracX/fracY in [-1,1] relative to dish radius, from center
    return {
      x: env.cx + fracX * env.radius,
      y: env.cy + fracY * env.radius
    };
  }

  const PRESETS = {
    single: {
      label: 'Single Colony',
      desc: 'One Rapida colony, balanced nutrients, ideal temperature.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.6, variance: 0.28 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        const p = pt(env, 0, 0);
        sim.inoculate('rapida', p.x, p.y);
      }
    },

    competition: {
      label: 'Competition',
      desc: 'Three strains placed apart — watch boundaries develop.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.6, variance: 0.3 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        const a = pt(env, 0, -0.55), b = pt(env, -0.5, 0.42), c = pt(env, 0.5, 0.42);
        sim.inoculate('rapida', a.x, a.y);
        sim.inoculate('compacta', b.x, b.y);
        sim.inoculate('dendra', c.x, c.y);
        fastForward(sim, 3600);
      }
    },

    inhibitorTest: {
      label: 'Inhibitor Test',
      desc: 'One large colony with several inhibitor zones.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.65, variance: 0.2 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        const p = pt(env, 0, 0);
        sim.inoculate('compacta', p.x, p.y);
        fastForward(sim, 3000);
        const zones = [pt(env, 0.5, -0.2), pt(env, -0.45, -0.3), pt(env, 0.1, 0.55), pt(env, -0.4, 0.35)];
        for (const z of zones) env.addInhibitor(z.x, z.y, 14, 14);
        fastForward(sim, 1400);
      }
    },

    nutrientIslands: {
      label: 'Nutrient Islands',
      desc: 'Low overall nutrients with rich patches — Dendra explores toward them.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.13, variance: 0.05 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        env.nutrientRegen = 'off';
        const islands = [pt(env, 0.6, -0.5), pt(env, -0.6, -0.45), pt(env, 0.62, 0.5), pt(env, -0.5, 0.6), pt(env, 0, 0.75)];
        for (const isl of islands) env.addNutrient(isl.x, isl.y, 15, 20);
        const p = pt(env, 0, -0.05);
        sim.inoculate('dendra', p.x, p.y);
      }
    },

    overgrowth: {
      label: 'Overgrowth',
      desc: 'Multiple fast strains, high nutrients, rapid competition.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.9, variance: 0.12 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        const pts = [pt(env, -0.5, -0.5), pt(env, 0.5, -0.5), pt(env, -0.5, 0.5), pt(env, 0.5, 0.5), pt(env, 0, 0)];
        sim.inoculate('rapida', pts[0].x, pts[0].y);
        sim.inoculate('rapida', pts[1].x, pts[1].y);
        sim.inoculate('rapida', pts[2].x, pts[2].y);
        sim.inoculate('compacta', pts[3].x, pts[3].y);
        sim.inoculate('dendra', pts[4].x, pts[4].y);
        fastForward(sim, 3800);
      }
    },

    stressTest: {
      label: 'Stress Test',
      desc: 'Extreme temperature plus low nutrients — Resilia performs better.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.16, variance: 0.1 });
        env.temperature = 45;
        const a = pt(env, -0.35, 0), b = pt(env, 0.35, 0);
        sim.inoculate('resilia', a.x, a.y);
        sim.inoculate('rapida', b.x, b.y);
        fastForward(sim, 3000);
      }
    },

    fourCorners: {
      label: 'Four Corners',
      desc: 'Four strains inoculated at separate regions.',
      apply(sim, env) {
        sim.resetDish();
        env.randomize(Date.now() >>> 0, { baseNutrient: 0.6, variance: 0.3 });
        env.temperature = BB.CONFIG.TEMP_DEFAULT;
        const a = pt(env, -0.55, -0.55), b = pt(env, 0.55, -0.55);
        const c = pt(env, -0.55, 0.55), d = pt(env, 0.55, 0.55);
        sim.inoculate('rapida', a.x, a.y);
        sim.inoculate('dendra', b.x, b.y);
        sim.inoculate('compacta', c.x, c.y);
        sim.inoculate('resilia', d.x, d.y);
      }
    }
  };

  const PRESET_ORDER = ['single', 'competition', 'inhibitorTest', 'nutrientIslands', 'overgrowth', 'stressTest', 'fourCorners'];

  BB.Presets = { PRESETS, PRESET_ORDER };

})(window.BB = window.BB || {});
