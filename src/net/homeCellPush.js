// @ts-check
// YC4 (2026-10-29, bible/11-Multiplayer/Yard-Cells.md sections 14.4 and 14.5) - THE PAGE'S END OF THE HOME CELL PUSH,
// between the hub link (net/online.js), the account door (net/accountClient.js, each home write's HOME CELL ORDERS) and
// the homes' registry (systems/online/onlineHomes.js). net/yardPush.js's shape, for the home cell word: an order is held
// HOME_CELL_ORDER_KEEP_MS and sent one each HOME_CELL_SEND_MS, only to a hub whose welcome said HOME_CELL_WELCOME_FIELD
// (an older relay closes a socket on a frame it does not know). An order not taken is dropped: the other pages' polls
// find the cell. The hub's frames are checked and gated (homeCellInGate), then handed to every ear.

import { homeCellInGate, validHomeCellFrame, HOME_CELL_WELCOME_FIELD, HOME_CELL_ORDER_HZ_MAX } from './homeCellWordLaw.js';

/** How long a home cell order is held for a hub link to take it - under the order's minute (identityToken.js ORDER_TTL_S). */
export const HOME_CELL_ORDER_KEEP_MS = 50_000;
/** The wait between two orders down the link - inside the hub's HOME_CELL_ORDER_HZ_MAX. */
export const HOME_CELL_SEND_MS = Math.ceil(1000 / HOME_CELL_ORDER_HZ_MAX) + 100;
/** The longest order string carried - a signed order is far shorter; anything longer is no order. */
const HOME_CELL_ORDER_CHARS_MAX = 1024;

/** @type {{ session: any, send: (frame: string) => boolean } | null} */
let link = null;
let hears = false;
/** @type {Array<{ order: string, until: number }>} */
let held = [];
let sentAt = -Infinity;
/** @type {ReturnType<typeof setTimeout> | null} */
let flushTimer = null;
/** @type {any} */
let inBucket = null;
/** @type {Set<(words: number[][]) => void>} */
const ears = new Set();

/** The hub link's welcome: `send(frame)` answers whether the frame went down the socket. */
export function homeCellLinkWelcomed(/** @type {any} */ session, /** @type {any} */ welcome, /** @type {(frame: string) => boolean} */ send, now = Date.now()) {
  link = { session, send };
  hears = welcome?.[HOME_CELL_WELCOME_FIELD] === 1;
  sentAt = -Infinity;
  flushHomeCellOrders(now);
}

/** The hub link's socket closed: no order goes until the next welcome. */
export function homeCellLinkClosed(/** @type {any} */ session) {
  if (link?.session !== session) return;
  link = null;
  hears = false;
}

/** Whether the hub link now takes home cell orders. */
export const homeCellLinkHears = () => hears;

/** The orders a home write answered (net/accountClient.js), held and sent. Answers how many went down now. */
export function carryHomeCellOrders(/** @type {unknown} */ orders, now = Date.now()) {
  if (!Array.isArray(orders)) return 0;
  for (const order of orders) {
    if (typeof order !== 'string' || !order || order.length > HOME_CELL_ORDER_CHARS_MAX) continue;
    held.push({ order, until: now + HOME_CELL_ORDER_KEEP_MS });
  }
  return flushHomeCellOrders(now);
}

/** The held orders down the link, one each HOME_CELL_SEND_MS; the rest wait for a timer. Answers how many went down now. */
export function flushHomeCellOrders(now = Date.now()) {
  held = held.filter((entry) => now < entry.until);
  if (!held.length || !link || !hears) return 0;
  const wait = sentAt + HOME_CELL_SEND_MS - now;
  if (wait > 0) {
    armFlush(wait);
    return 0;
  }
  const next = held[0];
  if (!link.send(JSON.stringify({ t: 'hcell', order: next.order }))) return 0;
  held.shift();
  sentAt = now;
  if (held.length) armFlush(HOME_CELL_SEND_MS);
  return 1;
}

function armFlush(/** @type {number} */ ms) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushHomeCellOrders();
  }, ms);
}

/** A hub frame `{t:'hcell', l}` heard on `session`'s socket - its words to every ear, if it is the link's and passes. */
export function hearHomeCellFrame(/** @type {any} */ session, /** @type {any} */ frame, now = Date.now()) {
  if (link?.session !== session) return;
  const words = validHomeCellFrame(frame);
  if (!words) return;
  const gate = homeCellInGate(inBucket, now);
  inBucket = gate.bucket;
  if (!gate.pass) return;
  for (const ear of [...ears]) {
    try {
      ear(words);
    } catch {
      // an ear's fault is never the link's
    }
  }
}

/** An ear for the hub's home cell words `[mapId, cell, version]`; answers its removal. */
export function onHomeCellWords(/** @type {(words: number[][]) => void} */ ear) {
  ears.add(ear);
  return () => {
    ears.delete(ear);
  };
}

/** The tests' clean slate. */
export function _resetHomeCellPush() {
  if (flushTimer) clearTimeout(flushTimer);
  link = null;
  hears = false;
  held = [];
  sentAt = -Infinity;
  flushTimer = null;
  inBucket = null;
  ears.clear();
}
