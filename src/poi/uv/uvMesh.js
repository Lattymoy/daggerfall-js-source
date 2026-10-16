// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-5 (2026-10-14) - THE UV EDITOR'S GEOMETRY: A MESH AS ITS FACES' CORNERS, ITS SEAMS AND ITS ISLANDS.
//
// Mac: "the ability to import models, texture, UV map"; asked what "UV map" covers: "Full UV editor" - select vertices,
// edges, faces and islands; move, rotate, scale; seams; unwrap; pack (bible/06-Systems/POI-Editor-Arc.md POI-5).
// Pure - no DOM, no GL - so the editor's UV panel (ui/poi/poiUvPanel.js) and the tests read a mesh the same way:
//
//   - THE SESSION (`uvSessionOf`): a POI mesh (poi/poiMesh.js) as its triangles, each CORNER with a UV of its own, and
//     its vertices WELDED by position (a model's vertices are split wherever its UVs or normals part; the weld is the
//     surface's own topology under them). An edge is a pair of welded vertices; it is a SEAM where the faces on its two
//     sides do not agree on its UVs - the model's own seams found, never invented - and the builder may mark or clear
//     one. An ISLAND is the faces reached from a face across edges that are not seams - and, for the tools that read
//     the UVs as they lie (packing, an island's selection, the density), across edges whose faces also agree on the
//     UVs there (`uvIslandsOf`: a projection parts the UVs and marks no seam).
//   - THE UVS IN glTF's ORDER: u right, v DOWN from the picture's top, as the mesh keeps them (the game turns them at the
//     draw - poi/poiRuntime.js), so the editor lays them over the picture as the picture is seen.
//   - THE TOOLS: a selection's corners moved, turned and sized about a point (`transformCorners`), flipped; a projection
//     onto the faces chosen - planar along an axis, box (each face by its own dominant axis), cylindrical, spherical - in
//     metres (a unit of UV a metre: texel density means something from the first press); an UNWRAP by least-squares
//     conformal maps (Levy et al. 2002, `unwrapLscm` - the faces' angles kept as nearly as the plane allows, two
//     vertices pinned far apart in each piece the triangles hold together, the system solved DIRECTLY -
//     poi/sparseCholesky.js, a Cholesky factor in a nested dissection's order - and by preconditioned conjugate
//     gradients only where that fails; each piece sized to its surface's area); the islands PACKED into
//     the unit square (`packIslands` - each turned to its smallest bounding box, shelved tallest first, the whole
//     scaled to fit with a margin); the TEXEL DENSITY read and set (`texelDensity`, `setTexelDensity` - picture pixels a metre).
//   - BACK TO A MESH (`meshFromSession`): a vertex for each distinct (vertex, UV) a corner holds - split exactly where the
//     UVs now part, shared everywhere else - in the submeshes' own order, so the part's materials still match.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { orderByDissection, cholesky, solveCholesky, upperCsc } from '../sparseCholesky.js';
import { wrapAngle } from '../../world/mat4.js';

const EPS_UV = 1e-6;

/** A welded edge's key, the smaller vertex first. */
export const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/**
 * A mesh as the UV editor holds it. The corners' UVs are the mesh's own, per corner; the seams the edges whose two faces
 * disagree on its UVs (or hold different submeshes).
 * @param {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint16Array | Uint32Array, submeshes: { start: number, count: number }[] }} mesh
 * @param {{ weldEps?: number }} [opts]
 */
export function uvSessionOf(mesh, { weldEps = 1e-5 } = {}) {
  const V = mesh.positions.length / 3;
  const T = mesh.indices.length / 3;
  const tris = new Uint32Array(mesh.indices.length);
  const triSub = new Uint16Array(T);
  let t = 0;
  mesh.submeshes.forEach((sm, si) => {
    for (let k = sm.start; k < sm.start + sm.count; k += 3) {
      tris[t * 3] = mesh.indices[k]; tris[t * 3 + 1] = mesh.indices[k + 1]; tris[t * 3 + 2] = mesh.indices[k + 2];
      triSub[t] = si; t++;
    }
  });
  const cornerUv = new Float64Array(T * 6);
  for (let c = 0; c < T * 3; c++) { const v = tris[c]; cornerUv[c * 2] = mesh.uvs[v * 2]; cornerUv[c * 2 + 1] = mesh.uvs[v * 2 + 1]; }
  // the weld: vertices standing within `weldEps` of one another (on every axis) are one vertex of the surface.
  // AUDIT POI M10: a rounding to a weldEps grid parted two copies a hair apart across a cell's edge (an edge opened, an
  // island split) and joined two nearly a cell apart inside one. Each weld's first vertex stands in a cell twice weldEps
  // wide; a vertex looks in the cells its reach overlaps (one to eight) for a weld whose first vertex is within reach,
  // the lowest-numbered when there are two
  const weld = new Int32Array(V);
  const P = mesh.positions, q = 1 / (2 * weldEps);
  const cells = new Map();   // a cell's hash -> the welds whose first vertex stands in it
  const first = [];          // each weld's first vertex
  const cellOf = (ix, iy, iz) => ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) | 0;   // a hash: a cell shared by two keys only costs a look
  let welded = 0;
  for (let v = 0; v < V; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let id = -1;
    for (let ix = Math.floor((x - weldEps) * q); ix <= Math.floor((x + weldEps) * q); ix++) {
      for (let iy = Math.floor((y - weldEps) * q); iy <= Math.floor((y + weldEps) * q); iy++) {
        for (let iz = Math.floor((z - weldEps) * q); iz <= Math.floor((z + weldEps) * q); iz++) {
          const list = cells.get(cellOf(ix, iy, iz));
          if (list) for (const w of list) {
            const r = first[w] * 3;
            if ((id < 0 || w < id) && Math.abs(P[r] - x) <= weldEps && Math.abs(P[r + 1] - y) <= weldEps && Math.abs(P[r + 2] - z) <= weldEps) id = w;
          }
        }
      }
    }
    if (id < 0) {
      id = welded++;
      first.push(v);
      const h = cellOf(Math.floor(x * q), Math.floor(y * q), Math.floor(z * q));
      const list = cells.get(h);
      if (list) list.push(id); else cells.set(h, [id]);
    }
    weld[v] = id;
  }
  const s = {
    positions: mesh.positions, normals: mesh.normals, tris, triSub, cornerUv, weld, welded, faces: T, submeshes: mesh.submeshes.length, seams: new Set(), edgeFaces: new Map(),
    // each face side's welded edge by number (-1 where its two ends weld together), and each edge's key and faces by it -
    // the walks over a face's sides read them, no key spelled again
    sideEdge: new Int32Array(T * 3).fill(-1), edgeKeyOf: /** @type {string[]} */ ([]), edgeFacesOf: /** @type {number[][]} */ ([]),
  };
  // every welded edge and the faces on it (a face's edge i runs corner i to corner i+1)
  const edgeNumber = new Map();
  for (let f = 0; f < T; f++) {
    for (let i = 0; i < 3; i++) {
      const a = weld[tris[f * 3 + i]], b = weld[tris[f * 3 + (i + 1) % 3]];
      if (a === b) continue;
      const k = edgeKey(a, b);
      let e = edgeNumber.get(k);
      if (e === undefined) { e = s.edgeKeyOf.length; edgeNumber.set(k, e); s.edgeKeyOf.push(k); s.edgeFacesOf.push([]); s.edgeFaces.set(k, s.edgeFacesOf[e]); }
      s.edgeFacesOf[e].push(f);
      s.sideEdge[f * 3 + i] = e;
    }
  }
  // the model's own seams: an edge whose faces disagree on its ends' UVs, or hold different materials
  for (const [k, fs] of s.edgeFaces) {
    if (fs.length < 2) continue;
    const [a, b] = k.split('_').map(Number);
    for (let i = 1; i < fs.length; i++) {
      if (triSub[fs[0]] !== triSub[fs[i]] || !sameUvAt(s, fs[0], fs[i], a) || !sameUvAt(s, fs[0], fs[i], b)) { s.seams.add(k); break; }
    }
  }
  return s;
}

