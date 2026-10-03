// ENHANCED AI 1: the navmesh ported whole, and triangles into its shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { trianglesToColliders } from '../src/ai/triRaster.js';
import { buildNav, buildCompact, buildRegions, buildContours, buildPolyMesh, buildPolyMeshDetail, findPath, AGENT } from '../src/ai/navmesh.js';

test('ENHANCED AI 1: the navmesh body is project-final\u2019s, byte for byte from the agent params on', () => {
  const ours = readFileSync('src/ai/navmesh.js', 'utf8');
  const bodyStart = ours.indexOf('// Agent params');
  assert.ok(bodyStart > 0);
  // the two lines that differ are ABOVE the body: the inlined surfaceY and the linter globals
  const head = ours.slice(0, bodyStart);
  assert.match(head, /function surfaceY\(c, x, z\) \{\s*\n\s*if \(!c\.ramp\) return c\.top;/, 'terrain.js:17-22 inlined verbatim');
  assert.match(head, /\/\* global Buffer, btoa, atob \*\//);
  assert.ok(!/setNavGround|_ground/.test(ours), 'no seam of our own - the ground goes in as buildNav\u2019s `ground`');
  // AUDIT 62 F4 (2026-09-07): the pin above never read the BODY - every law from buildNav to the
  // funnel could change and it stayed green. The body is pinned by digest now: the sha256 of the
  // file from '// Agent params' on, re-recorded DELIBERATELY with the project-final commit the
  // change was made in (decision #3: a change is made in both repos and said in both).
  // Provenance: project-final navmesh.js (ENHANCED AI 1/2, 9f5e323 mergeHoles) + AUDIT 62 F1's
  // stacked-floor changes + AUDIT 68's collider index under surfH/surfHNear (S02-surfh-linear-scan),
  // made HERE FIRST and owed to project-final.
  const sum = createHash('sha256').update(ours.slice(bodyStart)).digest('hex');
  assert.equal(sum, 'c9f9cf0f107f22c6f6aec4f2790dd565f76cfe4509aac2eb9c318fdba8710c94',
    'THE BODY CHANGED: make the change in project-final too, say it in both repos, then re-pin this digest with the commit');
});

test('ENHANCED AI 1: a floor becomes walkable spans, a wall becomes a column with no walkable top', () => {
  // a 4x4 m floor quad at y=0 and a 4 m wall along x=2 from y=0 to 3
  const P = [0, 0, 0, 4, 0, 0, 4, 0, 4, 0, 0, 4,   2, 0, 0, 2, 3, 0, 2, 3, 4, 2, 0, 4];
  const I = [0, 1, 2, 0, 2, 3,   4, 5, 6, 4, 6, 7];
  const cols = trianglesToColliders(P, I, { cs: 1 });
  const floor = cols.filter((c) => c.top === 0 && !c.noNavTop);
  // Recast-faithful: a vertex ON a cell boundary spills into that cell (conservative, so thin walls never leak) - 5x4
  assert.equal(floor.length, 20, 'the 4 m floor covers cells 0..4 on the axis its edge lands on');
  const wall = cols.filter((c) => c.top === 3);
  assert.ok(wall.length >= 4 && wall.every((c) => c.noNavTop), 'the wall\u2019s cells stamp a 3 m column whose top is not floor');
  assert.ok(wall.every((c) => c.bottom === 0), 'solid from the floor up');
});

test('ENHANCED AI 1: a ramp within the slope walks, a steeper one does not', () => {
  const ramp = (h) => trianglesToColliders([0, 0, 0, 4, h, 0, 4, h, 4, 0, 0, 4], [0, 1, 2, 0, 2, 3], { cs: 1 });
  assert.ok(ramp(2).every((c) => !c.noNavTop), '2 m over 4 m: rise/run 0.5 < 0.7');
  assert.ok(ramp(4).every((c) => c.noNavTop), '4 m over 4 m: 1.0 > 0.7');
});

test('ENHANCED AI 1: a room of triangles bakes, and a path bends around a wall', () => {
  // 10x10 m floor, a 1x4 m wall at x 4.5..5.5 / z 3..7, walls at the edges
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  quad([0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]);                 // floor
  const box = (x0, x1, z0, z1, h) => {
    quad([x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]); quad([x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]);
    quad([x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]); quad([x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]);
    quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]);
  };
  box(4.5, 5.5, 3, 7, 3);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 3, b[1]], [a[0], 3, a[1]]);
  const cols = trianglesToColliders(P, I, { cs: AGENT.cs });
  const nav = buildNav(cols, AGENT);
  const chf = buildCompact(nav, AGENT);
  // ANCHORED, as project-final bakes it (main.js:332): the component that
  // holds the agents' home survives, everything else is dropped. The
  // anchor is an {x, z}; findPath's points are [x, y, z].
  buildRegions(chf, { anchor: { x: 1, z: 5 } }); buildContours(chf); buildPolyMesh(chf); buildPolyMeshDetail(chf, cols);
  const path = findPath(chf, [1, 0, 5], [9, 0, 5]);
  assert.ok(path && path.length >= 3, 'a path exists and it bends around the wall');
  const px = (p) => (Array.isArray(p) ? p[0] : p.x), pz = (p) => (Array.isArray(p) ? p[2] : p.z);
  for (const p of path) assert.ok(!(px(p) > 4.5 && px(p) < 5.5 && pz(p) > 3 && pz(p) < 7), `waypoint (${px(p).toFixed(2)},${pz(p).toFixed(2)}) is inside the wall`);
});

