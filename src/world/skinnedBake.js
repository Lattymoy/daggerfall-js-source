// @ts-check
// CSA-B (2026-09-27): A SKINNED MESH, BAKED - Unity's SkinnedMeshRenderer.BakeMesh
// and Mesh.RecalculateNormals, the two calls Come Sail Away's FixDeformations
// makes every tenth of a second on each sail (FixDeformations.cs LateUpdate):
//
//   if (timer > interval) { skinnedMeshRenderer.BakeMesh(bakedMesh); bakedMesh.RecalculateNormals(); timer = 0; }
//   else timer += Time.deltaTime;
//
// - THE SKIN: every sail vertex rides ONE bone (the meshes carry a bone index
//   and no weights, which Unity reads as a weight of one), so its skinned
//   position is the bone's localToWorldMatrix times its bind pose times the
//   vertex.
// - THE BAKE is that position in the renderer's frame - its world position
//   and rotation undone, its SCALE KEPT IN. That is BakeMesh's result in
//   Unity 2019.4, the engine DFU and the mod were built with, which has no
//   `useScale` switch (2020.2 added one); the mod's own arrangement agrees:
//   the holder it hangs the baked mesh on is parented with `transform.parent
//   =`, which gives it a local scale of one over the renderer's (world/
//   prefabNode.js setParentKeepWorld), so a scale-free bake drawn there would
//   stand every sail under a scaled node shrunk by that scale - the galleon's
//   second lateen sail to a third of its size - and a scale-kept one stands
//   exactly where the skinned renderer would have drawn it.
// - THE NORMALS: RecalculateNormals over the baked triangles - each
//   triangle's cross(b - a, c - a), Unity's outward normal for its clockwise
//   front (the bundle's imported normals agree with it on 18,060 of the
//   18,076 triangles - pinned), summed at each of its three vertex indices
//   unnormalised (a big triangle weighs more), and each sum normalised. A
//   vertex is never merged with another at the same position ("normals are
//   calculated from all shared vertices" - shared by index), and a vertex
//   with no area around it keeps a zero normal.
// - THE TIMER counts in Unity's floats: `interval` is 0.1f and the timer adds
//   Time.deltaTime (scaled game time - a paused game never bakes), so the
//   first bake is the frame after a tenth of a second has passed, and the
//   mesh is empty until it.

import { multiply } from './mat4.js';
import { mat4FromQuatPos } from './quat.js';

/** FixDeformations.interval - 0.1f. */
export const FIX_DEFORMATIONS_INTERVAL = Math.fround(0.1);

/**
 * FixDeformations.LateUpdate's timer: true when this frame bakes (and the
 * timer is back at zero), false when it only counts.
 * @param {{ timer:number, interval?:number }} script
 * @param {number} deltaTime Time.deltaTime
 */
export function fixDeformationsTick(script, deltaTime) {
  const interval = script.interval != null ? Math.fround(script.interval) : FIX_DEFORMATIONS_INTERVAL;
  if (Math.fround(script.timer) > interval) {
    script.timer = 0;
    return true;
  }
  script.timer = Math.fround(Math.fround(script.timer) + Math.fround(deltaTime));
  return false;
}

/** The inverse of a rotation-and-translation matrix (column-major): R^T and -R^T t. */
function invertRigid(m) {
  const o = new Float32Array(16);
  o[0] = m[0];
  o[1] = m[4];
  o[2] = m[8];
  o[4] = m[1];
  o[5] = m[5];
  o[6] = m[9];
  o[8] = m[2];
  o[9] = m[6];
  o[10] = m[10];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
  o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
  o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  o[15] = 1;
  return o;
}

/**
 * SkinnedMeshRenderer.BakeMesh: each vertex through its bone and bind pose
 * into the world, then into the renderer's frame without its position and
 * rotation (its scale kept).
 * @param {{ positions: Float32Array, blendIndices: Uint16Array|null, vertexCount:number }} geometry
 * @param {Float32Array[]} boneWorld - each bone's localToWorldMatrix (column-major)
 * @param {Float32Array[]} bindPoses - the mesh's, column-major
 * @param {{ position:number[], rotation:number[] }} renderer - the skinned renderer's world position and rotation
 * @param {Float32Array} [out]
 */
export function bakeSkinnedMesh(
  geometry,
  boneWorld,
  bindPoses,
  renderer,
  out = new Float32Array(geometry.vertexCount * 3),
) {
  const toLocal = invertRigid(mat4FromQuatPos(renderer.rotation, renderer.position));
  const skin = boneWorld.map((b, i) =>
    multiply(toLocal, multiply(b, bindPoses[i], new Float32Array(16)), new Float32Array(16)),
  );
  const p = geometry.positions,
    bi = geometry.blendIndices;
  for (let v = 0; v < geometry.vertexCount; v++) {
    const m = skin[bi ? bi[v] : 0];
    const x = p[v * 3],
      y = p[v * 3 + 1],
      z = p[v * 3 + 2];
    if (!m) {
      out[v * 3] = 0;
      out[v * 3 + 1] = 0;
      out[v * 3 + 2] = 0;
      continue;
    } // a bone the rig has not got: Unity skins with no matrix - the vertex collapses (never met in the files)
    out[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}

/**
 * Mesh.RecalculateNormals over every submesh's triangles.
 * @param {Float32Array} positions
 * @param {Uint32Array} indices - absolute (baseVertex folded in)
 * @param {{ startIndex:number, primitiveCount:number }[]} subMeshes
 * @param {Float32Array} [out]
 */
export function recalculateNormals(positions, indices, subMeshes, out = new Float32Array(positions.length)) {
  const acc = new Float64Array(positions.length);
  for (const sm of subMeshes) {
    for (let t = 0; t < sm.primitiveCount; t++) {
      const i0 = indices[sm.startIndex + t * 3],
        i1 = indices[sm.startIndex + t * 3 + 1],
        i2 = indices[sm.startIndex + t * 3 + 2];
      const ax = positions[i0 * 3],
        ay = positions[i0 * 3 + 1],
        az = positions[i0 * 3 + 2];
      const ux = positions[i1 * 3] - ax,
        uy = positions[i1 * 3 + 1] - ay,
        uz = positions[i1 * 3 + 2] - az;
      const vx = positions[i2 * 3] - ax,
        vy = positions[i2 * 3 + 1] - ay,
        vz = positions[i2 * 3 + 2] - az;
      const nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx; // Vector3.Cross(b - a, c - a)
      for (const i of [i0, i1, i2]) {
        acc[i * 3] += nx;
        acc[i * 3 + 1] += ny;
        acc[i * 3 + 2] += nz;
      }
    }
  }
  for (let v = 0; v < positions.length; v += 3) {
    const l = Math.hypot(acc[v], acc[v + 1], acc[v + 2]);
    if (l > 0) {
      out[v] = acc[v] / l;
      out[v + 1] = acc[v + 1] / l;
      out[v + 2] = acc[v + 2] / l;
    } else {
      out[v] = 0;
      out[v + 1] = 0;
      out[v + 2] = 0;
    }
  }
  return out;
}
