import { CONFIG } from './config.js';
import { weightedPick } from './utils.js';

export const UPGRADE_META = {
  LONGER_VISION:     { name:'Longer Vision',     icon:'\u{1F441}', maxLevel:5, summary:'Extends trajectory preview length.' },
  FROZEN_CORE:        { name:'Frozen Core',       icon:'❄',   maxLevel:5, summary:'Increases maximum Ice Integrity.' },
  DEEP_RESERVOIR:      { name:'Deep Reservoir',    icon:'⚡',   maxLevel:5, summary:'Increases maximum Correction Energy.' },
  GENTLE_TOUCH:         { name:'Gentle Touch',      icon:'✋',   maxLevel:5, summary:'Reduces energy cost of course corrections.' },
  GRAVITY_SENSE:         { name:'Gravity Sense',     icon:'\u{1F30C}',maxLevel:5, summary:'Improves trajectory accuracy near planets.' },
  MAGNETIC_TAIL:          { name:'Magnetic Tail',     icon:'\u{1F9F2}',maxLevel:5, summary:'Increases resource pickup radius.' },
  HEAT_SHIELD:             { name:'Heat Shield',       icon:'\u{1F6E1}',maxLevel:5, summary:'Reduces solar heat gain.' },
  ICE_REGENERATION:         { name:'Ice Regeneration',  icon:'☃',   maxLevel:5, summary:'Passively regrows ice in cold space.' },
  EMERGENCY_BURST:           { name:'Emergency Burst',   icon:'\u{1F680}',maxLevel:5, summary:'Improves emergency impulse strength.' },
  SLINGSHOT_MASTERY:          { name:'Slingshot Mastery', icon:'\u{1F300}',maxLevel:5, summary:'Grants bonus energy after strong gravity assists.' },
  STAR_HARVEST:                 { name:'Star Harvest',     icon:'✦',   maxLevel:5, summary:'Resource pickups occasionally grant bonus Stardust.' },
};

export function makeUpgradeState(){
  const state = {};
  for(const id of Object.keys(UPGRADE_META)) state[id] = 0;
  return state;
}

export function describeUpgrade(id, currentLevel){
  const meta = UPGRADE_META[id];
  const next = currentLevel + 1;
  const lines = {
    LONGER_VISION: `Preview range +${next*22}% total.`,
    FROZEN_CORE: `Max Ice +${next*15}.`,
    DEEP_RESERVOIR: `Max Energy +${next*16}.`,
    GENTLE_TOUCH: `Correction cost -${next*9}%.`,
    GRAVITY_SENSE: `Sharper preview curvature near planets (tier ${next}).`,
    MAGNETIC_TAIL: `Pickup radius +${next*14}%.`,
    HEAT_SHIELD: `Heat gain -${next*10}%.`,
    ICE_REGENERATION: `Regrow +${(next*0.5).toFixed(1)} ice/sec in cold space.`,
    EMERGENCY_BURST: `Emergency impulse +${next*14}% strength.`,
    SLINGSHOT_MASTERY: `+${next*8} energy after a strong assist.`,
    STAR_HARVEST: `${Math.min(35,8+next*5)}% chance pickups yield bonus Stardust.`,
  };
  return lines[id] || meta.summary;
}

export function rollUpgradeChoices(rng, upgradeState, count=3){
  const ids = Object.keys(UPGRADE_META).filter(id => upgradeState[id] < UPGRADE_META[id].maxLevel);
  const pool = ids.length >= count ? ids : Object.keys(UPGRADE_META);
  const chosen = [];
  const remaining = pool.slice();
  while(chosen.length < count && remaining.length){
    const pickIdx = Math.floor(rng() * remaining.length);
    chosen.push(remaining.splice(pickIdx,1)[0]);
  }
  return chosen;
}

// Recomputes all derived comet stats from base values + upgrade levels. Idempotent.
// Defensively falls back to 0 for any missing key so a malformed/partial state can never inject NaN.
export function applyUpgradeEffects(comet, upgradeState){
  const prevMaxIce = comet.maxIce, prevMaxEnergy = comet.maxEnergy;
  const lvl = (key) => upgradeState[key] || 0;

  comet.maxIce = CONFIG.COMET_START_ICE + lvl('FROZEN_CORE') * 15;
  comet.maxEnergy = CONFIG.COMET_START_ENERGY + lvl('DEEP_RESERVOIR') * 16;
  comet.energyCostMult = Math.max(0.35, 1 - lvl('GENTLE_TOUCH') * 0.09);
  comet.heatGainMult = Math.max(0.35, 1 - lvl('HEAT_SHIELD') * 0.10);
  comet.iceRegenRate = lvl('ICE_REGENERATION') * 0.5;
  comet.emergencyPowerMult = 1 + lvl('EMERGENCY_BURST') * 0.14;
  comet.collectRadius = CONFIG.COMET_START_COLLECT_RADIUS * (1 + lvl('MAGNETIC_TAIL') * 0.14);
  comet.previewLevel = lvl('LONGER_VISION');
  comet.gravitySenseLevel = lvl('GRAVITY_SENSE');
  comet.slingshotMasteryLevel = lvl('SLINGSHOT_MASTERY');
  comet.starHarvestLevel = lvl('STAR_HARVEST');

  if(comet.maxIce > prevMaxIce) comet.ice += (comet.maxIce - prevMaxIce);
  if(comet.maxEnergy > prevMaxEnergy) comet.energy += (comet.maxEnergy - prevMaxEnergy);
  comet.ice = Math.min(comet.ice, comet.maxIce);
  comet.energy = Math.min(comet.energy, comet.maxEnergy);
}
