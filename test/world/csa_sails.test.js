// CSA-B (2026-09-27) - COME SAIL AWAY'S SAILS, BAKED (world/skinnedBake.js):
// FixDeformations' tenth-of-a-second timer in Unity's floats, BakeMesh (one
// bone per vertex, the renderer's position and rotation undone and its scale
// kept) and RecalculateNormals (Unity's cross(b - a, c - a), summed per index
// unnormalised). On the vendored sails the skinning is checked against what
// Unity itself stored: each skinned renderer's box (m_AABB, in its root bone's
// frame, which Unity measured off this same pose), and the orientation of the
// bundle's own imported normals.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../src/systems/comeSailAway/comeSailAwayModels.js';
import { Boat, spawnBoat } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { resolveNodePointer } from '../../src/world/prefabNode.js';
import { bakeSkinnedMesh, recalculateNormals, fixDeformationsTick, FIX_DEFORMATIONS_INTERVAL } from '../../src/world/skinnedBake.js';
import { multiply } from '../../src/world/mat4.js';
import { mat4FromQuatPosScale } from '../../src/world/quat.js';

const DIR = new URL('../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MESHES = json('meshes.json');
const BIN = new Uint8Array(readFileSync(new URL('meshes.bin', DIR)));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: MESHES, bin: BIN, materials: json('materials.json'), animation: json('animation.json') });
const ctx = { models: MODELS, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: () => [1, 2], modelBounds: () => ({ min: [0, 0, 0], max: [1, 1, 1] }) };
const apply = (m, p) => [0, 1, 2].map((d) => m[d] * p[0] + m[4 + d] * p[1] + m[8 + d] * p[2] + m[12 + d]);
const turn = (m, p) => [0, 1, 2].map((d) => m[d] * p[0] + m[4 + d] * p[1] + m[8 + d] * p[2]);
function invertAffine(m) {
  const a = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = a;
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const k = 1 / (a00 * c00 + a01 * c01 + a02 * c02);
  const i = [c00 * k, (a02 * a21 - a01 * a22) * k, (a01 * a12 - a02 * a11) * k, c01 * k, (a00 * a22 - a02 * a20) * k, (a02 * a10 - a00 * a12) * k, c02 * k, (a01 * a20 - a00 * a21) * k, (a00 * a11 - a01 * a10) * k];
  const o = new Float32Array(16);
  o[0] = i[0]; o[4] = i[1]; o[8] = i[2]; o[1] = i[3]; o[5] = i[4]; o[9] = i[5]; o[2] = i[6]; o[6] = i[7]; o[10] = i[8];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}
/** Every walked sail of the five hulls (the skiff as variant 5): the node, its renderer, geometry, bones and holder. */
function sails() {
  const out = [];
  for (let hull = 0; hull < 5; hull++) {
    const boat = spawnBoat(new Boat(hull, hull === 1 ? 5 : 0), ctx);
    boat.GameObject.localPosition = [812.5, -3.25, 1640.75];   // a boat out in the world, turned: the bake must not care
    boat.GameObject.localRotation = [0, Math.sin(0.6), 0, Math.cos(0.6)];
    for (const n of boat.GameObject.walk()) {
      const smr = n.getComponent('SkinnedMeshRenderer');
      if (!smr || !n.activeInHierarchy) continue;
      const g = MODELS.geometry(smr.m_Mesh.mesh);
      out.push({ hull, n, smr, g, bones: smr.m_Bones.map((b) => resolveNodePointer(n, b)), root: resolveNodePointer(n, smr.m_RootBone), holder: n.getChild(n.childCount - 1) });
    }
  }
  return out;
}

