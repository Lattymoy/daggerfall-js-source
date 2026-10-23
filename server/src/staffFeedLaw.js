// @ts-check
// STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts, Monster watch, Bot check and
// Server load) - THE RELAY'S TWO STAFF FEEDS, THEIR LAW: what a batch is, how the relay signs it and how the account
// service opens it. Pure; the relay (server/src/staffFeeds.js) and the service (server-account/src/staffNet.js,
// staffReactions.js) import it, and nothing under src/ changes for it (mob, 04:47Z: the bot check is nothing the player's
// game can tell).
//
// THE DOOR IS THE GRANT FEED'S (src/net/grantMeasure.js), kept as narrow:
//   - ONE WAY. The relay posts; nothing a player does waits on the answer.
//   - OFF UNTIL ASKED. The relay counts and posts only while its STAFF_NET_FEED_URL (the network bursts and monster
//     counts, to /v1/staff/net-feed) or REACTION_FEED_URL (the bot check's encounters, to /v1/mod/reaction-feed) is set.
//   - SIGNED with the relay's receipt key over "<version>\n" + the body's bytes, in STAFF_FEED_SIG_HEADER; each feed has
//     its own version word, so one feed's batch is never read as the other's. A batch the service has seen (`id`) is not
//     read twice, so the relay may send a failed one again under its own id (design doc, Weak spots: "failed relay
//     batches are resent with the same id").
//
// THE NET BATCH (Server load: "count in the relay's memory ... report only players over a limit, and post every few
// minutes at most"): {"v":"staff-net1","id":<16 hex>,"at":<ms>,"q":<room>,"from":<ms>,"ms":0|1,
//   "net":[{"a":<account>,"n":frames,"b":bytes,"p10","pb10":the busiest 10 s's frames and bytes,"p60","pb60":the busiest
//          minute's,"k":[frames by NET_KINDS],"nr":frames a meter refused,"j":junk frames,"c":sockets closed for "too
//          many ...","w"?:the last close's words}...],
//   "foe":[{"a","o":live monsters outdoors,"h":live monsters it hosts indoors,"r","e","bo","s":`o` as regular, elite,
//          boss and sea,"x":records the relay stripped}...]}
// `ms` 1 while grantStrip is on - the only time the relay reads the foe stream, so the only time monsters are measured
// (design doc, Weak spots: "show 'not measured' while grantStrip is off").
//
// THE REACTION BATCH (Bot check): {"v":"staff-react1","id","at","q",
//   "rows":[{"a":<account>,"k":"enc"|"encr","n":members,"t":<the ask, ms>,"ms":the episode's length,"ps":poses heard,
//            "p1"?,"wd"?,"ac"?,"hk"?,"hu"?,"dd"?: ms from the ask to the first pose, the weapon drawn, the first swing or
//            cast, the first blow landed, the first blow taken, the death; "w0":1 drawn already at the ask,
//            "mv":decimetres moved and "tn":centiradians turned in the first REACT_FIRST_MS}...]}
import { _b64url, SIG_BYTES, ID_RE } from '../../src/net/identityToken.js';
import { GRANT_KINDS } from '../../src/net/grantLaw.js';

export const NET_FEED_V = 'staff-net1';
export const REACT_FEED_V = 'staff-react1';
/** The header a batch's signature rides. */
export const STAFF_FEED_SIG_HEADER = 'x-relay-staff-sig';
/** The most rows a batch holds (its net and foe rows together) - the relay posts at it. */
export const STAFF_FEED_ROWS = 64;
/** The most bytes a batch's body may be: STAFF_FEED_ROWS rows of about 300 bytes, and room. */
export const STAFF_FEED_MAX_BYTES = 32 * 1024;
/** How old a batch may be when it arrives, ms - a resent one is at most a window late; a replayed old one is refused. */
export const STAFF_FEED_AGE_MAX_MS = 30 * 60_000;
/** How long the relay waits on the service's answer, ms. */
export const STAFF_FEED_POST_MS = 8_000;
/** The kinds a frame is counted under (design doc, Network bursts: "movement, actions, hits, trades, monster records,
 *  chat"), and the rest. */
