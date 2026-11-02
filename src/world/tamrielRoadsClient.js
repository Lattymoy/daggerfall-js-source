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
//
// AUDIT TESA II:
//   R3  the cache's hits land a budget at a time (LAND_BUDGET_MS, each its own task) - all forty-eight in one task froze
//       the page 1.3 to 2.5 s on every warm boot.
//   R4  the workers are let go once nothing is left to build, and made again by the next `start` - idle, each kept its
//       copy of WOODS.WLD and its ground (about 80 MB) for the session.
//   R8  a dead worker is terminated and replaced (WORKER_DEATHS at the most), the region it held given back only to the
//       build it was of; with no worker that can run, the page's own thread builds the regions a budget at a time - TESA4's
//       recorded fallback, its intent kept - and says so once.
//   R10 a fresh region lets go of its entries under every other print (and TESA14's and TESA15's keys); a cache that
//       cannot keep it is said once.
// ═══════════════════════════════════════════════════════════════════
import { idbStore } from './roadsCache.js';
import { unpackArenaRoads } from './arenaRoads.js';
import { unpackPastBayPlaces } from './pastBayPlaces.js';
import { regionKey, regionPrefix, LEGACY_REGION_KEYS } from './tamrielRoads.js';
import { createRoadsWorkerState } from './tamrielRoadsWorker.js';

/** How many workers build at once - the cores the page can spare less two, one to four. */
export const roadsWorkerCount = (cores = globalThis.navigator?.hardwareConcurrency ?? 4) =>
  Math.max(1, Math.min(4, cores - 2));
/** AUDIT TESA II R3/R8: the page's milliseconds a task spends landing the cache's regions, or building one with no worker
 *  - at least one landing, or one step, a task (TILE_BUDGET_MS's, ui/tamrielTiles.js). */
export const LAND_BUDGET_MS = 8;
/** AUDIT TESA II R8: how many roads workers may die in a client's life before it builds on the page's thread. */
export const WORKER_DEATHS = 4;
/** The roads' worker, as Vite bundles it - `new Worker(new URL(...))` in exactly that spelling. */
export function defaultRoadsWorker() {
  return new Worker(new URL('./tamrielRoadsWorker.js', import.meta.url), { type: 'module' });
}
const nextTask = (fn) => {
  setTimeout(fn, 0);
};
const clock = () => (globalThis.performance ?? Date).now();

/**
 * @param {{ makeWorker?: () => any, workers?: number, store?: ?{ get: Function, set: Function }, log?: { warn: Function },
 *   defer?: (fn: () => void) => void, now?: () => number, budgetMs?: number }} [o] `store` undefined: the roads' IndexedDB
 *   cache (null where there is none); null: none. `defer` runs a function in a task of its own, `now` the clock.
 */
