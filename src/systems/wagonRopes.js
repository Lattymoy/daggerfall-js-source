// @ts-check
// WAGONS3 (2026-10-10, Mac: "Proper animated rope mechanics that connect the horses to the wagon"; asked, "Traces and
// reins"): THE HARNESS'S ROPES - pure. Each rope is a chain of ROPE.points points stepped by Verlet integration: gravity
// pulls each loose point, its last step carries on (damped), and ROPE.iterations passes hold every link at its length
// with both ends pinned where the scene says they are this frame - so a rope sags under its own weight, swings when the
// wagon turns or jolts, and settles when it stands. Its length is its ends' span times its `slack` (a trace hangs a
// little, a rein a little more), so a team that walks closer or further keeps the same hang rather than snapping taut or
// pooling. A rope whose end leapt (a door, a fast travel, a floating-origin shift the caller did not carry, a team first
// drawn) is laid again where it hangs at rest, never swung across the leap.
//
// The tube: each rope drawn as a ring of ROPE.sides faces round each link (`tubeModel` the indices and the strap's
// picture laid once, `tubeInto` the positions and normals each frame - renderer.updateMeshVertices's two arrays, the
// count never changing while the harness is the same). Both windings are laid, so a strap reads from either side
// whatever the lane's culling.
//
// Not a DFU member: Horse Cart and Cargo draws no harness. Ledger A (WAGONS3).

/** The law's numbers: points a rope, sides a ring, gravity (m/s^2), the damping kept of a step's velocity, the
 *  constraint passes a step, the longest step (s - a slow frame is stepped as several), how far an end may move in
 *  one step and still be a move (m, times the drawn scale), and the two kinds' slack and radius (m). */
export const ROPE = Object.freeze({
  points: 9, sides: 4, gravity: 9.81, damping: 0.97, iterations: 10, maxStep: 1 / 60, maxSteps: 4, leap: 3,
  trace: Object.freeze({ slack: 1.02, radius: 0.022 }),
  rein: Object.freeze({ slack: 1.06, radius: 0.011 }),
});

/** A fresh rope of `kind` ('trace' | 'rein'), unlaid - its first step lays it. */
export function newRope(kind = 'trace') {
  const n = ROPE.points;
  return { kind, n, p: new Float64Array(n * 3), q: new Float64Array(n * 3), a: [0, 0, 0], b: [0, 0, 0], laid: false };
}

/** How far a rope of span `d` (m) and `slack` hangs at its middle at rest - the parabola whose arc is `slack` times its
 *  chord: sag = sqrt(3 d (L - d) / 8), L = slack d. */
export const restSag = (d, slack) => Math.sqrt(Math.max(0, (3 * d * (slack * d - d)) / 8));

/** Lay `rope` at rest between `a` and `b`: along the chord, dropped by the parabola's sag, with no velocity. */
export function layRope(rope, a, b) {
  const { n, p, q } = rope;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const sag = restSag(d, ROPE[rope.kind]?.slack ?? ROPE.trace.slack);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), drop = 4 * sag * t * (1 - t);
    for (let k = 0; k < 3; k++) p[i * 3 + k] = a[k] + (b[k] - a[k]) * t;
    p[i * 3 + 1] -= drop;
  }
  q.set(p);
  rope.a = [a[0], a[1], a[2]]; rope.b = [b[0], b[1], b[2]]; rope.laid = true;
}

/**
 * One frame of `rope` with its ends at `a` and `b` (scene metres): `dt` seconds (stepped in pieces no longer than
 * ROPE.maxStep, at most ROPE.maxSteps of them - a longer frame's rest is dropped, not caught up), `scale` the drawn
 * scale (the Overworld's grown rig: its gravity and its leap grow with it, so a grown rope hangs as the small one does).
 */
