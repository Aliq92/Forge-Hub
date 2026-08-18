import { loadSave, writeSave, clearSave, hasSave as hasSaveRaw, loadSettings, writeSettings } from './storage.js';
import { RECIPES } from './data/recipes.js';

const SAVE_VERSION = 2;
const RECURRING_IDS = ['rin', 'sael', 'mrs_pell', 'fenn', 'moth', 'ashe'];

const STARTER_COMMON = ['moonflower_sachet', 'ember_bottle', 'dream_tea', 'red_thread', 'salt_twist', 'old_umbrella',
  'ember_root_candle', 'wolvesbane_sprig', 'nightcap_draught', 'travelers_whetstone', 'dried_bellflower', 'recipe_card_broth', 'hearthstone_charm'];
const STARTER_UNCOMMON = ['quiet_bell', 'brass_compass', 'mourning_locket', 'ledger_debts', 'jarred_quiet', 'tin_whistle',
  'bottled_static', 'widows_veil', 'pressed_violet_letter', 'coin_nowhere', 'vial_borrowed_courage'];

export const REPUTATION_TIERS = [
  { min: 0, id: 'UNKNOWN', label: 'Unknown' },
  { min: 20, id: 'TRUSTED', label: 'Trusted' },
  { min: 40, id: 'RESPECTED', label: 'Respected' },
  { min: 60, id: 'RENOWNED', label: 'Renowned' },
  { min: 80, id: 'LEGENDARY', label: 'Legendary' },
];

export const RELATIONSHIP_TIERS = [
  { min: 0, id: 'STRANGER', label: 'Stranger' },
  { min: 2, id: 'FAMILIAR', label: 'Familiar' },
  { min: 5, id: 'TRUSTING', label: 'Trusting' },
  { min: 8, id: 'FRIEND', label: 'Friend' },
  { min: 11, id: 'SECRET_REVEALED', label: 'Secret Revealed' },
];

export function reputationTier(value) {
  let cur = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) if (value >= t.min) cur = t;
  return cur;
}
export function relationshipTier(points) {
  let cur = RELATIONSHIP_TIERS[0];
  for (const t of RELATIONSHIP_TIERS) if (points >= t.min) cur = t;
  return cur;
}

function freshInventory() {
  const inv = {};
  for (const id of STARTER_COMMON) inv[id] = 3;
  for (const id of STARTER_UNCOMMON) inv[id] = 2;
  return inv;
}

function freshRelationships() {
  const r = {};
  for (const id of RECURRING_IDS) r[id] = { points: 0, flags: {} };
  return r;
}

export function freshNightStats() {
  return {
    customersServed: 0, perfect: 0, good: 0, acceptable: 0, poor: 0, refused: 0,
    moneyEarned: 0, tips: 0, itemsSold: 0, reputationDelta: 0, recipesDiscovered: [], storyEvents: [],
  };
}

export function defaultState() {
  return {
    version: SAVE_VERSION,
    keeperName: 'Keeper',
    night: 1,
    money: 42,
    reputation: 8,
    relationships: freshRelationships(),
    inventory: freshInventory(),
    discoveredItems: {}, // itemId -> true once tags are "confirmed" by a successful sale
    knownRecipes: RECIPES.filter(r => r.known).map(r => r.id),
    storyFlags: {},
    upgrades: {}, // id -> level (0-indexed count of levels purchased)
    rumors: [],
    completedOneoffs: [],
    completedRecurringTags: [],
    totals: { customersServed: 0, perfect: 0, good: 0, acceptable: 0, poor: 0, refused: 0, moneyEarned: 0, tips: 0, itemsSold: 0, recipesDiscovered: 0, rareItemsSold: 0 },
    nightStats: freshNightStats(),
    nightPhase: 'INTRO', // INTRO | SHOP | SUMMARY | SUPPLIER | ENDED
    currentQueue: [], // array of encounter descriptors for tonight
    queueIndex: 0,
    time: 0, // minutes after midnight
    gameEnded: false,
    endingId: null,
    seenHowToPlay: false,
  };
}

let state = null;
let settings = null;

export const Game = {
  get state() { return state; },
  get settings() { return settings; },

  newGame(keeperName) {
    state = defaultState();
    if (keeperName) state.keeperName = keeperName;
    settings = loadSettings();
    this.save();
    return state;
  },

  continueGame() {
    const loaded = loadSave();
    if (!loaded) return null;
    state = migrateState(loaded);
    settings = loadSettings();
    return state;
  },

  hasSave() { return hasSaveRaw(); },

  save() {
    if (!state) return;
    writeSave(state);
  },

  saveSettings() {
    writeSettings(settings);
  },

  eraseSave() {
    clearSave();
    state = null;
  },

  reputationTierNow() { return reputationTier(state.reputation); },
  relationshipTierFor(id) { return relationshipTier(state.relationships[id]?.points || 0); },
};

function migrateState(saved) {
  const fresh = defaultState();
  if (!saved.version || saved.version < SAVE_VERSION) {
    // Shallow-merge forward: keep whatever keys still make sense, fill in the rest with defaults.
    return { ...fresh, ...saved, version: SAVE_VERSION };
  }
  return { ...fresh, ...saved };
}

export function initSettingsOnly() {
  settings = loadSettings();
  return settings;
}
