import { ITEMS } from '../data/items.js';
import { evaluateItem, evaluateCombo, priceAdjustedTier, TIERS } from './matching.js';

export const PRICE_CHOICES = {
  CHEAP: { id: 'CHEAP', label: 'Cheap', mult: 0.7 },
  FAIR: { id: 'FAIR', label: 'Fair Price', mult: 1.0 },
  EXPENSIVE: { id: 'EXPENSIVE', label: 'Expensive', mult: 1.45 },
};

const GENERIC_REACTIONS = {
  GOOD: [
    (n, it) => `${n} nods, satisfied. "${it}? Yes — that should do it." They seem genuinely pleased.`,
    (n, it) => `${n} turns the ${it} over once, then tucks it away. "This'll work. Thank you."`,
    (n, it) => `A small, relieved smile. "The ${it}. That's a good thought. I hadn't considered it."`,
  ],
  ACCEPTABLE: [
    (n, it) => `${n} hesitates, then accepts the ${it}. "...It's not quite what I pictured. But it might help."`,
    (n, it) => `"The ${it}, hm." A pause. "It's not wrong, exactly. I'll try it."`,
    (n, it) => `${n} takes the ${it} without much enthusiasm. "Better than nothing, I suppose."`,
  ],
  POOR: [
    (n, it) => `${n} frowns at the ${it}. "I... don't see how this helps, but if you say so." They take it, unconvinced.`,
    (n, it) => `"The ${it}?" ${n} sounds doubtful. "That's not really what I meant. But — alright."`,
    (n, it) => `${n} accepts the ${it} with visible reluctance, clearly expecting it not to work.`,
  ],
  REFUSED: [
    (n, it) => `${n} shakes their head firmly. "No. That's really not what I need." They step back from the counter.`,
    (n, it) => `"The ${it}?" ${n} looks almost offended. "Did you hear anything I said?"`,
  ],
};

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

export function computePrice(item, priceChoice, modifiers = {}) {
  let value = item.value;
  if ((item.rarity === 'rare' || item.rarity === 'legendary')) {
    value *= modifiers.rareValueMult || 1;
    value *= 1 + (modifiers.rareEventBonus || 0);
  }
  const mult = PRICE_CHOICES[priceChoice]?.mult ?? 1;
  return Math.max(1, Math.round(value * mult));
}

// Resolves a sale attempt. `encounter` is the live encounter instance, `item` the chosen inventory item
// (or { itemA, itemB } for a combo offer). Returns a rich result the UI/state layer can apply.
export function resolveSale({ item, comboItem, encounter, priceChoice, modifiers = {}, reactionSeed = 0 }) {
  const evalResult = comboItem ? evaluateCombo(item, comboItem, encounter) : evaluateItem(item, encounter);
  const price = computePrice(item, priceChoice, modifiers);
  const tier = priceAdjustedTier(evalResult.tier, priceChoice, encounter.budget, price);

  const isSale = tier.order > 0; // REFUSED = no sale
  let tip = 0;
  if (isSale && tier.id === 'PERFECT' && priceChoice !== 'EXPENSIVE') tip = Math.round(price * (0.15 + Math.random() * 0.2));
  if (isSale && tier.id === 'GOOD' && priceChoice === 'CHEAP') tip = Math.round(price * 0.1);

  const repByTier = { PERFECT: 3, GOOD: 1, ACCEPTABLE: 0, POOR: -1, REFUSED: -2 };
  let reputationDelta = repByTier[tier.id] ?? 0;
  if (reputationDelta > 0) reputationDelta = Math.round(reputationDelta * (modifiers.reputationGainMult || 1));

  const relByTier = { PERFECT: 3, GOOD: 2, ACCEPTABLE: 0, POOR: -1, REFUSED: -1 };
  let relationshipDelta = relByTier[tier.id] ?? 0;

  let reactionText;
  let flagsGained = [];
  let mysteryPoint = false;
  let storyReputationBonus = 0;

  if (tier.id === 'REFUSED' && evalResult.avoidLine) {
    reactionText = evalResult.avoidLine;
  } else if ((tier.id === 'PERFECT') && encounter.reactions?.perfect) {
    reactionText = pick(encounter.reactions.perfect, reactionSeed);
  } else if (tier.id === 'REFUSED' && encounter.reactions?.refused) {
    reactionText = pick(encounter.reactions.refused, reactionSeed);
  } else {
    reactionText = pick(GENERIC_REACTIONS[tier.id] || GENERIC_REACTIONS.ACCEPTABLE, reactionSeed)(encounter.name, item.name);
  }

  const goodEnough = tier.order >= 3; // GOOD or PERFECT
  if (goodEnough && encounter.onGood) {
    if (encounter.onGood.flag) flagsGained.push(encounter.onGood.flag);
    if (encounter.onGood.mysteryPoint) mysteryPoint = true;
    if (encounter.onGood.reputationBonus) storyReputationBonus = encounter.onGood.reputationBonus;
  }

  return {
    tier, price, tip, isSale, reputationDelta: reputationDelta + storyReputationBonus, relationshipDelta,
    reactionText, flagsGained, mysteryPoint,
    moneyDelta: isSale ? (price + tip) : 0,
  };
}

export function resolveSellToShop(item, price) {
  return { moneyDelta: -price, itemGained: item.id };
}