export const NET_KINDS = Object.freeze(['move', 'act', 'hit', 'trade', 'foe', 'chat', 'other']);
/** A net window's length, ms - a room posts once a window at most (Server load: "post every few minutes at most"). The
 *  panel's 10-minute figure is a window's whole. */
export const NET_FEED_MS = 10 * 60_000;
/** OVER A LIMIT (starting numbers to tune, not measured ones): frames or bytes in one 10 s - past what the pose gate (20 a
 *  second) and a busy foes stream let an honest game send - or any frame a meter refused, any junk, any close. */
export const NET_HOT = Object.freeze({ frames10: 400, bytes10: 1_500_000 });
/** OVER A LIMIT, monsters: live ones a sender owns outdoors (a band's 24 and room), or hosts indoors (a dungeon's
 *  layout), or any record the relay stripped. Starting numbers to tune. */
export const FOE_HOT = Object.freeze({ own: 32, host: 96 });
/** The grants that start an episode: a natural encounter, the one the player's own game rolls (grantLaw.js `enc`, and
 *  `encr` while grantRoll is on). */
export const REACT_KINDS = Object.freeze(['enc', 'encr']);
/** An episode is timed this long after its ask at most, ms. */
export const REACT_EPISODE_MS = 60_000;
/** Distance and turn are counted over this first part of it, ms (design doc: "in the first 3 s"). */
export const REACT_FIRST_MS = 3_000;
/** The most any count says. */
export const FEED_COUNT_MAX = 1_000_000_000;
const ID_HEX_RE = /^[0-9a-f]{16}$/;
const ROOM_RE = /^[A-Za-z0-9_.,:+-]{1,80}$/;   // net/wire.js roomOf's own (grantMeasure.js's)
const TIMES = Object.freeze(['p1', 'wd', 'ac', 'hk', 'hu', 'dd']);

const count = (/** @type {any} */ n) => Number.isSafeInteger(n) && n >= 0 && n <= FEED_COUNT_MAX;
const head = (/** @type {any} */ b, /** @type {string} */ v) => !!b && typeof b === 'object' && !Array.isArray(b) && b.v === v && typeof b.id === 'string' && ID_HEX_RE.test(b.id)
  && Number.isSafeInteger(b.at) && b.at > 0 && typeof b.q === 'string' && ROOM_RE.test(b.q);

/** A net row: an account, its counts each in their law - the busiest 10 s within the busiest minute within the window,
 *  the kinds adding up to the frames. Pure. @param {any} r */
export const netRowOk = (r) => !!r && typeof r === 'object' && typeof r.a === 'string' && ID_RE.test(r.a)
  && [r.n, r.b, r.p10, r.pb10, r.p60, r.pb60, r.nr, r.j, r.c].every(count) && r.p10 <= r.p60 && r.p60 <= r.n && r.pb10 <= r.pb60 && r.pb60 <= r.b
  && Array.isArray(r.k) && r.k.length === NET_KINDS.length && r.k.every(count) && r.k.reduce((s, x) => s + x, 0) === r.n
  && (r.w === undefined || (typeof r.w === 'string' && r.w.length <= 40));
/** A foe row: an account, the monsters it streams (the outdoor ones split by kind) and the records stripped. Pure. @param {any} r */
export const foeRowOk = (r) => !!r && typeof r === 'object' && typeof r.a === 'string' && ID_RE.test(r.a)
  && [r.o, r.h, r.r, r.e, r.bo, r.s, r.x].every(count) && r.r + r.e + r.bo + r.s === r.o;

/** Whether a parsed net batch is one: its head, the window's start, the strip switch, and 1 to STAFF_FEED_ROWS rows. Pure. @param {any} b */
export function netBatchValid(b) {
  if (!head(b, NET_FEED_V) || !Number.isSafeInteger(b.from) || b.from <= 0 || b.from > b.at || (b.ms !== 0 && b.ms !== 1)) return false;
  if (!Array.isArray(b.net) || !Array.isArray(b.foe) || !(b.net.length + b.foe.length) || b.net.length + b.foe.length > STAFF_FEED_ROWS) return false;
  return b.net.every(netRowOk) && b.foe.every(foeRowOk);
}

