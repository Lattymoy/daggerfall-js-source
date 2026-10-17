// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A FALL IN THE OPEN ZONE, SIGNED BY THE RELAY THAT REFEREED IT.
//
//     f1.<base64url({ f, c, k, r, w, wt?, i, e })>.<base64url(64-byte Ed25519 signature)>
//         f the fallen's account   c its realm character ('' - none signed)   k the killer's account   r the remains' id
//         (twelve hex, the relay's)   w the worn piece the killer took (its place in the fallen's worn offer -
//         systems/wild/wildDropLaw.js wornOffer - or -1, none)   wt that piece's template and material as the offer showed it
//         (AUDIT INT9: the service matches it against what the fallen really wears - the place alone was an index into a
//         list the fallen built)   i issued   e expires (i + WILD_RECEIPT_TTL_S)
//
// WILD1 left a fall to the fallen's own machine (its health at none), and its drop and its worn piece to the fallen's own
// hands - so a client that never took a blow never fell, and one that fell gave what it chose. Now the relay holds the
// zone's vitality and calls the fall (net/wild/wildRef.js), waits on the killer's pick, and hands the fallen and the killer
// this receipt - the relay's use of its one key again: the version is inside the signed bytes, so no other shape is read
// as one, and the other shapes' own fields are refused outright. The account service takes the drop and the worn piece
// off the fallen's JUDGED record against it (server-account/src/wild.js), once (its remains' id) - the fallen's own tab
// first, the killer's after WILD_FALL_GRACE_S - and signs what it took for the room (identityToken.js `remains` order).
//
// PURE, and all three ends import it.
//
// MAC'S DECISION (2026-10-14, "Yes, build it" - the two-phase handoff): THE KILLER'S COLLECT, SIGNED BY THE ROOM THAT
// HOLDS THE REMAINS. The fallen loses the worn piece only once the killer has it: the service holds it in escrow at the
// fall (server-account/src/wild.js), and the killer's take of it in the room is no record handed over - the room signs
// the collect, and the killer's tab carries it to the service, which commits the piece to the killer's record once:
//
//     g1.<base64url({ r, k, c, i, e })>.<base64url(64-byte Ed25519 signature)>
//         r the remains' id (the fall's, its escrow's)   k the killer's account   c the realm character it collects into
//         i issued (the room's clock, while the remains lie)   e expires (i + WILD_COLLECT_TTL_S)
// ═════════════════════════════════════════════════════════════════════
import { _b64url, SIG_BYTES, SKEW_S, ID_RE, REALM_CHARACTER_RE } from '../identityToken.js';

/** The fall receipt's version. */
export const WILD_RECEIPT_V = 'f1';
/** How long a receipt is carried: an hour - its fallen's tab takes the drop at once, its killer's within the grace. */
export const WILD_RECEIPT_TTL_S = 3600;
/** How long the fallen's own tab has to take its drop before the killer may take it for them, s. */
export const WILD_FALL_GRACE_S = 30;
/** The bound on a receipt's length on the wire. */
export const WILD_RECEIPT_MAX = 400;
/** A remains' id: the relay's, twelve hex. */
export const WILD_REMAINS_RE = /^[0-9a-f]{12}$/;
/** The most worn pieces an offer lists (net/wire.js WILD_ITEMS_MAX, pinned equal - this leaf imports only the token's). */
export const WILD_WORN_MAX = 16;

const enc = new TextEncoder();
const dec = new TextDecoder();
/** Every other receipt's own fields (a gate's, a siege's, a Royal Tourney's, an arena's, a duel's): never in a fall's. */
const WILD_FOREIGN = ['s', 'l', 'sk', 'sw', 'sd', 'a', 'h', 'th', 't', 'o', 'd', 'b', 'x', 'y', 'j', 'q', 'u', 'z', 'n'];

/** The collect's version, and how long a collect is carried - the escrow returns to the fallen only once a collect
 *  issued at its last moment would be spent (server-account/src/wild.js wildReclaim). */
export const WILD_COLLECT_V = 'g1';
export const WILD_COLLECT_TTL_S = 300;
/** A collect never carries a fall's own fields, nor any other receipt's. */
const COLLECT_FOREIGN = [...WILD_FOREIGN, 'f', 'w', 'wt'];

