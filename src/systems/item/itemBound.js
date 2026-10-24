// @ts-check
// SS1 (2026-09-27, Mac: "make sigil stones bound items and stackable"): A BOUND PIECE IS NEVER HANDED TO ANOTHER PLAYER.
//
// Binding is the item's own nature, not the player's choice. Its template row can say `bound` (the Sigil Stone's does -
// systems/gate/gateSpoils.js), so every such piece is bound, one minted before the row said so included, and no field on
// the record can unbind it; and SS4 (Mac: "make the items sold by the oblivion vendor bound also") a piece can carry
// the mark itself (`bound: true`, a declared field - systems/item/itemFields.js), set where it is won: the Sigil Broker's
// wares (systems/sigil/sigilBroker.js brokerStock), so what the stones bought stays with the one who spent them. It closes
// every way a piece could leave its owner for good:
//   - the trade (TRADE1, systems/tradePack.js): never put on the table, and a peer's lot carrying one refused whole;
//   - SS3 (Mac: "They shouldnt be able to be dropped"): the world. A bound piece goes nowhere but the player's pack, the
//     player's wagon and the player's own storage (`BOUND_KEEPS`) - never the ground, a corpse, a chest or a reward tray
//     (ui/enhanced/enhancedInventory.js, ui/native/nativeInventory.js). A world container is the ROOM's once it is opened online (WORLD4,
//     WORLD6a: a dungeon's and a building's containers ride the room's memory, and a peer's body is granted to whoever
//     loots it - scenes/exteriorFoes.js grantCorpse), so a stone put in one would reach the next player to open it;
//     and every list a peer hands over - a body's grant, a container's record, a foe's items - lands without one
//     (`unbound`), whatever build sent it.
//   - SS4 (Mac: "Can't be traded, dropped or sold. Sigil stones shouldnt be able to be sold"): the COUNTER - neither
//     skin's Sell nor Sell Magic stages a bound piece (ui/enhanced/enhancedTrade.js, ui/native/nativeTrade.js), in words; a repair and
//     an identify still take one, because it comes back.
// A bound piece is still worn, used, moved about the pack, and put in the wagon and the player's own storage; the lock
// (LOCK1, itemLock.js) is the player's own word and closes the same three doors to anything. The two never mix.
//
// AUDIT AUTO-HOLD (2026-10-16, bible/06-Systems/Integrity-Arc.md): A PIECE THE REALM LOCKED IS BOUND TOO, while it is.
// The ledger locks a copy it finds (server-account/src/ledger.js item_dupes) - no route of the service's moves it - but a
// counter, the ground and a room's container are the client's, and a locked copy sold to a shop or left in a chest was
// taken up by the next player as a second of a piece another holds: locked on them in turn, an honest buyer's purchase
// with it. So the copies the realm session last heard named (`setRealmLocked`) close the same doors a binding does - a
// salvage too, whose shards would be the copy's worth out - and say why in their own words (boundText, boundLine,
// boundTradeText). What is no way out (wearing it, using it, the pack, the wagon, the player's own storage) still takes
// them.
//
// Not a DFU member: Daggerfall has no other player to hand a piece to. Ledger A.
import { templateByIndex } from './itemTemplates.js';
import { t } from '../textManager.js';   // AUDIT AUTO-HOLD: the realm lock's words, in the player's language

/** AUDIT AUTO-HOLD: the ledger keys of the pieces the realm locked on this character (scenes/realmHoldHost.js sets them
 *  from the realm session), none offline. */
let _realmLocked = new Set();
export function setRealmLocked(/** @type {Iterable<string> | null | undefined} */ keys) { _realmLocked = new Set(keys ?? []); }
/** Whether the realm locked this piece - its ledger key (systems/item/itemIds.js ledgerKeyOf: a craft's provenance, or the id
 *  its first checkpoint stamped) among the locked. */
