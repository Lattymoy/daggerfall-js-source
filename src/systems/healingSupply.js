// @ts-check
// POTION-COMMON (2026-10-01, the field: "make health potions more common"; the economy arc - bible/06-Systems/
// Economy-Arc.md: "Potions are the solo answer to healing, so they are easy to come by"). A Potion of Healing was a
// twentieth of DFU's random potion (CreateRandomPotion, loot.js - kept as it is) and so came in 0.15% of looting foes and
// 0.2% of J-O piles, and no shop stocked one of its own: a ranked temple member could buy one, and an alchemist's random
// few under Roleplay & Realism: Items' alchemistPotions (at twice the price) were one in twenty such. It has three
// sources of its own beside those:
//
//  - A LOOTING FOE (one with a loot table, the enemy-extras hook) carries one HEALING_ENEMY_CHANCE times in 100.
//  - A DUNGEON PILE of keys J-O (LootTables.OnLootSpawned's hook, the field repair kit's) holds one HEALING_PILE_CHANCE
//    times in 100 - fourteen of the nineteen dungeon types; a coven's, a laboratory's, a harpy nest's, a giant
//    stronghold's and a dragon's den's piles are keyed outside J-O, as DFU's own pile extras are.
//  - THE COUNTER. An alchemist stocks healingShelfCount of them every day and a general store fewer, on the shop's
//    FIRST shelf - the one its counter sells from (AUDIT ECON P1: every shelf model is a container stocked whole) - the
//    count by the shop's quality and drawn from no roll, so the shelf's own rolls - DFU's, pinned - are the same rolls
//    as before. Online, half price like every potion (shopStock.js ESSENTIALS-HALF).
//
// MAGICKA-COMMON (LOOT-EASE, 2026-10-05, Mac: "majicka potions should be more common loot drops, same with health
// pots"): the Potion of Restore Power (potions.js: Heal Spell Points, 5 + 4 a level; price 75) was the same twentieth
// of the random potion the healing potion had been - 0.15% of looting foes (before PLAIN-LOOT halved even that) and
// 0.2% of J-O piles. It rides the healing potion's two loot doors, a little less often (MAGICKA_ENEMY_CHANCE,
// MAGICKA_PILE_CHANCE: a caster's need, not everyone's), drawn after it; and the healing potion's own two chances are
// raised (6 -> 10 a foe, 12 -> 18 a pile). The counter is unchanged.
//
// A departure (Ledger A, POTION-COMMON).
import { createPotion, registerTabledLootHandler, registerEnemyLootExtra, CLASSIC_RECIPE_KEYS } from './loot.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';

/** PotionRecipe "healing" (potions.js: Heal Health, 5 + 9 a level; price 50) - classicRecipeKeys[2], ONE DFU MEMBER,
 *  ONE EXPORT (AUDIT ECON: the key was a second literal of loot.js's). */
export const HEALING_RECIPE_KEY = CLASSIC_RECIPE_KEYS[2];
/** A looting foe's chance in 100 of carrying one. */
export const HEALING_ENEMY_CHANCE = 10;
/** A J-O pile's chance in 100 of holding one. */
export const HEALING_PILE_CHANCE = 18;
/** MAGICKA-COMMON: PotionRecipe "restorePower" (Heal Spell Points) - classicRecipeKeys[4]. */
export const MAGICKA_RECIPE_KEY = CLASSIC_RECIPE_KEYS[4];
/** MAGICKA-COMMON: a looting foe's chance in 100 of carrying a Potion of Restore Power. */
export const MAGICKA_ENEMY_CHANCE = 6;
/** MAGICKA-COMMON: a J-O pile's chance in 100 of holding one. */
export const MAGICKA_PILE_CHANCE = 10;

/** A Potion of Healing, as ItemBuilder.CreatePotion mints any potion. */
export const mintHealingPotion = () => createPotion(HEALING_RECIPE_KEY);
/** MAGICKA-COMMON: a Potion of Restore Power, the same mint. */
export const mintMagickaPotion = () => createPotion(MAGICKA_RECIPE_KEY);

/** How many Potions of Healing a shop stocks for the day, on its first shelf: an alchemist 2 + a fifth of its quality
 *  (2-6), a general store 1 + a tenth (1-3), any other shop none. */
export function healingShelfCount(buildingType, quality) {
  const q = Math.max(0, Math.trunc(Number(quality) || 0));
  if (buildingType === BUILDING_TYPES.Alchemist) return 2 + Math.trunc(q / 5);
  if (buildingType === BUILDING_TYPES.GeneralStore) return 1 + Math.trunc(q / 10);
  return 0;
}

/** One roll of `pct` percent, and a Potion of Healing into `items` on a hit. Answers whether one was added. */
export function maybeAddHealingPotion(items, pct, rolls = Math.random) {
  if (!Array.isArray(items) || !(rolls() * 100 < pct)) return false;
  items.push(mintHealingPotion());
  return true;
}
/** MAGICKA-COMMON: one roll of `pct` percent, and a Potion of Restore Power into `items` on a hit. */
export function maybeAddMagickaPotion(items, pct, rolls = Math.random) {
  if (!Array.isArray(items) || !(rolls() * 100 < pct)) return false;
  items.push(mintMagickaPotion());
  return true;
}

/** Every host's install (scenes/shared.js, after the smithing install, so a field kit's roll still comes first): the
 *  potions into a J-O pile and onto a looting foe - the healing potion's draw, then the magicka potion's. */
export function installHealingSupply() {
  registerTabledLootHandler('healing-potion', ({ key, items, rolls }) => {
    const i = typeof key === 'string' ? key.charCodeAt(0) - 64 : 0;
    if (i >= 10 && i <= 15) { maybeAddHealingPotion(items, HEALING_PILE_CHANCE, rolls); maybeAddMagickaPotion(items, MAGICKA_PILE_CHANCE, rolls); }
  });
  registerEnemyLootExtra('healing-potion', ({ items, rolls }) => { maybeAddHealingPotion(items, HEALING_ENEMY_CHANCE, rolls); maybeAddMagickaPotion(items, MAGICKA_ENEMY_CHANCE, rolls); });
}
