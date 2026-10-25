// @ts-check
// STAFF-EVENT THE REWARD (2026-10-24, mob: "what should we do for the mini bosses drop for loot?", "something like dagons
// leaderboard", "but not his ghear", "build that base", "but we will tweak the drop table"): A STAFF EVENT'S RECEIPT -
// the relay's signature on one fighter's reward at the mini boss's first fall, a town raid's receipt's twin
// (net/raid/raidReceipt.js). Design: bible/11-Multiplayer/Staff-Events.md section 9.
//
//     e1.<base64url({ v, s, c, r, i, e })>.<base64url(64-byte Ed25519 signature)>
//         v the event's id   s the account (the identity token's sub)
//         c a seed (32 bits, the relay's CSPRNG) - the reward rolls off it (systems/staffEventSpoils.js)
//         r the account's rank on the board (1 to STAFF_EVENT_BOARD_MAX, 0 an earner past it)
//         i issued, epoch seconds   e expires (i + STAFF_RECEIPT_TTL_S)
//
// ONE KEY, THREE THINGS, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill
// and a raid's cleanse, and the version is INSIDE the signed bytes: `e1` is refused by the gate's (`r1`) and the raid's
// (`w1`) verifiers before a byte of the body is parsed, and theirs by this one. The claim shapes are disjoint besides:
// an event names `v` and `r`, and none of a raid's `w`/`y`, a gate's `d`/`b`, an identity's `n`/`k`/`t` or an order's `o`.
//
// UNSIGNED IS A REAL ANSWER, as the raid's is: a relay with no key still pays the board - the receipt goes out
// `e1.<body>.`, which the game reads (readStaffReceipt) and a verifier refuses.
//
// PURE, and both ends import it (the relay mints, the client reads).
//
// Not a DFU member. Ledger A (STAFF-EVENT's row).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';
import { STAFF_EVENT_ID_RE, STAFF_EVENT_BOARD_MAX, STAFF_RECEIPT_WIRE_MAX } from './staffEventLaw.js';

/** The only version this file reads or writes. */
export const STAFF_RECEIPT_V = 'e1';
/** How long a receipt is good for: a week, the raid's own. */
export const STAFF_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const STAFF_RECEIPT_MAX = STAFF_RECEIPT_WIRE_MAX;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed event receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function staffReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of ['n', 'k', 't', 'o', 'd', 'b', 'w', 'y']) if (c[k] !== undefined) return false;
  if (typeof c.v !== 'string' || !STAFF_EVENT_ID_RE.test(c.v)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!Number.isInteger(c.r) || c.r < 0 || c.r > STAFF_EVENT_BOARD_MAX) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > STAFF_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`e1.<body>.`).
 * @param {{v: string, s: string, c: number, r: number}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gate/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintStaffReceipt({ v, s, c, r }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintStaffReceipt needs an integer epoch-seconds clock');
  const claims = { v, s, c, r, i: nowS, e: nowS + STAFF_RECEIPT_TTL_S };
  if (!staffReceiptValid(claims)) throw new TypeError('mintStaffReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${STAFF_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${STAFF_RECEIPT_V}.${body}`)));
  return `${STAFF_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on
 * it. Null for anything that is not a well-formed event receipt.
 * @param {unknown} r
 */
export function readStaffReceipt(r) {
  if (typeof r !== 'string' || r.length > STAFF_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== STAFF_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return staffReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - for a service that honours one (the raid's verifier, rung for rung: the version first, the signature
 * before the content). `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair.
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyStaffReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > STAFF_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== STAFF_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!staffReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
