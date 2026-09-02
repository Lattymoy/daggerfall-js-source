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
import { navInputFromCollider } from './navBake.js';
import { trianglesToColliders } from './triRaster.js';
import { AGENT, coarsenAgent, hydrateBakedNav, buildNav, buildCompact, buildRegions, buildContours, buildPolyMesh, buildPolyMeshDetail, bakeNavData } from './navmesh.js';
import { idbStore } from '../world/roadsCache.js';

export const NAV_BAKE_VERSION = 1;

export function navCacheKey({ key, tris, minY, maxY, agent = AGENT }) {
  return `nav:v${NAV_BAKE_VERSION}:${key}:${tris}:${minY.toFixed(2)}:${maxY.toFixed(2)}:${agent.cs}:${agent.radius}:${agent.height}:${agent.maxStep}:${agent.maxSlope}`;
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
  buildRegions(chf, { anchor: { x: anchor[0], z: anchor[2] } });
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

export class NavClient {
  constructor({ store = idbStore(), WorkerCtor = globalThis.Worker } = {}) {
    this._store = store;
    this._worker = null;
    this._pending = new Map();
    this._nextId = 1;
    if (WorkerCtor) {
      try {
        const w = new WorkerCtor(new URL('./navWorker.js', import.meta.url), { type: 'module' });
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
    const ck = navCacheKey({ key, tris: input.tris, minY: input.minY, maxY: input.maxY, agent });
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
    if (this._store) await this._store.set(ck, { baked: result.baked, cs: result.cs, stats: result.stats }).catch(() => null);
    return { chf: hydrateHere(result.baked, result.cs, input, agent), stats: { ...result.stats, cached: false }, cached: false };
  }

  dispose() { try { this._worker?.terminate?.(); } catch { /* gone */ } this._worker = null; }
}
