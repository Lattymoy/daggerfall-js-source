// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-5 (2026-10-14) - A SPARSE HERMITIAN POSITIVE-DEFINITE SYSTEM, SOLVED DIRECTLY.
//
// The UV editor's unwrap (poi/uv/uvMesh.js unwrapLscm) is a least-squares system over every vertex of an island; an
// iterative solve crawls on a large one (two pins far apart: the low frequencies take thousands of steps - an
// 80,000-triangle sheet ran out of 6,000 and was still stretched a hundredfold). This is the direct solve the standard
// unwrappers make (OpenNL's in Blender, libigl's): a Cholesky factorization of the normal matrix, in the order a
// NESTED DISSECTION of the mesh's own geometry gives - the island split at the median of its longest side, the
// vertices along the cut eliminated last, both halves likewise - which keeps the factor's fill near-linear on a surface.
//
// AUDIT POI M13: THE SYSTEM IS COMPLEX. A conformal map's equations are one complex equation a triangle over one complex
// unknown a vertex (u + iv), so the normal matrix is Hermitian - its real form, which this factored before, is the same
// matrix with every entry a 2 x 2 block: twice the columns, four times the entries and the indices, twice the
// arithmetic. Factored as itself it is one column a vertex.
//
//   - `orderByDissection(points, neighbours)`: the elimination order (vertices).
//   - `upperCsc(n, I, J, Vr, Vz, count)`: the matrix's upper triangle in compressed columns from (row, column, value)
//     triples, duplicates summed.
//   - `cholesky(n, colPtr, rowIdx, re, im)`: the factor L (A = L L^H) of a matrix given by its upper triangle in
//     compressed columns (CSparse's up-looking cs_chol: the elimination tree, each row of L's pattern by its reach in the
//     tree, a symbolic pass that counts the columns before the numeric one fills them) - or null where the matrix is not
//     positive definite (the caller falls back). A real symmetric matrix is the case with no imaginary parts.
//   - `solveCholesky(L, bRe, bIm)`: L L^H x = b.
//
// Pure - typed arrays in, typed arrays out. Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

/**
 * An elimination order for a mesh's vertices by geometric nested dissection: split at the median of the longest axis of
 * the set's bounding box, the separator (the vertices of one side with a neighbour on the other) ordered after both
 * halves, recursively; a set of `leaf` or fewer in any order.
 * @param {ArrayLike<number>[]} points each vertex's position @param {ArrayLike<number>[]} neighbours each vertex's neighbours
 * @param {number} [leaf] @returns {Int32Array} order[k] = the vertex eliminated k-th
 */
export function orderByDissection(points, neighbours, leaf = 48) {
  const N = points.length;
  const side = new Int8Array(N);   // a scratch mark: 2 the high half while a set is split
  const out = new Int32Array(N);
  let at = 0;
  // AUDIT POI M13: the median by SELECTION (Hoare's FIND, as Wirth writes it), not a sort - the set's members reordered
  // so that the first `half` hold the lower coordinates along `ax`; a sort at every level was n log n of n log n
  const splitAtMedian = (set, ax) => {
    const half = set.length >> 1;
    let lo = 0, hi = set.length - 1;
    while (lo < hi) {
      const piv = points[set[half]][ax];
      let i = lo, j = hi;
      do {
        while (points[set[i]][ax] < piv) i++;
        while (piv < points[set[j]][ax]) j--;
        if (i <= j) { const t = set[i]; set[i] = set[j]; set[j] = t; i++; j--; }
      } while (i <= j);
      if (j < half) lo = i;
      if (half < i) hi = j;
    }
    return half;
  };
  // depth-first: the low half ordered, then the high, then the separator between them
  const recurse = (/** @type {Int32Array} */ set) => {
    if (set.length <= leaf) { for (let i = 0; i < set.length; i++) out[at++] = set[i]; return; }
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < set.length; i++) for (let a = 0; a < 3; a++) { const c = points[set[i]][a]; if (c < lo[a]) lo[a] = c; if (c > hi[a]) hi[a] = c; }
    const ax = hi[1] - lo[1] > hi[0] - lo[0] ? (hi[2] - lo[2] > hi[1] - lo[1] ? 2 : 1) : (hi[2] - lo[2] > hi[0] - lo[0] ? 2 : 0);
    const half = splitAtMedian(set, ax);
    for (let i = half; i < set.length; i++) side[set[i]] = 2;
    const low = [], sep = [];
    for (let i = 0; i < half; i++) {
      const v = set[i], nb = neighbours[v];
      let cut = false;
      for (let k = 0; k < nb.length; k++) if (side[nb[k]] === 2) { cut = true; break; }
      if (cut) sep.push(v); else low.push(v);
    }
    for (let i = half; i < set.length; i++) side[set[i]] = 0;
    // a split that separates nothing (every low vertex touches the high side) is a leaf after all
    if (!low.length) { for (let i = 0; i < set.length; i++) out[at++] = set[i]; return; }
    const high = set.subarray(half);
    recurse(Int32Array.from(low)); recurse(high);
    for (const v of sep) out[at++] = v;
  };
  recurse(Int32Array.from({ length: N }, (_, i) => i));
  return out;
}

