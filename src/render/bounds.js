// @ts-check
// EL5 (2026-09-17, THE FIELD): THE BOUNDS AND THE CULL - a leaf module shared
// by the shadow pass (its cascade, face and camera replays), the air pass
// (its emission replay) and the renderer (which computes a bundle's bounds
// at upload). Nothing here touches GL.
//
// A bundle carries a local bounding sphere [cx, cy, cz, r] (boundsOf); a
// record carries the world one (transformSphere); a replay extracts its
// frustum's six planes once (frustumPlanes) and asks each sphere
// (sphereInPlanes). A bundle without bounds is always drawn - the cull is
// an optimisation, never a gate.

import { frustumPlanes } from './frustum.js';   // EV3's plane extraction - one home

/** The six planes of a view-projection for the sphere test: frustum.js's
 *  Gribb/Hartmann extraction (EV3's, unnormalised - the hosts' box test only
 *  wants the sign), normalised here so a plane distance is in world units
 *  and a radius can be compared to it. [a, b, c, d] x 6. */
export function spherePlanes(m, out = new Float32Array(24)) {
  frustumPlanes(m, out);
  for (let k = 0; k < 6; k++) {
    const l = Math.hypot(out[k * 4], out[k * 4 + 1], out[k * 4 + 2]) || 1;
    out[k * 4] /= l; out[k * 4 + 1] /= l; out[k * 4 + 2] /= l; out[k * 4 + 3] /= l;
  }
  return out;
}

/** EL5: is a sphere at least touching the volume the planes bound? */
export function sphereInPlanes(planes, x, y, z, r) {
  for (let k = 0; k < 6; k++) {
    if (planes[k * 4] * x + planes[k * 4 + 1] * y + planes[k * 4 + 2] * z + planes[k * 4 + 3] < -r) return false;
  }
  return true;
}

/** EL5: a bounding sphere [cx, cy, cz, r] over positions (xyz triples), the
 *  whole array or the vertices an index range names (`start` and `count`
 *  in index units). The centre is the box's, the radius the farthest
 *  vertex from it. Empty input gives a zero sphere at the origin. */
export function boundsOf(positions, indices = null, start = 0, count = -1, stride = 3) {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const n = indices ? (count < 0 ? indices.length - start : count) : Math.floor(positions.length / stride);
  const at = (k) => (indices ? indices[start + k] : k) * stride;   // EL7: `stride` floats per vertex (a character rig's interleaved 9 or 11)
  for (let k = 0; k < n; k++) {
    const o = at(k), x = positions[o], y = positions[o + 1], z = positions[o + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const out = new Float32Array(4);
  if (n === 0) return out;
  out[0] = (minX + maxX) / 2; out[1] = (minY + maxY) / 2; out[2] = (minZ + maxZ) / 2;
  let r2 = 0;
  for (let k = 0; k < n; k++) {
    const o = at(k), dx = positions[o] - out[0], dy = positions[o + 1] - out[1], dz = positions[o + 2] - out[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) r2 = d2;
  }
  out[3] = Math.sqrt(r2);
  return out;
}

/** EL5: a local sphere through an affine matrix (column-major): the centre
 *  transformed, the radius scaled by the largest axis scale. */
export function transformSphere(m, s, out, o = 0) {
  const x = s[0], y = s[1], z = s[2];
  out[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  out[o + 3] = s[3] * Math.max(sx, sy, sz);
  return out;
}


/** A shadow record's own sphere, or always when it carries none. */
export function recordVisible(planes, r) {
  return !r.bounded || sphereInPlanes(planes, r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3]);
}
/** Sub-mesh i of a bounded mesh record: its own sphere, or always when it has none (radius -1). */
export function subMeshVisible(planes, r, i) {
  if (!r.bounded) return true;
  const o = i * 4, rad = r.subSpheres[o + 3];
  return rad < 0 || sphereInPlanes(planes, r.subSpheres[o], r.subSpheres[o + 1], r.subSpheres[o + 2], rad);
}
/**
 * A billboard batch's world sphere [x, y, z, r] into `out`, from the bounds
 * createBillboardBatch computed and the batch's origin - or null when it
 * carries no bounds.
 *
 * THE SPHERE IS LIFTED HALF A HEIGHT, and that is the whole correctness of
 * it. `createBillboardBatch` stores a sphere over the PLACEMENT points with
 * the sprite's half-diagonal added to the radius, but the billboard vertex
 * shader is bottom-anchored (`uUp * ((aCorner.y + 0.5) * uSize.y)`): the
 * quad stands its full height from that point, so the stored sphere does
 * not reach the top of anything taller than it is wide. Lifting the centre
 * by h/2 bounds the quad exactly - from there it spans w/2 sideways and
 * h/2 either way in y, which is what a radius of hypot(w, h)/2 already
 * covers. (A negative height - droppedTorches' flame, drawn upside down on
 * a negated localScale.y - lifts DOWNWARD by the same rule, which is where
 * its quad hangs.)
 *
 * GHOST1 (2026-09-19, Clerical Error: "loaded from a save and we have ghost
 * campfires now"; kurkku: "sprites disappear and reappear at certain(?)
 * angles"): the lift used to live in TWO hand-written copies - PERF-CROWD's
 * in world.js and PERF-CROWD2's in renderer.js - while this function, which
 * the shadow replay and the AIR PASS's emitters cull by, had none. So the
 * two passes disagreed about the same sprite: the main pass dropped a flat
 * the emission replay kept, and what was left on screen was the bloom of a
 * sprite that never drew. A ghost campfire, exactly as reported. One home,
 * one answer, and every caller takes it. AUDIT 68 S16-batch-sphere-dup:
 * SHADOW-REACH's shadowReachBatch and SC1's signature and dynamic scans had
 * written the lift out three more times; they take this now.
 * @param {{ bounds?: ArrayLike<number>|null, origin?: ArrayLike<number>|null, size?: { h: number }|null }} b
 * @param {Float64Array|Float32Array|number[]} out
 */
export function batchSphere(b, out) {
  const s = b.bounds;
  if (!s) return null;
  const o = b.origin;
  out[0] = s[0] + (o ? o[0] : 0);
  out[1] = s[1] + (o ? o[1] : 0) + (b.size?.h ?? 0) * 0.5;
  out[2] = s[2] + (o ? o[2] : 0);
  out[3] = s[3];
  return out;
}
const _batchSphere = new Float64Array(4);   // batchVisible's scratch - the replays' hot path allocates nothing
/** A billboard batch against the planes, on batchSphere's sphere (no bounds: always drawn). */
export function batchVisible(planes, b) {
  const c = batchSphere(b, _batchSphere);
  return !c || sphereInPlanes(planes, c[0], c[1], c[2], c[3]);
}
