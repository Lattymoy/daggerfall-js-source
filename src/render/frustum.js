// EV3: FRUSTUM CULLING - the pure half. The exploration lane found
// ZERO frustum tests in the render path: ~1045 drawMesh calls in a
// city and 49 terrain pixels (~1.6M triangles) drawn every frame,
// two-thirds of them behind the camera. Presentation is ours under
// Port-Doctrine (DFU gets culling free from Unity), so there is no
// verbatim law here - just the standard mathematics, kept pure so
// the whole thing pins in node with no GL and no game data.
//
// PLANE EXTRACTION is Gribb/Hartmann over the combined proj*view:
// with column-major m and clip = m * world, the six planes are sums
// and differences of row 3 with rows 0..2. The planes are NOT
// normalized - the outside test only asks for the sign, and
// normalizing would spend four sqrts a frame on nothing. This works
// unchanged under mirrorProjectionX (the handedness law): the mirror
// is part of the matrix, so it is part of the planes.
//
// THE OUTSIDE TEST is the p-vertex form: for each plane, take the
// box corner FARTHEST along the plane normal; if even that corner is
// behind the plane, the whole box is. It is deliberately
// CONSERVATIVE the safe way round - a box that straddles or
// surrounds the frustum always answers "not outside" (false), so the
// worst failure mode is drawing something invisible, never popping
// something visible. That direction is what lets the hosts pad their
// bounds generously (buildings above terrain, trees above ground)
// and stay correct.
//
// ?cull=off is the escape hatch, the ?sky=classic shape: one query
// flag, read once at scene build, so a wrong bound in the field is a
// URL away from proof rather than a rebuild.

/** The six planes of clip space, as 24 floats [a,b,c,d] x 6, from a
 *  column-major combined projection*view matrix. Order: left, right,
 *  bottom, top, near, far. */
export function frustumPlanes(m, out = new Float32Array(24)) {
  // row_i of column-major m is [m[i], m[4+i], m[8+i], m[12+i]]
  for (let i = 0; i < 3; i++) {
    const o = i * 8;
    // row3 + row_i
    out[o] = m[3] + m[i];
    out[o + 1] = m[7] + m[4 + i];
    out[o + 2] = m[11] + m[8 + i];
    out[o + 3] = m[15] + m[12 + i];
    // row3 - row_i
    out[o + 4] = m[3] - m[i];
    out[o + 5] = m[7] - m[4 + i];
    out[o + 6] = m[11] - m[8 + i];
    out[o + 7] = m[15] - m[12 + i];
  }
  return out;
}

/** Is the axis-aligned box [minX..maxX, minY..maxY, minZ..maxZ],
 *  offset by (ox, oy, oz), entirely outside the planes? The offset
 *  form exists for the streamed world, whose per-model boxes are
 *  PIXEL-LOCAL and ride the pixel's translation - adding three
 *  numbers here beats materialising a world-space box per model per
 *  frame (the EV2 lesson). */
export function aabbOutside(planes, box, ox = 0, oy = 0, oz = 0) {
  const minX = box[0] + ox, minY = box[1] + oy, minZ = box[2] + oz;
  const maxX = box[3] + ox, maxY = box[4] + oy, maxZ = box[5] + oz;
  for (let p = 0; p < 24; p += 4) {
    const a = planes[p], b = planes[p + 1], c = planes[p + 2], d = planes[p + 3];
    const px = a >= 0 ? maxX : minX;
    const py = b >= 0 ? maxY : minY;
    const pz = c >= 0 ? maxZ : minZ;
    if (a * px + b * py + c * pz + d < 0) return true;
  }
  return false;
}

/** The local AABB of a flat position array [x,y,z,...]. Build-time
 *  only - the archetype scan runs once per model id, never per
 *  frame. */
export function localAabb(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/** The AABB of a local box under a 4x4 (column-major): transform the
 *  eight corners, take the extremes. Exact for the corners, which is
 *  exactly conservative for the box. Build-time only. */
export function transformedAabb(box, m, out = [0, 0, 0, 0, 0, 0]) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? box[3] : box[0];
    const y = (i & 2) ? box[4] : box[1];
    const z = (i & 4) ? box[5] : box[2];
    const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
    const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (tx < minX) minX = tx; if (tx > maxX) maxX = tx;
    if (ty < minY) minY = ty; if (ty > maxY) maxY = ty;
    if (tz < minZ) minZ = tz; if (tz > maxZ) maxZ = tz;
  }
  out[0] = minX; out[1] = minY; out[2] = minZ;
  out[3] = maxX; out[4] = maxY; out[5] = maxZ;
  return out;
}

/** The AABB of a billboard batch. Centers are the flat's BASE
 *  (the renderer's own law - createBillboardBatch: "centers describe
 *  the billboard BASE; the shader lifts by half height"), so the box
 *  rises a full height above the highest base and spreads half a
 *  width around the outermost centers. The quad also yaws to face
 *  the camera, so the half-width applies on BOTH horizontal axes.
 *  Build-time only. */
export function flatBatchAabb(centers, size) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const c of centers) {
    if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
    if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    if (c[2] < minZ) minZ = c[2]; if (c[2] > maxZ) maxZ = c[2];
  }
  const hw = size.w / 2;
  return [minX - hw, minY, minZ - hw, maxX + hw, maxY + size.h, maxZ + hw];
}

/** The escape hatch, read once at scene build. */
export function cullDisabled() {
  try { return /[?&]cull=off\b/.test(globalThis.location?.search ?? ''); }
  catch { return false; }
}