// ENHANCED AI 2: HOLES. buildPolyMesh's own line said "arena has none;
// hole-merging into the outer loop is future work". A free-standing
// pillar in a room is a hole contour, and a path ran straight through
// it. Recast's mergeRegionHoles, made in project-final (9f5e323) and
// ported: each hole bridged to its outer by a non-crossing diagonal and
// spliced in around it. The body is still his, byte for byte.
test('ENHANCED AI 2: a free-standing pillar is a hole in the mesh, and a path bends around it', () => {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  quad([0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]);
  const box = (x0, x1, z0, z1, h) => {
    quad([x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]); quad([x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]);
    quad([x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]); quad([x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]);
    quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]);
  };
  box(4.5, 5.5, 4.5, 5.5, 3);   // the pillar, free in the room
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 3, b[1]], [a[0], 3, a[1]]);
  const cols = trianglesToColliders(P, I, { cs: AGENT.cs });
  const nav = buildNav(cols, AGENT);
  const chf = buildCompact(nav, AGENT);
  buildRegions(chf, { anchor: { x: 1, z: 5 } }); buildContours(chf);
  assert.ok(chf.contours.some((c) => c.hole), 'the pillar is a hole contour');
  buildPolyMesh(chf); buildPolyMeshDetail(chf, cols);
  const path = findPath(chf, [1, 0, 5], [9, 0, 5]);
  assert.ok(path && path.length >= 3, `the path bends around the pillar (${path && path.length} points)`);
  // and no SEGMENT of it crosses the pillar - a two-point path through it has no waypoint inside, which is how ENHANCED AI 1 was fooled
  const px = (p) => (Array.isArray(p) ? p[0] : p.x), pz = (p) => (Array.isArray(p) ? p[2] : p.z);
  for (let k = 0; k + 1 < path.length; k++) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = px(path[k]) + (px(path[k + 1]) - px(path[k])) * t, z = pz(path[k]) + (pz(path[k + 1]) - pz(path[k])) * t;
      assert.ok(!(x > 4.5 && x < 5.5 && z > 4.5 && z < 5.5), `segment ${k} crosses the pillar at (${x.toFixed(2)},${z.toFixed(2)})`);
    }
  }
  const src = readFileSync('src/ai/navmesh.js', 'utf8');
  assert.match(src, /const mergeHoles = \(outer, holes\) => \{/, 'Recast’s mergeRegionHoles, in his file');
  assert.ok(!/arena has none; hole-merging into the outer loop is future work/.test(src), 'the limit’s line is gone');
});

// ENHANCED AI 3: A LEVEL BAKES FROM ITS OWN COLLIDER - the triangles the
// player collides with, read back from the buckets, one source. No
// phantom floor: a dungeon's floors are its own triangles.
test('ENHANCED AI 3: the bake reads the Collider\u2019s own triangles, needs an anchor, and lays no phantom floor', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const { navInputFromCollider, bakeNavFromCollider, navPath } = await import('../src/ai/navBake.js');
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  // a 10x10 room whose floor sits at y = -5 (a dungeon level below the world's zero), a pillar, walls
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  const Y = -5;
  quad([0, Y, 0], [10, Y, 0], [10, Y, 10], [0, Y, 10]);
  const box = (x0, x1, z0, z1, h) => {
    quad([x0, Y, z0], [x1, Y, z0], [x1, Y + h, z0], [x0, Y + h, z0]); quad([x1, Y, z0], [x1, Y, z1], [x1, Y + h, z1], [x1, Y + h, z0]);
    quad([x1, Y, z1], [x0, Y, z1], [x0, Y + h, z1], [x1, Y + h, z1]); quad([x0, Y, z1], [x0, Y, z0], [x0, Y + h, z0], [x0, Y + h, z1]);
    quad([x0, Y + h, z0], [x1, Y + h, z0], [x1, Y + h, z1], [x0, Y + h, z1]);
  };
  box(4.5, 5.5, 4.5, 5.5, 3);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) quad([a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y + 3, b[1]], [a[0], Y + 3, a[1]]);
  const collider = new Collider(() => -Infinity);
  collider.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);   // the dungeon host's own call
  const input = navInputFromCollider(collider);
  assert.equal(input.tris, I.length / 3, 'every triangle the collider holds');
  assert.equal(input.minY, Y);
  assert.throws(() => bakeNavFromCollider(collider, {}), /anchor is required/, 'a bake is always told where the agents live');
  const bake = bakeNavFromCollider(collider, { anchor: [1, Y, 5] });
  assert.ok(bake && bake.stats.polys > 0, `a mesh (${bake && bake.stats.polys} polys, ${bake && bake.stats.ms} ms)`);
  // NO PHANTOM FLOOR: the height layer answers the room's floor at every
  // point, never the world's zero and never the far floor the bake laid
  // to be dropped. (A mesh vertex's y is not the height - his detail
  // step is a query layer; v.y is snapped lazily for the dev overlay.)
  const { polyHeight, __locatePolyIndexed } = await import('../src/ai/navmesh.js');
  for (const [x, z] of [[1, 5], [9, 5], [5, 1], [5, 9], [2, 2]]) {
    const pi = __locatePolyIndexed(bake.chf, x, z);
    assert.ok(pi >= 0, `(${x},${z}) is on the mesh`);
    const h = polyHeight(bake.chf, pi, x, z);
    assert.ok(Math.abs(h - Y) < 0.6, `height at (${x},${z}) is ${h} - the floor is at ${Y}; 0 would be a phantom, ${Y - 10} the dropped far floor`);
  }
  const path = navPath(bake, [1, Y, 5], [9, Y, 5]);
  assert.ok(path && path.length >= 3, 'the path bends around the pillar, on the real floor');
  // a bake at AGENT.cs under budget keeps AGENT.cs (his coarsenAgent contract: undefined under budget)
  assert.equal(bake.stats.cs, 0.25);
});

