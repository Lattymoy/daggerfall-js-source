// @ts-check
// LOCK1 (2026-09-26, the players: "A way to lock/favorite items"): A LOCKED PIECE STAYS YOURS.
//
// The lock is one flag on the item (`locked: true`, declared in systems/itemFields.js, so it rides the save and the
// wire as every other field does), set and cleared from the item's own card and its right-click menu. It closes
// the three ways out of the pack a slip can lose a piece for good - dropping it on the ground, selling it over a
// counter, holding it out in a trade - and nothing else: a locked piece is still worn, used, moved, stowed in the
// wagon or put in a chest, because each of those is a deliberate place and the piece is still the player's there.
// A refusal speaks (the windows say `lockedText`), so a locked piece never reads as a broken button.
//
// Not a DFU member: Daggerfall has no lock. Ledger A.

/** Whether a piece is locked. */
export const isLocked = (/** @type {any} */ item) => item?.locked === true;

/** Lock or unlock a piece; answers whether it could (an item record to write on). Unlocked is the field ABSENT, so
 *  a save of a pack with nothing locked carries not one extra byte. */
export function setLocked(/** @type {any} */ item, /** @type {boolean} */ on) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (on) item.locked = true;
  else delete item.locked;
  return true;
}

/** Flip a piece's lock; answers the lock it now has. */
export function toggleLocked(/** @type {any} */ item) {
  setLocked(item, !isLocked(item));
  return isLocked(item);
}

/** The ways out a lock closes, by the word each window asks with. */
export const LOCK_CLOSES = Object.freeze(['drop', 'sell', 'trade']);

/** Whether a lock refuses `way` for this piece. */
export const lockRefuses = (/** @type {any} */ item, /** @type {string} */ way) => isLocked(item) && LOCK_CLOSES.includes(way);

/** The refusal, in the windows' own voice. */
export const lockedText = (/** @type {string} */ name) => `${name || 'That'} is locked. Unlock it first.`;

/** The card's line for a locked piece. */
export const LOCKED_LINE = 'Locked - it will not be dropped, sold or traded.';