export function createTamrielRoadsClient({
  makeWorker = defaultRoadsWorker,
  workers = roadsWorkerCount(),
  store = undefined,
  log = console,
  defer = nextTask,
  now = clock,
  budgetMs = LAND_BUDGET_MS,
} = {}) {
  const cache = store === undefined ? idbStore() : store;
  /** @type {any[]} */
  let pool = [];
  let run = 0,
    job = 0,
    queue = [],
    live = null,
    deaths = 0,
    unmakeable = false;
  /** R3: the cache's hits still to land; whether a landing task is asked. */
  let landing = [],
    landingAsked = false;
  /** R8: the page's own thread's build - its state, the build its inputs are of, and the region in hand. */
  const here = { state: null, run: -1, busy: null, asked: false };
  const said = new Set();
  const sayOnce = (k, ...msg) => {
    if (!said.has(k)) {
      said.add(k);
      log.warn(...msg);
    }
  };
  if (store === undefined && !cache)
    sayOnce('no-cache', '[roads] no IndexedDB here: the roads past the Bay are laid again on every boot');

  /** R4/R8: the workers a build needs - the dead ones let go, the pool made up while deaths allow. */
  function spawn() {
    pool = pool.filter((s) => !s.dead);
    while (!unmakeable && pool.length < workers && deaths < WORKER_DEATHS) {
      let w;
      try {
        w = makeWorker();
      } catch (e) {
        unmakeable = true;
        log.warn('[roads] the roads worker could not start:', e?.message ?? e);
        break;
      }
      const slot = { w, busy: null, run: -1, dead: false };
      w.onmessage = (ev) => answer(slot, ev.data ?? {});
      w.onerror = (e) => died(slot, e);
      pool.push(slot);
    }
  }
  function died(slot, e) {
    if (slot.dead) return;
    log.warn('[roads] a roads worker died:', e?.message ?? e);
    slot.dead = true;
    deaths++;
    try {
      slot.w.terminate?.();
    } catch {
      /* gone */
    }
    const busy = slot.busy;
    slot.busy = null;
    if (busy && live && busy.run === live.run) queue.unshift(busy.region); // R8: given back only to the build it was of
    pump();
  }
  /** R4: nothing to build and nothing building - the workers go; the next `start` makes them again. */
  function release() {
    for (const s of pool) {
      try {
        s.w.terminate?.();
      } catch {
        /* gone */
      }
    }
    pool = [];
  }
  function keep(asked, m) {
    if (!cache) return;
    // R10: one print a region - its entries under any other, and the keys TESA14 and TESA15 wrote, let go as it is kept
    const prefix = regionPrefix(asked.region);
    Promise.resolve(
      cache.set(
        asked.key,
        { layer: m.layer, places: m.places, land: m.land ?? null },
        { evict: [[prefix, `${prefix}\uffff`], LEGACY_REGION_KEYS] },
      ),
    ).then(
      (ok) => {
        if (ok == null)
          sayOnce(
            'set',
            "[roads] the roads' cache could not keep a region (no room, or a private window): the roads past the Bay are laid again on the next boot",
          );
      },
      () =>
        sayOnce(
          'set',
          "[roads] the roads' cache could not keep a region: the roads past the Bay are laid again on the next boot",
        ),
    );
  }
  /** A region's answer - a worker's, or the page's own build's. */
  function landed(asked, m) {
    if (m.error) {
      log.warn(`[roads] region (${m.i}, ${m.j}) could not be built: ${m.error}`);
      return;
    }
    const layer = unpackArenaRoads(m.layer),
      places = unpackPastBayPlaces(m.places);
    keep(asked, m);
    live.onRegion(asked.region, layer, { ...m.stats, ms: m.ms, cached: false }, places, m.land ?? null); // EXACT-PIECES: its land's pieces
  }
  function answer(slot, m) {
    const asked = slot.busy;
    slot.busy = null;
    if (m.t === 'region' && asked && live && slot.run === live.run && asked.id === m.id) landed(asked, m);
    pump();
  }
  function pump() {
    if (!live) return;
    if (queue.length) spawn();
    for (const slot of pool) {
      if (slot.dead || slot.busy || !queue.length) continue;
      if (slot.run !== live.run) {
        slot.w.postMessage({ t: 'init', ...live.inputs });
        slot.run = live.run;
      }
      const region = queue.shift();
      slot.busy = { id: ++job, region, run: live.run, key: regionKey({ region, inputs: live.print }) };
      slot.w.postMessage({ t: 'build', id: slot.busy.id, i: region.i, j: region.j });
    }
    // R8: no worker can run - the page's own thread builds, a budget at a time
    if (queue.length && !pool.some((s) => !s.dead)) buildHere();
    if (!queue.length && !pool.some((s) => s.busy)) release();
  }

  // ── R8: THE PAGE'S OWN THREAD, WITH NO WORKER ─────────────────
  function buildHere() {
    if (here.busy || !queue.length || !live) return;
    sayOnce(
      'here',
      "[roads] no roads worker can run: the roads past the Bay are built on the page's own thread, a little each frame",
    );
    here.state ??= createRoadsWorkerState();
    if (here.run !== live.run) {
      here.state.handle({ t: 'init', ...live.inputs, inThread: true }, () => {});
      here.run = live.run;
    }
    const region = queue.shift(),
      id = ++job;
    here.busy = {
      id,
      region,
      run: live.run,
      key: regionKey({ region, inputs: live.print }),
      it: here.state.steps({ t: 'build', id, i: region.i, j: region.j }),
    };
    askHere();
  }
  function askHere() {
    if (!here.asked) {
      here.asked = true;
      defer(stepHere);
    }
  }
  function stepHere() {
    here.asked = false;
    const b = here.busy;
    if (!b) return;
    if (!live || b.run !== live.run) {
      here.busy = null;
      buildHere();
      return;
    } // superseded: dropped, the new build's next
    const t0 = now();
    for (let r = b.it.next(); ; r = b.it.next()) {
      if (r.done) {
        here.busy = null;
        landed(b, r.value.msg);
        buildHere();
        return;
      }
      if (now() - t0 >= budgetMs) {
        askHere();
        return;
      } // the task's budget spent: the next task goes on
    }
  }

  // ── R3: THE CACHE'S HITS, A BUDGET A TASK ─────────────────────
  function askLanding() {
    if (!landingAsked && landing.length) {
      landingAsked = true;
      defer(landSome);
    }
  }
  function landSome() {
    landingAsked = false;
    const t0 = now();
    while (landing.length && live) {
      // a new start, a stop, a dispose empty it: what is here is the live build's
      const { region, hit } = landing.shift();
      live.onRegion(
        region,
        unpackArenaRoads(hit.layer),
        { cached: true },
        unpackPastBayPlaces(hit.places),
        hit.land ?? null,
      );
      if (now() - t0 >= budgetMs) break;
    }
    askLanding();
  }

  return {
    /**
     * A build: its inputs (the worker's init - world/tamrielRoadsWorker.js), their print (tamrielRoads.js inputsPrint), the
     * regions nearest first, and where each region's layer and places go. Answers once the cache has been asked of every
     * region (the hits still landing, a budget a task).
     * @param {{ inputs: object, print: string, regions: Array<{ i: number, j: number, core: object }>,
     *   onRegion: (region: any, layer: any, stats: { cached: boolean, ms?: number }, places: Array<{ x: number, y: number, type: number }>, land?: any) => void }} o
     */
    start({ inputs, print, regions, onRegion }) {
      const me = { run: ++run, inputs, print, onRegion };
      live = me;
      queue = [];
      landing = [];
      const ask = regions.map((region) => {
        const key = regionKey({ region, inputs: print });
        return Promise.resolve(cache ? cache.get(key) : null)
          .catch(() => null)
          .then((hit) => ({ region, hit }));
      });
      return Promise.all(ask).then((answers) => {
        if (live !== me) return;
        for (const { region, hit } of answers) {
          if (hit?.layer?.keys) landing.push({ region, hit });
          else queue.push(region);
        }
        askLanding();
        pump();
      });
    },
    /** The regions still to build, nearest a pixel first. */
    near(x, y) {
      const d = (r) => Math.hypot((r.core.x0 + r.core.x1) / 2 - x, (r.core.y0 + r.core.y1) / 2 - y);
      queue.sort((a, b) => d(a) - d(b));
    },
    /** How many regions are still to land: to build, building, and the cache's still landing. */
    pending: () => queue.length + pool.filter((s) => s.busy).length + landing.length + (here.busy ? 1 : 0),
    /** How many workers stand now (R4: none once nothing is left to build). */
    workers: () => pool.length,
    /** Drop the build in hand: no answer of it lands. */
    stop() {
      live = null;
      queue = [];
      landing = [];
      release();
    },
    /** Let the workers go. */
    dispose() {
      live = null;
      queue = [];
      landing = [];
      here.busy = null;
      release();
    },
  };
}
