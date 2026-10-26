// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): ANSWERS WORKED OUT ONCE AND KEPT.
//
// A warm launch in Daggerfall city still stalled for 0.2-1.5 s at a time on work whose inputs never change between
// launches: the boot's location walks reading hundreds of world-data blocks, the ship models baked from their prefabs,
// the Bay fitted to the Tamriel picture. Each such answer is kept in the player's own IndexedDB (dataSource.js
// DERIVED_STORE, swept with an ARENA2 re-pick) under a key that names everything it was worked out from: its
// computation's version and a stamp over each input. A different input is a different key, so a stale answer is never
// read - it is worked out again and kept under its own key.
//
// REFRESH ON UPDATE (the owner, 2026-10-26: "make sure any of our changes relating to caching do not prevent anything
// from refreshing properly ... scoped to only the things that have changed"). A cache's version is no hand-bumped number
// and not the build's tag: it is the pin of its computation's own source (tools/computationPin.mjs), GENERATED - written
// into src/firstVisitPins.js at install and at build (scripts/firstVisitPins.mjs) and served live by the dev server
// (scripts/firstVisitPins.mjs firstVisitPinsPlugin) - and read through firstVisitPin. An update that changes the computation changes
// the key, and one that does not keeps every player's kept answer. Each key leads with its cache's scope (`fv-<cache>:` and, where a cache
// keeps several answers, the one it is), and writing an answer sweeps every other key of that scope (`staleKey`), so the
// store holds one answer a scope, never one an update.
//
// The store is injectable (roadsCache.js's law): a Map-backed fake in node, where there is no IndexedDB. A store that
// cannot open or answer is a miss, never an error.

import { fnv1a } from '../../formats/fnv1a.js';
import { FIRST_VISIT_PINS } from '../../firstVisitPins.js';   // GENERATED (scripts/firstVisitPins.mjs) - gitignored

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

/** A kept answer's version: its computation's generated pin. Throws - never a key on undefined - when the pins were not
 *  generated for this cache (a build that skipped scripts/firstVisitPins.mjs, or a cache added without its computation in
 *  tools/computationPin.mjs FIRST_VISIT_COMPUTATIONS). @param {string} cache */
export function firstVisitPin(cache, pins = FIRST_VISIT_PINS) {
  const pin = pins?.[cache];
  if (typeof pin !== 'string' || !/^[0-9a-f]{8}$/.test(pin)) throw new Error(`FIRST-VISIT: no pin for ${cache} - run scripts/firstVisitPins.mjs (npm install and npm run build do)`);
  return pin;
}

/** The player's DERIVED_STORE through dataSource.js, or null where there is no IndexedDB (node). */
export function derivedValueStore() {
  if (!globalThis.indexedDB) return null;
  const door = import('../../scenes/dataSource.js');
  return {
    async get(key) { try { return await (await door).loadDerivedValue(key); } catch { return null; } },
    async set(key, value) { try { return await (await door).storeDerivedValue(key, value); } catch { return null; } },
    async sweep(scope, keep) { try { return await (await door).sweepDerived((k) => staleKey(k, scope, keep)); } catch { return null; } },
  };
}

/** Whether a stored key is a stale answer of the cache scope `scope` once `keep` is written: of the scope, and not it. */
export const staleKey = (key, scope, keep) => typeof key === 'string' && key.startsWith(scope) && key !== keep;

/** Write an answer and sweep its scope's older keys. A store without a sweep (a test's) only writes. */
export async function keepAnswer(store, key, value, scope) {
  await store.set(key, value);
  await store.sweep?.(scope, key);
}

/**
 * Build-through: the stored answer under `key` when `accept` takes it, else `build()`'s, kept when `accept` takes it.
 * `build` may be async. Answers `{ value, cached }`; `value` is null only when `build` answered null.
 * @template T
 * `scope`: the key prefix whose other keys the written answer makes stale (keepAnswer).
 * @param {{ key: string, scope: string, build: () => T | Promise<T>, accept?: (v: any) => boolean, store?: { get(k: string): Promise<any>, set(k: string, v: any): Promise<any>, sweep?(scope: string, keep: string): Promise<any> } | null }} o
 * @returns {Promise<{ value: T | null, cached: boolean }>}
 */
export async function keptAnswer({ key, scope, build, accept = (v) => v != null, store = derivedValueStore() }) {
  if (store) {
    const hit = await store.get(key);
    if (hit != null && accept(hit)) return { value: hit, cached: true };
  }
  const value = await build();
  if (value != null && store && accept(value)) await keepAnswer(store, key, value, scope);
  return { value: value ?? null, cached: false };
}
