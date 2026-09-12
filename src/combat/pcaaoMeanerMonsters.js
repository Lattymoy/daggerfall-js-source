// ═══════════════════════════════════════════════════════════════════
// PCAAO - RALZAR'S MEANER MONSTERS, KIRK.O'S EDIT (PCO1, 2026-09-12).
//
// Physical Combat And Armor Overhaul v1.44 (Kirk.O) carries "a custom
// for this overhaul edit of Ralzar's Meaner Monsters" - InitMod's tail
// (PhysicalCombatAndArmorOverhaul.cs, the `ralzarMeanerMonstersEdit`
// branch) overwrites EnemyBasics.Enemies[i] for forty-two monsters:
// MinDamage/MaxDamage (and the second and third attack pairs where the
// monster has them), MinHealth/MaxHealth, Level and ArmorValue. In DFU
// the branch runs when the "Meaner Monsters" mod is LOADED beside this
// one; the port has no mod list, so it is the `meanerMonsters` switch
// on the Mods pane, off by default (the mod is not present unless the
// player says so). The rows are the C#'s, index for index, value for
// value; every field the C# leaves alone is the base row's.
//
// A LEAF on purpose: characters/enemyEntity.js reads it when it mints a
// foe, and that file must not reach the combat formulas.
// ═══════════════════════════════════════════════════════════════════

import { modSetting } from '../systems/modSettings.js';

