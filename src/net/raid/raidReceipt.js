// @ts-check
// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server" - the relay ... signs the rewards): A
// RAID'S RECEIPT - the relay's second signature, the gate's receipt's twin (net/gate/gateReceipt.js). Design:
// bible/03-World/Raiding-Parties.md, "The relay holds the raid (RAID3)".
//
//     w1.<base64url({ w, s, c, y, i, e })>.<base64url(64-byte Ed25519 signature)>
//         w the raid's key (region:location:day)   s the account (the identity token's sub)
//         c a seed (32 bits, the relay's CSPRNG) - the raid's spoils roll off it (RAID4)
//         y the raiding party (0 knights, 1 bandits, 2 orcs)   i issued, epoch seconds   e expires (i + RAID_RECEIPT_TTL_S)
//
// ONE KEY, TWO THINGS, NEVER CONFUSED. The relay's one secret (GATE_SIGNING_KEY) signs this as it signs a gate's kill,
// and the version is INSIDE the signed bytes: `w1` is refused by the gate's verifier (its `r1` is read first) and `r1`
// by this one, before a byte of either body is parsed - and an identity's `v1` by both. The claim shapes are disjoint
// besides: a raid names `w` and `y`, a gate `d` and `b`, and none carries an identity's `n`, `k` or `t` or an order's
// `o` (refused here outright, whatever key signed them).
//
// UNSIGNED IS A REAL ANSWER, as the gate's is: a relay with no key still keeps the raid and stamps the cleanse - the
// receipt goes out `w1.<body>.` and the account service declines it. `readRaidReceipt` (the client's) reads either;
// only `verifyRaidReceipt` (the account service's, RAID4) says one is honoured.
//
// PURE, and all three ends import it (the relay mints, the client reads, the account service verifies).
//
// Not a DFU member. Ledger A (RAID1's row).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';
import { RAID_KEY_RE, RAID_TYPES } from './raidLaw.js';

/** The only version this file reads or writes. */
export const RAID_RECEIPT_V = 'w1';
/** How long a receipt may be carried to the account service: a week, the gate's own. */
export const RAID_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const RAID_RECEIPT_MAX = 512;

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Everything a well-formed raid receipt's claims must be, before any signature is considered. Another signed shape's
 * fields are refused outright.
 * @param {any} c
 */
export function raidReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (c.n !== undefined || c.k !== undefined || c.t !== undefined || c.o !== undefined || c.d !== undefined || c.b !== undefined) return false;
  if (typeof c.w !== 'string' || !RAID_KEY_RE.test(c.w)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!Number.isInteger(c.y) || c.y < 0 || c.y >= RAID_TYPES) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > RAID_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`w1.<body>.`).
 * @param {{w: string, s: string, c: number, y: number}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gate/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintRaidReceipt({ w, s, c, y }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintRaidReceipt needs an integer epoch-seconds clock');
  const claims = { w, s, c, y, i: nowS, e: nowS + RAID_RECEIPT_TTL_S };
  if (!raidReceiptValid(claims)) throw new TypeError('mintRaidReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${RAID_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${RAID_RECEIPT_V}.${body}`)));
  return `${RAID_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on
 * it. Null for anything that is not a well-formed raid receipt.
 * @param {unknown} r
 */
export function readRaidReceipt(r) {
  if (typeof r !== 'string' || r.length > RAID_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== RAID_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return raidReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half (RAID4). `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never
 * a repair: the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyRaidReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > RAID_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== RAID_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!raidReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
