// @ts-check
// DISC21-A (2026-09-24, Satranath on Discord: "Started a new character this morning with an ebony dagger. when I try
// to equip it, it says it's broken and cannot be worn. tried to get an NPC to repair it and they say it isn't
// damaged") - A WEARABLE THAT NEVER HAD ITS CONDITION MINTED, MINTED ON LOAD.
//
// THE BUG (systems/biography.js mintItem, fixed there): the biography questions' IT items were built by hand with no
// condition at all, where DFU's CreateWeapon / CreateArmor / `new DaggerfallUnityItem` mint it. Roleplay & Realism's
// skill-based kit then wore the questions' ebony dagger to 20% of a maxCondition that was not there - 0 of nothing: a
// dagger broken to the equip check (currentCondition < 1) and undamaged to the repairer (0 === 0), for good.
//
// THE FINGERPRINT is a wearable with no maxCondition: every mint in the port writes both halves (mintCondition), so
// nothing else leaves a weapon, a piece of armor, clothing or jewellery without one. On load such an item is minted
// now, by the law it missed:
//  - an arrow keeps CreateWeapon's `currentCondition = 0`, its maxCondition the template's hitPoints;
//  - a dagger finer than steel at 0 is the skill-based kit's 20% worn onto nothing - its law again, on the real
//    maxCondition (rriKits.js assignSkillEquipment);
//  - anything else, whole.
// Idempotent: a minted item is never touched again.
//
// WEAPON-POOL (2026-10-06, Mac: "keep the material disparity, but unify all the weapons types condition stat") - A
// WEAPON MINTED ON ITS ROW'S POOL, MOVED TO THE ONE POOL ON LOAD. Every weapon type wears from one pool now
// (characters/weapons.js WEAPON_CONDITION_POOL), and a piece carried in a save was minted on its row's: an iron dagger
// at 50, a long bow at 100. THE FINGERPRINT is the old mint's own number - a row's hitPoints through the material
// ladder (mintCondition's arithmetic), on Daggerfall's row or on Roleplay & Realism: Items' patch of it (a Tanto at
// 40), and through the smith's quality for a made piece (smithItems.js mintPiece). Such a piece moves to what the same
// mint gives now, its condition the same share of it: a broken piece stays broken and a worn one stays as worn - no
// repair rides in. SELL-AS-FOUND's mark is a condition too, and moves by the same share (AUDIT WEAPON-POOL P1: left on
// the row's pool, a found dagger sold online at a 32nd of its share). Left as it is: a magic item's or an artifact's
// uses (MAGIC.DEF's own number, not its type's - a classic save's artifact is marked `artifact` alone, P4), ammunition
// (its mint is its row's either side), a piece already on the pool (the Warhammer's row was), a piece at a smith (P3:
// DFU re-derives a booked job's days from its missing points at the next drop-off, so a moved job would wait up to 13
// times as long - it comes back whole on its row and moves at its first wear), and a piece matching no old mint. That
// last is mostly an enchanted piece There's a Hole in the Bottom of the Ocean raised a material, which keeps the old
// material's condition - unless that number is what a row gave at the new one (a Battle Axe's or a Claymore's, at a few
// steps of the ladder), and then it moves to the new material's pool, as the same piece unenchanted would be re-minted.
// TWO DOORS (P2): the load walks the lists the save's repairs walk, and lowerCondition (equip.js) moves a weapon before
// it wears - so a piece from any store the load does not walk (hung in a room, a revenant's take, a quest's prize, an
// heir's bequest, a market or vault record, an old build's trade) is on the pool before a point of the old pool is
// spent. Idempotent: a moved piece is on the pool, and nothing finds it to move again.

import { mintCondition, ITEM_TEMPLATES, templateByIndex } from './itemTemplates.js';
import { ARROW_TEMPLATE } from './inventory.js';
import { WEAPONS, WEAPON_MATERIALS, conditionMultipliersByMaterial } from '../characters/weapons.js';
import { RRI_TEMPLATE_PATCHES } from './rriItems.js';
import { QUALITY_EFFECTS } from '../net/recipeLaw.js';

/** The groups an equip check reads condition for. */
export const WEARABLE_GROUPS = Object.freeze(['Weapons', 'Armor', 'MensClothing', 'WomensClothing', 'Jewellery']);
const WEARABLE = new Set(WEARABLE_GROUPS);

/** Roleplay & Realism's worn questions' dagger: "Set condition of ebony dagger if player has one from char creation
 *  questions" - a dagger finer than steel. One home, read by the kit and by the repair. */
