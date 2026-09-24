// LR1-LR3 (2026-09-14, Mac: "building on unleveled loot. My goal is to
// transform things into a diablo style system with rarity ... Make
// this the most detailed and best that it can be"): LOOT RARITY - the
// port's own item ladder over Daggerfall's loot. ENHANCED, the port's
// departure from DFU's rules, ON by default (LR5, 2026-09-15, Mac: "I
// want to mod on by default" - it shipped off beside the enhanced AI,
// and Mac's call is that the ladder is the port's own game rather than
// something a player has to go and ask for) and on for everyone online
// (OL1). Off, not one field is written and not one read moves: DFU's
// loot, exactly - so the 1:1 lane is one press away, not lost.
//
// THE LADDER. Five tiers, and Daggerfall already had three of them:
//   common     - a plain item, DFU's own mint, untouched
//   magic      - an item with one or two AFFIXES (below), or one of
//                DFU's own MAGIC.DEF items (which are the same idea:
//                a plain item with enchantments and a name)
//   rare       - three or four affixes, a generated two-part name, and
//                ONE of DFU's own catalogue enchantments as its flavour
//   legendary  - a fixed record from LEGENDARIES: a name, a set affix
//                signature and its own DFU enchantment
//   artifact   - DFU's artifacts, untouched, the top of the ladder
//
// REPLACE, DON'T LAYER. With the switch on there is ONE ladder: every
// enchanted item is at least Magic (rarityOf derives it), every rolled
// item wears its tier, and artifacts are the ceiling. DFU's own
// magic-item roll (the loot matrices' MI column) still runs and its
// products ARE Magic-tier items; the port does not re-roll them.
//
// AFFIXES ARE NUMBERS THE PLAYER CAN READ. DFU's enchantment catalogue
// is spell-shaped (Cast When Strikes, Regens Health) - fine flavour,
// weak as a comparison loop. The port's affixes are the numbers a
// Diablo player compares two swords by: +damage%, +armour, +attribute,
// +resistance, +skill, +carrying capacity. They ride an `affixes` list
// on the item, folded onto the wearer as ONE of the entity's folds
// (RF1: systems/entityMods.js - affixFold, registered there, summed
// with every other fold at the equip seam and the magic round, and
// read by DFU's formulas through one accessor per channel: the hit
// formula's armour term, the weapon damage roll, liveStat, skillValue,
// savingThrow, entityMaxEncumbrance). They are NOT entries in `item.enchantments`:
// that list is FallExe's closed enum, and a foreign type in it would
// make every DFU reader of the list (the value sum, the item maker,
// the payload dispatcher's unknown-key abort) affix-aware. Two lists,
// one wearer.
//
// RARITY FOLLOWS THE SOURCE, NOT THE PLAYER. Unleveled Loot's whole
// point is that the world does not scale to you, and this keeps that
// law: the roll reads the SOURCE's tier - the dead thing's level, the
// dungeon's kind - and luck. A Daedra Lord's corpse in a Volcanic Cave
// can drop a Legendary at level 3; a rat never does.
//
// IDENTIFY IS DAGGERFALL'S OWN. A Rare or Legendary carries a real DFU
// enchantment, so DFU's own IsIdentified law (tradeModes.itemIsIdentified:
// an enchanted item is unidentified until identified) makes it drop
// UNIDENTIFIED with no new mechanism: the Identify spell and the Mages
// Guild's service reveal it, and until then it reads as its bare
// template with no material and no affix lines. A Magic-tier item with
// only numeric affixes has no enchantment and so reads at once, as a
// plain item does. The affixes WORK while unidentified - DFU's
// enchantments do too.
//
// ONE TUNING TABLE. Every drop weight is RARITY_WEIGHTS and SOURCE_MULT
// below, per mille, so the feel can be tuned without touching a roll.

import { getPref } from './uiPrefs.js';
import { armorBodyParts, equipTableOf } from './equip.js';   // LR4: the parts a piece covers, the foe's worn table
import { registerEntityFold, registerWeaponDamageMod, newMods, EMPTY_MODS } from './entityMods.js';   // RF1: the fold is one of the entity's, read once per channel
import { templateByIndex, itemBaseValue, isAmmunition } from './itemTemplates.js';   // AUDIT 68 S27-ammo-arrow-only: the ammunition registry's home
import { STAT_KEYS_ORDER } from './statMods.js';
import { SKILL_NAMES, SKILL_COUNT } from './skills.js';
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { enchantmentName, enchantmentParamName } from './enchantmentCatalogue.js';

export const LOOT_RARITY_KEY = 'lootRarity';
/** The switch. Read at every seam, so a press takes effect on the next
 *  roll and the next fold. */
export const lootRarityOn = () => !!getPref(LOOT_RARITY_KEY);

// ── the tiers ───────────────────────────────────────────────────────
export const RARITY_ORDER = Object.freeze(['common', 'magic', 'rare', 'legendary', 'artifact']);
/** Label, the skin colour (the enhanced sheet's rules read the id; the
 *  native scroller tints the cell with `tint`), and the rank. */
