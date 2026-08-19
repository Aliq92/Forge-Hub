/* Bacteria Bloom - localStorage persistence for settings and optional dish snapshots */
(function (BB) {
  'use strict';

  const SETTINGS_KEY = 'bacteriaBloom.settings.v1';
  const DISH_KEY = 'bacteriaBloom.dish.v1';

  function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function serializeDish(sim, env) {
    const colonies = [...sim.colonies.values()]
      .sort((a, b) => a.id - b.id)
      .map(c => ({
        strainKey: c.strainKey,
        birthTime: c.birthTime,
        mutations: c.mutations,
        frontier: [...c.frontier],
        fading: [...c.fading]
      }));

    return {
      version: 1,
      w: env.w, h: env.h,
      temperature: env.temperature,
      nutrientRegen: env.nutrientRegen,
      nutrient: Array.from(env.nutrient),
      inhibitor: Array.from(env.inhibitor),
      agarVariation: Array.from(env.agarVariation),
      simTime: sim.simTime,
      mutationRate: sim.mutationRate,
      colonies,
      grid: {
        colonyIdGrid: Array.from(sim.colonyIdGrid),
        strainIdxGrid: Array.from(sim.strainIdxGrid),
        density: Array.from(sim.density),
        age: Array.from(sim.age),
        mutationIdGrid: Array.from(sim.mutationIdGrid),
        dead: Array.from(sim.dead),
        deathFade: Array.from(sim.deathFade),
        dirX: Array.from(sim.dirX),
        dirY: Array.from(sim.dirY)
      }
    };
  }

  function saveDish(sim, env) {
    try {
      localStorage.setItem(DISH_KEY, JSON.stringify(serializeDish(sim, env)));
      return true;
    } catch (e) { return false; }
  }

  function hasSavedDish() {
    try { return !!localStorage.getItem(DISH_KEY); } catch (e) { return false; }
  }

  function applyDish(data, sim, env, renderer) {
    if (!data || data.w !== env.w || data.h !== env.h) return false;

    env.nutrient.set(data.nutrient);
    env.inhibitor.set(data.inhibitor);
    env.agarVariation.set(data.agarVariation);
    env.temperature = data.temperature;
    env.nutrientRegen = data.nutrientRegen || 'low';

    sim.resetDish();
    sim.simTime = data.simTime || 0;
    sim.mutationRate = data.mutationRate || 'low';

    for (const cData of data.colonies) {
      const colony = new BB.Colony(cData.strainKey, 0, cData.birthTime);
      colony.mutations = cData.mutations || [];
      colony.frontier = new Set(cData.frontier);
      colony.fading = new Set(cData.fading);
      sim.colonies.set(colony.id, colony);
    }

    sim.colonyIdGrid.set(data.grid.colonyIdGrid);
    sim.strainIdxGrid.set(data.grid.strainIdxGrid);
    sim.density.set(data.grid.density);
    sim.age.set(data.grid.age);
    sim.mutationIdGrid.set(data.grid.mutationIdGrid);
    sim.dead.set(data.grid.dead);
    sim.deathFade.set(data.grid.deathFade);
    sim.dirX.set(data.grid.dirX);
    sim.dirY.set(data.grid.dirY);

    let liveCount = 0;
    for (const colony of sim.colonies.values()) {
      colony.cellCount = 0;
    }
    for (let i = 0; i < sim.n; i++) {
      if (sim.colonyIdGrid[i] !== 0 && !sim.dead[i]) {
        const c = sim.colonies.get(sim.colonyIdGrid[i]);
        if (c) c.cellCount++;
        liveCount++;
      }
    }

    if (renderer) renderer.rebuildAgar();
    return true;
  }

  function loadDish(sim, env, renderer) {
    try {
      const raw = localStorage.getItem(DISH_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return applyDish(data, sim, env, renderer);
    } catch (e) { return false; }
  }

  BB.Storage = { saveSettings, loadSettings, saveDish, loadDish, hasSavedDish };

})(window.BB = window.BB || {});