/** Whether an episode is one: an account, a natural encounter's kind and size, its ask before the batch, its times within
 *  the episode and in order of the clock (none past its length). Pure. @param {any} r @param {number} at */
export const reactRowOk = (r, at) => !!r && typeof r === 'object' && typeof r.a === 'string' && ID_RE.test(r.a) && REACT_KINDS.includes(r.k)
  && Number.isSafeInteger(r.n) && r.n >= 1 && r.n <= GRANT_KINDS[/** @type {'enc'|'encr'} */ (r.k)].max
  && Number.isSafeInteger(r.t) && r.t > 0 && r.t <= at && Number.isSafeInteger(r.ms) && r.ms >= 0 && r.ms <= REACT_EPISODE_MS
  && TIMES.every((k) => r[k] === undefined || (Number.isSafeInteger(r[k]) && r[k] >= 0 && r[k] <= r.ms))
  && (r.w0 === 0 || r.w0 === 1) && count(r.ps) && count(r.mv) && count(r.tn);

/** Whether a parsed reaction batch is one: its head and 1 to STAFF_FEED_ROWS episodes. Pure. @param {any} b */
export function reactBatchValid(b) {
  return head(b, REACT_FEED_V) && Array.isArray(b.rows) && b.rows.length >= 1 && b.rows.length <= STAFF_FEED_ROWS && b.rows.every((r) => reactRowOk(r, b.at));
}

const enc = new TextEncoder();
/** The bytes a batch's signature signs: its feed's word, then the body. @param {string} v @param {Uint8Array} body */
const signedBytes = (v, body) => {
  const word = enc.encode(`${v}\n`);
  const out = new Uint8Array(word.length + body.length);
  out.set(word, 0);
  out.set(body, word.length);
  return out;
};

/**
 * THE RELAY'S HALF: a batch's body and its signature, or null with no key, or a batch its law refuses, or one too big.
 * @param {any} batch @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function sealStaffFeed(batch, privateKey, { subtle }) {
  const valid = batch?.v === NET_FEED_V ? netBatchValid : reactBatchValid;
  if (!privateKey || !valid(batch)) return null;
  const body = enc.encode(JSON.stringify(batch));
  if (body.length > STAFF_FEED_MAX_BYTES) return null;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, signedBytes(batch.v, body)));
  return { body, sig: _b64url.encode(sig) };
}

/**
 * THE SERVICE'S HALF: the batch of feed `v`, when its signature holds and it is one, young enough - or `{ error }`
 * (feed-closed: no relay key; feed-shape; feed-signature; feed-stale). Never throws.
 * @param {string} v @param {Uint8Array} body @param {unknown} sig64 @param {CryptoKey|null} publicKey @param {{ subtle: SubtleCrypto, nowMs: number }} env
 */
export async function openStaffFeed(v, body, sig64, publicKey, { subtle, nowMs }) {
  if (!publicKey) return { error: 'feed-closed' };
  if (!(body instanceof Uint8Array) || !body.length || body.length > STAFF_FEED_MAX_BYTES) return { error: 'feed-shape' };
  const sig = typeof sig64 === 'string' ? _b64url.decode(sig64) : null;
  if (!sig || sig.length !== SIG_BYTES) return { error: 'feed-signature' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, signedBytes(v, body)); } catch { good = false; }
  if (!good) return { error: 'feed-signature' };
  let batch;
  try { batch = JSON.parse(new TextDecoder().decode(body)); } catch { return { error: 'feed-shape' }; }
  if (!(v === NET_FEED_V ? netBatchValid : reactBatchValid)(batch)) return { error: 'feed-shape' };
  if (Math.abs(nowMs - batch.at) > STAFF_FEED_AGE_MAX_MS) return { error: 'feed-stale' };
  return { ok: true, batch };
}
