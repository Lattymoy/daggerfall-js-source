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

import { mintCondition } from './itemTemplates.js';
import { ARROW_TEMPLATE } from './inventory.js';
import { WEAPONS, WEAPON_MATERIALS } from '../characters/weapons.js';

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