// AUDIT 62 F38 (2026-09-07) left the ARENA2 pin a TODO that asserted nothing: the bake through the
// dungeon loader was unwritten. It is written below (DEGENERATE-BAKE ROOT (ARENA2)) - Privateer's Hold and
// the field dungeon m1204685, laid out as buildDungeonContext lays them, baked through the host's own call.
const ARENA2 = process.env.ARENA2_PATH;
const noArena2 = !ARENA2 || !existsSync(ARENA2);

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function soup() {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  const box = (x0, x1, y0, y1, z0, z1) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
    quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]); quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); quad([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]);
  };
  const room = (x0, x1, z0, z1, y, h = 3) => {   // floor, ceiling, four walls
    quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]); quad([x0, y + h, z0], [x0, y + h, z1], [x1, y + h, z1], [x1, y + h, z0]);
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]]) quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]]);
  };
  return { P, I, quad, box, room };
}
async function colliderOf(s, buckets = {}) {
  const { Collider } = await import('../src/player/collider.js');
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', new Float32Array(s.P), new Uint32Array(s.I), IDENTITY);
  for (const [k, b] of Object.entries(buckets)) c.addMesh(k, new Float32Array(b.P), new Uint32Array(b.I), IDENTITY);
  return c;
}
/** Two 6 m rooms, a 0.3 m wall between them and ONE doorway through it - the classic frame (55000-55005): 1.25 m
 *  wide, 2.22 m to the lintel. `off` slides it across the grid; `pad` stands a speck of floor that far off, because a
 *  dungeon's box is mostly empty and the box is what sized the old bake's cells. */
function doorwayLevel({ y = 12.8, door = 1.25, off = 0, pad = 0 } = {}) {
  const s = soup(), len = 6, wall = 0.3, X0 = off, X1 = off + 2 * len + wall, Z0 = off, Z1 = off + len;
  s.room(X0, X1, Z0, Z1, y);
  const wx0 = X0 + len, wx1 = wx0 + wall, dz0 = Z0 + len / 2 - door / 2, dz1 = dz0 + door;
  s.box(wx0, wx1, y, y + 3, Z0, dz0); s.box(wx0, wx1, y, y + 3, dz1, Z1); s.box(wx0, wx1, y + 2.22, y + 3, dz0, dz1);
  if (pad) s.quad([pad, y, pad], [pad + 1, y, pad], [pad + 1, y, pad + 1], [pad, y, pad + 1]);
  const door3 = soup(); door3.box(wx0 + 0.075, wx0 + 0.225, y + 0.03, y + 2.2, dz0 + 0.025, dz1 - 0.025);   // the 1.2 m leaf, closed
  return { s, door3, A: [X0 + 1.5, y, Z0 + len / 2], B: [X1 - 1.5, y, Z0 + len / 2] };
}

test('DEGENERATE-BAKE ROOT: a classic 1.25 m doorway joins two rooms at every grid alignment, however large the dungeon’s box', async () => {
  const { bakeNavFromCollider, navPath } = await import('../src/ai/navBake.js');
  for (const [pad, offsets] of [[0, 12], [160, 3]]) {
    for (let k = 0; k < offsets; k++) {
      const L = doorwayLevel({ off: k * 0.0237, pad });
      const bake = bakeNavFromCollider(await colliderOf(L.s), { anchor: L.A });
      // his coarsenAgent is for open terrain; a dungeon's box outgrows its budget at three blocks, and at 0.54-1.05 m
      // cells no 1.25 m doorway survives the erosion ring (the field bake: cs 0.72, 11 polys)
      assert.equal(bake.stats.cs, 0.25, `pad ${pad}: the cell stays 0.25 - a dungeon is not open terrain`);
      // AGENT's 0.4 m radius eroded two cells off each jamb over the conservative wall stamp: 0 of 12 alignments kept
      assert.ok(navPath(bake, L.A, L.B), `pad ${pad}, alignment ${k}: the far room is reached through the doorway`);
    }
  }
});

