// @ts-check
// CARDS6 (2026-10-08, Mac: "#2"; bible/11-Multiplayer/Tavern-Cards.md section 23): THE CARD TABLE'S CASH-OUT RECEIPT -
// the relay's word on what a staked seat leaves the table with, the gate's, the raid's and the watch's receipts' twin
// (net/gateReceipt.js, net/watchReceipt.js). Section 5, DECIDED: "standing up moves the stack back".
//
//     c1.<base64url({ s, j, r, w, i, e })>.<base64url(64-byte Ed25519 signature)>
//         s the account (the identity token's sub)   j the stake (the service's id, net/identityToken.js stake order)
//         r the gold the seat leaves with (its stack; 0 out of chips)
//         w why: 'stood' (up, or gone from the room), 'broke', 'refused' (the sit never took - the whole stake back),
//           'void' (an order past its minute the room never sat - the whole stake back), 'joined' (a top-up: its chips
//           went onto a seat's stack, and come home in that seat's own receipt - nothing back by this one)
//         i issued, epoch seconds   e expires (i + CARD_RECEIPT_TTL_S)
//
// ONE STAKE, ONE RECEIPT: the room spends a stake's id once (its seat, its refusal or its void), and the service pays a
// stake once (its row goes from held to paid in the same batch as the gold - server-account/src/cards.js). What a
// table's seats leave with adds up to what its stakes brought: the chips are the relay's law's (net/cardLaw.js), every
// chip conserved.
//
// ONE KEY, NEVER CONFUSED: the relay's one secret (GATE_SIGNING_KEY) signs this as it signs a kill and a tick; the
// version is inside the signed bytes, so `c1` is refused by every other verifier and theirs by this one. The claim shape
// is disjoint besides: a cash-out names a stake `j` and a sum `r`, and never a pixel, a gate, a raid or a watch's nonce.
//
// UNSIGNED IS A REAL ANSWER, as the others': a relay with no key still sends it (`c1.<body>.`) and the service declines
// it. PURE, and all three ends import it.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE, STAKE_ID_RE, STAKE_GOLD_MAX } from './identityToken.js';
import { HOLDEM_SEATS_MAX } from './cardLaw.js';

/** The only version this file reads or writes. */
export const CARD_RECEIPT_V = 'c1';
/** How long a cash-out may be carried to the service: thirty days - it is the player's gold. */
export const CARD_RECEIPT_TTL_S = 30 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const CARD_RECEIPT_MAX = 400;
/** Why a seat's stake came back. */
export const CARD_RECEIPT_WHY = Object.freeze(['stood', 'broke', 'refused', 'void', 'joined']);
/** The most one seat can leave with: every seat's deepest stake (the whole table's chips). */
export const CARD_CASHOUT_MAX = STAKE_GOLD_MAX * HOLDEM_SEATS_MAX;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed cash-out's claims must be, before any signature is considered. Another signed shape's fields
 * are refused outright.
 * @param {any} c
 */
export function cardReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const f of ['n', 'k', 't', 'o', 'd', 'b', 'x', 'y', 'c', 'q', 'a']) if (c[f] !== undefined) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (typeof c.j !== 'string' || !STAKE_ID_RE.test(c.j)) return false;
  if (!Number.isSafeInteger(c.r) || c.r < 0 || c.r > CARD_CASHOUT_MAX) return false;
  if (!CARD_RECEIPT_WHY.includes(c.w)) return false;
  if ((c.w === 'broke' || c.w === 'joined') && c.r !== 0) return false;   // out of chips is nothing back; a top-up's is its seat's
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > CARD_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`c1.<body>.`).
 * @param {{s: string, j: string, r: number, w: string}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintCardReceipt({ s, j, r, w }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintCardReceipt needs an integer epoch-seconds clock');
  const claims = { s, j, r, w, i: nowS, e: nowS + CARD_RECEIPT_TTL_S };
  if (!cardReceiptValid(claims)) throw new TypeError('mintCardReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${CARD_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${CARD_RECEIPT_V}.${body}`)));
  return `${CARD_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed cash-out.
 * @param {unknown} r
 */
export function readCardReceipt(r) {
  if (typeof r !== 'string' || r.length > CARD_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== CARD_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return cardReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair:
 * the version first, the signature before the content.
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number, anyAge?: boolean}} env - `anyAge`: a receipt past its `e`
 *   still reads (AUDIT CARDS-4 A3: the service's cash-out, where the stake's row spends it once)
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyCardReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S, anyAge = false }) {
  if (typeof r !== 'string' || r.length > CARD_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== CARD_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!cardReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (!anyAge && nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
