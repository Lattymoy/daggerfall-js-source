// @ts-check
// WB3 (2026-09-25, Mac, Option B: "the relay's Durable Object tracks boss HP from hit frames, stamps the kill, issues a
// signed kill record the account service honours"): THE KILL RECEIPT - the relay's first signature. Design:
// bible/11-Multiplayer/World-Bosses.md section 6.
//
// Today the relay holds no secret at all (ACC1: it verifies, the account service signs). A kill the account service
// will honour has to be signed by the one party that SAW it, so the relay gets ONE key, and it can sign ONE thing:
//
//     r1.<base64url({ d, b, s, c, x, i, e })>.<base64url(64-byte Ed25519 signature)>
//         d the gate's day   b the boss's id   s the account (the identity token's sub)
//         c the loot seed (32 bits, the relay's CSPRNG)   x how it was earned ('dealt' | 'stood')
//         i issued, epoch seconds   e expires (i + RECEIPT_TTL_S)
//
// identityToken.js's ladder, mirrored and not shared: the version is the algorithm and is read first; signature
// first, content second; refuse, never repair. A RECEIPT CAN NEVER PASS AS AN IDENTITY OR AN ORDER, NOR THEY AS IT -
// its prefix is `r1`, which the identity verifier refuses before a byte is parsed (its `v1` is read first), the claim
// shapes are disjoint (a receipt carries no `n`, `k` or `o`; an identity no `d`, `b` or `c`), and it is signed by a
// different key: the relay's GATE_SIGNING_KEY, which the account service knows only by its public half.
//
// UNSIGNED IS A REAL ANSWER. A relay with no key still runs the fight and the spoils - the receipt goes out as
// `r1.<body>.` (the signature empty), the client reads its seed and rolls its loot the same, and the account service
// declines it: the RECORD is the only thing a missing key costs. `readReceipt` (the client's) reads either; only
// `verifyReceipt` (the account service's, WB5) says a receipt is honoured.
//
// PURE, and all three ends import it (the relay mints, the client reads, the account service verifies). `subtle` and
// the keys are arguments; no clock and no global of its own but base64.
//
// Not a DFU member. Ledger A (WB).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';

/** The only version this file reads or writes. It names the algorithm, so the payload cannot. */
export const RECEIPT_V = 'r1';
/** How long a receipt may be carried to the account service: a week (a player who logs off at the kill claims it on
 *  their next session). */
export const RECEIPT_TTL_S = 7 * 24 * 3600;
/** How a receipt was earned (bible section 6). */
export const RECEIPT_EARNED = Object.freeze(['dealt', 'stood']);
/** The bound on a receipt's length on the wire - a claim set is ~150 bytes, a signature 86. */
export const RECEIPT_MAX = 512;
/** A boss's id: the table's own shape (net/gateLaw.js GATE_BOSSES). */
const BOSS_ID_RE = /^[a-z]{1,16}$/;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed receipt's claims must be, before any signature is considered. An identity's fields (`n`,
 * `k`) and an order's (`o`) are refused outright - the shapes stay disjoint whatever key signed them.
 * @param {any} c
 */
export function receiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (c.n !== undefined || c.k !== undefined || c.o !== undefined) return false;
  if (!Number.isSafeInteger(c.d) || c.d < 0) return false;
  if (typeof c.b !== 'string' || !BOSS_ID_RE.test(c.b)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!RECEIPT_EARNED.includes(c.x)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > RECEIPT_TTL_S) return false;
  return true;
}

/** The claims in the order the minter writes them - one byte string for one receipt. */
const claimsOf = ({ d, b, s, c, x }, nowS) => ({ d, b, s, c, x, i: nowS, e: nowS + RECEIPT_TTL_S });

/**
 * MINT. The relay's half. With no key the receipt goes out unsigned (`r1.<body>.`) - the seed still rides it.
 * @param {{d: number, b: string, s: string, c: number, x: string}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key, or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintReceipt(what, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintReceipt needs an integer epoch-seconds clock');
  const claims = claimsOf(what, nowS);
  if (!receiptValid(claims)) throw new TypeError('mintReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${RECEIPT_V}.${body}`)));
  return `${RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/** Split a receipt into its three parts, or null - the shape both readers ask first. */
function partsOf(r) {
  if (typeof r !== 'string' || r.length > RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== RECEIPT_V) return null;
  return parts;
}

/**
 * READ, the client's half: the claims of a receipt the relay handed this socket, signed or not - the seed of the
 * spoils and what it says, never a verdict on it. Null for anything that is not a well-formed receipt.
 * @param {unknown} r
 */
export function readReceipt(r) {
  const parts = partsOf(r);
  if (!parts) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return receiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY, the account service's half (WB5). Answers `{ ok: true, claims }` or `{ ok: false, why }`, never throws and
 * never repairs - identityToken.js's verifier, rung for rung.
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!receiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}

/**
 * The relay's signing key from its secret (GATE_SIGNING_KEY, PKCS8 base64 - server-account/src/signing.js's shape):
 * sign only, non-extractable. Null - never a throw - for none or a bad one: a relay with no key still runs the fight.
 * @param {unknown} b64 @param {{subtle: SubtleCrypto}} env
 */
export async function importReceiptKey(b64, { subtle }) {
  if (typeof b64 !== 'string' || !b64) return null;
  const bytes = _b64url.decode(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  if (!bytes) return null;
  try { return await subtle.importKey('pkcs8', bytes, { name: 'Ed25519' }, false, ['sign']); } catch { return null; }
}