/** The corner of face `f` at welded vertex `w` (-1 if none). */
export function cornerAt(s, f, w) {
  for (let i = 0; i < 3; i++) if (s.weld[s.tris[f * 3 + i]] === w) return f * 3 + i;
  return -1;
}
/** Do two corners hold one UV? */
const sameUv = (s, a, b) => Math.abs(s.cornerUv[a * 2] - s.cornerUv[b * 2]) < EPS_UV && Math.abs(s.cornerUv[a * 2 + 1] - s.cornerUv[b * 2 + 1]) < EPS_UV;
function sameUvAt(s, f, g, w) {
  const a = cornerAt(s, f, w), b = cornerAt(s, g, w);
  return a >= 0 && b >= 0 && sameUv(s, a, b);
}

/** Mark an edge a seam, or clear it. */
export function setSeam(s, a, b, on) {
  const k = edgeKey(a, b);
  if (!s.edgeFaces.has(k)) return false;
  if (on) s.seams.add(k); else s.seams.delete(k);
  return true;
}

/** The islands: the faces reached from a face across edges that are not seams (and within `within`, when given) -
 *  each a sorted array of face indices, in the order their first face stands. */
export function islandsOf(s, within = null) {
  const inSet = within ? new Set(within) : null;
  const parent = new Int32Array(s.faces).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const [k, fs] of s.edgeFaces) {
    if (s.seams.has(k)) continue;
    for (let i = 1; i < fs.length; i++) {
      if (inSet && (!inSet.has(fs[0]) || !inSet.has(fs[i]))) continue;
      const ra = find(fs[0]), rb = find(fs[i]);
      if (ra !== rb) parent[rb] = ra;
    }
  }
  const groups = new Map();
  for (let f = 0; f < s.faces; f++) {
    if (inSet && !inSet.has(f)) continue;
    const r = find(f);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(f);
  }
  return [...groups.values()];
}

/**
 * AUDIT POI M3: THE ISLANDS AS THE UVS HOLD THEM - the faces reached from a face across edges that are not seams and on
 * which the two faces (of one material) agree on the UVs at both ends. A projection or an unwrap parts the UVs where it
 * parts them and marks no seam - the seams are the unwrap's cuts, the builder's to mark - so the seams' islands
 * (islandsOf) are what an unwrap lays, and these are what a pack lays apart, an island selects and a density sizes (a
 * box projection's six sides were packed as one island, over one another). Within `within` when given; each a list of
 * face indices in the order their first face stands.
 */
export function uvIslandsOf(s, within = null) {
  const inSet = within ? new Uint8Array(s.faces) : null;
  if (inSet) for (const f of within) inSet[f] = 1;
  const parent = Int32Array.from({ length: s.faces }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let f = 0; f < s.faces; f++) {
    if (inSet && !inSet[f]) continue;
    for (let k = 0; k < 3; k++) {
      const e = s.sideEdge[f * 3 + k];
      if (e < 0 || s.seams.has(s.edgeKeyOf[e])) continue;
      const ca = f * 3 + k, cb = f * 3 + (k + 1) % 3;
      for (const g of s.edgeFacesOf[e]) {
        if (g <= f || (inSet && !inSet[g]) || s.triSub[g] !== s.triSub[f]) continue;
        if (!sameUv(s, ca, cornerAt(s, g, s.weld[s.tris[ca]])) || !sameUv(s, cb, cornerAt(s, g, s.weld[s.tris[cb]]))) continue;
        const ra = find(f), rb = find(g);
        if (ra !== rb) parent[rb] = ra;
      }
    }
  }
  const groups = new Map();
  for (let f = 0; f < s.faces; f++) {
    if (inSet && !inSet[f]) continue;
    const r = find(f);
    const g = groups.get(r);
    if (g) g.push(f); else groups.set(r, [f]);
  }
  return [...groups.values()];
}

/**
 * AUDIT POI M5: THE UV VERTICES OF A SET OF FACES, ONCE - so a selection's corners are read from a table, not found by a
 * walk of an island for every corner (Ctrl+A then a move was seconds at 12,800 faces, a box in island mode forty). Over
 * `faces`' islands as the UVs hold them (uvIslandsOf): `islandOf` each face's island (-1 outside), `vertOf` each corner's
 * UV vertex (-1 outside) - the corners of one island at one welded vertex and one UV - and each vertex's corners,
 * `corners[start[v] .. start[v + 1]]`.
 */
