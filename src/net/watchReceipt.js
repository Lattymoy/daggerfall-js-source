// @ts-check
// SEAT1b (2026-09-30, Mac: "Finish the seats"): THE WATCH'S RECEIPT - the relay's third signature, the gate's and the
// raid's receipts' twin (net/gate/gateReceipt.js, net/raid/raidReceipt.js). Design: bible/11-Multiplayer/Seats-Arc.md 4.2, "The
// Watch": "Relay-witnessed socket; the position is the client's own claim, so it is bounded ... 1 per 2 minutes,
// capped 60 an account a day".
//
//     k1.<base64url({ s, x, y, c, i, e })>.<base64url(64-byte Ed25519 signature)>
//         s the account (the identity token's sub)   x, y the map pixel its pose stood in
//         c a nonce (32 bits, the relay's CSPRNG) - one receipt, one tick, never counted twice
//         i issued, epoch seconds   e expires (i + WATCH_RECEIPT_TTL_S)
//
// ONE KEY, THREE THINGS, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill
// and a raid's cleanse; the version is INSIDE the signed bytes, so `k1` is refused by the gate's verifier (`r1`) and
// the raid's (`w1`), and theirs by this one, before a byte of either body is parsed - and an identity's `v1` by all.
// The claim shapes are disjoint besides: a watch names a pixel `x` and `y` and never a gate's `d` and `b` or a raid's
// `w` (refused here outright, as an identity's `n`, `k` and `t` and an order's `o` are); a raid's own `y` rides beside
// its `w`, which this refuses, and a watch carries no `w`, which the raid's verifier requires.
//
// A TICK IS WHAT THE RELAY SAW: a socket in a town's cell room, its pose in pixel (x, y), having moved in the last
// WATCH_MOVED_MS, WATCH_TICK_MS after its last tick (watchDue, below). The pixel is still the client's own claim - a pose
// is - which is why the account service bounds what the ticks are worth (WATCH_DAY_CAP an account a day), and a tick
// counts only in a seat's own pixel for a guild pledged to that seat (townSeatLaw.js WATCH_DAY_CAP).
//
// UNSIGNED IS A REAL ANSWER, as the others': a relay with no key still ticks - the receipt goes out `k1.<body>.` and the
// account service declines it. PURE, and all three ends import it.
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';

/** The only version this file reads or writes. */
export const WATCH_RECEIPT_V = 'k1';
/** How long a watch receipt may be carried to the account service: two days - it counts only in its own week anyway. */
export const WATCH_RECEIPT_TTL_S = 2 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const WATCH_RECEIPT_MAX = 400;
/** THE WATCH'S RHYTHM (Seats-Arc 4.2, Appendix B: "per 2 minutes ... movement window 5 minutes"): a tick each
 *  WATCH_TICK_MS while the account moved in the last WATCH_MOVED_MS. Here, beside the receipt, so the relay's bundle
 *  holds this and none of the rest of the seats' law (net/townSeatLaw.js re-exports them). */
export const WATCH_TICK_MS = 120_000;
export const WATCH_MOVED_MS = 300_000;
/**
 * WHETHER THE RELAY TICKS THE WATCH NOW: an account that moved in the last WATCH_MOVED_MS, its last tick WATCH_TICK_MS
 * ago or more. `w` the relay's own note on it - `{ at, moved }`, ms (-Infinity for never).
 * @param {{ at: number, moved: number }} w
 * @param {number} now
 */
export const watchDue = (w, now) => now - w.moved <= WATCH_MOVED_MS && now - w.at >= WATCH_TICK_MS;
/** THE WATCH'S GROUND (AUDIT ETHER-OW C2-1): the map pixels a receipt can name - the Bay's map, where the relay mints
 *  them (server/src/index.js `_watchTick`) and the account service takes them (watchReceiptValid). One home: a
 *  Motherlode's site must be a pixel a Watch can vouch for (net/motherlodeLaw.js motherlodeSites), or nobody can strike
 *  it - ETHER-NODES' isles were witnessed and confirmed past the Veil, where no receipt is ever minted. */
export const watchPixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && x < 1000 && y >= 0 && y < 500;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed watch receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function watchReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (c.n !== undefined || c.k !== undefined || c.t !== undefined || c.o !== undefined || c.d !== undefined || c.b !== undefined || c.w !== undefined) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!watchPixelOk(c.x, c.y)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > WATCH_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`k1.<body>.`).
 * @param {{s: string, x: number, y: number, c: number}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gate/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintWatchReceipt({ s, x, y, c }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintWatchReceipt needs an integer epoch-seconds clock');
  const claims = { s, x, y, c, i: nowS, e: nowS + WATCH_RECEIPT_TTL_S };
  if (!watchReceiptValid(claims)) throw new TypeError('mintWatchReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${WATCH_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${WATCH_RECEIPT_V}.${body}`)));
  return `${WATCH_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed watch receipt.
 * @param {unknown} r
 */
export function readWatchReceipt(r) {
  if (typeof r !== 'string' || r.length > WATCH_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== WATCH_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return watchReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair:
 * the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyWatchReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > WATCH_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== WATCH_RECEIPT_V) return { ok: false, why: 'version' };
  if (!sig64) return { ok: false, why: 'unsigned' };
  const sig = _b64url.decode(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(body);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${v}.${body}`)); } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try { claims = JSON.parse(dec.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  if (!watchReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
