// @ts-check
// YARD-CELL YC2 (2026-10-27, bible/11-Multiplayer/Yard-Cells.md sections 3.6 and 3.7) - THE PAGE'S END OF THE YARD PUSH,
// between the hub link (net/online.js), the account door (net/accountClient.js, each decor answer's YARD ORDER) and the
// yards' sync (scenes/yardCellSync.js); apart from the hosts, so the world's host wires nothing new (HOST-SPLIT).
// carry: an order is held YARD_ORDER_KEEP_MS and sent one each YARD_SEND_MS, only to a hub whose welcome said
// YARD_WELCOME_FIELD (an older relay closes a socket on a frame it does not know); one not taken is dropped - the other
// pages' polls find the cell. hear: the hub's frames, gated (yardInGate), handed to every ear. healthy: welcomed by a
// relay that hears yard words, open since; `epoch` counts the welcomes, so a reader tells a link that broke and came back.

import { yardInGate, validYardFrame, YARD_WELCOME_FIELD, YARD_ORDER_HZ_MAX } from './yardWordLaw.js';

/** How long a yard order is held for a hub link to take it - under the order's minute (identityToken.js ORDER_TTL_S). */
export const YARD_ORDER_KEEP_MS = 50_000;
/** The wait between two orders down the link - inside the hub's YARD_ORDER_HZ_MAX. */
export const YARD_SEND_MS = Math.ceil(1000 / YARD_ORDER_HZ_MAX) + 100;

/** @type {{ session: any, send: (frame: string) => boolean } | null} */
let link = null;
let healthy = false;
let epoch = 0;
/** @type {Array<{ order: string, until: number }>} */
let held = [];
let sentAt = -Infinity;
/** @type {ReturnType<typeof setTimeout> | null} */
let flushT = null;
/** @type {any} */
let inBucket = null;
/** @type {Set<(words: number[][]) => void>} */
const ears = new Set();

/** The hub link's welcome: `send(frame)` answers whether the frame went down the socket. */
export function yardLinkWelcomed(
  /** @type {any} */ session,
  /** @type {any} */ welcome,
  /** @type {(frame: string) => boolean} */ send,
  now = Date.now(),
) {
  link = { session, send };
  healthy = welcome?.[YARD_WELCOME_FIELD] === 1;
  epoch++;
  sentAt = -Infinity;
  flushYardOrders(now);
}

/** The hub link's socket closed: the push is broken until the next welcome. */
export function yardLinkClosed(/** @type {any} */ session) {
  if (link?.session !== session) return;
  link = null;
  healthy = false;
}

/** Whether the push is healthy now, and the count of welcomes (yardCellSync.js reads a break by it). */
export const yardPushState = () => ({ healthy, epoch });

/** An order a decor answer carried (net/accountClient.js), held and sent. Answers whether it went down now. */
export function carryYardOrder(/** @type {unknown} */ order, now = Date.now()) {
  if (typeof order !== 'string' || !order || order.length > 1024) return false;
  held.push({ order, until: now + YARD_ORDER_KEEP_MS });
  return flushYardOrders(now) > 0;
}

/** The held orders down the link, one each YARD_SEND_MS; the rest wait for a timer. Answers how many went down now. */
export function flushYardOrders(now = Date.now()) {
  held = held.filter((h) => now < h.until);
  if (!held.length || !link || !healthy) return 0;
  const wait = sentAt + YARD_SEND_MS - now;
  if (wait > 0) {
    armFlush(wait);
    return 0;
  }
  const next = held[0];
  if (!link.send(JSON.stringify({ t: 'yard', order: next.order }))) return 0;
  held.shift();
  sentAt = now;
  if (held.length) armFlush(YARD_SEND_MS);
  return 1;
}

function armFlush(/** @type {number} */ ms) {
  if (flushT) return;
  flushT = setTimeout(() => {
    flushT = null;
    flushYardOrders();
  }, ms);
}

/** A hub frame `{t:'yard', l}` heard on `session`'s socket - its words to every ear, if it is the link's and passes. */
export function hearYardFrame(/** @type {any} */ session, /** @type {any} */ m, now = Date.now()) {
  if (link?.session !== session) return;
  const words = validYardFrame(m);
  if (!words) return;
  const g = yardInGate(inBucket, now);
  inBucket = g.bucket;
  if (!g.pass) return;
  for (const ear of [...ears]) {
    try {
      ear(words);
    } catch {
      /* an ear's fault is never the link's */
    }
  }
}

/** An ear for the hub's yard words; answers its removal. */
export function onYardWords(/** @type {(words: number[][]) => void} */ ear) {
  ears.add(ear);
  return () => {
    ears.delete(ear);
  };
}

/** The tests' clean slate. */
export function _resetYardPush() {
  if (flushT) clearTimeout(flushT);
  link = null;
  healthy = false;
  epoch = 0;
  held = [];
  sentAt = -Infinity;
  flushT = null;
  inBucket = null;
  ears.clear();
}