/** EnemyBasics.Enemies[i] <- {...}, exactly as InitMod writes them. */
export const MEANER_MONSTERS = Object.freeze({
  0: { minDamage: 1, maxDamage: 3, minHealth: 15, maxHealth: 35, level: 1, armorValue: 6 },
  3: { minDamage: 1, maxDamage: 4, minHealth: 5, maxHealth: 13, level: 2, armorValue: 2 },
  4: { minDamage: 4, maxDamage: 8, minDamage2: 6, maxDamage2: 8, minDamage3: 6, maxDamage3: 10, minHealth: 55, maxHealth: 110, level: 4, armorValue: 8 },
  5: { minDamage: 6, maxDamage: 12, minDamage2: 6, maxDamage2: 10, minDamage3: 8, maxDamage3: 14, minHealth: 35, maxHealth: 60, level: 4, armorValue: 5 },
  6: { minDamage: 3, maxDamage: 9, minHealth: 12, maxHealth: 28, level: 2, armorValue: 4 },
  11: { minDamage: 4, maxDamage: 12, minHealth: 25, maxHealth: 50, level: 7, armorValue: 4 },
  20: { minDamage: 7, maxDamage: 16, minHealth: 22, maxHealth: 40, level: 4, armorValue: 5 },
  1: { minDamage: 2, maxDamage: 13, minHealth: 10, maxHealth: 20, level: 2, armorValue: 3 },
  2: { minDamage: 2, maxDamage: 8, minDamage2: 2, maxDamage2: 6, minDamage3: 3, maxDamage3: 7, minHealth: 25, maxHealth: 40, level: 3, armorValue: -2 },
  8: { minDamage: 7, maxDamage: 16, minHealth: 35, maxHealth: 65, level: 5, armorValue: 7 },
  10: { minDamage: 2, maxDamage: 8, minHealth: 25, maxHealth: 45, level: 6, armorValue: 0 },
  13: { minDamage: 7, maxDamage: 13, minHealth: 25, maxHealth: 60, level: 8, armorValue: 4 },
  16: { minDamage: 8, maxDamage: 18, minHealth: 70, maxHealth: 110, level: 10, armorValue: 10 },
  22: { minDamage: 16, maxDamage: 32, minHealth: 50, maxHealth: 100, level: 14, armorValue: 2 },
  34: { minDamage: 12, maxDamage: 24, minHealth: 35, maxHealth: 60, level: 16, armorValue: 0 },
  40: { minDamage: 35, maxDamage: 95, minHealth: 125, maxHealth: 230, level: 21, armorValue: -2 },
  41: { minDamage: 6, maxDamage: 16, minHealth: 45, maxHealth: 90, level: 16, armorValue: 4 },
  42: { minDamage: 5, maxDamage: 13, minHealth: 35, maxHealth: 65, level: 16, armorValue: 2 },
  7: { minDamage: 6, maxDamage: 13, minHealth: 40, maxHealth: 70, level: 6, armorValue: 8 },
  12: { minDamage: 8, maxDamage: 18, minHealth: 50, maxHealth: 85, level: 9, armorValue: 6 },
  21: { minDamage: 7, maxDamage: 15, minHealth: 45, maxHealth: 70, level: 15, armorValue: 4 },
  24: { minDamage: 20, maxDamage: 36, minHealth: 80, maxHealth: 125, level: 19, armorValue: 2 },
  9: { minDamage: 4, maxDamage: 8, minDamage2: 6, maxDamage2: 8, minDamage3: 6, maxDamage3: 10, minHealth: 30, maxHealth: 55, level: 8, armorValue: 3 },
  14: { minDamage: 6, maxDamage: 10, minDamage2: 6, maxDamage2: 12, minDamage3: 8, maxDamage3: 16, minHealth: 65, maxHealth: 95, level: 8, armorValue: 5 },
  35: { minDamage: 9, maxDamage: 17, minHealth: 40, maxHealth: 60, level: 16, armorValue: 3 },
  36: { minDamage: 13, maxDamage: 24, minHealth: 95, maxHealth: 155, level: 21, armorValue: 4 },
  37: { minDamage: 3, maxDamage: 8, minHealth: 120, maxHealth: 245, level: 16, armorValue: 9 },
  38: { minDamage: 5, maxDamage: 13, minHealth: 70, maxHealth: 110, level: 16, armorValue: 5 },
  15: { minDamage: 7, maxDamage: 15, minHealth: 30, maxHealth: 55, level: 9, armorValue: 4 },
  17: { minDamage: 4, maxDamage: 8, minHealth: 65, maxHealth: 125, level: 5, armorValue: 9 },
  18: { minDamage: 7, maxDamage: 14, minHealth: 20, maxHealth: 40, level: 11, armorValue: 1 },
  19: { minDamage: 6, maxDamage: 14, minHealth: 75, maxHealth: 110, level: 15, armorValue: 3 },
  23: { minDamage: 16, maxDamage: 32, minHealth: 30, maxHealth: 50, level: 15, armorValue: 0 },
  28: { minDamage: 15, maxDamage: 32, minHealth: 70, maxHealth: 105, level: 17, armorValue: -3 },
  30: { minDamage: 18, maxDamage: 35, minHealth: 85, maxHealth: 140, level: 20, armorValue: -7 },
  32: { minDamage: 25, maxDamage: 45, minHealth: 85, maxHealth: 135, level: 20, armorValue: -2 },
  33: { minDamage: 35, maxDamage: 55, minHealth: 115, maxHealth: 195, level: 21, armorValue: -4 },
  25: { minDamage: 25, maxDamage: 40, minHealth: 90, maxHealth: 160, level: 17, armorValue: -6 },
  26: { minDamage: 35, maxDamage: 55, minHealth: 60, maxHealth: 100, level: 17, armorValue: -3 },
  27: { minDamage: 20, maxDamage: 32, minHealth: 70, maxHealth: 120, level: 18, armorValue: -1 },
  29: { minDamage: 30, maxDamage: 60, minHealth: 70, maxHealth: 95, level: 19, armorValue: -8 },
  31: { minDamage: 26, maxDamage: 42, minHealth: 170, maxHealth: 285, level: 21, armorValue: -9 },
});

/** Is the edit live: the mod on, and its Meaner Monsters switch on. */
export const meanerMonstersOn = (read = (k) => modSetting('pcaao', k)) => !!read('Enabled') && !!read('meanerMonsters');

/** The row a foe of `mobileType` is minted from: the base row with
 *  the edit's fields written over it when the edit is live, the base
 *  row itself otherwise. A class enemy (128+) and any monster the edit
 *  does not name come back untouched - the C# writes only the indices
 *  above. Never mutates the base table (it is frozen). */
export function meanerMonstersRow(mobileType, baseRow, on = meanerMonstersOn()) {
  if (!on || !baseRow) return baseRow;
  const edit = MEANER_MONSTERS[mobileType];
  return edit ? { ...baseRow, ...edit } : baseRow;
}
