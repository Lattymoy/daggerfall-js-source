// ENHANCED AI 3: A LEVEL BAKES FROM ITS OWN COLLIDER. The Collider keeps
// every bucket's triangles in world space - the exact triangles the
// player and the enemies collide with - so the navmesh is baked from
// those and nothing else: "the nav's ground and the game's ground are
// one source" (project-final/navmesh.js:32), kept verbatim as a law.
//
// Pure: a Collider in, a compact heightfield with its poly mesh out.
// No worker here (the client that owns the worker and the cache is
// ENHANCED AI 3b); no motor here (ENHANCED AI 4). Everything below is
// pinnable on a synthetic room, and the real dungeons are pinned behind
// ARENA2 (test/enhancedAI.test.js, DEGENERATE-BAKE ROOT).
//
// THE PHANTOM FLOOR. project-final's buildNav lays an implicit floor
// under every cell - y = 0 for its arenas, or the terrain when a ground
// is given. A dungeon has neither: its floors are its own triangles and
// a plane at y = 0 across the whole level would be a floor that is not
// there. So none is laid (2026-09-27; bakeSoup says why): the ground the
// height layer falls back to still sits ten metres below the lowest
// triangle, where no real floor can step onto it.

import { trianglesToColliders } from './triRaster.js';
import {
  AGENT, buildNav, buildCompact, buildRegions, buildContours,
  buildPolyMesh, buildPolyMeshDetail, findPath,
} from './navmesh.js';

/** THE SOUP AGENT (2026-09-27): AGENT with ONE ring of erosion (radius =
 *  cs). Every classic dungeon doorway is 1.25 m (frames 55000-55005; the
 *  1.2 m door fills it), and AGENT's 0.4 m radius erodes two 0.25 m cells
 *  off each jamb on top of the conservative wall stamp: 0 of 12 grid
 *  alignments kept such a doorway, so every room baked sealed. One ring
 *  keeps a 1.2 m opening at all 12, and a gap of 0.75 m or less still
 *  never links (a body is 0.7 m: the port's capsule is 0.35 m, and the
 *  classic motor slides along whatever a route grazes). His AGENT is
 *  untouched. */
export const SOUP_AGENT = Object.freeze({ ...AGENT, radius: AGENT.cs });

/** How far (m) an anchor's feet may sit from the walkable span it elects:
 *  a floor-landed foot is on its floor to within a voxel's rounding. */
export const ANCHOR_Y_TOLERANCE = 0.6;

/** The world-space triangle soup a Collider holds, flattened. Each
 *  bucket's translation (the streamed world's floating origin) is
 *  applied so the soup is in the frame the queries use. `exclude` names
 *  buckets left out - the dungeon's openable doors, which are the motor's
 *  to open, not the navmesh's walls. */