test('CSA-B: FixDeformations\' timer counts Time.deltaTime in Unity\'s floats and bakes on the frame after it passes 0.1f - eight frames apart at 60 fps, never while the game is paused', () => {
  assert.equal(FIX_DEFORMATIONS_INTERVAL, Math.fround(0.1));
  const s = { timer: 0, interval: 0.1 };
  const baked = [];
  for (let f = 1; f <= 24; f++) if (fixDeformationsTick(s, 1 / 60)) baked.push(f);
  assert.deepEqual(baked, [8, 16, 24]);
  const p = { timer: 0, interval: 0.1 };
  for (let f = 0; f < 100; f++) assert.equal(fixDeformationsTick(p, 0), false);
  // 0.05 + 0.05 is 0.1f exactly, which is not MORE than 0.1f: the bake waits a frame more
  const h = { timer: 0, interval: 0.1 };
  assert.deepEqual([1, 2, 3, 4].map(() => fixDeformationsTick(h, 0.05)), [false, false, false, true]);
  assert.equal(h.timer, 0);
});

test('CSA-B: BakeMesh - a vertex through its bone and bind pose into the world, then into the renderer\'s frame with its position and rotation undone and its scale kept', () => {
  const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const boneWorld = mat4FromQuatPosScale(q, [1, 2, 3], [2, 2, 2]);
  const bind = mat4FromQuatPosScale([0, 0, 0, 1], [0, -1, 0], [1, 1, 1]);
  const g = { vertexCount: 2, positions: new Float32Array([0, 1, 0, 1, 1, 0]), blendIndices: new Uint16Array([0, 0]) };
  const renderer = { position: [1, 0, 0], rotation: q };
  const out = bakeSkinnedMesh(g, [boneWorld], [bind], renderer);
  // vertex 0: bind (0,0,0) -> bone (1,2,3); renderer frame: - (1,0,0) = (0,2,3), -90 about Y = (-3,2,0)
  // vertex 1: bind (1,0,0) -> bone: scale 2 (2,0,0), +90 about Y (0,0,-2), + (1,2,3) = (1,2,1); renderer frame: - (1,0,0) = (0,2,1), -90 about Y = (-1,2,0)
  const want = [[-3, 2, 0], [-1, 2, 0]];
  for (let v = 0; v < 2; v++) for (let d = 0; d < 3; d++) assert.ok(Math.abs(out[v * 3 + d] - want[v][d]) < 1e-5, `vertex ${v} axis ${d}: ${out[v * 3 + d]}`);
});

test('CSA-B: RecalculateNormals - Unity\'s cross(b - a, c - a), summed per vertex INDEX unnormalised (a bigger triangle weighs more), each sum normalised, a vertex with no area keeping zero', () => {
  // two triangles on one shared edge (vertices 0 and 1), one in the XY plane and a bigger one tilted up
  const positions = new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0, -2, 0, 2, 5, 5, 5]);
  const indices = new Uint32Array([0, 1, 2, 1, 0, 3, 4, 4, 4]);
  const n = recalculateNormals(positions, indices, [{ startIndex: 0, primitiveCount: 2 }, { startIndex: 6, primitiveCount: 1 }]);
  // triangle 0: cross((0,1,0),(1,0,0)) = (0,0,-1), area 0.5; triangle 1: cross((0,-1,0),(-2,-1,2)) = (-2,0,-2), area |..|/2
  assert.deepEqual([...n.slice(6, 9)], [0, 0, -1], 'a lone clockwise face: its normal toward the viewer (Unity\'s front)');
  const s = [-2, 0, -3], l = Math.hypot(...s);
  for (let d = 0; d < 3; d++) assert.ok(Math.abs(n[d] - s[d] / l) < 1e-6 && Math.abs(n[3 + d] - s[d] / l) < 1e-6, 'the shared edge: the raw sum, normalised');
  const t = [-2, 0, -2], lt = Math.hypot(...t);
  for (let d = 0; d < 3; d++) assert.ok(Math.abs(n[9 + d] - t[d] / lt) < 1e-6);
  assert.deepEqual([...n.slice(12, 15)], [0, 0, 0], 'a degenerate triangle leaves its vertex a zero normal');
  // the bundle's imported normals face the same way as that cross product on all but a handful of its triangles
  let agree = 0, disagree = 0;
  for (const [k, m] of Object.entries(MESHES)) {
    const g = MODELS.geometry(k);
    for (let i = 0; i < g.indices.length; i += 3) {
      const [a, b, c] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]];
      const P = (v, d) => g.positions[v * 3 + d];
      const u = [0, 1, 2].map((d) => P(b, d) - P(a, d)), w = [0, 1, 2].map((d) => P(c, d) - P(a, d));
      const x = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const dot = x[0] * g.normals[a * 3] + x[1] * g.normals[a * 3 + 1] + x[2] * g.normals[a * 3 + 2];
      if (dot > 0) agree++; else if (dot < 0) disagree++;
    }
    assert.ok(m);
  }
  assert.deepEqual([agree, disagree], [18060, 9]);
});

