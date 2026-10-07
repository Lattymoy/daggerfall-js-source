// THE OPEN MESH, CLOSED (THUNDERLOCK-ART, 2026-10-07; Mac: "overhauling the thunderlock in general including the
// morrowinds gun model").
//
// FIELD-GUN-MW1 measured Mac's gun and said so: "The mesh is OPEN. 410 edges are shared by two triangles and 65 by
// one ... Backface culling will see through them." Eleven holes: the five barrels' ends (a muzzle and its tube's back),
// a skewed opening across the receiver's REAR - the face a first-person eye looks straight at - and four small quads
// under the sights. Through every one the renderer drew the far wall's back face, which it culls: the player saw
// through the back of the gun in their own hands.
//
// So each hole is CAPPED: its boundary walked as the mesh's own edges run (each boundary edge belongs to one triangle,
// a -> b in that triangle's winding), and a fan laid from the loop's centroid with every edge taken b -> a - which is
// what makes the cap's winding agree with the faces round it, so it faces OUT whatever way the hole faces. A cap is a
// hard edge: its vertices are its own, the loop's positions with the cap's one flat normal, so the unwrap that runs
// after (tools/meshUnwrap.mjs) gives it an island of its own and the occlusion bake (tools/meshTexture.mjs) darkens a
// recessed one - a muzzle's bore reads dark, as it should.
//
// Positions are welded by value for the walk (a seam or a hard edge splits a vertex without moving it), never in the
// output. Deterministic: loops in the order their first edge appears, each from that edge. Answers a NEW mesh record.
const keyOf = (P, i) => `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`;

/** The boundary loops of a mesh: `[[vertexIndex, ...], ...]` in the winding of their own triangles. */
export function boundaryLoops(mesh) {
  const P = mesh.positions, I = mesh.indices;
  const id = new Map();
  const pid = new Array(P.length / 3);
  for (let i = 0; i < pid.length; i++) { const k = keyOf(P, i); if (!id.has(k)) id.set(k, id.size); pid[i] = id.get(k); }
  const count = new Map();
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = pid[I[t + e]], b = pid[I[t + (e + 1) % 3]];
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  // the directed boundary edges, a -> b as their one triangle winds them, in the order they appear
  const next = new Map(), firstVertex = new Map(), order = [];
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const va = I[t + e], vb = I[t + (e + 1) % 3];
      const a = pid[va], b = pid[vb];
      if (count.get(a < b ? `${a}_${b}` : `${b}_${a}`) !== 1) continue;
      if (next.has(a)) throw new Error(`boundary vertex ${a} starts two boundary edges - the mesh is not manifold there`);
      next.set(a, b);
      firstVertex.set(a, va);
      order.push(a);
    }
  }
  const used = new Set(), loops = [];
  for (const start of order) {
    if (used.has(start)) continue;
    const loop = [];
    let at = start;
    while (!used.has(at)) {
      used.add(at);
      loop.push(firstVertex.get(at));
      at = next.get(at);
      if (at === undefined) throw new Error('a boundary that does not close');
    }
    loops.push(loop);
  }
  return loops;
}

/** Cap every hole (above). `{ ...mesh, positions, normals, uvs, indices, bake: { ...bake, capped } }`. */
export function capHoles(mesh) {
  const loops = boundaryLoops(mesh);
  const P = [...mesh.positions], N = mesh.normals ? [...mesh.normals] : null, U = mesh.uvs ? [...mesh.uvs] : null, I = [...mesh.indices];
  let triangles = 0;
  for (const loop of loops) {
    const pts = loop.map((v) => [mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]);
    const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    // the cap's normal: the fan's own, summed - each triangle (b, a, c) of edge a -> b
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      n = [n[0] + u[1] * w[2] - u[2] * w[1], n[1] + u[2] * w[0] - u[0] * w[2], n[2] + u[0] * w[1] - u[1] * w[0]];
    }
    const len = Math.hypot(...n) || 1;
    n = n.map((v) => +(v / len).toFixed(6));
    const base = P.length / 3;
    const push = (p) => { P.push(...p.map((v) => +v.toFixed(6))); if (N) N.push(...n); if (U) U.push(0, 0); };
    push(c);
    for (const p of pts) push(p);
    for (let i = 0; i < pts.length; i++) {
      const a = base + 1 + i, b = base + 1 + (i + 1) % pts.length;
      I.push(b, a, base);
      triangles++;
    }
  }
  return { ...mesh, positions: P, normals: N, uvs: U, indices: I, bake: { ...(mesh.bake ?? {}), capped: { loops: loops.length, triangles } } };
}