export function uvVertices(s, faces = null) {
  const islands = uvIslandsOf(s, faces);
  const islandOf = new Int32Array(s.faces).fill(-1);
  islands.forEach((g, i) => { for (const f of g) islandOf[f] = i; });
  const vertOf = new Int32Array(s.faces * 3).fill(-1);
  // each welded vertex's UV vertices in the island being read, a list through `next` from `head` (`stamp` the island it
  // was last read in: nothing to clear between islands)
  const head = new Int32Array(s.welded).fill(-1), stamp = new Int32Array(s.welded).fill(-1);
  const seed = new Int32Array((faces ? faces.length : s.faces) * 3), next = new Int32Array(seed.length);
  let V = 0;
  islands.forEach((g, I) => {
    for (const f of g) for (let k = 0; k < 3; k++) {
      const c = f * 3 + k, w = s.weld[s.tris[c]];
      if (stamp[w] !== I) { stamp[w] = I; head[w] = -1; }
      let v = head[w];
      while (v >= 0 && !sameUv(s, seed[v], c)) v = next[v];
      if (v < 0) { v = V++; seed[v] = c; next[v] = head[w]; head[w] = v; }
      vertOf[c] = v;
    }
  });
  const start = new Int32Array(V + 1);
  for (let c = 0; c < vertOf.length; c++) if (vertOf[c] >= 0) start[vertOf[c] + 1]++;
  for (let v = 0; v < V; v++) start[v + 1] += start[v];
  const corners = new Int32Array(start[V]), fill = start.slice(0, V);
  for (let c = 0; c < vertOf.length; c++) if (vertOf[c] >= 0) corners[fill[vertOf[c]]++] = c;
  return { islands, islandOf, vertOf, start, corners };
}

/** The corners of a set of faces. */
export const cornersOf = (faces) => faces.flatMap((f) => [f * 3, f * 3 + 1, f * 3 + 2]);

/** Every corner sharing a UV vertex with corner `c`: the same welded vertex, in the same island (as the UVs hold it,
 *  uvIslandsOf, unless one is given), at the same UV. */
export function uvVertexCorners(s, c, island = null) {
  const w = s.weld[s.tris[c]];
  const faces = island ?? uvIslandsOf(s).find((g) => g.includes(Math.floor(c / 3)));
  const out = [];
  for (const f of faces) {
    const k = cornerAt(s, f, w);
    if (k >= 0 && sameUv(s, k, c)) out.push(k);
  }
  return out;
}

/** The centre of a set of corners' UVs: the middle of their bounds. AUDIT POI M11: it said "the mean of the distinct UV
 *  points" and averaged the corners - a UV vertex counted once for every face on it, so a fan's pivot leaned to its hub.
 *  The bounds' middle counts each point once by what it is, and a flip or a quarter turn about it keeps the selection
 *  where it stood (Blender's bounding-box pivot). */
export function uvCentre(s, corners) {
  if (!corners.length) return [0, 0];
  const [u0, v0, u1, v1] = uvBounds(s, corners);
  return [(u0 + u1) / 2, (v0 + v1) / 2];
}
/** The bounds of a set of corners' UVs: [u0, v0, u1, v1]. */
export function uvBounds(s, corners) {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const c of corners) {
    const u = s.cornerUv[c * 2], v = s.cornerUv[c * 2 + 1];
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  return [u0, v0, u1, v1];
}

/**
 * Move, turn and size a set of corners' UVs about a pivot: `move` [du, dv], `turn` degrees (counter-clockwise as the
 * picture is seen - v down, so a positive turn takes +u toward -v), `scale` [su, sv]. Each corner once.
 */
export function transformCorners(s, corners, { move = [0, 0], turn = 0, scale = [1, 1], pivot = null } = {}) {
  const p = pivot ?? uvCentre(s, corners);
  const a = (turn * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  for (const c of new Set(corners)) {
    let u = (s.cornerUv[c * 2] - p[0]) * scale[0], v = (s.cornerUv[c * 2 + 1] - p[1]) * scale[1];
    const ru = u * cs + v * sn, rv = -u * sn + v * cs;
    s.cornerUv[c * 2] = p[0] + ru + move[0];
    s.cornerUv[c * 2 + 1] = p[1] + rv + move[1];
  }
}

// ── PROJECTIONS ────────────────────────────────────────────────────
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a) => { const l = len3(a); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const posOf = (s, v) => [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]];
const faceNormal = (s, f) => { const a = posOf(s, s.tris[f * 3]), b = posOf(s, s.tris[f * 3 + 1]), c = posOf(s, s.tris[f * 3 + 2]); return cross3(sub3(b, a), sub3(c, a)); };

/** The picture's u and v on the plane square to `n`, as the plane is seen from its front (the eye looking along -n):
 *  u to the eye's right, v down. In the game's frame (Unity's, left-handed) the right of an eye looking along f is
 *  up x f - player/motor.js's (cos yaw, 0, -sin yaw) - so u = n x up and v = n x u. */
export function pictureAxes(n) {
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  const u = norm3(cross3(n, up));
  const v = norm3(cross3(n, u));
  return [u, v];
}
/** A face's UV triangle's signed area (u right, v down: positive as the picture is read). */
const uvSigned = (s, f) => {
  const a = f * 6, U = s.cornerUv;
  return (U[a + 2] - U[a]) * (U[a + 5] - U[a + 1]) - (U[a + 3] - U[a + 1]) * (U[a + 4] - U[a]);
};
/** The same face's signed area as its planar projection along its own normal lays it - the face seen from its front. */
function frontSigned(s, f) {
  const n = norm3(faceNormal(s, f));
  const [ua, va] = pictureAxes(n);
  const P = [0, 1, 2].map((k) => { const p = posOf(s, s.tris[f * 3 + k]); return [dot3(p, ua), dot3(p, va)]; });
  return (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]);
}
/** A mapping keeps the picture unmirrored: where most of the faces' area reads mirrored against each face seen from its
 *  own front, u is turned over for them all (the curved projections' rule - their sense round the axis is the axis's). */
function keepHandedness(s, faces) {
  let agree = 0;
  for (const f of faces) agree += Math.sign(uvSigned(s, f)) * Math.abs(frontSigned(s, f)) * Math.sign(frontSigned(s, f));
  if (agree < 0) for (const c of cornersOf(faces)) s.cornerUv[c * 2] = -s.cornerUv[c * 2];
}