export const RARITIES = Object.freeze({
  common:    Object.freeze({ rank: 0, label: 'Common',    colour: '#e9e4d9', tint: null }),
  magic:     Object.freeze({ rank: 1, label: 'Magic',     colour: '#6f9ee8', tint: Object.freeze([0.22, 0.40, 0.80, 0.45]) }),
  rare:      Object.freeze({ rank: 2, label: 'Rare',      colour: '#e4c34f', tint: Object.freeze([0.80, 0.68, 0.18, 0.45]) }),
  legendary: Object.freeze({ rank: 3, label: 'Legendary', colour: '#e07a2e', tint: Object.freeze([0.85, 0.42, 0.10, 0.50]) }),
  artifact:  Object.freeze({ rank: 4, label: 'Artifact',  colour: '#b57bee', tint: Object.freeze([0.60, 0.35, 0.85, 0.50]) }),
});
export const ROLLED_TIERS = Object.freeze(['magic', 'rare', 'legendary']);

const enchanted = (item) => !!(item?.enchantments?.length || item?.customEnchantments?.length);

/** The tier an item wears - its own field when it rolled one, else
 *  derived: an artifact is the ceiling, any enchanted item (DFU's
 *  MAGIC.DEF loot, a made item, a soul-bound one) is Magic, and the
 *  rest is Common. Pure; answers whatever the switch says, so a
 *  caller that draws a tier gates on lootRarityOn() itself. */
export function rarityOf(item) {
  if (!item) return 'common';
  if (item.artifact) return 'artifact';
  if (typeof item.rarity === 'string' && RARITIES[item.rarity] && item.rarity !== 'artifact') return item.rarity;
  return item.magic || enchanted(item) ? 'magic' : 'common';   // LR4: a MAGIC.DEF row whose effects all filtered out is still DFU's magic item
}
export const rarityRank = (item) => RARITIES[rarityOf(item)].rank;

/** What may roll a tier: a weapon that is not an arrow, a piece of
 *  armour, a piece of jewellery. Never a quest item, an artifact, a
 *  DFU magic item (it is already Magic and keeps DFU's name), an item
 *  that already rolled (LR4: one roll per item, ever), or a worn one. */
/** AMMUNITION IS NEVER PROMOTED. DFU's own reason is the Arrow's: a
 *  stack is not an item you compare, and promoting one ENCHANTS it,
 *  which makes it unstackable (isStackable refuses an enchanted item)
 *  - so a quiver of twenty becomes twenty rows the player has to
 *  carry one at a time. What is ammunition is itemTemplates.js's
 *  registry (isAmmunition), where a mod's own registers.
 *
 *  AUDIT-THUNDERLOCK F4: the Pellet was eligible. A found stack could
 *  roll Magic and shatter itself. */
export function rarityEligible(item) {
  if (!item || item.questItem || item.artifact || item.magic || item.rarity || enchanted(item) || item.equipSlot != null) return false;
  if (item.group === 'Weapons') return !isAmmunition(item);
  return item.group === 'Armor' || item.group === 'Jewellery';
}

// ── the source and the roll ─────────────────────────────────────────
/** The port's own grading of DFU's nineteen dungeon kinds (DFRegion.
 *  DungeonTypes order), 0..21 - the SOURCE tier a treasure pile in that
 *  dungeon rolls at. Not Unleveled Loot's ladder (that is the mod's,
 *  for materials); this one grades by how deadly the kind's own
 *  monster table runs, which is what a Diablo drop rate follows. */
export const DUNGEON_RARITY_TIER = Object.freeze([
  9,    // 0 Crypt
  9,    // 1 OrcStronghold
  6,    // 2 HumanStronghold
  5,    // 3 Prison
  15,   // 4 DesecratedTemple
  4,    // 5 Mine
  4,    // 6 NaturalCave
  13,   // 7 Coven
  14,   // 8 VampireHaunt
  10,   // 9 Laboratory
  7,    // 10 HarpyNest
  6,    // 11 RuinedCastle
  5,    // 12 SpiderNest
  8,    // 13 GiantStronghold
  18,   // 14 DragonsDen
  11,   // 15 BarbarianStronghold
  18,   // 16 VolcanicCaves
  5,    // 17 ScorpionNest
  3,    // 18 Cemetery
]);
export const dungeonRarityTier = (dungeonType) => DUNGEON_RARITY_TIER[dungeonType] ?? 0;
/** A tavern's or a guild's treasure marker: the town's own tier. */
export const INTERIOR_RARITY_TIER = 4;
/** A monster of this level or over, or any Daedra, is a BOSS source. */
export const BOSS_LEVEL = 18;

/** The corpse source for an enemy: its own level (a class enemy has
 *  none in ENEMY_BASICS and scales to the player, so its entity level
 *  stands in), boss when it is a Daedra or high enough. */
export function corpseSource(basics, entityLevel = 1) {
  const level = Math.max(1, (basics?.level ?? entityLevel) | 0);
  const boss = basics?.affinity === 'Daedra' || level >= BOSS_LEVEL;
  return { kind: 'corpse', tier: level, boss };
}
export const pileSource = (tier, boss = false) => ({ kind: 'pile', tier: Math.max(0, tier | 0), boss });

/** THE TUNING TABLE. Per mille of reaching AT LEAST the tier: `base`
 *  at source tier 0, `perTier` more per tier point, never over `cap`.
 *  Luck adds LUCK_PER_POINT per point over 50 (and takes it under),
 *  and a source kind multiplies the lot. */
