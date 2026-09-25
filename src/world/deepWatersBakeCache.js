// ═══════════════════════════════════════════════════════════════════
// DW-A: THE COASTLINE IS BUILT ONCE PER ARCHIVE, NOT ONCE PER BOOT.
// deepWatersBake.js's global half - the bound over half a million
// pixels, the coastal pixels sampled, the flood - is seconds of work
// whose answer is the same every time its inputs are, so it is kept in
// IndexedDB under the roads' law (roadsCache.js, ROADS 19):
//
//   - BAKE_GENERATOR_VERSION, bumped by hand whenever the rules change
//     shape (a threshold, the tie, the flood's seeds, the heights the
//     baker reads).
//   - an FNV-1a hash of the WOODS.WLD bytes the worker reads - AFTER the
//     boot's SmoothLocationNeighbourhood has been synced into them
//     (woodsFile.syncHeightMapBytes), so the repair is in the key (the
//     roads cache keyed on the length alone and AUDIT 58 F4 had to bump
//     by hand for exactly that).
//   - the location rects the build blends, fingerprinted - MAPS.BSA and
//     BLOCKS.BSA as far as the coastline is concerned.
//
// A store that cannot open is a miss, never an error; node has none.
// ═══════════════════════════════════════════════════════════════════

import { idbStore } from './roadsCache.js';

/** Bump when the bake's rules change shape. */
export const BAKE_GENERATOR_VERSION = 1;

/** FNV-1a 32 over bytes - the key's fingerprint, not a checksum anything trusts beyond "same archive". */
export function fnv1a(bytes, h = 0x811c9dc5) {
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** The rects' fingerprint: [pixelId, xMin, xMax, yMin, yMax] rows in pixel order. */
export function rectsFingerprint(rows) {
  let h = 0x811c9dc5;
  for (const r of [...rows].sort((a, b) => a[0] - b[0])) {
    for (const v of r) { h ^= v & 0xff; h = Math.imul(h, 0x01000193); h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193); h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193); }
  }
  return h >>> 0;
}

/** The rows as the bake reads them: (px, py) -> {xMin, xMax, yMin, yMax} or null. */
export function rectsLookup(rows) {
  const m = new Map();
  for (const r of rows) m.set(r[0], { xMin: r[1], xMax: r[2], yMin: r[3], yMax: r[4] });
  return (px, py) => m.get(py * 1000 + px) ?? null;
}

export function bakeCacheKey({ woodsHash, rectsHash }) {
  return `dwbake:v${BAKE_GENERATOR_VERSION}:${woodsHash >>> 0}:${rectsHash >>> 0}`;
}

/** The default store: IndexedDB's, in its own database. */
export const bakeStore = (indexedDBRef = globalThis.indexedDB) => idbStore(indexedDBRef, { db: 'daggerfall-deepwaters', store: 'bakes' });

/**
 * Build-through: a hit returns the stored record; a miss builds, stores,
 * returns. The record is buildGlobal's (typed arrays clone as they are).
 */
export async function cachedBake({ key, build, store = bakeStore() }) {
  if (store) {
    const hit = await store.get(key);
    if (hit && hit.state && hit.classes && hit.partialIndex && hit.partialBits) return { ...hit, cached: true };
  }
  const g = build();
  if (g && store) await store.set(key, { state: g.state, classes: g.classes, partialIndex: g.partialIndex, partialBits: g.partialBits, stats: g.stats });
  return g ? { ...g, cached: false } : null;
}
