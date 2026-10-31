// @ts-check
// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE CACHES' LAW.
// CACHES-ONCE (2026-10-30, the owner: "Is there a way we can make it non time gated", then chose one coffer in every
// dungeon, opened once ever by an account): a cache's id is its dungeon's key, so the account service
// (server-account/src/aurumCache.js) checks it with no map and the world (scenes/aurumCacheHost.js) stands it in one
// spot on every client. A leaf: no imports. Not a DFU member. Ledger A (AURUM-CACHES).

/** The Aurum one cache gives: one quest's finds (CACHES-ONCE BALANCE - a regular day's caches stay about 24, as the old
 *  one in four at 25 gave; Aurum.md section 3a, Balance). */
export const AURUM_CACHE_AURUM = 10;
/** The caches an account may claim in one UTC day: no play limit, the bound on a forged id (the service holds no map).
 *  A coffer past it waits for the next day: none is lost. */
export const AURUM_CACHE_DAY_MAX = 10;
/** A dungeon's id as the professions key it (scenes/dungeonIdentity.js): an unsigned 32-bit number - net/nodeLaw.js
 *  DUNGEON_ID_MAX, pinned equal. */
export const AURUM_CACHE_DUNGEON_MAX = 0xffffffff;

/** A dungeon's place key, `d<id>`, or null for an id that is no dungeon's. Pure. */
export const aurumCacheDungeonKey = (/** @type {unknown} */ id) =>
  (Number.isSafeInteger(id) && /** @type {number} */ (id) >= 0 && /** @type {number} */ (id) <= AURUM_CACHE_DUNGEON_MAX ? `d${id}` : null);

/** Whether `id` is a cache's: a dungeon's place key in its one spelling (the number read back writes it again) - every
 *  dungeon holds one. Pure. */
export const aurumCacheIdOk = (/** @type {unknown} */ id) => typeof id === 'string' && aurumCacheDungeonKey(Number(id.slice(1))) === id;

/** A string's hash as a number in [0, 1): FNV-1a, then murmur3's finish so neighbouring ids part. Pure. */
export function aurumCacheUnit(/** @type {string} */ s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

/** Where a cache stands in its dungeon: `pile` in [0, 1) picks one of its treasure piles, `bearing` in [0, 2 pi) the
 *  way from that pile to the coffer's foot. Pure. */
export const aurumCacheSpotOf = (/** @type {string} */ id) => ({ pile: aurumCacheUnit(`${id}|pile`), bearing: 2 * Math.PI * aurumCacheUnit(`${id}|way`) });
