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
// Units are the port's: metres, the Collider's own frame. `matrix` and
// `translation` are the bucket's, as Collider.addMesh takes them.

export const DEFAULT_MAX_SLOPE = 0.7;   // rise/run, the navmesh AGENT's maxSlope

/** Transform a vertex by a 4x4 column-major matrix (mat4 as Collider uses). */
function xform(m, x, y, z, out) {
  if (!m) { out[0] = x; out[1] = y; out[2] = z; return out; }
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

/**
 * @param {Float32Array|number[]} positions - xyz triples
 * @param {Uint16Array|Uint32Array|number[]} indices - triangles
 * @param {object} opts - { matrix, translation:[x,y,z], cs, maxSlope, xmin, zmin }
 *   cs: the cell size the bake will use (buildNav's agent.cs, or the coarsened one)
 *   xmin/zmin: the bake's origin; cells are indexed from it so the boxes land on the grid
 * @returns {Array<{x0,x1,z0,z1,top,bottom,noNavTop}>} colliders for buildNav
 */
export function trianglesToColliders(positions, indices, { matrix = null, translation = null, cs = 0.25, maxSlope = DEFAULT_MAX_SLOPE, xmin = 0, zmin = 0 } = {}) {
  const cosMax = 1 / Math.sqrt(1 + maxSlope * maxSlope);   // normal.y at the slope limit
  const cells = new Map();   // "ix,iz" -> [{y0, y1, walk}]
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  const tx = translation ? translation[0] : 0, ty = translation ? translation[1] : 0, tz = translation ? translation[2] : 0;
  for (let t = 0; t + 2 < indices.length; t += 3) {
    xform(matrix, positions[indices[t] * 3], positions[indices[t] * 3 + 1], positions[indices[t] * 3 + 2], a);
    xform(matrix, positions[indices[t + 1] * 3], positions[indices[t + 1] * 3 + 1], positions[indices[t + 1] * 3 + 2], b);
    xform(matrix, positions[indices[t + 2] * 3], positions[indices[t + 2] * 3 + 1], positions[indices[t + 2] * 3 + 2], c);
    a[0] += tx; a[1] += ty; a[2] += tz; b[0] += tx; b[1] += ty; b[2] += tz; c[0] += tx; c[1] += ty; c[2] += tz;
    // the face normal's y, sign-free: a floor seen from below is still a floor
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz);
    if (!nl) continue;   // degenerate
    const walk = Math.abs(ny) / nl >= cosMax;
    // the cells the triangle's xz footprint touches
    const ix0 = Math.floor((Math.min(a[0], b[0], c[0]) - xmin) / cs), ix1 = Math.floor((Math.max(a[0], b[0], c[0]) - xmin) / cs);
    const iz0 = Math.floor((Math.min(a[2], b[2], c[2]) - zmin) / cs), iz1 = Math.floor((Math.max(a[2], b[2], c[2]) - zmin) / cs);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        // clip the triangle to the cell in xz and take the y-range of what is left
        const range = clipRangeY(a, b, c, xmin + ix * cs, xmin + (ix + 1) * cs, zmin + iz * cs, zmin + (iz + 1) * cs);
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
    const x0 = xmin + ix * cs, z0 = zmin + iz * cs;
    for (const r of merged) out.push({ x0, x1: x0 + cs, z0, z1: z0 + cs, top: r.y1, bottom: r.y0, noNavTop: !r.walk });
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
