// @ts-check
// HACKED-GOLD (2026-10-12, bible/01-Overview/bugs/Field-Bugs-2026-10-12f.md; 06-Systems/Integrity-Arc.md, Progress):
// WHAT A PEER'S WORD MAY HAND ANOTHER PLAYER.
//
// A peer's word - a room's record of a container it has opened (WORLD4, WORLD6a), a body's grant (WORLD6b-iii(c)), a
// foe handed to its heir with its pack (PORTAL1's `it`), a fallen player's worn offer (WILD1) - is a CLIENT's word: no
// record anywhere holds what it carries, so the player it reaches takes what nobody gave. The item law answers "could an
// honest client have minted this?" (systems/item/itemLaw.js), and for a piece that bounds what it is worth. A LETTER OF
// CREDIT it cannot bound: a letter is gold drawn on its holder's account (every bank cashes it at its face - banking.js
// depositAllLetters - and every counter takes it as tender - court.js deductGold), and an honest one is whatever that
// account held. The report ("apparently theres people handing out hacked gold ingame") was that: a modified client's
// grant landed a 1,000,000,000,000-gold letter in an honest pack, and one word about a building's cupboard landed
// 9,000,000,000,000 more for whoever opened it next.
//
// A LETTER OF CREDIT NEVER RIDES A PEER'S WORD. No roll mints one (DFU's loot tables never do), so no honest container,
// body or worn offer holds one but by a player putting it there - and online a room's container and a body are
// everyone's (SS3's reasoning, systems/item/itemBound.js). A letter passes between players by the realm's own trade, which
// settles from the giver's record (net/realm/realmTradeLaw.js). So:
//   - online a letter is put nowhere but the player's own places - the pack, the wagon, the player's own storage, the
//     player's own pile on the ground (a drop is the dropper's, AUDIT WORLD B3) - and the window says why
//     (`letterRefusesPut`, both skins);
//   - every list a peer hands over lands without one, as it lands without a bound piece (`peerHanded`), and no list
//     this client says to the room carries one.
// Not a DFU member: Daggerfall has no other player to hand a piece to. Ledger A.
import { isBound } from './item/itemBound.js';
import { isOnlinePage } from './online/onlineLane.js';
import { REALM_LETTER_TEMPLATE } from '../net/realm/realmGoldLaw.js';   // the letter's template (systems/inventory.js LETTER_OF_CREDIT_TEMPLATE, pinned equal) - a leaf

/** A letter of credit - DFU's MiscItems Letter_of_credit, its worth its `value`. */
export const isLetterOfCredit = (/** @type {any} */ item) => item?.templateIndex === REALM_LETTER_TEMPLATE;

/** Whether a piece never rides a peer's word: a bound piece (SS3 - never handed to another player at all) and a letter of
 *  credit (handed over by the realm's trade alone). */
export const neverPeerHanded = (/** @type {any} */ item) => isBound(item) || isLetterOfCredit(item);

/** A list a peer handed over - or one this client says to the room - without what never rides a peer's word (null stays
 *  null: the caller's refusal). */
export const peerHanded = (/** @type {any[] | null} */ list) => (Array.isArray(list) ? list.filter((it) => !neverPeerHanded(it)) : list);

/** AUDIT AUTO-HOLD: A PIECE ITS READER ALREADY CARRIES never rides a peer's word to it - a second of a piece the reader
 *  holds is a copy the ledger locks, the reader's original with it, and since AUTO-HOLD a locked piece is bound (a
 *  griefer's body grant of a key it saw on the wire planted one; a stale shelf handed one back). The rule is registered
 *  by the realm session's wiring (scenes/realmHoldHost.js - the reader's own lists' ledger keys, world/interior/interiorShared.js
 *  withoutCarried), so this leaf never loads the item law; offline, none. */
let _carriedFilter = /** @type {((list: any[]) => any[]) | null} */ (null);
export function setCarriedFilter(/** @type {((list: any[]) => any[]) | null} */ fn) { _carriedFilter = typeof fn === 'function' ? fn : null; }
/** `list` without a piece its reader carries (null stays null). */
export const notCarried = (/** @type {any[] | null} */ list) => (Array.isArray(list) && _carriedFilter ? _carriedFilter(list) : list);

/** Whether a letter of credit may not be put THERE: online, any container that is not the player's own (`own` - the
 *  player's storage, the player's own pile on the ground) - a chest, a body, a cupboard is the room's once it is opened.
 *  The ground (a new pile is the dropper's), the wagon, the bag and a reward tray (DFU refuses every piece put there, in
 *  silence) are asked nothing. Offline no room shares a container: DFU's law stands. */
export const letterRefusesPut = (/** @type {any} */ item, /** @type {{ container?: boolean, own?: boolean, online?: boolean }} */ { container = false, own = false, online = isOnlinePage() } = {}) =>
  online && isLetterOfCredit(item) && container && !own;

/** The refusal, in the windows' own voice (itemBound.js boundText's shape). */
export const letterPutText = (/** @type {string} */ name) => `${name || 'A letter of credit'} stays with you online, because anyone can take from a chest or a body. Hand it over in a trade.`;
