// M4 - THE ENCHANTMENT CATALOGUE: every effect's EnchantmentSettings,
// gathered from the twenty-four effect classes that declare them
// (MIT, Daggerfall Workshop).
//
// Same shape as M1's potion recipes and gathered the same way: DFU
// declares each effect's cost inside the effect class, so a port with
// no broker to register with needs them in one table. All twenty-four
// are here, the three CastWhen* included - their spell prices are
// static tables sitting beside the cost tables, not something the
// spell maker has to supply.
//
// THE SIGN IS THE MECHANIC, and M3's own header described it
// backwards - corrected there and pinned in test/enchanting.test.js.
// A POWER costs POSITIVE points. A SIDE EFFECT costs NEGATIVE points,
// so adding one to the total REDUCES it: taking a drawback BUYS you
// budget. That is the whole trade the item maker offers, and it is
// why M3 sums the two lists together rather than subtracting them.
// The gold walk takes the POWERS ONLY, so the budget a drawback buys
// is free.
//
// FOUR SHAPES, NOT ONE, which is the thing this table has to get
// right, because ClassicParam does not mean the same thing in each:
//
//   `costs`  - indexed BY ClassicParam, which runs 0..n-1. Fourteen
//              effects. (ExtraSpellPts writes its param from a
//              `classicParams` list rather than the loop counter, but
//              that list is the identity 0..10, so it indexes too.)
//   `cost` alone - ONE cost, and the settings it mints carry
//              ClassicParam = **-1**, not 0. Six effects. A caller
//              that passes 0 is asking for a param this effect never
//              mints, and gets null.
//   `cost` + `domain` - one FLAT cost over a whole param domain.
//              EnhancesSkill alone: every one of the thirty-five
//              skills costs the same 900, and the param is the SKILL
//              id.
//   `spells` - keyed by classic SPELL id, which is neither an index
//              nor dense. The three CastWhen*.
//
// So `costs[param]` is the wrong lookup for ten of the twenty-four,
// and enchantmentCost() dispatches on shape instead.
//
// THE SPLIT: fifteen powers to nine side effects. Of the fourteen
// param-table effects it is exactly seven and seven; the six
// single-cost effects split four to two; EnhancesSkill and all three
// CastWhen* price positive. No effect mixes a positive with a
// negative across its own parameters - SoulBound alone mixes zeros in
// among its negatives, and a zero picks no side - which is what makes
// "powers" and "side effects" two lists rather than one list with a
// filter.

import { SKILL_COUNT, SKILL_NAMES } from './skills.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { ENEMY_NAMES } from '../characters/enemyBasics.js';

/** The ClassicParam a SINGLE-cost effect mints (AbsorbsSpells:45 and
 *  its five siblings all write `ClassicParam = -1`). It is a real
 *  value that reaches the saved item, not a "none" sentinel we
 *  invented, so it has to round-trip. */
export const PARAM_NONE = -1;

/** SoulBound enumerates `EnemyBasics.Enemies[i]` for i < 43 (:56-66),
 *  so its params are monster IDs 0-42 and its names are those
 *  enemies' own. */
export const SOUL_COUNT = 43;
const SOUL_NAMES = Object.freeze(ENEMY_NAMES.slice(0, SOUL_COUNT));

/** EnchantmentTypes' cost tables (each effect's own
 *  GetEnchantmentSettings). See the header for the four shapes. The
 *  labels are DFU's own trailing comments, kept because they are the
 *  only names these parameters have. */
