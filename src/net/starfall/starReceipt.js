// @ts-check
// STAR1 (2026-10-20): A STAR'S RECEIPT - the relay's signature on a fallen star held, the raid's and the serpent's twin
// (net/raid/raidReceipt.js, net/serpent/serpentReceipt.js). Design: bible/11-Multiplayer/Starfall.md section 6.
//
//     j1.<base64url({ sf, s, c, l, i, e })>.<base64url(64-byte Ed25519 signature)>
//         sf [the night, the star] (net/starfall/starfallLaw.js starTimes)   s the account (the identity sub)
//         c the spoils' seed (32 bits, the relay's CSPRNG)   l the level its last word said at the star
//         i issued, epoch seconds   e expires (i + STAR_RECEIPT_TTL_S)
//
// ONE KEY, MANY THINGS, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill, a
// raid's cleanse and a serpent's kill, and the version is INSIDE the signed bytes: `j1` is refused by every other
// verifier before a byte of its body is read, and theirs by this one. The claim shapes are disjoint besides: only this
// one carries `sf`, and it admits its six fields and no other - so every field another shape is known by (an identity's
// `n`, `k` and `t`, an order's `o`, a gate's and a serpent's `d`, a raid's `w` and `y`, a serpent's `b` and `h`, a gate's
// `r` and `x`) is refused outright.
//
// UNSIGNED IS A REAL ANSWER, as theirs is: a relay with no key still keeps the star - the receipt goes out `j1.<body>.`,
// the client rolls its spoils off the seed, and the account service declines it.
//
// PURE, and all three ends import it. Not a DFU member. Ledger A (STARFALL).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';
import { starOk, STAR_LEVEL_MAX } from './starfallLaw.js';

/** The only version this file reads or writes. */
export const STAR_RECEIPT_V = 'j1';
/** How long a receipt may be carried to the account service: a week, the gate's own. */
export const STAR_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const STAR_RECEIPT_MAX = 400;
/** A star receipt's claims, and no other field. */
export const STAR_RECEIPT_FIELDS = Object.freeze(['sf', 's', 'c', 'l', 'i', 'e']);

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed star receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function starReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const f of Object.keys(c)) if (!STAR_RECEIPT_FIELDS.includes(f)) return false;
  if (!Array.isArray(c.sf) || c.sf.length !== 2 || !starOk(c.sf[0], c.sf[1])) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!Number.isSafeInteger(c.l) || c.l < 1 || c.l > STAR_LEVEL_MAX) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > STAR_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`j1.<body>.`) - the seed still rides it.
 * @param {{n: number, k: number, s: string, c: number, l: number}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gate/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintStarReceipt({ n, k, s, c, l }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintStarReceipt needs an integer epoch-seconds clock');
  const claims = { sf: [n, k], s, c, l, i: nowS, e: nowS + STAR_RECEIPT_TTL_S };
  if (!starReceiptValid(claims)) throw new TypeError('mintStarReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${STAR_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${STAR_RECEIPT_V}.${body}`)));
  return `${STAR_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed star receipt. `n`/`k` lifted out of `sf` for the reader.
 * @param {unknown} r
 */
export function readStarReceipt(r) {
  if (typeof r !== 'string' || r.length > STAR_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== STAR_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return starReceiptValid(c) ? { ...c, night: c.sf[0], star: c.sf[1], signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a
 * repair: the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyStarReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > STAR_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== STAR_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!starReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
