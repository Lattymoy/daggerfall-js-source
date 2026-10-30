// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): ANSWERS WORKED OUT ONCE AND KEPT.
// A warm launch still stalled 0.2-1.5 s on work whose inputs never change between launches. Each such answer is kept in
// the player's IndexedDB (dataSource.js DERIVED_STORE, swept with an ARENA2 re-pick) under a key that names its inputs:
// the computation's pin (tools/computationPin.mjs, generated into src/firstVisitPins.js by scripts/firstVisitPins.mjs,
// read through firstVisitPin) and a stamp over each input. A changed input or computation is a different key, so a stale
// answer is never read. Each key leads with its scope (`fv-<cache>:`); writing an answer sweeps the scope's other keys
// (`staleKey`). The store is injectable (roadsCache.js's law): a Map-backed fake in node. A store that cannot open or
// answer is a miss, never an error.

import { fnv1a } from '../../formats/fnv1a.js';
// GENERATED and gitignored (scripts/firstVisitPins.mjs: npm install, every build, each dev page load). Imported, never
// awaited: a top-level await makes every graph that imports this one async, and WebKit before Safari 27 resolves a
// second import() of such a graph before it has run (WebKit bug 242740) - the menu's warm-up and Play both import the
// world, so on an iPhone before iOS 27 bootWorld ran before its classes existed (WEBKIT-TLA; the build refuses one:
// scripts/noTopLevelAwait.mjs). A new worktree writes the pins first: `node scripts/firstVisitPins.mjs`.
import { FIRST_VISIT_PINS } from '../../firstVisitPins.js';

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
  if (typeof pin !== 'string' || !/^[0-9a-f]{8}$/.test(pin))
    throw new Error(
      `FIRST-VISIT: no pin for ${cache} - run scripts/firstVisitPins.mjs (npm install and npm run build do)`,
    );
  return pin;
}

/** The player's DERIVED_STORE through dataSource.js, or null where there is no IndexedDB (node). */
export function derivedValueStore() {
  if (!globalThis.indexedDB) return null;
  const door = import('../../scenes/dataSource.js');
  return {
    async get(key) {
      try {
        return await (await door).loadDerivedValue(key);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        return await (await door).storeDerivedValue(key, value);
      } catch {
        return null;
      }
    },
    async sweep(scope, keep) {
      try {
        return await (await door).sweepDerived((k) => staleKey(k, scope, keep));
      } catch {
        return null;
      }
    },
  };
}

/** Whether a stored key is a stale answer of the cache scope `scope` once `keep` is written: of the scope, and not it. */
export const staleKey = (key, scope, keep) => typeof key === 'string' && key.startsWith(scope) && key !== keep;

/** Write an answer and sweep its scope's older keys. A store without a sweep (a test's) only writes. Answers whether
 *  the write landed. */
export async function keepAnswer(store, key, value, scope) {
  // the player's store answers null for a refused write (a full quota) - the older answer is then the only one there is
  // and stays, to serve the launch it still fits
  const written = await store.set(key, value);
  if (!written) return false;
  await store.sweep?.(scope, key);
  return true;
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