test('DEGENERATE-BAKE ROOT: a floor whose height lands on a voxel boundary is still a floor, and no phantom plane runs under the walls', async () => {
  const { bakeNavFromCollider, navPath } = await import('../src/ai/navBake.js');
  const { __locatePolyIndexed, polyHeight } = await import('../src/ai/navmesh.js');
  // a speck of floor at y = 0 sets minY, so the grid is based at -10.2 and (32 + 10.2) / 0.2 is exactly 211: the
  // room's floor, a zero-thickness box, quantised to nothing in addSpan (float32 16, 24, 32, 48 - 5,865 m2 of the field
  // dungeon's floors), the anchor elected the implicit plane 10 m under everything, and routes ran through walls
  const s = soup(); const Y = 32;
  s.room(0, 10, 0, 10, Y);
  s.quad([30, 0, 30], [31, 0, 30], [31, 0, 31], [30, 0, 31]);
  const bake = bakeNavFromCollider(await colliderOf(s), { anchor: [1, Y, 5] });
  const chf = bake.chf;
  const pi = __locatePolyIndexed(chf, 5, 5, Y);
  assert.ok(pi >= 0 && Math.abs(polyHeight(chf, pi, 5, 5) - Y) < 0.3, 'the room’s own floor is on the mesh');
  assert.ok(navPath(bake, [1, Y, 5], [9, Y, 5]), 'and routes across the room');
  assert.equal(navPath(bake, [1, Y, 5], [20, Y, 20]), null, 'but never out through its wall');
  for (const v of chf.mesh.verts) {
    const x = chf.xmin + v.x * chf.cs, z = chf.zmin + v.z * chf.cs;
    assert.ok(x >= 0 && x <= 10 && z >= 0 && z <= 10, `a mesh vertex at (${x.toFixed(2)}, ${z.toFixed(2)}) lies outside the room`);
  }
  // and the implicit plane is not laid at all: no span of the field stands under the level's lowest triangle
  for (const col of chf.spans) for (const sp of col) assert.ok(chf.ymin + sp.floor * chf.ch > -1, 'a span under the level - the phantom plane is back');
  assert.ok(Math.abs(polyHeight(chf, -1, 50, 50) - (0 - 10)) < 1e-9, 'while the height layer still answers the old floor off every box');
});

test('DEGENERATE-BAKE ROOT: a door a foe opens is left out of the soup, and the host leaves out every unlocked action door', async () => {
  const { NavClient } = await import('../src/ai/navClient.js');
  const { navPath } = await import('../src/ai/navBake.js');
  const L = doorwayLevel();
  const collider = await colliderOf(L.s, { 'act:0:7': L.door3 });
  const client = new NavClient({ store: null, WorkerCtor: undefined });
  const shut = await client.bake({ collider, anchor: L.A, key: 'dungeon:door' });
  assert.equal(navPath(shut, L.A, L.B), null, 'a closed door the soup keeps is a wall');
  const open = await client.bake({ collider, anchor: L.A, exclude: new Set(['act:0:7']), key: 'dungeon:door' });
  assert.ok(navPath(open, L.A, L.B), 'left out, its doorway is a passage (EnemyMotor.OpenDoors opens it)');
  const src = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  const call = src.slice(src.indexOf('enhancedNav.client.bake({ collider, anchor: [playerFeet[0], playerFeet[1], playerFeet[2]], '));
  const args = call.slice(0, call.indexOf('key: _locationKey })'));
  assert.ok(args.length > 0 && args.length < 400, 'the host\u2019s one bake call');
  assert.match(args, /exclude: new Set\(\[\.\.\.actions\.objects\.values\(\)\]\.filter\(\(o\) => isActionDoorObject\(o\) && !\(o\.currentLockValue > 0\)\)\.map\(\(o\) => o\.key\)\)/,
    'the host leaves out the doors openDoorsStep would open: action doors (not special ones), unlocked');
  assert.match(args, /anchors: enemies\.map\(\(e\) => floorLanding\(collider, \[e\.x, e\.y \+ 0\.2, e\.z\]\)\)/, 'and names every layout foe, floor-landed');
});

