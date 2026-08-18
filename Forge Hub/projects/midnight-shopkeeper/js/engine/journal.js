import { RECURRING } from '../data/customers_recurring.js';
import { ITEMS } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';
import { relationshipTier } from '../state.js';

const RUMOR_POOL = [
  { flag: 'pell_gave_key', text: 'A brass key with no visible lock somewhere in this town. Mrs. Pell says it belongs to the shop.' },
  { flag: 'ashe_diagram_read', text: 'An old renovation permit mentions a "storage annex" behind this very wall, filed under a date that doesn\'t add up.' },
  { flag: 'fenn_letter_answered', text: 'Fenn is delivering letters with no sender, addressed to whoever keeps this shop.' },
  { flag: 'moth_warned_door', text: 'A child who calls themself Moth speaks about the back wall like it\'s a door that simply hasn\'t opened yet.' },
  { flag: 'pell_confirmed_mystery', text: 'The lanterns went out one night, years before you arrived, and a new keeper was behind the counter by morning. Nobody agrees on what happened in between.' },
  { flag: 'ashe_wrote_truth', text: 'Dr. Ashe believes the shop\'s previous keeper sealed something themself, rather than losing it to anything else.' },
];

export function getJournal(state) {
  const customers = Object.values(RECURRING).map(c => {
    const rel = state.relationships[c.id];
    const tier = relationshipTier(rel?.points || 0);
    const metCount = c.appearances.filter(a => state.completedRecurringTags.includes(a.tag)).length;
    return {
      id: c.id, name: c.name, title: c.title, portrait: c.portrait,
      met: metCount > 0, tier, appearancesSeen: metCount, totalAppearances: c.appearances.length,
      flags: Object.keys(rel?.flags || {}),
    };
  });

  const items = Object.values(ITEMS).filter(it => (state.inventory[it.id] || 0) > 0 || state.discoveredItems[it.id])
    .map(it => ({ ...it, confirmed: !!state.discoveredItems[it.id] }));

  const recipes = RECIPES.map(r => ({
    ...r,
    known: state.knownRecipes.includes(r.id),
    hinted: r.known || state.knownRecipes.includes(r.id) || !!state.storyFlags[`hint_${r.id}`],
  }));

  const rumors = RUMOR_POOL.filter(r => state.storyFlags[r.flag]);

  return { customers, items, recipes, rumors };
}
