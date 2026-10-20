// @ts-check
// STOLEN-GOODS (FIELD BUGS 2026-10-16b, the Discord's "A bug related to infinite...": "you steal something from the shelf
// and can sell it back to an NPC, and he'll put the item back on the shelf again, and it just goes in a circle ...
// completely disrupts the economy ... Also, when you're sent to prison, all the stolen items stay with you and aren't
// taken away"): A STOLEN PIECE CARRIES ITS THEFT.
//
// One flag on the item (`stolen: true`, declared in systems/item/itemFields.js, so it rides the save, the wire and a realm
// trade as `counterBought` does - a piece handed to another player is no less stolen). It is written at the moment a
// piece is taken from someone else's keeping, at every theft arm:
//   - the open shop's Steal, on either skin (ui/native/nativeTrade.js _doSteal, ui/enhanced/enhancedTrade.js runSteal) - its success;
//   - the shut shop's shelf, a stranger's cupboard (scenes/worldModes.js openShelf, the `container:` arm) and a robbed
//     caravan's goods (scenes/world.js caravanHost's openLoot), the inventory window over a loot target whose host hands
//     over THE OWNER'S KEEPING (`loot.stolenFrom`, systems/inventorySession.js theftTarget): a take of the owner's piece
//     marks it BEFORE it lands (systems/item/itemTransfer.js applyTransfer), and the owner's piece put back there is theirs
//     again, its mark cleared before it lands (takenFromKeeping, returnedToKeeping below);
//   - a lawful ship's hold, taken by Piracy (scenes/naval/navalHost.js, the prize's hold as it is drawn) - every way out of
//     her hold carries it.
// Marked before it lands, because a stack merges on the way in (inventory.js addItem): a diff at the window's close (the
// theft basket, systems/theft.js) found the shelf's three arrows gone and the record that held them merged into the
// pack's twenty - the mark had nothing to write on. A stolen piece stacks only with stolen kin and a split keeps the
// mark (inventory.js stacksWith, splitStack). Pickpocketing pinches coin, never a piece; coin carries no mark.
//
// The mark answers two doors:
//   - THE COUNTER (`landSold`): a merchant pays for a stolen piece and is rid of it - it never reaches a shelf, so the
//     thief cannot buy back what they sold and steal it again. An honest sale still lands on the open shelf (Port-Ledger
//     T2: a mistaken sale can be bought back).
//   - THE COURT (systems/court.js confiscateStolen): a guilty verdict takes every stolen piece the character carries.
//
// Not a DFU member: DFU's items carry no theft and its court takes nothing; DaggerfallTradeWindow's Sell discards every
// sold piece (ConfirmTrade's `remoteItems.Clear()`, :1051). This module imports the text core alone (a leaf of the
// item modules' graph: systems/textManager.js imports nothing).
import { t } from './textManager.js';   // L10N4: its two lines are the port's own words

/** The field. */
export const STOLEN_MARK = 'stolen';

/** Whether a piece carries the mark. */
export const isStolen = (/** @type {any} */ item) => !!item && typeof item === 'object' && item[STOLEN_MARK] === true;

/** Mark every piece of a list stolen; answers the list. */
export function markStolen(/** @type {any[]} */ items) {
  for (const it of items ?? []) if (it && typeof it === 'object' && !Array.isArray(it)) it[STOLEN_MARK] = true;
  return items;
}

/** Clear a piece's mark - the field ABSENT, as every other mark's cleared is; answers the piece. */
export function clearStolen(/** @type {any} */ item) {
  if (item && typeof item === 'object') delete item[STOLEN_MARK];
  return item;
}

/** STOLEN-GOODS AUDIT (2026-10-16, S1): A THEFT IS OF THE OWNER'S PIECES. A theft target's host takes THE OWNER'S KEEPING
 *  as its window opens - a Set of the records the target held then (`loot.stolenFrom`) - and the theft's own law reads
 *  that same Set at the close (systems/theft.js theftBasket: the owner's pieces gone out of the keeping), so the mark and
 *  the crime agree by construction. The mark had been written on every take through the window and cleared on every put:
 *  an honest Longsword misclicked into a stranger's cupboard and taken straight back came out stolen - the theft basket
 *  0 pieces, the sword destroyed at its sale and taken at a verdict - and a piece stolen elsewhere, put in a cupboard,
 *  came out clean once put back. Answers whether a take marked: the moved record (the clicked one, or the half a split
 *  minted off it) is marked when its SOURCE is the owner's, and joins the keeping - a split off the owner's stack is the
 *  owner's piece out of their keeping (the basket counts it, where a diff of the list saw its stack still standing). The
 *  player's own piece lying there, put in this window, is no theft. */
export function takenFromKeeping(/** @type {Set<any>|null|undefined} */ keeping, /** @type {any} */ source, /** @type {any} */ moved) {
  if (!(keeping instanceof Set) || !keeping.has(source)) return false;
  markStolen([moved]);
  keeping.add(moved);
  return true;
}

/** A put into a keeping: the OWNER'S piece (its source in the keeping - taken this window, or split off one) is theirs
 *  again, its mark cleared before it lands; any other piece keeps what it was - the player's own stays theirs to take
 *  back clean, and a piece stolen elsewhere is not laundered by a cupboard. Answers whether it was the owner's. */
export function returnedToKeeping(/** @type {Set<any>|null|undefined} */ keeping, /** @type {any} */ source, /** @type {any} */ moved) {
  if (!(keeping instanceof Set) || !keeping.has(source)) return false;
  clearStolen(moved);
  return true;
}

/** ...and where the owner's piece came to rest (inventory.js addItem's answer): the record holding it is in their keeping
 *  (a split's half put back, or a stack it merged into, joins it - taken again, it is marked again), and a moved record
 *  that merged leaves it, so the basket counts nothing that is back. Answers whether it was the owner's. */
export function landedInKeeping(/** @type {Set<any>|null|undefined} */ keeping, /** @type {any} */ source, /** @type {any} */ moved, /** @type {any} */ held) {
  if (!(keeping instanceof Set) || !keeping.has(source)) return false;
  if (held !== moved) keeping.delete(moved);
  keeping.add(held);
  return true;
}

/** A SOLD PIECE'S LAST STOP. An honest piece lands on the shelf the counter sells from (Port-Ledger T2); a stolen one is
 *  the merchant's to be rid of, and goes nowhere. Answers whether it was shelved. */
export function landSold(/** @type {any[]} */ shelfItems, /** @type {any} */ item) {
  if (isStolen(item)) return false;
  shelfItems.push(item);
  return true;
}

/** How many pieces a list holds - a stack counts its own. */
export const piecesOf = (/** @type {any[]} */ items) => (items ?? []).reduce((n, it) => n + (Number.isInteger(it?.stackCount) && it.stackCount > 0 ? it.stackCount : 1), 0);

/** The court's word for what it took. */
export const confiscatedText = (/** @type {number} */ n) => t('stolen.taken', 'The guards take the stolen goods you carried ({n, plural, one {# item} other {# items}}).', { n });

/** The piece's card line (the enhanced pack's, beside the lock's and the junk's). */
export const stolenLine = () => t('stolen.card', 'Stolen. Merchants buy it but never sell it on, and the court takes it if you are convicted.');
