// Combination recipes. `known: true` recipes are visible from the start; others must be discovered.
export const RECIPES = [
  {
    id: 'r_dream_ward', result: 'dream_ward',
    inputs: ['moonflower_sachet', 'quiet_bell'],
    known: true,
    hint: 'Something for sleep, and something that listens for what shouldn’t be there.',
  },
  {
    id: 'r_guiding_lantern', result: 'guiding_lantern',
    inputs: ['ember_bottle', 'red_thread'],
    known: true,
    hint: 'A light, and a thread to tell it which way to lean.',
  },
  {
    id: 'r_threshold_seal', result: 'threshold_seal',
    inputs: ['salt_twist', 'wolvesbane_sprig'],
    known: false,
    hint: 'Salt keeps most things out. Some things need more than salt.',
  },
  {
    id: 'r_steeped_memory', result: 'steeped_memory',
    inputs: ['dream_tea', 'pressed_violet_letter'],
    known: false,
    hint: 'A tea that softens memory, steeped with a letter that was never sent.',
  },
  {
    id: 'r_storm_struck_nerve', result: 'storm_struck_nerve',
    inputs: ['bottled_static', 'vial_borrowed_courage'],
    known: false,
    hint: 'Bottled thunder, and courage that was never really yours to begin with. Together they might be.',
  },
  {
    id: 'r_second_melody', result: 'second_melody',
    inputs: ['tin_whistle', 'cracked_music_box'],
    known: false,
    requiresUpgrade: 'workbench',
    hint: 'An instrument that has never been played, and a music box that never finishes its song.',
  },
  {
    id: 'r_clear_ink', result: 'clear_ink',
    inputs: ['second_sight_spectacles', 'jackdaw_quill'],
    known: false,
    requiresUpgrade: 'workbench',
    hint: 'A quill that writes what it isn’t told, and glasses that see what’s actually there.',
  },
  {
    id: 'r_ember_hearth_charm', result: 'ember_hearth_charm',
    inputs: ['hearthstone_charm', 'ember_root_candle'],
    known: false,
    hint: 'A stone that remembers being warm, and a candle that smells like somewhere gone.',
  },
];