/** Planar projection along `normal` (a unit vector in the mesh's frame): a metre a unit of UV. */
export function projectPlanar(s, faces, normal) {
  const [ua, va] = pictureAxes(norm3(normal));
  for (const c of cornersOf(faces)) { const p = posOf(s, s.tris[c]); s.cornerUv[c * 2] = dot3(p, ua); s.cornerUv[c * 2 + 1] = dot3(p, va); }
}
/** Box projection: each face planar along the axis its normal is nearest. */
export function projectBox(s, faces) {
  for (const f of faces) {
    const n = faceNormal(s, f), ax = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
    const i = ax[0] >= ax[1] && ax[0] >= ax[2] ? 0 : ax[1] >= ax[2] ? 1 : 2;
    const dir = [0, 0, 0]; dir[i] = Math.sign(n[i]) || 1;
    const [ua, va] = pictureAxes(dir);
    for (let k = 0; k < 3; k++) { const c = f * 3 + k, p = posOf(s, s.tris[c]); s.cornerUv[c * 2] = dot3(p, ua); s.cornerUv[c * 2 + 1] = dot3(p, va); }
  }
}
/**
 * A face's three angles round an axis, kept whole across the wrap: each corner off the axis brought within half a turn
 * of the first that is off it, and a corner ON the axis (a cap's centre, a pole - whose angle is nothing of its own)
 * given the mean of the others'. AUDIT POI M7: at atan2(0, 0) such a corner stood at nought and the wrap was read from
 * it, so a polar fan's triangles ran from nought to their own longitude - one to fifteen of sixteen segments wide.
 * `rho` each corner's distance from the axis, `onAxis` the distance at or below which it is on it.
 */
function anglesRound(ang, rho, onAxis) {
  let ref = -1;
  for (let k = 0; k < 3 && ref < 0; k++) if (rho[k] > onAxis) ref = k;
  if (ref < 0) return;   // the face lies along the axis: no angle of its own anywhere
  let sum = 0, off = 0;
  for (let k = 0; k < 3; k++) {
    if (!(rho[k] > onAxis)) continue;
    // within a half turn of the first, in one step (ONCRASH1 C2, found by AUDIT POI: the port's one wrap, never a loop)
    ang[k] = ang[ref] + wrapAngle(ang[k] - ang[ref]);
    sum += ang[k]; off++;
  }
  for (let k = 0; k < 3; k++) if (!(rho[k] > onAxis)) ang[k] = sum / off;
}
/** On the axis: within a millionth of the faces' mean radius of it. */
const ON_AXIS = 1e-6;

/** Cylindrical projection about an axis through `centre`: u round it (a metre of arc at the faces' mean radius), v along
 *  it downward. A face across the wrap is kept whole (anglesRound). */
export function projectCylinder(s, faces, axis = [0, 1, 0], centre = [0, 0, 0]) {
  const a = norm3(axis), [x, z] = pictureAxes(a);
  let rSum = 0, n = 0;
  for (const c of cornersOf(faces)) { const d = sub3(posOf(s, s.tris[c]), centre); rSum += Math.hypot(dot3(d, x), dot3(d, z)); n++; }
  const r = n ? rSum / n : 1;
  for (const f of faces) {
    const d3 = [0, 1, 2].map((k) => sub3(posOf(s, s.tris[f * 3 + k]), centre));
    const ang = d3.map((d) => Math.atan2(dot3(d, z), dot3(d, x)));
    anglesRound(ang, d3.map((d) => Math.hypot(dot3(d, x), dot3(d, z))), ON_AXIS * r);
    for (let k = 0; k < 3; k++) { const c = f * 3 + k; s.cornerUv[c * 2] = ang[k] * r; s.cornerUv[c * 2 + 1] = -dot3(d3[k], a); }
  }
  keepHandedness(s, faces);
}
/** Spherical projection about `centre`: longitude and latitude, a metre of arc at the faces' mean radius. */
export function projectSphere(s, faces, centre = [0, 0, 0]) {
  let rSum = 0, n = 0;
  for (const c of cornersOf(faces)) { rSum += len3(sub3(posOf(s, s.tris[c]), centre)); n++; }
  const r = n ? rSum / n : 1;
  for (const f of faces) {
    const d3 = [0, 1, 2].map((k) => sub3(posOf(s, s.tris[f * 3 + k]), centre));
    const lon = d3.map((d) => Math.atan2(d[2], d[0]));
    anglesRound(lon, d3.map((d) => Math.hypot(d[0], d[2])), ON_AXIS * r);
    for (let k = 0; k < 3; k++) {
      const c = f * 3 + k, d = norm3(sub3(posOf(s, s.tris[c]), centre));
      s.cornerUv[c * 2] = lon[k] * r; s.cornerUv[c * 2 + 1] = -Math.asin(Math.max(-1, Math.min(1, d[1]))) * r;
    }
  }
  keepHandedness(s, faces);
}

// ── THE UNWRAP: LEAST-SQUARES CONFORMAL MAPS ───────────────────────
/** Twice a face's area, in square metres, at or below which it lays nothing. */
const LIVE_AREA2 = 1e-14;
/** AUDIT POI M1: a face is a triangle of the surface when its three corners stand on three welded vertices and it has an
 *  area - a strip's stitch (a, a, b), a collapsed edge (a, a', b), three points on one line are not. The unwrap solves
 *  nothing over them; their corners take their neighbours' UVs. */
function isLive(s, f) {
  const a = s.weld[s.tris[f * 3]], b = s.weld[s.tris[f * 3 + 1]], c = s.weld[s.tris[f * 3 + 2]];
  return a !== b && b !== c && a !== c && len3(faceNormal(s, f)) > LIVE_AREA2;
}

/**
 * Unwrap the islands of `faces` (seams cut them) by LSCM. An island is laid as the PIECES its triangles hold together -
 * the faces of the surface (isLive) joined across the edges they share - each piece alone: its UV vertices' UVs that
 * keep every triangle's angles as nearly as the plane allows, two vertices pinned (the pair farthest apart), the normal
 * equations - Hermitian, the map's own complex form - factored directly (poi/sparseCholesky.js, the piece's
 * nested-dissection order) and solved, and where the factor is refused by conjugate gradients preconditioned by their
 * diagonal, to a relative residual of `tolerance` in at most `iterations`; then sized about its first pin to the
 * surface's own area, a metre a unit of UV over it. A face of no area takes its welded neighbours' UVs. Answers the pieces
 * it laid (each a list of its faces).
 */
