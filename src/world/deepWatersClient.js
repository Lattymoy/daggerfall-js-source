// ═══════════════════════════════════════════════════════════════════
// DW-A / DW-B — THE DEEP WATERS CLIENT. The host's one door to Iliac
// Puddle No More's heavy work: the location rects read here (MAPS.BSA +
// BLOCKS.BSA live on this thread), the bake built on the Deep Waters
// worker (deepWatersWorker.js) through the IndexedDB cache, and then every
// streamed pixel's promote answered there too (deepWatersPixel.js). This
// thread keeps a DeepWatersBake of its own over the same record for the
// runtime's small queries, and takes each pixel's warmed planes into it as
// the answers come back, so a query about a streamed pixel costs nothing.
//
// The terrain client's laws, recovered (terrainGenClient.js, EV7):
//  - `new Worker(new URL(...))` stays in exactly that spelling for Vite;
//    the factory is injectable so node never evaluates `new Worker`.
//  - the WOODS bytes are COPIED, never transferred.
//  - THE FALLBACK IS THE SAME WORK, NOT A FAILURE: no Worker, a factory
//    that throws, a worker that errors or dies - the bake is built on this
//    thread, sliced by buildGlobalSteps so a frame is never held for more
//    than a slice, and a pixel is promoted here by the same function the
//    worker runs; a job the dead worker still owed is answered here too.
// ═══════════════════════════════════════════════════════════════════

import { buildGlobalSteps, classifyPixel, PIXEL_MIXED, DeepWatersBake } from './deepWatersBake.js';
import { bakeCacheKey, bakeStore, cachedBake, fnv1a, rectsFingerprint, rectsLookup } from './deepWatersBakeCache.js';
import { setLocationTiles } from './terrainTiles.js';
import { buildDeepWatersPixel } from './deepWatersPixel.js';

function defaultWorkerFactory() {
  return new Worker(new URL('./deepWatersWorker.js', import.meta.url), { type: 'module' });
}

/**
 * SetLocationTiles' rect for every classic location whose pixel the bound
 * cannot settle - the only pixels whose blend can move the coastline.
 * @param {object} woods - the boot-smoothed reader.
 * @param {Iterable<[number, number, object]>} locations - [px, py, dfLocation].
 * @returns {Array<number[]>} [pixelId, xMin, xMax, yMin, yMax] rows.
 */
export function deepWatersLocationRects(woods, locations, maps, blocks) {
  const rows = [];
  const scratch = new Uint8Array(128 * 128);
  for (const [px, py, loc] of locations) {
    if (!loc || loc.spawned) continue;   // SPAWNED-DUNGEONS1 clones are the port's, not the baker's
    if (classifyPixel(woods, px, py) !== PIXEL_MIXED) continue;
    scratch.fill(0);
    const r = setLocationTiles(loc, maps, blocks, scratch);
    rows.push([py * 1000 + px, r.xMin, r.xMax, r.yMin, r.yMax]);
  }
  return rows;
}

/** Same-thread build, sliced: at most `sliceMs` of work between yields to the event loop. */
async function buildHere(woods, rows, { store = bakeStore(), sliceMs = 8, woodsBytes = null } = {}) {
  const key = bakeCacheKey({ woodsHash: woodsBytes ? fnv1a(woodsBytes) : 0, rectsHash: rectsFingerprint(rows) });
  const locationRectAt = rectsLookup(rows);
  let result = null;
  if (store) {
    const hit = await store.get(key);
    if (hit && hit.state && hit.classes && hit.partialIndex && hit.partialBits) return { ...hit, cached: true };
  }
  const steps = buildGlobalSteps(woods, { locationRectAt });
  for (;;) {
    const t0 = globalThis.performance?.now?.() ?? Date.now();
    let r;
    do { r = steps.next(); } while (!r.done && (globalThis.performance?.now?.() ?? Date.now()) - t0 < sliceMs);
    if (r.done) { result = r.value; break; }
    await new Promise((res) => setTimeout(res, 0));
  }
  // through the cache's own door, so a store that fails stays a miss rather than an error
  return cachedBake({ key, build: () => result, store });
}

