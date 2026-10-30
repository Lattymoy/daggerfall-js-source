// @ts-check
// WL1 (2026-10-29): A MESH'S GLASS, TILE BY TILE - what render/windowLight.js lights the street and the floor through,
// measured once at a mesh's upload (renderer.createMesh) or in a static batch's sliced merge (render/staticBatch.js).
// A leaf: pure arithmetic on a mesh's arrays.

/** WL1: an aperture's record: tile x, tile y, the tile's origin (uv x.0, y.0) in the mesh's frame, the metres a whole tile
 *  of u and of v spans, the surface's normal and the share of the tile the mesh covers (u0, v0, u1, v1). */
export const WL_REC = 18;
/** The records are kept in cells of APERTURE_CELL metres by their centre, so a frame walks only the cells near the eye: a
 *  cell's record is its centre and radius in the mesh's frame, its first record and its count. */
export const APERTURE_CELL = 24;
export const APERTURE_CELL_REC = 6;
/** A share of a tile under this in u or v is a sliver - a picture's uv run a hair past a tile's edge - and no window. */
export const APERTURE_MIN_COVER = 0.02;
/** Two records of one tile whose frames agree this closely (metres; their normals all but one) are one window: a DF
 *  quad's two triangles map their picture a millimetre apart, and fell into two groups. */
export const APERTURE_MERGE = 0.02;
/** The units the steps yield between: triangles grouped, tiles x triangles clipped, records filed. */
export const APERTURE_STEP_TRIS = 256;
export const APERTURE_STEP_WORK = 256;
export const APERTURE_STEP_RECS = 1024;

/** A polygon (flat [u, v, ...]) clipped to one side of an axis line: keep u (axis 0) or v (1) on `keepGreater`'s side
 *  of `at`. */
function clipPoly(poly, axis, at, keepGreater) {
  const out = [];
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const a0 = poly[i * 2],
      a1 = poly[i * 2 + 1],
      j = (i + 1) % n,
      b0 = poly[j * 2],
      b1 = poly[j * 2 + 1];
    const av = axis ? a1 : a0,
      bv = axis ? b1 : b0;
    const ain = keepGreater ? av >= at : av <= at,
      bin = keepGreater ? bv >= at : bv <= at;
    if (ain) out.push(a0, a1);
    if (ain !== bin) {
      const t = (at - av) / (bv - av);
      out.push(a0 + (b0 - a0) * t, a1 + (b1 - a1) * t);
    }
  }
  return out;
}

/** A Float32Array that grows by doubling (the records of a city's batch, written without a million-number array). */
function grower() {
  let buf = new Float32Array(WL_REC * 64),
    n = 0;
  return {
    push(rec) {
      if (n + rec.length > buf.length) {
        const b = new Float32Array(buf.length * 2);
        b.set(buf);
        buf = b;
      }
      buf.set(rec, n);
      n += rec.length;
    },
    get length() {
      return n;
    },
    get buf() {
      return buf;
    },
  };
}

/** THE APERTURES of one sub-mesh: its triangles grouped by the plane and the picture's mapping they share (a wall's two
 *  triangles are one quad), each group cut into the tiles its UVs span, each tile the share the group covers; one
 *  tile's records that are one window merged; filed by cell. Answers `{ recs, cells }` (WL_REC and APERTURE_CELL_REC
 *  floats; empty when nothing maps). A generator: it yields between units of work (PERF-EXT23's law).
 *  @param {Float32Array} P positions @param {Float32Array} N normals @param {Float32Array} UV uvs
 *  @param {ArrayLike<number>} I indices @param {number} start first index @param {number} count indices */
