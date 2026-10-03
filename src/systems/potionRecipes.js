// @ts-check
// M1 - DFU'S TWENTY POTION RECIPES AND THE KEY THEY ARE FOUND BY
// (PotionRecipe.cs, and the effect classes that register them - MIT,
// Daggerfall Workshop): the table and the hash moved here VERBATIM from
// systems/potions.js, which imports and re-exports them, so every
// reader's import stands and the table keeps one home.
//
// PROF12 (bible/06-Systems/Professions-Arc.md 9.3, 37): WHY A LEAF. The
// profession's door to Alchemy is the brewing act, and the account
// service brews by DFU's own recipe law - "POTION_RECIPES, imported, the
// order-independent ingredient hash DFU keys it by" (9.3; law 1's "ONE
// DFU MEMBER, ONE EXPORT"). potions.js reaches the item table and the
// effect engine, which no Worker bundles; this file imports nothing.
//
// U44: ONE HOME for Heal-SpellPoints' key too. It is the only DFU effect
// with no ClassicKey - PotionMaker-only, no MagicSkill, no spell-book
// text (HealSpellPoints.cs:21-30) - so the one record that names it is
// the Restore Power recipe below; a potion bundle is not a spell record:
// DFU builds one from EffectEntry(effect.Key, settings), a STRING key.
// It lived with the effect engine (effects.js), which now imports and
// re-exports it from here - a potion-only key beside the one table that
// names it, and a leaf the service can read.

/** HealSpellPoints' effect key (HealSpellPoints.cs) - effects.js re-exports it. */
export const HEAL_SPELL_POINTS_KEY = 'Heal-SpellPoints';

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

/** L10N3d: PotionRecipe.GetDisplayName (:225-236) is GetLocalizedText(DisplayNameKey), read each time a name is
 *  shown. This leaf imports nothing, so potions.js hands it the text core's table (setPotionDisplayNames); a reader
 *  of the leaf alone (the account service) reads each recipe's English, as before. */