export const RARITY_WEIGHTS = Object.freeze({
  magic:     Object.freeze({ base: 100, perTier: 15,  cap: 600 }),
  rare:      Object.freeze({ base: 15,  perTier: 6,   cap: 260 }),
  legendary: Object.freeze({ base: 1,   perTier: 1.2, cap: 45 }),
});
export const SOURCE_MULT = Object.freeze({ corpse: 1, pile: 1.3, boss: 2.5 });
export const LUCK_PER_POINT = 2;

/** The three thresholds, per mille, for one source at one luck. */
export function rarityChances({ kind = 'corpse', tier = 0, boss = false, luck = 50 } = {}) {
  const mult = boss ? SOURCE_MULT.boss : (SOURCE_MULT[kind] ?? 1);
  const luckMod = (Math.max(0, Math.min(100, luck | 0)) - 50) * LUCK_PER_POINT;
  const at = (w) => Math.max(0, Math.min(w.cap, (w.base + w.perTier * Math.max(0, tier)) * mult + luckMod));
  const magic = at(RARITY_WEIGHTS.magic);
  const rare = Math.min(magic, at(RARITY_WEIGHTS.rare));
  const legendary = Math.min(rare, at(RARITY_WEIGHTS.legendary));
  return { magic, rare, legendary };
}

/** One roll in [0, 1000) against the thresholds, highest tier first. */
export function rollRarity(source, rolls = Math.random) {
  const c = rarityChances(source);
  const r = rolls() * 1000;
  if (r < c.legendary) return 'legendary';
  if (r < c.rare) return 'rare';
  if (r < c.magic) return 'magic';
  return 'common';
}

// ── THE UNIQUE FIND ─────────────────────────────────────────────────
//
// Mac, 2026-09-19, of the Dwarven Thunderlock: "This weapon wont be
// available for purchase and should be one of the rarest items to find
// in the game."
//
// A TIER IS NOT A THING. Everything above decorates an item that DFU's
// own loot roll already produced - a Legendary is a sword the matrices
// minted, wearing a name. A unique find is the other question: an item
// that DFU's roll CANNOT produce, appearing at all. So it is its own
// roll, once per list rather than once per item, and it ADDS to the
// list instead of promoting something in it.
//
// AND IT IS REGISTERED, NOT NAMED. This file is the port's loot
// ladder; it has no business knowing that a gun exists. A weapon that
// wants to be findable registers itself (systems/thunderlock.js does,
// at import), which is the same shape registerCustomTemplates and the
// equip-sound sink already have.
//
// THE NUMBERS. Base zero: at source tier 0 - a rat, a shallow crypt -
// the chance is NOTHING, not "small". It only begins at `minTier`, and
// even then it is per mille of a per mille's worth of drops: 0.35 per
// tier point, capped at 6 (0.6%), times the source multiplier, plus
// luck. A Daedra Lord in a Volcanic Cave is the case this is for.
const _uniqueFinds = [];
export const UNIQUE_WEIGHTS = Object.freeze({ base: 0, perTier: 0.35, cap: 6 });

/**
 * Register a find. `mint(rolls)` answers the ITEMS to add (a list, so
 * a weapon can arrive with the ammunition it would be useless
 * without); `minTier` is the source tier it first becomes possible at;
 * `weight` scales its own chance against the others.
 */
export function registerUniqueFind(find) {
  if (!find?.id || typeof find.mint !== 'function') return _uniqueFinds.length;
  if (!_uniqueFinds.some((f) => f.id === find.id)) {
    _uniqueFinds.push(Object.freeze({ minTier: 4, weight: 1, ...find }));
  }
  return _uniqueFinds.length;
}
export const uniqueFinds = () => _uniqueFinds.slice();

/** Per mille that a qualifying source yields THIS find. */
export function uniqueFindChance(find, { kind = 'corpse', tier = 0, boss = false, luck = 50 } = {}) {
  if (!find || tier < (find.minTier ?? 4)) return 0;
  const mult = boss ? SOURCE_MULT.boss : (SOURCE_MULT[kind] ?? 1);
  const luckMod = (Math.max(0, Math.min(100, luck | 0)) - 50) * 0.02;   // a hundredth of the tier roll's - luck helps, it does not hand it over
  const w = UNIQUE_WEIGHTS;
  return Math.max(0, Math.min(w.cap, (w.base + w.perTier * Math.max(0, tier)) * mult * (find.weight ?? 1) + luckMod));
}

/** Roll every registered find against one source. Answers the items to
 *  add - almost always none. */
export function rollUniqueFinds(source, rolls = Math.random) {
  const out = [];
  for (const find of _uniqueFinds) {
    const chance = uniqueFindChance(find, source);
    if (chance <= 0) continue;
    if (rolls() * 1000 < chance) out.push(...(find.mint(rolls) ?? []));
  }
  return out;
}

/** A legendary record a mod adds - the pool is DFU-shaped but not
 *  DFU's, so it is allowed to grow. */
const _customLegendaries = [];
export function registerLegendary(record) {
  if (!record?.id) return _customLegendaries.length;
  if (!_customLegendaries.some((l) => l.id === record.id)) _customLegendaries.push(Object.freeze(record));
  return _customLegendaries.length;
}

// ── the affixes ─────────────────────────────────────────────────────
/** The five elements a resistance affix names - the saving throw's own
 *  Fire/Frost/Shock/Poison/Magic flags (spellcast.js EFFECT_FLAGS), by
 *  name here so this leaf owes the formulas no import. */
