// Named world layouts. Each preset resets the colony to a clean slate, then
// arranges the nest, food, and (optionally) obstacles/hazards to showcase a
// specific piece of emergent behaviour. Presets don't touch ant/pheromone
// logic at all — they just set the stage.
const PRESETS = {
  simpleForage: {
    label: "Simple Forage",
    hint: "A single nearby food source. Watch the first trail form.",
    build(colony) {
      const { width: w, height: h } = colony.world;
      colony.food = [];
      colony.addFoodAt(w * 0.72, h * 0.4, randInt(55, 90), "crumbs");
      colony.addFoodAt(w * 0.28, h * 0.66, randInt(40, 65), "sugar");
    },
  },

  twoFoodSources: {
    label: "Two Food Sources",
    hint: "One small source is close; one large source is far. Which wins?",
    build(colony) {
      const { width: w, height: h } = colony.world;
      colony.food = [];
      colony.addFoodAt(colony.nest.x + 95, colony.nest.y - 55, randInt(18, 28), "crumbs");
      colony.addFoodAt(w * 0.87, h * 0.82, randInt(95, 140), "fruit");
    },
  },

  twoPaths: {
    label: "Two Paths",
    hint: "One route around the wall is much shorter. Watch it dominate.",
    nestFrac: { x: 0.14, y: 0.5 },
    build(colony) {
      const { width: w, height: h } = colony.world;
      const cy = h * 0.5;
      colony.food = [];
      colony.addFoodAt(w * 0.86, cy, randInt(90, 130), "fruit");

      // A full-height wall with two narrow gaps cut into it, rather than one
      // rect whose "short" side is a wide-open gap: if one gap were much
      // wider than the other, ants disperse in the wide one and never form
      // a strong trail there even though it's the shorter route — the gaps
      // need comparable width so travel *distance* is what decides which
      // route wins.
      const x0 = w * 0.46;
      const x1 = w * 0.54;
      colony.obstacles.paintRect(x0, 0, x1, h, 1);

      const gapHeight = h * 0.09;
      const nearGapCenter = cy - h * 0.12; // short detour
      const farGapCenter = cy + h * 0.32; // long detour
      colony.obstacles.paintRect(x0, nearGapCenter - gapHeight / 2, x1, nearGapCenter + gapHeight / 2, 0);
      colony.obstacles.paintRect(x0, farGapCenter - gapHeight / 2, x1, farGapCenter + gapHeight / 2, 0);
    },
  },

  mazeRun: {
    label: "Maze Run",
    hint: "A short zigzag corridor between nest and food.",
    nestFrac: { x: 0.12, y: 0.5 },
    build(colony) {
      const { width: w, height: h } = colony.world;
      colony.food = [];
      colony.addFoodAt(w * 0.88, h * 0.5, randInt(80, 120), "protein");

      colony.obstacles.paintRect(w * 0.28, 0, w * 0.35, h * 0.62, 1);
      colony.obstacles.paintRect(w * 0.47, h * 0.38, w * 0.54, h, 1);
      colony.obstacles.paintRect(w * 0.66, 0, w * 0.73, h * 0.62, 1);
    },
  },

  scarceFood: {
    label: "Scarce Food",
    hint: "Several tiny, distant patches. Scouts earn their keep here.",
    build(colony) {
      colony.food = [];
      const pad = CONFIG.world.edgePadding;
      for (let i = 0; i < 6; i++) {
        let x, y, tries = 0;
        do {
          x = rand(pad, colony.world.width - pad);
          y = rand(pad, colony.world.height - pad);
          tries++;
        } while (dist(x, y, colony.nest.x, colony.nest.y) < CONFIG.world.minFoodDistFromNest * 1.3 && tries < 25);
        colony.addFoodAt(x, y, randInt(8, 16), "crumbs");
      }
    },
  },

  hazardRoute: {
    label: "Hazard Route",
    hint: "The direct route crosses a repellent zone. Watch the colony adapt.",
    nestFrac: { x: 0.14, y: 0.5 },
    build(colony) {
      const { width: w, height: h } = colony.world;
      colony.food = [];
      colony.addFoodAt(w * 0.86, h * 0.5, randInt(80, 120), "sugar");
      colony.hazards.paintCircle(w * 0.5, h * 0.5, Math.min(w, h) * 0.16, 1);
    },
  },
};

const PRESET_ORDER = ["simpleForage", "twoFoodSources", "twoPaths", "mazeRun", "scarceFood", "hazardRoute"];

function applyPreset(colony, key) {
  const preset = PRESETS[key];
  if (!preset) return;
  const frac = preset.nestFrac || { x: 0.5, y: 0.5 };
  colony.reset(frac.x, frac.y);
  preset.build(colony);
  colony.presetName = preset.label;
  colony.pushEvent(`Preset loaded: ${preset.label}`);
}
