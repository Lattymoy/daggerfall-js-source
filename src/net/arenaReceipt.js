// @ts-check
// ARENA4 (2026-10-02, Mac: "Being a top rank PvE fighter comes with it's own title. Being the #1 pvp arena player comes
// with it's own temporary title/glyph"): A BOUT'S RECEIPT - the relay's third signature, the gate's and the raid's twin
// (net/gateReceipt.js, net/raidReceipt.js). Design: bible/11-Multiplayer/Arena.md "7. Online" - "PvE ladder results and
// PvP results that award a title are refereed by the relay ... and signs the result".
//
//     a1.<base64url(claims)>.<base64url(64-byte Ed25519 signature)>
//       a ladder bout:   { a: 'l', j, s, q, u, r, h, i, e }
//       a players' bout: { a: 'p', j, f: [subA, subB], r, h, i, e }
//         a the kind ('l' the ladder, 'p' players)   j the bout's id (16 hex - one bout, one result)
//         s the account (the identity token's sub)   q the tier (0..9)   u the bout (0..2, 3 the champion)
//         f the two accounts, side 0 first          r the result - a ladder bout 1 won / 0 lost; players' 0 side 0 won,
//                                                     1 side 1 won, 2 a draw
//         h how it ended (net/arenaLaw.js ARENA_HOW)  i issued, epoch seconds   e expires (i + ARENA_RECEIPT_TTL_S)
//
// ONE KEY, THREE THINGS, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill
// and a raid's cleanse, and the version is INSIDE the signed bytes: `a1` is refused by the gate's verifier (its `r1` is
// read first) and the raid's (`w1`), and theirs by this one, before a byte of either body is parsed - and an identity's
// `v1` by all three. The claim shapes are disjoint besides: none of another's fields is admitted here.
//
// UNSIGNED IS A REAL ANSWER, as the gate's is: a relay with no key still referees the bout - the receipt goes out
// `a1.<body>.` and the account service declines it (the record is the only thing a missing key costs).
//
// PURE, and all three ends import it (the relay mints, the client reads, the account service verifies).
//
// Not a DFU member. Ledger A (ARENA).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';
import { ARENA_BOUT_ID_RE, ARENA_TIERS, ARENA_TIER_BOUTS, ARENA_HOW } from './arenaLaw.js';

/** The only version this file reads or writes. */
export const ARENA_RECEIPT_V = 'a1';
/** How long a receipt may be carried to the account service: a week, the gate's own. */
export const ARENA_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire (two account ids make the players' longer than the gate's). */
export const ARENA_RECEIPT_MAX = 640;
/** The fields another signed shape carries - none is admitted on a bout's receipt, whatever key signed it. */
const FOREIGN = Object.freeze(['n', 'k', 't', 'g', 'o', 'd', 'b', 'c', 'x', 'w', 'y', 'l']);

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed bout receipt's claims must be, before any signature is considered.
 * @param {any} c
 */
export function arenaReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of FOREIGN) if (c[k] !== undefined) return false;
  if (typeof c.j !== 'string' || !ARENA_BOUT_ID_RE.test(c.j)) return false;
  if (typeof c.h !== 'string' || !ARENA_HOW.includes(c.h)) return false;
  if (c.a === 'l') {
    if (c.f !== undefined) return false;
    if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
    if (!Number.isInteger(c.q) || c.q < 0 || c.q >= ARENA_TIERS) return false;
    if (!Number.isInteger(c.u) || c.u < 0 || c.u > ARENA_TIER_BOUTS) return false;
    if (c.r !== 0 && c.r !== 1) return false;
  } else if (c.a === 'p') {
    if (c.s !== undefined || c.q !== undefined || c.u !== undefined) return false;
    if (!Array.isArray(c.f) || c.f.length !== 2 || !c.f.every((s) => typeof s === 'string' && ID_RE.test(s)) || c.f[0] === c.f[1]) return false;
    if (c.r !== 0 && c.r !== 1 && c.r !== 2) return false;
  } else return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > ARENA_RECEIPT_TTL_S) return false;
  return true;
}

/** The claims in the order the minter writes them - one byte string for one receipt. */
function claimsOf(what, nowS) {
  const head = what.a === 'l'
    ? { a: 'l', j: what.j, s: what.s, q: what.q, u: what.u, r: what.r, h: what.h }
    : { a: 'p', j: what.j, f: [what.f?.[0], what.f?.[1]], r: what.r, h: what.h };
  return { ...head, i: nowS, e: nowS + ARENA_RECEIPT_TTL_S };
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`a1.<body>.`).
 * @param {any} what a ladder bout's `{ a: 'l', j, s, q, u, r, h }` or players' `{ a: 'p', j, f, r, h }`
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintArenaReceipt(what, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintArenaReceipt needs an integer epoch-seconds clock');
  const claims = claimsOf(what ?? {}, nowS);
  if (!arenaReceiptValid(claims)) throw new TypeError('mintArenaReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${ARENA_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${ARENA_RECEIPT_V}.${body}`)));
  return `${ARENA_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on
 * it. Null for anything that is not a well-formed bout receipt.
 * @param {unknown} r
 */
export function readArenaReceipt(r) {
  if (typeof r !== 'string' || r.length > ARENA_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== ARENA_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return arenaReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a
 * repair: the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyArenaReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > ARENA_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== ARENA_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!arenaReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
