// @ts-check
// LOOT18 (2026-10-07, the Loot arc II - bible/06-Systems/Loot-II-Arc.md section 10; Mac: "what could we do to make it
// even more amazing, while also balancing everyrhing?", then "Lets go all in"): JUNK - A MARK FOR WHAT GOES.
//
// The lock's twin (systems/itemLock.js, LOCK1). One flag on the item (`junk: true`, declared in systems/itemFields.js,
// so it rides the save and the wire as every other field does), set and cleared from the item's own card. Where the
// lock closes the ways out, the mark opens two: a shop's Sell lays every junk piece of the pack on its counter in one
// press (ui/enhancedTrade.js), at the counter's own price and confirm; and quick loot's take-all leaves a junk piece
// where it lies (systems/quickLoot.js takeAllLeaves). A piece is one or the other: marked junk, its lock is lifted;
// locked, its mark is - the player's last word is the one that stands.
//
// Gear alone takes the mark - the pieces a pack fills with (a weapon, armour, a jewel, a garment) - and never a quest's
// item or a bound one, which no counter takes.
//
// Not a DFU member: Daggerfall has no junk. Ledger A (the Loot arc II).
import { isLocked, setLocked } from './itemLock.js';
import { isBound } from './itemBound.js';

/** The groups the mark is for. */
export const JUNK_GROUPS = Object.freeze(['Weapons', 'Armor', 'Jewellery', 'MensClothing', 'WomensClothing']);
/** Whether a piece is marked junk. */
export const isJunk = (/** @type {any} */ item) => item?.junk === true;
/** Whether a piece may take the mark: gear, never a quest's item or a bound one. */
export const junkable = (/** @type {any} */ item) => !!item && JUNK_GROUPS.includes(item.group) && !item.questItem && !isBound(item);
/** Mark or clear a piece; answers whether it could (an item record to write on). Marked, its lock is lifted; cleared is
 *  the field ABSENT, as the lock's is. */
export function setJunk(/** @type {any} */ item, /** @type {boolean} */ on) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (on) { item.junk = true; setLocked(item, false); } else delete item.junk;
  return true;
}
/** Flip a piece's mark; answers the mark it now has. */
export function toggleJunk(/** @type {any} */ item) {
  setJunk(item, !isJunk(item));
  return isJunk(item);
}
/** The lock pressed on a piece: locked now, its mark is lifted (the lock is the later word). */
export function lockLiftsJunk(/** @type {any} */ item) {
  if (isLocked(item)) setJunk(item, false);
}
/** The card's line for a junk piece. */
export const JUNK_LINE = 'Junk - a shop\'s Sell junk puts it on the counter, and a take-all leaves it.';