export function unwrapLscm(s, faces, { iterations = 6000, tolerance = 1e-7 } = {}) {
  const local = new Int32Array(s.faces).fill(-1);   // a scratch: a face's number in the island being laid
  const laid = [];
  for (const isl of islandsOf(s, faces)) for (const piece of unwrapIsland(s, isl, local, iterations, tolerance)) laid.push(piece);
  return laid;
}
function unwrapIsland(s, faces, local, iterations, tolerance) {
  const n = faces.length;
  for (let i = 0; i < n; i++) local[faces[i]] = i;
  const live = new Uint8Array(n);
  for (let i = 0; i < n; i++) live[i] = isLive(s, faces[i]) ? 1 : 0;
  // THE UNKNOWNS ARE UV VERTICES, NOT WELDED ONES: the corners at a welded vertex joined across edges that are not seams.
  // An island that borders itself along a seam (a cylinder cut once) has two sides at that seam's vertices - one UV each.
  // Two unions over the island's own numbering (corner i * 3 + k of its face i): its corners into UV vertices, its faces
  // into PIECES. First across the edges two faces of the surface share: the solve's own unknowns, and the pieces it pins
  // and solves one by one (AUDIT POI M2: two parts joined only through a face of no area, or at one vertex, hung on a
  // hinge no pin held - a singular system the factor took, the hinge anywhere). Then through the faces of no area, which
  // carry their neighbours' UVs and hold nothing together.
  const cp = Int32Array.from({ length: n * 3 }, (_, c) => c), fp = Int32Array.from({ length: n }, (_, i) => i);
  const find = (p, x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  const join = (p, a, b) => { const ra = find(p, a), rb = find(p, b); if (ra !== rb) p[rb] = ra; };
  const weldOf = (i, k) => s.weld[s.tris[faces[i] * 3 + k]];
  // AUDIT POI M1: every corner of the one face at `w` with every corner of the other at it - a face of no area may hold
  // two, and the second, joined to nothing, was an unknown of its own in no equation: a zero column, the factor refused,
  // the whole island to conjugate gradients (39,200 triangles 1.4 s -> 10 s, 80,000 laid 131% off)
  const joinAt = (i, j, w) => { for (let a = 0; a < 3; a++) if (weldOf(i, a) === w) for (let b = 0; b < 3; b++) if (weldOf(j, b) === w) join(cp, i * 3 + a, j * 3 + b); };
  const later = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const e = s.sideEdge[faces[i] * 3 + k];
    if (e < 0 || s.seams.has(s.edgeKeyOf[e])) continue;
    const wa = weldOf(i, k), wb = weldOf(i, (k + 1) % 3);
    for (const g of s.edgeFacesOf[e]) {
      const j = local[g];
      if (j <= i) continue;
      if (live[i] && live[j]) { join(fp, i, j); joinAt(i, j, wa); joinAt(i, j, wb); } else later.push(i, j, wa, wb);
    }
  }
  const vert = new Int32Array(n * 3).fill(-1);   // a live corner's UV vertex: its root after the first pass
  for (let i = 0; i < n; i++) if (live[i]) for (let k = 0; k < 3; k++) vert[i * 3 + k] = find(cp, i * 3 + k);
  for (let q = 0; q < later.length; q += 4) { joinAt(later[q], later[q + 1], later[q + 2]); joinAt(later[q], later[q + 1], later[q + 3]); }
  // the pieces, each laid alone
  const uv = new Float64Array(n * 6), got = new Int32Array(n * 3).fill(-1);   // a corner's UV, and the piece it came from
  const idOf = new Int32Array(n * 3).fill(-1);
  const groups = new Map();
  for (let i = 0; i < n; i++) if (live[i]) { const r = find(fp, i), g = groups.get(r); if (g) g.push(i); else groups.set(r, [i]); }
  const pieces = [];
  for (const g of groups.values()) {
    layPiece(s, faces, g, vert, idOf, uv, iterations, tolerance);
    for (const i of g) for (let k = 0; k < 3; k++) got[i * 3 + k] = pieces.length;
    pieces.push(g);
  }
  // a face of no area: each corner the UV of the first laid corner of its UV vertex (through the second pass's joins),
  // else of the nearest laid corner of its own face, until nothing more is reached; a face reached by nothing (an island
  // of nothing but such faces) is left as it was
  const firstOf = new Int32Array(n * 3).fill(-1);
  for (let c = 0; c < n * 3; c++) if (got[c] >= 0) { const r = find(cp, c); if (firstOf[r] < 0) firstOf[r] = c; }
  for (let more = true; more;) {
    more = false;
    for (let i = 0; i < n; i++) if (!live[i]) for (let k = 0; k < 3; k++) {
      const c = i * 3 + k;
      if (got[c] >= 0) continue;
      const r = find(cp, c);
      let from = firstOf[r];
      if (from < 0) {
        const p = posOf(s, s.tris[faces[i] * 3 + k]);
        let best = Infinity;
        for (let m = 0; m < 3; m++) if (got[i * 3 + m] >= 0) { const d = len3(sub3(posOf(s, s.tris[faces[i] * 3 + m]), p)); if (d < best) { best = d; from = i * 3 + m; } }
      }
      if (from < 0) continue;
      uv[c * 2] = uv[from * 2]; uv[c * 2 + 1] = uv[from * 2 + 1]; got[c] = got[from];
      if (firstOf[r] < 0) firstOf[r] = c;
      more = true;
    }
  }
  for (let i = 0; i < n; i++) if (!live[i] && got[i * 3] >= 0) pieces[got[i * 3]].push(i);
  // laid: every corner reached takes its UV
  for (let c = 0; c < n * 3; c++) if (got[c] >= 0) { const g = faces[(c / 3) | 0] * 3 + (c % 3); s.cornerUv[g * 2] = uv[c * 2]; s.cornerUv[g * 2 + 1] = uv[c * 2 + 1]; }
  for (let i = 0; i < n; i++) local[faces[i]] = -1;
  return pieces.map((g) => g.map((i) => faces[i]));
}

