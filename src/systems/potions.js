// M1 - THE POTION LAW: PotionRecipe.cs and the twenty recipes the
// effect classes register with the broker (MIT, Daggerfall Workshop),
// plus DaggerfallPotionMakerWindow's mixing half.
//
// Audit-25 listed the magic crafting windows among the six systems at
// or near zero, and shopStock has carried "RandomlyAddPotionRecipe(25,
// items) - potion recipes pend (loud)" since E1.
//
// THE RECIPES LIVE IN THE EFFECTS, not in a table. Each potion effect
// class builds a PotionRecipe in its SetProperties and hands it to
// AssignPotionRecipes, so the twenty of them are spread over fifteen
// files - CureDisease alone registers two (cureDisease and the
// eight-ingredient purification). They are gathered here into one
// table because a port has no broker to register with, and every
// ingredient id below was resolved from the C# enum and then checked
// against the port's OWN itemTemplates.json name.
//
// THE KEY IS A HASH, AND THE HASH IS ORDER-DEPENDENT (:295-307):
//   hash = 17; for each id: hash = hash * 23 + id
// which is a C# INT32 and wraps. The order dependence is why the
// constructor sorts (:121-130) - a cauldron holding the same three
// things in a different order has to answer the same key, and sorting
// before hashing is what makes that true. The port sorts in the same
// place and emulates the 32-bit wrap with Math.imul.
//
// TWO QUIRKS WORTH NAMING:
//
// 1. `ids.Sort()` RUNS BEFORE THE NULL CHECK (:123-124). DFU sorts the
//    list and only then asks whether it is null, so a null list throws
//    on the sort rather than being handled by the guard written for
//    it. Dead code in practice; recorded because the guard reads as
//    though it works.
//
// 2. A FAILED MIX MAKES NOTHING - and that is a DEPARTURE DFU took
//    from classic, marked in its own comment (:330-332): classic
//    creates a useless "Unknown Powers" potion, DFU says so and
//    refuses. The ingredients are consumed either way.

import { templateByIndex } from './itemTemplates.js';

/** PotionRecipe.GetHashCode(Ingredient[]) (:295-307), verbatim -
 *  including the C# int32 wrap, which Math.imul is the only faithful
 *  way to reproduce in JS. An empty or absent list is 0, NOT 17: DFU
 *  returns early before the seed is ever used. */
export function potionRecipeKey(ingredientIds) {
  if (!ingredientIds || ingredientIds.length === 0) return 0;
  let hash = 17;
  for (const id of ingredientIds) hash = (Math.imul(hash, 23) + id) | 0;
  return hash;
}

/** The PotionRecipe(List<int>) constructor (:121-130). SORTS FIRST -
 *  see the header - so a cauldron's contents key the same recipe
 *  whatever order they went in. */
export const potionKeyFromCauldron = (templateIndices) =>
  potionRecipeKey([...templateIndices].sort((a, b) => a - b));

/** The twenty recipes, gathered from the fifteen effect classes that
 *  register them. `price` is the potion's gold value; `ingredients`
 *  are TEMPLATE indices, pre-sorted so the key is stable. */
export const POTION_RECIPES = Object.freeze([
  { name: 'resistFire', price: 75, ingredients: [7, 10, 32, 35, 64] },   // Amber, Red Flowers, Cactus, Fairy Dragon's Scales, Ichor
  { name: 'resistFrost', price: 75, ingredients: [5, 14, 22, 64] },   // Turquoise, Pine Branch, White Rose, Ichor
  { name: 'resistShock', price: 75, ingredients: [16, 64, 68] },   // Red Berries, Ichor, Lodestone
  { name: 'resistPoison', price: 125, ingredients: [25, 43, 64] },   // Golden Poppy, Snake Venom, Ichor
  { name: 'slowFalling', price: 100, ingredients: [24, 26, 59] },   // Black Poppy, White Poppy, Pure Water
  { name: 'waterBreathing', price: 100, ingredients: [60, 62, 76] },   // Rain Water, Elixir Vitae, Ivory
  { name: 'chameleonForm', price: 200, ingredients: [9, 11, 16, 60, 63] },   // Green Leaves, Yellow Flowers, Red Berries, Rain Water, Nectar
  { name: 'invisibility', price: 250, ingredients: [3, 39, 60, 63] },   // Diamond, Ectoplasm, Rain Water, Nectar
  { name: 'shadowForm', price: 200, ingredients: [6, 21, 60, 63] },   // Malachite, Black Rose, Rain Water, Nectar
  { name: 'cureDisease', price: 100, ingredients: [31, 56, 62] },   // Fig, Big Tooth, Elixir Vitae
  { name: 'purification', price: 500, ingredients: [3, 31, 39, 49, 56, 60, 62, 63] },   // Diamond, Fig, Ectoplasm, Mummy Wrappings, Big Tooth, Rain Water, Elixir Vitae, Nectar
  { name: 'curePoison', price: 200, ingredients: [47, 58, 64, 77] },   // Giant Scorpion Stinger, Small Tooth, Ichor, Pearl
  { name: 'orcStrength', price: 50, ingredients: [59, 61, 71] },   // Pure Water, Orc's Blood, Iron
  { name: 'freeAction', price: 125, ingredients: [8, 28, 41, 64] },   // Twigs, Bamboo, Spider's Venom, Ichor
  { name: 'stamina', price: 25, ingredients: [27, 30, 59] },   // Ginkgo Leaves, Aloe, Pure Water
  { name: 'healing', price: 50, ingredients: [16, 42, 62, 65] },   // Red Berries, Troll's Blood, Elixir Vitae, Mercury
  { name: 'healTrue', price: 100, ingredients: [14, 16, 37, 62] },   // Pine Branch, Red Berries, Unicorn Horn, Elixir Vitae
  { name: 'restorePower', price: 75, ingredients: [33, 54, 63, 73] },   // Werewolf's Blood, Saint's Hair, Nectar, Silver
  { name: 'levitation', price: 125, ingredients: [39, 59, 63] },   // Ectoplasm, Pure Water, Nectar
  { name: 'waterWalking', price: 50, ingredients: [20, 29, 59, 69] },   // Yellow Rose, Palm, Pure Water, Sulphur
].map(Object.freeze));

