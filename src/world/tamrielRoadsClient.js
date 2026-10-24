// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, ASKED FOR A REGION AT A TIME.
//
// The host hands the build's inputs and the regions to build, nearest the player first; this keeps WORKERS of the roads'
// own worker (world/tamrielRoadsWorker.js) busy, one region each, and answers each region's layer as it lands. A region
// built before under the same inputs (world/tamrielRoads.js regionKey) comes out of the roads' cache (world/roadsCache.js
// idbStore) and is never built again; a fresh one is put there. `near` re-orders what is still to build as the player
// goes. A new `start` (the trace or the fit moved, a place stood) drops every answer of the last one. TESA15: a region's
// answer, and its cache entry, carry its places beside its layer (world/pastBayPlaces.js) - the map's, one roll.
// ═══════════════════════════════════════════════════════════════════
import { idbStore } from './roadsCache.js';
import { unpackArenaRoads } from './arenaRoads.js';
import { unpackPastBayPlaces } from './pastBayPlaces.js';
import { regionKey } from './tamrielRoads.js';

/** How many workers build at once - the cores the page can spare, two to four. */
export const roadsWorkerCount = (cores = globalThis.navigator?.hardwareConcurrency ?? 4) => Math.max(1, Math.min(4, cores - 2));
/** The roads' worker, as Vite bundles it - `new Worker(new URL(...))` in exactly that spelling. */
export function defaultRoadsWorker() {
  return new Worker(new URL('./tamrielRoadsWorker.js', import.meta.url), { type: 'module' });
}

/**
 * @param {{ makeWorker?: () => any, workers?: number, store?: ?{ get: Function, set: Function }, log?: { warn: Function } }} [o]
 */
export function createTamrielRoadsClient({ makeWorker = defaultRoadsWorker, workers = roadsWorkerCount(), store = idbStore(), log = console } = {}) {
  /** @type {any[]} */
  const pool = [];
  let run = 0, job = 0, queue = [], live = null;
  function spawn() {
    for (let k = pool.length; k < workers; k++) {
      let w;
      try { w = makeWorker(); } catch (e) { log.warn('[roads] the roads worker could not start:', e?.message ?? e); break; }
      const slot = { w, busy: null, run: -1 };
      w.onmessage = (ev) => answer(slot, ev.data ?? {});
      w.onerror = (e) => { log.warn('[roads] a roads worker died:', e?.message ?? e); slot.dead = true; if (slot.busy) { queue.unshift(slot.busy.region); slot.busy = null; } pump(); };
      pool.push(slot);
    }
  }
  function answer(slot, m) {
    const asked = slot.busy;
    slot.busy = null;
    if (m.t === 'region' && asked && live && slot.run === live.run && asked.id === m.id) {
      if (m.error) log.warn(`[roads] region (${m.i}, ${m.j}) could not be built: ${m.error}`);
      else {
        const layer = unpackArenaRoads(m.layer), places = unpackPastBayPlaces(m.places);
        if (store) Promise.resolve(store.set(asked.key, { layer: m.layer, places: m.places })).catch(() => {});
        live.onRegion(asked.region, layer, { ...m.stats, ms: m.ms, cached: false }, places);
      }
    }
    pump();
  }
  function pump() {
    if (!live) return;
    for (const slot of pool) {
      if (slot.dead || slot.busy || !queue.length) continue;
      if (slot.run !== live.run) { slot.w.postMessage({ t: 'init', ...live.inputs }); slot.run = live.run; }
      const region = queue.shift();
      slot.busy = { id: ++job, region, key: regionKey({ region, inputs: live.print }) };
      slot.w.postMessage({ t: 'build', id: slot.busy.id, i: region.i, j: region.j });
    }
  }
  return {
    /**
     * A build: its inputs (the worker's init - world/tamrielRoadsWorker.js), their print (tamrielRoads.js inputsPrint), the
     * regions nearest first, and where each region's layer and places go.
     * @param {{ inputs: object, print: string, regions: Array<{ i: number, j: number, core: object }>,
     *   onRegion: (region: any, layer: any, stats: { cached: boolean, ms?: number }, places: Array<{ x: number, y: number, type: number }>) => void }} o
     */
    start({ inputs, print, regions, onRegion }) {
      const me = { run: ++run, inputs, print, onRegion };
      live = me;
      queue = [];
      spawn();
      const ask = regions.map((region) => {
        const key = regionKey({ region, inputs: print });
        return Promise.resolve(store ? store.get(key) : null).catch(() => null).then((hit) => ({ region, hit }));
      });
      return Promise.all(ask).then((answers) => {
        if (live !== me) return;
        for (const { region, hit } of answers) {
          if (hit?.layer?.keys) onRegion(region, unpackArenaRoads(hit.layer), { cached: true }, unpackPastBayPlaces(hit.places));
          else queue.push(region);
        }
        pump();
      });
    },
    /** The regions still to build, nearest a pixel first. */
    near(x, y) {
      const d = (r) => Math.hypot((r.core.x0 + r.core.x1) / 2 - x, (r.core.y0 + r.core.y1) / 2 - y);
      queue.sort((a, b) => d(a) - d(b));
    },
    /** How many regions are still to build, and building. */
    pending: () => queue.length + pool.filter((s) => s.busy).length,
    /** Drop the build in hand: no answer of it lands. */
    stop() { live = null; queue = []; },
    /** Let the workers go. */
    dispose() { live = null; queue = []; for (const s of pool) { try { s.w.terminate?.(); } catch { /* gone */ } } pool.length = 0; },
  };
}
