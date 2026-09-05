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
// U44: ONE HOME. Heal-SpellPoints is the only DFU effect with no
// ClassicKey - PotionMaker-only, no MagicSkill, no spell-book text
// (HealSpellPoints.cs:21-30) - so no SPELLS.STD row can name it and
// no classic spell restores magicka, which is what effects.js:246-252
// recorded when S15 undid an earlier mis-mapping of (10,9) onto it. A
// potion bundle is not a spell record: DFU builds one from
// EffectEntry(effect.Key, settings), a STRING key, and the classic
// pair is only how a SPELLS.STD row reaches an effect. The key lives
// with the effect that answers to it.
import { HEAL_SPELL_POINTS_KEY } from './effects.js';

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
 *  are TEMPLATE indices, pre-sorted so the key is stable.
 *
 *  U44 widened every row with what DRINKING one does:
 *   - `effect`      the primary effect, as the classic "type,subType"
 *                   pair its class sets with MakeClassicKey.
 *   - `settings`    ONLY the fields that differ from
 *                   DefaultEffectSettings, which is every one of the
 *                   eleven at 1 (EntityEffect.cs:946-968). DFU's
 *                   EffectSettings names map onto the classic record's
 *                   through its own converter
 *                   (EntityEffectBroker.cs:952-976): ChancePlus is
 *                   chanceMod, MagnitudeBaseMin/Max are
 *                   magnitudeBaseLow/High, and MagnitudePlusMin/Max
 *                   are magnitudeLevelBase/LevelHigh.
 *   - `secondary`   the extra effects, sharing the ONE settings struct
 *                   (EntityEffectManager.cs:914-928). Purification is
 *                   the only recipe in DFU that has any.
 *   - `displayName` PotionRecipe.GetDisplayName (:225-236) - the
 *                   recipe NAME is the localization key, verbatim, so
 *                   these are the en values from Internal_Strings.csv.
 */
export const POTION_RECIPES = Object.freeze([
  { name: 'resistFire', price: 75, ingredients: [7, 10, 32, 35, 64], effect: '8,0', displayName: 'Resist Fire', settings: { chanceBase: 100 } },   // Amber, Red Flowers, Cactus, Fairy Dragon's Scales, Ichor
  { name: 'resistFrost', price: 75, ingredients: [5, 14, 22, 64], effect: '8,1', displayName: 'Resist Frost', settings: { chanceBase: 100 } },   // Turquoise, Pine Branch, White Rose, Ichor
  { name: 'resistShock', price: 75, ingredients: [16, 64, 68], effect: '8,3', displayName: 'Resist Shock', settings: { chanceBase: 100 } },   // Red Berries, Ichor, Lodestone
  { name: 'resistPoison', price: 125, ingredients: [25, 43, 64], effect: '8,2', displayName: 'Resist Poison', settings: { chanceBase: 5, chanceMod: 19 } },   // Golden Poppy, Snake Venom, Ichor
  { name: 'slowFalling', price: 100, ingredients: [24, 26, 59], effect: '25,255', displayName: 'Slow Falling' },   // Black Poppy, White Poppy, Pure Water
  { name: 'waterBreathing', price: 100, ingredients: [60, 62, 76], effect: '30,255', displayName: 'Water Breathing' },   // Rain Water, Elixir Vitae, Ivory
  { name: 'chameleonForm', price: 200, ingredients: [9, 11, 16, 60, 63], effect: '23,0', displayName: 'Chameleon Form' },   // Green Leaves, Yellow Flowers, Red Berries, Rain Water, Nectar
  { name: 'invisibility', price: 250, ingredients: [3, 39, 60, 63], effect: '13,0', displayName: 'Invisibility' },   // Diamond, Ectoplasm, Rain Water, Nectar
  { name: 'shadowForm', price: 200, ingredients: [6, 21, 60, 63], effect: '24,0', displayName: 'Shadow Form' },   // Malachite, Black Rose, Rain Water, Nectar
  { name: 'cureDisease', price: 100, ingredients: [31, 56, 62], effect: '3,0', displayName: 'Cure Disease', settings: { chanceMod: 10 } },   // Fig, Big Tooth, Elixir Vitae
  { name: 'purification', price: 500, ingredients: [3, 31, 39, 49, 56, 60, 62, 63], effect: '3,0', displayName: 'Purification', settings: { chanceMod: 10, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 }, secondary: ['10,8', '13,0'] },   // Diamond, Fig, Ectoplasm, Mummy Wrappings, Big Tooth, Rain Water, Elixir Vitae, Nectar
  { name: 'curePoison', price: 200, ingredients: [47, 58, 64, 77], effect: '3,1', displayName: 'Cure Poison', settings: { chanceBase: 5, chanceMod: 19 } },   // Giant Scorpion Stinger, Small Tooth, Ichor, Pearl
  { name: 'orcStrength', price: 50, ingredients: [59, 61, 71], effect: '9,0', displayName: 'Orc Strength', settings: { magnitudeLevelBase: 14, magnitudeLevelHigh: 14 } },   // Pure Water, Orc's Blood, Iron
  { name: 'freeAction', price: 125, ingredients: [8, 28, 41, 64], effect: '26,255', displayName: 'Free Action', settings: { chanceBase: 5, chanceMod: 19 } },   // Twigs, Bamboo, Spider's Venom, Ichor
  { name: 'stamina', price: 25, ingredients: [27, 30, 59], effect: '10,9', displayName: 'Stamina', settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 4, magnitudeLevelHigh: 4 } },   // Ginkgo Leaves, Aloe, Pure Water
  { name: 'healing', price: 50, ingredients: [16, 42, 62, 65], effect: '10,8', displayName: 'Healing', settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 9, magnitudeLevelHigh: 9 } },   // Red Berries, Troll's Blood, Elixir Vitae, Mercury
  { name: 'healTrue', price: 100, ingredients: [14, 16, 37, 62], effect: '10,8', displayName: 'Heal True', settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 } },   // Pine Branch, Red Berries, Unicorn Horn, Elixir Vitae
  { name: 'restorePower', price: 75, ingredients: [33, 54, 63, 73], effect: HEAL_SPELL_POINTS_KEY, displayName: 'Restore Power', settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 4, magnitudeLevelHigh: 4 } },   // Werewolf's Blood, Saint's Hair, Nectar, Silver
  { name: 'levitation', price: 125, ingredients: [39, 59, 63], effect: '14,255', displayName: 'Levitation' },   // Ectoplasm, Pure Water, Nectar
  { name: 'waterWalking', price: 50, ingredients: [20, 29, 59, 69], effect: '31,255', displayName: 'Water Walking' },   // Yellow Rose, Palm, Pure Water, Sulphur
].map(Object.freeze));

/** The broker's recipe lookup, built once. DFU keys its dictionary by
 *  the same hash the cauldron computes, which is the whole matching
 *  mechanism - there is no ingredient comparison anywhere. */
const _byKey = new Map(POTION_RECIPES.map((r) => [potionRecipeKey(r.ingredients), r]));
export const potionRecipeByKey = (key) => _byKey.get(key) ?? null;

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
//    (:903-947). U44 mounted it: scenes/hostMagic.js:524-531 builds the
//    bundle, all three hosts hand `drinkPotion` down (world.js:2192,
//    dungeonContext.js:1110, exterior.js:1732) and useItem.js:257
//    routes the bottle into it.
//  - RandomlyAddPotionRecipe(25) is live in shopStock.js:203-209
//    (AUDIT 26 F129, DaggerfallLoot.cs:165 - the Alchemist arm), so a
//    shop stocks a recipe scroll.
