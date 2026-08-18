import { NIGHTS, EVENTS } from '../data/nights.js';
import { ITEMS } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';
import { buildNightQueue } from './encounters.js';
import { resolveSale, resolveSellToShop } from './economy.js';
import { getModifiers, inventoryTotal } from './shop.js';
import { nextTimeStep } from './time.js';
import { freshNightStats } from '../state.js';
import { determineEnding } from '../data/endings.js';

export function currentNightDef(state) {
  return NIGHTS[state.night];
}

export function startNight(state) {
  const def = currentNightDef(state);
  state.currentQueue = buildNightQueue(def, state.storyFlags);
  state.queueIndex = 0;
  state.time = 0;
  state.nightStats = freshNightStats();
  state.nightPhase = 'SHOP';
}

export function currentEncounter(state) {
  return state.currentQueue[state.queueIndex] || null;
}

export function isNightOver(state) {
  return state.queueIndex >= state.currentQueue.length;
}

function markCompleted(state, encounter) {
  if (encounter.source === 'oneoff') {
    if (!state.completedOneoffs.includes(encounter.instanceId)) state.completedOneoffs.push(encounter.instanceId);
  } else {
    const tag = encounter.instanceId.split('_').slice(2).join('_');
    if (!state.completedRecurringTags.includes(tag)) state.completedRecurringTags.push(tag);
  }
}

function bumpTotals(state, tierId) {
  const key = tierId.toLowerCase();
  state.totals.customersServed += 1;
  state.nightStats.customersServed += 1;
  if (state.totals[key] !== undefined) state.totals[key] += 1;
  if (state.nightStats[key] !== undefined) state.nightStats[key] += 1;
}

// Apply the resolution of a normal item-for-request sale attempt.
export function applySale(state, encounter, item, priceChoice, comboItem) {
  const def = currentNightDef(state);
  const mods = getModifiers(state, def.event);
  const result = resolveSale({
    item, comboItem, encounter, priceChoice, modifiers: mods,
    reactionSeed: state.queueIndex + state.night * 7,
  });

  if (result.isSale) {
    state.inventory[item.id] = Math.max(0, (state.inventory[item.id] || 0) - 1);
    if (comboItem) state.inventory[comboItem.id] = Math.max(0, (state.inventory[comboItem.id] || 0) - 1);
    state.money += result.moneyDelta;
    state.nightStats.moneyEarned += result.moneyDelta;
    state.totals.moneyEarned += result.moneyDelta;
    if (result.tip > 0) { state.nightStats.tips += result.tip; state.totals.tips += result.tip; }
    state.nightStats.itemsSold += 1;
    state.totals.itemsSold += 1;
    if (item.rarity === 'rare' || item.rarity === 'legendary') state.totals.rareItemsSold += 1;
    if (result.tier.order >= 3) state.discoveredItems[item.id] = true;

    if (item.risky) {
      const key = `risky_${item.id}_uses`;
      state.storyFlags[key] = (state.storyFlags[key] || 0) + 1;
      if (state.storyFlags[key] >= 2) {
        result.riskyNote = `The ${item.name} leaves the shop again. Selling it a second time feels different than the first — heavier, somehow, like it noticed.`;
      }
    }
  }

  state.reputation = Math.max(0, Math.min(100, state.reputation + result.reputationDelta));
  state.nightStats.reputationDelta += result.reputationDelta;

  if (encounter.source === 'recurring') {
    const rel = state.relationships[encounter.charId];
    rel.points = Math.max(0, rel.points + result.relationshipDelta);
    for (const flag of result.flagsGained) rel.flags[flag] = true;
  }
  for (const flag of result.flagsGained) state.storyFlags[flag] = true;
  if (result.mysteryPoint) state.nightStats.storyEvents.push(`${encounter.name}: a piece of the mystery falls into place.`);

  if (encounter.itemGivenToShop && result.tier.order >= 3) {
    state.inventory[encounter.itemGivenToShop] = (state.inventory[encounter.itemGivenToShop] || 0) + 1;
    state.discoveredItems[encounter.itemGivenToShop] = true;
  }

  if (result.tier.order >= 3) {
    const hintTarget = encounter.hintsRecipe
      || (encounter.specialCraftHint && RECIPES.find(r => r.result === encounter.specialCraftHint)?.id);
    if (hintTarget) state.storyFlags[`hint_${hintTarget}`] = true;
  }

  bumpTotals(state, result.tier.id);
  markCompleted(state, encounter);
  advanceQueue(state);
  return result;
}