export const ENCHANTMENT_COSTS = Object.freeze({
  // --- indexed BY ClassicParam (0..n-1) ---
  BadReactionsFrom: { costs: [-120, -80, -120], labels: ['Humanoids', 'Animals', 'Daedra'] },
  BadRepWith: { costs: [-1000, -1000, -1000, -1000, -1000, -5000], labels: ['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld', 'All'] },
  ExtraSpellPts: { costs: [500, 500, 500, 500, 200, 200, 200, 700, 800, 900, 1000], labels: ['During Winter', 'During Spring', 'During Summer', 'During Fall', 'During Full Moon', 'During Half Moon', 'During New Moon', 'Near Undead', 'Near Daedra', 'Near Humanoids', 'Near Animals'] },
  GoodRepWith: { costs: [1000, 1000, 1000, 1000, 1000, 5000], labels: ['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld', 'All'] },
  HealthLeech: { costs: [-4000, -500, -200], labels: ['Whenever used', 'Unless used daily', 'Unless used weekly'] },
  ImprovesTalents: { costs: [500, 600, 600], labels: ['Hearing', 'Athleticism', 'Adrenaline Rush'] },
  IncreasedWeightAllowance: { costs: [400, 600], labels: ['25% additional', '50% additional'] },
  ItemDeteriorates: { costs: [-3000, -1500, -500], labels: ['all the time', 'in sunlight', 'in holy places'] },
  LowDamageVs: { costs: [-800, -900, -1000, -1200], labels: ['Undead', 'Daedra', 'Humanoid', 'Animals'] },
  PotentVs: { costs: [800, 900, 1000, 1200], labels: ['Undead', 'Daedra', 'Humanoid', 'Animals'] },
  RegensHealth: { costs: [4000, 3000, 3000], labels: ['all the time', 'in sunlight', 'in darkness'] },
  SoulBound: { costs: [0, -10, -20, 0, 0, 0, 0, -10, -30, -90, -100, 0, -10, -30, -140, 0, -30, 0, -300, -100, 0, -30, -30, -300, -10, -500, -500, -100, -700, -1500, -1000, -8000, -1000, -2500, 0, -300, -300, -300, -300, 0, -5000, -100, -100] },
  UserTakesDamage: { costs: [-6000, -1000], labels: ['in sunlight', 'in holy places'] },
  VampiricEffect: { costs: [2000, 1000], labels: ['at range', 'when strikes'] },

  // --- ONE cost, minted at ClassicParam -1 ---
  AbsorbsSpells: { cost: 1500 },
  ExtraWeight: { cost: -100 },
  FeatherWeight: { cost: 100 },
  RepairsObjects: { cost: 900 },
  StrengthensArmor: { cost: 700 },
  WeakensArmor: { cost: -700 },

  // --- one FLAT cost over a param DOMAIN ---
  EnhancesSkill: { cost: 900, domain: SKILL_COUNT },

  // --- keyed by classic SPELL id ---
  CastWhenUsed: {
    spells: [
      [4, 330, 'Levitate'], [5, 250, 'Light'], [6, 540, 'Invisibility'], [7, 480, "Wizard's Fire"],
      [8, 380, 'Shock'], [9, 480, 'Strength Leech'], [10, 1650, 'Free Action'], [18, 900, 'Open'],
      [11, 1560, 'Resist Cold'], [12, 1560, 'Resist Fire'], [13, 1560, 'Resist Shock'], [19, 1740, 'Wizard Lock'],
      [14, 470, 'Fireball'], [15, 1020, 'Cure Poison'], [16, 990, 'Ice Bolt'], [17, 1040, 'Shield'],
      [22, 1980, 'Spell Shield'], [23, 1530, 'Silence'], [24, 920, "Troll's Blood"], [20, 1420, 'Ice Storm'],
      [25, 840, 'Fire Storm'], [26, 1650, 'Resist Poison'], [33, 1020, 'Wildfire'], [27, 1300, 'Spell Drain'],
      [28, 2290, 'Far Silence'], [29, 1020, 'Toxic Cloud'], [34, 1610, 'Wizard Rend'], [30, 1930, "Shalidor's Mirror"],
      [31, 760, 'Lightning'], [35, 2140, "Medusa's Gaze"], [36, 3030, 'Force Bolt'], [32, 1750, "Gods' Fire"],
      [40, 130, 'Stamina'], [64, 360, 'Heal'], [60, 930, "Balyna's Antidote"], [94, 480, 'Recall'],
    ],
  },
  CastWhenHeld: {
    spells: [
      [37, 240, 'Slowfalling'], [39, 1230, 'Spell Resistance'], [41, 170, 'Water Walking'], [10, 1650, 'Free Action'],
      [42, 170, 'Water Breathing'], [11, 1560, 'Resist Cold'], [12, 1560, 'Resist Fire'], [26, 1560, 'Resist Poison'],
      [13, 1560, 'Resist Shock'], [6, 540, 'Invisibility'], [44, 210, 'Chameleon'], [45, 150, 'Shadow Form'],
      [46, 1720, 'Spell Reflection'], [24, 920, "Troll's Blood"], [47, 1720, 'Spell Absorption'], [4, 330, 'Levitate'],
      [49, 1590, 'Tongues'], [82, 1020, 'Orc Strength'], [83, 1200, 'Wisdom'], [84, 1200, 'Iron Will'],
      [85, 1200, 'Nimbleness'], [86, 1200, 'Feet of Notorgo'], [87, 1200, 'Fortitude'], [88, 1200, 'Charisma'],
      [89, 1200, 'Jack of Trades'],
    ],
  },
  CastWhenStrikes: {
    spells: [
      [50, 1620, 'Paralysis'], [53, 780, 'Hand of Sleep'], [52, 1380, 'Vampiric Touch'], [54, 930, 'Magicka Leech'],
      [56, 1830, 'Hand of Decay'], [33, 1020, 'Wildfire'], [20, 840, 'Ice Storm'], [25, 840, 'Fire Storm'],
      [16, 990, 'Ice Bolt'], [7, 480, "Wizard's Fire"], [55, 4230, 'Sphere of Negation'], [67, 1260, 'Energy Leech'],
    ],
  },
});