/**
 * The Cholesky factor (A = L L^H) of a Hermitian positive-definite matrix given by its UPPER triangle (row <= column) in
 * compressed columns, its real parts `Ar` and imaginary `Az` (null: a real symmetric matrix): `{ n, colPtr, rowIdx, re,
 * im }` of L (lower, compressed columns, each column's real diagonal first) - or null.
 * @param {number} n @param {Int32Array} Ap @param {Int32Array} Ai @param {Float64Array} Ar @param {Float64Array | null} [Az]
 */
export function cholesky(n, Ap, Ai, Ar, Az = null) {
  // the elimination tree (cs_etree over the upper triangle)
  const parent = new Int32Array(n).fill(-1), ancestor = new Int32Array(n).fill(-1);
  for (let k = 0; k < n; k++) {
    for (let p = Ap[k]; p < Ap[k + 1]; p++) {
      let i = Ai[p];
      while (i !== -1 && i < k) {
        const next = ancestor[i];
        ancestor[i] = k;
        if (next === -1) parent[i] = k;
        i = next;
      }
    }
  }
  const mark = new Int32Array(n).fill(-1), s = new Int32Array(n);
  /** Row k of L's pattern: the reach of A(0:k-1, k) in the tree, topologically ordered into s[top..n-1]. */
  const ereach = (k) => {
    let top = n;
    mark[k] = k;
    for (let p = Ap[k]; p < Ap[k + 1]; p++) {
      let i = Ai[p];
      if (i > k) continue;
      let len = 0;
      for (; mark[i] !== k; i = parent[i]) { s[len++] = i; mark[i] = k; }
      while (len > 0) s[--top] = s[--len];
    }
    return top;
  };
  // the symbolic pass: each column's count (its diagonal, and every row whose pattern holds it)
  const counts = new Int32Array(n).fill(1);
  for (let k = 0; k < n; k++) { const top = ereach(k); for (let q = top; q < n; q++) counts[s[q]]++; }
  mark.fill(-1);
  const Lp = new Int32Array(n + 1);
  for (let k = 0; k < n; k++) Lp[k + 1] = Lp[k] + counts[k];
  const nnz = Lp[n];
  const Li = new Int32Array(nnz), Lr = new Float64Array(nnz), Lz = new Float64Array(nnz);
  const c = Int32Array.from(Lp.subarray(0, n));   // each column's next free entry
  const xr = new Float64Array(n), xz = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const top = ereach(k);
    // row k of L solves L(0:k-1, 0:k-1) y = A(0:k-1, k), y = conj(L(k, 0:k-1)): its column of A scattered, then the
    // reach in its order
    xr[k] = 0; xz[k] = 0;
    for (let p = Ap[k]; p < Ap[k + 1]; p++) { const i = Ai[p]; if (i <= k) { xr[i] += Ar[p]; if (Az) xz[i] += Az[p]; } }
    let d = xr[k];
    xr[k] = 0; xz[k] = 0;
    for (let q = top; q < n; q++) {
      const i = s[q];
      const lii = Lr[Lp[i]];
      const yr = xr[i] / lii, yz = xz[i] / lii;
      xr[i] = 0; xz[i] = 0;
      for (let p = Lp[i] + 1; p < c[i]; p++) { const r = Li[p], lr = Lr[p], lz = Lz[p]; xr[r] -= lr * yr - lz * yz; xz[r] -= lr * yz + lz * yr; }
      d -= yr * yr + yz * yz;
      const p = c[i]++;
      Li[p] = k; Lr[p] = yr; Lz[p] = -yz;
    }
    if (!(d > 0)) return null;
    const p = c[k]++;
    Li[p] = k; Lr[p] = Math.sqrt(d); Lz[p] = 0;
  }
  return { n, colPtr: Lp, rowIdx: Li, re: Lr, im: Lz };
}

