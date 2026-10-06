// ENHANCED AI 3b: THE CLIENT - the worker, the cache, the fallback. One
// bake per level: the host hands in its Collider and the anchor; the
// client fingerprints the soup, asks the cache, else asks the worker
// (or bakes here when there is no Worker, in node), hydrates the compact
// form on this thread over the boxes the bake was cut into (the worker
// ships them back - AUDIT 68), and restores the ground hydrate does not
// carry.
//
// THE GROUND AFTER HYDRATE. His hydrateBakedNav rebuilds a heightfield
// without `ground` - its maps are arenas at zero. A dungeon's floor is
// the constant this client laid (ten metres under the lowest triangle);
// it rides the cache metadata and is put back on the hydrated chf, so a
// cached dungeon answers the same heights as a fresh bake. No change to
// his file for it.
import { navInputFromCollider, bakeSoup, SOUP_AGENT } from './navBake.js';
import { trianglesToColliders, unpackColliders } from './triRaster.js';
import { hydrateBakedNav, bakeNavData } from './navmesh.js';
import { idbStore } from '../world/roadsCache.js';

/** Bumped BY HAND whenever the bake's output for the same input changes
 *  (roadsCache.js's GENERATOR_VERSION rule) - a cached bake under an old
 *  version is a wrong bake served forever per dungeon. AUDIT 62 F3: 1 had
 *  outlived the y-anchor fix (2026-09-03) and now the stacked-floor weld
 *  and the serialised vertex heights (F1). 3: DUNGEON-SEAMS moved the
 *  corners of 32 dungeon models (world/arch3dSeams.js) under the collider
 *  a bake reads - same triangle count, and in most dungeons the same
 *  height bounds, so the key could not tell a bake of the old corners.
 *  4 (2026-09-27, the soup bake whole - its branch's 3, renumbered when
 *  main's 3 met it at the merge): the soup bake's own cell and agent, doors
 *  out, flat floors kept, the anchor union - every earlier bake is a coarse
 *  one that sealed its doorways, and a v3 of either change lacks the other. */
export const NAV_BAKE_VERSION = 4;

/** AUDIT 62 F3: the key carries the ANCHOR's cell too - buildRegions keeps
 *  the anchor's foot-connected component and culls the rest, so a bake taken
 *  from a save loaded in a teleporter pocket must never be a cache hit for the
 *  front-door entry (or vice versa). */