/** Every cost an effect can charge, whatever shape it stores them in
 *  - the one place the four shapes are flattened, so the sign
 *  classification below cannot disagree with the lookup above. */
function allCosts(row) {
  if (!row) return [];
  if (row.costs) return row.costs;
  if (row.spells) return row.spells.map(([, c]) => c);
  return [row.cost];
}

/** The cost of one enchantment at one parameter. An unknown effect or
 *  a parameter this effect never mints answers null rather than 0 - a
 *  missing cost must not read as a free enchantment. */
export function enchantmentCost(type, param) {
  const row = ENCHANTMENT_COSTS[type];
  if (!row) return null;
  const p = param === undefined ? defaultParam(type) : param;
  if (row.costs) {
    const cost = row.costs[p];
    return (Number.isInteger(p) && p >= 0 && cost !== undefined) ? cost : null;
  }
  if (row.spells) {
    const hit = row.spells.find(([id]) => id === p);
    return hit ? hit[1] : null;
  }
  if (row.domain !== undefined) {
    return (Number.isInteger(p) && p >= 0 && p < row.domain) ? row.cost : null;
  }
  return p === PARAM_NONE ? row.cost : null;
}

/** Every ClassicParam this effect actually mints, in MINT ORDER -
 *  which for a spell effect is DFU's own list order and not sorted,
 *  because that is the order its picker lists them in. */
export function enchantmentParamValues(type) {
  const row = ENCHANTMENT_COSTS[type];
  if (!row) return [];
  if (row.costs) return row.costs.map((_, i) => i);
  if (row.spells) return row.spells.map(([id]) => id);
  if (row.domain !== undefined) return Array.from({ length: row.domain }, (_, i) => i);
  return [PARAM_NONE];
}

/** The FIRST ClassicParam an effect mints, which is what a caller
 *  that names no parameter is asking for: 0 for a param table or a
 *  domain, -1 for a single-cost effect, and the first SPELL id for a
 *  CastWhen* - Levitate, not spell zero. */
export const defaultParam = (type) => enchantmentParamValues(type)[0];

/** The parameter labels DFU comments each cost with. A single-cost
 *  effect has none, and EnhancesSkill's are the skill names, which
 *  skills.js already owns - so it has none here either. */
