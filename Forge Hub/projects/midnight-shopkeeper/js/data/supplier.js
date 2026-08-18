import { ITEMS } from './items.js';

// Deterministic per-night supplier offerings so restocking always feels intentional, not random noise.
const COMMON_POOL = ['moonflower_sachet', 'ember_bottle', 'dream_tea', 'red_thread', 'salt_twist', 'old_umbrella',
  'ember_root_candle', 'wolvesbane_sprig', 'nightcap_draught', 'travelers_whetstone', 'dried_bellflower', 'recipe_card_broth', 'hearthstone_charm'];
const UNCOMMON_POOL = ['quiet_bell', 'brass_compass', 'mourning_locket', 'ledger_debts', 'jarred_quiet', 'tin_whistle',
  'bottled_static', 'widows_veil', 'pressed_violet_letter', 'coin_nowhere', 'vial_borrowed_courage'];
const RARE_POOL = ['second_sight_spectacles', 'book_half_names', 'sootglass_mirror', 'cracked_music_box', 'jackdaw_quill', 'iron_key_no_door'];

// Special orders foreshadow upcoming story needs — buying ahead is a real, rewarded decision.
const SPECIAL_ORDERS = {
  2: { item: 'second_sight_spectacles', cost: 20, note: 'A traveling optician passed through and left one pair behind. Someone researching things that don\'t want to be found might value this.' },
  4: { item: 'jackdaw_quill', cost: 16, note: 'Plucked, the seller swears, from a jackdaw that watched him write three letters before he\'d finished thinking them. A scholar might have use for it.' },
  6: { item: 'cracked_music_box', cost: 18, note: 'Found in an estate sale, still faintly humming when shaken. A musician missing something might recognize the tune.' },
  7: { item: 'iron_key_no_door', cost: 14, note: 'Another one like it turned up at the scrapyard. Whatever it belongs to, it apparently needed more than one key.' },
};

function seededPick(pool, seed, count) {
  const arr = [...pool];
  const out = [];
  let s = seed;
  for (let i = 0; i < count && arr.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    const idx = Math.floor((s / 233280) * arr.length);
    out.push(arr.splice(idx, 1)[0]);
  }
  return out;
}

export function getSupplierOffer(night, eventId) {
  const common = COMMON_POOL.map(id => ({ id, cost: ITEMS[id].cost, tier: 'COMMON' }));
  let rareCount = eventId === 'MARKET_NIGHT' ? 4 : 3;
  const rareIds = seededPick([...UNCOMMON_POOL, ...RARE_POOL], night * 17 + 3, rareCount);
  const rare = rareIds.map(id => ({ id, cost: Math.round(ITEMS[id].cost * (eventId === 'MARKET_NIGHT' ? 0.85 : 1)), tier: 'RARE' }));

  const crateIds = seededPick(COMMON_POOL.concat(UNCOMMON_POOL), night * 31 + 11, 3);
  const crateCost = Math.round(crateIds.reduce((s, id) => s + ITEMS[id].cost, 0) * 0.7);
  const mysteryCrate = { ids: crateIds, cost: Math.max(6, crateCost), tier: 'MYSTERY_CRATE' };

  const special = SPECIAL_ORDERS[night] ? { ...SPECIAL_ORDERS[night], tier: 'SPECIAL_ORDER' } : null;

  return { common, rare, mysteryCrate, special };
}