export function* apertureSteps(P, N, UV, I, start, count) {
  const groups = new Map(); // hash -> [{ q, o, pu, pv, n, tris }]
  const q = new Int32Array(12);
  for (let k = start, done = 0; k + 2 < start + count; k += 3) {
    if (++done % APERTURE_STEP_TRIS === 0) yield;
    const i0 = I[k],
      i1 = I[k + 1],
      i2 = I[k + 2];
    const u0 = UV[i0 * 2],
      v0 = UV[i0 * 2 + 1],
      du1 = UV[i1 * 2] - u0,
      dv1 = UV[i1 * 2 + 1] - v0,
      du2 = UV[i2 * 2] - u0,
      dv2 = UV[i2 * 2 + 1] - v0;
    const det = du1 * dv2 - du2 * dv1;
    if (!(Math.abs(det) > 1e-9)) continue;
    const ax = P[i1 * 3] - P[i0 * 3],
      ay = P[i1 * 3 + 1] - P[i0 * 3 + 1],
      az = P[i1 * 3 + 2] - P[i0 * 3 + 2];
    const bx = P[i2 * 3] - P[i0 * 3],
      by = P[i2 * 3 + 1] - P[i0 * 3 + 1],
      bz = P[i2 * 3 + 2] - P[i0 * 3 + 2];
    if (!(Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) > 1e-8)) continue; // no area: no plane to light through
    let nx = N[i0 * 3],
      ny = N[i0 * 3 + 1],
      nz = N[i0 * 3 + 2];
    const nl = Math.hypot(nx, ny, nz);
    if (!(nl > 0)) continue;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const pux = (ax * dv2 - bx * dv1) / det,
      puy = (ay * dv2 - by * dv1) / det,
      puz = (az * dv2 - bz * dv1) / det;
    const pvx = (bx * du1 - ax * du2) / det,
      pvy = (by * du1 - ay * du2) / det,
      pvz = (bz * du1 - az * du2) / det;
    const ox = P[i0 * 3] - pux * u0 - pvx * v0,
      oy = P[i0 * 3 + 1] - puy * u0 - pvy * v0,
      oz = P[i0 * 3 + 2] - puz * u0 - pvz * v0;
    let h = 0x2545f491;
    q[0] = Math.round(ox * 256);
    q[1] = Math.round(oy * 256);
    q[2] = Math.round(oz * 256);
    q[3] = Math.round(pux * 256);
    q[4] = Math.round(puy * 256);
    q[5] = Math.round(puz * 256);
    q[6] = Math.round(pvx * 256);
    q[7] = Math.round(pvy * 256);
    q[8] = Math.round(pvz * 256);
    q[9] = Math.round(nx * 64);
    q[10] = Math.round(ny * 64);
    q[11] = Math.round(nz * 64);
    for (let c = 0; c < 12; c++) h = Math.imul(h ^ q[c], 0x9e3779b1) ^ (h >>> 15);
    let bucket = groups.get(h);
    if (!bucket) groups.set(h, (bucket = []));
    let g = null;
    for (const b of bucket)
      if (b.q.every((v, c) => v === q[c])) {
        g = b;
        break;
      }
    if (!g)
      bucket.push(
        (g = {
          q: Int32Array.from(q),
          o: [ox, oy, oz],
          pu: [pux, puy, puz],
          pv: [pvx, pvy, pvz],
          n: [nx, ny, nz],
          tris: [],
        }),
      );
    g.tris.push(u0, v0, u0 + du1, v0 + dv1, u0 + du2, v0 + dv2);
  }
  // each group's tiles: the share of each the group's triangles cover
  const raw = grower(),
    rec = new Float32Array(WL_REC);
  let work = 0;
  for (const bucket of groups.values())
    for (const g of bucket) {
      const T = g.tris;
      let umin = Infinity,
        umax = -Infinity,
        vmin = Infinity,
        vmax = -Infinity;
      for (let c = 0; c < T.length; c += 2) {
        umin = Math.min(umin, T[c]);
        umax = Math.max(umax, T[c]);
        vmin = Math.min(vmin, T[c + 1]);
        vmax = Math.max(vmax, T[c + 1]);
      }
      const iu0 = Math.floor(umin + 1e-6),
        iu1 = Math.ceil(umax - 1e-6),
        iv0 = Math.floor(vmin + 1e-6),
        iv1 = Math.ceil(vmax - 1e-6);
      if ((iu1 - iu0) * (iv1 - iv0) > 4096) continue; // a picture tiled past reason is no window
      for (let iu = iu0; iu < iu1; iu++)
        for (let iv = iv0; iv < iv1; iv++) {
          work += T.length / 6;
          if (work >= APERTURE_STEP_WORK) {
            work = 0;
            yield;
          }
          let a0 = Infinity,
            b0 = Infinity,
            a1 = -Infinity,
            b1 = -Infinity;
          for (let t = 0; t < T.length; t += 6) {
            let poly = clipPoly(T.slice(t, t + 6), 0, iu, true);
            if (poly.length) poly = clipPoly(poly, 0, iu + 1, false);
            if (poly.length) poly = clipPoly(poly, 1, iv, true);
            if (poly.length) poly = clipPoly(poly, 1, iv + 1, false);
            for (let c = 0; c < poly.length; c += 2) {
              a0 = Math.min(a0, poly[c] - iu);
              a1 = Math.max(a1, poly[c] - iu);
              b0 = Math.min(b0, poly[c + 1] - iv);
              b1 = Math.max(b1, poly[c + 1] - iv);
            }
          }
          a0 = Math.max(0, a0);
          b0 = Math.max(0, b0);
          a1 = Math.min(1, a1);
          b1 = Math.min(1, b1);
          if (!(a1 - a0 >= APERTURE_MIN_COVER && b1 - b0 >= APERTURE_MIN_COVER)) continue;
          rec[0] = iu;
          rec[1] = iv;
          for (let c = 0; c < 3; c++) {
            rec[2 + c] = g.o[c] + g.pu[c] * iu + g.pv[c] * iv;
            rec[5 + c] = g.pu[c];
            rec[8 + c] = g.pv[c];
            rec[11 + c] = g.n[c];
          }
          rec[14] = a0;
          rec[15] = b0;
          rec[16] = a1;
          rec[17] = b1;
          raw.push(rec);
        }
    }
  yield;
  // one tile's records that are one window, merged (the union of their shares); then filed by cell
  const R = raw.buf,
    nRec = raw.length / WL_REC,
    keep = new Uint8Array(nRec).fill(1),
    byPlace = new Map(),
    cellOf = new Map();
  const near = (a, b) => {
    if (R[a] !== R[b] || R[a + 1] !== R[b + 1]) return false; // one tile
    for (let c = 2; c < 11; c++) if (Math.abs(R[a + c] - R[b + c]) > APERTURE_MERGE) return false; // one frame
    return R[a + 11] * R[b + 11] + R[a + 12] * R[b + 12] + R[a + 13] * R[b + 13] > 0.999; // one face
  };
  // a record is filed by its tile's origin in half-metre buckets, and looked for in each bucket its +-APERTURE_MERGE
  // box touches (one, unless it stands at a bucket's edge)
  const BK = 0.5,
    bucketKey = (x, y, z) => (x + 65536) * 17179869184 + (y + 65536) * 131072 + (z + 65536); // 17 bits each: exact under 2^53
  for (let i = 0; i < nRec; i++) {
    if (i % APERTURE_STEP_RECS === APERTURE_STEP_RECS - 1) yield;
    const a = i * WL_REC,
      ox = R[a + 2],
      oy = R[a + 3],
      oz = R[a + 4];
    let into = -1;
    for (
      let bx = Math.floor((ox - APERTURE_MERGE) / BK);
      bx <= Math.floor((ox + APERTURE_MERGE) / BK) && into < 0;
      bx++
    ) {
      for (
        let by = Math.floor((oy - APERTURE_MERGE) / BK);
        by <= Math.floor((oy + APERTURE_MERGE) / BK) && into < 0;
        by++
      ) {
        for (
          let bz = Math.floor((oz - APERTURE_MERGE) / BK);
          bz <= Math.floor((oz + APERTURE_MERGE) / BK) && into < 0;
          bz++
        ) {
          const list = byPlace.get(bucketKey(bx, by, bz));
          if (list)
            for (const j of list)
              if (near(a, j * WL_REC)) {
                into = j * WL_REC;
                break;
              }
        }
      }
    }
    if (into < 0) {
      const key = bucketKey(Math.floor(ox / BK), Math.floor(oy / BK), Math.floor(oz / BK));
      const list = byPlace.get(key);
      if (list) list.push(i);
      else byPlace.set(key, [i]);
      continue;
    }
    keep[i] = 0;
    R[into + 14] = Math.min(R[into + 14], R[a + 14]);
    R[into + 15] = Math.min(R[into + 15], R[a + 15]);
    R[into + 16] = Math.max(R[into + 16], R[a + 16]);
    R[into + 17] = Math.max(R[into + 17], R[a + 17]);
  }
  const ctr = new Float64Array(3 * nRec); // each record's covered centre, once
  let kept = 0;
  for (let i = 0; i < nRec; i++) {
    if (i % APERTURE_STEP_RECS === APERTURE_STEP_RECS - 1) yield;
    if (!keep[i]) continue;
    const a = i * WL_REC,
      cu = R[a + 14] + R[a + 16],
      cv = R[a + 15] + R[a + 17];
    for (let c = 0; c < 3; c++) ctr[3 * i + c] = R[a + 2 + c] + 0.5 * (R[a + 5 + c] * cu + R[a + 8 + c] * cv);
    const key = bucketKey(
      Math.floor(ctr[3 * i] / APERTURE_CELL),
      Math.floor(ctr[3 * i + 1] / APERTURE_CELL),
      Math.floor(ctr[3 * i + 2] / APERTURE_CELL),
    );
    const list = cellOf.get(key);
    if (list) list.push(i);
    else cellOf.set(key, [i]);
    kept++;
  }
  const recs = new Float32Array(kept * WL_REC),
    cells = new Float32Array(cellOf.size * APERTURE_CELL_REC);
  let w = 0,
    ci = 0,
    moved = 0;
  for (const list of cellOf.values()) {
    const first = w,
      n = list.length;
    let cx = 0,
      cy = 0,
      cz = 0,
      r = 0;
    for (const i of list) {
      cx += ctr[3 * i] / n;
      cy += ctr[3 * i + 1] / n;
      cz += ctr[3 * i + 2] / n;
    }
    for (const i of list) {
      r = Math.max(r, Math.hypot(ctr[3 * i] - cx, ctr[3 * i + 1] - cy, ctr[3 * i + 2] - cz));
      for (let c = 0, a = i * WL_REC, b = w * WL_REC; c < WL_REC; c++) recs[b + c] = R[a + c];
      w++;
      if (++moved % APERTURE_STEP_RECS === 0) yield;
    }
    const o = ci * APERTURE_CELL_REC;
    cells[o] = cx;
    cells[o + 1] = cy;
    cells[o + 2] = cz;
    cells[o + 3] = r;
    cells[o + 4] = first;
    cells[o + 5] = n;
    ci++;
  }
  return { recs, cells };
}

/** The steps run through: one sub-mesh's apertures at once (a lone model's are a few dozen triangles). */
export function windowAperturesOf(P, N, UV, I, start, count) {
  const it = apertureSteps(P, N, UV, I, start, count);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