/** The names the SECONDARY picker prints, which is what the alpha
 *  sort orders by. Two effects do not own theirs: EnhancesSkill's are
 *  the skill names and SoulBound's are the enemy names, and skills.js
 *  and enemyBasics.js are those names' one home - so they are read
 *  from there rather than copied. (DFU's own trailing comments beside
 *  the SoulBound costs are creature names too, but they are code
 *  comments carrying spawn notes, not what the window prints: two of
 *  them read "Dragonling", and so do the two rows the picker shows.) */
export const enchantmentParams = (type) => {
  const row = ENCHANTMENT_COSTS[type];
  if (!row) return [];
  if (type === 'EnhancesSkill') return SKILL_NAMES;
  if (type === 'SoulBound') return SOUL_NAMES;
  if (row.labels) return row.labels;
  if (row.spells) return row.spells.map(([, , name]) => name);
  return [];
};
export const enchantmentTypes = () => Object.keys(ENCHANTMENT_COSTS);

/** A POWER prices positive, a SIDE EFFECT negative - see the header.
 *  Classified off the table itself rather than from a second list,
 *  so the two can never disagree. */
export function isSideEffect(type) {
  const costs = allCosts(ENCHANTMENT_COSTS[type]);
  return costs.length > 0 && costs.every((c) => c <= 0) && costs.some((c) => c < 0);
}
export function isPower(type) {
  const costs = allCosts(ENCHANTMENT_COSTS[type]);
  return costs.length > 0 && costs.every((c) => c >= 0) && costs.some((c) => c > 0);
}
export const powerTypes = () => enchantmentTypes().filter(isPower);
export const sideEffectTypes = () => enchantmentTypes().filter(isSideEffect);

/** One enchantment as M3's sums consume it. `parent` is the KEY of the
 *  enchantment that dragged this one in, 0 for a chosen one.
 *
 *  DFU marks the parent with EnchantmentSettings.GetHashCode(), whose
 *  inputs - version, effect key, classic type and param, the two
 *  display names, the cost - are every field except ParentEnchantment
 *  itself, and all of them are functions of (type, param). So
 *  `type:param` is the same equivalence class expressed as a string,
 *  and it survives a save where a .NET string hash would not. */
export const enchantmentKey = (type, param) => `${type}:${param}`;

export function enchantmentSettings(type, param, { parent = 0 } = {}) {
  const cost = enchantmentCost(type, param);
  if (cost === null) return null;
  const p = param === undefined ? defaultParam(type) : param;
  return { type, param: p, enchantCost: cost, parentEnchantment: parent, key: enchantmentKey(type, p) };
}

// SoulBound.MobileForcedEnchantmentSets (:219-332). THE ONLY SOURCE
// OF FORCED ENCHANTMENTS IN THE GAME - GetForcedEnchantments is
// overridden by SoulBound and by nothing else, so M3's forced-vs-
// chosen split exists entirely to serve bound souls. Nine of the
// forty-three soul types carry one; DFU's own notes say the three
// atronach crossovers (Air, Earth, Water) are souls classic has and
// DFU cannot yet trap, and leaves them as TODOs - kept as TODOs here.
export const SOUL_FORCED_ENCHANTMENTS = Object.freeze({
  [MOBILE_TYPES.DaedraLord]: Object.freeze([
    { type: 'PotentVs', param: 1 },            // Daedra
    { type: 'UserTakesDamage', param: 1 },     // InHolyPlaces
    { type: 'ExtraWeight', param: PARAM_NONE },
  ]),
  [MOBILE_TYPES.DaedraSeducer]: Object.freeze([
    { type: 'GoodRepWith', param: 5 },         // All
    { type: 'ItemDeteriorates', param: 1 },    // InSunlight
    { type: 'UserTakesDamage', param: 1 },     // InHolyPlaces
    { type: 'HealthLeech', param: 2 },         // UnlessUsedWeekly
    { type: 'BadReactionsFrom', param: 1 },    // Animals
  ]),
  [MOBILE_TYPES.Daedroth]: Object.freeze([
    { type: 'LowDamageVs', param: 1 },         // Daedra
    { type: 'BadReactionsFrom', param: 2 },    // Daedra
    { type: 'ItemDeteriorates', param: 2 },    // InHolyPlaces
  ]),
  [MOBILE_TYPES.FireAtronach]: Object.freeze([
    { type: 'CastWhenUsed', param: 12 },       // Resist Fire
  ]),
  [MOBILE_TYPES.FireDaedra]: Object.freeze([
    { type: 'EnhancesSkill', param: 9 },       // Daedric
    { type: 'CastWhenUsed', param: 12 },       // Resist Fire
    { type: 'BadReactionsFrom', param: 1 },    // Animals
  ]),
  [MOBILE_TYPES.FrostDaedra]: Object.freeze([
    { type: 'EnhancesSkill', param: 9 },       // Daedric
    { type: 'CastWhenUsed', param: 11 },       // Resist Cold
    { type: 'ItemDeteriorates', param: 2 },    // InHolyPlaces
  ]),
  [MOBILE_TYPES.Ghost]: Object.freeze([
    { type: 'FeatherWeight', param: PARAM_NONE },
    { type: 'ItemDeteriorates', param: 2 },    // InHolyPlaces
    { type: 'LowDamageVs', param: 0 },         // Undead
  ]),
  [MOBILE_TYPES.Lich]: Object.freeze([
    { type: 'EnhancesSkill', param: 22 },      // Destruction
    { type: 'ItemDeteriorates', param: 1 },    // InSunlight
    { type: 'LowDamageVs', param: 0 },         // Undead
  ]),
  [MOBILE_TYPES.Wraith]: Object.freeze([
    { type: 'RegensHealth', param: 2 },        // InDarkness
    { type: 'ItemDeteriorates', param: 2 },    // InHolyPlaces
    { type: 'LowDamageVs', param: 0 },         // Undead
  ]),
});