/** The broker's recipe lookup, built once. DFU keys its dictionary by
 *  the same hash the cauldron computes, which is the whole matching
 *  mechanism - there is no ingredient comparison anywhere. */
const _byKey = new Map(POTION_RECIPES.map((r) => [potionRecipeKey(r.ingredients), r]));
export const potionRecipeByKey = (key) => _byKey.get(key) ?? null;
export const potionRecipeKeys = () => [...(_byKey.keys())];

/** MixCauldron (:311-345) as a decision. Answers
 *    { kind: 'mixed', recipe, key } - a potion is created
 *    { kind: 'failed' }             - nothing is created (the DFU
 *                                     departure; classic makes a
 *                                     useless potion)
 *  In BOTH cases the ingredients are spent, which is the caller's
 *  job because it owns the collections. */
export function mixCauldron(templateIndices) {
  const key = potionKeyFromCauldron(templateIndices);
  const recipe = potionRecipeByKey(key);
  return recipe ? { kind: 'mixed', recipe, key } : { kind: 'failed' };
}

/** ItemHelper.IsIngredient - the potion maker's ingredient list is
 *  every item in the pack whose template says so. */
export const isIngredient = (item) => !!templateByIndex(item?.templateIndex)?.isIngredient;

/** The recipe list the RECIPES button opens (:376-382): the potion
 *  recipes the player has LEARNED, by key. An empty list is a message
 *  box rather than an empty picker. */
export const knownRecipes = (recipeKeys = []) =>
  recipeKeys.map((k) => potionRecipeByKey(k)).filter(Boolean);

// ── the cauldron (DaggerfallPotionMakerWindow) ────────────────────

/** AddToCauldron's cap (:253). Eight, which is also the number of
 *  slots the cauldron list draws - and purification needs all eight. */
export const CAULDRON_CAPACITY = 8;

/** AddToCauldron (:251-264). A full cauldron simply refuses - there is
 *  no message - and a STACK is split so that exactly one unit goes in,
 *  which is why the cauldron holds items rather than counts. */
export const cauldronAccepts = (cauldron) => cauldron.length < CAULDRON_CAPACITY;

/** MixCauldron's consumption walk (:335-356) - the one arm with a
 *  name in DFU's own log: "The cauldron broke".
 *
 *  Each ingredient is taken from the PACK, or from the WAGON if the
 *  pack has none, and if NEITHER has it the walk RETURNS - leaving
 *  every remaining ingredient unconsumed and the cauldron unemptied.
 *  It is a partial spend that bails mid-loop, and it is verbatim.
 *
 *  Answers { kind: 'spent' } or { kind: 'broke', at } so a caller can
 *  tell the difference; `take(templateIndex, where)` is the host's
 *  removal, answering whether it found one. */
export function consumeCauldron(cauldron, { takeFromPack, takeFromWagon }) {
  for (let i = 0; i < cauldron.length; i++) {
    const templateIndex = cauldron[i].templateIndex;
    if (takeFromPack(templateIndex)) continue;
    if (takeFromWagon(templateIndex)) continue;
    return { kind: 'broke', at: i };
  }
  return { kind: 'spent' };
}

/** AddRecipeToCauldron (:283-309): the RECIPES picker fills the
 *  cauldron from a known recipe, but only with what the player
 *  actually HAS. Answers the ingredients it could find and the ones
 *  it could not, because DFU fills what it can and leaves the rest -
 *  it does not refuse the whole recipe for one missing herb. */
export function gatherRecipe(recipe, availableTemplateIndices) {
  const pool = [...availableTemplateIndices];
  const found = [], missing = [];
  for (const id of recipe.ingredients) {
    const at = pool.indexOf(id);
    if (at < 0) { missing.push(id); continue; }
    pool.splice(at, 1);
    found.push(id);
  }
  return { found, missing };
}

// FLAGGED, with the slice it waits on:
//  - the potion's EFFECT when drunk rides the effect broker's
//    recipe->effect map; the port's useItem arm needs the M-arc's
//    second half to know what a mixed potion does.
//  - RandomlyAddPotionRecipe(25) in shopStock is now unblocked: the
//    keys exist, so a shop can stock a recipe scroll.
