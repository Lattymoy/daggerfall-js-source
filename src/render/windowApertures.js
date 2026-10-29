// @ts-check
// WL1 (2026-10-29): A MESH'S GLASS, TILE BY TILE - what render/windowLight.js lights the street and the floor through,
// measured once at a mesh's upload (renderer.createMesh) or in a static batch's sliced merge (render/staticBatch.js).
// A leaf: pure arithmetic on a mesh's arrays.

/** WL1: an aperture's record: tile x, tile y, the tile's origin (uv x.0, y.0) in the mesh's frame, the metres a whole tile
 *  of u and of v spans, the surface's normal and the share of the tile the mesh covers (u0, v0, u1, v1). */
export const WL_REC = 18;


/** A polygon (flat [u, v, ...]) clipped to one side of an axis line: keep u (axis 0) or v (1) on `keepGreater`'s side
 *  of `at`. */
function clipPoly(poly, axis, at, keepGreater) {
  const out = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const a0 = poly[i * 2], a1 = poly[i * 2 + 1], j = (i + 1) % n, b0 = poly[j * 2], b1 = poly[j * 2 + 1];
    const av = axis ? a1 : a0, bv = axis ? b1 : b0;
    const ain = keepGreater ? av >= at : av <= at, bin = keepGreater ? bv >= at : bv <= at;
    if (ain) out.push(a0, a1);
    if (ain !== bin) { const t = (at - av) / (bv - av); out.push(a0 + (b0 - a0) * t, a1 + (b1 - a1) * t); }
  }
  return out;
}

/** The units the steps yield between: triangles grouped, tiles clipped. */
export const APERTURE_STEP_TRIS = 512;
export const APERTURE_STEP_TILES = 128;

/**
 * THE APERTURES of one sub-mesh: its triangles grouped by the plane and the picture's mapping they share (a wall's two
 * triangles are one quad), each group cut into the tiles of picture its UVs span, and each tile the share of it the
 * group covers. Answers a Float32Array of WL_REC floats a tile (empty when the sub-mesh maps nothing). Pure; a generator
 * that yields between units of work (PERF-EXT23's law: a static batch's merge breathes between them).
 * @param {Float32Array} P positions @param {Float32Array} N normals @param {Float32Array} UV uvs
 * @param {ArrayLike<number>} I indices @param {number} start first index @param {number} count indices
 */
export function* apertureSteps(P, N, UV, I, start, count) {
  const groups = new Map();
  const q = (v) => Math.round(v * 256);
  for (let k = start; k + 2 < start + count; k += 3) {
    if ((k - start) % (3 * APERTURE_STEP_TRIS) === 0 && k > start) yield;
    const i0 = I[k], i1 = I[k + 1], i2 = I[k + 2];
    const u0 = UV[i0 * 2], v0 = UV[i0 * 2 + 1], du1 = UV[i1 * 2] - u0, dv1 = UV[i1 * 2 + 1] - v0, du2 = UV[i2 * 2] - u0, dv2 = UV[i2 * 2 + 1] - v0;
    const det = du1 * dv2 - du2 * dv1;
    if (!(Math.abs(det) > 1e-9)) continue;
    const e1 = [P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]];
    const e2 = [P[i2 * 3] - P[i0 * 3], P[i2 * 3 + 1] - P[i0 * 3 + 1], P[i2 * 3 + 2] - P[i0 * 3 + 2]];
    const pu = [0, 1, 2].map((c) => (e1[c] * dv2 - e2[c] * dv1) / det), pv = [0, 1, 2].map((c) => (e2[c] * du1 - e1[c] * du2) / det);
    const o = [0, 1, 2].map((c) => P[i0 * 3 + c] - pu[c] * u0 - pv[c] * v0);
    let nx = N[i0 * 3], ny = N[i0 * 3 + 1], nz = N[i0 * 3 + 2];
    const nl = Math.hypot(nx, ny, nz);
    if (!(nl > 0)) continue;
    nx /= nl; ny /= nl; nz /= nl;
    const key = [...o, ...pu, ...pv, nx * 64, ny * 64, nz * 64].map(q).join(',');
    let g = groups.get(key);
    if (!g) groups.set(key, g = { o, pu, pv, n: [nx, ny, nz], tris: [] });
    g.tris.push([u0, v0, u0 + du1, v0 + dv1, u0 + du2, v0 + dv2]);
  }
  const out = [];
  let tiles = 0;
  for (const g of groups.values()) {
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const t of g.tris) for (let c = 0; c < 6; c += 2) { umin = Math.min(umin, t[c]); umax = Math.max(umax, t[c]); vmin = Math.min(vmin, t[c + 1]); vmax = Math.max(vmax, t[c + 1]); }
    const iu0 = Math.floor(umin + 1e-6), iu1 = Math.ceil(umax - 1e-6), iv0 = Math.floor(vmin + 1e-6), iv1 = Math.ceil(vmax - 1e-6);
    if ((iu1 - iu0) * (iv1 - iv0) > 4096) continue;   // a picture tiled past reason is no window
    for (let iu = iu0; iu < iu1; iu++) for (let iv = iv0; iv < iv1; iv++) {
      if (++tiles % APERTURE_STEP_TILES === 0) yield;
      let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
      for (const t of g.tris) {
        let poly = clipPoly(t, 0, iu, true);
        if (poly.length) poly = clipPoly(poly, 0, iu + 1, false);
        if (poly.length) poly = clipPoly(poly, 1, iv, true);
        if (poly.length) poly = clipPoly(poly, 1, iv + 1, false);
        for (let c = 0; c < poly.length; c += 2) { a0 = Math.min(a0, poly[c] - iu); a1 = Math.max(a1, poly[c] - iu); b0 = Math.min(b0, poly[c + 1] - iv); b1 = Math.max(b1, poly[c + 1] - iv); }
      }
      if (!(a1 - a0 > 1e-4 && b1 - b0 > 1e-4)) continue;
      const ox = g.o[0] + g.pu[0] * iu + g.pv[0] * iv, oy = g.o[1] + g.pu[1] * iu + g.pv[1] * iv, oz = g.o[2] + g.pu[2] * iu + g.pv[2] * iv;
      out.push(iu, iv, ox, oy, oz, ...g.pu, ...g.pv, ...g.n, Math.max(0, a0), Math.max(0, b0), Math.min(1, a1), Math.min(1, b1));
    }
  }
  return Float32Array.from(out);
}


/** The steps run through: one sub-mesh's apertures at once (a lone model's are a few dozen triangles). */
export function windowAperturesOf(P, N, UV, I, start, count) {
  const it = apertureSteps(P, N, UV, I, start, count);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
