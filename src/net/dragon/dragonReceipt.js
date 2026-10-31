// @ts-check
// DRAGON2 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): A DRAGON'S RECEIPT, the serpent's twin and read rung for rung
// as it is: z1.<base64url({ q the watch, p? the place (DRAGON-EACH), b the look (1 the Aetherbright), s the account, c the
// hoard's seed, x 'dealt' or 'stood', l the level, m? the relay's body count, i issued, e expires })>.<Ed25519 signature>. The version is inside the
// signed bytes, and the claim shapes are disjoint (a dragon's `q` no other carries; their fields refused here), so no
// verifier takes another's. A relay with no key sends it unsigned and the service declines it. Pure. Ledger A (DRAGON).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from '../identityToken.js';
import { bodyMeasureValid } from '../bossBody.js';
import { DRAGON_PLACES } from './dragonLaw.js';

/** The only version this file reads or writes. */
export const DRAGON_RECEIPT_V = 'z1';
/** How long a receipt may be carried to the account service: a week, the gate's and the serpent's. */
export const DRAGON_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const DRAGON_RECEIPT_MAX = 512;
/** How a receipt was earned. */
export const DRAGON_EARNED = Object.freeze(['dealt', 'stood']);
export const DRAGON_RECEIPT_LV_MAX = 999;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Everything a well-formed dragon receipt's claims must be, before any signature is considered. @param {any} c */
export function dragonReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of ['d', 'h', 'w', 'y', 'n', 'k', 't', 'o', 'r']) if (c[k] !== undefined) return false;
  if (!Number.isSafeInteger(c.q) || c.q < 0) return false;
  if (c.p !== undefined && !(Number.isSafeInteger(c.p) && c.p >= 0 && c.p < DRAGON_PLACES)) return false; // DRAGON-EACH: none from a relay before it
  if (c.b !== 0 && c.b !== 1) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!DRAGON_EARNED.includes(c.x)) return false;
  if (!Number.isSafeInteger(c.l) || c.l < 1 || c.l > DRAGON_RECEIPT_LV_MAX) return false;
  if (c.m !== undefined && !bodyMeasureValid(c.m)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  return c.e > c.i && c.e - c.i <= DRAGON_RECEIPT_TTL_S;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`z1.<body>.`) - the seed still rides it.
 * @param {{q: number, p?: number, b: number, s: string, c: number, x: string, l: number, m?: number[]}} what
 * @param {CryptoKey|null} privateKey @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintDragonReceipt({ q, p, b, s, c, x, l, m }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintDragonReceipt needs an integer epoch-seconds clock');
  const claims = {
    q,
    ...(p !== undefined ? { p } : {}),
    b,
    s,
    c,
    x,
    l,
    ...(m !== undefined ? { m } : {}),
    i: nowS,
    e: nowS + DRAGON_RECEIPT_TTL_S,
  };
  if (!dragonReceiptValid(claims)) throw new TypeError('mintDragonReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${DRAGON_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(
    await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${DRAGON_RECEIPT_V}.${body}`)),
  );
  return `${DRAGON_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/** READ - the client's half: a receipt's claims, signed or not, never a verdict on it; null for anything else. @param {unknown} r */
export function readDragonReceipt(r) {
  if (typeof r !== 'string' || r.length > DRAGON_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== DRAGON_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try {
    c = JSON.parse(dec.decode(raw));
  } catch {
    return null;
  }
  return dragonReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half: `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair
 * (the version first, the signature before the content).
 * @param {unknown} r @param {CryptoKey} publicKey @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyDragonReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > DRAGON_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== DRAGON_RECEIPT_V) return { ok: false, why: 'version' };
  if (!sig64) return { ok: false, why: 'unsigned' };
  const sig = _b64url.decode(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(body);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try {
    good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${v}.${body}`));
  } catch {
    return { ok: false, why: 'verify-threw' };
  }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try {
    claims = JSON.parse(dec.decode(raw));
  } catch {
    return { ok: false, why: 'json' };
  }
  if (!dragonReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