export const isRealmLocked = (/** @type {any} */ item) => _realmLocked.size > 0 && !!item
  && ((typeof item.provenance === 'string' && _realmLocked.has(item.provenance)) || (typeof item.uid === 'string' && _realmLocked.has(item.uid)));

/** Whether a piece is bound BY ITS NATURE: its own mark (SS4), or its template row - and no mark unbinds what the row
 *  binds. */
export const isBoundByNature = (/** @type {any} */ item) => item?.bound === true || templateByIndex(item?.templateIndex)?.bound === true;
/** Whether a piece is bound: by its nature, or - while it is - by the realm's lock (AUDIT AUTO-HOLD). */
export const isBound = (/** @type {any} */ item) => isBoundByNature(item) || isRealmLocked(item);

/** SS3: the places a bound piece may be put, by the pack's own words for them (ui/enhanced/enhancedInventory.js remoteModel's
 *  kinds): the player's wagon and the player's own storage (a storage piece opens for its owner alone - worldModes.js
 *  activateDecor) - never a room's. */
export const BOUND_KEEPS = Object.freeze(['wagon', 'storage']);

/** WALLET1: a PACK-ONLY piece (its template row's `packOnly` - the Wallet's, systems/walletItem.js) is bound and goes
 *  nowhere at all: not even the player's own wagon or storage, for a wallet that left the pack would leave what it holds
 *  back on the pack's pages. */
export const isPackOnly = (/** @type {any} */ item) => templateByIndex(item?.templateIndex)?.packOnly === true;

/** SS3: whether a bound piece may not be put THERE (a remote kind): every place but the player's own - and WALLET1, a
 *  pack-only piece no place at all. */
export const boundRefusesPut = (/** @type {any} */ item, /** @type {string} */ kind) => isBound(item) && (isPackOnly(item) || !BOUND_KEEPS.includes(kind));

/** SS3: a list a peer handed over, without its bound pieces (null stays null - the caller's refusal). */
export const unbound = (/** @type {any[] | null} */ list) => (Array.isArray(list) ? list.filter((it) => !isBound(it)) : list);

/** The trade's refusal, in its own voice (tradePack.js tradeRefusal's other words). */
export const BOUND_TRADE_TEXT = 'Bound items cannot be traded.';
/** ...and the realm lock's (AUDIT AUTO-HOLD). */
export const boundTradeText = (/** @type {any} */ item = null) => (realmLockedOnly(item)
  ? t('realm.locked.trade', 'A piece the realm locked cannot be traded.') : BOUND_TRADE_TEXT);

/** A piece bound by the realm's lock and not by its nature - the one whose words are the realm lock's. */
const realmLockedOnly = (/** @type {any} */ item) => !!item && isRealmLocked(item) && !isBoundByNature(item);

/** SS3/SS4: the refusal, in the windows' own voice (itemLock.js lockedText's shape) - the pack's and the counter's; for a
 *  piece the realm locked (`item`), the realm lock's (AUDIT AUTO-HOLD). */
export const boundText = (/** @type {string} */ name, /** @type {any} */ item = null) => (realmLockedOnly(item)
  ? t('realm.locked.refusal', '{name} is locked by the realm because the same piece was found somewhere else too. It stays with you and cannot be dropped, traded, sold or stored where others can take it.', { name })
  : `${name || 'That'} is bound to you. It cannot be dropped, traded or sold.`);

/** The card's line for a bound piece. */
export const BOUND_LINE = 'Bound. It cannot be dropped, traded or sold.';
/** ...and for one the realm locked (AUDIT AUTO-HOLD) - the card's line for `item`, null for a piece bound by neither. */
export const boundLine = (/** @type {any} */ item) => (!isBound(item) ? null : realmLockedOnly(item)
  ? t('realm.locked.line', 'Locked by the realm. It stays with you and cannot be dropped, traded, sold or stored where others can take it.') : BOUND_LINE);

/** WALLET1: a pack-only piece's refusal, in the windows' own voice - wherever it was put. */
export const packOnlyText = (/** @type {string} */ name) => `${name || 'That'} stays in your pack.`;