let _displayNames = null;
export function setPotionDisplayNames(table) { _displayNames = table; }
const withDisplayName = (r) => {
  const en = r.displayName;
  return Object.defineProperty(r, 'displayName', { enumerable: true, get: () => _displayNames?.[r.name] ?? en });
};

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
 *   - `textureRecord` AUDIT 63 F20: the BOTTLE'S ICON. PotionRecipe.cs:34
 *                   defaults `int textureRecord = 11` and seventeen of
 *                   the twenty registrations override it, which is the
 *                   second half of the PotionRecipeKey setter's side
 *                   effect (DaggerfallUnityItem.cs:396-397, "Also
 *                   populates texture record for potions"). The port
 *                   had taken the price half alone, so every potion in
 *                   the game drew the Glass Bottle template's 205/11.
 *                   The three rows with no column - stamina, slowFalling
 *                   and levitation - are exactly the three whose effect
 *                   classes never write TextureRecord, so they keep the
 *                   11 default; a grep of Game/MagicAndEffects finds no
 *                   other write.
 */
export const POTION_RECIPES = Object.freeze([
  { name: 'resistFire', price: 75, ingredients: [7, 10, 32, 35, 64], effect: '8,0', displayName: 'Resist Fire', textureRecord: 34, settings: { chanceBase: 100 } },   // Amber, Red Flowers, Cactus, Fairy Dragon's Scales, Ichor; icon ElementalResistance.cs:137
  { name: 'resistFrost', price: 75, ingredients: [5, 14, 22, 64], effect: '8,1', displayName: 'Resist Frost', textureRecord: 34, settings: { chanceBase: 100 } },   // Turquoise, Pine Branch, White Rose, Ichor; icon ElementalResistance.cs:138
  { name: 'resistShock', price: 75, ingredients: [16, 64, 68], effect: '8,3', displayName: 'Resist Shock', textureRecord: 34, settings: { chanceBase: 100 } },   // Red Berries, Ichor, Lodestone; icon ElementalResistance.cs:139
  { name: 'resistPoison', price: 125, ingredients: [25, 43, 64], effect: '8,2', displayName: 'Resist Poison', textureRecord: 14, settings: { chanceBase: 5, chanceMod: 19 } },   // Golden Poppy, Snake Venom, Ichor; icon ElementalResistance.cs:140
  { name: 'slowFalling', price: 100, ingredients: [24, 26, 59], effect: '25,255', displayName: 'Slow Falling' },   // Black Poppy, White Poppy, Pure Water
  { name: 'waterBreathing', price: 100, ingredients: [60, 62, 76], effect: '30,255', displayName: 'Water Breathing', textureRecord: 32 },   // Rain Water, Elixir Vitae, Ivory; icon WaterBreathing.cs:51
  { name: 'chameleonForm', price: 200, ingredients: [9, 11, 16, 60, 63], effect: '23,0', displayName: 'Chameleon Form', textureRecord: 33 },   // Green Leaves, Yellow Flowers, Red Berries, Rain Water, Nectar; icon ChameleonNormal.cs:57
  { name: 'invisibility', price: 250, ingredients: [3, 39, 60, 63], effect: '13,0', displayName: 'Invisibility', textureRecord: 33 },   // Diamond, Ectoplasm, Rain Water, Nectar; icon InvisibilityNormal.cs:56
  { name: 'shadowForm', price: 200, ingredients: [6, 21, 60, 63], effect: '24,0', displayName: 'Shadow Form', textureRecord: 33 },   // Malachite, Black Rose, Rain Water, Nectar; icon ShadowNormal.cs:56
  { name: 'cureDisease', price: 100, ingredients: [31, 56, 62], effect: '3,0', displayName: 'Cure Disease', textureRecord: 35, settings: { chanceMod: 10 } },   // Fig, Big Tooth, Elixir Vitae; icon CureDisease.cs:70
  { name: 'purification', price: 500, ingredients: [3, 31, 39, 49, 56, 60, 62, 63], effect: '3,0', displayName: 'Purification', textureRecord: 35, settings: { chanceMod: 10, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 }, secondary: ['10,8', '13,0'] },   // Diamond, Fig, Ectoplasm, Mummy Wrappings, Big Tooth, Rain Water, Elixir Vitae, Nectar; icon CureDisease.cs:71
  { name: 'curePoison', price: 200, ingredients: [47, 58, 64, 77], effect: '3,1', displayName: 'Cure Poison', textureRecord: 35, settings: { chanceBase: 5, chanceMod: 19 } },   // Giant Scorpion Stinger, Small Tooth, Ichor, Pearl; icon CurePoison.cs:54
  { name: 'orcStrength', price: 50, ingredients: [59, 61, 71], effect: '9,0', displayName: 'Orc Strength', textureRecord: 13, settings: { magnitudeLevelBase: 14, magnitudeLevelHigh: 14 } },   // Pure Water, Orc's Blood, Iron; icon FortifyStrength.cs:57
  { name: 'freeAction', price: 125, ingredients: [8, 28, 41, 64], effect: '26,255', displayName: 'Free Action', textureRecord: 14, settings: { chanceBase: 5, chanceMod: 19 } },   // Twigs, Bamboo, Spider's Venom, Ichor; icon FreeAction.cs:53
  { name: 'stamina', price: 25, ingredients: [27, 30, 59], effect: '10,9', displayName: 'Stamina', settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 4, magnitudeLevelHigh: 4 } },   // Ginkgo Leaves, Aloe, Pure Water
  { name: 'healing', price: 50, ingredients: [16, 42, 62, 65], effect: '10,8', displayName: 'Healing', textureRecord: 15, settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 9, magnitudeLevelHigh: 9 } },   // Red Berries, Troll's Blood, Elixir Vitae, Mercury; icon HealHealth.cs:67
  { name: 'healTrue', price: 100, ingredients: [14, 16, 37, 62], effect: '10,8', displayName: 'Heal True', textureRecord: 16, settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 } },   // Pine Branch, Red Berries, Unicorn Horn, Elixir Vitae; icon HealHealth.cs:68
  { name: 'restorePower', price: 75, ingredients: [33, 54, 63, 73], effect: HEAL_SPELL_POINTS_KEY, displayName: 'Restore Power', textureRecord: 12, settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 4, magnitudeLevelHigh: 4 } },   // Werewolf's Blood, Saint's Hair, Nectar, Silver; icon HealSpellPoints.cs:49
  { name: 'levitation', price: 125, ingredients: [39, 59, 63], effect: '14,255', displayName: 'Levitation' },   // Ectoplasm, Pure Water, Nectar
  { name: 'waterWalking', price: 50, ingredients: [20, 29, 59, 69], effect: '31,255', displayName: 'Water Walking', textureRecord: 32 },   // Yellow Rose, Palm, Pure Water, Sulphur; icon WaterWalking.cs:52
].map((r) => Object.freeze(withDisplayName(r))));

/** PotionRecipe.cs:34 `int textureRecord = 11` - the field's own
 *  initialiser, which is what a recipe that never sets one keeps. */
export const POTION_DEFAULT_TEXTURE_RECORD = 11;
