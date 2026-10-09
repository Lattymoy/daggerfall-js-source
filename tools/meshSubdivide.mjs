// LOOP SUBDIVISION, for a baked mesh too coarse for its own curve.
//
// MW-CLOAK2 (2026-10-09, Mac: "I dont like how the cloak isnt smooth around the shoulders"). The cloak's export is
// 140 vertices about five units apart; over the shoulders, where the sheet turns from the back over the top, a face
// normal stands up to 35 degrees off its corners' - the silhouette is the polygon, and the straps' ends a ragged run of
// small triangles. Lighting cannot round a polygon's edge. Loop's scheme (Loop 1987) does: each level splits every
// triangle in four and moves every vertex toward the smooth surface the mesh is the control net of -
//
//   an edge's new vertex   3/8 (a + b) + 1/8 (c + d), c and d the two faces' far corners; on the open edge,
//                          (a + b) / 2
//   an old vertex          (1 - n beta) v + beta (its n neighbours), beta = (5/8 - (3/8 + cos(2 pi / n) / 4)^2) / n;
//                          on the open edge, 3/4 v + 1/8 (its two neighbours along that edge) - so a ragged edge
//                          relaxes into a curve and never pulls into the sheet
//
// - and the normals are the result's own, area-weighted, turned to face as the source's did. The UVs ride linearly (an
// edge's new vertex at its edge's middle, an old vertex where it was): the painting is cloth, and the slide is under a
// unit. One vertex a position, as the bake's meshes are where no seam splits them; a mesh with a seam, an edge three
// faces share, or a vertex two open edges' runs meet at (a bow tie's waist - AUDIT MW-CLOAK: it took the first two of
// its rim neighbours and dragged one wing across the other) is refused rather than torn. The result's bounds are its
// own; nothing per-vertex the subdivision does not carry rides along at the old length.

const key = (a, b) => (a < b ? a * 1048576 + b : b * 1048576 + a);

/** One level of Loop subdivision of `{ positions, indices, uvs?, normals? }`; the same shape back. */
export function loopSubdivideOnce(mesh) {
  const P = mesh.positions; const I = mesh.indices; const U = mesh.uvs ?? null;
  const n = P.length / 3;
  if (n >= 1048576) throw new Error(`${n} vertices - the edge key holds 2^20`);
  const seen = new Set();
  for (let v = 0; v < n; v++) {
    const k = `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`;
    if (seen.has(k)) throw new Error(`vertex ${v} shares its position with another - a seam this subdivision does not split`);
    seen.add(k);
  }
  // edges: their faces' far corners
  const edges = new Map();
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[t + e], b = I[t + (e + 1) % 3], c = I[t + (e + 2) % 3];
      const k = key(a, b);
      const edge = edges.get(k);
      if (!edge) edges.set(k, { a, b, far: [c], at: 0 });
      else if (edge.far.length === 2) throw new Error(`edge ${a}-${b} is shared by three faces`);
      else edge.far.push(c);
    }
  }
  const ring = Array.from({ length: n }, () => new Set());
  const rim = Array.from({ length: n }, () => []);
  for (const { a, b, far } of edges.values()) {
    ring[a].add(b); ring[b].add(a);
    if (far.length === 1) { rim[a].push(b); rim[b].push(a); }
  }
  for (let v = 0; v < n; v++) if (rim[v].length > 2) throw new Error(`vertex ${v} is where ${rim[v].length / 2} open edges' runs meet - a bow tie this subdivision does not untie`);
  const out = n + edges.size;
  const pos = new Float32Array(out * 3);
  const uv = U ? new Float32Array(out * 2) : null;
  for (let v = 0; v < n; v++) {
    const r = rim[v];
    let w0, nb, wn;
    if (r.length === 2) { w0 = 3 / 4; nb = r; wn = 1 / 8; }   // on the open edge
    else {
      nb = [...ring[v]];
      const k = nb.length;
      const beta = k ? (5 / 8 - (3 / 8 + Math.cos(2 * Math.PI / k) / 4) ** 2) / k : 0;
      w0 = 1 - k * beta; wn = beta;
    }
    for (let c = 0; c < 3; c++) pos[v * 3 + c] = w0 * P[v * 3 + c] + wn * nb.reduce((s, q) => s + P[q * 3 + c], 0);
    if (uv) { uv[v * 2] = U[v * 2]; uv[v * 2 + 1] = U[v * 2 + 1]; }
  }
  let next = n;
  for (const edge of edges.values()) {
    const { a, b, far } = edge;
    edge.at = next;
    for (let c = 0; c < 3; c++) {
      pos[next * 3 + c] = far.length === 2
        ? 3 / 8 * (P[a * 3 + c] + P[b * 3 + c]) + 1 / 8 * (P[far[0] * 3 + c] + P[far[1] * 3 + c])
        : (P[a * 3 + c] + P[b * 3 + c]) / 2;
    }
    if (uv) { uv[next * 2] = (U[a * 2] + U[b * 2]) / 2; uv[next * 2 + 1] = (U[a * 2 + 1] + U[b * 2 + 1]) / 2; }
    next++;
  }
  const mid = (a, b) => edges.get(key(a, b)).at;
  const idx = new (out > 65535 ? Uint32Array : Uint16Array)(I.length * 4);
  for (let t = 0, o = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], o); o += 12;
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length; v += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], pos[v + c]); max[c] = Math.max(max[c], pos[v + c]); }
  return {
    ...(mesh.name != null ? { name: mesh.name } : {}), ...(mesh.bake ? { bake: { ...mesh.bake, subdivided: (mesh.bake.subdivided ?? 0) + 1 } } : {}),
    positions: pos, indices: idx, ...(uv ? { uvs: uv } : {}), normals: vertexNormals(pos, idx, mesh.normals ? facing(mesh) : null),
    bounds: { min, max },
  };
}

/** `levels` of Loop subdivision; the mesh untouched at 0. */
export function loopSubdivide(mesh, levels = 1) {
  let m = mesh;
  for (let i = 0; i < levels; i++) m = loopSubdivideOnce(m);
  return m;
}

/** The way a mesh's normals face against its winding: +1 with it, -1 against (the sum over its vertices decides). */
function facing(mesh) {
  const fresh = vertexNormals(mesh.positions, mesh.indices, null);
  let s = 0;
  for (let k = 0; k < fresh.length; k++) s += fresh[k] * mesh.normals[k];
  return s < 0 ? -1 : 1;
}

/** Area-weighted vertex normals of an indexed mesh, unit length, times `sign` (null: +1, the winding's own way). */
export function vertexNormals(positions, indices, sign = null) {
  const N = new Float64Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];   // twice the area, along the face
    for (const v of [a, b, c]) { N[v] += f[0]; N[v + 1] += f[1]; N[v + 2] += f[2]; }
  }
  const out = new Float32Array(positions.length);
  const s = sign ?? 1;
  for (let v = 0; v < out.length; v += 3) {
    const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1;
    out[v] = s * N[v] / l; out[v + 1] = s * N[v + 1] / l; out[v + 2] = s * N[v + 2] / l;
  }
  return out;
}
