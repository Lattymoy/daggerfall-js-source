// @ts-check
// GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md sections 7 and 12): THE GRANTS'
// MEASURE - what each cell's asks were, carried from the relay to the account service, which `node tools/realmReview.mjs
// grants` reads (GRANT5: seven days, then the buckets and the ceiling are set from it).
//
// A cell room folds every ask it answers (foldGrantAsk): per account and kind, the asks, the members asked for, and what
// the gate would have refused - the account's bucket, the cell's ceiling - and the most granted hostile members the cell
// held live at once. Every GRANT_MEASURE_MS, or once GRANT_MEASURE_ROWS accounts and kinds wait, it posts the batch.
// THE DOOR IS THE CHAT FEED'S (net/safety/chatFeed.js), kept as narrow:
//   - ONE WAY. The relay posts; nothing the relay does waits on the answer. A post that fails is dropped: a measure is a
//     sample, and a cell that sleeps before its post loses its window.
//   - OFF UNTIL ASKED. The relay posts only while its GRANT_FEED_URL is set (server/wrangler.toml).
//   - SIGNED with the relay's receipt key over "grant-measure1\n" + the body's bytes, in GRANT_MEASURE_SIG_HEADER; the
//     service checks it with the public half, and a batch it has seen (`id`) is not read twice.
//
// THE BATCH: {"v":"grant-measure1","id":<16 hex>,"at":<ms>,"q":<room>,"from":<ms>,"live":<n>,
//             "rows":[{"a":<account>,"k":<kind>,"asks","members","bucket","ceiling"}...],
//             "tl":[{"a":<reader's account>,"b":<sender's account>,"r":<reason>,"n"}...]}
// GRANT3 (section 13): `tl`, the readers' tallies - what each reader's game refused of a sender's foes, by reason, as the
// cell heard them (net/grantLaw.js GRANT_READER_REFUSALS); GRANT7's evidence once readers on several accounts agree.
//
// PURE; the relay (server/src/index.js) and the service (server-account/src/grants.js) import it. Not a DFU member.
import { _b64url, SIG_BYTES, ID_RE } from './identityToken.js';
import { GRANT_KINDS, GRANT_READER_REFUSALS } from './grantLaw.js';

/** The only version this file writes or reads - a word of its own, never a receipt's or the chat feed's. */
export const GRANT_MEASURE_V = 'grant-measure1';
/** The header the batch's signature rides. */
export const GRANT_MEASURE_SIG_HEADER = 'x-relay-grant-sig';
/** A cell posts its window this often, ms... */
export const GRANT_MEASURE_MS = 10 * 60 * 1000;
/** ...or once this many accounts and kinds wait (the batch's whole bound: the relay posts at it). */
export const GRANT_MEASURE_ROWS = 128;
/** The most bytes a batch's body may be: GRANT_MEASURE_ROWS rows of about 120 bytes, and room. */
export const GRANT_MEASURE_MAX_BYTES = 24 * 1024;
/** How old a batch may be when it arrives, ms - a replayed old one is refused. */
export const GRANT_MEASURE_AGE_MAX_MS = 10 * 60_000;
/** The most any count says. */
export const GRANT_MEASURE_COUNT_MAX = 1_000_000;
/** How long the relay waits on the service's answer, ms. */
export const GRANT_MEASURE_POST_MS = 8_000;
const ID_HEX_RE = /^[0-9a-f]{16}$/;
const ROOM_RE = /^[A-Za-z0-9_.,:+-]{1,80}$/;   // net/wire.js roomOf's own

/** @typedef {{ a: string, k: string, asks: number, members: number, bucket: number, ceiling: number }} GrantMeasureRow */
/** @typedef {{ a: string, b: string, r: string, n: number, e?: { t: number, k: number, mx: number } }} GrantTallyRow */
/** FOE-BOUNDS (bible/11-Multiplayer/Spawn-Grants.md section 19): THE RELAY AS A READER - the tally of what the relay
 *  itself stripped (GRANT9's switch on: a record no builder could give, server/src/index.js _grantStripped), in the batch
 *  the relay signs. Never an account's id (net/identityToken.js ID_RE refuses its `~`), so no reader's tally is its; the
 *  service opens a case on it alone (server-account/src/grants.js) - the relay saw the sender's own frame. */
