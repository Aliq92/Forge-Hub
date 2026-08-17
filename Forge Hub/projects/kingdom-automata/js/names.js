// ============================================================
// names.js — procedural name generation (kingdoms, dynasties,
// rulers, settlements). Fully offline, fragment-based.
// ============================================================

const NAME_PREFIX = ['Val', 'Eld', 'Sol', 'Ard', 'Kar', 'Thal', 'Mor', 'Bran', 'Cor', 'Dun',
  'Est', 'Fen', 'Gal', 'Hel', 'Ith', 'Jor', 'Kel', 'Lor', 'Myr', 'Nor',
  'Os', 'Pel', 'Quen', 'Rav', 'Syl', 'Tor', 'Ul', 'Ven', 'Wyn', 'Zar',
  'Ash', 'Bel', 'Cael', 'Dren', 'Emb', 'Fjor', 'Gris', 'Hal', 'Ir', 'Jun'];

const NAME_MID = ['a', 'e', 'i', 'o', 'u', 'an', 'en', 'ar', 'or', 'in', 'al', 'ed', 'ur', 'ia'];

const NAME_SUFFIX = ['ria', 'dor', 'nia', 'mar', 'wick', 'heim', 'gard', 'shire', 'dale', 'moor',
  'ford', 'holm', 'stead', 'vale', 'crest', 'fell', 'ton', 'burg', 'reach', 'haven',
  'grad', 'thorn', 'wood', 'more', 'land', 'peak', 'watch', 'gate', 'rock', 'hollow'];

const RULER_TITLES_M = ['King', 'High King', 'Lord', 'Warlord', 'Chieftain', 'Emperor'];
const RULER_TITLES_F = ['Queen', 'High Queen', 'Lady', 'Warlady', 'Chieftess', 'Empress'];

const FIRST_NAMES = ['Aldric', 'Bryn', 'Cedric', 'Doran', 'Edmund', 'Fenwick', 'Gareth', 'Halvard',
  'Ivar', 'Joren', 'Kestrel', 'Loric', 'Magnus', 'Nolan', 'Osric', 'Petran',
  'Quinlan', 'Roric', 'Stellan', 'Torvald', 'Ulric', 'Varek', 'Wystan', 'Yorick',
  'Aria', 'Brenna', 'Celestine', 'Devona', 'Elowen', 'Freya', 'Gwyn', 'Helena',
  'Isolde', 'Junia', 'Kyra', 'Liora', 'Maren', 'Nyla', 'Ophira', 'Petra',
  'Ravenna', 'Sable', 'Thessaly', 'Una', 'Vesna', 'Wren', 'Yseult', 'Zenna'];

const DYNASTY_SUFFIX = ['ing', 'ari', 'ovic', 'sen', 'ryn', 'ane', 'ell', 'ith', 'orn', 'ax'];

function buildNameBank(rng, count, minLen = 2) {
  const used = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    let name;
    const style = rng();
    if (style < 0.55) {
      name = rngPick(rng, NAME_PREFIX) + rngPick(rng, NAME_SUFFIX);
    } else if (style < 0.85) {
      name = rngPick(rng, NAME_PREFIX) + rngPick(rng, NAME_MID) + rngPick(rng, NAME_SUFFIX);
    } else {
      name = rngPick(rng, NAME_PREFIX) + rngPick(rng, NAME_MID);
    }
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (name.length < minLen) continue;
    if (used.has(name)) continue;
    used.add(name);
    out.push(name);
  }
  return out;
}

function generateDynastyName(rng) {
  const root = rngPick(rng, NAME_PREFIX);
  return root + rngPick(rng, DYNASTY_SUFFIX);
}

function generateRulerName(rng) {
  const female = rngChance(rng, 0.5);
  const first = rngPick(rng, FIRST_NAMES);
  const title = rngPick(rng, female ? RULER_TITLES_F : RULER_TITLES_M);
  const ordinal = rngChance(rng, 0.35) ? ' ' + rngPick(rng, ['I', 'II', 'III', 'IV', 'V']) : '';
  return { title, first, display: `${title} ${first}${ordinal}` };
}

function generateSettlementName(rng, bank) {
  if (bank.length) return bank.pop();
  return rngPick(rng, NAME_PREFIX) + rngPick(rng, NAME_SUFFIX);
}