export const isQuestionsDagger = (item) => item?.group === 'Weapons' && item.templateIndex === WEAPONS.Dagger && (item.material ?? 0) > WEAPON_MATERIALS.Steel;
/** The kit's wear: `(int)(maxCondition * 0.2f)`. */
export const QUESTIONS_DAGGER_WEAR = 0.2;

/**
 * Mint every never-minted wearable in `items` (the pack, the wagon, the repairer's shelf).
 * @param {any[]} items
 * @returns {number} how many were minted
 */
export function repairUnmintedConditions(items) {
  let n = 0;
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object' || it.maxCondition != null || !WEARABLE.has(it.group) || !Object.isExtensible(it)) continue;
    const had = it.currentCondition;
    mintCondition(it);
    if (it.group === 'Weapons' && it.templateIndex === ARROW_TEMPLATE) it.currentCondition = 0;
    else if (had === 0 && isQuestionsDagger(it)) it.currentCondition = Math.trunc(it.maxCondition * QUESTIONS_DAGGER_WEAR);
    n++;
  }
  return n;
}

/** Roleplay & Realism: Items' hitPoints patches to classic weapon rows (a Tanto at 40, a Short Bow at 80): a piece
 *  minted while the mod was on carries its patch's pool, whether or not the mod is on at this load. */
const RRI_ROW_POOLS = new Map(RRI_TEMPLATE_PATCHES.map((/** @type {any} */ p) => [p.index, p.hitPoints]));

/** The pools a weapon of this template may have been minted on before WEAPON-POOL: Daggerfall's row, a custom
 *  template's own, and the mod's patch of the row.
 * @param {number} templateIndex
 * @returns {number[]} */
const rowPools = (templateIndex) => [ITEM_TEMPLATES[templateIndex]?.hitPoints, templateByIndex(templateIndex)?.hitPoints, RRI_ROW_POOLS.get(templateIndex)]
  .filter((hp) => typeof hp === 'number');

/** A pool through a piece's own mint: the material ladder (mintCondition's arithmetic - no material is x4 / 4), then a
 *  made piece's quality (smithItems.js mintPiece's `round(maxCondition * condition)`; its floor at 1 never reaches a
 *  weapon's pool).
 * @param {number} pool @param {any} it
 * @returns {number} */
function mintedOn(pool, it) {
  const max = Math.trunc((pool * (conditionMultipliersByMaterial[it.material] ?? 4)) / 4);
  const made = QUALITY_EFFECTS[it.quality]?.condition;
  return made == null ? max : Math.round(max * made);
}

/**
 * WEAPON-POOL: move ONE weapon minted on its row's pool to the one pool, its condition (and SELL-AS-FOUND's mark) the
 * same share. Ammunition needs no guard: its mint is its row's either side, so it is always on its pool already.
 * @param {any} it
 * @returns {boolean} whether it moved
 */
export function repoolWeapon(it) {
  // a magic item's condition is its uses (a classic save's artifact carries `artifact` alone - AUDIT WEAPON-POOL P4); a
  // piece at a smith keeps its booked job (P3); a frozen record cannot be written
  if (!it || it.group !== 'Weapons' || it.magic || it.artifact || it.repairData != null || !Object.isExtensible(it)
    || !Number.isFinite(it.currentCondition)) return false;
  const max = it.maxCondition;
  const pool = mintedOn(mintCondition({ group: 'Weapons', templateIndex: it.templateIndex }).maxCondition, it);
  if (pool === max || !rowPools(it.templateIndex).some((hp) => mintedOn(hp, it) === max)) return false;
  // the same share: a whole piece whole, a broken one broken - and the pool is never below a row's, so a worn piece
  // is never rounded to either
  const share = (/** @type {number} */ n) => Math.round((n * pool) / max);
  it.currentCondition = share(it.currentCondition);
  if (Number.isInteger(it.foundCondition)) it.foundCondition = share(it.foundCondition);   // P1: the online counter reads it over the maximum
  it.maxCondition = pool;
  return true;
}

/**
 * WEAPON-POOL: move every weapon in `items` minted on its row's pool to the one pool (repoolWeapon).
 * @param {any[]} items
 * @returns {number} how many were moved
 */
export function repoolWeaponConditions(items) {
  let n = 0;
  for (const it of Array.isArray(items) ? items : []) if (repoolWeapon(it)) n++;
  return n;
}