/** One piece of an island laid (unwrapIsland): its live faces `g` (the island's numbers), their corners' UVs into `uv`. */
function layPiece(s, faces, g, vert, idOf, uv, iterations, tolerance) {
  // its unknowns, numbered as its corners come
  const rep = [];
  for (const i of g) for (let k = 0; k < 3; k++) { const r = vert[i * 3 + k]; if (idOf[r] < 0) { idOf[r] = rep.length; rep.push(i * 3 + k); } }
  const N = rep.length;
  const P = new Float64Array(N * 3);
  for (let v = 0; v < N; v++) { const p = s.tris[faces[(rep[v] / 3) | 0] * 3 + (rep[v] % 3)] * 3; P[v * 3] = s.positions[p]; P[v * 3 + 1] = s.positions[p + 1]; P[v * 3 + 2] = s.positions[p + 2]; }
  // the pins: the two vertices farthest apart (two sweeps: the farthest from any, then the farthest from that)
  const far = (from) => {
    let best = 0, bd = -1;
    for (let i = 0; i < N; i++) { const d = Math.hypot(P[i * 3] - P[from * 3], P[i * 3 + 1] - P[from * 3 + 1], P[i * 3 + 2] - P[from * 3 + 2]); if (d > bd) { bd = d; best = i; } }
    return [best, bd];
  };
  const [p0] = far(0), [p1, dist] = far(p0);
  const pinned = new Map([[p0, [0, 0]], [p1, [dist || 1, 0]]]);
  // the free unknowns: z = u + iv of every unpinned vertex
  const freeIdx = new Int32Array(N).fill(-1);
  let F = 0;
  for (let i = 0; i < N; i++) if (!pinned.has(i)) freeIdx[i] = F++;
  // each triangle's row of the map, m_j = W_j / sqrt(2A): W_j the edge opposite corner j as a complex number in the
  // triangle's own plane (P0 at the origin, P1 along x) - Levy et al.'s M_T; sum m_j z_j = 0 for a z laying it by a similarity
  const T = g.length;
  const tv = new Int32Array(T * 3), mr = new Float64Array(T * 3), mz = new Float64Array(T * 3);
  let area3 = 0;
  for (let t = 0; t < T; t++) {
    const f = faces[g[t]];
    const A = posOf(s, s.tris[f * 3]), e1 = sub3(posOf(s, s.tris[f * 3 + 1]), A), e2 = sub3(posOf(s, s.tris[f * 3 + 2]), A);
    const nn = cross3(e1, e2), area2 = len3(nn);
    area3 += area2 / 2;
    const xa = norm3(e1), ya = norm3(cross3(norm3(nn), xa));
    const q = [[0, 0], [len3(e1), 0], [dot3(e2, xa), dot3(e2, ya)]];
    const d = Math.sqrt(area2);
    for (let j = 0; j < 3; j++) {
      tv[t * 3 + j] = idOf[vert[g[t] * 3 + j]];
      mr[t * 3 + j] = (q[(j + 2) % 3][0] - q[(j + 1) % 3][0]) / d;
      mz[t * 3 + j] = (q[(j + 2) % 3][1] - q[(j + 1) % 3][1]) / d;
    }
  }
  // the elimination order: a nested dissection of the free vertices
  const nb = Array.from({ length: F }, () => []), pts = new Array(F);
  for (let v = 0; v < N; v++) if (freeIdx[v] >= 0) pts[freeIdx[v]] = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  for (let t = 0; t < T; t++) for (let a = 0; a < 3; a++) {
    const fa = freeIdx[tv[t * 3 + a]];
    if (fa < 0) continue;
    for (let b = 0; b < 3; b++) { const fb = freeIdx[tv[t * 3 + b]]; if (b !== a && fb >= 0) nb[fa].push(fb); }
  }
  const rank = new Int32Array(F);
  orderByDissection(pts, nb).forEach((v, r) => { rank[v] = r; });
  // THE NORMAL EQUATIONS, triangle by triangle, in that order (AUDIT POI M13: a triangle's free corners give six entries
  // of the upper triangle - three on the diagonal, three off - where its two real rows' pairs gave 42): H(a, b) +=
  // conj(m_a) m_b, and the pins' part c = -sum of m_j z_j over the pinned to the right-hand side, conj(m_a) c
  const I = new Int32Array(T * 6), J = new Int32Array(T * 6), Vr = new Float64Array(T * 6), Vz = new Float64Array(T * 6);
  const br = new Float64Array(F), bz = new Float64Array(F);
  let cnt = 0;
  for (let t = 0; t < T; t++) {
    let cr = 0, cz = 0;
    for (let j = 0; j < 3; j++) {
      const pin = pinned.get(tv[t * 3 + j]);
      if (pin) { const ar = mr[t * 3 + j], az = mz[t * 3 + j]; cr -= ar * pin[0] - az * pin[1]; cz -= ar * pin[1] + az * pin[0]; }
    }
    for (let a = 0; a < 3; a++) {
      const fa = freeIdx[tv[t * 3 + a]];
      if (fa < 0) continue;
      const ra = rank[fa], ar = mr[t * 3 + a], az = mz[t * 3 + a];
      br[ra] += ar * cr + az * cz; bz[ra] += ar * cz - az * cr;
      for (let b = a; b < 3; b++) {
        const fb = freeIdx[tv[t * 3 + b]];
        if (fb < 0) continue;
        const rb = rank[fb], qr = mr[t * 3 + b], qz = mz[t * 3 + b];
        const re = ar * qr + az * qz, im = ar * qz - az * qr;   // conj(m_a) m_b; its twin below the diagonal the conjugate
        if (ra <= rb) { I[cnt] = ra; J[cnt] = rb; Vz[cnt] = im; } else { I[cnt] = rb; J[cnt] = ra; Vz[cnt] = -im; }
        Vr[cnt++] = re;
      }
    }
  }
  const { Ap, Ai, Ar, Az } = upperCsc(F, I, J, Vr, Vz, cnt);
  // THE DIRECT SOLVE: the normal matrix factored in that order, its fill near-linear on a surface; the iterative one
  // only if the factor fails
  const L = cholesky(F, Ap, Ai, Ar, Az);
  let zr, zz;
  if (L) ({ re: zr, im: zz } = solveCholesky(L, br, bz));
  else {
    // a start from a planar projection along the piece's mean normal (the iterative fallback's first guess)
    let mn = [0, 0, 0];
    for (const i of g) { const fn = faceNormal(s, faces[i]); mn = [mn[0] + fn[0], mn[1] + fn[1], mn[2] + fn[2]]; }
    const [ua, va] = pictureAxes(norm3(len3(mn) > 0 ? mn : [0, 1, 0]));
    zr = new Float64Array(F); zz = new Float64Array(F);
    for (let v = 0; v < N; v++) {
      if (freeIdx[v] < 0) continue;
      const d = [P[v * 3] - P[p0 * 3], P[v * 3 + 1] - P[p0 * 3 + 1], P[v * 3 + 2] - P[p0 * 3 + 2]];
      zr[rank[freeIdx[v]]] = dot3(d, ua); zz[rank[freeIdx[v]]] = dot3(d, va);
    }
    pcgHermitian(F, Ap, Ai, Ar, Az, br, bz, zr, zz, iterations, tolerance);
  }
  const U = new Float64Array(N * 2);
  for (let v = 0; v < N; v++) {
    const pin = pinned.get(v);
    if (pin) { U[v * 2] = pin[0]; U[v * 2 + 1] = pin[1]; } else { const r = rank[freeIdx[v]]; U[v * 2] = zr[r]; U[v * 2 + 1] = zz[r]; }
  }
  // AUDIT POI M4: SIZED TO ITS SURFACE. The pins stand at their chord, shorter than the way over a curved piece - a cut
  // cylinder came out at 0.58 of its area, a hemisphere 0.35, and pieces unwrapped together at densities of their own -
  // so the piece is sized about its first pin (the origin) until its UV area is its surface's: a metre a unit over it, on
  // average, as every piece laid with it (Blender's average-islands scale)
  let areaUv = 0;
  for (let t = 0; t < T; t++) {
    const a = tv[t * 3] * 2, b = tv[t * 3 + 1] * 2, c = tv[t * 3 + 2] * 2;
    areaUv += Math.abs((U[b] - U[a]) * (U[c + 1] - U[a + 1]) - (U[b + 1] - U[a + 1]) * (U[c] - U[a])) / 2;
  }
  if (areaUv > 0) { const k = Math.sqrt(area3 / areaUv); for (let i = 0; i < N * 2; i++) U[i] *= k; }
  // laid: every corner of the piece takes its UV vertex's UV. Never mirrored, and no flip needed: the conformal map keeps
  // each triangle's own orientation, and its plane's frame (x along an edge, y = n x x) turns the same way as the
  // picture's front frame (pictureAxes: u x v = n as well)
  for (const i of g) for (let k = 0; k < 3; k++) { const c = i * 3 + k, v = idOf[vert[c]]; uv[c * 2] = U[v * 2]; uv[c * 2 + 1] = U[v * 2 + 1]; }
}

