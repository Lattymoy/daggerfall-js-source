// @ts-check
// ═════════════════════════════════════════════════════════════════════
// INT9 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): A FALL IN THE OPEN ZONE, SIGNED BY THE RELAY THAT REFEREED IT.
//
//     f1.<base64url({ f, c, k, r, w, wt?, m?, kc?, i, e })>.<base64url(64-byte Ed25519 signature)>
//         f the fallen's account   c its realm character ('' - none signed)   k the killer's account   r the remains' id
//         (twelve hex, the relay's)   w the worn piece the killer took (its place in the fallen's worn offer -
//         systems/wild/wildDropLaw.js wornOffer - or -1, none)   wt that piece's template and material as the offer showed it
//         (AUDIT INT9: the service matches it against what the fallen really wears - the place alone was an index into a
//         list the fallen built)   m the room the fall was refereed in and kc the killer's realm character (SEA-BOUNTY,
//         2026-10-22: the service's word on where a fall was - the open sea's, net/wire.js seaRoomOf - and whom a bounty
//         pays; a receipt of an older relay names neither, and pays none)   i issued   e expires (i + WILD_RECEIPT_TTL_S)
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
/** The bound on a receipt's length on the wire (SEA-BOUNTY: 512 - the room and the killer's character signed too). */
export const WILD_RECEIPT_MAX = 512;
/** A remains' id: the relay's, twelve hex. */
export const WILD_REMAINS_RE = /^[0-9a-f]{12}$/;
/** The most worn pieces an offer lists (net/wire.js WILD_ITEMS_MAX, pinned equal - this leaf imports only the token's). */
export const WILD_WORN_MAX = 16;

const enc = new TextEncoder();
const dec = new TextDecoder();
/** Every other receipt's own fields (a gate's, a siege's, a Royal Tourney's, an arena's, a duel's): never in a fall's. */
const WILD_FOREIGN = ['s', 'l', 'sk', 'sw', 'sd', 'a', 'h', 'th', 't', 'o', 'd', 'b', 'x', 'y', 'j', 'q', 'u', 'z', 'n'];
/** SEA-BOUNTY: a room's key as a fall names it (`m` - net/wire.js's rooms: `world:<cx>,<cy>`, `dungeon:m<id>`, ...). */
export const WILD_ROOM_RE = /^[a-z]{1,12}:[\x21-\x7e]{1,80}$/;

/** The collect's version, and how long a collect is carried - the escrow returns to the fallen only once a collect
 *  issued at its last moment would be spent (server-account/src/wild.js wildReclaim). */
export const WILD_COLLECT_V = 'g1';
export const WILD_COLLECT_TTL_S = 300;
/** A collect never carries a fall's own fields, nor any other receipt's. */
const COLLECT_FOREIGN = [...WILD_FOREIGN, 'f', 'w', 'wt', 'm', 'kc'];

