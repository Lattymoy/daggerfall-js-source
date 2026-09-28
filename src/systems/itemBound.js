// @ts-check
// SS1 (2026-09-27, Mac: "make sigil stones bound items and stackable"): A BOUND PIECE IS NEVER HANDED TO ANOTHER PLAYER.
//
// Binding is the item's own nature, not the player's choice. Its template row can say `bound` (the Sigil Stone's does -
// systems/gateSpoils.js), so every such piece is bound, one minted before the row said so included, and no field on
// the record can unbind it; and SS4 (Mac: "make the items sold by the oblivion vendor bound also") a piece can carry
// the mark itself (`bound: true`, a declared field - systems/itemFields.js), set where it is won: the Sigil Broker's
// wares (systems/sigilBroker.js brokerStock), so what the stones bought stays with the one who spent them. It closes
// every way a piece could leave its owner for good:
//   - the trade (TRADE1, systems/tradePack.js): never put on the table, and a peer's lot carrying one refused whole;
//   - SS3 (Mac: "They shouldnt be able to be dropped"): the world. A bound piece goes nowhere but the player's pack, the
//     player's wagon and the player's own storage (`BOUND_KEEPS`) - never the ground, a corpse, a chest or a reward tray
//     (ui/enhancedInventory.js, ui/nativeInventory.js). A world container is the ROOM's once it is opened online (WORLD4,
//     WORLD6a: a dungeon's and a building's containers ride the room's memory, and a peer's body is granted to whoever
//     loots it - scenes/exteriorFoes.js grantCorpse), so a stone put in one would reach the next player to open it;
//     and every list a peer hands over - a body's grant, a container's record, a foe's items - lands without one
//     (`unbound`), whatever build sent it.
//   - SS4 (Mac: "Can't be traded, dropped or sold. Sigil stones shouldnt be able to be sold"): the COUNTER - neither
//     skin's Sell nor Sell Magic stages a bound piece (ui/enhancedTrade.js, ui/nativeTrade.js), in words; a repair and
//     an identify still take one, because it comes back.
// A bound piece is still worn, used, moved about the pack, and put in the wagon and the player's own storage; the lock
// (LOCK1, itemLock.js) is the player's own word and closes the same three doors to anything. The two never mix.
//
// Not a DFU member: Daggerfall has no other player to hand a piece to. Ledger A.
import { templateByIndex } from './itemTemplates.js';

/** Whether a piece is bound: its own mark (SS4), or its template row - and no mark unbinds what the row binds. */
export const isBound = (/** @type {any} */ item) => item?.bound === true || templateByIndex(item?.templateIndex)?.bound === true;

/** SS3: the places a bound piece may be put, by the pack's own words for them (ui/enhancedInventory.js remoteModel's
 *  kinds): the player's wagon and the player's own storage (a storage piece opens for its owner alone - worldModes.js
 *  activateDecor) - never a room's. */
export const BOUND_KEEPS = Object.freeze(['wagon', 'storage']);

/** SS3: whether a bound piece may not be put THERE (a remote kind): every place but the player's own. */
export const boundRefusesPut = (/** @type {any} */ item, /** @type {string} */ kind) => isBound(item) && !BOUND_KEEPS.includes(kind);

/** SS3: a list a peer handed over, without its bound pieces (null stays null - the caller's refusal). */
export const unbound = (/** @type {any[] | null} */ list) => (Array.isArray(list) ? list.filter((it) => !isBound(it)) : list);

/** The trade's refusal, in its own voice (tradePack.js tradeRefusal's other words). */
export const BOUND_TRADE_TEXT = 'Bound items cannot be traded.';

/** SS3/SS4: the refusal, in the windows' own voice (itemLock.js lockedText's shape) - the pack's and the counter's. */
export const boundText = (/** @type {string} */ name) => `${name || 'That'} is bound to you - it cannot be dropped, traded or sold.`;

/** The card's line for a bound piece. */
export const BOUND_LINE = 'Bound - it cannot be dropped, traded or sold.';