/** H z = b by conjugate gradients from `z` (re `xr`, im `xz`), preconditioned by H's diagonal - the fallback. H by its
 *  upper triangle in compressed columns: each entry for its own place and, conjugated, for its twin below. */
function pcgHermitian(n, Ap, Ai, Ar, Az, br, bz, xr, xz, iterations, tolerance) {
  const diag = new Float64Array(n);
  for (let j = 0; j < n; j++) for (let p = Ap[j]; p < Ap[j + 1]; p++) if (Ai[p] === j) diag[j] += Ar[p];
  for (let i = 0; i < n; i++) diag[i] = diag[i] > 0 ? 1 / diag[i] : 1;
  const mul = (vr, vz, yr, yz) => {
    yr.fill(0); yz.fill(0);
    for (let j = 0; j < n; j++) for (let p = Ap[j]; p < Ap[j + 1]; p++) {
      const i = Ai[p], hr = Ar[p], hz = Az[p];
      yr[i] += hr * vr[j] - hz * vz[j]; yz[i] += hr * vz[j] + hz * vr[j];
      if (i !== j) { yr[j] += hr * vr[i] + hz * vz[i]; yz[j] += hr * vz[i] - hz * vr[i]; }
    }
  };
  const rr = new Float64Array(n), rz = new Float64Array(n), zr = new Float64Array(n), zz = new Float64Array(n);
  const pr = new Float64Array(n), pz = new Float64Array(n), qr = new Float64Array(n), qz = new Float64Array(n);
  mul(xr, xz, qr, qz);
  let bb = 0, rho = 0;
  for (let i = 0; i < n; i++) {
    rr[i] = br[i] - qr[i]; rz[i] = bz[i] - qz[i]; zr[i] = rr[i] * diag[i]; zz[i] = rz[i] * diag[i]; pr[i] = zr[i]; pz[i] = zz[i];
    bb += br[i] * br[i] + bz[i] * bz[i]; rho += rr[i] * zr[i] + rz[i] * zz[i];
  }
  const stop = tolerance * tolerance * Math.max(bb, 1e-30);
  for (let it = 0; it < iterations; it++) {
    let res = 0;
    for (let i = 0; i < n; i++) res += rr[i] * rr[i] + rz[i] * rz[i];
    if (res <= stop) break;
    mul(pr, pz, qr, qz);
    let pAp = 0;
    for (let i = 0; i < n; i++) pAp += pr[i] * qr[i] + pz[i] * qz[i];
    if (!(pAp > 0)) break;
    const alpha = rho / pAp;
    let rho2 = 0;
    for (let i = 0; i < n; i++) {
      xr[i] += alpha * pr[i]; xz[i] += alpha * pz[i]; rr[i] -= alpha * qr[i]; rz[i] -= alpha * qz[i];
      zr[i] = rr[i] * diag[i]; zz[i] = rz[i] * diag[i]; rho2 += rr[i] * zr[i] + rz[i] * zz[i];
    }
    const beta = rho2 / rho;
    rho = rho2;
    for (let i = 0; i < n; i++) { pr[i] = zr[i] + beta * pr[i]; pz[i] = zz[i] + beta * pz[i]; }
  }
}

