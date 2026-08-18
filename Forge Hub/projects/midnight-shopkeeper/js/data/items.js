// Item catalogue for Midnight Shopkeeper.
// Tags describe what a request an item can plausibly answer — the deduction backbone of the game.
// rarity: common | uncommon | rare | legendary
// crafted: true if only obtainable via recipe (not purchasable from suppliers)

export const ITEMS = {

  moonflower_sachet: {
    id: 'moonflower_sachet', name: 'Moonflower Sachet', category: 'HERBS',
    desc: 'A pale cloth bundle smelling faintly of rain. Tuck it under a pillow and the noisiest dreams learn to whisper.',
    tags: ['sleep', 'calm', 'dreams'], cost: 4, value: 9, rarity: 'common', icon: 'sachet',
  },
  quiet_bell: {
    id: 'quiet_bell', name: 'Quiet Bell', category: 'CURIOS',
    desc: 'It rings only when nobody is listening. Hang it by a door you don’t quite trust.',
    tags: ['warning', 'spirits', 'protection', 'listening'], cost: 6, value: 14, rarity: 'uncommon', icon: 'bell',
  },
  ember_bottle: {
    id: 'ember_bottle', name: 'Ember Bottle', category: 'LIGHTS',
    desc: 'A warm light trapped in dark glass. Travelers say carrying one makes dark roads feel shorter.',
    tags: ['light', 'warmth', 'courage', 'travel'], cost: 5, value: 11, rarity: 'common', icon: 'bottle_light',
  },
  brass_compass: {
    id: 'brass_compass', name: 'Brass Compass', category: 'TOOLS',
    desc: 'Its needle points toward something the owner misses. Rarely, but not never, this happens to be north.',
    tags: ['travel', 'memory', 'direction', 'longing'], cost: 8, value: 18, rarity: 'uncommon', icon: 'compass',
  },
  dream_tea: {
    id: 'dream_tea', name: 'Dream Tea', category: 'TONICS',
    desc: 'Steep it at midnight. Drink it slow. What you forget by morning, you were meant to forget.',
    tags: ['sleep', 'calm', 'dreams', 'forgetting'], cost: 3, value: 8, rarity: 'common', icon: 'tea',
  },
  red_thread: {
    id: 'red_thread', name: 'Red Thread', category: 'TOOLS',
    desc: 'Tie it around two wrists, two doorknobs, or two ideas that refuse to stay apart.',
    tags: ['binding', 'connection', 'luck', 'promise'], cost: 3, value: 7, rarity: 'common', icon: 'thread',
  },
  mourning_locket: {
    id: 'mourning_locket', name: 'Mourning Locket', category: 'MEMORIES',
    desc: 'Empty until you put someone in it. Then it is never quite empty again.',
    tags: ['grief', 'memory', 'remembrance', 'love'], cost: 10, value: 22, rarity: 'uncommon', icon: 'locket',
  },
  salt_twist: {
    id: 'salt_twist', name: 'Salt in a Twist of Paper', category: 'PROTECTION',
    desc: 'Cheap, plain, and it works. Pour a line across a threshold and see what refuses to cross it.',
    tags: ['protection', 'ward', 'boundary'], cost: 1, value: 3, rarity: 'common', icon: 'salt',
  },
  old_umbrella: {
    id: 'old_umbrella', name: 'Second-Hand Umbrella', category: 'TOOLS',
    desc: 'Slightly bent. Keeps off the rain and, its previous owner swore, bad luck as well.',
    tags: ['practical', 'travel', 'shelter', 'luck'], cost: 4, value: 9, rarity: 'common', icon: 'umbrella',
  },
  ledger_debts: {
    id: 'ledger_debts', name: 'Ledger of Small Debts', category: 'BOOKS',
    desc: 'A stranger’s account book. Every page is someone owing someone something. Reading it feels like eavesdropping.',
    tags: ['memory', 'obligation', 'record', 'knowledge'], cost: 6, value: 13, rarity: 'uncommon', icon: 'book',
  },
  jarred_quiet: {
    id: 'jarred_quiet', name: 'Jarred Quiet', category: 'ODDITIES',
    desc: 'Unscrew the lid partway and the noise in the room goes with it. Screw it shut and the quiet stays put.',
    tags: ['silence', 'calm', 'sleep', 'peace'], cost: 7, value: 16, rarity: 'uncommon', icon: 'jar',
  },
  ember_root_candle: {
    id: 'ember_root_candle', name: 'Ember-Root Candle', category: 'LIGHTS',
    desc: 'Burns orange-red and smells like a kitchen that isn’t there anymore.',
    tags: ['light', 'warmth', 'comfort', 'memory', 'home'], cost: 4, value: 9, rarity: 'common', icon: 'candle',
  },
  wolvesbane_sprig: {
    id: 'wolvesbane_sprig', name: 'Wolvesbane Sprig', category: 'HERBS',
    desc: 'Traditionally kept by door frames. What it wards off has never been confirmed. Nobody’s eager to test it.',
    tags: ['protection', 'ward', 'danger', 'courage'], cost: 5, value: 11, rarity: 'common', icon: 'sprig',
  },
  tin_whistle: {
    id: 'tin_whistle', name: 'Tin Whistle, Never Played', category: 'TOOLS',
    desc: 'Owned, evidently, but untouched. Some instruments wait for the right mouth.',
    tags: ['music', 'inspiration', 'voice', 'calling'], cost: 6, value: 12, rarity: 'uncommon', icon: 'whistle',
  },
  bottled_static: {
    id: 'bottled_static', name: 'Bottled Static', category: 'CURIOS',
    desc: 'A jar that hums faintly during storms. Useful for people who need a little noise to feel brave.',
    tags: ['energy', 'courage', 'storm', 'protection'], cost: 7, value: 15, rarity: 'uncommon', icon: 'jar_energy',
  },
  widows_veil: {
    id: 'widows_veil', name: 'Grey Veil', category: 'ODDITIES',
    desc: 'Worn to keep the world blurry for a while. Some griefs need softening before they need clarity.',
    tags: ['grief', 'hiding', 'memory', 'distance'], cost: 8, value: 17, rarity: 'uncommon', icon: 'veil',
  },
  second_sight_spectacles: {
    id: 'second_sight_spectacles', name: 'Second Sight Spectacles', category: 'TOOLS',
    desc: 'Ordinary glass, extraordinary claims. Some customers swear they see what’s actually there instead of what they expect.',
    tags: ['clarity', 'truth', 'perception', 'knowledge'], cost: 12, value: 26, rarity: 'rare', icon: 'spectacles',
  },
  nightcap_draught: {
    id: 'nightcap_draught', name: 'Nightcap Draught', category: 'TONICS',
    desc: 'One sip and the day loosens its grip. Two sips and so does the week.',
    tags: ['sleep', 'courage', 'calm', 'forgetting'], cost: 5, value: 10, rarity: 'common', icon: 'flask',
  },
  pressed_violet_letter: {
    id: 'pressed_violet_letter', name: 'Pressed Violet Letter', category: 'MEMORIES',
    desc: 'A letter nobody sent, folded around a flower nobody kept. The ink is real. The rest is up to you.',
    tags: ['memory', 'love', 'correspondence', 'longing'], cost: 7, value: 15, rarity: 'uncommon', icon: 'letter',
  },
  travelers_whetstone: {
    id: 'travelers_whetstone', name: 'Traveler’s Whetstone', category: 'TOOLS',
    desc: 'Sharpens knives, and, travelers insist, resolve.',
    tags: ['practical', 'courage', 'protection', 'journey'], cost: 4, value: 9, rarity: 'common', icon: 'whetstone',
  },
  jackdaw_quill: {
    id: 'jackdaw_quill', name: 'Jackdaw Feather Quill', category: 'TOOLS',
    desc: 'Writes faster than the hand holding it. Occasionally writes things the hand didn’t mean.',
    tags: ['writing', 'cleverness', 'knowledge', 'cunning'], cost: 9, value: 19, rarity: 'uncommon', icon: 'quill',
  },
  book_half_names: {
    id: 'book_half_names', name: 'Book of Half-Remembered Names', category: 'BOOKS',
    desc: 'A ledger of names with no faces attached. People come looking for their own, and some find it.',
    tags: ['memory', 'identity', 'names', 'grief'], cost: 9, value: 20, rarity: 'rare', icon: 'book2',
  },
  coin_nowhere: {
    id: 'coin_nowhere', name: 'Coin From Nowhere', category: 'ODDITIES',
    desc: 'Doesn’t match any currency anyone recognizes. Spends fine anyway. Nobody asks where it came from twice.',
    tags: ['luck', 'mystery', 'value', 'risk'], cost: 6, value: 14, rarity: 'uncommon', icon: 'coin',
  },
  sootglass_mirror: {
    id: 'sootglass_mirror', name: 'Sootglass Mirror', category: 'ODDITIES',
    desc: 'Fogged black glass. Look long enough and it shows you something true. Repeated use is not recommended.',
    tags: ['memory', 'truth', 'secrets', 'risk'], cost: 11, value: 24, rarity: 'rare', icon: 'mirror', risky: true,
  },
  hearthstone_charm: {
    id: 'hearthstone_charm', name: 'Hearthstone Charm', category: 'CHARMS',
    desc: 'A smooth stone that stays warm no matter how cold the pocket. Carried by people a long way from home.',
    tags: ['home', 'comfort', 'warmth', 'belonging'], cost: 5, value: 11, rarity: 'common', icon: 'stone',
  },
  dried_bellflower: {
    id: 'dried_bellflower', name: 'Bundle of Dried Bellflower', category: 'HERBS',
    desc: 'Chew a petal before speaking somewhere frightening. Doesn’t grant courage. Reminds you where you already had some.',
    tags: ['courage', 'voice', 'confidence'], cost: 3, value: 7, rarity: 'common', icon: 'flower',
  },
  cracked_music_box: {
    id: 'cracked_music_box', name: 'Cracked Music Box', category: 'CURIOS',
    desc: 'Plays half a melody and stops. Nobody has ever heard the other half, including, lately, its owner.',
    tags: ['music', 'memory', 'inspiration', 'nostalgia'], cost: 10, value: 21, rarity: 'rare', icon: 'musicbox',
  },
  iron_key_no_door: {
    id: 'iron_key_no_door', name: 'Iron Key to No Known Door', category: 'ODDITIES',
    desc: 'Too plain to be decorative, too old to fit anything currently standing. Keeps trying anyway.',
    tags: ['mystery', 'protection', 'unlocking', 'secrets'], cost: 8, value: 17, rarity: 'rare', icon: 'key',
  },
  vial_borrowed_courage: {
    id: 'vial_borrowed_courage', name: 'Vial of Borrowed Courage', category: 'TONICS',
    desc: 'Tastes like copper and rain. Effects are temporary. So, most nights, is the need for it.',
    tags: ['courage', 'boldness', 'protection', 'risk'], cost: 6, value: 13, rarity: 'uncommon', icon: 'vial',
  },
  recipe_card_broth: {
    id: 'recipe_card_broth', name: 'Handwritten Recipe Card', category: 'MEMORIES',
    desc: 'Water-stained, corner torn. Whoever wrote it loved someone enough to make the instructions foolproof.',
    tags: ['home', 'comfort', 'memory', 'nourishment'], cost: 2, value: 6, rarity: 'common', icon: 'card',
  },

  // --- Crafted items (recipe outputs only) ---
  dream_ward: {
    id: 'dream_ward', name: 'Dream Ward', category: 'PROTECTION',
    desc: 'Hung above a bed, it keeps the wrong dreams from finding the door.',
    tags: ['sleep', 'protection', 'dreams', 'calm'], cost: 0, value: 28, rarity: 'rare', icon: 'ward', crafted: true,
  },
  guiding_lantern: {
    id: 'guiding_lantern', name: 'Guiding Lantern', category: 'LIGHTS',
    desc: 'Never goes out in wind or rain. Points, gently, toward wherever the carrier needs to go next.',
    tags: ['light', 'direction', 'courage', 'travel'], cost: 0, value: 32, rarity: 'rare', icon: 'lantern', crafted: true,
  },
  threshold_seal: {
    id: 'threshold_seal', name: 'Threshold Seal', category: 'PROTECTION',
    desc: 'A stronger ward than salt alone. Whatever it stops, it stops for good.',
    tags: ['protection', 'ward', 'boundary', 'danger'], cost: 0, value: 24, rarity: 'rare', icon: 'seal', crafted: true,
  },
  steeped_memory: {
    id: 'steeped_memory', name: 'Steeped Memory', category: 'MEMORIES',
    desc: 'Dream Tea brewed with a letter no one sent. What you remember, you remember gently.',
    tags: ['memory', 'grief', 'comfort', 'love'], cost: 0, value: 30, rarity: 'rare', icon: 'teacup', crafted: true,
  },
  storm_struck_nerve: {
    id: 'storm_struck_nerve', name: 'Storm-Struck Nerve', category: 'TONICS',
    desc: 'Bottled thunder and borrowed nerve, mixed. Not recommended before difficult conversations. Recommended anyway.',
    tags: ['courage', 'boldness', 'storm', 'protection'], cost: 0, value: 26, rarity: 'rare', icon: 'vial_storm', crafted: true,
  },
  second_melody: {
    id: 'second_melody', name: 'Second Melody', category: 'CURIOS',
    desc: 'The other half of the tune the music box never finished. Nobody knows how the whistle remembered it.',
    tags: ['music', 'inspiration', 'voice', 'nostalgia'], cost: 0, value: 34, rarity: 'legendary', icon: 'musicbox2', crafted: true,
  },
  clear_ink: {
    id: 'clear_ink', name: 'Clear Ink', category: 'BOOKS',
    desc: 'Written with it, a lie won’t dry. Scholars pay well and ask no further questions.',
    tags: ['truth', 'knowledge', 'clarity', 'writing'], cost: 0, value: 30, rarity: 'legendary', icon: 'ink', crafted: true,
  },
  ember_hearth_charm: {
    id: 'ember_hearth_charm', name: 'Ember Hearth Charm', category: 'CHARMS',
    desc: 'Warmer than the sum of its parts. Carried by people who found out home is a thing you can build twice.',
    tags: ['home', 'comfort', 'warmth', 'belonging', 'courage'], cost: 0, value: 30, rarity: 'rare', icon: 'stone2', crafted: true,
  },
};

export const ITEM_LIST = Object.values(ITEMS);