export function navCacheKey({ key, tris, minY, maxY, agent = SOUP_AGENT, anchor = null, anchors = null }) {
  const cell = (p) => `${Math.floor(p[0] / agent.cs)},${Math.floor(p[2] / agent.cs)},${Math.round(p[1] ?? 0)}`;
  const a = anchor ? `:a${cell(anchor)}` : '';
  // the union's cells, hashed: the same layout is the same key, a moved foe a new one
  let h = 0; for (const p of anchors ?? []) for (const c of cell(p)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  const u = anchors?.length ? `:u${anchors.length}.${(h >>> 0).toString(36)}` : '';
  return `nav:v${NAV_BAKE_VERSION}:${key}:${tris}:${minY.toFixed(2)}:${maxY.toFixed(2)}:${agent.cs}:${agent.radius}:${agent.height}:${agent.maxStep}:${agent.maxSlope}${a}${u}`;
}

/** Bake on this thread - the fallback, and node. The worker's core
 *  (navBake's bakeSoup), and the same answer: the compact form, its cell
 *  size, its stats and the boxes it was cut into. */
export function bakeHere(input, anchor, agent = SOUP_AGENT, anchors = null) {
  const r = bakeSoup(input.positions, input.indices, { floor: input.minY - 10, anchor, anchors, agent });
  return { baked: bakeNavData(r.chf), cs: r.agent.cs, stats: r.stats, cols: r.cols };
}

/** Hydrate the compact form on this thread over `cols`, the boxes the
 *  bake was cut into (the height layer), then put the ground back. */
export function hydrateHere(baked, cols, input) {
  const chf = hydrateBakedNav(baked, cols);
  const floor = input.minY - 10;
  chf.ground = { at: () => floor, min: floor };
  return chf;
}

/** A bake this far below its own input is not a navmesh, it is a
 *  voxelizer accident - see the guard in `bake()` for the whole of why.
 *  Named rather than inline because the three together ARE the rule, and
 *  a rule spelled at its use site is one nobody can find again. */
export const DEGENERATE_MIN_TRIS = 1000;
export const DEGENERATE_MIN_POLYS = 20;
export const DEGENERATE_POLY_SHARE = 0.02;

/** What the worker said when it failed - its error's own message (a job's
 *  `t: 'error'` reply, or the worker's onerror) - for the console line. */
const workerWord = (e) => e?.message ?? 'the worker is gone';

export class NavClient {
  constructor({ store = idbStore(), WorkerCtor = globalThis.Worker } = {}) {
    this._store = store;
    this._worker = null;
    this._pending = new Map();
    this._nextId = 1;
    if (WorkerCtor) {
      try {
        // AUDIT 59 F1: THE WORKER NEVER SHIPPED. Vite bundles a module
        // worker only from the literal spelling `new Worker(new
        // URL('./x.js', import.meta.url), { type: 'module' })` - the
        // same rule terrainGenClient.js:"Worker(new URL(...))" records for the terrain
        // worker. `new WorkerCtor(...)` is not that spelling, so the
        // production build carried no nav worker chunk at all: the URL
        // 404'd, onerror rejected the pending bake, the catch below
        // answered null, and EVERY real bake ran bakeHere on the main
        // thread - one to seven seconds frozen on dungeon entry with
        // the switch on (measured: 3.0s for a 10k-triangle level, 6.9s
        // for 31k). A test double still comes in through WorkerCtor;
        // the real one is spelled the way the bundler reads.
        const w = WorkerCtor === globalThis.Worker
          ? new Worker(new URL('./navWorker.js', import.meta.url), { type: 'module' })
          : new WorkerCtor('./navWorker.js', { type: 'module' });
        w.onmessage = (ev) => { const m = ev.data ?? {}; const p = this._pending.get(m.id); if (!p) return; this._pending.delete(m.id); if (m.t === 'error') p.reject(new Error(m.message)); else p.resolve(m); };
        w.onerror = (e) => { for (const p of this._pending.values()) p.reject(new Error(e?.message ?? 'nav worker failed')); this._pending.clear(); this._worker = null; };
        this._worker = w;
      } catch { this._worker = null; }
    }
    this._hadWorker = !!this._worker;
  }

  /** One job to the worker, the soup copied and transferred: resolves
   *  its answer, rejects on its error. */
  _ask(msg, input) {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      const positions = input.positions.slice(), indices = input.indices.slice();
      this._worker.postMessage({ ...msg, id, positions, indices }, [positions.buffer, indices.buffer]);
    });
  }

  /** A cached bake's boxes, cut at its cell size: by the worker, else
   *  here (no Worker, or one that failed on a small soup); null when the
   *  worker failed on a large one. */
  async _cols(input, cs, agent) {
    let failed = null;
    const m = this._worker ? await this._ask({ t: 'cols', cs, maxSlope: agent.maxSlope }, input).catch((e) => { failed = e; return null; }) : null;
    if (m) return unpackColliders(m.cols);
    if (this._hadWorker && input.tris >= DEGENERATE_MIN_TRIS) {   // AUDIT PRE-MERGE 0928 N5: the bake path's rule on a cache hit too - a dead worker's large soup is not re-cut here (2.8 s on 25k triangles at the soup's cell)
      console.warn(`[enhanced-ai] the nav worker failed on ${input.tris} triangles - not re-cutting a cached bake on the main thread; the classic motor stands (the worker: ${workerWord(failed)})`);
      return null;
    }
    return trianglesToColliders(input.positions, input.indices, { cs, maxSlope: agent.maxSlope });
  }

  /** One bake: cache, else worker, else here. Resolves { chf, stats, cached }.
   *  `anchors`: every other place agents live (the layout's foes); `exclude`:
   *  the buckets the soup leaves out (the doors a foe opens). */
  async bake({ collider, anchor, anchors = null, exclude = null, key, agent = SOUP_AGENT }) {
    const input = navInputFromCollider(collider, { exclude });
    if (!input.tris) return null;
    const ck = navCacheKey({ key, tris: input.tris, minY: input.minY, maxY: input.maxY, agent, anchor, anchors });
    if (this._store) {
      const hit = await this._store.get(ck).catch(() => null);
      if (hit && hit.baked) { const cols = await this._cols(input, hit.cs, agent); return cols ? { chf: hydrateHere(hit.baked, cols, input), stats: { ...(hit.stats ?? {}), cached: true }, cached: true } : null; }
    }
    let result = null, failed = null;
    if (this._worker) {
      const m = await this._ask({ t: 'bake', floor: input.minY - 10, anchor, anchors, agent }, input).catch((e) => { failed = e; return null; });   // AUDIT PRE-MERGE 0928 N4: the worker's own word is kept for the console
      if (m) result = { ...m, cols: unpackColliders(m.cols) };
    }
    // A WORKER THAT DIED IS NOT A REASON TO FREEZE THE PAGE (2026-09-27). The soup bake keeps its own cell now, so a
    // large dungeon is 5-11 s and up to ~1.3 GB (the corpus's largest) - AUDIT 59 F1's main-thread freeze, several
    // times over. Here the bake runs only where there never was a worker (node, a test) or the soup is small; a worker
    // that failed on a large one leaves the classic motor standing, which is where a degenerate bake left it too.
    if (!result && this._hadWorker && input.tris >= DEGENERATE_MIN_TRIS) {
      console.warn(`[enhanced-ai] the nav worker failed on ${input.tris} triangles - not baking on the main thread; the classic motor stands (the worker: ${workerWord(failed)})`);
      return null;
    }
    if (!result && this._hadWorker) console.warn(`[enhanced-ai] the nav worker failed - baking ${input.tris} triangles on the main thread (the worker: ${workerWord(failed)})`);   // AUDIT PRE-MERGE 0928 N4: a small soup's fallback says so
    if (!result) result = bakeHere(input, anchor, agent, anchors);
    // DEGENERATE-BAKE GUARD (2026-09-20, Mac's patch - a report of foes
    // standing idle across most of a dungeon, with the console showing a
    // CACHED bake of 11 polys against 17,450 collision triangles).
    //
    // `buildRegions` keeps ONLY the component the anchor's foot reaches and
    // culls every other region as unreachable - right when that is true, but
    // a voxelizer that misses one real connection (a thin or irregular
    // passage, which is exactly what an organic cave or mine layout is prone
    // to) throws the WHOLE rest of the level away as a false positive. Every
    // enhanced-AI foe outside that surviving patch is then left with no
    // navmesh to path on at all.
    //
    // The cost was that a bad bake was PERMANENTLY cached: IndexedDB survives
    // a reload, and the key is otherwise stable for the same dungeon and
    // geometry, so one unlucky voxelization broke that dungeon's AI for as
    // long as it existed. So a bake that culled almost everything is not
    // cached, and the next entry gets a fresh attempt instead of being stuck
    // with this one.
    //
    // MEASURED AGAINST `input.tris` - the same stable count the cache key is
    // built from - and NOT the voxelizer's own box count. A first pass used
    // boxes and a tall thin wall voxelizes into far more of them than its
    // floor does, so an honestly small room tripped it: boxes conflate
    // non-walkable wall geometry with the floor area the polys are actually
    // drawn from. Gated on a genuinely large input too, so a real small
    // dungeon - few triangles, honestly few polys - is never touched.
    // (2026-09-27: the field bake that raised it - 11 polys from 17,592 -
    // was the bake's own cell, erosion, flat floors and single anchor, not
    // luck; navBake.js bakeSoup has the four. The guard stays as the net.)
    const polys = result.stats?.polys ?? 0;
    if (input.tris >= DEGENERATE_MIN_TRIS && (polys < DEGENERATE_MIN_POLYS || polys < input.tris * DEGENERATE_POLY_SHARE)) {
      console.warn(`[enhanced-ai] navmesh bake looks degenerate (${polys} polys from ${input.tris} triangles) - not caching, so the next entry gets a fresh retry instead of being stuck with this one`);
    } else if (this._store) {
      await this._store.set(ck, { baked: result.baked, cs: result.cs, stats: result.stats }).catch(() => null);
    }
    return { chf: hydrateHere(result.baked, result.cols, input), stats: { ...result.stats, cached: false }, cached: false };
  }

  dispose() { try { this._worker?.terminate?.(); } catch { /* gone */ } this._worker = null; }
}
