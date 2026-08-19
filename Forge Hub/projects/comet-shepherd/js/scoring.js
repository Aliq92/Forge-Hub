import { CONFIG } from './config.js';

// Builds the end-of-run score breakdown. Formula is intentionally simple and fully
// visible in this one function — no hidden multipliers buried elsewhere.
export function computeScoreBreakdown(stats, comet, stardust){
  const cfg = CONFIG.SCORE;
  const nm = CONFIG.NEAR_MISS;
  const systemsCrossed = stats.systemsCrossed || 0;
  const arrivalPts = systemsCrossed * cfg.SYSTEM_BONUS;
  const nearMissPts = stats.nearMissScore || 0;
  const slingshotPts = (stats.gravityAssists || 0) * nm.score.assist;
  const resourcePts = Math.round((stats.resourcePoints || 0) * cfg.RESOURCE_MULT);
  const timeBonus = Math.round((stats.timeSurvived || 0) * cfg.TIME_MULT);
  const stabilityFrac = comet.maxIce > 0 ? clamp01(comet.ice / comet.maxIce) : 0;
  const stabilityBonus = Math.round(stabilityFrac * 100 * cfg.STABILITY_MULT);

  const total = arrivalPts + nearMissPts + slingshotPts + resourcePts + timeBonus + stabilityBonus;

  const perSystem = systemsCrossed > 0 ? total / systemsCrossed : total;
  let rank = 'C';
  if(perSystem >= cfg.RANK_PER_SYSTEM.S) rank = 'S';
  else if(perSystem >= cfg.RANK_PER_SYSTEM.A) rank = 'A';
  else if(perSystem >= cfg.RANK_PER_SYSTEM.B) rank = 'B';

  const rows = [
    ['— SCORE BREAKDOWN —', '', true],
    ['ARRIVAL (' + systemsCrossed + ' systems)', '+' + arrivalPts],
    ['NEAR MISSES', '+' + nearMissPts],
    ['SLINGSHOTS', '+' + slingshotPts],
    ['RESOURCES', '+' + resourcePts],
    ['TIME BONUS', '+' + timeBonus],
    ['STABILITY (' + Math.round(stabilityFrac*100) + '%)', '+' + stabilityBonus],
    ['TOTAL SCORE', total],
    ['RANK', rank],
  ];

  return { total, rank, rows };
}

function clamp01(v){ return Math.max(0, Math.min(1, v)); }
