// ═══════════════════════════════════════════════════════════════════
// RA1 — THE BAKE, OFF THE MAIN THREAD (2026-08-28, Mac's audit call:
// "it gets stuck on baking roads when starting a game").
//
// R6 ran bakeRoads SYNCHRONOUSLY inside the world host's boot, and R7
// then turned roads ON BY DEFAULT - so every first boot parked the main
// thread for the whole bake (about half a minute at full scale on
// synthetic hills, and never measured on real WOODS relief), behind a
// status line that only writes document.title. A browser cannot paint
// a title, a canvas or anything else while one task holds the thread,
// so a HEALTHY bake was indistinguishable from a hang. That is the
// stall this module removes: the bake runs in a module Worker and the
// main thread stays free to paint every progress report.
//
// ── WHY THE COST FIELD IS BUILT HERE, NOT IN THE WORKER ──────────
//
// Two of the bake's inputs are FUNCTIONS - climateAt closes over a
// loaded MapsFile, isWater is ui/overworldModel's one-home water law -
// and functions do not cross postMessage. Rebuilding them worker-side
// would mean either shipping ARENA2 bytes across and re-parsing
// MAPS.BSA, or importing ui/ into a worker (overworldModel imports the
// travel-map window, which is a DOM module). So the ONE pass that
// consumes those functions - buildCostField, a single 500,000-pixel
// sweep, milliseconds against the routing's half minute - runs here on
// the main thread over the real injected laws, and what crosses the
// boundary is plain data: the finished cost plane, a COPY of the
// heights, and the location list. The worker then holds only pure
// modules (systems/roads.js, systems/roadBake.js), which is what makes
// it safe to build at all.
//
// heightBytes is COPIED, not transferred from the source: the woods
// reader's plane is the same buffer the streamed terrain samples for
// the rest of the session, and transferring it would detach it.
//
// ── THE FALLBACK IS THE OLD PATH, NOT A FAILURE ──────────────────
//
// No Worker (node, a test, an ancient host) or a worker that dies
// mid-bake falls back to the same-thread bakeRoads - every law lives
// in modules this thread already holds, so the fallback costs the
// stall and nothing else. Roads stay a decoration that never takes
// the game down (R6's own posture).
// ═══════════════════════════════════════════════════════════════════

import { buildCostField } from './roads.js';
import { bakeRoads } from './roadBake.js';

/**
 * Everything the worker needs, as plain transferable data. The cost
 * field is built HERE, over the real injected climateAt/isWater (see
 * header); the worker receives only typed arrays and plain objects.
 *
 * @param {object} inputs - bakeInputs(...)'s shape
 * @returns {{cost: Float32Array, minStep: number, width: number,
 *            height: number, heightBytes: Uint8Array, locations: object[]}}
 */
export function marshalBakeJob(inputs) {
  const { cost, width, height, minStep } = buildCostField(inputs);
  return {
    cost, minStep, width, height,
    // a COPY - transferring the reader's own plane would detach it
    heightBytes: inputs.heightBytes.slice(),
    locations: inputs.locations.map(({ x, y, locationType }) => ({ x, y, locationType })),
  };
}

/** The one place the worker URL is spelled. Split out so tests can
 *  inject a factory and node never evaluates `new Worker`. */
function defaultWorkerFactory() {
  return new Worker(new URL('./roadBakeWorker.js', import.meta.url), { type: 'module' });
}

/**
 * bakeRoads' answer, produced off this thread. Resolves `{bytes,
 * stats}` (the worker serializes its own network - one flat buffer
 * crosses back); the sync fallback resolves `{network, stats}`. Both
 * shapes are what roadBake.loadOrBakeRoadsAsync accepts.
 *
 * @param {object} inputs - bakeInputs(...)'s shape
 * @param {(p:{phase:string,done:number,total:number})=>void} [onProgress]
 * @param {{workerFactory?: Function}} [o] - test seam
 */
export async function bakeRoadsOffThread(inputs, onProgress = null, { workerFactory = null } = {}) {
  const factory = workerFactory
    ?? (typeof Worker === 'undefined' ? null : defaultWorkerFactory);
  if (!factory) return bakeRoads({ ...inputs, onProgress });

  try {
    const job = marshalBakeJob(inputs);
    return await new Promise((resolve, reject) => {
      const w = factory();
      const settle = (fn, v) => { try { w.terminate?.(); } catch { /* already gone */ } fn(v); };
      w.onerror = (e) => settle(reject, new Error(e?.message ?? 'road bake worker failed'));
      w.onmessage = (ev) => {
        const m = ev.data ?? {};
        if (m.t === 'progress') { onProgress?.({ phase: m.phase, done: m.done, total: m.total }); return; }
        if (m.t === 'error') { settle(reject, new Error(m.message)); return; }
        if (m.t === 'done') settle(resolve, { bytes: m.bytes, stats: m.stats });
      };
      w.postMessage(job, [job.cost.buffer, job.heightBytes.buffer]);
    });
  } catch (e) {
    // the main thread still holds every law - pay the stall, keep the roads
    console.warn('[roads] worker bake unavailable; baking on the main thread', e);
    return bakeRoads({ ...inputs, onProgress });
  }
}
