// MOD (player report): "I killed an Imp and it dropped a Wereboar's
// Tusk and a Unicorn Horn." Classic Daggerfall's loot tables never
// tie a CreatureIngredients1/2/3 roll to the creature that died - the
// three groups are just three fixed pools (systems/itemTemplatesData.js),
// and a monster's lootTableKey letter only says HOW OFTEN each pool is
// tried, never WHICH of its items can come out. That is honestly
// defensible for the nineteen HUMAN class enemies that can roll these
// pools (Archer, Ranger, Spellsword, the rogue line, the mage line) -
// a person can plausibly be carrying any reagent, exotic or not, as
// trade stock. It is not defensible for an actual MONSTER: an Imp has
// no unicorn to have taken a horn from.
//
// This is a curated per-mobileType override, checked ONLY against the
// monsters below (every other mobileType - including all nineteen
// human classes - keeps the full, untouched vanilla pool). Where a
// listed monster has a real body-part match, it rolls from a tight
// subset of that ONE tier's items; where a tier (C1/C2/C3) has
// nothing in this 23-item pool that could plausibly be theirs, that
// tier is left out of the entry entirely and simply never mints -
// LOOT_MATRICES' own percentages, and generateRandomLoot's halving
// ladder, are both untouched: this only narrows WHICH item a
// successful roll can produce, never how often one is tried.
//
// A monster not listed here (Vampire, Ancient Vampire, Dreugh, Lamia)
// has nothing in the 23-item pool that reads as theirs either - none
// of them are absent by oversight, they are documented exceptions:
// see the explicit `{}` placeholders others of their kind (an actual
// Daedra, an actual Lich) DO have. Keeping them here, empty, makes
// that a design record rather than a silent gap regenerable code could
// re-open.
import { MOBILE_TYPES } from '../characters/mobileTypes.js';

// itemTemplates.json indices, named for readability; the three arrays
// are itemTemplatesData.js's own CreatureIngredients1/2/3, verbatim -
// this file only ever picks a SUBSET of one of those three, never a
// new index.
const IDX = Object.freeze({
  WerewolfsBlood: 33, FairyDragonScales: 35, WraithEssence: 38, Ectoplasm: 39,
  GhoulsTongue: 40, SpidersVenom: 41, TrollsBlood: 42, SnakeVenom: 43,
  GorgonSnake: 44, LichDust: 45, GiantsBlood: 50, BasilisksEye: 51,
  DaedrasHeart: 53, SaintsHair: 54, OrcsBlood: 61,                        // CreatureIngredients1
  DragonsScales: 46, GiantScorpionStinger: 47, SmallScorpionStinger: 48,
  MummyWrappings: 49, GryphonsFeather: 52,                                // CreatureIngredients2
  WereboarsTusk: 34, NymphHair: 36, UnicornHorn: 37,                      // CreatureIngredients3
});

/** mobileType -> { C1?: [...indices], C2?: [...], C3?: [...] }. A key
 *  missing from the object means "nothing here fits this tier for
 *  this monster" - the roll still happens (LOOT_MATRICES' own odds),
 *  it just never has anything to mint. */
export const CREATURE_INGREDIENT_THEME = Object.freeze({
  [MOBILE_TYPES.Imp]:           Object.freeze({ C1: Object.freeze([IDX.DaedrasHeart]) }),   // a minor daedra - the one C1 item that is actually daedric
  [MOBILE_TYPES.Harpy]:         Object.freeze({ C2: Object.freeze([IDX.GryphonsFeather]) }),   // a flying, feathered thing
  [MOBILE_TYPES.Giant]:         Object.freeze({ C1: Object.freeze([IDX.GiantsBlood]) }),   // named for exactly this
  [MOBILE_TYPES.Centaur]:       Object.freeze({ C1: Object.freeze([IDX.FairyDragonScales]), C3: Object.freeze([IDX.NymphHair]) }),   // the same mythic-woodland shelf Nymph draws from
  [MOBILE_TYPES.Nymph]:         Object.freeze({ C1: Object.freeze([IDX.FairyDragonScales]), C3: Object.freeze([IDX.NymphHair]) }),   // Nymph Hair is literally this
  [MOBILE_TYPES.OrcShaman]:     Object.freeze({ C1: Object.freeze([IDX.OrcsBlood]) }),   // an Orc
  [MOBILE_TYPES.DaedraSeducer]: Object.freeze({ C1: Object.freeze([IDX.DaedrasHeart]) }),   // a daedra
  [MOBILE_TYPES.DaedraLord]:    Object.freeze({ C1: Object.freeze([IDX.DaedrasHeart]) }),   // a daedra
  [MOBILE_TYPES.Lich]:          Object.freeze({ C1: Object.freeze([IDX.LichDust, IDX.WraithEssence, IDX.Ectoplasm, IDX.GhoulsTongue]), C2: Object.freeze([IDX.MummyWrappings]) }),   // undead, and Lich Dust is literally this
  [MOBILE_TYPES.AncientLich]:   Object.freeze({ C1: Object.freeze([IDX.LichDust, IDX.WraithEssence, IDX.Ectoplasm, IDX.GhoulsTongue]), C2: Object.freeze([IDX.MummyWrappings]) }),
  // Documented exceptions (see header): nothing in the 23-item pool
  // reads as theirs, so every tier is left out on purpose.
  [MOBILE_TYPES.Vampire]:        Object.freeze({}),
  [MOBILE_TYPES.VampireAncient]: Object.freeze({}),
  [MOBILE_TYPES.Dreugh]:         Object.freeze({}),
  [MOBILE_TYPES.Lamia]:          Object.freeze({}),
});

/** The pool a `tier` ('C1'/'C2'/'C3') roll may pick from for
 *  `mobileType`, given that tier's own vanilla list. A `mobileType`
 *  with no entry here (every human class, every monster not named
 *  above) reads back the vanilla list untouched; one WITH an entry
 *  reads back its curated subset, or an empty list for a tier it
 *  omits - which the caller treats as "nothing to mint this roll",
 *  not as "fall back to vanilla". */
export function themedIngredientPool(mobileType, tier, vanillaPool) {
  const theme = mobileType == null ? undefined : CREATURE_INGREDIENT_THEME[mobileType];
  if (!theme) return vanillaPool;
  return theme[tier] ?? [];
}
