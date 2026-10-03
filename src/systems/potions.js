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
// PROF12 (bible/06-Systems/Professions-Arc.md 9.3, 37): THE TWENTY
// RECIPES AND THEIR KEY moved, verbatim, to a leaf of their own
// (systems/potionRecipes.js) - the account service runs DFU's own
// recipe law on a brew (law 1, "ONE DFU MEMBER, ONE EXPORT":
// POTION_RECIPES imported, never copied), and this file's other
// imports (the item table, the effect engine) are no Worker's to
// bundle. One home still: this file re-exports them, and every
// reader's import stands.
import {
  POTION_RECIPES, POTION_DEFAULT_TEXTURE_RECORD, potionRecipeKey, potionKeyFromCauldron,
} from './potionRecipes.js';
export { POTION_RECIPES, POTION_DEFAULT_TEXTURE_RECORD, potionRecipeKey, potionKeyFromCauldron };

/** The broker's recipe lookup, built once. DFU keys its dictionary by
 *  the same hash the cauldron computes, which is the whole matching
 *  mechanism - there is no ingredient comparison anywhere. */
const _byKey = new Map(POTION_RECIPES.map((r) => [potionRecipeKey(r.ingredients), r]));
// RR1: `EntityEffectBroker.RegisterEffectTemplate(new CureDiseasePotionRR(), true)`
// (RoleplayRealism.cs:198) - a mod's effect class re-declares its potion
// recipes and the broker's dictionary takes them over DFU's (allowReplacement).
// The rows are keyed by their ingredients as the built ones are, so a
// replaced recipe answers the same key.
const _recipeOverrides = new Map();
export function overridePotionRecipes(rows) {
  _recipeOverrides.clear();
  for (const r of rows ?? []) _recipeOverrides.set(potionRecipeKey(r.ingredients), Object.isFrozen(r) ? r : Object.freeze(r));
}
export const potionRecipeByKey = (key) => _recipeOverrides.get(key) ?? _byKey.get(key) ?? null;

/** EntityEffectManager.DrinkPotion (:903-947), the bundle half.
 *
 *  DFU builds an EffectBundleSettings with BundleType Potion and
 *  TargetType CasterOnly, whose Effects are the recipe's primary
 *  followed by its secondaries, EVERY ONE sharing the single
 *  `potionRecipe.Settings` struct (:914-930) - not a copy each, one
 *  struct, which is why purification's Heal-Health and Invisibility
 *  inherit cureDisease's chance numbers. Then AssignBundle with
 *  BypassSavingThrows | BypassChance (:942).
 *
 *  The port's shape for that is a SPELLS.STD-flavoured record, which
 *  is what applySpell walks: rangeType 0 is CasterOnly and element 4
 *  is Magic, the element DrinkPotion's own cast sound is keyed on
 *  (:945-946). An effect with no classic pair rides as `key`.
 *
 *  Returns null for an unknown recipe key - DFU's GetPotionRecipe
 *  answers null and DrinkPotion's `PotionRecipeKey == 0` guard
 *  (:906) refuses before that. */
export function potionBundle(recipeKey) {
  const recipe = potionRecipeByKey(recipeKey);
  if (!recipe) return null;
  const settings = recipe.settings ?? {};
  const entry = (id) => {
    const slot = { ...BLANK_EFFECT_SETTINGS, ...settings };
    // A classic "type,subType" pair, or a DFU-only string key.
    const pair = /^\d+,\d+$/.test(id) ? id.split(',').map(Number) : null;
    return pair
      ? { type: pair[0], subType: pair[1], ...slot }
      : { type: -1, subType: -1, key: id, ...slot };
  };
  return {
    name: recipe.displayName,
    rangeType: 0,     // TargetTypes.CasterOnly (:937)
    element: 4,       // ElementTypes.Magic - the cast sound's (:946)
    bundleType: 'potion',   // BundleTypes.Potion (:936)
    effects: [entry(recipe.effect), ...(recipe.secondary ?? []).map(entry)],
  };
}

/** DefaultEffectSettings (EntityEffect.cs:946-968): all eleven at 1.
 *  A recipe's `settings` names only what differs. */
const BLANK_EFFECT_SETTINGS = Object.freeze({
  durationBase: 1, durationMod: 1, durationPerLevel: 1,
  chanceBase: 1, chanceMod: 1, chancePerLevel: 1,
  magnitudeBaseLow: 1, magnitudeBaseHigh: 1,
  magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1,
});
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

/** The recipe list the RECIPES button opens (:376-382): the recipes
 *  the CARRIED recipe items resolve to, by key. An empty list is a
 *  message box rather than an empty picker.
 *
 *  AUDIT 63 F42: Refresh's picker walk (:164-170) de-dupes -
 *  `if (!recipes.Contains(potionRecipe)) recipes.Add(potionRecipe)` -
 *  and then SORTS by display name,
 *  `recipes.Sort((x, y) => (x.DisplayName.CompareTo(y.DisplayName)))`,
 *  so two copies of the same scroll are one row and the picker is
 *  alphabetical. Both were missing while the caller could never hand
 *  this a key. De-duping the KEYS is DFU's object de-dupe: key -> recipe
 *  is 1:1 through _byKey. */
export const knownRecipes = (recipeKeys = []) =>
  [...new Set(recipeKeys)].map((k) => potionRecipeByKey(k)).filter(Boolean)
    .sort((a, b) => (a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0));

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
    // F176: the group rides along - DFU's walk looks items up as
    // GetItem(item.ItemGroup, item.TemplateIndex, allowEnchantedItem:
    // false) (:338, :345).
    const group = cauldron[i].group;
    if (takeFromPack(templateIndex, group)) continue;
    if (takeFromWagon(templateIndex, group)) continue;
    return { kind: 'broke', at: i };
  }
  return { kind: 'spent' };
}

/** AddRecipeToCauldron's ingredient MATCH (:283-296): each recipe
 *  ingredient claims at most one held item, spending the pool down.
 *  Answers the ingredients found and the ones missing - DFU refuses
 *  the WHOLE recipe with "reqIngredients" when anything is missing
 *  (:297-301); only an empty `missing` fills the pot. */
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

// BOTH OF THE SLICES THIS FILE WAITED ON HAVE LANDED:
//  - the potion's EFFECT when drunk is the recipe->effect map, and it
//    is potionBundle above (:138) - DrinkPotion's EffectBundleSettings
//    (:903-947). U44 mounted it: scenes/hostMagic.js:1232-1238 builds the
//    bundle, all three hosts hand `drinkPotion` down (world.js:9674,
//    dungeonContext.js:1931, exterior.js:2554) and useItem.js:379
//    routes the bottle into it.
//  - RandomlyAddPotionRecipe(25) is live in shopStock.js:237-244
//    (AUDIT 26 F129, DaggerfallLoot.cs:165 - the Alchemist arm), so a
//    shop stocks a recipe scroll.
