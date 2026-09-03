// ROADS 19: THE NETWORK IS BUILT ONCE PER MAP, NOT ONCE PER BOOT.
//
// Audit 49 measured the real-map build at 4.4 seconds after the island
// skip - 8,600 routes at half a millisecond - and every one of them ran
// before the first terrain chunk could generate, on every boot, for a
// result that is the same every time the inputs are. So the result is
// kept, in IndexedDB, keyed on everything that shapes it:
//
//   - GENERATOR_VERSION, bumped by hand whenever the generator's logic
//     changes shape (a new rule, a changed default). The dials ride the
//     key separately, so turning one invalidates without a bump.
//   - the dials, serialised.
//   - the settlement list's fingerprint: its length and a sum over its
//     pixels and types - which is MAPS.BSA's content, as far as roads
//     are concerned. A different archive is a different key.
//   - the heightmap's length, which is WOODS.WLD's. The length STANDS IN
//     for the height CONTENT, and AUDIT 54 F4 broke that stand-in: the
//     boot repair SmoothLocationNeighbourhood rewrites those bytes in
//     place (scenes/world.js runs it, then syncHeightMapBytes) at a byte
//     length it cannot change, and the ours-network bake routes and
//     water-tests over exactly those heights (roadsProducer's heightAt /
//     isWater). So a change to the boot repair - its introduction
//     included - is a generator-shape change and takes the hand bump.
//
// The store is injectable so the law can be pinned in node, where there
// is no IndexedDB: same inputs hit, any change misses, a version bump
// misses. The IndexedDB store is the default in a browser or a worker
// and silently absent anywhere else - a cache that cannot open is a
// cache miss, never an error.

import { ROAD_DIALS } from './roadNetwork.js';

/** Bump when the generator changes shape. The dials are in the key on
 *  their own, so a tuned number does not need this.
 *  19 -> 20, AUDIT 54 F4: the location smoothing rewrote the heightmap
 *  content the bake reads, and no other key term can see it. */
export const GENERATOR_VERSION = 20;

const DB = 'daggerfall-roads', STORE = 'networks';

export function roadsCacheKey({ settlements, woodsLength, dials = {} }) {
  let sum = 0;
  for (const s of settlements) sum = (sum + s.x * 31 + s.y * 17 + (s.type | 0) * 7) >>> 0;
  const d = { ...ROAD_DIALS, ...dials };
  return `roads:v${GENERATOR_VERSION}:${settlements.length}:${sum}:${woodsLength}:${JSON.stringify(d)}`;
}

/** The IndexedDB store. Every method answers null on any failure. */
export function idbStore(indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef) return null;
  const open = () => new Promise((resolve) => {
    try {
      const req = indexedDBRef.open(DB, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch { /* exists */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  const tx = (db, mode, fn) => new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return {
    async get(key) { const db = await open(); if (!db) return null; const v = await tx(db, 'readonly', (s) => s.get(key)); db.close(); return v; },
    async set(key, value) { const db = await open(); if (!db) return null; const v = await tx(db, 'readwrite', (s) => s.put(value, key)); db.close(); return v; },
  };
}

/** Build-through cache: hit returns the stored arrays; miss builds,
 *  stores, returns. `build` is the producer; `store` defaults to
 *  IndexedDB and may be null (no cache, always build). */
export async function cachedNetwork({ key, build, store = idbStore() }) {
  if (store) {
    const hit = await store.get(key);
    if (hit && hit.roads && hit.tracks) return { ...hit, cached: true };
  }
  const net = build();
  if (net && store) await store.set(key, { roads: net.roads, tracks: net.tracks, stats: net.stats });
  return net ? { ...net, cached: false } : null;
}