test('DEGENERATE-BAKE ROOT: every place agents live is kept - a foe’s room with no walk to the player survives the cull, and an anchor over no floor elects nothing', async () => {
  const { bakeNavFromCollider, navPath } = await import('../src/ai/navBake.js');
  const { __locatePolyIndexed, polyHeight } = await import('../src/ai/navmesh.js');
  // room A under a 0.2 m ceiling slab whose top is a roof; room B 20 m off and 12.8 m down with no walk between them -
  // a ledge dropped off one way, a flooded hall, a locked door (the field dungeon: 56 of 93 foes beyond the player's)
  const s = soup();
  s.room(0, 10, 0, 10, 12.8); s.box(0, 10, 15.8, 16.0, 0, 10);
  s.room(30, 40, 0, 10, 0);
  const collider = await colliderOf(s);
  const A = [2, 12.8, 5], FOE = [35, 0, 5], FOE2 = [38, 0, 8], MIDAIR = [5, 40, 5];
  const alone = bakeNavFromCollider(collider, { anchor: A });
  assert.equal(__locatePolyIndexed(alone.chf, 35, 5, 0), -1, 'anchored on the player alone, the foe’s room is culled');
  const served = bakeNavFromCollider(collider, { anchor: A, anchors: [FOE] });
  assert.ok(__locatePolyIndexed(served.chf, 35, 5, 0) >= 0, 'named, the foe’s room is kept');
  assert.ok(navPath(served, FOE, FOE2), 'and routes');
  // his pick takes the column's NEAREST span however far: over room A at y 40 that is the roof. A landed anchor has
  // a walkable span within ANCHOR_Y_TOLERANCE, so this one is dropped and elects nothing
  const mid = bakeNavFromCollider(collider, { anchor: A, anchors: [FOE, MIDAIR] });
  assert.equal(mid.stats.polys, served.stats.polys, 'an anchor in mid-air adds nothing');
  const up = __locatePolyIndexed(mid.chf, 5, 5, 16);
  assert.ok(up >= 0 && Math.abs(polyHeight(mid.chf, up, 5, 5) - 12.8) < 0.3, 'and no roof poly stands over room A');
});

// The field dungeon itself, and Privateer's Hold beside it, through the host's own parameters. The collider is laid
// out exactly as buildDungeonContext lays it (dungeonContext.js:601-763: every placement's model in the 'dungeon'
// bucket save the movers and special doors, which the action system files under their own keys with the doors),
// each model built as the pipeline builds it (dataPipeline.js:299: DUNGEON-SEAMS' patchSeams over the archive's mesh -
// AUDIT PRE-MERGE 0928 N6: the raw mesh is not the floor a player walks, since the merge brought the seams).
async function realDungeon(which) {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { Arch3dFile } = await import('../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../src/world/meshReader.js');
  const { customModelFor, emptyModel } = await import('../src/world/customModels.js');
  const { layoutDungeon } = await import('../src/world/dungeonLayout.js');
  const { trs, multiply } = await import('../src/world/mat4.js');
  const { Collider } = await import('../src/player/collider.js');
  const { ActionSystem, classifyPlacementAction } = await import('../src/world/actionSystem.js');
  const { floorLanding } = await import('../src/player/enterExit.js');
  const { collectDungeonEnemies } = await import('../src/characters/dungeonEnemies.js');
  const sd = await import('../src/world/spawnedDungeons.js');
  const { isMainStoryDungeon } = await import('../src/world/dungeonTextures.js');
  const { patchSeams } = await import('../src/world/arch3dSeams.js');
  const rd = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(rd('BLOCKS.BSA'));
  const arch = new Arch3dFile(); arch.load(rd('ARCH3D.BSA'));
  let loc;
  if (which === 'm1204685') {   // world.js:1125-1162's index, :1734-1740's pick: map pixel (109,156), salt 1
    const index = new Map();
    for (let r = 0; r < maps.regionCount; r++) { const region = maps.getRegion(r); if (!region) continue;
      for (let l = 0; l < region.locationCount; l++) { const L = maps.getLocation(r, l); if (!L?.exterior?.exteriorData) continue;
        const p = longitudeLatitudeToMapPixel(L.mapTableData.longitude, L.mapTableData.latitude); index.set(`${p.x},${p.y}`, L); } }
    const template = sd.pickTemplate(sd.spawnTemplates(index.values(), isMainStoryDungeon), 1, 109, 156);
    loc = sd.synthesizeDungeonLocation(template, { salt: 1, px: 109, py: 156 });
    assert.equal(loc.mapTableData.mapId, 1204685);
    assert.equal(template.name, "Ruins of Old Cothba's Farm");   // Totambu (region 51), ten blocks, the start W0000010.RDB
  } else loc = maps.getLocationByName('Daggerfall', "Privateer's Hold");
  const models = new Map();
  const model = (id) => { if (!models.has(id)) { const c = customModelFor(id); const i = c ? -1 : arch.getRecordIndex(id);
    models.set(id, c ?? (i === -1 ? null : dfMeshToModel(patchSeams(id, arch.getMesh(i)), () => ({ width: 1, height: 1 })))); } return models.get(id); };
  const dungeon = layoutDungeon(loc, blocks, (id) => model(id) ?? emptyModel());
  const collider = new Collider(() => -Infinity), actions = new ActionSystem(collider, {});
  let tris = 0;
  for (const [bi, b] of dungeon.blocks.entries()) {
    const origin = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) {
      const cpu = model(p.modelIdNum); if (!cpu) continue;
      const m = multiply(origin, p.matrix);
      const cls = p.action ? classifyPlacementAction(p.action.actionFlag, false) : null;
      if (cls === 'move') { actions.addAction(bi, p.position, cpu, m, p.action); continue; }
      if (cls === 'specialDoor') { actions.addSpecialDoor(bi, p.position, cpu, m, p.action); continue; }
      collider.addMesh('dungeon', cpu.positions, cpu.indices, m); tris += cpu.indices.length / 3;
    }
    for (const d of b.layout.actionDoors) { if (d.disabled) continue; const cpu = model(d.modelIdNum); if (!cpu) continue;
      actions.addDoor(cpu, multiply(origin, d.matrix), { ns: bi, positionKey: d.position, action: d.action, startingLockValue: d.startingLockValue, loadID: d.loadID }); }
  }
  const enemies = collectDungeonEnemies(dungeon.blocks.map((b) => ({ markers: b.layout.markers, waterLevel: b.layout.waterLevel, originX: b.originX, originZ: b.originZ })),
    { locationId: loc.dungeon.recordElement.header.locationId, dungeonType: loc.mapTableData.dungeonType, playerLevel: 1 });
  const m = dungeon.startMarker, start = floorLanding(collider, [m.x, m.y + 1.08, m.z]);   // startSpawn({ preferEnterMarker: false }): the walk-in
  return { loc, dungeon, collider, actions, enemies, start, tris, floorLanding };
}

