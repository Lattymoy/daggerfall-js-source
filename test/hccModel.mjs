// HCC (2026-09-23): A SYNTHETIC MODEL 41214 for the pins - the classic wagon's verified topology (102 vertices,
// 48 triangles, 4 sub-meshes, five welded components of 14 / 10 / 10 / 7 / 7 triangles with the wheels planar in X)
// built from scratch, so wagon41214.js's split can be driven without the player's ARENA2. Every number here is what
// Wagon41214VisualBuilder.TryBuild demands; a model off by one vertex is refused, which a pin also drives.
export const WHEEL_RADIUS = 0.5;
export const WHEEL_X = 0.9, WHEEL_Z = -0.6, WHEEL_Y = 0.5;

/** @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array, subMeshes: object[] }} */
export function syntheticWagon41214({ vertexCount = 102, splitBody = false } = {}) {
  const pos = [];
  const tris = [];   // [sub, a, b, c]
  const v = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
  // the BODY: a box (8 verts, 12 tris) with one quad hanging off its front edge (2 verts, 2 tris) - 14 triangles
  const bx = [-0.6, 0.6], by = [0.7, 1.3], bz = [-1.6, 0.4];
  const b = [];
  for (const z of bz) for (const y of by) for (const x of bx) b.push(v(x, y, z));
  const box = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5]];
  for (const t of box) tris.push([0, b[t[0]], b[t[1]], b[t[2]]]);
  const q0 = v(-0.6, 0.7, 0.9), q1 = v(0.6, 0.7, 0.9);
  // `splitBody`: the quad's two shared corners are DUPLICATE vertices a few microns off the box's own (the classic
  // model's sub-meshes do this), so the body is one component only through the weld
  const b4 = splitBody ? v(-0.6 + 5e-5, 0.7, 0.4) : b[4], b5 = splitBody ? v(0.6, 0.7 + 5e-5, 0.4) : b[5];
  tris.push([0, b4, b5, q1], [0, b4, q1, q0]);
  // the WHEELS: a ten-triangle fan disc each, planar in X, radius 0.5 - left at -WHEEL_X, right at +WHEEL_X
  for (const [sx, sub] of [[-1, 1], [1, 1]]) {
    const c = v(sx * WHEEL_X, WHEEL_Y, WHEEL_Z);
    const ring = [];
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; ring.push(v(sx * WHEEL_X, WHEEL_Y + Math.sin(a) * WHEEL_RADIUS, WHEEL_Z + Math.cos(a) * WHEEL_RADIUS)); }
    for (let i = 0; i < 10; i++) tris.push([sub, c, ring[i], ring[(i + 1) % 10]]);
  }
  // the SHAFTS: a seven-triangle strip each (9 verts), from the body's front out along +Z
  for (const [sx, sub] of [[-1, 2], [1, 3]]) {
    const s = [];
    for (let i = 0; i < 9; i++) s.push(v(sx * 0.45 + (i % 2) * 0.06, 0.75, 0.5 + Math.floor(i / 2) * 0.35 + (i % 2) * 0.1));
    for (let i = 0; i < 7; i++) tris.push([sub, s[i], s[i + 1], s[i + 2]]);
  }
  // padding to the classic model's 102 vertices: never referenced, so they join no component and move no bounds
  while (pos.length / 3 < vertexCount) v(0, 1, -0.6);
  const n = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(n * 3); for (let i = 0; i < n; i++) normals[i * 3 + 1] = 1;
  const uvs = new Float32Array(n * 2);
  const bySub = [[], [], [], []];
  for (const t of tris) bySub[t[0]].push(t[1], t[2], t[3]);
  const indices = [];
  const subMeshes = bySub.map((l, sub) => { const sm = { textureArchive: 100 + sub, textureRecord: sub, startIndex: indices.length, primitiveCount: l.length / 3 }; indices.push(...l); return sm; });
  return { positions, normals, uvs, indices: new Uint32Array(indices), subMeshes };
}