test('CSA-B: the vendored sails skin as Unity skinned them - in each root bone\'s frame the skinned mesh fills the box Unity stored for the renderer (m_AABB), and the holder shows the bake exactly where the skinned renderer would have drawn it, the galleon\'s scaled sail included', () => {
  const all = sails();
  assert.equal(all.length, 11);
  let scaled = 0;
  for (const { n, smr, g, bones, root, holder } of all) {
    assert.ok(bones.every(Boolean) && root, `${n.name}: every bone and the root bone resolve in the instance`);
    const world = bones.map((b, i) => multiply(b.worldMatrix(), g.bindPoses[i], new Float32Array(16)));
    const toRoot = invertAffine(root.worldMatrix());
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < g.vertexCount; v++) {
      const p = apply(toRoot, apply(world[g.blendIndices[v]], [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]));
      for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], p[d]); hi[d] = Math.max(hi[d], p[d]); }
    }
    const c = [smr.m_AABB.m_Center.x, smr.m_AABB.m_Center.y, smr.m_AABB.m_Center.z], e = [smr.m_AABB.m_Extent.x, smr.m_AABB.m_Extent.y, smr.m_AABB.m_Extent.z];
    for (let d = 0; d < 3; d++) {
      assert.ok(Math.abs((lo[d] + hi[d]) / 2 - c[d]) < 0.025, `${n.name} axis ${d}: centre ${(lo[d] + hi[d]) / 2} vs Unity's ${c[d]}`);
      assert.ok(Math.abs((hi[d] - lo[d]) / 2 - e[d]) < 0.035, `${n.name} axis ${d}: extent ${(hi[d] - lo[d]) / 2} vs Unity's ${e[d]}`);
    }
    // the bake, drawn at the holder: the skinned world positions
    const baked = bakeSkinnedMesh(g, bones.map((b) => b.worldMatrix()), g.bindPoses, { position: n.position, rotation: n.rotation });
    const H = holder.worldMatrix();
    for (let v = 0; v < g.vertexCount; v++) {
      const shown = apply(H, [baked[v * 3], baked[v * 3 + 1], baked[v * 3 + 2]]);
      const skinned = apply(world[g.blendIndices[v]], [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]);
      for (let d = 0; d < 3; d++) assert.ok(Math.abs(shown[d] - skinned[d]) < 2e-3, `${n.name} vertex ${v}: ${shown} vs ${skinned}`);
    }
    if (Math.abs(n.lossyScale[0] - 1) > 0.1) scaled++;
    // the recalculated normals, turned by the holder, face as the bundle's own did, turned by the skinning
    const nr = recalculateNormals(baked, g.indices, g.subMeshes);
    for (let v = 0; v < g.vertexCount; v++) {
      const a = turn(H, [nr[v * 3], nr[v * 3 + 1], nr[v * 3 + 2]]), b = turn(world[g.blendIndices[v]], [g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]]);
      assert.ok(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0, `${n.name} vertex ${v}: the recalculated normal turned round`);
    }
  }
  assert.equal(scaled, 1, 'one sail stands under a scaled node - the galleon\'s second lateen');
});
