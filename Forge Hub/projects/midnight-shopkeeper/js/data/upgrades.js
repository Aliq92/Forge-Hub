// Shop upgrades. Each level has its own cost and effect; levels array index 0 = level 1.
export const UPGRADES = {
  shelves: {
    id: 'shelves', name: 'More Shelves', desc: 'More room to stock the shelves before the night starts.',
    levels: [
      { cost: 20, effect: { extraCapacity: 3 }, note: 'A second shelf, bracketed in above the first.' },
      { cost: 45, effect: { extraCapacity: 4 }, note: 'Shelving climbs almost to the ceiling now.' },
      { cost: 80, effect: { extraCapacity: 5 }, note: 'Every wall that can hold a shelf, does.' },
    ],
  },
  lanterns: {
    id: 'lanterns', name: 'Better Lanterns', desc: 'Warmer light draws warmer custom.',
    levels: [
      { cost: 18, effect: { reputationGainMult: 1.1 }, note: 'New glass shades soften the light to amber.' },
      { cost: 40, effect: { reputationGainMult: 1.2 }, note: 'Brass fittings replace the old tin ones. The whole shop looks a little more like it means to stay.' },
    ],
  },
  workbench: {
    id: 'workbench', name: 'Workbench', desc: 'A proper table for combining stranger things.',
    levels: [
      { cost: 25, effect: { unlockAdvancedRecipes: true }, note: 'A sturdy table, scarred already from someone else\'s work.' },
      { cost: 55, effect: { freeCombine: true }, note: 'Well-worn tools hang above it now. Combining items costs nothing but time.' },
    ],
  },
  ledger: {
    id: 'ledger', name: 'Ledger', desc: 'A proper accounting book. Sharper instincts about what a customer can pay.',
    levels: [
      { cost: 15, effect: { showBudgetHint: true }, note: 'Its first pages are already full of your own handwriting.' },
      { cost: 35, effect: { showToleranceHint: true }, note: 'You\'ve started noting which customers forgive a wrong guess, and which don\'t.' },
    ],
  },
  display_case: {
    id: 'display_case', name: 'Display Case', desc: 'A case worthy of the shop\'s rarer stock.',
    levels: [
      { cost: 30, effect: { rareValueMult: 1.15 }, note: 'Glass-fronted, brass-hinged. Rare items look rarer behind it.' },
      { cost: 60, effect: { rareValueMult: 1.3 }, note: 'A small lock, a velvet backing. Customers linger at it without meaning to.' },
    ],
  },
  tea_corner: {
    id: 'tea_corner', name: 'Tea Corner', desc: 'Somewhere for a nervous customer to sit before they talk.',
    levels: [
      { cost: 16, effect: { extraFollowup: 1 }, note: 'A kettle, two mismatched cups, a stool.' },
      { cost: 38, effect: { extraFollowup: 2 }, note: 'Customers now linger long enough to say what they actually mean.' },
    ],
  },
  storeroom: {
    id: 'storeroom', name: 'Storeroom', desc: 'More space out back means the supplier brings more to choose from.',
    levels: [
      { cost: 28, effect: { extraRareSlot: 1 }, note: 'A door, a shelf, a little more room than the shop strictly needs — for now.' },
    ],
  },
};

export const UPGRADE_LIST = Object.values(UPGRADES);