export const RESIST_ELEMENTS = Object.freeze(['fire', 'frost', 'shock', 'poison', 'magic']);
const ELEMENTS = RESIST_ELEMENTS;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The value bands per rolled tier: [min, max] inclusive. */
export const AFFIX_RANGES = Object.freeze({
  damage: Object.freeze({ magic: [5, 12],  rare: [10, 25], legendary: [20, 40] }),   // % on the weapon's own roll
  armor:  Object.freeze({ magic: [3, 6],   rare: [6, 12],  legendary: [12, 20] }),   // points off every blow's chance to land
  stat:   Object.freeze({ magic: [2, 5],   rare: [5, 10],  legendary: [10, 15] }),   // on one attribute
  resist: Object.freeze({ magic: [10, 20], rare: [20, 35], legendary: [35, 50] }),   // on the saving throw against one element
  skill:  Object.freeze({ magic: [5, 10],  rare: [10, 20], legendary: [20, 30] }),   // on one skill
  weight: Object.freeze({ magic: [10, 20], rare: [20, 35], legendary: [35, 50] }),   // % carrying capacity
});
/** How many affixes a tier rolls: [min, max]. A Legendary's are its record's. */
export const AFFIX_COUNTS = Object.freeze({ magic: [1, 2], rare: [3, 4] });

const STAT_SUFFIX = Object.freeze({
  strength: ['of the Ox', 'of the Bear', 'of the Titan'],
  intelligence: ['of the Owl', 'of the Sage', 'of the Archmage'],
  willpower: ['of the Oak', 'of Iron Will', 'of the Unbroken'],
  agility: ['of the Cat', 'of the Falcon', 'of the Wind'],
  endurance: ['of the Boar', 'of the Mountain', 'of the Ageless'],
  personality: ['of the Peacock', 'of the Silver Tongue', 'of Kings'],
  speed: ['of the Hare', 'of the Stag', 'of Lightning'],
  luck: ['of the Fox', 'of Fortune', 'of the Gods'],
});
const RESIST_SUFFIX = Object.freeze({
  fire: ['of Embers', 'of Flame', 'of the Inferno'],
  frost: ['of Rime', 'of Winter', 'of the Glacier'],
  shock: ['of Sparks', 'of Storms', 'of the Tempest'],
  poison: ['of Venom', 'of the Serpent', 'of the Antidote'],
  magic: ['of Warding', 'of the Ward', 'of Negation'],
});
const SKILL_SUFFIX = Object.freeze(['of Practice', 'of Skill', 'of Mastery']);
const DAMAGE_PREFIX = Object.freeze(["Soldier's", "Warrior's", "Slayer's"]);
const ARMOR_PREFIX = Object.freeze(["Sentinel's", "Guardian's", "Bulwark"]);
const WEIGHT_PREFIX = Object.freeze(["Porter's", "Mule's", "Giant's"]);
const BAND = Object.freeze({ magic: 0, rare: 1, legendary: 2 });

/** The affix kinds: which groups may carry each, the slot its word
 *  takes in the name, the words, and the label the tooltip prints. A
 *  `param` names the attribute, element or skill; a kind without one
 *  never repeats on an item, a kind with one never repeats a param. */
export const AFFIX_KINDS = Object.freeze({
  damage: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Weapons']), params: null,
    word: (band) => DAMAGE_PREFIX[band], label: (a) => `+${a.value}% damage` }),
  armor:  Object.freeze({ slot: 'prefix', groups: Object.freeze(['Armor']), params: null,
    word: (band) => ARMOR_PREFIX[band], label: (a) => `+${a.value} armor` }),
  weight: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Armor', 'Jewellery']), params: null,
    word: (band) => WEIGHT_PREFIX[band], label: (a) => `+${a.value}% carrying capacity` }),
  stat:   Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons', 'Armor', 'Jewellery']), params: STAT_KEYS_ORDER,
    word: (band, p) => STAT_SUFFIX[p][band], label: (a) => `+${a.value} ${cap(a.param)}` }),
  resist: Object.freeze({ slot: 'suffix', groups: Object.freeze(['Armor', 'Jewellery']), params: ELEMENTS,
    word: (band, p) => RESIST_SUFFIX[p][band], label: (a) => `+${a.value}% ${cap(a.param)} resistance` }),
  skill:  Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons', 'Armor', 'Jewellery']), params: Object.freeze([...Array(SKILL_COUNT).keys()]),
    word: (band) => SKILL_SUFFIX[band], label: (a) => `+${a.value} ${SKILL_NAMES[a.param] ?? 'Skill'}` }),
});
export const AFFIX_IDS = Object.freeze(Object.keys(AFFIX_KINDS));

/** Gold per point of each affix, for the item's value. */
export const AFFIX_WORTH = Object.freeze({ damage: 40, armor: 60, weight: 15, stat: 90, resist: 20, skill: 25 });

const rangeInt = (min, max, rolls) => min + Math.floor(rolls() * (max + 1 - min));
const pick = (list, rolls) => list[Math.floor(rolls() * list.length)];