/**
 * SortForcedEnchantments (:562-586). The children a chosen
 * enchantment drags in, already split into the two lists and already
 * marked with their parent's key.
 *
 * THE SPLIT HERE IS `EnchantCost > 0`, NOT the catalogue's sign
 * classification: it reads the child's cost AT ITS OWN PARAM, so a
 * zero lands in SIDE EFFECTS. It is a different question from
 * isPower() - that asks what an effect is, this asks where one
 * instance goes - and DFU asks it with a strict `>`.
 *
 * A child whose effect or param does not resolve is SKIPPED, not
 * defaulted (:571-575: `if (effect == null) continue`).
 */
export function forcedEnchantments(type, param) {
  if (type !== 'SoulBound') return null;
  const set = SOUL_FORCED_ENCHANTMENTS[param];
  if (!set) return null;
  const parent = enchantmentKey(type, param);
  const powers = [];
  const sideEffects = [];
  for (const child of set) {
    const settings = enchantmentSettings(child.type, child.param, { parent });
    if (!settings) continue;
    (settings.enchantCost > 0 ? powers : sideEffects).push(settings);
  }
  return { powers, sideEffects };
}

/** "noRoomInItem" (:892). */
export const NO_ROOM_IN_ITEM = 'There is no room in the item for these enchantments.';

/**
 * EnchantmentPicker_OnItemPicked's room check (:884-897) as a
 * decision. TWO THINGS ARE OBSERVABLE HERE AND BOTH ARE ODD:
 *
 *   the `+1` is the INCOMING enchantment, which is not in either list
 *   yet - so the check is on what the lists would hold afterwards;
 *
 *   and the whole check sits INSIDE `if (forcedEnchantmentSet !=
 *   null)`. An enchantment with no forced children is never checked
 *   for room at all, so a player can pile plain enchantments past ten
 *   and meet no refusal - M3's SetEnchantments cap is what finally
 *   truncates them, silently. Only a bound soul can be refused for
 *   room.
 *
 * Answers { kind: 'noRoom', text } or { kind: 'add', powers,
 * sideEffects } with the forced children to add alongside.
 */