/** Everything a well-formed fall receipt's claims must be, before any signature is considered. */
export function wildReceiptValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (WILD_FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (typeof c.f !== 'string' || !ID_RE.test(c.f) || typeof c.k !== 'string' || !ID_RE.test(c.k) || c.f === c.k) return false;
  if (typeof c.c !== 'string' || (c.c !== '' && !REALM_CHARACTER_RE.test(c.c))) return false;
  if (typeof c.r !== 'string' || !WILD_REMAINS_RE.test(c.r)) return false;
  if (!Number.isInteger(c.w) || c.w < -1 || c.w >= WILD_WORN_MAX) return false;
  if (c.wt !== undefined && !(Array.isArray(c.wt) && c.wt.length === 2 && c.wt.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 65536))) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > WILD_RECEIPT_TTL_S) return false;
  return true;
}
/** MINT - the relay's half; unsigned (`f1.<body>.`) with no key, which the service declines. */
export async function mintWildReceipt(/** @type {{ f: string, c: string, k: string, r: string, w: number, wt?: number[]|null }} */ { f, c, k, r, w, wt = null }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintWildReceipt needs an integer epoch-seconds clock');
  const claims = { f, c, k, r, w, ...(w >= 0 && wt ? { wt } : {}), i: nowS, e: nowS + WILD_RECEIPT_TTL_S };
  if (!wildReceiptValid(claims)) throw new TypeError('mintWildReceipt refused a claim set it could not verify');
  return mintAs(WILD_RECEIPT_V, claims, privateKey, subtle);
}
/** READ - the client's half: the claims, signed or not, never a verdict; null for anything else. */
export const readWildReceipt = (/** @type {unknown} */ r) => readAs(WILD_RECEIPT_V, wildReceiptValid, r);
/** A signed shape's rungs, one home for both: `{ ok: true, claims }` or `{ ok: false, why }`. */
async function verifyAs(/** @type {string} */ V, /** @type {(c: any) => boolean} */ valid, /** @type {unknown} */ r, /** @type {CryptoKey} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > WILD_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== V) return { ok: false, why: 'version' };
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
  if (!valid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
/** A signed shape minted: unsigned (`<V>.<body>.`) with no key. */
async function mintAs(/** @type {string} */ V, /** @type {any} */ claims, /** @type {CryptoKey|null} */ privateKey, /** @type {SubtleCrypto} */ subtle) {
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${V}.${body}`)));
  return `${V}.${body}.${_b64url.encode(sig)}`;
}
/** A signed shape read, signed or not, never a verdict; null for anything else. */
function readAs(/** @type {string} */ V, /** @type {(c: any) => boolean} */ valid, /** @type {unknown} */ r) {
  if (typeof r !== 'string' || r.length > WILD_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return valid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/** VERIFY - the account service's half, the other receipts' rungs: `{ ok: true, claims }` or `{ ok: false, why }`. */
export const verifyWildReceipt = (/** @type {unknown} */ r, /** @type {CryptoKey} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ o) => verifyAs(WILD_RECEIPT_V, wildReceiptValid, r, publicKey, o);

/** MAC (2026-10-14): everything a well-formed collect's claims must be. */
export function wildCollectValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (COLLECT_FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (typeof c.r !== 'string' || !WILD_REMAINS_RE.test(c.r) || typeof c.k !== 'string' || !ID_RE.test(c.k)) return false;
  if (typeof c.c !== 'string' || !REALM_CHARACTER_RE.test(c.c)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e) || c.e <= c.i || c.e - c.i > WILD_COLLECT_TTL_S) return false;
  return true;
}
/** MINT A COLLECT - the room's half: killer `k` takes remains `r`'s named piece into realm character `c`. */
export async function mintWildCollect(/** @type {{ r: string, k: string, c: string }} */ { r, k, c }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintWildCollect needs an integer epoch-seconds clock');
  const claims = { r, k, c, i: nowS, e: nowS + WILD_COLLECT_TTL_S };
  if (!wildCollectValid(claims)) throw new TypeError('mintWildCollect refused a claim set it could not verify');
  return mintAs(WILD_COLLECT_V, claims, privateKey, subtle);
}
/** READ A COLLECT - the client's half. */
export const readWildCollect = (/** @type {unknown} */ r) => readAs(WILD_COLLECT_V, wildCollectValid, r);
/** VERIFY A COLLECT - the account service's half. */
export const verifyWildCollect = (/** @type {unknown} */ r, /** @type {CryptoKey} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ o) => verifyAs(WILD_COLLECT_V, wildCollectValid, r, publicKey, o);
