import { RECIPES } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';

export function availableRecipes(state) {
  const workbenchLevel = state.upgrades.workbench || 0;
  return RECIPES.filter(r => !r.requiresUpgrade || (r.requiresUpgrade === 'workbench' && workbenchLevel >= 1));
}

export function canCraft(recipe, inventory) {
  return recipe.inputs.every(id => (inventory[id] || 0) > 0);
}

export function findRecipeFor(itemAId, itemBId, state) {
  return availableRecipes(state).find(r => {
    const [a, b] = r.inputs;
    return (a === itemAId && b === itemBId) || (a === itemBId && b === itemAId);
  });
}

export function craft(state, itemAId, itemBId) {
  const recipe = findRecipeFor(itemAId, itemBId, state);
  if (!recipe) return { ok: false, reason: 'no-recipe' };
  if (!canCraft(recipe, state.inventory)) return { ok: false, reason: 'missing-ingredients' };

  const freeCombine = (state.upgrades.workbench || 0) >= 2;
  state.inventory[itemAId] -= 1;
  state.inventory[itemBId] -= 1;
  state.inventory[recipe.result] = (state.inventory[recipe.result] || 0) + 1;

  const wasKnown = state.knownRecipes.includes(recipe.id);
  if (!wasKnown) state.knownRecipes.push(recipe.id);
  state.discoveredItems[recipe.result] = true;

  return { ok: true, recipe, resultItem: ITEMS[recipe.result], newlyDiscovered: !wasKnown, freeCombine };
}
