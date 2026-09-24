// ENHANCED AI 3: A LEVEL BAKES FROM ITS OWN COLLIDER. The Collider keeps
// every bucket's triangles in world space - the exact triangles the
// player and the enemies collide with - so the navmesh is baked from
// those and nothing else: "the nav's ground and the game's ground are
// one source" (project-final/navmesh.js:32), kept verbatim as a law.
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

import { trianglesToColliders, soupExtent } from './triRaster.js';
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
 * The anchor as buildRegions wants it - WITH ITS Y. The kept component
 * is elected by the span nearest the anchor's height, and the default
 * when y is absent is 0: the phantom ground (minY - 10) is nearer to 0
 * than any real floor not itself at 0, so an anchor without y elects
 * the phantom and culls every real floor. Three call sites once built
 * this literal by hand and all three dropped the y; bakeSoup, their one
 * home now (AUDIT 68), builds it here.
 */
export function regionAnchor(anchor) {
  return { x: anchor[0], y: anchor[1], z: anchor[2] };
}

/**
 * THE BAKE, ONE HOME (AUDIT 68 S02-bake-pipeline-triplicated): a world-
 * space triangle soup in, the baked chf, the boxes it was voxelised into,
 * the agent it used and its stats out. navBake, navClient.bakeHere and
 * the worker each spelled this pipeline out and had drifted (stats
 * shapes, dead budget/target reads); all three call this now.
 * `floor` is the phantom ground's height, `anchor` where the agents live.
 * @returns {{ chf, cols, agent, stats: { tris, boxes, cs, cells, polys, ms } }}
 */
export function bakeSoup(positions, indices, { floor, anchor, agent = AGENT }) {
  const t0 = (globalThis.performance ?? Date).now();
  // the cell size the bake will use: his budget rule, which keeps AGENT.cs
  // below the budget (undefined: byte-identical bakes) and coarsens open
  // ground above it. coarsenAgent reads only the boxes' xz extent, and
  // that is the soup's own bounds snapped to cells - so the grid is sized
  // from those and the soup is voxelised ONCE, at the chosen cs (AUDIT 68
  // S02-coarsen-sizing-pass: a fine pass cut only to be measured and
  // thrown away cost ~2 s on exactly the large dungeons that coarsen).
  const ag = coarsenAgent(soupExtent(positions, indices, agent.cs), agent) ?? agent;
  const cols = trianglesToColliders(positions, indices, { cs: ag.cs, maxSlope: ag.maxSlope });
  const nav = buildNav(cols, ag, [], { at: () => floor, min: floor });
  const chf = buildCompact(nav, ag);
  // THE ANCHOR CARRIES ITS Y. buildRegions elects the kept component by
  // the span NEAREST THE ANCHOR'S HEIGHT (his FOUNDRY S3 rule: "an
  // abyss floor 22m down is the column's first span"), defaulting y to
  // 0 when none is given. AI 3 passed only x and z, so every bake was
  // anchored at y = 0 - and the phantom ground (minY - 10) is nearer to
  // 0 than any dungeon floor that is not itself at 0. Our test rooms
  // were at 0, so the real floor won by accident; a room at y = 25
  // elected the phantom, culled every real floor - the walls' too, so
  // the walls read as walkable - and routes ran straight through them.
  // Real dungeons are not at 0. Mac's report: foes into walls, clumped,
  // gone.
  buildRegions(chf, { anchor: regionAnchor(anchor) });
  buildContours(chf);
  buildPolyMesh(chf);
  buildPolyMeshDetail(chf, cols);
  const ms = Math.round((globalThis.performance ?? Date).now() - t0);
  return { chf, cols, agent: ag, stats: { tris: Math.floor(indices.length / 3), boxes: cols.length, cs: ag.cs, cells: nav.nx * nav.nz, polys: chf.mesh?.polys?.length ?? 0, ms } };
}

/**
 * Bake. `anchor` is where the agents live - the player's entry - and it
 * is REQUIRED: his buildRegions elects the component that holds it and
 * drops the rest (project-final/main.js:300 bakes anchored, always).
 * @returns {{ chf, cols, agent, stats }}
 */
export function bakeNavFromCollider(collider, { anchor, agent = AGENT, buckets = null } = {}) {
  if (!anchor) throw new Error('bakeNavFromCollider: an anchor is required - the navmesh serves the component the agents live in');
  const input = navInputFromCollider(collider, { buckets });
  if (!input.tris) return null;
  return bakeSoup(input.positions, input.indices, { floor: input.minY - 10, anchor, agent });
}

/** The one query the motor will use (ENHANCED AI 4): waypoints or null. */
export function navPath(bake, from, to, opts) {
  return bake && bake.chf ? findPath(bake.chf, from, to, opts) : null;
}
