// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md section 9): THE KETCH'S RECEIPT - the relay's signature on the Tonal Warden's
// fall, the Hour's twin (net/superDungeon/sdReceipt.js) rung for rung.
//
//     y1.<base64url({ d, b, o, s, c, x, l, m?, i, e })>.<base64url(64-byte Ed25519 signature)>
//         d the voyage (net/ketch/ketchLaw.js)   b the boss ('warden')   o the crew's ship - its captain's digest, 16 hex
//         s the account (the identity sub)   c the spoils' seed (32 bits, the relay's CSPRNG)   x how it was earned
//         ('dealt' | 'stood')   l the level the fight admitted it at   m the relay's count of its body (INT14, optional)
//         i issued, epoch seconds   e expires (i + KT_RECEIPT_TTL_S)
//
// ONE KEY, NEVER CONFUSED: the relay's one secret signs it as it signs every kill, the version INSIDE the signed bytes,
// so `y1` is refused by every other verifier and theirs by this one before a byte of either body is parsed - and its
// claims carry none of the others' own fields. UNSIGNED IS A REAL ANSWER (a relay with no key): the page reads it and the
// account service declines it - and the Ketchmaster's hold, which pays only the share the service grants once a voyage an
// account (net/ketch/ketchClaims.js, scenes/ketch/ketchClient.js `paid`), pays nothing off it (the Hour's page, which owes
// no week, rolls an unsigned receipt's spoils; the live run on a keyless relay found the chest empty, as it should be).
//
// THE WEEKLY SHARE (server-account/src/ketch.js): the service keeps one row a VOYAGE and account - the first receipt it
// is shown takes the voyage's share, and a receipt of the same voyage from ANOTHER crew's ship is answered `taken` (the
// account helped a second crew; the hold had already paid it). `o` is how it tells them apart.
//
// PURE, and all three ends import it. Not a DFU member. Ledger A (KETCH).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';
import { bodyMeasureValid } from '../bossBody.js';

export const KT_RECEIPT_V = 'y1';
/** How long a receipt may be carried to the account service: a week (KETCH-EVERY: some seventeen voyages). */
export const KT_RECEIPT_TTL_S = 7 * 24 * 3600;
export const KT_RECEIPT_MAX = 560;
export const KT_EARNED = Object.freeze(['dealt', 'stood']);
export const KT_RECEIPT_BOSS = 'warden';
export const KT_RECEIPT_VOYAGE_MAX = 0xffffffff;
export const KT_RECEIPT_LV_MAX = 999;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Everything a well-formed Ketch receipt's claims must be, before any signature is considered. */
export function ketchReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of ['n', 'k', 't', 'w', 'y', 'r', 'h', 'p']) if (c[k] !== undefined) return false;
  if (!Number.isSafeInteger(c.d) || c.d < 0 || c.d > KT_RECEIPT_VOYAGE_MAX) return false;
  if (c.b !== KT_RECEIPT_BOSS) return false;
  if (typeof c.o !== 'string' || !/^[0-9a-f]{16}$/.test(c.o)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!KT_EARNED.includes(c.x)) return false;
  if (!Number.isSafeInteger(c.l) || c.l < 1 || c.l > KT_RECEIPT_LV_MAX) return false;
  if (c.m !== undefined && !bodyMeasureValid(c.m)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > KT_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`y1.<body>.`).
 * @param {{d: number, o: string, s: string, c: number, x: string, l: number, m?: number[]}} what
 * @param {CryptoKey|null} privateKey @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintKetchReceipt({ d, o, s, c, x, l, m }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintKetchReceipt needs an integer epoch-seconds clock');
  const claims = { d, b: KT_RECEIPT_BOSS, o, s, c, x, l, ...(m !== undefined ? { m } : {}), i: nowS, e: nowS + KT_RECEIPT_TTL_S };
  if (!ketchReceiptValid(claims)) throw new TypeError('mintKetchReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${KT_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${KT_RECEIPT_V}.${body}`)));
  return `${KT_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/** READ - the page's half: the claims of a receipt its socket was handed, signed or not, never a verdict. */
export function readKetchReceipt(r) {
  if (typeof r !== 'string' || r.length > KT_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== KT_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return ketchReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half: `{ ok: true, claims }` or `{ ok: false, why }`, never a throw (the Hour's rungs).
 * @param {unknown} r @param {CryptoKey} publicKey @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 */
export async function verifyKetchReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > KT_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== KT_RECEIPT_V) return { ok: false, why: 'version' };
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
  if (!ketchReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
