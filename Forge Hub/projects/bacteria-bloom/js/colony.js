/* Bacteria Bloom - Colony bookkeeping (per-colony metadata; actual cell data
   lives in flat typed arrays inside Simulation for performance). */
(function (BB) {
  'use strict';

  let nextColonyId = 1;

  function Colony(strainKey, originIndex, birthTime) {
    this.id = nextColonyId++;
    this.strainKey = strainKey;
    this.strain = BB.Strains.STRAINS[strainKey];
    this.originIndex = originIndex;
    this.birthTime = birthTime;

    this.frontier = new Set();   // cell indices that can still act (grow/thicken)
    this.fading = new Set();     // dead cell indices still fading out
    this.mutations = [];         // list of {id, hueShift, growthMult, branchMult, stressMult}

    this.cellCount = 0;
    this.totalDensity = 0;
    this.alive = true;
  }

  Colony.prototype.addMutation = function (rng) {
    const id = this.mutations.length + 1;
    const variant = {
      id,
      hueShift: (rng() - 0.5) * 34,
      growthMult: 0.8 + rng() * 0.6,
      branchMult: 0.7 + rng() * 0.9,
      stressMult: 0.8 + rng() * 0.7
    };
    this.mutations.push(variant);
    return variant;
  };

  BB.Colony = Colony;
  BB.resetColonyIds = function () { nextColonyId = 1; };

})(window.BB = window.BB || {});