export const GRANT_RELAY_READER = '~relay';
/** @typedef {{ from: number, live: number, rows: Map<string, GrantMeasureRow>, tallies: Map<string, GrantTallyRow> }} GrantMeasure */

/** A cell's window, begun at `nowMs`. Pure. @param {number} nowMs @returns {GrantMeasure} */
export const newGrantMeasure = (nowMs) => ({ from: nowMs, live: 0, rows: new Map(), tallies: new Map() });
/** Whether a window holds its whole bound - its asks' rows and its tallies together. */
const full = (w) => w.rows.size + w.tallies.size >= GRANT_MEASURE_ROWS;

const capped = (n) => Math.min(GRANT_MEASURE_COUNT_MAX, n);
/**
 * ONE ASK FOLDED IN: account `a`'s ask for `n` members of kind `k`, the gate's `refusal` (null, or what it would have
 * refused), the cell then holding `live` granted hostile members (the grant's own counted when it was minted). Answers
 * whether the window is full (GRANT_MEASURE_ROWS rows wait). In place.
 * @param {GrantMeasure} w @param {string} a @param {string} k @param {number} n @param {string|null} refusal @param {number} live
 */
export function foldGrantAsk(w, a, k, n, refusal, live) {
  const key = `${a}|${k}`;
  let row = w.rows.get(key);
  if (!row) { row = { a, k, asks: 0, members: 0, bucket: 0, ceiling: 0 }; w.rows.set(key, row); }
  row.asks = capped(row.asks + 1);
  row.members = capped(row.members + n);
  if (refusal === 'bucket') row.bucket = capped(row.bucket + 1);
  if (refusal === 'ceiling') row.ceiling = capped(row.ceiling + 1);
  w.live = Math.max(w.live, capped(live));
  return full(w);
}
/**
 * GRANT3: ONE READER'S TALLY ROW FOLDED IN - reader `a`'s game refused `n` of sender `b`'s foes for reason `r`. Answers
 * whether the window is full. In place. FOE-BOUNDS: `e` the relay's evidence (`{ t, k, mx }`: a type, what it claimed,
 * its bound) - the row keeps the worst it was handed.
 * @param {GrantMeasure} w @param {string} a @param {string} b @param {string} r @param {number} n @param {{ t: number, k: number, mx: number }|null} [e]
 */
export function foldGrantTally(w, a, b, r, n, e = null) {
  const key = `${a}|${b}|${r}`;
  const row = w.tallies.get(key);
  if (row) row.n = capped(row.n + n);
  else w.tallies.set(key, { a, b, r, n: capped(n) });
  const kept = w.tallies.get(key);
  if (e && (!kept.e || e.k - e.mx > kept.e.k - kept.e.mx)) kept.e = { t: e.t, k: e.k, mx: e.mx };
  return full(w);
}

const count = (n) => Number.isSafeInteger(n) && n >= 0 && n <= GRANT_MEASURE_COUNT_MAX;
/** FOE-BOUNDS: a tally's evidence - none, or a type, a claim and a bound, each a number in its law. */
const evidenceOk = (e) => e === undefined || (!!e && typeof e === 'object' && Number.isInteger(e.t) && e.t >= 0 && e.t <= 255 && Number.isFinite(e.k) && e.k >= 0 && e.k <= GRANT_MEASURE_COUNT_MAX && Number.isFinite(e.mx) && e.mx >= 0 && e.mx <= GRANT_MEASURE_COUNT_MAX * 1000);
/** Whether a parsed batch is one: its version, a 16-hex id, its clocks, its room, and 1 to GRANT_MEASURE_ROWS rows and
 *  tallies together - each row an account, a kind, and counts in their law (the members within the asks' most); each
 *  tally a reader's account, another's, a reader's reason and a count. Pure. @param {any} b */
