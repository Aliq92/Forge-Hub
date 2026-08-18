// Ending definitions and the (deliberately unrevealed) logic that selects one after the final night.
export const ENDINGS = {
  HIDDEN_ROOM: {
    id: 'HIDDEN_ROOM', title: 'The Hidden Room',
    body: [
      'You are holding something when the back wall finally opens, because Moth told you to, and Moth has apparently done this before.',
      'The room behind it is small, warm, and unremarkable in almost every way — a desk, a lantern still lit after all this time, a second ledger with handwriting that isn\'t yours but starts, on its very last page, to look like it. There is no monster. There is no trapped keeper crying for rescue. There is only a person who stepped back to check on something and found the door, gently, quietly, closing behind them — and who has been keeping a shop from the other side ever since, in whatever way that\'s possible.',
      'You don\'t need to explain it to Mrs. Pell, or Ashe, or the others. Somehow, they already understand — they were the ones who helped you find it. You leave the lantern burning on both sides of the wall, and for the first time since you inherited this strange, cold-handled key, the shop feels like it has exactly as many rooms as it needs.',
    ],
    subtitle: 'The main mystery resolves. You are, in every sense that matters, the keeper now — of the shop, and of what\'s behind it.',
  },
  SHOP_REMAINS_OPEN: {
    id: 'SHOP_REMAINS_OPEN', title: 'The Shop Remains Open',
    body: [
      'The town has stopped asking why the shop only opens after midnight. They\'ve started, instead, telling each other where to find it, in the particular hushed voice reserved for good secrets.',
      'You know most of your regulars by the sound of their footsteps now, before the bell even finishes ringing. You know what they\'ll ask before they ask it, most nights — and on the nights you don\'t, that\'s alright too. That\'s most of the job, really: being surprised, gently, by what people need, and having something on the shelf for it more often than not.',
      'The back room stays closed for now. Some mysteries can wait for a keeper who\'s ready for them, and there\'s no rule that says that has to be tonight.',
    ],
    subtitle: 'Reputation and relationships both run deep. You\'ve become exactly what the shop needed: someone worth trusting with strange, midnight things.',
  },
  NEW_KEEPER: {
    id: 'NEW_KEEPER', title: 'The New Keeper',
    body: [
      'It happens gradually, the way most real changes do. Moth starts showing up earlier, asking more questions than usual, watching how you weigh a request against the shelves rather than just what you sell. One night, without quite deciding to, you let them ring up a sale themself.',
      'They get it right. Of course they get it right — they\'ve been doing this, in one form or another, longer than you have, whatever "longer" means for someone like Moth.',
      'You don\'t leave all at once. You just find yourself, more and more nights, on the customer\'s side of the counter instead — and the shop, it turns out, minds this a good deal less than you\'d have guessed. Some doors are meant to be handed through, not just walked through alone.',
    ],
    subtitle: 'You found something worth building — just not, in the end, a life spent entirely behind this counter. The shop goes on. So do you.',
  },
  DOOR_CLOSES: {
    id: 'DOOR_CLOSES', title: 'The Door Closes',
    body: [
      'You turn the sign for the last time on a night that doesn\'t feel especially different from any other, which is somehow the saddest part.',
      'The rent on strangeness, it turns out, is higher than the money in the till — reputations take longer to build than they take to spend, and this one never quite caught. You sell what\'s left of the stock in a single quiet week to a buyer who doesn\'t ask why an Ember Bottle is priced the way it is.',
      'You keep one thing for yourself, off the books — something small, something that still smells faintly of rain — and lock the door behind you without looking at the back wall too closely. Some other keeper, someday, might be ready for whatever\'s there. Tonight, it isn\'t you, and that has to be alright.',
    ],
    subtitle: 'The shop asked more of you than you had to give it, this time around. Not every strange thing gets kept.',
  },
};

const MYSTERY_FLAGS = [
  'pell_confirmed_mystery', 'pell_final_truth', 'fenn_letter_answered', 'fenn_second_letter',
  'moth_warned_door', 'moth_walked_with', 'ashe_diagram_read', 'ashe_wrote_truth', 'ashe_final_truth',
];
const RECURRING_IDS = ['rin', 'sael', 'mrs_pell', 'fenn', 'moth', 'ashe'];

export function computeMysteryPoints(state) {
  return MYSTERY_FLAGS.filter(f => state.storyFlags[f]).length;
}

export function countFriends(state) {
  return RECURRING_IDS.filter(id => (state.relationships[id]?.points || 0) >= 8).length;
}

export function determineEnding(state) {
  const mystery = computeMysteryPoints(state);
  const friends = countFriends(state);
  const rep = state.reputation;
  const money = state.money;

  if (mystery >= 6) return ENDINGS.HIDDEN_ROOM;
  if (rep >= 65 && friends >= 3) return ENDINGS.SHOP_REMAINS_OPEN;
  if (rep < 35 || money < 15) return ENDINGS.DOOR_CLOSES;
  return ENDINGS.NEW_KEEPER;
}
