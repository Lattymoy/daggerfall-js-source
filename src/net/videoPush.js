// @ts-check
// VIDEO1 — client end of video push (HOST-SPLIT: hosts wire ears, not the socket).
import { videoInGate, validVideoFrame, VIDEO_WELCOME_FIELD, VIDEO_ORDER_HZ_MAX } from './videoSurfaceWordLaw.js';

export const VIDEO_ORDER_KEEP_MS = 50_000;
export const VIDEO_SEND_MS = Math.ceil(1000 / VIDEO_ORDER_HZ_MAX) + 50;

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
/** @type {Set<(words: any[][]) => void>} */
const ears = new Set();

export function videoLinkWelcomed(/** @type {any} */ session, /** @type {any} */ welcome, /** @type {(frame: string) => boolean} */ send, now = Date.now()) {
  link = { session, send };
  healthy = welcome?.[VIDEO_WELCOME_FIELD] === 1;
  epoch++;
  sentAt = -Infinity;
  flushVideoOrders(now);
}

export function videoLinkClosed(/** @type {any} */ session) {
  if (link?.session !== session) return;
  link = null;
  healthy = false;
}

export const videoPushState = () => ({ healthy, epoch });

export function carryVideoOrder(/** @type {unknown} */ order, now = Date.now()) {
  if (typeof order !== 'string' || !order || order.length > 1024) return false;
  held.push({ order, until: now + VIDEO_ORDER_KEEP_MS });
  return flushVideoOrders(now) > 0;
}

export function flushVideoOrders(now = Date.now()) {
  held = held.filter((h) => now < h.until);
  if (!held.length || !link || !healthy) return 0;
  const wait = sentAt + VIDEO_SEND_MS - now;
  if (wait > 0) { armFlush(wait); return 0; }
  const next = held[0];
  if (!link.send(JSON.stringify({ t: 'video', order: next.order }))) return 0;
  held.shift();
  sentAt = now;
  if (held.length) armFlush(VIDEO_SEND_MS);
  return 1;
}

function armFlush(/** @type {number} */ ms) {
  if (flushT) return;
  flushT = setTimeout(() => { flushT = null; flushVideoOrders(); }, ms);
}

export function hearVideoFrame(/** @type {any} */ session, /** @type {any} */ m, now = Date.now()) {
  if (link?.session !== session) return;
  const words = validVideoFrame(m);
  if (!words) return;
  const g = videoInGate(inBucket, now);
  inBucket = g.bucket;
  if (!g.pass) return;
  for (const ear of [...ears]) {
    try { ear(words); } catch { /* ear fault is never the link's */ }
  }
}

export function onVideoWords(/** @type {(words: any[][]) => void} */ ear) {
  ears.add(ear);
  return () => { ears.delete(ear); };
}

export function _resetVideoPush() {
  if (flushT) clearTimeout(flushT);
  link = null; healthy = false; epoch = 0; held = [];
  sentAt = -Infinity; flushT = null; inBucket = null; ears.clear();
}
