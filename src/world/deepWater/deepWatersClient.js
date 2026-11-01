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

import {
  buildGlobalSteps,
  classifyPixel,
  PIXEL_MIXED,
  PIXEL_LAND,
  DeepWatersBake,
  bakeMeetsAt,
} from './deepWatersBake.js';
import { bakeCacheKey, bakeStore, cachedBake, fnv1a, rectsFingerprint, rectsLookup } from './deepWatersBakeCache.js';
import { locationRectReader } from '../terrain/terrainTiles.js'; // BOOT-RECTS: the walk's blocks parsed once
import { buildDeepWatersPixel } from './deepWatersPixel.js';
import { worldBakes } from '../etherWatersBake.js'; // ETHER-DEEP: the Eltheric Ocean's bake beside the Bay's
import { etherWoods } from '../ethericSea.js';
import { TamrielWatersBake } from '../tamrielWatersBake.js'; // TAMRIEL-DEEP: the continent's bake, set when its trace lands
import { groundWoods } from '../tamriel/tamrielGround.js';
import { gen2Shipped } from '../gen2/gen2Ground.js'; // The published regions, posted with the trace

function defaultWorkerFactory() {
  return new Worker(new URL('./deepWatersWorker.js', import.meta.url), { type: 'module' });
}

/**
 * SetLocationTiles' rect for every classic location whose pixel the bound cannot settle - the only pixels whose blend can
 * move the coastline - and ACROSS-EDGE each town `meets` names (townMeetsHost.js meetsTown) by water, a 1 seventh.
 * @param {object} woods - the boot-smoothed reader. @param {Iterable<[number, number, object]>} locations - [px, py, dfLocation].
 * @param {object} maps @param {object} blocks @param {(loc: any) => boolean} [meets]
 * @returns {Array<any[]>} [pixelId, xMin, xMax, yMin, yMax] rows - and the rect's outline (its `shape`, 128 x 128) sixth
 *   where it carries one (AUDIT TESA III E1-4).
 */
export function deepWatersLocationRects(woods, locations, maps, blocks, meets = () => false) {
  const rows = [];
  const rectOf = locationRectReader(maps, blocks);
  /** ACROSS-EDGE: whether a town's 3 x 3 holds a pixel that may be water - its meet may raise it */
  const nearWater = (px, py) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (classifyPixel(woods, px + dx, py + dy) !== PIXEL_LAND) return true;
    return false;
  };
  for (const [px, py, loc] of locations) {
    if (!loc || loc.spawned) continue; // SPAWNED-DUNGEONS1 clones are the port's, not the baker's
    const met = meets(loc);
    if (classifyPixel(woods, px, py) !== PIXEL_MIXED && !(met && nearWater(px, py))) continue;
    const r = rectOf(loc);
    // AUDIT TESA III E1-4: and the town's outline (TOWN-SHAPES TS2, terrainTiles.js locationShapeField), which the streamed
    // build's blend follows - the bake read the rect alone and blended it DFU's way, land where TS2 keeps a shore town's sea
    rows.push([py * 1000 + px, r.xMin, r.xMax, r.yMin, r.yMax, ...(r.shape ? [r.shape, ...(met ? [1] : [])] : [])]);
  }
  return rows;
}

/** ETHER-DEEP: the ground the Eltheric's bake reads - the world's composed reader, or the sea composed over a bare one. */
const etherGround = (woods) => (woods?.isEtherGround ? woods : etherWoods(woods));

/** Same-thread build, sliced: at most `sliceMs` of work between yields to the event loop. */
async function buildHere(woods, rows, { store = bakeStore(), sliceMs = 8, woodsBytes = null } = {}) {
  const key = bakeCacheKey({ woodsHash: woodsBytes ? fnv1a(woodsBytes) : 0, rectsHash: rectsFingerprint(rows) });
  const locationRectAt = rectsLookup(rows),
    meetsAt = bakeMeetsAt(woods, locationRectAt); // ACROSS-EDGE: one read of each town's meet
  let result = null;
  if (store) {
    const hit = await store.get(key);
    if (hit && hit.state && hit.classes && hit.partialIndex && hit.partialBits) return { ...hit, cached: true };
  }
  const steps = buildGlobalSteps(woods, { locationRectAt, meetsAt });
  for (;;) {
    const t0 = globalThis.performance?.now?.() ?? Date.now();
    let r;
    do {
      r = steps.next();
    } while (!r.done && (globalThis.performance?.now?.() ?? Date.now()) - t0 < sliceMs);
    if (r.done) {
      result = r.value;
      break;
    }
    await new Promise((res) => setTimeout(res, 0));
  }
  // through the cache's own door, so a store that fails stays a miss rather than an error
  return cachedBake({ key, build: () => result, store });
}

