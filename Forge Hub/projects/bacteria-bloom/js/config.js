/* Bacteria Bloom - shared configuration & constants */
(function (BB) {
  'use strict';

  BB.CONFIG = {
    GRID_W: 190,
    GRID_H: 190,
    DISH_MARGIN: 4,

    START_DENSITY: 0.28,
    CLAIM_MIN_DENSITY: 0.05,
    DEATH_CLEAR_FADE: 0.015,

    // fixed simulation stepping
    BASE_TICKS_PER_SEC: 18,
    MAX_TICKS_PER_FRAME: 48,

    BASE_SPREAD_RATE: 0.045,
    BASE_THICKEN_RATE: 0.2,
    BASE_NUTRIENT_CONSUME: 0.045,
    COMPETITION_MARGIN: 1.12,
    COMPETITION_CONVERT_RATE: 0.55,

    NUTRIENT_REGEN_RATES: { off: 0, low: 0.0018, medium: 0.006, high: 0.014 },
    NUTRIENT_MAX: 1,

    MUTATION_RATES: { off: 0, low: 0.00003, medium: 0.00014 },

    TEMP_MIN: 10,
    TEMP_MAX: 50,
    TEMP_DEFAULT: 30,

    INHIBITOR_KILL_THRESHOLD: 0.62,

    STARTER_CLUSTER_CELLS: 5
  };

})(window.BB = window.BB || {});