// ── PACKING AND DENSITY ────────────────────────────────────────────
/** The convex hull of 2D points (Andrew's monotone chain), counter-clockwise. */
export function hull2(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** The turn (degrees, transformCorners' sense) that lays a point set in its smallest axis-aligned box - the hull's
 *  edges tried (rotating calipers' candidates), the box lying down (wider than tall) preferred on a tie. */
export function minAreaTurn(pts) {
  const h = hull2(pts);
  let best = 0, bestArea = Infinity;
  const tryAngle = (a) => {
    const cs = Math.cos(a), sn = Math.sin(a);
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const [u, v] of h) { const ru = u * cs + v * sn, rv = -u * sn + v * cs; u0 = Math.min(u0, ru); u1 = Math.max(u1, ru); v0 = Math.min(v0, rv); v1 = Math.max(v1, rv); }
    let area = (u1 - u0) * (v1 - v0);
    if (v1 - v0 > u1 - u0) area *= 1 + 1e-9;   // the same box lying down beats it standing (shelves are rows)
    // AUDIT POI M9: a better box by a share of the best, not by an amount - an absolute step swallowed the lying-down
    // bonus of any island smaller than a few tenths of the square (0.1 x 0.2 turned, 0.01 x 0.02 left standing)
    if (area < bestArea * (1 - 1e-12)) { bestArea = area; best = a; }
  };
  tryAngle(0);
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; tryAngle(Math.atan2(b[1] - a[1], b[0] - a[0])); }
  return (best * 180) / Math.PI;
}

/**
 * Pack islands into the unit square: each turned to its smallest box (when `rotate`), all scaled alike, shelved tallest
 * first left to right, row on row, with `margin` (a share of the square) round each - the largest scale that fits, found
 * by halving. Answers the scale used - 0 when nothing fits (the margins alone overfill the square), and then nothing has
 * moved.
 * @param {any} s @param {number[][]} islands face lists @param {{ margin?: number, rotate?: boolean }} [opts]
 */
export function packIslands(s, islands, { margin = 0.01, rotate = true } = {}) {
  // AUDIT POI M9: NOTHING MOVES UNTIL IT FITS. Each island's turn and box are read on its own points, laid by the turn
  // (transformCorners' sense, about the origin) aside - the UVs were turned before a placement was known, so a pack that
  // could not fit still changed them, unsaid - and an island of no faces (no box: its bounds infinite, and every island
  // laid at a point) is left out
  const items = [];
  for (const faces of islands) {
    if (!faces.length) continue;
    const corners = [...new Set(cornersOf(faces))];
    const turn = rotate ? minAreaTurn(corners.map((c) => [s.cornerUv[c * 2], s.cornerUv[c * 2 + 1]])) : 0;
    const a = (turn * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    const at = new Float64Array(corners.length * 2);
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    corners.forEach((c, i) => {
      const u = s.cornerUv[c * 2], v = s.cornerUv[c * 2 + 1], ru = u * cs + v * sn, rv = -u * sn + v * cs;
      at[i * 2] = ru; at[i * 2 + 1] = rv;
      if (ru < u0) u0 = ru; if (ru > u1) u1 = ru; if (rv < v0) v0 = rv; if (rv > v1) v1 = rv;
    });
    items.push({ corners, at, b: [u0, v0, u1, v1], w: u1 - u0, h: v1 - v0 });
  }
  if (!items.length) return 0;
  const fits = (k) => {
    const order = [...items.keys()].sort((a, b) => items[b].h - items[a].h);
    let x = margin, y = margin, rowH = 0;
    const at = new Map();
    for (const i of order) {
      const w = items[i].w * k + margin, h = items[i].h * k + margin;
      if (x + w > 1 + 1e-12) { x = margin; y += rowH; rowH = 0; }
      if (x + w > 1 + 1e-12 || y + h > 1 + 1e-12) return null;
      at.set(i, [x, y]);
      x += w; rowH = Math.max(rowH, h);
    }
    return at;
  };
  // the largest scale that fits: no packing holds more area than the square, so 1 / sqrt(area) is the ceiling; between
  // a scale that fits and one that does not, halved forty times
  const total = items.reduce((a, it) => a + Math.max(it.w * it.h, 1e-12), 0);
  let hi = 1 / Math.sqrt(total), lo = 0, place = fits(hi);
  if (place) lo = hi;
  else {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2, at = fits(mid);
      if (at) { lo = mid; place = at; } else hi = mid;
    }
  }
  if (!place) return 0;
  items.forEach((it, i) => {
    const [x, y] = place.get(i);
    it.corners.forEach((c, j) => {
      s.cornerUv[c * 2] = x + (it.at[j * 2] - it.b[0]) * lo;
      s.cornerUv[c * 2 + 1] = y + (it.at[j * 2 + 1] - it.b[1]) * lo;
    });
  });
  return lo;
}

/** A set of faces' texel density: the picture's pixels a metre over them (`w` x `h` the picture), area-weighted. */
export function texelDensity(s, faces, w, h) {
  let uvA = 0, area = 0;
  for (const f of faces) {
    const n = faceNormal(s, f);
    area += len3(n) / 2;
    const [a, b, c] = [f * 3, f * 3 + 1, f * 3 + 2].map((k) => [s.cornerUv[k * 2] * w, s.cornerUv[k * 2 + 1] * h]);
    uvA += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  }
  return area > 0 ? Math.sqrt(uvA / area) : 0;
}
/** Size each island about its own centre so its texel density is `target`. */
export function setTexelDensity(s, islands, target, w, h) {
  for (const faces of islands) {
    const d = texelDensity(s, faces, w, h);
    if (!(d > 0)) continue;
    const k = target / d;
    transformCorners(s, cornersOf(faces), { scale: [k, k] });
  }
}

/** The session as a POI mesh again: a vertex for each distinct (vertex, UV) a corner holds, the faces in their
 *  submeshes' order. */
export function meshFromSession(s) {
  const keyOf = new Map();
  const pos = [], nor = [], uv = [];
  const bySub = Array.from({ length: s.submeshes }, () => []);
  for (let f = 0; f < s.faces; f++) bySub[s.triSub[f]].push(f);
  const indices = [], submeshes = [];
  for (const faces of bySub) {
    const start = indices.length;
    for (const f of faces) for (let k = 0; k < 3; k++) {
      const c = f * 3 + k, v = s.tris[c];
      const u = s.cornerUv[c * 2], w = s.cornerUv[c * 2 + 1];
      const key = `${v}|${Math.round(u * 1e6)}|${Math.round(w * 1e6)}`;
      let id = keyOf.get(key);
      if (id === undefined) {
        id = pos.length / 3; keyOf.set(key, id);
        pos.push(s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]);
        nor.push(s.normals[v * 3], s.normals[v * 3 + 1], s.normals[v * 3 + 2]);
        uv.push(u, w);
      }
      indices.push(id);
    }
    submeshes.push({ start, count: indices.length - start });
  }
  const V = pos.length / 3;
  return {
    positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv),
    indices: V > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices), submeshes,
  };
}