/** Everything a well-formed fall receipt's claims must be, before any signature is considered. */
export function wildReceiptValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (WILD_FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (typeof c.f !== 'string' || !ID_RE.test(c.f) || typeof c.k !== 'string' || !ID_RE.test(c.k) || c.f === c.k) return false;
  if (typeof c.c !== 'string' || (c.c !== '' && !REALM_CHARACTER_RE.test(c.c))) return false;
  if (typeof c.r !== 'string' || !WILD_REMAINS_RE.test(c.r)) return false;
  if (!Number.isInteger(c.w) || c.w < -1 || c.w >= WILD_WORN_MAX) return false;
  if (c.wt !== undefined && !(Array.isArray(c.wt) && c.wt.length === 2 && c.wt.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 65536))) return false;
  if (c.m !== undefined && !(typeof c.m === 'string' && WILD_ROOM_RE.test(c.m))) return false;   // SEA-BOUNTY: the room
  if (c.kc !== undefined && !(typeof c.kc === 'string' && REALM_CHARACTER_RE.test(c.kc))) return false;   // SEA-BOUNTY: the killer's character
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > WILD_RECEIPT_TTL_S) return false;
  return true;
}
/** MINT - the relay's half; unsigned (`f1.<body>.`) with no key, which the service declines. */
export async function mintWildReceipt(/** @type {{ f: string, c: string, k: string, r: string, w: number, wt?: number[]|null, m?: string, kc?: string }} */ { f, c, k, r, w, wt = null, m = '', kc = '' }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintWildReceipt needs an integer epoch-seconds clock');
  const claims = { f, c, k, r, w, ...(w >= 0 && wt ? { wt } : {}), ...(m ? { m } : {}), ...(kc ? { kc } : {}), i: nowS, e: nowS + WILD_RECEIPT_TTL_S };
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

// ═══ SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides
// between captains in the open sea; bible/03-World/Eltheric-Ocean.md SHIP-PVP): A SHIP WRECKED AT ANOTHER CAPTAIN'S GUNS,
// SIGNED BY THE RELAY THAT REFEREED IT (net/sea/seaRef.js). The relay holds each captain's ship's bar in the open sea and
// calls the wreck; its killer has SEA_REF.boardMs to come alongside and board her (`b` 1: her hold's share is the
// killer's prize); then the relay signs it and hands it to both, and the account service takes the prize off the wrecked
// captain's JUDGED record against it (server-account/src/seaWreck.js), once (the wreck's id) - the wrecked captain's own
// tab first, the killer's after SEA_WRECK_GRACE_S. A wreck is a kill at sea for the bounty board (SEA-BOUNTY).
//
//     n1.<base64url({ f, c, k, kc, r, u, b, m, i, e })>.<base64url(64-byte Ed25519 signature)>
//         f the wrecked captain's account   c its realm character   k the killer's account   kc its realm character
//         r the wreck's id (twelve hex, the relay's)   u her uid (the boat whose hold gives the prize)   b boarded (1) or
//         not (0)   m the room that refereed it   i issued   e expires (i + SEA_WRECK_TTL_S)
// ═══════════════════════════════════════════════════════════════════
export const SEA_WRECK_V = 'n1';
/** How long a wreck's receipt is good, s. */
export const SEA_WRECK_TTL_S = 3600;
/** How long the wrecked captain's own tab has to bring it before the killer may bring it for them (his seize clears her
 *  record's lease, and her tab goes to the title), s. AUDIT SEA VENTURES E3: five minutes - her carry waits for a
 *  checkpoint that may go (the dead wait two minutes at sea; a duel's checkpoints are refused), where thirty seconds sent
 *  an honest captain to the title. Her killer's prize waits on her carry alone: the service answers it as it stands. */
export const SEA_WRECK_GRACE_S = 300;
/** A boat's uid as a wreck names it (Come Sail Away's `UID`: a positive whole number). */
export const SEA_BOAT_UID_MAX = 0x7fffffff;
/** Every other receipt's own fields - a fall's among them - never in a wreck's. */
const WRECK_FOREIGN = [...WILD_FOREIGN.filter((f) => f !== 'u' && f !== 'b'), 'w', 'wt'];

/** Everything a well-formed wreck's claims must be, before any signature is considered. */
export function seaWreckValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (WRECK_FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (typeof c.f !== 'string' || typeof c.k !== 'string' || !ID_RE.test(c.f) || !ID_RE.test(c.k) || c.k === c.f) return false;   // never her own guns
  if (typeof c.c !== 'string' || !REALM_CHARACTER_RE.test(c.c) || typeof c.kc !== 'string' || !REALM_CHARACTER_RE.test(c.kc)) return false;
  if (typeof c.r !== 'string' || !WILD_REMAINS_RE.test(c.r)) return false;
  if (!Number.isSafeInteger(c.u) || c.u < 1 || c.u > SEA_BOAT_UID_MAX) return false;
  if (c.b !== 0 && c.b !== 1) return false;
  if (typeof c.m !== 'string' || !WILD_ROOM_RE.test(c.m)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > SEA_WRECK_TTL_S) return false;
  return true;
}
/** MINT A WRECK - the relay's half; unsigned (`n1.<body>.`) with no key, which the service declines. */
export async function mintSeaWreck(/** @type {{ f: string, c: string, k: string, kc: string, r: string, u: number, b: number, m: string }} */ { f, c, k, kc, r, u, b, m }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintSeaWreck needs an integer epoch-seconds clock');
  const claims = { f, c, k, kc, r, u, b, m, i: nowS, e: nowS + SEA_WRECK_TTL_S };
  if (!seaWreckValid(claims)) throw new TypeError('mintSeaWreck refused a claim set it could not verify');
  return mintAs(SEA_WRECK_V, claims, privateKey, subtle);
}
/** READ A WRECK - the client's half. */
export const readSeaWreck = (/** @type {unknown} */ r) => readAs(SEA_WRECK_V, seaWreckValid, r);
/** VERIFY A WRECK - the account service's half. */
export const verifySeaWreck = (/** @type {unknown} */ r, /** @type {CryptoKey} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ o) => verifyAs(SEA_WRECK_V, seaWreckValid, r, publicKey, o);
