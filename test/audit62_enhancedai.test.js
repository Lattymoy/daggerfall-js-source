// AUDIT 62 (2026-09-07), the ENHANCED AI lens - the navmesh under a STACKED
// dungeon. project-final's arenas had no floor over a floor; a Daggerfall
// dungeon is built of them, and the poly-mesh stage welded every vertex by
// (x,z) alone, so the levels fused, the shared edges got 3-4 owners,
// adjacency refused them and findPath answered null on BOTH floors - the
// enhanced switch silently fell back to classic exactly where it was built
// to help. The fixes: Recast's two-voxel weld (RecastMesh.cpp:143) with a
// same-region arm for the lattice cuts, the cut point's interpolated height,
// vertex heights that survive the bake, a locate that prefers the query's
// level, waypoint heights on the corridor's own level, and a cache key that
// carries its version and its anchor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../src/player/collider.js';
import { bakeNavFromCollider } from '../src/ai/navBake.js';
import { findPath, bakeNavData, hydrateBakedNav, locatePolyLinear, __locatePolyIndexed, polyHeight, AGENT } from '../src/ai/navmesh.js';
import { navCacheKey, NAV_BAKE_VERSION } from '../src/ai/navClient.js';

const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A 16x12 hall with a mezzanine at y=3 over z 4..12, a ramp up to it along
 *  the north wall, and a pillar that stands on the LOWER floor only. */
