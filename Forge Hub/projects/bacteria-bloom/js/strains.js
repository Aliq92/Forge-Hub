/* Bacteria Bloom - fictional strain definitions & traits */
(function (BB) {
  'use strict';

  // Each strain is deliberately unbalanced across traits so behavior reads
  // differently on the dish, not just by color.
  const STRAINS = {
    rapida: {
      key: 'rapida', name: 'Rapida', tagline: 'Fast & hungry',
      hue: 40, sat: 78, light: 56,
      growthRate: 1.55,        // fast frontier expansion
      isotropy: 0.92,          // spreads broadly, not directional
      branchiness: 0.08,
      thickenRate: 0.55,
      densityMax: 0.72,        // broad but comparatively thin colonies
      competitiveStrength: 0.68, // weaker at boundaries
      nutrientConsume: 1.35,
      idealTempMin: 27, idealTempMax: 35, tempTolerance: 7,
      inhibitorSensitivity: 1.15,
      recoveryRate: 0.4,
      mutationTendency: 1.2,
      starvationTolerance: 0.7
    },
    dendra: {
      key: 'dendra', name: 'Dendra', tagline: 'Branching explorer',
      hue: 258, sat: 55, light: 62,
      growthRate: 0.95,
      isotropy: 0.22,           // strongly directional
      branchiness: 0.85,
      thickenRate: 0.18,
      densityMax: 0.6,
      competitiveStrength: 0.85,
      nutrientConsume: 0.75,
      idealTempMin: 22, idealTempMax: 30, tempTolerance: 9,
      inhibitorSensitivity: 1.0,
      recoveryRate: 0.5,
      mutationTendency: 1.0,
      starvationTolerance: 0.85,
      nutrientSeeking: 1.6      // strongly biases growth toward nutrient gradient
    },
    compacta: {
      key: 'compacta', name: 'Compacta', tagline: 'Dense & dominant',
      hue: 348, sat: 62, light: 52,
      growthRate: 0.62,
      isotropy: 0.85,
      branchiness: 0.05,
      thickenRate: 0.85,        // fills in aggressively
      densityMax: 1.0,
      competitiveStrength: 1.55, // dominates at close range
      nutrientConsume: 1.1,
      idealTempMin: 25, idealTempMax: 33, tempTolerance: 6,
      inhibitorSensitivity: 1.05,
      recoveryRate: 0.35,
      mutationTendency: 0.85,
      starvationTolerance: 0.6
    },
    resilia: {
      key: 'resilia', name: 'Resilia', tagline: 'Stress-hardened survivor',
      hue: 186, sat: 48, light: 58,
      growthRate: 0.88,
      isotropy: 0.75,
      branchiness: 0.28,
      thickenRate: 0.4,
      densityMax: 0.8,
      competitiveStrength: 1.0,
      nutrientConsume: 0.65,
      idealTempMin: 16, idealTempMax: 42, tempTolerance: 16, // wide tolerance band
      inhibitorSensitivity: 0.45, // resistant
      recoveryRate: 1.4,          // recolonizes weakened zones well
      mutationTendency: 0.9,
      starvationTolerance: 1.4
    }
  };

  const STRAIN_ORDER = ['rapida', 'dendra', 'compacta', 'resilia'];

  function strainColor(strain, opts) {
    opts = opts || {};
    const h = strain.hue + (opts.hueShift || 0);
    const s = BB.util.clamp(strain.sat + (opts.satShift || 0), 10, 92);
    const l = BB.util.clamp(strain.light + (opts.lightShift || 0), 8, 88);
    return `hsl(${h.toFixed(1)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`;
  }

  BB.Strains = { STRAINS, STRAIN_ORDER, strainColor };

})(window.BB = window.BB || {});