test('DEGENERATE-BAKE ROOT (ARENA2): m1204685 and Privateer’s Hold bake a navmesh that serves their foes',
  noArena2 ? { skip: 'ARENA2_PATH not set or the path does not exist' } : {}, async () => {
    const { NavClient, DEGENERATE_POLY_SHARE, DEGENERATE_MIN_POLYS } = await import('../src/ai/navClient.js');
    const { navPath } = await import('../src/ai/navBake.js');
    const { isActionDoorObject } = await import('../src/world/actionSystem.js');
    const { __locatePolyIndexed, polyHeight } = await import('../src/ai/navmesh.js');
    // the far points are floors the port's own capsule walks to from the entry (player/collider.js move(), doors open)
    for (const [which, tris, far, minFoes] of [['m1204685', 16216, [61.93, 19.2, 100.18], 0.6], ['ph', 8406, [76.28, 12.81, 24.54], 0.6]]) {
      const D = await realDungeon(which);
      assert.equal(D.tris, tris, `${which}: the host's own triangle count (its console line)`);
      const exclude = new Set([...D.actions.objects.values()].filter((o) => isActionDoorObject(o) && !(o.currentLockValue > 0)).map((o) => o.key));
      const anchors = D.enemies.map((e) => D.floorLanding(D.collider, [e.x, e.y + 0.2, e.z]));
      const warned = []; const ow = console.warn; console.warn = (...a) => warned.push(a.join(' '));
      let bake;
      try { bake = await new NavClient({ store: null, WorkerCtor: undefined }).bake({ collider: D.collider, anchor: D.start, anchors, exclude, key: `dungeon:${which}` }); } finally { console.warn = ow; }
      assert.ok(!warned.some((w) => w.includes('degenerate')), `${which}: the guard is silent (${warned.join(' | ')})`);
      assert.equal(bake.stats.cs, 0.25, `${which}: the dungeon keeps its cell`);
      assert.ok(bake.stats.polys >= DEGENERATE_MIN_POLYS && bake.stats.polys >= bake.stats.tris * DEGENERATE_POLY_SHARE, `${which}: ${bake.stats.polys} polys from ${bake.stats.tris} triangles`);
      const path = navPath(bake, D.start, far);
      assert.ok(path && path.length >= 3, `${which}: a route from the entry to the far hall`);
      for (const p of path) { const pi = __locatePolyIndexed(bake.chf, p[0], p[2], p[1]); assert.ok(pi >= 0 && Math.abs(polyHeight(bake.chf, pi, p[0], p[2]) - p[1]) < 0.6, `${which}: waypoint (${p.map((v) => v.toFixed(2))}) on a floor`); }
      let on = 0; for (const f of anchors) { const pi = __locatePolyIndexed(bake.chf, f[0], f[2], f[1]); if (pi >= 0 && Math.abs(polyHeight(bake.chf, pi, f[0], f[2]) - f[1]) < 0.6) on++; }
      assert.ok(on >= anchors.length * minFoes, `${which}: ${on} of ${anchors.length} foes stand on the mesh`);
    }
  });

