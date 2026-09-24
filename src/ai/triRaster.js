// ENHANCED AI 1: TRIANGLES INTO THE HEIGHTFIELD, WITHOUT TOUCHING THE
// NAVMESH. project-final's navmesh voxelizes COLLIDERS - boxes with a
// footprint and a top (and E1's `bottom`), ramps with a plane - and its
// body is ported byte-identical. Daggerfall's level is a triangle soup.
// Rather than teach the body about triangles (and break the identity
// that lets the two repos share one file), this turns triangles into
// the shape the body already stamps: one box per (cell, span), the
// cell's footprint, the triangle's y-range within the cell, the top
// walkable only if the triangle is within the agent's slope.
//
// Recast's rasterizeTriangles does the same job into spans directly;
// this does it into colliders and lets buildNav's own addSpan merge
// them, so multi-level dungeons (a floor above a floor) fall out of the
// span machinery E1 already models. Per cell, overlapping y-ranges are
// merged here first so the object count stays a few per cell rather
// than one per triangle-cell pair.
//
// Units are the port's: metres, the Collider's own frame - navBake's
// soup is already in world space (each bucket's translation applied), so
// the vertices are read as they are and cells are indexed from 0.

import { AGENT } from './navmesh.js';

/** Triangle t of the soup into a, b, c; answers its face normal's |y| over
 *  its length (sign-free: a floor seen from below is still a floor), or
 *  -1 for a zero-area triangle. The ONE degenerate test the voxeliser and
 *  soupExtent share (AUDIT 68 S02-coarsen-sizing-pass). */
function readTri(positions, indices, t, a, b, c) {
  const i = indices[t] * 3, j = indices[t + 1] * 3, k = indices[t + 2] * 3;
  a[0] = positions[i]; a[1] = positions[i + 1]; a[2] = positions[i + 2];
  b[0] = positions[j]; b[1] = positions[j + 1]; b[2] = positions[j + 2];
  c[0] = positions[k]; c[1] = positions[k + 1]; c[2] = positions[k + 2];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz);
  return nl ? Math.abs(ny) / nl : -1;
}

/**
 * @param {Float32Array|number[]} positions - xyz triples, world space
 * @param {Uint16Array|Uint32Array|number[]} indices - triangles
 * @param {object} opts - { cs, maxSlope }: the cell size the bake will use
 *   (the agent's, or the coarsened one) and its walkable rise/run
 * @returns {Array<{x0,x1,z0,z1,top,bottom,noNavTop}>} colliders for buildNav
 */
export function trianglesToColliders(positions, indices, { cs = AGENT.cs, maxSlope = AGENT.maxSlope } = {}) {
  const cosMax = 1 / Math.sqrt(1 + maxSlope * maxSlope);   // normal.y at the slope limit
  const cells = new Map();   // "ix,iz" -> [{y0, y1, walk}]
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const cosN = readTri(positions, indices, t, a, b, c);
    if (cosN < 0) continue;   // degenerate
    const walk = cosN >= cosMax;
    // the cells the triangle's xz footprint touches
    const ix0 = Math.floor(Math.min(a[0], b[0], c[0]) / cs), ix1 = Math.floor(Math.max(a[0], b[0], c[0]) / cs);
    const iz0 = Math.floor(Math.min(a[2], b[2], c[2]) / cs), iz1 = Math.floor(Math.max(a[2], b[2], c[2]) / cs);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        // clip the triangle to the cell in xz and take the y-range of what is left
        const range = clipRangeY(a, b, c, ix * cs, (ix + 1) * cs, iz * cs, (iz + 1) * cs);
        if (!range) continue;
        const key = ix + ',' + iz;
        let list = cells.get(key);
        if (!list) { list = []; cells.set(key, list); }
        list.push({ y0: range[0], y1: range[1], walk });
      }
    }
  }
  // merge overlapping ranges per cell; the top's walkability is the top's
  const out = [];
  for (const [key, list] of cells) {
    list.sort((p, q) => p.y0 - q.y0);
    const merged = [];
    for (const r of list) {
      const last = merged[merged.length - 1];
      if (last && r.y0 <= last.y1) { if (r.y1 >= last.y1) { last.y1 = r.y1; last.walk = r.walk; } }
      else merged.push({ ...r });
    }
    const [ix, iz] = key.split(',').map(Number);
    const x0 = ix * cs, z0 = iz * cs;
    for (const r of merged) out.push({ x0, x1: x0 + cs, z0, z1: z0 + cs, top: r.y1, bottom: r.y0, noNavTop: !r.walk });
  }
  return out;
}

