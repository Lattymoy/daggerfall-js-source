// ENHANCED AI 3b: THE CLIENT - the worker, the cache, the fallback. One
// bake per level: the host hands in its Collider and the anchor; the
// client fingerprints the soup, asks the cache, else asks the worker
// (or bakes here when there is no Worker, in node), hydrates the compact
// form on this thread, and restores the ground hydrate does not carry.
//
// THE GROUND AFTER HYDRATE. His hydrateBakedNav rebuilds a heightfield
// without `ground` - its maps are arenas at zero. A dungeon's floor is
// the constant this client laid (ten metres under the lowest triangle);
// it rides the cache metadata and is put back on the hydrated chf, so a
// cached dungeon answers the same heights as a fresh bake. No change to
// his file for it.
import { navInputFromCollider, regionAnchor } from './navBake.js';
import { trianglesToColliders } from './triRaster.js';
import { AGENT, coarsenAgent, hydrateBakedNav, buildNav, buildCompact, buildRegions, buildContours, buildPolyMesh, buildPolyMeshDetail, bakeNavData } from './navmesh.js';
import { idbStore } from '../world/roadsCache.js';

/** Bumped BY HAND whenever the bake's output for the same input changes
 *  (roadsCache.js's GENERATOR_VERSION rule) - a cached bake under an old
 *  version is a wrong bake served forever per dungeon. AUDIT 62 F3: 1 had
 *  outlived the y-anchor fix (2026-09-03) and now the stacked-floor weld
 *  and the serialised vertex heights (F1). */
export const NAV_BAKE_VERSION = 2;

/** AUDIT 62 F3: the key carries the ANCHOR's cell too - buildRegions keeps
 *  the anchor's foot-connected component and culls the rest, so a bake taken
 *  from a save loaded in a teleporter pocket must never be a cache hit for the
 *  front-door entry (or vice versa). */
export function navCacheKey({ key, tris, minY, maxY, agent = AGENT, anchor = null }) {
  const a = anchor ? `:a${Math.floor(anchor[0] / agent.cs)},${Math.floor(anchor[2] / agent.cs)},${Math.round(anchor[1] ?? 0)}` : '';
  return `nav:v${NAV_BAKE_VERSION}:${key}:${tris}:${minY.toFixed(2)}:${maxY.toFixed(2)}:${agent.cs}:${agent.radius}:${agent.height}:${agent.maxStep}:${agent.maxSlope}${a}`;
}

/** Bake on this thread - the fallback, and node. Same steps as the worker. */
export function bakeHere(input, anchor, agent = AGENT) {
  let cols = trianglesToColliders(input.positions, input.indices, { cs: agent.cs, maxSlope: agent.maxSlope });
  const coarser = coarsenAgent(cols, agent);
  const ag = coarser ?? agent;
  if (coarser) cols = trianglesToColliders(input.positions, input.indices, { cs: ag.cs, maxSlope: ag.maxSlope });
  const floor = input.minY - 10;
  const nav = buildNav(cols, ag, [], { at: () => floor, min: floor });
  const chf = buildCompact(nav, ag);
  buildRegions(chf, { anchor: regionAnchor(anchor) });   // WITH its y - see regionAnchor
  buildContours(chf); buildPolyMesh(chf); buildPolyMeshDetail(chf, cols);
  return { baked: bakeNavData(chf), cs: ag.cs, stats: { boxes: cols.length, cs: ag.cs, polys: chf.mesh?.polys?.length ?? 0 } };
}

/** Hydrate the compact form on this thread: re-cut the boxes at the
 *  baked cell size (deterministic from the same soup) for the height
 *  layer, then put the ground back. */
export function hydrateHere(baked, cs, input, agent = AGENT) {
  const cols = trianglesToColliders(input.positions, input.indices, { cs, maxSlope: agent.maxSlope });
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
        // same rule terrainGenClient.js:10 records for the terrain
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
  }

  /** One bake: cache, else worker, else here. Resolves { chf, stats, cached }. */
  async bake({ collider, anchor, key, agent = AGENT }) {
    const input = navInputFromCollider(collider);
    if (!input.tris) return null;
    const ck = navCacheKey({ key, tris: input.tris, minY: input.minY, maxY: input.maxY, agent, anchor });
    if (this._store) {
      const hit = await this._store.get(ck).catch(() => null);
      if (hit && hit.baked) return { chf: hydrateHere(hit.baked, hit.cs, input, agent), stats: { ...(hit.stats ?? {}), cached: true }, cached: true };
    }
    let result;
    if (this._worker) {
      const id = this._nextId++;
      result = await new Promise((resolve, reject) => {
        this._pending.set(id, { resolve, reject });
        const positions = input.positions.slice(), indices = input.indices.slice();
        this._worker.postMessage({ t: 'bake', id, positions, indices, floor: input.minY - 10, anchor, agent }, [positions.buffer, indices.buffer]);
      }).catch(() => null);
    }
    if (!result) result = bakeHere(input, anchor, agent);
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
    const polys = result.stats?.polys ?? 0;
    if (input.tris >= DEGENERATE_MIN_TRIS && (polys < DEGENERATE_MIN_POLYS || polys < input.tris * DEGENERATE_POLY_SHARE)) {
      console.warn(`[enhanced-ai] navmesh bake looks degenerate (${polys} polys from ${input.tris} triangles) - not caching, so the next entry gets a fresh retry instead of being stuck with this one`);
    } else if (this._store) {
      await this._store.set(ck, { baked: result.baked, cs: result.cs, stats: result.stats }).catch(() => null);
    }
    return { chf: hydrateHere(result.baked, result.cs, input, agent), stats: { ...result.stats, cached: false }, cached: false };
  }

  dispose() { try { this._worker?.terminate?.(); } catch { /* gone */ } this._worker = null; }
}