/** LR4 (the audit): ONE AFFIX RECORD, VALID - a known kind, a param the
 *  kind names (and none for a kind without), an integer value from 1 to
 *  the kind's Legendary ceiling. The wire's validator refuses a list
 *  that fails this (a forged +1e9 armour, a stat with no attribute), and
 *  every reader below skips a malformed record rather than throwing out
 *  of a tooltip or the magic round. */
export function validAffix(a) {
  if (!a || typeof a !== 'object') return false;
  const k = AFFIX_KINDS[a.id];
  if (!k) return false;
  if (k.params ? !k.params.includes(a.param) : a.param !== undefined) return false;
  const max = AFFIX_RANGES[a.id].legendary[1];
  return Number.isInteger(a.value) && a.value >= 1 && a.value <= max;
}
export const validAffixList = (list) => Array.isArray(list) && list.every(validAffix);
/** One affix's label - the tooltip line; '' for a malformed record. */
export const affixLabel = (a) => (validAffix(a) ? AFFIX_KINDS[a.id].label(a) : '');
/** The name-word an affix contributes, by the tier's band. */
export const affixWord = (a, tier) => (validAffix(a) ? AFFIX_KINDS[a.id].word(BAND[tier] ?? 0, a.param) : '');

/** Roll a tier's affixes for an item: the count from AFFIX_COUNTS, no
 *  kind repeated (no param repeated for a kind with params), the first
 *  pick leaning to the group's own number (a weapon's damage, a piece
 *  of armour's armour) half the time, a Rare guaranteed a prefix AND a
 *  suffix so its name has both parts. */
export function rollAffixes(item, tier, rolls = Math.random) {
  const kinds = AFFIX_IDS.filter((id) => AFFIX_KINDS[id].groups.includes(item.group));
  const [min, max] = AFFIX_COUNTS[tier] ?? [0, 0];
  const count = rangeInt(min, max, rolls);
  const out = [];
  const taken = new Set();
  const mint = (id) => {
    const k = AFFIX_KINDS[id];
    const [lo, hi] = AFFIX_RANGES[id][tier];
    const value = rangeInt(lo, hi, rolls);
    if (!k.params) { taken.add(id); return { id, value }; }
    const free = k.params.filter((p) => !taken.has(`${id}:${p}`));
    const param = pick(free, rolls);
    taken.add(`${id}:${param}`);
    return { id, param, value };
  };
  const open = () => kinds.filter((id) => AFFIX_KINDS[id].params ? AFFIX_KINDS[id].params.some((p) => !taken.has(`${id}:${p}`)) : !taken.has(id));
  const own = item.group === 'Weapons' ? 'damage' : item.group === 'Armor' ? 'armor' : null;
  for (let i = 0; i < count; i++) {
    let pool = open();
    if (!pool.length) break;
    if (tier === 'rare' && i === count - 1) {
      // the last pick fills whichever slot the name still lacks
      const has = (slot) => out.some((a) => AFFIX_KINDS[a.id].slot === slot);
      const need = !has('prefix') ? 'prefix' : !has('suffix') ? 'suffix' : null;
      if (need) { const p = pool.filter((id) => AFFIX_KINDS[id].slot === need); if (p.length) pool = p; }
    }
    const id = i === 0 && own && pool.includes(own) && rolls() < 0.5 ? own : pick(pool, rolls);
    out.push(mint(id));
  }
  return out;
}

// ── the flavour (Rare) and the records (Legendary) ─────────────────
const T = ENCHANTMENT_TYPES;
/** The DFU catalogue enchantment a Rare carries, one per item, by
 *  group: a weapon strikes or drinks, a piece of armour or jewellery
 *  holds. {type, param} are the catalogue's own (enchantmentCatalogue
 *  ENCHANTMENT_COSTS: the CastWhen* params are classic spell ids). */
export const RARE_FLAVOURS = Object.freeze({
  Weapons: Object.freeze([
    { type: T.CastWhenStrikes, param: 7 },    // Wizard's Fire
    { type: T.CastWhenStrikes, param: 16 },   // Ice Bolt
    { type: T.CastWhenStrikes, param: 53 },   // Hand of Sleep
    { type: T.CastWhenStrikes, param: 52 },   // Vampiric Touch
    { type: T.CastWhenStrikes, param: 33 },   // Wildfire
    { type: T.VampiricEffect, param: 1 },     // when strikes
    { type: T.PotentVs, param: 0 },           // Undead
    { type: T.PotentVs, param: 1 },           // Daedra
    { type: T.PotentVs, param: 2 },           // Humanoid
    { type: T.PotentVs, param: 3 },           // Animals
    { type: T.RepairsObjects, param: -1 },
  ]),
  Armor: Object.freeze([
    { type: T.CastWhenHeld, param: 37 },      // Slowfalling
    { type: T.CastWhenHeld, param: 41 },      // Water Walking
    { type: T.CastWhenHeld, param: 42 },      // Water Breathing
    { type: T.CastWhenHeld, param: 24 },      // Troll's Blood
    { type: T.RegensHealth, param: 2 },       // in darkness
    { type: T.RegensHealth, param: 1 },       // in sunlight
    { type: T.IncreasedWeightAllowance, param: 0 },
    { type: T.RepairsObjects, param: -1 },
    { type: T.ImprovesTalents, param: 1 },    // Athleticism (LR4: FeatherWeight left - its payload fires at the item maker alone, so on a drop it would be a dead line)
  ]),
  Jewellery: Object.freeze([
    { type: T.CastWhenHeld, param: 44 },      // Chameleon
    { type: T.CastWhenHeld, param: 45 },      // Shadow Form
    { type: T.CastWhenHeld, param: 49 },      // Tongues
    { type: T.CastWhenHeld, param: 39 },      // Spell Resistance
    { type: T.ExtraSpellPts, param: 8 },      // Near Daedra
    { type: T.ExtraSpellPts, param: 7 },      // Near Undead
    { type: T.AbsorbsSpells, param: -1 },
    { type: T.ImprovesTalents, param: 0 },    // Hearing
    { type: T.ImprovesTalents, param: 2 },    // Adrenaline Rush
    { type: T.GoodRepWith, param: 1 },        // Merchants
  ]),
});