export function navInputFromCollider(collider, { buckets = null, exclude = null } = {}) {
  const pos = []; const idx = [];
  let minY = Infinity, maxY = -Infinity, tris = 0;
  for (const [key, bucket] of collider._buckets) {
    if (buckets && !buckets.includes(key)) continue;
    if (exclude && exclude.has(key)) continue;
    const t = bucket.t ? bucket.t() : [0, 0, 0];
    const R = bucket.r ? bucket.r() : null;   // AUDIT NAV1 (#12): a mover's bucket, its triangles turned as they stand
    for (const tri of bucket.tris) {
      const [a, b, c] = R ? tri.map((v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]]) : tri;
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
 * The anchors buildRegions is handed, each LANDED on the compact field: a
 * walkable span within ANCHOR_Y_TOLERANCE of its feet, in its own column
 * or, when that cell is the eroded margin beside a wall, one of the eight
 * around it - moved onto that span's cell and floor, or dropped. His pick
 * takes the column's nearest span however far it is, and an anchor over
 * an eroded or missing floor elected a roof or the phantom ground.
 */
export function landAnchors(chf, anchors, tol = ANCHOR_Y_TOLERANCE) {
  const out = [];
  for (const a of anchors) {
    if (!a) continue;
    const ax = Math.floor((a[0] - chf.xmin) / chf.cs), az = Math.floor((a[2] - chf.zmin) / chf.cs);
    let best = null;
    for (let r = 0; r <= 1 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const ix = ax + dx, iz = az + dz;
      if (ix < 0 || iz < 0 || ix >= chf.nx || iz >= chf.nz) continue;
      for (const s of chf.spans[ix + iz * chf.nx]) {
        if (!s.walkable) continue;
        const y = chf.ymin + s.floor * chf.ch, dy = Math.abs(y - a[1]);
        if (dy <= tol && (!best || dy < best.dy)) best = { x: chf.xmin + (ix + 0.5) * chf.cs, y, z: chf.zmin + (iz + 0.5) * chf.cs, dy };
      }
    }
    if (best) out.push({ x: best.x, y: best.y, z: best.z });
  }
  return out;
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
export function bakeSoup(positions, indices, { floor, anchor, anchors = null, agent = SOUP_AGENT }) {
  const t0 = (globalThis.performance ?? Date).now();
  // NO COARSENING (2026-09-27). coarsenAgent is his rule for OPEN TERRAIN
  // ("open terrain does not need fine cells"), and it sizes by the soup's
  // BOX: every classic dungeon's block box is three blocks (153.6 m) or
  // more a side, so all 4232 coarsen - to 0.54-1.05 m cells, at which no
  // 1.25 m doorway survives one erosion ring. The anchor's room was the
  // whole navmesh: 11 polys from 17,592 triangles in the field, 130 in
  // Privateer's Hold. A soup bake keeps the agent's cell; the soup is
  // still voxelised ONCE.
  const ag = agent;
  const cols = trianglesToColliders(positions, indices, { cs: ag.cs, maxSlope: ag.maxSlope });
  // NO IMPLICIT FLOOR: an `at` that answers -Infinity lays none (addSpan
  // drops the inverted span). The phantom plane was one span in EVERY
  // cell - nearly half the bake's heap and time (the field dungeon: 948
  // to 505 MB, 8.8 to 5.0 s), culled from every bake - and the component
  // an anchor over a lost floor, or no anchor at all (buildRegions'
  // largest-component fallback), elected. The same floor goes back on
  // the compact field for the height layer's fallback.
  let nav = buildNav(cols, ag, [], { at: () => -Infinity, min: floor });
  const cells = nav.nx * nav.nz;
  const chf = buildCompact(nav, ag);
  nav = null;   // the solid field is spent once the compact one stands
  chf.ground = { at: () => floor, min: floor };
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
  // EVERY PLACE AGENTS LIVE (2026-09-27): his anchor UNION (FOUNDRY S3 ->
  // the experiment integration) - the player's feet and each foe's. A
  // classic dungeon is legitimately segmented for a walker: ledges dropped
  // off one way, flooded halls, locked doors. With the fixes above the
  // player's component still held only 37 of the field dungeon's 93 foes
  // and 23 of Privateer's Hold's 42 - the rest stand beyond a one-way drop
  // or a locked door, and had no mesh at all. Each foe's anchor is landed
  // first (landAnchors) or dropped; the player's feet always stand in the
  // union, and unlanded they take his nearest-span pick, so none landing
  // keeps his single-anchor pick exactly.
  const feet = landAnchors(chf, [anchor]);
  const landed = [...(feet.length ? feet : [regionAnchor(anchor)]), ...landAnchors(chf, anchors ?? [])];   // AUDIT PRE-MERGE 0928 N2: feet that do not land (a load while swimming or levitating) stay in the union - the foes' alone culled the player's own room
  buildRegions(chf, { anchor: regionAnchor(anchor), anchors: landed });
  buildContours(chf);
  buildPolyMesh(chf);
  buildPolyMeshDetail(chf, cols);
  const ms = Math.round((globalThis.performance ?? Date).now() - t0);
  return { chf, cols, agent: ag, stats: { tris: Math.floor(indices.length / 3), boxes: cols.length, cs: ag.cs, cells, polys: chf.mesh?.polys?.length ?? 0, ms } };
}

/**
 * Bake. `anchor` is where the agents live - the player's entry - and it
 * is REQUIRED: his buildRegions elects the component that holds it and
 * drops the rest (project-final/main.js:233 bakes anchored, always).
 * @returns {{ chf, cols, agent, stats }}
 */
export function bakeNavFromCollider(collider, { anchor, anchors = null, agent = SOUP_AGENT, buckets = null, exclude = null } = {}) {
  if (!anchor) throw new Error('bakeNavFromCollider: an anchor is required - the navmesh serves the component the agents live in');
  const input = navInputFromCollider(collider, { buckets, exclude });
  if (!input.tris) return null;
  return bakeSoup(input.positions, input.indices, { floor: input.minY - 10, anchor, anchors, agent });
}

/** The one query the motor will use (ENHANCED AI 4): waypoints or null. */
export function navPath(bake, from, to, opts) {
  return bake && bake.chf ? findPath(bake.chf, from, to, opts) : null;
}