export function grantMeasureValid(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.v !== GRANT_MEASURE_V) return false;
  if (typeof b.id !== 'string' || !ID_HEX_RE.test(b.id) || !Number.isSafeInteger(b.at) || b.at <= 0) return false;
  if (!Number.isSafeInteger(b.from) || b.from <= 0 || b.from > b.at || typeof b.q !== 'string' || !ROOM_RE.test(b.q) || !count(b.live)) return false;
  if (!Array.isArray(b.rows) || !Array.isArray(b.tl) || !(b.rows.length + b.tl.length) || b.rows.length + b.tl.length > GRANT_MEASURE_ROWS) return false;
  const tallyOk = b.tl.every((t) => t && typeof t === 'object' && typeof t.a === 'string' && (ID_RE.test(t.a) || t.a === GRANT_RELAY_READER) && typeof t.b === 'string' && ID_RE.test(t.b)
    && t.a !== t.b && GRANT_READER_REFUSALS.includes(t.r) && count(t.n) && t.n >= 1 && evidenceOk(t.e));
  return tallyOk && b.rows.every((r) => r && typeof r === 'object' && typeof r.a === 'string' && ID_RE.test(r.a)
    && typeof r.k === 'string' && Object.hasOwn(GRANT_KINDS, r.k)
    && count(r.asks) && r.asks >= 1 && count(r.members) && r.members <= r.asks * GRANT_KINDS[/** @type {keyof typeof GRANT_KINDS} */ (r.k)].max
    && count(r.bucket) && count(r.ceiling) && r.bucket + r.ceiling <= r.asks);
}

/** A window's batch for room `q`, posted at `nowMs`: null when nothing was asked or tallied. Pure.
 *  @param {GrantMeasure} w @param {string} id @param {string} q @param {number} nowMs */
export function grantMeasureBatch(w, id, q, nowMs) {
  if (!w.rows.size && !w.tallies.size) return null;
  return { v: GRANT_MEASURE_V, id, at: nowMs, q, from: w.from, live: w.live, rows: [...w.rows.values()].map((r) => ({ ...r })), tl: [...w.tallies.values()].map((t) => ({ ...t })) };
}

const enc = new TextEncoder();
/** The bytes a batch's signature signs. @param {Uint8Array} body */
const signedBytes = (body) => {
  const head = enc.encode(`${GRANT_MEASURE_V}\n`);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
};

/**
 * THE RELAY'S HALF: a batch's body and its signature, or null with no key or no batch.
 * @param {any} batch @param {CryptoKey|null} privateKey @param {{ subtle: SubtleCrypto }} env
 */
export async function sealGrantMeasure(batch, privateKey, { subtle }) {
  if (!privateKey || !grantMeasureValid(batch)) return null;
  const body = enc.encode(JSON.stringify(batch));
  if (body.length > GRANT_MEASURE_MAX_BYTES) return null;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, signedBytes(body)));
  return { body, sig: _b64url.encode(sig) };
}

/**
 * THE SERVICE'S HALF: the batch, when its signature holds and it is a batch, young enough - or `{ error }`. Never throws.
 * @param {Uint8Array} body @param {unknown} sig64 @param {CryptoKey|null} publicKey @param {{ subtle: SubtleCrypto, nowMs: number }} env
 */
export async function openGrantMeasure(body, sig64, publicKey, { subtle, nowMs }) {
  if (!publicKey) return { error: 'grant-closed' };
  if (!(body instanceof Uint8Array) || !body.length || body.length > GRANT_MEASURE_MAX_BYTES) return { error: 'grant-shape' };
  const sig = typeof sig64 === 'string' ? _b64url.decode(sig64) : null;
  if (!sig || sig.length !== SIG_BYTES) return { error: 'grant-signature' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, signedBytes(body)); } catch { good = false; }
  if (!good) return { error: 'grant-signature' };
  let batch;
  try { batch = JSON.parse(new TextDecoder().decode(body)); } catch { return { error: 'grant-shape' }; }
  if (!grantMeasureValid(batch)) return { error: 'grant-shape' };
  if (Math.abs(nowMs - batch.at) > GRANT_MEASURE_AGE_MAX_MS) return { error: 'grant-stale' };
  return { ok: true, batch };
}