/** THE LEGENDARIES. A fixed pool per group: a name a player learns, a
 *  set affix signature, one DFU enchantment. `templates` narrows a
 *  record to particular items (a bow, a shield) when it should not
 *  land on any of the group. */
export const LEGENDARIES = Object.freeze([
  { id: 'wyrmbane', name: 'Wyrmbane', group: 'Weapons',
    affixes: [{ id: 'damage', value: 35 }, { id: 'stat', param: 'strength', value: 12 }, { id: 'skill', param: 34, value: 20 }],
    enchantment: { type: T.CastWhenStrikes, param: 25 },   // Fire Storm
    lore: 'Forged for a dragon hunt no chronicle finished.' },
  { id: 'nightwhisper', name: 'Nightwhisper', group: 'Weapons', templates: [113, 114, 116, 117],   // Dagger, Tanto, Shortsword, Wakizashi
    affixes: [{ id: 'damage', value: 25 }, { id: 'stat', param: 'agility', value: 12 }, { id: 'stat', param: 'speed', value: 10 }, { id: 'skill', param: 16, value: 25 }],
    enchantment: { type: T.CastWhenHeld, param: 44 },   // Chameleon
    lore: 'A blade the Dark Brotherhood swears it never lost.' },
  { id: 'graveward', name: 'Graveward', group: 'Weapons', templates: [124, 125, 126, 127, 128],   // Mace, Flail, Warhammer, Battle Axe, War Axe
    affixes: [{ id: 'damage', value: 30 }, { id: 'stat', param: 'endurance', value: 10 }, { id: 'skill', param: 34, value: 25 }],
    enchantment: { type: T.PotentVs, param: 0 },   // Undead
    lore: 'The Order of the Hour buried it with its bearer. It did not stay buried.' },
  { id: 'stormcaller', name: "Stormcaller's Bow", group: 'Weapons', templates: [129, 130],   // Short Bow, Long Bow
    affixes: [{ id: 'damage', value: 30 }, { id: 'stat', param: 'agility', value: 10 }, { id: 'skill', param: 33, value: 25 }],
    enchantment: { type: T.CastWhenStrikes, param: 20 },   // Ice Storm
    lore: 'Strung with a hair of the Ebonarm, or so the archer said.' },
  { id: 'the-warden', name: 'The Warden', group: 'Armor', templates: [102, 103, 104, 105, 106, 107, 108],   // the body pieces
    affixes: [{ id: 'armor', value: 15 }, { id: 'stat', param: 'endurance', value: 12 }, { id: 'resist', param: 'magic', value: 40 }],
    enchantment: { type: T.RegensHealth, param: 0 },   // all the time
    lore: 'Worn by the last warden of a keep that no longer stands.' },
  { id: 'titanheart', name: 'Titanheart', group: 'Armor', templates: [102, 103, 104, 105, 106, 107, 108],
    affixes: [{ id: 'armor', value: 12 }, { id: 'stat', param: 'strength', value: 15 }, { id: 'weight', value: 40 }],
    enchantment: { type: T.AbsorbsSpells, param: -1 },
    lore: 'Its plates are said to have been beaten from a giant’s own heart.' },
  { id: 'aegis-of-dawn', name: 'Aegis of Dawn', group: 'Armor', templates: [109, 110, 111, 112],   // the four shields
    affixes: [{ id: 'armor', value: 18 }, { id: 'resist', param: 'fire', value: 45 }, { id: 'stat', param: 'willpower', value: 10 }],
    enchantment: { type: T.CastWhenHeld, param: 39 },   // Spell Resistance
    lore: 'Raised against the Underking’s host at the dawn of the second era.' },
  { id: 'foxglove', name: 'Foxglove', group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'luck', value: 15 }, { id: 'stat', param: 'speed', value: 10 }, { id: 'resist', param: 'poison', value: 35 }],
    enchantment: { type: T.ImprovesTalents, param: 1 },   // Athleticism
    lore: 'Pretty, and poisonous to those who would take it from you.' },
  { id: 'kings-mark', name: "King's Mark", group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'personality', value: 15 }, { id: 'skill', param: 1, value: 25 }, { id: 'weight', value: 35 }],
    enchantment: { type: T.GoodRepWith, param: 3 },   // Nobility
    lore: 'Whoever wears it is received at court; whoever loses it is not.' },
  { id: 'archmages-loop', name: "Archmage's Loop", group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'intelligence', value: 15 }, { id: 'stat', param: 'willpower', value: 12 }, { id: 'resist', param: 'shock', value: 40 }],
    enchantment: { type: T.ExtraSpellPts, param: 8 },   // Near Daedra
    lore: 'One of the rings the Mages Guild does not admit to having made.' },
]);
export const legendaryById = (id) => allLegendaries().find((l) => l.id === id) ?? null;
/** DFU-shaped, but not DFU's - the pool is the port's own, so it is
 *  allowed to grow (registerLegendary, below). */
