// ENHANCED AI 3: A LEVEL BAKES FROM ITS OWN COLLIDER. The Collider keeps
// every bucket's triangles in world space - the exact triangles the
// player and the enemies collide with - so the navmesh is baked from
// those and nothing else: "the nav's ground and the game's ground are
// one source" (project-final/navmesh.js:27), kept verbatim as a law.
//
// Pure: a Collider in, a compact heightfield with its poly mesh out.
// No worker here (the client that owns the worker and the cache is
// ENHANCED AI 3b); no motor here (ENHANCED AI 4). Everything below is
// pinnable on a synthetic room, and one pin waits on ARENA2 for
// Privateer's Hold.
//
// THE PHANTOM FLOOR. project-final's buildNav lays an implicit floor
// under every cell - y = 0 for its arenas, or the terrain when a ground
// is given. A dungeon has neither: its floors are its own triangles and
// a plane at y = 0 across the whole level would be a floor that is not
// there. The ground handed in sits ten metres below the lowest triangle,
// so it can never be stepped onto from any real floor, and the anchored
// region election drops it as an island - the same rule that drops a
// moat or a roof in his arenas.

import { trianglesToColliders } from './triRaster.js';
import {
  AGENT, coarsenAgent, buildNav, buildCompact, buildRegions, buildContours,
  buildPolyMesh, buildPolyMeshDetail, findPath,
} from './navmesh.js';

/** The world-space triangle soup a Collider holds, flattened. Each
 *  bucket's translation (the streamed world's floating origin) is
 *  applied so the soup is in the frame the queries use. */
export function navInputFromCollider(collider, { buckets = null } = {}) {
  const pos = []; const idx = [];
  let minY = Infinity, maxY = -Infinity, tris = 0;
  for (const [key, bucket] of collider._buckets) {
    if (buckets && !buckets.includes(key)) continue;
    const t = bucket.t ? bucket.t() : [0, 0, 0];
    for (const [a, b, c] of bucket.tris) {
      const base = pos.length / 3;
      pos.push(a[0] + t[0], a[1] + t[1], a[2] + t[2], b[0] + t[0], b[1] + t[1], b[2] + t[2], c[0] + t[0], c[1] + t[1], c[2] + t[2]);
      idx.push(base, base + 1, base + 2);
      for (const v of [a, b, c]) { const y = v[1] + t[1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      tris++;
    }
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx), minY, maxY, tris };
}

/**
 * Bake. `anchor` is where the agents live - the player's entry - and it
 * is REQUIRED: his buildRegions elects the component that holds it and
 * drops the rest (project-final/main.js:233 bakes anchored, always).
 * @returns {{ chf, cols, agent, stats }}
 */
export function bakeNavFromCollider(collider, { anchor, agent = AGENT, buckets = null, budget = 250000, target = 80000 } = {}) {
  if (!anchor) throw new Error('bakeNavFromCollider: an anchor is required - the navmesh serves the component the agents live in');
  const t0 = (globalThis.performance ?? Date).now();
  const input = navInputFromCollider(collider, { buckets });
  if (!input.tris) return null;
  // the cell size the bake will use: his budget rule, which keeps AGENT.cs
  // below the budget and coarsens open ground above it. A first pass at
  // AGENT.cs sizes the grid; if it is over budget the boxes are re-cut.
  let cols = trianglesToColliders(input.positions, input.indices, { cs: agent.cs, maxSlope: agent.maxSlope });
  // his contract: undefined under budget (keep AGENT.cs, byte-identical
  // bakes), else the agent with a coarser cs - and the boxes are re-cut
  // at that cs so they land on the bake's grid.
  const coarser = coarsenAgent(cols, agent, budget, target);
  const ag = coarser ?? agent;
  if (coarser) cols = trianglesToColliders(input.positions, input.indices, { cs: ag.cs, maxSlope: ag.maxSlope });
  const floor = input.minY - 10;
  const ground = { at: () => floor, min: floor };
  const nav = buildNav(cols, ag, [], ground);
  const chf = buildCompact(nav, ag);
  buildRegions(chf, { anchor: { x: anchor[0], z: anchor[2] } });
  buildContours(chf);
  buildPolyMesh(chf);
  buildPolyMeshDetail(chf, cols);
  const ms = Math.round((globalThis.performance ?? Date).now() - t0);
  return { chf, cols, agent: ag, stats: { tris: input.tris, boxes: cols.length, cs: ag.cs, cells: nav.nx * nav.nz, polys: chf.mesh?.polys?.length ?? 0, ms } };
}

/** The one query the motor will use (ENHANCED AI 4): waypoints or null. */
export function navPath(bake, from, to, opts) {
  return bake && bake.chf ? findPath(bake.chf, from, to, opts) : null;
}