function stackedRoom({ mezz = true, pillar = true } = {}) {
  const c = new Collider(() => -1000);
  const quad = (key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), QUAD, I);
  quad('floor', [0, 0, 0], [16, 0, 0], [16, 0, 12], [0, 0, 12]);
  quad('n', [0, 0, 0], [16, 0, 0], [16, 6, 0], [0, 6, 0]); quad('s', [16, 0, 12], [0, 0, 12], [0, 6, 12], [16, 6, 12]);
  quad('w', [0, 0, 12], [0, 0, 0], [0, 6, 0], [0, 6, 12]); quad('e', [16, 0, 0], [16, 0, 12], [16, 6, 12], [16, 6, 0]);
  if (mezz) { quad('mezz', [0, 3, 4], [16, 3, 4], [16, 3, 12], [0, 3, 12]); quad('ramp', [2, 0, 0], [8, 3, 0], [8, 3, 4], [2, 0, 4]); quad('land', [8, 3, 0], [16, 3, 0], [16, 3, 4], [8, 3, 4]); }
  const box = (k, x0, x1, z0, z1, y0, y1) => { quad(k + 'a', [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad(k + 'b', [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]); quad(k + 'c', [x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]); quad(k + 'd', [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]); };
  if (pillar) box('pillar', 7, 9, 6, 8, 0, 3);
  return c;
}
const overOwned = (mesh) => { const em = new Map(); for (const p of mesh.polys) { const v = p.verts; for (let e = 0; e < v.length; e++) { const a = v[e], b = v[(e + 1) % v.length], k = Math.min(a, b) + ',' + Math.max(a, b); em.set(k, (em.get(k) || 0) + 1); } } let n = 0; for (const c of em.values()) if (c > 2) n++; return n; };
const components = (mesh) => { const seen = new Set(); let n = 0; for (let p = 0; p < mesh.polys.length; p++) { if (seen.has(p)) continue; n++; const q = [p]; seen.add(p); while (q.length) { const a = q.pop(); for (const nb of mesh.polys[a].neis) if (nb >= 0 && !seen.has(nb)) { seen.add(nb); q.push(nb); } } } return n; };

test('AUDIT 62 F1: a floor over a floor bakes as ONE connected mesh, and both levels route', () => {
  const bake = bakeNavFromCollider(stackedRoom(), { anchor: [2, 0, 8] });
  const chf = bake.chf, mesh = chf.mesh;
  assert.equal(overOwned(mesh), 0, 'no edge has three or four owners (the levels no longer fuse)');
  assert.equal(components(mesh), 1, 'one component: the ramp joins the two floors');
  const lower = findPath(chf, [4, 0, 7], [12, 0, 7]);
  assert.ok(lower && lower.length >= 4, `the lower floor routes ROUND its pillar: ${JSON.stringify(lower)}`);
  assert.ok(lower.every((p) => p[1] < 0.5), 'and stays on the lower floor under the mezzanine');
  const upper = findPath(chf, [4, 3, 10], [12, 3, 10]);
  assert.deepEqual(upper.map((p) => p.map((v) => +v.toFixed(2))), [[4, 3, 10], [12, 3, 10]], 'the upper floor is straight over the pillar it does not have');
  const cross = findPath(chf, [1, 0, 2], [12, 3, 10]);
  assert.ok(cross && cross.length >= 3, 'a cross-level route exists');
  assert.ok(cross[0][1] < 0.5 && cross[cross.length - 1][1] > 2.5, 'and climbs from the lower floor to the mezzanine');
  assert.ok(cross.some((p) => p[1] > 0.5 && p[1] < 2.9), `...through the ramp, not a teleport: ${JSON.stringify(cross)}`);
  // the control room (no mezzanine) still bakes the shape it always did
  const flat = bakeNavFromCollider(stackedRoom({ mezz: false }), { anchor: [2, 0, 8] }).chf;
  assert.equal(flat.mesh.polys.length, 54, 'the single-level arena is unchanged by the weld');
  assert.equal(findPath(flat, [4, 0, 7], [12, 0, 7]).length, 4);
});

test('AUDIT 62 F1: the locate prefers the query’s level; a waypoint’s height is its corridor’s, not the tallest top', () => {
  const chf = bakeNavFromCollider(stackedRoom(), { anchor: [2, 0, 8] }).chf;
  const lo = __locatePolyIndexed(chf, 10, 10, 0), hi = __locatePolyIndexed(chf, 10, 10, 3);
  assert.notEqual(lo, hi, 'the same (x,z) at y 0 and y 3 lands on two polys');
  assert.ok(polyHeight(chf, lo, 10, 10) < 0.5 && polyHeight(chf, hi, 10, 10) > 2.5, 'each poly reports ITS floor under the overlap');
  assert.equal(__locatePolyIndexed(chf, 10, 10), locatePolyLinear(chf, 10, 10), 'with no height the first-inside law and the linear oracle still agree');
});

test('AUDIT 62 F1: the bake carries vertex heights, and a hydrated stacked mesh still tells its floors apart', () => {
  const chf = bakeNavFromCollider(stackedRoom(), { anchor: [2, 0, 8] }).chf;
  const baked = bakeNavData(chf);
  assert.equal(baked.stride, 3);
  assert.equal(baked.v.length, chf.mesh.verts.length * 3);
  const hyd = hydrateBakedNav(baked, chf.colliders);
  hyd.ground = chf.ground;
  assert.equal(components(hyd.mesh), 1);
  const lower = findPath(hyd, [4, 0, 7], [12, 0, 7]);
  assert.ok(lower && lower.length >= 4 && lower.every((p) => p[1] < 0.5), 'hydrated: the lower route stays low');
  const upper = findPath(hyd, [4, 3, 10], [12, 3, 10]);
  assert.ok(upper && upper.every((p) => p[1] > 2.5), 'hydrated: the upper route stays high');
  // a stride-2 bake from before the fix still hydrates (heights 0), so an old golden cannot throw
  const old = { ...baked, v: baked.v.filter((_, i) => i % 3 !== 2), stride: undefined };
  assert.equal(hydrateBakedNav(old, chf.colliders).mesh.verts.length, chf.mesh.verts.length);
});

test('AUDIT 62 F3: the nav cache key is versioned past the fixes and carries its anchor', () => {
  assert.equal(NAV_BAKE_VERSION, 2);
  const base = { key: 'loc', tris: 10, minY: -5, maxY: 3, agent: AGENT };
  assert.match(navCacheKey(base), /^nav:v2:/);
  const door = navCacheKey({ ...base, anchor: [1, 0, 1] }), pocket = navCacheKey({ ...base, anchor: [40, -6, 40] });
  assert.notEqual(door, pocket, 'a bake anchored in a teleporter pocket is not the front door’s bake');
  assert.equal(navCacheKey({ ...base, anchor: [1.1, 0, 1.2] }), door, 'the same cell is the same key');
});