export const allLegendaries = () => [...LEGENDARIES, ..._customLegendaries];
/** The records an item may become.
 *
 *  `exclusive` SHADOWS the rest: a registered record that names its
 *  templates and claims them outright, so the port's own weapon does
 *  not roll up as a blade forged for a dragon hunt. Nothing in DFU's
 *  own pool sets it, so the classic pairings are exactly what they
 *  were - a dagger can still be Wyrmbane or Nightwhisper. */
export function legendariesFor(item) {
  const pool = allLegendaries().filter((l) => l.group === item?.group && (!l.templates || l.templates.includes(item.templateIndex)));
  const claimed = pool.filter((l) => l.exclusive);
  return claimed.length ? claimed : pool;
}

// ── the mint ────────────────────────────────────────────────────────
/** The item's name for a tier: "Sentinel's Cuirass of the Bear"
 *  (prefix, the template, suffix). A Magic item has one word, a Rare
 *  both, a Legendary its record's name. */
export function rarityName(item, tier, affixes) {
  const base = templateByIndex(item.templateIndex)?.name ?? item.name ?? '';
  const pre = affixes.find((a) => AFFIX_KINDS[a.id].slot === 'prefix');
  const suf = affixes.find((a) => AFFIX_KINDS[a.id].slot === 'suffix');
  const parts = [];
  if (pre) parts.push(affixWord(pre, tier));
  parts.push(base);
  if (suf) parts.push(affixWord(suf, tier));
  return parts.join(' ');
}

/** The gold the affixes add. */
export const affixesWorth = (affixes) => (affixes ?? []).reduce((n, a) => n + (AFFIX_WORTH[a.id] ?? 0) * (a.value | 0), 0);

/** Apply a rolled tier to an eligible item IN PLACE: the field, the
 *  affixes, the name, the value, and a Rare's or Legendary's DFU
 *  enchantment. Common leaves the item as DFU minted it. */
export function applyRarity(item, tier, rolls = Math.random, legendaryPool = null) {
  if (!item || tier === 'common' || !RARITIES[tier] || tier === 'artifact') return item;
  let affixes;
  let enchantment = null;
  if (tier === 'legendary') {
    const pool = legendaryPool ?? legendariesFor(item);
    if (!pool.length) return applyRarity(item, 'rare', rolls);   // no record for this item: the tier below
    const rec = pick(pool, rolls);
    affixes = rec.affixes.map((a) => ({ ...a }));
    enchantment = rec.enchantment;
    item.legendary = rec.id;
    item.name = rec.name;
  } else {
    affixes = rollAffixes(item, tier, rolls);
    item.name = rarityName(item, tier, affixes);
    if (tier === 'rare') enchantment = pick(RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery, rolls);
  }
  item.rarity = tier;
  item.affixes = affixes;
  if (enchantment) item.enchantments = [{ type: enchantment.type, param: enchantment.param }];
  item.value = itemBaseValue(item) + affixesWorth(affixes) + (enchantment ? RARE_ENCHANT_WORTH : 0);
  return item;
}
/** What a Rare's flavour enchantment adds to its price - a flat sum,
 *  not DFU's per-effect cost table, because that table prices a
 *  made item's whole budget and a drop is not made. */
export const RARE_ENCHANT_WORTH = 600;

/** THE HOST DOOR. Roll every eligible item of a freshly generated list
 *  against the source; a no-op with the switch off or no source, so
 *  the DFU loot list is returned untouched. `luck` is the player's
 *  live luck. Returns the list for chaining. */
export function rollLootRarity(items, source, { rolls = Math.random, luck = 50 } = {}) {
  if (!lootRarityOn() || !source || !Array.isArray(items)) return items;
  for (const it of items) {
    if (!rarityEligible(it)) continue;
    const tier = rollRarity({ ...source, luck }, rolls);
    if (tier !== 'common') applyRarity(it, tier, rolls);
  }
  // THE UNIQUE FIND, after the tiers and ONCE for the list: it adds an
  // item DFU's roll cannot produce rather than promoting one it did.
  // The added item is rolled for its own tier too, so the rarest thing
  // in the game can still turn up legendary.
  for (const found of rollUniqueFinds({ ...source, luck }, rolls)) {
    if (rarityEligible(found)) {
      const tier = rollRarity({ ...source, luck }, rolls);
      if (tier !== 'common') applyRarity(found, tier, rolls);
    }
    items.push(found);
  }
  return items;
}
/** LR4 (the audit): THE CORPSE DOOR. A foe's list carries its WORN kit
 *  too (hostCombat.equipEnemy pushes every equipped piece into
 *  entity.items and onto the equip table, writing no equipSlot), so the
 *  roll runs over the items NOT on its table: the loot it carries, not
 *  the sword it swings - a Legendary in a Daedra Lord's hand would have
 *  struck the player with it. The source is corpseSource's. */
