import { ITEMS } from '../data/items.js';

export const TIERS = {
  PERFECT: { id: 'PERFECT', label: 'Perfect Match', order: 4 },
  GOOD: { id: 'GOOD', label: 'Good Match', order: 3 },
  ACCEPTABLE: { id: 'ACCEPTABLE', label: 'Acceptable', order: 2 },
  POOR: { id: 'POOR', label: 'Poor Match', order: 1 },
  REFUSED: { id: 'REFUSED', label: 'Refused', order: 0 },
};

// Evaluate how well `item` answers `encounter`'s request. Returns { tier, desiredOverlap, goodOverlap, avoidLine }
export function evaluateItem(item, encounter) {
  const desired = encounter.desiredTags || [];
  const good = encounter.goodTags || [];

  if (encounter.avoidItems && encounter.avoidItems[item.id]) {
    return { tier: TIERS.REFUSED, desiredOverlap: 0, goodOverlap: 0, avoidLine: encounter.avoidItems[item.id] };
  }

  const tags = item.tags || [];
  const desiredOverlap = tags.filter(t => desired.includes(t)).length;
  const goodOverlap = tags.filter(t => good.includes(t)).length;

  let tier;
  if (desired.length > 0 && desiredOverlap >= 2) tier = TIERS.PERFECT;
  else if (desired.length === 1 && desiredOverlap === 1) tier = TIERS.PERFECT;
  else if (desiredOverlap === 1) tier = TIERS.GOOD;
  else if (goodOverlap >= 2) tier = TIERS.GOOD;
  else if (goodOverlap === 1) tier = TIERS.ACCEPTABLE;
  else tier = TIERS.POOR;

  return { tier, desiredOverlap, goodOverlap, avoidLine: null };
}

// Combined items (an item plus a second item offered together) — used rarely, evaluates the pair's union of tags.
export function evaluateCombo(itemA, itemB, encounter) {
  const union = { ...itemA, tags: [...new Set([...(itemA.tags || []), ...(itemB.tags || [])])] };
  return evaluateItem(union, encounter);
}

export function priceAdjustedTier(baseTier, priceChoice, budget, price) {
  // Wildly overpricing a struggling customer can knock a tier down; fair/cheap never hurts.
  if (priceChoice !== 'EXPENSIVE') return baseTier;
  if (!budget || price <= budget * 1.4) return baseTier;
  const order = Math.max(0, baseTier.order - 1);
  return Object.values(TIERS).find(t => t.order === order) || TIERS.REFUSED;
}
