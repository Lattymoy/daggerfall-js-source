// @ts-check
// LOCK-RULES: "Always lock" (a player's ask: a menu button to lock an item for good). The lock (itemLock.js) is one flag that
// closes the ways out of the pack: drop, sell, trade. A name kept locked is the same refusal for every piece of that name, now and
// when it is looted next: `isLocked` asks this list through the resolver registered below, so every window that honours the lock
// honours the name, and nothing is written on the item. The lock is the stronger word: a name put here comes off Always junk
// (junkRules.js) and the piece loses its junk mark. The answer is kept per piece until the list (pref `lockAlways`) or the
// piece's own name changes.
// Not a DFU member: Daggerfall has no lock. Ledger A.
import { getPref, setPref } from '../uiPrefs.js';
import { setAlwaysLockedResolver } from './itemLock.js';
import { junkName, forgetAlwaysJunk } from './junkRules.js';
import { setJunk } from './itemJunk.js';

export const LOCK_ALWAYS_PREF = 'lockAlways';
export const LOCK_ALWAYS_MAX = 200;

/** The always-locked names now: the valid strings of the pref. */
export function alwaysLockNames() {
  const v = getPref(LOCK_ALWAYS_PREF);
  return Array.isArray(v) ? v.filter((n) => typeof n === 'string' && n.trim() !== '').slice(0, LOCK_ALWAYS_MAX) : [];
}
/** @type {WeakMap<object, { list: unknown, name: string, locked: boolean }>} */
const kept = new WeakMap();
/** Is this piece's name always locked? Kept per piece until the list changes (a list is replaced, never edited, by every writer)
 *  or the piece is renamed in place (an item's name is read each time, so a rename is seen). */
export function isAlwaysLocked(/** @type {any} */ item) {
  if (!item || typeof item !== 'object') return false;
  const list = getPref(LOCK_ALWAYS_PREF);
  if (!Array.isArray(list) || list.length === 0) return false;
  const name = junkName(item).toLowerCase();
  const hit = kept.get(item);
  if (hit && hit.list === list && hit.name === name) return hit.locked;
  const locked = name !== '' && alwaysLockNames().some((n) => n.toLowerCase() === name);
  kept.set(item, { list, name, locked });
  return locked;
}
/** Put a piece's name on the list or take it off. Answers whether it is on the list now. */
export function setAlwaysLock(/** @type {any} */ item, /** @type {boolean} */ on) {
  const name = junkName(item);
  if (!name) return false;
  const rest = alwaysLockNames().filter((n) => n.toLowerCase() !== name.toLowerCase());
  if (on && rest.length < LOCK_ALWAYS_MAX) {
    setPref(LOCK_ALWAYS_PREF, [...rest, name]);
    forgetAlwaysJunk(name);   // the lock is the stronger word: the name is no longer always junk,
    setJunk(item, false);     // and this piece loses its mark
    return true;
  }
  setPref(LOCK_ALWAYS_PREF, rest);
  return false;
}
/** Flip it. Answers whether the name is always locked now. */
export const toggleAlwaysLock = (/** @type {any} */ item) => setAlwaysLock(item, !isAlwaysLocked(item));
/** Take one name off the list (the settings drawer's ×). */
export function forgetAlwaysLock(/** @type {string} */ name) {
  setPref(LOCK_ALWAYS_PREF, alwaysLockNames().filter((n) => n.toLowerCase() !== name.toLowerCase()));
}

setAlwaysLockedResolver(isAlwaysLocked);   // the lock asks the list from here on