export function rollCorpseLoot(entity, basics, { rolls = Math.random, luck = 50 } = {}) {
  if (!lootRarityOn() || !entity) return entity?.items ?? [];
  const worn = new Set(entity.equip ? equipTableOf(entity).filter(Boolean) : []);
  const loot = (entity.items ?? []).filter((it) => it && !worn.has(it));
  rollLootRarity(loot, corpseSource(basics, entity.level), { rolls, luck });
  return entity.items;
}
/** The best tier in a list (a corpse's, a pile's), for the drop sound
 *  and the plaque; null for an empty or off list. */
export function bestRarity(items) {
  let best = null;
  for (const it of items ?? []) {
    const r = rarityOf(it);
    if (!best || RARITIES[r].rank > RARITIES[best].rank) best = r;
  }
  return best;
}

// ── the fold and its readers ───────────────────────────────────────
function wornItems(entity) {
  const slots = entity?.equip?.slots;
  if (slots) return slots.filter((it) => it && Array.isArray(it.affixes) && it.affixes.length);
  return (entity?.items ?? []).filter((it) => it && it.equipSlot != null && Array.isArray(it.affixes) && it.affixes.length);
}

/** THE FOLD (RF1: one of the entity's, systems/entityMods.js): every
 *  worn affix summed into one mods record - run by computeEntityMods
 *  at every equip change (equip.js's listener; the save's
 *  rebuildEquipState) and every magic round (worldTick), so a switch
 *  press is felt within a round; with the switch off it answers
 *  EMPTY_MODS and every channel reads 0. Pure over the entity. A
 *  weapon's damage affix is NOT folded - it is the weapon's own,
 *  registered below as a weapon-damage modifier. */
export function affixFold(entity) {
  if (!entity || !lootRarityOn()) return EMPTY_MODS;
  const mods = newMods();
  for (const it of wornItems(entity)) {
    for (const a of it.affixes) {
      if (!validAffix(a)) continue;   // LR4: a malformed record off the wire folds nothing
      const v = a.value | 0;
      switch (a.id) {
        // LR4 (the audit): ON THE PIECE'S OWN PARTS, as the material's
        // armour value is - entity-wide it stacked seven pieces into an
        // unhittable player. A shield covers its SHIELD_PARTS.
        case 'armor': for (const part of armorBodyParts(it)) mods.armorParts[part] += v; break;
        case 'weight': mods.weightMult += v / 100; break;
        case 'stat': mods.stats[a.param] = (mods.stats[a.param] ?? 0) + v; break;
        case 'skill': mods.skills[a.param] = (mods.skills[a.param] ?? 0) + v; break;
        case 'resist': mods.resist[a.param] = (mods.resist[a.param] ?? 0) + v; break;
        default: break;
      }
    }
  }
  return mods;
}
/** The weapon's own damage affix over its rolled damage, truncated. */
export function affixWeaponDamage(weapon, damage) {
  if (!lootRarityOn() || !Array.isArray(weapon?.affixes)) return damage;
  const pct = weapon.affixes.reduce((n, a) => n + (a.id === 'damage' ? (a.value | 0) : 0), 0);
  return pct ? Math.trunc(damage * (1 + pct / 100)) : damage;
}
export const LOOT_RARITY_FOLD = 'lootRarity';
registerEntityFold(LOOT_RARITY_FOLD, affixFold);
registerWeaponDamageMod(LOOT_RARITY_FOLD, affixWeaponDamage);

// ── the display ────────────────────────────────────────────────────
/** IsIdentified as DFU derives it (tradeModes.itemIsIdentified): an
 *  unenchanted item is always identified. Kept local so this leaf
 *  stays importable from the formulas without a cycle. */
const identified = (item) => !enchanted(item) || item?.isIdentified === true;

/** The tier line and the affix lines a tooltip or a card shows, in
 *  order: "Rare", then each affix, then the DFU enchantment's name.
 *  Empty with the switch off, for a Common item, or while the item is
 *  unidentified (then one line: the tier, and "Unidentified"). */
export function rarityLines(item) {
  if (!lootRarityOn() || !item) return [];
  const tier = rarityOf(item);
  if (tier === 'common') return [];
  const out = [RARITIES[tier].label];
  if (!identified(item)) { out.push('Unidentified'); return out; }
  for (const a of item.affixes ?? []) out.push(affixLabel(a));
  if (item.rarity && Array.isArray(item.enchantments)) {
    for (const e of item.enchantments) {
      if (!e || e.type === T.None) continue;
      const key = Object.keys(T).find((k) => T[k] === e.type);
      const param = key ? enchantmentParamName(key, e.param) : null;
      out.push(param && param !== 'None' ? `${enchantmentName(key)}: ${param}` : enchantmentName(key ?? ''));
    }
  }
  const lore = item.legendary ? legendaryById(item.legendary)?.lore : null;
  if (lore) out.push(lore);
  return out;
}
/** The skin colour for an item's name, or null for Common / off. */
export function rarityColour(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  return tier === 'common' ? null : RARITIES[tier].colour;
}
/** The native scroller's cell tint (RGBA 0..1), or null. */
export function rarityTint(item) {
  if (!lootRarityOn()) return null;
  return RARITIES[rarityOf(item)].tint;
}
/** The data attribute the enhanced skin's rows wear, or null. */
export function rarityAttr(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  return tier === 'common' ? null : tier;
}