// Politely declining to sell anything this visit — a real option, not a failure state.
export function applyRefusal(state, encounter) {
  state.reputation = Math.max(0, Math.min(100, state.reputation - 1));
  state.nightStats.reputationDelta -= 1;
  if (encounter.source === 'recurring') {
    state.relationships[encounter.charId].points = Math.max(0, state.relationships[encounter.charId].points - 1);
  }
  bumpTotals(state, 'REFUSED');
  markCompleted(state, encounter);
  advanceQueue(state);
}

// Applies an unconditional gift the customer hands over at the start of the encounter (e.g. Mrs. Pell's key).
export function applyStoryGift(state, encounter) {
  if (!encounter.storyItem?.give) return;
  state.inventory[encounter.storyItem.give] = (state.inventory[encounter.storyItem.give] || 0) + 1;
  state.discoveredItems[encounter.storyItem.give] = true;
  if (saveFn) saveFn();
}

export function applyGift(state, encounter) {
  // No-cost story beats: gifts to the shop, sell-to-shop, and companion (no item needed) encounters.
  if (encounter.storyItem?.give) {
    state.inventory[encounter.storyItem.give] = (state.inventory[encounter.storyItem.give] || 0) + 1;
    state.discoveredItems[encounter.storyItem.give] = true;
  }
  if (encounter.onGood?.flag) state.storyFlags[encounter.onGood.flag] = true;
  if (encounter.onGood?.mysteryPoint) state.nightStats.storyEvents.push(`${encounter.name}: a piece of the mystery falls into place.`);
  if (encounter.source === 'recurring') {
    const rel = state.relationships[encounter.charId];
    rel.points += encounter.onGood?.relationship || 2;
    if (encounter.onGood?.flag) rel.flags[encounter.onGood.flag] = true;
  }
  if (encounter.onGood?.reputationBonus) state.reputation = Math.min(100, state.reputation + encounter.onGood.reputationBonus);
  bumpTotals(state, 'PERFECT');
  markCompleted(state, encounter);
  advanceQueue(state);
}

export function applySellToShop(state, encounter, accept) {
  if (accept) {
    const result = resolveSellToShop(ITEMS[encounter.sellItem], encounter.sellPrice);
    state.money = Math.max(0, state.money + result.moneyDelta);
    state.inventory[result.itemGained] = (state.inventory[result.itemGained] || 0) + 1;
    state.discoveredItems[result.itemGained] = true;
  }
  markCompleted(state, encounter);
  advanceQueue(state);
}

function advanceQueue(state) {
  state.time += nextTimeStep(state.queueIndex);
  state.queueIndex += 1;
  Game_save(state);
}

let saveFn = null;
export function registerAutosave(fn) { saveFn = fn; }
function Game_save(state) { if (saveFn) saveFn(); }

export function finishNight(state) {
  state.nightPhase = 'SUMMARY';
  if (saveFn) saveFn();
}

export function goToSupplier(state) {
  state.nightPhase = 'SUPPLIER';
  if (saveFn) saveFn();
}

export function buyItem(state, itemId, cost, qty = 1) {
  const mods = getModifiers(state);
  if (state.money < cost * qty) return { ok: false, reason: 'money' };
  if (inventoryTotal(state.inventory) + qty > mods.capacity) return { ok: false, reason: 'capacity' };
  state.money -= cost * qty;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
  if (saveFn) saveFn();
  return { ok: true };
}

export function buyMysteryCrate(state, crate) {
  if (state.money < crate.cost) return { ok: false, reason: 'money' };
  const mods = getModifiers(state);
  if (inventoryTotal(state.inventory) + crate.ids.length > mods.capacity) return { ok: false, reason: 'capacity' };
  state.money -= crate.cost;
  for (const id of crate.ids) state.inventory[id] = (state.inventory[id] || 0) + 1;
  if (saveFn) saveFn();
  return { ok: true };
}

export function purchaseUpgrade(state, upgradeId, def) {
  const current = state.upgrades[upgradeId] || 0;
  const next = def.levels[current];
  if (!next) return { ok: false, reason: 'maxed' };
  if (state.money < next.cost) return { ok: false, reason: 'money' };
  state.money -= next.cost;
  state.upgrades[upgradeId] = current + 1;
  if (saveFn) saveFn();
  return { ok: true, level: current + 1, note: next.note };
}

export function advanceToNextNight(state) {
  if (state.night >= NIGHTS.length - 1) {
    state.gameEnded = true;
    state.endingId = determineEnding(state).id;
    state.nightPhase = 'ENDED';
  } else {
    state.night += 1;
    state.nightPhase = 'INTRO';
  }
  if (saveFn) saveFn();
}