/** L L^H x = b, by a forward and a backward substitution: `{ re, im }` of x. `bIm` null: b is real.
 *  @param {{ n: number, colPtr: Int32Array, rowIdx: Int32Array, re: Float64Array, im: Float64Array }} L
 *  @param {Float64Array} bRe @param {Float64Array | null} [bIm] */
export function solveCholesky(L, bRe, bIm = null) {
  const { n, colPtr: Lp, rowIdx: Li, re: Lr, im: Lz } = L;
  const xr = Float64Array.from(bRe), xz = bIm ? Float64Array.from(bIm) : new Float64Array(n);
  for (let j = 0; j < n; j++) {          // L y = b
    const d = Lr[Lp[j]];
    const yr = (xr[j] /= d), yz = (xz[j] /= d);
    for (let p = Lp[j] + 1; p < Lp[j + 1]; p++) { const r = Li[p]; xr[r] -= Lr[p] * yr - Lz[p] * yz; xz[r] -= Lr[p] * yz + Lz[p] * yr; }
  }
  for (let j = n - 1; j >= 0; j--) {     // L^H x = y: x_j = (y_j - sum over r > j of conj(L(r, j)) x_r) / L(j, j)
    let sr = xr[j], sz = xz[j];
    for (let p = Lp[j] + 1; p < Lp[j + 1]; p++) { const r = Li[p], lr = Lr[p], lz = Lz[p]; sr -= lr * xr[r] + lz * xz[r]; sz -= lr * xz[r] - lz * xr[r]; }
    const d = Lr[Lp[j]];
    xr[j] = sr / d; xz[j] = sz / d;
  }
  return { re: xr, im: xz };
}

/**
 * A Hermitian matrix's upper triangle in compressed columns from (row, column, value) triples - duplicates summed, each
 * column's rows sorted (by insertion: a column of a mesh's matrix holds a vertex's few neighbours). A triple below the
 * diagonal is mirrored above it, conjugated. `Vz` null: every value real.
 * @param {number} n @param {Int32Array} I @param {Int32Array} J @param {Float64Array} Vr @param {Float64Array | null} Vz @param {number} count
 */
export function upperCsc(n, I, J, Vr, Vz, count) {
  const colStart = new Int32Array(n + 1);
  for (let t = 0; t < count; t++) colStart[Math.max(I[t], J[t]) + 1]++;
  for (let c = 0; c < n; c++) colStart[c + 1] += colStart[c];
  const next = Int32Array.from(colStart.subarray(0, n));
  const ri = new Int32Array(count), rr = new Float64Array(count), rz = new Float64Array(count);
  for (let t = 0; t < count; t++) {
    const below = I[t] > J[t];
    const p = next[below ? I[t] : J[t]]++;
    ri[p] = below ? J[t] : I[t]; rr[p] = Vr[t]; rz[p] = Vz ? (below ? -Vz[t] : Vz[t]) : 0;
  }
  // each column: its rows sorted, duplicates summed - compacted in place (a column's entries never move right)
  const Ap = new Int32Array(n + 1);
  let w = 0;
  for (let c = 0; c < n; c++) {
    const p0 = colStart[c], p1 = colStart[c + 1];
    for (let p = p0 + 1; p < p1; p++) {
      const r = ri[p], vr = rr[p], vz = rz[p];
      let q = p - 1;
      while (q >= p0 && ri[q] > r) { ri[q + 1] = ri[q]; rr[q + 1] = rr[q]; rz[q + 1] = rz[q]; q--; }
      ri[q + 1] = r; rr[q + 1] = vr; rz[q + 1] = vz;
    }
    const first = w;
    for (let p = p0; p < p1; p++) {
      if (w > first && ri[w - 1] === ri[p]) { rr[w - 1] += rr[p]; rz[w - 1] += rz[p]; }
      else { ri[w] = ri[p]; rr[w] = rr[p]; rz[w] = rz[p]; w++; }
    }
    Ap[c + 1] = w;
  }
  return { Ap, Ai: ri.slice(0, w), Ar: rr.slice(0, w), Az: rz.slice(0, w) };
}