// ENHANCED AI 3b: the worker, the cache, the host. Pinned where node can
// reach: the client with no Worker bakes here and caches through an
// injected store (a second bake hits), a hydrated bake answers the same
// heights as a fresh one (the ground put back), and the host asks only
// with the switch on and only once.
test('DEGENERATE-BAKE ROOT: a worker that dies on a large soup leaves the classic motor standing - no main-thread bake - while a small soup, or a client that never had a worker, still bakes here (mutant: the guard dropped)', async () => {
  const { NavClient, DEGENERATE_MIN_TRIS } = await import('../src/ai/navClient.js');
  const { Collider } = await import('../src/player/collider.js');
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  class DyingWorker {
    constructor() { this.onmessage = null; this.onerror = null; }
    postMessage() { setTimeout(() => this.onerror?.({ message: 'out of memory' }), 0); }
    terminate() {}
  }
  // a floor of many small quads: over the guard's size, and a real room for bakeHere
  const soup = (n) => {
    const P = [], I = [];
    for (let i = 0; i < n; i++) {
      const x = (i % 40) * 0.5, z = Math.floor(i / 40) * 0.5, s0 = P.length / 3;
      P.push(x, 0, z, x + 0.5, 0, z, x + 0.5, 0, z + 0.5, x, 0, z + 0.5);
      I.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
    }
    const c = new Collider(() => -Infinity);
    c.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);
    return c;
  };
  const warns = [];
  const warn = console.warn;
  console.warn = (m) => warns.push(String(m));
  try {
    const big = soup(Math.ceil(DEGENERATE_MIN_TRIS / 2) + 10);
    const dying = new NavClient({ store: null, WorkerCtor: DyingWorker });
    assert.equal(await dying.bake({ collider: big, anchor: [1, 0, 1], key: 'big' }), null, 'no bake on the main thread');
    assert.ok(warns.some((w) => /nav worker failed on \d+ triangles - not baking on the main thread/.test(w)));
    const small = soup(20);
    const dying2 = new NavClient({ store: null, WorkerCtor: DyingWorker });
    assert.ok(await dying2.bake({ collider: small, anchor: [1, 0, 1], key: 'small' }), 'a small soup still bakes here');
    const none = new NavClient({ store: null, WorkerCtor: null });
    assert.ok(await none.bake({ collider: big, anchor: [1, 0, 1], key: 'big2' }), 'a client that never had a worker bakes here');
  } finally { console.warn = warn; }
});

test('ENHANCED AI 3b: the client bakes without a worker, caches, and a hydrated bake keeps the floor', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const { NavClient, navCacheKey } = await import('../src/ai/navClient.js');
  const { polyHeight, __locatePolyIndexed } = await import('../src/ai/navmesh.js');
  const { navPath } = await import('../src/ai/navBake.js');
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const P = [], I = []; const Y = -5;
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  quad([0, Y, 0], [10, Y, 0], [10, Y, 10], [0, Y, 10]);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) quad([a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y + 3, b[1]], [a[0], Y + 3, a[1]]);
  const collider = new Collider(() => -Infinity);
  collider.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);
  const mem = new Map(); const store = { async get(k) { return mem.get(k) ?? null; }, async set(k, v) { mem.set(k, v); } };
  const client = new NavClient({ store, WorkerCtor: undefined });
  const a = await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:test' });
  assert.ok(a && a.chf && !a.cached, 'baked here, no worker');
  const b = await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:test' });
  assert.ok(b.cached, 'the second bake is a cache hit');
  for (const bake of [a, b]) {
    const pi = __locatePolyIndexed(bake.chf, 5, 5);
    assert.ok(pi >= 0);
    assert.ok(Math.abs(polyHeight(bake.chf, pi, 5, 5) - Y) < 0.6, `${bake.cached ? 'hydrated' : 'fresh'}: the floor is ${Y}, not 0`);
    const path = navPath(bake, [1, Y, 5], [9, Y, 5]);
    assert.ok(path && path.length >= 2, `${bake.cached ? 'hydrated' : 'fresh'}: a path`);
    assert.ok(Math.abs(path[path.length - 1][1] - Y) < 0.6, 'the path\u2019s points sit on the real floor');
  }
  const k = navCacheKey({ key: 'dungeon:test', tris: 10, minY: -5, maxY: -2 });
  assert.notEqual(k, navCacheKey({ key: 'dungeon:test', tris: 11, minY: -5, maxY: -2 }), 'a different soup is a different key');
  assert.notEqual(k, navCacheKey({ key: 'dungeon:other', tris: 10, minY: -5, maxY: -2 }), 'a different dungeon');
  const src = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(src, /if \(playerFeet && !enhancedNav\.requested && getPref\('enhancedAI'\)\) \{/, 'the host asks once, with the switch on, once the feet are known');
  assert.match(src, /nav: \(\) => enhancedNav\.chf,/, 'and hands the bake to the motor through a thunk');   // AUDIT 68 S19-dead-api-exports: `api.enhancedNav` had no reader - the motor reads this
});