export function stepRope(rope, a, b, dt, scale = 1) {
  const s = scale > 0 ? scale : 1;
  const leapt = !rope.laid || Math.hypot(a[0] - rope.a[0], a[1] - rope.a[1], a[2] - rope.a[2]) > ROPE.leap * s || Math.hypot(b[0] - rope.b[0], b[1] - rope.b[1], b[2] - rope.b[2]) > ROPE.leap * s;
  if (leapt || !(dt > 0)) { if (leapt) layRope(rope, a, b); else { pinEnds(rope, a, b); rope.a = [...a]; rope.b = [...b]; } return rope; }
  const steps = Math.min(ROPE.maxSteps, Math.max(1, Math.ceil(dt / ROPE.maxStep)));
  const h = Math.min(dt, ROPE.maxStep * steps) / steps;
  const { n, p, q } = rope;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const link = (span * (ROPE[rope.kind]?.slack ?? ROPE.trace.slack)) / (n - 1);
  const a0 = rope.a, b0 = rope.b;
  for (let st = 1; st <= steps; st++) {
    const t = st / steps;
    const ea = [a0[0] + (a[0] - a0[0]) * t, a0[1] + (a[1] - a0[1]) * t, a0[2] + (a[2] - a0[2]) * t];
    const eb = [b0[0] + (b[0] - b0[0]) * t, b0[1] + (b[1] - b0[1]) * t, b0[2] + (b[2] - b0[2]) * t];
    for (let i = 1; i < n - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const o = i * 3 + k, v = (p[o] - q[o]) * ROPE.damping;
        q[o] = p[o];
        p[o] += v + (k === 1 ? -ROPE.gravity * s * h * h : 0);
      }
    }
    pinEnds(rope, ea, eb);
    for (let it = 0; it < ROPE.iterations; it++) {
      for (let i = 0; i < n - 1; i++) {
        const o = i * 3, u = o + 3;
        const dx = p[u] - p[o], dy = p[u + 1] - p[o + 1], dz = p[u + 2] - p[o + 2];
        const len = Math.hypot(dx, dy, dz);
        if (!(len > 1e-9)) continue;
        const wa = i === 0 ? 0 : 1, wb = i + 1 === n - 1 ? 0 : 1;
        if (!(wa + wb)) continue;
        const f = (len - link) / len / (wa + wb);
        p[o] += dx * f * wa; p[o + 1] += dy * f * wa; p[o + 2] += dz * f * wa;
        p[u] -= dx * f * wb; p[u + 1] -= dy * f * wb; p[u + 2] -= dz * f * wb;
      }
    }
  }
  rope.a = [a[0], a[1], a[2]]; rope.b = [b[0], b[1], b[2]];
  return rope;
}
function pinEnds(rope, a, b) {
  const { n, p, q } = rope, e = (n - 1) * 3;
  for (let k = 0; k < 3; k++) { p[k] = q[k] = a[k]; p[e + k] = q[e + k] = b[k]; }
}

/** The vertex count a harness of `ropes` ropes is drawn with (each its rings, each ring ROPE.sides + 1 - the seam's
 *  vertex twice, so the strap's picture wraps). */
export const tubeVertexCount = (ropes) => ropes * ROPE.points * (ROPE.sides + 1);

/**
 * The harness's model, laid once for `count` ropes: its indices (both windings), its UVs (round the strap, along it at
 * `tile` m a picture - the links' rest length is the ropes' own, so along-it is per link), and the positions and normals
 * arrays `tubeInto` fills - `{ positions, normals, uvs, indices, subMeshes, doors }`, the renderer's createMesh model.
 * @param {number} count @param {number} archive @param {number} record
 */
export function tubeModel(count, archive, record) {
  const S = ROPE.sides, n = ROPE.points, ring = S + 1;
  const verts = tubeVertexCount(count);
  const uvs = new Float32Array(verts * 2);
  const idx = [];
  for (let r = 0; r < count; r++) {
    const base = r * n * ring;
    for (let i = 0; i < n; i++) for (let k = 0; k <= S; k++) { const v = base + i * ring + k; uvs[v * 2] = k / S; uvs[v * 2 + 1] = i * 0.5; }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < S; k++) {
      const a = base + i * ring + k, b = base + (i + 1) * ring + k, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);   // one winding
      idx.push(a, c, b, c, d, b);   // and the other
    }
  }
  const indices = Uint32Array.from(idx);
  return { name: 'WagonHarness', positions: new Float32Array(verts * 3), normals: new Float32Array(verts * 3), uvs, indices, subMeshes: [{ textureArchive: archive, textureRecord: record, startIndex: 0, primitiveCount: indices.length / 3 }], doors: [] };
}

/**
 * Rope `r`'s tube into `positions` / `normals` (a tubeModel's): a ring of `radius` round each point, square to the rope
 * there (its tangent the chord through its neighbours), its first side level across it (the world's up crossed with it -
 * a rope hanging straight down takes the world's x).
 */
export function tubeInto(rope, r, radius, positions, normals) {
  const S = ROPE.sides, n = rope.n, ring = S + 1, p = rope.p;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(n - 1, i + 1) * 3;
    let tx = p[i1] - p[i0], ty = p[i1 + 1] - p[i0 + 1], tz = p[i1 + 2] - p[i0 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    // s = t x up, level; u = s x t
    let sx = -tz, sy = 0, sz = tx;
    let sl = Math.hypot(sx, sy, sz);
    if (sl < 1e-6) { sx = 1; sy = 0; sz = 0; sl = 1; }
    sx /= sl; sy /= sl; sz /= sl;
    const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx;
    for (let k = 0; k <= S; k++) {
      const th = (k / S) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const nx = c * sx + sn * ux, ny = c * sy + sn * uy, nz = c * sz + sn * uz;
      const v = ((r * n + i) * ring + k) * 3;
      positions[v] = p[i * 3] + nx * radius; positions[v + 1] = p[i * 3 + 1] + ny * radius; positions[v + 2] = p[i * 3 + 2] + nz * radius;
      normals[v] = nx; normals[v + 1] = ny; normals[v + 2] = nz;
    }
  }
}