/**
 * Open Deep Waters for one world: the bake starts building at once.
 * @param {object} deps
 * @param {object} deps.woods - the main thread's boot-smoothed WoodsFile.
 * @param {?object|boolean} [deps.ether] - ETHER-DEEP: the Eltheric Ocean stands - its places' rects (etherWatersBake.js
 *   etherPlaceRects), or true for none known; its bake is built beside the Bay's on both threads.
 * @param {boolean} [deps.continent] - TAMRIEL-DEEP: the land past the Bay streams - room for its bake beside the Bay's
 *   (setTamriel sets it on both threads when the trace lands).
 * @param {?Uint8Array} deps.woodsBytes - its raw bytes, synced (a COPY crosses).
 * @param {Array<number[]>} deps.rects - deepWatersLocationRects' rows.
 * @param {?Function} [deps.workerFactory] - test seam; null forces the same-thread path.
 * @param {?object} [deps.store] - the same-thread path's cache (default IndexedDB).
 * @returns {{ready: Promise<?DeepWatersBake>, buildPixel: (job: object, centre?: number[]) => Promise<?object>, setTamriel: (o: { trace: any, fit: any }) => void, dispose: () => void, readonly onWorker: boolean}}
 */
export function openDeepWaters({
  woods,
  woodsBytes = null,
  rects = [],
  ether = null,
  continent = false,
  workerFactory = undefined,
  store = undefined,
} = {}) {
  if (!woods)
    return {
      ready: Promise.resolve(null),
      buildPixel: async () => null,
      setTamriel() {},
      dispose() {},
      get onWorker() {
        return false;
      },
    };
  const factory =
    workerFactory === undefined
      ? typeof Worker === 'undefined' || !woodsBytes
        ? null
        : defaultWorkerFactory
      : workerFactory;
  let worker = null;
  let bake = null;
  let disposed = false;
  let warned = false;
  const pending = new Map(); // id -> {resolve, job}
  let nextId = 1;

  const here = (job) => {
    if (!bake || disposed) return null;
    try {
      return buildDeepWatersPixel(job, bake);
    } catch (e) {
      if (!warned) {
        warned = true;
        console.warn(`[deep waters] pixel ${job?.px},${job?.py} failed to promote: ${e?.message ?? e}`);
      }
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
    try {
      w?.terminate?.();
    } catch {
      /* gone */
    }
    for (const [id, p] of pending) {
      pending.delete(id);
      p.resolve(adopt(here(p.job)));
    }
  };

  const ready = (async () => {
    let record = null;
    if (factory) {
      record = await new Promise((resolve) => {
        try {
          worker = factory();
          worker.onerror = () => {
            resolve(null);
            dropWorker();
          };
          worker.onmessage = (ev) => {
            const m = ev.data ?? {};
            if (m.t === 'built') resolve(m.record);
            else if (m.t === 'error') {
              resolve(null);
              dropWorker();
            } else if (m.t === 'pixel') {
              const p = pending.get(m.id);
              if (!p) return;
              pending.delete(m.id);
              p.resolve(adopt(m.error || !m.result ? here(p.job) : m.result));
            }
          };
          const bytes = woodsBytes.slice();
          worker.postMessage({ t: 'build', woodsBytes: bytes, rects, ether, continent }, [bytes.buffer]);
        } catch (e) {
          console.warn('[deep waters] worker unavailable; building on the main thread', e);
          resolve(null);
          dropWorker();
        }
      });
    }
    if (!record && !disposed)
      record = await buildHere(woods, rects, { woodsBytes, ...(store !== undefined ? { store } : {}) });
    if (!record || disposed) return null;
    bake = worldBakes(new DeepWatersBake({ woods, global: record, locationRectAt: rectsLookup(rects) }), {
      woods: ether ? etherGround(woods) : woods,
      ether,
      continent,
    });
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
    /** TAMRIEL-DEEP: the continent's trace and fit landed (or went: trace null) - its bake set on this thread (the trace and
     *  the fit already this thread's modules') and on the worker, which installs its own copies first. */
    setTamriel({ trace, fit }) {
      if (!continent || disposed) return;
      if (worker) {
        const t = trace
          ? {
              w: trace.w,
              h: trace.h,
              land: trace.land.slice(),
              province: trace.province.slice(),
              relief: trace.relief ? trace.relief.slice() : null,
            }
          : null;
        try {
          worker.postMessage({
            t: 'tamriel',
            trace: t,
            fit: fit ? { ox: fit.ox, oy: fit.oy, ppu: fit.ppu } : null,
            wg2: gen2Shipped(),
          });
        } catch {
          /* the main thread's bake answers */
        } // The published regions
      }
      void ready.then((b) => {
        if (b && !disposed)
          b.setTamriel?.(
            trace
              ? new TamrielWatersBake({ woods: woods.isTamrielGround ? woods : groundWoods(woods), bay: b.bay })
              : null,
          );
      });
    },
    dispose() {
      disposed = true;
      const w = worker;
      worker = null;
      try {
        w?.terminate?.();
      } catch {
        /* gone */
      }
      for (const [id, p] of pending) {
        pending.delete(id);
        p.resolve(null);
      }
    },
    get onWorker() {
      return !!worker;
    },
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
