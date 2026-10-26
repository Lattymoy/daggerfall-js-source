// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): ANSWERS WORKED OUT ONCE AND KEPT.
//
// A warm launch in Daggerfall city still stalled for 0.2-1.5 s at a time on work whose inputs never change between
// launches: the boot's location walks reading hundreds of world-data blocks, the ship models baked from their prefabs,
// the Bay fitted to the Tamriel picture. Each such answer is kept in the player's own IndexedDB (dataSource.js
// DERIVED_STORE, swept with an ARENA2 re-pick) under a key that names everything it was worked out from: a hand
// version, bumped when the producer changes shape, and a stamp over each input. A different input is a different
// key, so a stale answer is never read - it is worked out again and kept under its own key.
//
// The store is injectable (roadsCache.js's law): a Map-backed fake in node, where there is no IndexedDB. A store that
// cannot open or answer is a miss, never an error.

import { fnv1a } from '../../formats/fnv1a.js';

export { fnv1a };

const SAMPLE = 64 * 1024;

/** An archive's stamp: its length and FNV-1a over its first and last 64 KB (dataSource.js sampleStamp's sample - a
 *  full hash of BLOCKS.BSA would cost a share of what the cache saves). Null for no bytes. */
export function bytesStamp(bytes) {
  if (!bytes?.length) return null;
  const head = bytes.subarray(0, SAMPLE);
  const tail = bytes.length > SAMPLE ? bytes.subarray(Math.max(SAMPLE, bytes.length - SAMPLE)) : bytes.subarray(0, 0);
  return `${bytes.length.toString(36)}.${fnv1a(tail, fnv1a(head)).toString(36)}`;
}

/** A stamp over text parts (the answer's other inputs, in a fixed order). */
export function textStamp(...parts) {
  return fnv1a(new TextEncoder().encode(parts.map((p) => String(p ?? '')).join('\u0001'))).toString(36);
}

/** The player's DERIVED_STORE through dataSource.js, or null where there is no IndexedDB (node). */
export function derivedValueStore() {
  if (!globalThis.indexedDB) return null;
  const door = import('../../scenes/dataSource.js');
  return {
    async get(key) { try { return await (await door).loadDerivedValue(key); } catch { return null; } },
    async set(key, value) { try { return await (await door).storeDerivedValue(key, value); } catch { return null; } },
  };
}

/**
 * Build-through: the stored answer under `key` when `accept` takes it, else `build()`'s, kept when `accept` takes it.
 * `build` may be async. Answers `{ value, cached }`; `value` is null only when `build` answered null.
 * @template T
 * @param {{ key: string, build: () => T | Promise<T>, accept?: (v: any) => boolean, store?: { get(k: string): Promise<any>, set(k: string, v: any): Promise<any> } | null }} o
 * @returns {Promise<{ value: T | null, cached: boolean }>}
 */
export async function keptAnswer({ key, build, accept = (v) => v != null, store = derivedValueStore() }) {
  if (store) {
    const hit = await store.get(key);
    if (hit != null && accept(hit)) return { value: hit, cached: true };
  }
  const value = await build();
  if (value != null && store && accept(value)) await store.set(key, value);
  return { value: value ?? null, cached: false };
}
