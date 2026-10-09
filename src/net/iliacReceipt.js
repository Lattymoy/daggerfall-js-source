// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 31; section 6.4, DECIDED: "a ladder. Online wins rank
// a player on a season board, the Arena's way"): A RANKED GAME'S RECEIPT - the relay's word on how a game of Iliac Hand
// between two vouched-for decks ended, the arena players' bout receipt's twin (net/arenaReceipt.js `a: 'p'`).
//
//     i1.<base64url({ j, f, r, h, i, e })>.<base64url(64-byte Ed25519 signature)>
//         j the game's id (16 hex - ILIAC_GAME_ID_RE: one game, one result)
//         f the two accounts, seat 0 first        r the result - 0 seat 0 won, 1 seat 1 won, 2 a draw
//         h how it ended (ILIAC_HOW: 'holdings', 'power', 'draw', 'left' - a seat stood up mid-game
//           and conceded)                        i issued, epoch seconds   e expires (i + ILIAC_RECEIPT_TTL_S)
//
// EITHER SEAT CARRIES IT. The relay hands it to both; the account service keys the game's row by `j`, so the winner's
// copy is enough and the loser's (or a second copy) changes nothing - a loss is never the loser's to hide.
//
// ONE KEY, NEVER CONFUSED: the relay's one secret (GATE_SIGNING_KEY) signs this as it signs a bout and a cash-out; the
// version is inside the signed bytes, so `i1` is refused by every other verifier and theirs by this one. The claim shape
// is disjoint besides: none of another receipt's own fields (an arena bout's kind `a`, a cash-out's `w`) is admitted.
//
// UNSIGNED IS A REAL ANSWER, as the others': a relay with no key still sends it (`i1.<body>.`) and the service declines
// it. PURE, and all three ends import it.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';

/** How a ranked game ended: on the board (holdings, power, a draw), or conceded by a seat that stood up. Here, not in
 *  net/iliacTable.js, so the account service's bundle never carries the rules (that file imports them). */
export const ILIAC_HOW = Object.freeze(['holdings', 'power', 'draw', 'left']);
/** A game's id - one game, one result (16 hex, the arena bout's shape). */
export const ILIAC_GAME_ID_RE = /^[0-9a-f]{16}$/;

/** The only version this file reads or writes. */
export const ILIAC_RECEIPT_V = 'i1';
/** How long a receipt may be carried to the account service: a week, the arena's own. */
export const ILIAC_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire (net/iliacTable.js validIliacOut's). */
export const ILIAC_RECEIPT_MAX = 640;
/** The fields another signed shape carries - none is admitted on a game's receipt, whatever key signed it. */
const FOREIGN = Object.freeze(['a', 's', 'q', 'u', 'z', 'w', 'n', 'k', 't', 'g', 'o', 'd', 'b', 'c', 'x', 'y', 'l']);

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed game receipt's claims must be, before any signature is considered.
 * @param {any} c
 */
export function iliacReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of FOREIGN) if (c[k] !== undefined) return false;
  if (typeof c.j !== 'string' || !ILIAC_GAME_ID_RE.test(c.j)) return false;
  if (typeof c.h !== 'string' || !ILIAC_HOW.includes(c.h)) return false;
  if (!Array.isArray(c.f) || c.f.length !== 2 || !c.f.every((s) => typeof s === 'string' && ID_RE.test(s)) || c.f[0] === c.f[1]) return false;
  if (c.r !== 0 && c.r !== 1 && c.r !== 2) return false;
  if ((c.r === 2) !== (c.h === 'draw')) return false;   // a draw is said one way only
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > ILIAC_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`i1.<body>.`).
 * @param {{j: string, f: string[], r: number, h: string}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintIliacReceipt({ j, f, r, h }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintIliacReceipt needs an integer epoch-seconds clock');
  const claims = { j, f: [f?.[0], f?.[1]], r, h, i: nowS, e: nowS + ILIAC_RECEIPT_TTL_S };
  if (!iliacReceiptValid(claims)) throw new TypeError('mintIliacReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${ILIAC_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${ILIAC_RECEIPT_V}.${body}`)));
  return `${ILIAC_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed game receipt.
 * @param {unknown} r
 */
export function readIliacReceipt(r) {
  if (typeof r !== 'string' || r.length > ILIAC_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== ILIAC_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return iliacReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair:
 * the version first, the signature before the content.
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyIliacReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > ILIAC_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== ILIAC_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!iliacReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