export function pickEnchantment(type, param, { powers = [], sideEffects = [] } = {}) {
  const settings = enchantmentSettings(type, param);
  if (!settings) return null;
  const forced = forcedEnchantments(type, param);
  if (forced) {
    const after = powers.length + sideEffects.length
      + forced.powers.length + forced.sideEffects.length + 1;
    if (after > 10) return { kind: 'noRoom', text: NO_ROOM_IN_ITEM };
  }
  return {
    kind: 'add',
    settings,
    powers: forced ? forced.powers : [],
    sideEffects: forced ? forced.sideEffects : [],
  };
}

/** RemoveForcedEnchantments (:916-917, EnchantmentListPicker:270).
 *  Removing a PARENT takes its children out of both lists with it; a
 *  child removed on its own takes nothing. */
export function removeEnchantment(list, key) {
  return list.filter((e) => e.key !== key && e.parentEnchantment !== key);
}

// ── the two pickers' filters (DaggerfallItemMakerWindow:614-700,
//    :820-866) ──────────────────────────────────────────────────────

/** MagicAndEffectsEnums.ItemMakerFlags (:65-72). */
export const ITEM_MAKER_FLAGS = Object.freeze({
  None: 0,
  AllowMultiplePrimaryInstances: 1,
  AllowMultipleSecondaryInstances: 2,
  AlphaSortSecondaryList: 4,
  WeaponOnly: 8,
});

/** Each effect's own SetProperties flags. FOUR of the twenty-four
 *  carry NONE - the two weight effects and the two armor effects -
 *  and IncreasedWeightAllowance sets no flags line at all, which is
 *  the same thing. Those five plus SoulBound are the six that can
 *  appear on an item only ONCE. */
export const ITEM_MAKER_EFFECT_FLAGS = Object.freeze({
  AbsorbsSpells: 1,
  BadReactionsFrom: 1,
  BadRepWith: 1,
  CastWhenHeld: 1 | 4,
  CastWhenStrikes: 1 | 4 | 8,
  CastWhenUsed: 1 | 4,
  EnhancesSkill: 1 | 4,
  ExtraSpellPts: 1,
  ExtraWeight: 0,
  FeatherWeight: 0,
  GoodRepWith: 1,
  HealthLeech: 1,
  ImprovesTalents: 1,
  IncreasedWeightAllowance: 0,
  ItemDeteriorates: 1 | 2,
  LowDamageVs: 1 | 8,
  PotentVs: 1 | 8,
  RegensHealth: 1,
  RepairsObjects: 1,
  SoulBound: 4,
  StrengthensArmor: 0,
  UserTakesDamage: 1 | 2,
  VampiricEffect: 1,
  WeakensArmor: 0,
});
export const hasItemMakerFlag = (type, flag) => ((ITEM_MAKER_EFFECT_FLAGS[type] ?? 0) & flag) !== 0;

/**
 * IsEnchantmentExclusiveTo, gathered from the EIGHT effects that
 * override it. Two kinds, and the difference is observable:
 *
 *   `pairs` - exclusive with NO param test. FeatherWeight/ExtraWeight
 *     and StrengthensArmor/WeakensArmor. One of the pair on the item
 *     bars the other outright.
 *
 *   `sameParam` - exclusive only at the MATCHING param. PotentVs vs
 *     LowDamageVs, GoodRepWith vs BadRepWith. Potent vs Undead bars
 *     Low Damage vs Undead and nothing else, so an item can be potent
 *     against undead and feeble against animals at once.
 *
 * ...and `allParam` is the reputation pair's SELF test: once "All" is
 * on the item that effect is barred entirely, and picking "All" is
 * barred while any single group of it is present.
 *
 * WHICH CLAUSES CAN FIRE DEPENDS ON THE STAGE, because DFU calls this
 * with no comparerParam from the PRIMARY picker (:651-653) and with
 * one from the SECONDARY (:858-860). So at the primary stage only
 * `pairs` and the "self once All" half can fire; every param-matched
 * clause waits for the secondary list. Passing no param here means
 * the primary stage, exactly as a null comparerParam does there.
 */
