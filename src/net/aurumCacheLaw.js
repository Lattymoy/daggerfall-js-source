// @ts-check
// AURUM-CACHES (2026-10-30; the owner, asked whether "world finds" meant deeds alone or also Aurum caches in the world, each
// server-checked and under a daily cap: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE CACHES' LAW. A
// place holds a cache on a UTC day when a hash of the day and the place's key says so, so the account service
// (server-account/src/aurumCache.js) checks an id with no map, and the world (scenes/aurumCacheHost.js) stands the same
// cache in the same spot on every client. A leaf: no imports. Not a DFU member. Ledger A (AURUM-CACHES).

const DAY_S = 86_400;
// AURUM-CACHES BALANCE (2026-10-30, the owner: "ensure the aurem caches are balanced", once AURUM-ONLY priced every ware
// in Aurum): at 15 Aurum in one dungeon in five a visit was worth 3 Aurum, a tenth of its finds, and a regular player
// earned 9% of a week from caches. Now a cache is worth two and a half quests' finds, a regular player (four dungeons a
// day) finds about one a day, and the day's most stays under the finds' own 100 (Aurum.md section 3a, Balance).
/** The Aurum one cache gives. */
export const AURUM_CACHE_AURUM = 25;
/** The caches an account may claim in one UTC day. */
export const AURUM_CACHE_DAY_MAX = 3;
/** The share of places that hold a cache on a day: one in four. */
export const AURUM_CACHE_SHARE = 0.25;
/** A dungeon's id as the professions key it (scenes/dungeonIdentity.js): an unsigned 32-bit number - net/nodeLaw.js
 *  DUNGEON_ID_MAX, pinned equal. */
export const AURUM_CACHE_DUNGEON_MAX = 0xffffffff;

/** A UTC day's number at `nowS` (seconds) - net/marksLaw.js utcDay's, pinned equal. Pure. */
export const aurumCacheDayOf = (/** @type {number} */ nowS) => Math.floor(nowS / DAY_S);

/** A dungeon's place key, `d<id>`, or null for an id that is no dungeon's. Pure. */
export const aurumCacheDungeonKey = (/** @type {unknown} */ id) =>
  (Number.isSafeInteger(id) && /** @type {number} */ (id) >= 0 && /** @type {number} */ (id) <= AURUM_CACHE_DUNGEON_MAX ? `d${id}` : null);

const PLACE_RE = /^d(0|[1-9]\d{0,9})$/;
/** Whether a place key is one the law knows: a dungeon's, in its one spelling. Pure. */
const placeOk = (/** @type {unknown} */ place) => typeof place === 'string' && PLACE_RE.test(place) && aurumCacheDungeonKey(Number(place.slice(1))) === place;

/** A string's hash as a number in [0, 1): FNV-1a, then murmur3's finish so neighbouring days and ids part. Pure. */
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

/** Whether `place` holds a cache on UTC day `day`. Pure. */
export const aurumCacheHolds = (/** @type {number} */ day, /** @type {unknown} */ place) =>
  Number.isSafeInteger(day) && day >= 0 && placeOk(place) && aurumCacheUnit(`${day}:${place}`) < AURUM_CACHE_SHARE;

/** A cache's id: `<day>:<place>`. Pure. */
export const aurumCacheId = (/** @type {number} */ day, /** @type {string} */ place) => `${day}:${place}`;

const ID_RE = /^(0|[1-9]\d{0,5}):(d\d{1,10})$/;
/** An id read back - `{ day, place }` - or null for one out of shape or a place that holds no cache that day. Pure. */
export function aurumCacheOf(/** @type {unknown} */ id) {
  const m = typeof id === 'string' ? ID_RE.exec(id) : null;
  if (!m) return null;
  const day = Number(m[1]), place = m[2];
  return aurumCacheHolds(day, place) ? { day, place } : null;
}

/** Whether a claim at `nowS` may take `id`: a cache's, of today or of yesterday (one found just before midnight). Pure. */
export function aurumCacheIdOk(/** @type {unknown} */ id, /** @type {number} */ nowS) {
  const c = aurumCacheOf(id), today = aurumCacheDayOf(nowS);
  return !!c && (c.day === today || c.day === today - 1);
}

/** Where a cache stands in its dungeon: `pile` in [0, 1) picks one of its treasure piles, `bearing` in [0, 2 pi) the
 *  way from that pile to the coffer's foot. Pure. */
export const aurumCacheSpotOf = (/** @type {string} */ id) => ({ pile: aurumCacheUnit(`${id}|pile`), bearing: 2 * Math.PI * aurumCacheUnit(`${id}|way`) });
