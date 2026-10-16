// @ts-check
// KG6 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 10.7 and 19): A RATED GAME'S RECEIPT - the relay's word
// on how a game of The King's Gambit between two accounts ended, Iliac Hand's ranked receipt's twin (net/iliac/iliacReceipt.js).
//
//     g1.<base64url({ j, f, r, h, i, e })>.<base64url(64-byte Ed25519 signature)>
//         j the game's id (16 hex: one game, one result)    f the two accounts, the host's seat first
//         r the winning seat - 0 the host, 1 the guest      h how it ended (GAMBIT_HOW: a king's fall, a forfeit, a seat
//         the clock stood up, a seat that stood or whose socket went)    i issued, epoch seconds    e i + the TTL
//
// No draw: a game nobody won (the relay's source broke, the room drained) is no contest, and no receipt. EITHER SEAT
// CARRIES IT - the account service keys the game's row by `j` (server-account/src/gambit.js claimGambit).
//
// ONE KEY, NEVER CONFUSED: the relay's one secret signs it as it signs a bout, a cash-out and an Iliac game; the
// version is inside the signed bytes, so `g1` is refused by every other verifier and theirs by this one.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';

/** How a rated game ended - the relay's `result` events' words (net/gambit/gambitTable.js), but its no contest. */
export const GAMBIT_HOW = Object.freeze(['king', 'forfeit', 'idle', 'left']);
/** A game's id - one game, one result. */
export const GAMBIT_GAME_ID_RE = /^[0-9a-f]{16}$/;
/** The only version this file reads or writes. */
export const GAMBIT_RECEIPT_V = 'g1';
/** How long a receipt may be carried to the account service: a week, Iliac Hand's and the arena's. */
export const GAMBIT_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const GAMBIT_RECEIPT_MAX = 640;
/** The fields another signed shape carries - none is admitted on a game's receipt. */
const NOT_A_GAMES = Object.freeze(['a', 's', 'q', 'u', 'z', 'w', 'n', 'k', 't', 'g', 'o', 'd', 'b', 'c', 'x', 'y', 'l']);

const utf8 = new TextEncoder();
const unutf8 = new TextDecoder();

/** Everything a well-formed game receipt's claims must be, before any signature is considered. @param {any} c */
export function gambitReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of NOT_A_GAMES) if (c[k] !== undefined) return false;
  if (typeof c.j !== 'string' || !GAMBIT_GAME_ID_RE.test(c.j)) return false;
  if (typeof c.h !== 'string' || !GAMBIT_HOW.includes(c.h)) return false;
  if (!Array.isArray(c.f) || c.f.length !== 2 || !c.f.every((/** @type {any} */ s) => typeof s === 'string' && ID_RE.test(s)) || c.f[0] === c.f[1]) return false;
  if (c.r !== 0 && c.r !== 1) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > GAMBIT_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`g1.<body>.`), and the service declines it.
 * @param {{j: string, f: string[], r: number, h: string}} what
 * @param {CryptoKey|null} privateKey @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintGambitReceipt({ j, f, r, h }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintGambitReceipt needs an integer epoch-seconds clock');
  const claims = { j, f: [f?.[0], f?.[1]], r, h, i: nowS, e: nowS + GAMBIT_RECEIPT_TTL_S };
  if (!gambitReceiptValid(claims)) throw new TypeError('mintGambitReceipt refused a claim set it could not verify');
  const body = _b64url.encode(utf8.encode(JSON.stringify(claims)));
  if (!privateKey) return `${GAMBIT_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, utf8.encode(`${GAMBIT_RECEIPT_V}.${body}`)));
  return `${GAMBIT_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/** READ - the client's half: the claims of a receipt, signed or not, never a verdict on it; null for anything that is
 *  not a well-formed game receipt. @param {unknown} r */
export function readGambitReceipt(r) {
  if (typeof r !== 'string' || r.length > GAMBIT_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== GAMBIT_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(unutf8.decode(raw)); } catch { return null; }
  return gambitReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half: `{ ok: true, claims }` or `{ ok: false, why }`, never a throw: the version first,
 * the signature before the content.
 * @param {unknown} r @param {CryptoKey} publicKey the relay's @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyGambitReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > GAMBIT_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== GAMBIT_RECEIPT_V) return { ok: false, why: 'version' };
  if (!sig64) return { ok: false, why: 'unsigned' };
  const sig = _b64url.decode(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(body);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, utf8.encode(`${v}.${body}`)); } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try { claims = JSON.parse(unutf8.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  if (!gambitReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
