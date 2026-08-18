// Night-by-night campaign script. Each entry lists the customer roster in order.
// roster entries: { type:'recurring', char:'rin', tag:'rin_1' } or { type:'oneoff', id:'elenor' }
export const NIGHTS = [
  null, // 1-indexed
  { // Night 1
    n: 1, title: 'First Night', intro: 'Rain on the window. A single lantern lit. The shop has been yours for exactly one day.',
    tutorial: true,
    roster: [
      { type: 'recurring', char: 'rin', tag: 'rin_1' },
      { type: 'oneoff', id: 'elenor' },
      { type: 'oneoff', id: 'thom' },
      { type: 'recurring', char: 'mrs_pell', tag: 'pell_1' },
      { type: 'oneoff', id: 'damp_stranger' },
    ],
    event: null,
  },
  { // Night 2
    n: 2, title: 'Second Night', intro: 'The rain has softened to a drizzle. Word of the shop is starting to travel, in the way word does.',
    roster: [
      { type: 'oneoff', id: 'corin' },
      { type: 'oneoff', id: 'anne_callow' },
      { type: 'recurring', char: 'sael', tag: 'sael_1' },
      { type: 'recurring', char: 'fenn', tag: 'fenn_1' },
      { type: 'recurring', char: 'ashe', tag: 'ashe_1' },
    ],
    event: null,
  },
  { // Night 3
    n: 3, title: 'Third Night', intro: 'Fog gathers low along the street. Tonight feels like the shop is paying closer attention than usual.',
    roster: [
      { type: 'recurring', char: 'moth', tag: 'moth_1' },
      { type: 'oneoff', id: 'innkeeper' },
      { type: 'oneoff', id: 'bell_apprentice' },
      { type: 'recurring', char: 'rin', tag: 'rin_2' },
      { type: 'recurring', char: 'mrs_pell', tag: 'pell_2' },
    ],
    event: null,
    unlockCombos: true,
  },
  { // Night 4
    n: 4, title: 'Fourth Night', intro: 'Thunder somewhere over the hills. The rain is coming down harder tonight than it has all week.',
    roster: [
      { type: 'recurring', char: 'sael', tag: 'sael_2' },
      { type: 'recurring', char: 'fenn', tag: 'fenn_2' },
      { type: 'oneoff', id: 'mirembe' },
      { type: 'oneoff', id: 'errand_boy' },
    ],
    event: 'RAINSTORM',
  },
  { // Night 5
    n: 5, title: 'Fifth Night', intro: 'Music drifts in from the square — the town\'s harvest festival, three streets over, still going well past midnight.',
    roster: [
      { type: 'recurring', char: 'rin', tag: 'rin_3' },
      { type: 'recurring', char: 'moth', tag: 'moth_2' },
      { type: 'recurring', char: 'ashe', tag: 'ashe_2' },
      { type: 'oneoff', id: 'memorial_bellringer' },
      { type: 'oneoff', id: 'masked_reveler' },
    ],
    event: 'FESTIVAL',
  },
  { // Night 6
    n: 6, title: 'Sixth Night', intro: 'The fog tonight is thick enough to lean on. The street lamps look like they\'re underwater.',
    roster: [
      { type: 'recurring', char: 'mrs_pell', tag: 'pell_3' },
      { type: 'recurring', char: 'sael', tag: 'sael_3' },
      { type: 'oneoff', id: 'locksmith_widow' },
      { type: 'oneoff', id: 'watchman' },
    ],
    event: 'FOG_NIGHT',
  },
  { // Night 7
    n: 7, title: 'Seventh Night', intro: 'The lanterns gutter twice for no reason anyone can name. It\'s that kind of night.',
    roster: [
      { type: 'recurring', char: 'fenn', tag: 'fenn_3' },
      { type: 'recurring', char: 'moth', tag: 'moth_3' },
      { type: 'recurring', char: 'ashe', tag: 'ashe_3' },
      { type: 'oneoff', id: 'sisters' },
      { type: 'oneoff', id: 'sailor' },
    ],
    event: 'BLACKOUT',
  },
  { // Night 8
    n: 8, title: 'Final Night', intro: 'Everyone you know seems to be finding a reason to visit tonight. The shop feels wide awake.',
    roster: [
      { type: 'oneoff', id: 'newcomer' },
      { type: 'recurring', char: 'rin', tag: 'rin_4' },
      { type: 'recurring', char: 'fenn', tag: 'fenn_4' },
      { type: 'recurring', char: 'sael', tag: 'sael_4' },
      { type: 'recurring', char: 'ashe', tag: 'ashe_4' },
      { type: 'recurring', char: 'mrs_pell', tag: 'pell_4' },
      { type: 'recurring', char: 'moth', tag: 'moth_4' },
    ],
    event: 'MARKET_NIGHT',
    finale: true,
  },
];

export const EVENTS = {
  RAINSTORM: { name: 'Rainstorm', desc: 'Heavier rain tonight. More travelers seek shelter under your sign than usual.', banner: 'Rain hammers the windows. The street is empty except for the ones who need somewhere dry.' },
  FESTIVAL: { name: 'Festival Night', desc: 'The harvest festival has spilled into the streets. Rare and impressive items sell for more tonight.', banner: 'Distant music and lantern-light drift in from the square. Festival-goers are in a spending mood.', rareValueBonus: 0.2 },
  FOG_NIGHT: { name: 'Fog Night', desc: 'Thick fog outside brings out the stranger sort of customer.', banner: 'The fog outside is thick enough to swallow the street lamps whole. Anything could be standing just past the glass.' },
  BLACKOUT: { name: 'Flickering Lanterns', desc: 'The shop\'s lighting keeps faltering. Customers are a little more on edge tonight.', banner: 'The lanterns gutter, dim, and steady again. The shadows in the corners seem to hold their shape a moment too long.' },
  MARKET_NIGHT: { name: 'Market Night', desc: 'The supplier is offering unusual stock tonight.', banner: 'A different supplier\'s cart rattles up outside — one you haven\'t seen before, piled higher than usual.' },
};
