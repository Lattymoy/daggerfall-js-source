// @ts-check
// AUDIT AURUM-CACHES E1 (2026-10-31, the owner: "Ensure security on aurem caches so nobody can dupe or cheat"): THE RELAY'S
// WORD THAT AN ACCOUNT WAS IN A DUNGEON. A cache's id was checked by the law alone, so a script could claim any dungeon's
// coffer from a script. The relay now signs, in its welcome to a socket hello'd into a dungeon's room, that this account
// stood in that map's dungeon; the claim carries it, and the account service pays only the coffer of that dungeon
// (server-account/src/aurumCache.js). The relay's one receipt key signs it (net/gate/gateReceipt.js importReceiptKey).
//
//     q1.<base64url({ s, m, i, e })>.<base64url(64-byte Ed25519 signature)>   s the account, m the room's map id
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';
import { aurumCacheDungeonKey } from './aurumCacheLaw.js';

export const CACHE_PROOF_V = 'q1';
/** How long a proof may be carried to a coffer: a long dungeon's visit. */
export const CACHE_PROOF_TTL_S = 6 * 3600;
export const CACHE_PROOF_MAX = 400;
/** The Bay's pixel ids, under which a map id keys by its low 20 bits (world/placeIds.js BAY_PIXEL_IDS, pinned equal). */
export const CACHE_BAY_IDS = 500_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const MAP_MAX = 0xffffffff;

/** The map id of a dungeon's room (`dungeon:m<id>`, its size, curated block or instance after it), or null. Pure. */
export function cacheProofRoomMap(/** @type {unknown} */ key) {
  const m = /^dungeon:m([1-9]\d{0,9})(?:[.:]|$)/.exec(String(key ?? ''));
  const id = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(id) && id <= MAP_MAX ? id : null;
}
/** The cache a map id's dungeon holds - the professions' key (scenes/dungeonIdentity.js dungeonIdOf), `d<id>`. Pure. */
export function cacheProofPlace(/** @type {unknown} */ mapId) {
  if (!Number.isSafeInteger(mapId) || /** @type {number} */ (mapId) < 1 || /** @type {number} */ (mapId) > MAP_MAX) return null;
  const low = /** @type {number} */ (mapId) & 0xfffff;   // BAY-OWN: discoveryKeyOf's own key - a Bay id keeps its low 20 bits, a port id keys whole
  return aurumCacheDungeonKey(low < CACHE_BAY_IDS ? low : /** @type {number} */ (mapId) >>> 0);
}

/** Everything a proof's claims must be, before any signature is considered. */
export function cacheProofValid(/** @type {any} */ c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (Object.keys(c).some((k) => !['s', 'm', 'i', 'e'].includes(k))) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.m) || c.m < 1 || c.m > MAP_MAX) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  return c.e > c.i && c.e - c.i <= CACHE_PROOF_TTL_S;
}

/** MINT - the relay's half. With no key there is no proof (null): an unsigned word would pay nothing. */
export async function mintCacheProof(/** @type {{ s: string, m: number }} */ { s, m }, /** @type {CryptoKey|null} */ privateKey, /** @type {{ subtle: SubtleCrypto, nowS: number }} */ { subtle, nowS }) {
  const claims = { s, m, i: nowS, e: nowS + CACHE_PROOF_TTL_S };
  if (!privateKey || !cacheProofValid(claims)) return null;
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${CACHE_PROOF_V}.${body}`)));
  return `${CACHE_PROOF_V}.${body}.${_b64url.encode(sig)}`;
}

/** READ - the page's half: the claims of a proof it was handed, never a verdict. */
export function readCacheProof(/** @type {unknown} */ r) {
  if (typeof r !== 'string' || r.length > CACHE_PROOF_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== CACHE_PROOF_V || !parts[2]) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return cacheProofValid(c) ? c : null;
}

/** VERIFY - the account service's half: `{ ok: true, claims }` or `{ ok: false, why }`, never a throw. */
export async function verifyCacheProof(/** @type {unknown} */ r, /** @type {CryptoKey|null} */ publicKey, /** @type {{ subtle: SubtleCrypto, nowS: number, skewS?: number }} */ { subtle, nowS, skewS = SKEW_S }) {
  if (!publicKey) return { ok: false, why: 'no-key' };
  if (typeof r !== 'string' || r.length > CACHE_PROOF_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== CACHE_PROOF_V) return { ok: false, why: 'version' };
  const sig = _b64url.decode(parts[2]);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(parts[1]);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${parts[0]}.${parts[1]}`)); } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try { claims = JSON.parse(dec.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  if (!cacheProofValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS) || nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}

/** THE PAGE'S KEPT PROOF - the last a welcome brought, with the room it was for. One at a time: a dungeon's coffer asks
 *  the one of its own room. */
let _kept = /** @type {{ place: string, proof: string } | null} */ (null);
/** Keep a welcome's proof for its room (`room` the room key); anything that is not one, or no dungeon's, keeps nothing. */
export function keepCacheProof(/** @type {unknown} */ room, /** @type {unknown} */ proof) {
  const c = readCacheProof(proof), place = cacheProofPlace(cacheProofRoomMap(room));
  if (c && place && cacheProofPlace(c.m) === place) _kept = { place, proof: /** @type {string} */ (proof) };
}
/** The kept proof for cache `id` (`d<dungeon>`), or null. */
export const cacheProofFor = (/** @type {unknown} */ id) => (_kept && _kept.place === id ? _kept.proof : null);
/** Test seam. */
export const _resetCacheProof = () => { _kept = null; };
