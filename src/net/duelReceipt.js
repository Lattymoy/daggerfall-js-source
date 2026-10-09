// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT8 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A DUEL'S RESULT, SIGNED BY THE RELAY THAT REFEREED IT.
//
//     d1.<base64url({ f, w, n, i, e })>.<base64url(64-byte Ed25519 signature)>
//         f the two duellists' accounts [the challenger's, the challenged's]   w the winner's place in `f` (0 or 1)
//         n the bout's id (the relay's own: twelve hex)   i issued   e expires (i + DUEL_RECEIPT_TTL_S)
//
// DUEL1's record was the loser's own word: its client posted its loss naming the winner. A client that never lost never
// said so, and one that lied about a fall it never took gave away a win. Now the relay holds both fighters' vitality,
// judges every blow (net/duelRef.js) and, when a bout ends with a winner, hands both fighters this receipt - the
// relay's use of its one key again (the gate's `r1`, a siege's `s1`, a Royal Tourney's `t1`): the version is inside the
// signed bytes, so no other shape is read as one, and the other shapes' own fields are refused here outright. Either
// duellist carries it to the account service, which counts it ONCE (its bout id), the same two at most
// DUEL_PAIR_DAY_MAX a day. A draw names no winner and mints nothing.
//
// PURE, and all three ends import it.
// ═════════════════════════════════════════════════════════════════════
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';

/** The duel receipt's version. */
export const DUEL_RECEIPT_V = 'd1';
/** How long a receipt is carried before it is too old to count: a day - its two duellists are online at its end. */
export const DUEL_RECEIPT_TTL_S = 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const DUEL_RECEIPT_MAX = 400;
/** A bout's id: the relay's, twelve hex. */
export const DUEL_BOUT_RE = /^[0-9a-f]{12}$/;

const enc = new TextEncoder();
const dec = new TextDecoder();
/** Every other receipt's own fields (a gate's, a siege's, a Royal Tourney's, an arena's): never in a duel's. */
const DUEL_FOREIGN = ['s', 'l', 'sk', 'sw', 'sd', 'r', 'a', 'h', 'th', 'k', 't', 'o', 'd', 'b', 'x', 'y', 'c', 'j', 'q', 'u', 'z'];

/** Everything a well-formed duel receipt's claims must be, before any signature is considered. */
export function duelReceiptValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (DUEL_FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (!Array.isArray(c.f) || c.f.length !== 2 || !c.f.every((x) => typeof x === 'string' && ID_RE.test(x)) || c.f[0] === c.f[1]) return false;
  if (c.w !== 0 && c.w !== 1) return false;
  if (typeof c.n !== 'string' || !DUEL_BOUT_RE.test(c.n)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > DUEL_RECEIPT_TTL_S) return false;
  return true;
}
/** MINT - the relay's half; unsigned (`d1.<body>.`) with no key, which the service declines. */
export async function mintDuelReceipt(/** @type {{ f: string[], w: 0|1, n: string }} */ { f, w, n }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintDuelReceipt needs an integer epoch-seconds clock');
  const claims = { f, w, n, i: nowS, e: nowS + DUEL_RECEIPT_TTL_S };
  if (!duelReceiptValid(claims)) throw new TypeError('mintDuelReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${DUEL_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${DUEL_RECEIPT_V}.${body}`)));
  return `${DUEL_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}
/** READ - the client's half: the claims, signed or not, never a verdict; null for anything else. */
export function readDuelReceipt(/** @type {unknown} */ r) {
  if (typeof r !== 'string' || r.length > DUEL_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== DUEL_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return duelReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}
/** VERIFY - the account service's half, the other receipts' rungs: `{ ok: true, claims }` or `{ ok: false, why }`. */
export async function verifyDuelReceipt(/** @type {unknown} */ r, /** @type {CryptoKey} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > DUEL_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== DUEL_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!duelReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
