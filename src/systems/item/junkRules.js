// @ts-check
// JUNK-RULES: what may be marked junk, and "Always junk" (a player's ask: tag books, potions and misc too, and mark Prayer
// Beads once so every Prayer Beads found later is junk). The mark (itemJunk.js) is the seller's word: Sell junk puts every marked
// piece on the counter at the shop's own price. Not a DFU member: Daggerfall has no junk. Ledger A (the Loot arc II).
//   canJunk          any piece the pack may let go of; the same refusals a trade makes (tradePack.js tradeRefusal), and the kept spellbook.
//   Always junk      NAMES the player lists (pref `junkAlways`); isJunkNow is a marked piece or a listed name, never a piece that may not be junk.
//   canJunkInBatch   canJunk and not locked: a single press lifts a lock, a sweep over a category never does.
import { tradeRefusal } from '../tradePack.js';
import { isKeptSpellbook } from './itemTransfer.js';
import { isLocked } from './itemLock.js';
import { isJunk } from './itemJunk.js';
import { itemNameParts } from './itemInfo.js';
import { getPref, setPref } from '../uiPrefs.js';
import { t } from '../textManager.js';

export const JUNK_ALWAYS_PREF = 'junkAlways';
export const JUNK_ALWAYS_MAX = 200;

/** Why a piece may not be marked junk, in words, or null when it may. */
export function junkRefusal(/** @type {any} */ item) {
  if (!item || typeof item !== 'object') return t('inventory.junkRules.notItem', 'That is not an item.');
  const trade = tradeRefusal(item);
  if (trade) return trade;
  if (isKeptSpellbook(item)) return t('inventory.junkRules.spellbook', 'Your spellbook is kept.');
  if (item.group === 'Currency') return t('inventory.junkRules.gold', 'Gold is not junk.');
  return null;
}
/** Whether a piece may be marked junk (by a press on it). */
export const canJunk = (/** @type {any} */ item) => junkRefusal(item) === null;
/** Whether a sweep may mark a piece: canJunk, and not locked. */
export const canJunkInBatch = (/** @type {any} */ item) => canJunk(item) && !isLocked(item);

/** A piece's name as the player reads it ("Prayer Beads"), the one the list holds. */
export const junkName = (/** @type {any} */ item) => String(itemNameParts(item)?.name || item?.name || '').trim();
const same = (/** @type {string} */ a, /** @type {string} */ b) => a.toLowerCase() === b.toLowerCase();

/** The always-junk names now: the valid strings of the pref. */
export function alwaysJunkNames() {
  const v = getPref(JUNK_ALWAYS_PREF);
  return Array.isArray(v) ? v.filter((n) => typeof n === 'string' && n.trim() !== '').slice(0, JUNK_ALWAYS_MAX) : [];
}
/** Is this piece's name on the always-junk list? (Whether it may be marked is `isJunkNow`'s.) */
export function isAlwaysJunk(/** @type {any} */ item) {
  const name = junkName(item);
  return name !== '' && alwaysJunkNames().some((n) => same(n, name));
}
/** Put a piece's name on the list or take it off. Answers whether it is on the list now (a piece that may not be junk is never put on). */
export function setAlwaysJunk(/** @type {any} */ item, /** @type {boolean} */ on) {
  const name = junkName(item);
  if (!name) return false;
  const rest = alwaysJunkNames().filter((n) => !same(n, name));
  if (on && canJunk(item) && rest.length < JUNK_ALWAYS_MAX) { setPref(JUNK_ALWAYS_PREF, [...rest, name]); return true; }
  setPref(JUNK_ALWAYS_PREF, rest);
  return false;
}
/** Flip it. Answers whether the name is listed now. */
export const toggleAlwaysJunk = (/** @type {any} */ item) => setAlwaysJunk(item, !isAlwaysJunk(item));
/** Take one name off the list (the settings drawer's ×). */
export function forgetAlwaysJunk(/** @type {string} */ name) {
  setPref(JUNK_ALWAYS_PREF, alwaysJunkNames().filter((n) => !same(n, name)));
}

/** Is a piece junk NOW: marked, or its name listed (a piece that may not be junk - a quest's of the same name - is not made so by a name). */
export const isJunkNow = (/** @type {any} */ item) => !!item && (isJunk(item) || (isAlwaysJunk(item) && canJunk(item)));
