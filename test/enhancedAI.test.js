// ENHANCED AI 1: the navmesh ported whole, and triangles into its shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
});

test('ENHANCED AI 1: a floor becomes walkable spans, a wall becomes a column with no walkable top', () => {
  // a 4x4 m floor quad at y=0 and a 4 m wall along x=2 from y=0 to 3
  const P = [0, 0, 0, 4, 0, 0, 4, 0, 4, 0, 0, 4,   2, 0, 0, 2, 3, 0, 2, 3, 4, 2, 0, 4];
  const I = [0, 1, 2, 0, 2, 3,   4, 5, 6, 4, 6, 7];
  const cols = trianglesToColliders(P, I, { cs: 1, xmin: 0, zmin: 0 });
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
  // ANCHORED, as project-final bakes it (main.js:233): the component that
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
