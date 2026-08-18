import { RECURRING } from '../data/customers_recurring.js';
import { ONEOFFS } from '../data/customers_oneoff.js';

function resolveField(field, flags) {
  return typeof field === 'function' ? field(flags) : field;
}

export function buildEncounter(rosterEntry, storyFlags) {
  if (rosterEntry.type === 'oneoff') {
    const c = ONEOFFS[rosterEntry.id];
    return {
      instanceId: `oneoff_${c.id}`,
      source: 'oneoff',
      charId: c.id,
      name: c.name,
      title: c.title,
      portrait: c.portrait,
      greeting: c.greeting,
      opening: resolveField(c.opening, storyFlags),
      request: resolveField(c.request, storyFlags),
      followups: c.followups || [],
      desiredTags: c.desiredTags || [],
      goodTags: c.goodTags || [],
      avoidItems: c.avoidItems || {},
      budget: c.budget || 10,
      reactions: c.reactions || {},
      isSellToShop: !!c.isSellToShop,
      sellItem: c.sellItem, sellPrice: c.sellPrice,
      isTeachingBeat: !!c.isTeachingBeat,
      isTrapBeat: !!c.isTrapBeat,
      pricingBeat: c.pricingBeat || null,
      hintsRecipe: c.hintsRecipe || null,
      onGood: null,
      noPayment: false,
    };
  }
  const char = RECURRING[rosterEntry.char];
  const app = char.appearances.find(a => a.tag === rosterEntry.tag);
  return {
    instanceId: `rec_${rosterEntry.char}_${rosterEntry.tag}`,
    source: 'recurring',
    charId: char.id,
    name: char.name,
    title: char.title,
    portrait: char.portrait,
    greeting: resolveField(app.greeting, storyFlags),
    opening: resolveField(app.opening, storyFlags),
    request: resolveField(app.request, storyFlags),
    followups: app.followups || [],
    desiredTags: app.desiredTags || [],
    goodTags: app.goodTags || [],
    avoidItems: app.avoidItems || {},
    budget: app.budget || 14,
    reactions: app.reactions || {},
    isGift: !!app.isGift, giftNote: app.giftNote,
    storyItem: app.storyItem || null,
    isCompanion: !!app.isCompanion,
    alwaysAccept: !!app.alwaysAccept,
    finalAppearance: !!app.finalAppearance,
    noPayment: !!app.noPayment,
    onGood: app.onGood || null,
    specialCraftHint: app.specialCraftHint || null,
    deliveryFlag: app.deliveryFlag || null,
    itemGivenToShop: app.onGood?.itemGivenToShop || null,
  };
}

export function buildNightQueue(nightDef, storyFlags) {
  return nightDef.roster.map(entry => buildEncounter(entry, storyFlags));
}
