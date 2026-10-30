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

import { idbStore } from '../roadsCache.js';
import { fnv1a } from '../../formats/fnv1a.js';

/** Bump when the bake's rules change shape. 2 (AUDIT TESA III E1-4): a coastal town's blend follows its outline (TOWN-SHAPES
 *  TS2) - a bake kept before it blended the rect DFU's way. 3 (FB1028): the sea a town's ease reaches is lifted. 4 (AUDIT FB1028 A2-A3): the ease meets its seam from the stood
 *  samples and keeps the land's order. 5 (FB1029 ACROSS-EDGE): the ground about a town rises to meet it (deepWatersBake.js bakeMeetsAt). */
export const BAKE_GENERATOR_VERSION = 5;

export { fnv1a }; // FIRST-VISIT: moved to formats/fnv1a.js, shared with the first visit's kept answers

/** The rects' fingerprint: [pixelId, xMin, xMax, yMin, yMax] rows in pixel order - AUDIT TESA III E1-4: and a row's
 *  outline's bytes, where it carries one. */
export function rectsFingerprint(rows) {
  let h = 0x811c9dc5;
  for (const r of [...rows].sort((a, b) => a[0] - b[0])) {
    for (let k = 0; k < 5; k++) {
      const v = r[k];
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 8) & 0xff;
      h = Math.imul(h, 0x01000193);
      h ^= (v >>> 16) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
    if (r[5]) h = fnv1a(r[5], h);
    if (r[6]) {
      h ^= 0x6d;
      h = Math.imul(h, 0x01000193);
    } // ACROSS-EDGE: a town the meets read
  }
  return h >>> 0;
}

/** The rows as the bake reads them: (px, py) -> {xMin, xMax, yMin, yMax} or null - AUDIT TESA III E1-4: with its `shape`
 *  where the row carries one, so the bake's blend (deepWatersBake.js pixelWaterSampler) is the streamed build's. */
export function rectsLookup(rows) {
  const m = new Map();
  for (const r of rows)
    m.set(r[0], {
      xMin: r[1],
      xMax: r[2],
      yMin: r[3],
      yMax: r[4],
      ...(r[5] ? { shape: r[5] } : {}),
      ...(r[6] ? { meets: true } : {}),
    });
  return (px, py) => m.get(py * 1000 + px) ?? null;
}

export function bakeCacheKey({ woodsHash, rectsHash }) {
  return `dwbake:v${BAKE_GENERATOR_VERSION}:${woodsHash >>> 0}:${rectsHash >>> 0}`;
}

/** The default store: IndexedDB's, in its own database. */
export const bakeStore = (indexedDBRef = globalThis.indexedDB) =>
  idbStore(indexedDBRef, { db: 'daggerfall-deepwaters', store: 'bakes' });

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
  if (g && store)
    await store.set(key, {
      state: g.state,
      classes: g.classes,
      partialIndex: g.partialIndex,
      partialBits: g.partialBits,
      stats: g.stats,
    });
  return g ? { ...g, cached: false } : null;
}