/**
 * Open Deep Waters for one world: the bake starts building at once.
 * @param {object} deps
 * @param {object} deps.woods - the main thread's boot-smoothed WoodsFile.
 * @param {?Uint8Array} deps.woodsBytes - its raw bytes, synced (a COPY crosses).
 * @param {Array<number[]>} deps.rects - deepWatersLocationRects' rows.
 * @param {?Function} [deps.workerFactory] - test seam; null forces the same-thread path.
 * @param {?object} [deps.store] - the same-thread path's cache (default IndexedDB).
 * @returns {{ready: Promise<?DeepWatersBake>, buildPixel: (job: object, centre?: number[]) => Promise<?object>, dispose: () => void, readonly onWorker: boolean}}
 */
export function openDeepWaters({ woods, woodsBytes = null, rects = [], workerFactory = undefined, store = undefined } = {}) {
  if (!woods) return { ready: Promise.resolve(null), buildPixel: async () => null, dispose() {}, get onWorker() { return false; } };
  const factory = workerFactory === undefined
    ? ((typeof Worker === 'undefined' || !woodsBytes) ? null : defaultWorkerFactory)
    : workerFactory;
  let worker = null;
  let bake = null;
  let disposed = false;
  let warned = false;
  const pending = new Map();   // id -> {resolve, job}
  let nextId = 1;

  const here = (job) => {
    if (!bake || disposed) return null;
    try {
      return buildDeepWatersPixel(job, bake);
    } catch (e) {
      if (!warned) { warned = true; console.warn(`[deep waters] pixel ${job?.px},${job?.py} failed to promote: ${e?.message ?? e}`); }
      return null;
    }
  };
  const adopt = (result) => {
    if (result && bake) bake.adoptPlanes(result.planes);
    return result;
  };
  const dropWorker = () => {
    const w = worker;
    worker = null;
    try { w?.terminate?.(); } catch { /* gone */ }
    for (const [id, p] of pending) { pending.delete(id); p.resolve(adopt(here(p.job))); }
  };

  const ready = (async () => {
    let record = null;
    if (factory) {
      record = await new Promise((resolve) => {
        try {
          worker = factory();
          worker.onerror = () => { resolve(null); dropWorker(); };
          worker.onmessage = (ev) => {
            const m = ev.data ?? {};
            if (m.t === 'built') resolve(m.record);
            else if (m.t === 'error') { resolve(null); dropWorker(); }
            else if (m.t === 'pixel') {
              const p = pending.get(m.id);
              if (!p) return;
              pending.delete(m.id);
              p.resolve(adopt(m.error || !m.result ? here(p.job) : m.result));
            }
          };
          const bytes = woodsBytes.slice();
          worker.postMessage({ t: 'build', woodsBytes: bytes, rects }, [bytes.buffer]);
        } catch (e) {
          console.warn('[deep waters] worker unavailable; building on the main thread', e);
          resolve(null);
          dropWorker();
        }
      });
    }
    if (!record && !disposed) record = await buildHere(woods, rects, { woodsBytes, ...(store !== undefined ? { store } : {}) });
    if (!record || disposed) return null;
    bake = new DeepWatersBake({ woods, global: record, locationRectAt: rectsLookup(rects) });
    return bake;
  })();

  return {
    ready,
    /** One pixel's promote: the worker's answer, or this thread's; null once disposed or with no bake. */
    buildPixel(job, centre = null) {
      return ready.then((b) => {
        if (!b || disposed) return null;
        if (!worker) return adopt(here(job));
        return new Promise((resolve) => {
          const id = nextId++;
          pending.set(id, { resolve, job });
          try {
            worker.postMessage({ t: 'pixel', id, job, centre });
          } catch {
            pending.delete(id);
            resolve(adopt(here(job)));
          }
        });
      });
    },
    dispose() {
      disposed = true;
      const w = worker;
      worker = null;
      try { w?.terminate?.(); } catch { /* gone */ }
      for (const [id, p] of pending) { pending.delete(id); p.resolve(null); }
    },
    get onWorker() { return !!worker; },
  };
}

/**
 * Load the bake alone: the worker when one can run, this thread (sliced)
 * when not, the worker dropped once it answers. Always resolves - to a
 * DeepWatersBake, or null when WOODS is missing.
 */
export async function loadDeepWatersBake(deps = {}) {
  const dw = openDeepWaters(deps);
  const bake = await dw.ready;
  dw.dispose();
  return bake;
}