// DEGENERATE-BAKE GUARD (2026-09-20, Mac's patch): a report of foes
// standing idle across most of a dungeon traced to a navmesh bake that
// had culled almost the whole level. `buildRegions` keeps only the
// anchor's connected component, so a real bug - the voxelizer missing a
// real passage - and a genuinely disconnected region look IDENTICAL from
// here: a tiny poly count against a large amount of input geometry. This
// guard does not try to tell them apart, and does not need to. Either
// way, permanently caching that result is the wrong call, because the
// store survives a reload and the key is stable for the same dungeon: a
// bad bake deserves a fresh attempt next visit, not to be stuck for good.
test('ENHANCED AI 3b / DEGENERATE-BAKE: a bake that culls almost everything is not cached, so the next visit retries', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const { NavClient, DEGENERATE_MIN_TRIS, DEGENERATE_MIN_POLYS } = await import('../src/ai/navClient.js');
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const P = [], I = []; const Y = -5;
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  // the small room the anchor stands in - the only thing that should bake into polys
  quad([0, Y, 0], [10, Y, 0], [10, Y, 10], [0, Y, 10]);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) {
    quad([a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y + 3, b[1]], [a[0], Y + 3, a[1]]);
  }
  // ...and a big mass of floor with no shared edge to it. Finely subdivided
  // rather than placed far away, so the bake stays cheap here; it stands in
  // for "most of a large dungeon", whether that is a real gap or a missed
  // corridor.
  for (let i = 0; i < 1200; i++) {
    const ox = 15 + (i % 40) * 0.3, oz = Math.floor(i / 40) * 0.3;
    quad([ox, Y, oz], [ox + 0.3, Y, oz], [ox + 0.3, Y, oz + 0.3], [ox, Y, oz + 0.3]);
  }
  const collider = new Collider(() => -Infinity);
  collider.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);
  const mem = new Map();
  const store = { async get(k) { return mem.get(k) ?? null; }, async set(k, v) { mem.set(k, v); } };
  const warnings = []; const origWarn = console.warn; console.warn = (...a) => warnings.push(a.join(' '));
  try {
    const client = new NavClient({ store, WorkerCtor: undefined });
    const a = await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:degenerate' });
    assert.ok(a && a.chf && !a.cached, 'baked here, no worker');
    // the fixture really is the shape this guard is about: a large input
    // that came back with almost nothing, which is what the numbers see.
    assert.ok(a.stats.polys < DEGENERATE_MIN_POLYS, `sanity: the anchor's own room is all that connected (${a.stats.polys} polys)`);
    assert.ok(I.length / 3 >= DEGENERATE_MIN_TRIS,
      'and the input is genuinely large, which is what keeps an honestly-small dungeon out of this');
    assert.equal(mem.size, 0, 'a bake this disproportionate to its input never reaches the store');
    assert.ok(warnings.some((w) => w.includes('degenerate')), 'and says so on the console, for a report exactly like the one that found it');
    const b = await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:degenerate' });
    assert.equal(b.cached, false, 'so the very next visit gets a fresh bake, not the same bad one for ever');
  } finally {
    console.warn = origWarn;
  }
});

// ...and the other half of the law: an honestly SMALL dungeon - few
// triangles, honestly few polys - is never touched by the guard. This is
// the pin the first cut of the rule needed: it measured against the
// voxelizer's own box count, and a tall thin wall voxelizes into far more
// boxes than its floor does, so a perfectly healthy little room tripped
// it. The guard measures `input.tris`, the same stable count the cache key
// is built from.
test('ENHANCED AI 3b / DEGENERATE-BAKE: an honestly small dungeon still caches', async () => {
  const { Collider } = await import('../src/player/collider.js');
  const { NavClient, DEGENERATE_MIN_TRIS } = await import('../src/ai/navClient.js');
  const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const P = [], I = []; const Y = -5;
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  quad([0, Y, 0], [10, Y, 0], [10, Y, 10], [0, Y, 10]);
  for (const [a, b] of [[[0, 0], [10, 0]], [[10, 0], [10, 10]], [[10, 10], [0, 10]], [[0, 10], [0, 0]]]) {
    quad([a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], Y + 3, b[1]], [a[0], Y + 3, a[1]]);
  }
  assert.ok(I.length / 3 < DEGENERATE_MIN_TRIS, 'the fixture is below the guard’s floor, which is the whole point');
  const collider = new Collider(() => -Infinity);
  collider.addMesh('dungeon', new Float32Array(P), new Uint32Array(I), Id);
  const mem = new Map();
  const store = { async get(k) { return mem.get(k) ?? null; }, async set(k, v) { mem.set(k, v); } };
  const client = new NavClient({ store, WorkerCtor: undefined });
  await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:small' });
  assert.equal(mem.size, 1, 'a small room bakes small and is cached, as it always was');
  const again = await client.bake({ collider, anchor: [1, Y, 5], key: 'dungeon:small' });
  assert.equal(again.cached, true, 'and comes back from the store on the next visit');
});
