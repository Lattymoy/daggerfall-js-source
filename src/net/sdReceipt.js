// @ts-check
// SD9a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE HOUR'S RECEIPT - the
// relay's signature on the Brass Remnant's fall, the gate's and the serpent's twin (net/gateReceipt.js,
// net/serpentReceipt.js).
//
//     h1.<base64url({ d, b, s, c, x, l, i, e })>.<base64url(64-byte Ed25519 signature)>
//         d the Hollow's slot (net/sdLaw.js - the record's `s`)   b the boss ('remnant')   s the account (the identity sub)
//         c the spoils' seed (32 bits, the relay's CSPRNG)   x how it was earned ('dealt' | 'stood' - net/gateBrain.js earnedBy)
//         l the level the fight admitted it at   i issued, epoch seconds   e expires (i + SD_RECEIPT_TTL_S)
//         m the relay's count of the account's body through the fight (INT14 - net/bossBody.js bodyMeasure; optional)
//
// ONE KEY, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill, a raid's
// cleanse and a serpent's, and the version is INSIDE the signed bytes: `h1` is refused by every other verifier and theirs
// by this one before a byte of either body is parsed. The claim shapes are disjoint besides: its boss is the Remnant alone
// (no gate's or serpent's boss reads as one), and it carries none of the others' own fields - a serpent's hull `h`, a
// gate's rite `r`, a raid's `w` or `y`, an identity's `n`, `k` or `t`, an order's `o`.
//
// UNSIGNED IS A REAL ANSWER, as theirs is: a relay with no key still keeps the fight - the receipt goes out `h1.<body>.`,
// the client rolls its spoils off the seed, and the account service declines it.
//
// PURE, and all three ends import it. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';
import { bodyMeasureValid } from './bossBody.js';   // INT14: the count's measure, carried

/** The only version this file reads or writes. */
export const SD_RECEIPT_V = 'h1';
/** How long a receipt may be carried to the account service: a week, the gate's own. */
export const SD_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const SD_RECEIPT_MAX = 512;
/** How a receipt was earned (net/gateBrain.js earnedBy - no rite here). */
export const SD_EARNED = Object.freeze(['dealt', 'stood']);
/** The Hour's one boss. */
export const SD_RECEIPT_BOSS = 'remnant';
/** A slot's bound (net/wire.js SD_SLOT_MAX's - pinned equal), a level's. */
export const SD_RECEIPT_SLOT_MAX = 999_999_999;
export const SD_RECEIPT_LV_MAX = 999;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed Hour receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function sdReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (c.n !== undefined || c.k !== undefined || c.t !== undefined || c.o !== undefined || c.w !== undefined || c.y !== undefined || c.r !== undefined || c.h !== undefined) return false;
  if (!Number.isSafeInteger(c.d) || c.d < 1 || c.d > SD_RECEIPT_SLOT_MAX) return false;
  if (c.b !== SD_RECEIPT_BOSS) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!SD_EARNED.includes(c.x)) return false;
  if (!Number.isSafeInteger(c.l) || c.l < 1 || c.l > SD_RECEIPT_LV_MAX) return false;
  if (c.m !== undefined && !bodyMeasureValid(c.m)) return false;   // INT14: optional - a receipt minted before it carries none
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > SD_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`h1.<body>.`) - the seed still rides it.
 * @param {{d: number, s: string, c: number, x: string, l: number, m?: number[]}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintSdReceipt({ d, s, c, x, l, m }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintSdReceipt needs an integer epoch-seconds clock');
  const claims = { d, b: SD_RECEIPT_BOSS, s, c, x, l, ...(m !== undefined ? { m } : {}), i: nowS, e: nowS + SD_RECEIPT_TTL_S };
  if (!sdReceiptValid(claims)) throw new TypeError('mintSdReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${SD_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${SD_RECEIPT_V}.${body}`)));
  return `${SD_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed Hour receipt.
 * @param {unknown} r
 */
export function readSdReceipt(r) {
  if (typeof r !== 'string' || r.length > SD_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== SD_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return sdReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a
 * repair: the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifySdReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > SD_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== SD_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!sdReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