/** AUDIT 68 S02-coarsen-sizing-pass: the xz extent trianglesToColliders
 *  would give the soup at cell size `cs`, without voxelising it - the
 *  cell-snapped bounds of its non-degenerate triangles, as one box (none
 *  for an empty soup). The cell holding each extreme vertex always gets a
 *  box, so this IS the voxeliser's extent - all that coarsenAgent reads. */
export function soupExtent(positions, indices, cs = AGENT.cs) {
  let xmn = Infinity, xmx = -Infinity, zmn = Infinity, zmx = -Infinity;
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    if (readTri(positions, indices, t, a, b, c) < 0) continue;
    xmn = Math.min(xmn, a[0], b[0], c[0]); xmx = Math.max(xmx, a[0], b[0], c[0]);
    zmn = Math.min(zmn, a[2], b[2], c[2]); zmx = Math.max(zmx, a[2], b[2], c[2]);
  }
  if (xmn === Infinity) return [];
  const x0 = Math.floor(xmn / cs) * cs, z0 = Math.floor(zmn / cs) * cs;
  const x1 = Math.floor(xmx / cs) * cs + cs, z1 = Math.floor(zmx / cs) * cs + cs;   // spelled as the voxeliser's `x0 + cs`
  return [{ x0, x1, z0, z1 }];
}

/** A collider set packed for a thread hop (AUDIT 68 S02-hydrate-main-
 *  thread-revoxelize): six doubles a box and its noNavTop, transferable. */
export function packColliders(cols) {
  const box = new Float64Array(cols.length * 6), noNavTop = new Uint8Array(cols.length);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i], o = i * 6;
    box[o] = c.x0; box[o + 1] = c.x1; box[o + 2] = c.z0; box[o + 3] = c.z1; box[o + 4] = c.top; box[o + 5] = c.bottom;
    noNavTop[i] = c.noNavTop ? 1 : 0;
  }
  return { box, noNavTop };
}

/** packColliders' inverse: the boxes trianglesToColliders minted. */
export function unpackColliders({ box, noNavTop }) {
  const out = new Array(noNavTop.length);
  for (let i = 0; i < out.length; i++) {
    const o = i * 6;
    out[i] = { x0: box[o], x1: box[o + 1], z0: box[o + 2], z1: box[o + 3], top: box[o + 4], bottom: box[o + 5], noNavTop: noNavTop[i] === 1 };
  }
  return out;
}

/** The y-range of a triangle clipped to an xz rectangle (Sutherland-
 *  Hodgman on the four edges), or null if it misses. */
function clipRangeY(a, b, c, x0, x1, z0, z1) {
  let poly = [a, b, c];
  const clip = (inside, cut) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const pin = inside(p), qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) out.push(cut(p, q));
    }
    poly = out;
  };
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  clip((p) => p[0] >= x0, (p, q) => lerp(p, q, (x0 - p[0]) / (q[0] - p[0]))); if (!poly.length) return null;
  clip((p) => p[0] <= x1, (p, q) => lerp(p, q, (x1 - p[0]) / (q[0] - p[0]))); if (!poly.length) return null;
  clip((p) => p[2] >= z0, (p, q) => lerp(p, q, (z0 - p[2]) / (q[2] - p[2]))); if (!poly.length) return null;
  clip((p) => p[2] <= z1, (p, q) => lerp(p, q, (z1 - p[2]) / (q[2] - p[2]))); if (!poly.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  return [lo, hi];
}
