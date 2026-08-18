import { UPGRADES } from '../data/upgrades.js';

const BASE_CAPACITY = 95;

export function getModifiers(state, eventId) {
  const mods = {
    reputationGainMult: 1, rareValueMult: 1, rareEventBonus: 0,
    unlockAdvancedRecipes: false, freeCombine: false, extraFollowup: 0,
    showBudgetHint: false, showToleranceHint: false, extraRareSlot: 0,
    capacity: BASE_CAPACITY,
  };
  for (const [id, level] of Object.entries(state.upgrades)) {
    const def = UPGRADES[id];
    if (!def || !level) continue;
    for (let i = 0; i < level; i++) {
      const lvl = def.levels[i];
      if (!lvl) continue;
      const eff = lvl.effect;
      if (eff.extraCapacity) mods.capacity += eff.extraCapacity * 4;
      if (eff.reputationGainMult) mods.reputationGainMult = eff.reputationGainMult;
      if (eff.unlockAdvancedRecipes) mods.unlockAdvancedRecipes = true;
      if (eff.freeCombine) mods.freeCombine = true;
      if (eff.showBudgetHint) mods.showBudgetHint = true;
      if (eff.showToleranceHint) mods.showToleranceHint = true;
      if (eff.rareValueMult) mods.rareValueMult = eff.rareValueMult;
      if (eff.extraFollowup) mods.extraFollowup = eff.extraFollowup;
      if (eff.extraRareSlot) mods.extraRareSlot += eff.extraRareSlot;
    }
  }
  if (eventId === 'FESTIVAL') mods.rareEventBonus += 0.2;
  return mods;
}

export function inventoryTotal(inventory) {
  return Object.values(inventory).reduce((s, v) => s + (v || 0), 0);
}

export function upgradeNextLevel(state, upgradeId) {
  const def = UPGRADES[upgradeId];
  const current = state.upgrades[upgradeId] || 0;
  if (current >= def.levels.length) return null;
  return { index: current, ...def.levels[current] };
}
