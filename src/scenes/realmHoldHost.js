// @ts-check
// THE REALM'S HOLDS, SAID TO THE PLAYER (INT3; AUTO-HOLD, 2026-10-16 - Mac: "We need to figure out a better system for
// trade banning. I dont want to have to manually review"; bible/06-Systems/Integrity-Arc.md AUTO-HOLD). The realm session
// (systems/realmSaves.js) hears two things from a landed checkpoint: the hold on the character's trade as it moves
// (onTradeHeld - the law's piece named, or a timed hold's end) and the pieces the ledger locked (onPiecesLocked - copies
// found, locked piece by piece; the character trades on). bootWorld wires both here, one line (HOST-SPLIT) - and, AUDIT
// AUTO-HOLD, what the client does with them: the locked pieces bound while they are (systems/item/itemBound.js
// setRealmLocked), and the pieces the character stowed read off the last save the realm took for the shop's shelf
// (systems/item/itemIds.js setStowedKeys).
import { tradeHeldNotice, lockedPiecesOf, ledgerKeyOf, setStowedKeys, carriedPieces } from '../systems/item/itemIds.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { setRealmLocked } from '../systems/item/itemBound.js';
import { possessedItemLists } from '../systems/item/possessedItems.js';
import { setCarriedFilter } from '../systems/peerWord.js';   // AUDIT AUTO-HOLD: a peer's word never hands the reader a piece it carries
import { withoutCarried } from '../world/interior/interiorShared.js';
import { t } from '../systems/textManager.js';   // L10N4: the notice in the player's language

/** How many locked pieces one notice names; the rest are counted. */
const NAMED_MAX = 3;

/** AUTO-HOLD: the notice for locked pieces, in the player's language - `names` the pieces found in the character's own
 *  lists (each piece, a key the pack shows twice twice), `count` how many were locked in all (a piece set out in a room,
 *  a boat's hold, is locked as well, and named by none). Null for none. AUDIT AUTO-HOLD: it says what happened and what
 *  it means, and accuses no one - a receiver whose giver's game died, a piece taken back from its owner's own remains
 *  (server-account/src/wild.js), a shelf's stale word: none of them copied anything. */
export function piecesLockedNotice(/** @type {string[]} */ names, /** @type {number} */ count) {
  if (!(count > 0)) return null;
  if (count === 1) {
    return names[0]
      ? t('realm.locked.named', 'The realm has locked your {name}: it found the same piece somewhere else too. It stays with you and cannot be traded, sold, dropped or stored where others can take it. Your other pieces and your trading are not affected.', { name: names[0] })
      : t('realm.locked.one', 'The realm has locked one of your pieces: it found the same piece somewhere else too. It stays with you and cannot be traded, sold, dropped or stored where others can take it. Your other pieces and your trading are not affected.');
  }
  const shown = names.slice(0, NAMED_MAX);
  if (!shown.length) return t('realm.locked.many', 'The realm has locked {n, number} of your pieces: it found the same pieces somewhere else too. They stay with you and cannot be traded, sold, dropped or stored where others can take them. Your other pieces and your trading are not affected.', { n: count });
  const more = count - shown.length;
  const list = more > 0 ? t('realm.locked.listMore', '{names} and {n, number} more', { names: shown.join(', '), n: more }) : shown.join(', ');
  return t('realm.locked.manyNamed', 'The realm has locked {n, number} of your pieces ({list}): it found the same pieces somewhere else too. They stay with you and cannot be traded, sold, dropped or stored where others can take them. Your other pieces and your trading are not affected.', { n: count, list });
}

/** AUDIT AUTO-HOLD: the ledger keys of the pieces a save holds BEYOND the character's own five lists - a room's chest, a
 *  ship's hold, a companion's pack (systems/item/possessedItems.js, the judge's own reading) - the own lists being the live
 *  pack's to say (a piece sold since the save is no longer held, and its shelf must show it). */
export function stowedKeysOf(/** @type {any} */ save) {
  const stowed = new Set();
  if (!save || typeof save !== 'object') return stowed;
  const away = { ...save, items: [], wagonItems: [], bagItems: [], furnishings: [], otherItems: [] };
  for (const list of possessedItemLists(away)) for (const it of list) { const k = ledgerKeyOf(it); if (k) stowed.add(k); }
  return stowed;
}

/** The stowed keys off the session's last landed save, read once a landing (a save is parsed only when a shelf asks). */
function stowedReader(/** @type {any} */ session) {
  /** @type {string | null} */ let text = null;
  /** @type {Set<string> | null} */ let keys = null;
  return () => {
    const now = session?.landedText ?? null;
    if (now !== text) { text = now; keys = null; }
    if (keys == null) {
      try { keys = text ? stowedKeysOf(JSON.parse(text)) : new Set(); } catch { keys = new Set(); }
    }
    return keys;
  };
}

/**
 * Wire `session`'s two notices to `say`, naming pieces from `entity`'s own lists; and bind the locked pieces and read the
 * stowed ones for the client's own laws. A null session (offline) unbinds and reads nothing.
 * @param {any} session @param {{ say: (text: string) => void, entity: any }} deps
 */
export function wireRealmHolds(session, { say, entity }) {
  setRealmLocked(session?.lockedKeys ?? []);
  setStowedKeys(session ? stowedReader(session) : () => null);
  setCarriedFilter(session ? (list) => withoutCarried(list, carriedPieces(entity)) : null);
  if (!session) return;
  session.onTradeHeld = (/** @type {string | null} */ prev, /** @type {string | null} */ now, /** @type {any} */ why) => { const text = tradeHeldNotice(prev, now, why); if (text) say(text); };
  session.onLockedKeys = (/** @type {string[]} */ keys) => setRealmLocked(keys);
  session.onPiecesLocked = (/** @type {string[]} */ keys) => {
    const { pieces, unfound } = lockedPiecesOf(entity, keys);
    const text = piecesLockedNotice(pieces.map((it) => itemLongName(it)), pieces.length + unfound);
    if (text) say(text);
  };
}
