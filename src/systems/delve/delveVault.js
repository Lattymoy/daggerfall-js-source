// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 6, ONE CHEST, SIDEWAYS): THE VAULT'S ROLL - the dungeon's own treasure pile's
// (scenes/dungeonContext.js rollPileItems: its tables, its tier's odds, LOOT-GATE's rarity), never empty. No new odds and no
// new numbers: POWER-CEILING holds as it does for any dungeon pile. Not a DFU member (Ledger A: DELVE II).
import { goldStack } from '../inventory.js';

/** The vault's items: the pile's roll; an empty roll rolled again, once; still empty, the level's gold (at least 1). Pure
 *  but for `roll`. @param {() => any[]} roll @param {number} level @returns {any[]} */
export function rollVault(roll, level) {
  for (let k = 0; k < 2; k++) {
    const items = roll();
    if (Array.isArray(items) && items.length) return items;
  }
  return [goldStack(Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)))];
}