export const ENCHANTMENT_EXCLUSIONS = Object.freeze({
  FeatherWeight: { pairs: ['ExtraWeight'] },
  ExtraWeight: { pairs: ['FeatherWeight'] },
  StrengthensArmor: { pairs: ['WeakensArmor'] },
  WeakensArmor: { pairs: ['StrengthensArmor'] },
  PotentVs: { sameParam: ['LowDamageVs'] },
  LowDamageVs: { sameParam: ['PotentVs'] },
  GoodRepWith: { sameParam: ['BadRepWith'], allParam: 5 },
  BadRepWith: { sameParam: ['GoodRepWith'], allParam: 5 },
});

export function isExclusiveTo(type, list = [], param) {
  const rule = ENCHANTMENT_EXCLUSIONS[type];
  if (!rule) return false;
  for (const e of list) {
    if (rule.allParam !== undefined && e.type === type) {
      if (e.param === rule.allParam) return true;
      if (param !== undefined && e.param !== rule.allParam && param === rule.allParam) return true;
    }
    if (rule.pairs?.includes(e.type)) return true;
    if (param !== undefined && rule.sameParam?.includes(e.type) && e.param === param) return true;
  }
  return false;
}

/**
 * PowersButton/SideEffectsButton_OnMouseClick's primary list
 * (:637-656). THREE filters, in DFU's order: an effect already on the
 * item unless it allows multiple primaries; a weapon-only effect on a
 * non-weapon; and anything the current lists are exclusive to.
 */
export function primaryPickerList(selectingPowers, { item = null, powers = [], sideEffects = [] } = {}) {
  const own = selectingPowers ? powers : sideEffects;
  return (selectingPowers ? powerTypes() : sideEffectTypes()).filter((type) => {
    if (!hasItemMakerFlag(type, ITEM_MAKER_FLAGS.AllowMultiplePrimaryInstances)
      && own.some((e) => e.type === type)) return false;
    if (hasItemMakerFlag(type, ITEM_MAKER_FLAGS.WeaponOnly) && item?.group !== 'Weapons') return false;
    return !(isExclusiveTo(type, powers) || isExclusiveTo(type, sideEffects));
  });
}

/**
 * EnchantmentPrimaryPicker_OnUseSelectedItem (:820-866).
 *
 * THE SINGLETON SHORTCUT (:832-838) comes first: an effect with
 * exactly ONE setting is added straight to the list and no secondary
 * picker opens - which is what the six single-cost effects do. DFU
 * also excludes SoulBound from that shortcut by name, but SoulBound
 * mints forty-three settings and can never reach a length of one, so
 * the clause is defensive and cannot fire (kept, Ledger B).
 *
 * Answers { kind: 'add', settings } or { kind: 'choose', options }.
 */
export function primaryPick(type, { powers = [], sideEffects = [], selectingPowers = true } = {}) {
  const params = enchantmentParamValues(type);
  if (params.length === 0) return null;
  if (params.length === 1 && type !== 'SoulBound') {
    return { kind: 'add', settings: enchantmentSettings(type, params[0]) };
  }
  const own = selectingPowers ? powers : sideEffects;
  const labels = enchantmentParams(type);
  let options = params.map((param, i) => ({
    param, label: labels[i] ?? String(param), settings: enchantmentSettings(type, param),
  }));
  if (hasItemMakerFlag(type, ITEM_MAKER_FLAGS.AlphaSortSecondaryList)) {
    options = options.slice().sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  }
  options = options.filter((o) => {
    if (!hasItemMakerFlag(type, ITEM_MAKER_FLAGS.AllowMultipleSecondaryInstances)
      && own.some((e) => e.type === type && e.param === o.param)) return false;
    return !(isExclusiveTo(type, powers, o.param) || isExclusiveTo(type, sideEffects, o.param));
  });
  return { kind: 'choose', options };
}

/** GroupName - what the PRIMARY picker and the list's first line
 *  print. DFU looks it up by EffectKey through TextManager, and the
 *  EffectKey IS the enum name; its English strings are that name with
 *  a space before each interior capital, which is the same derivation
 *  U10 made for the skill names. Derived rather than listed, so a
 *  name can never drift from the key it belongs to. */
export const enchantmentName = (type) => type.replace(/([a-z])([A-Z])/g, '$1 $2');
