// @ts-check
// GALLEON (2026-10-01): THE MESH BENCH - what world/ships/galleonModel.js and world/ships/galleonRig.js build the new galleon's
// parts on. Pure: points, faces and numbers in; the CSA geometry shape out (systems/comeSailAway/comeSailAwayModels.js
// decodeMeshGeometry's: positions, normals, uvs, 32-bit indices, sub-meshes by texture, a box), with each sub-mesh's
// texture as a renderer slot (`{ archive, record }`).
//
// THE WINDING IS THE PORT'S, AND IT IS NEVER GUESSED. Unity's front face is clockwise in its left-handed frame, which
// the renderer keeps (frontFace(CW) under its mirrored projection) - so a front face's cross(b - a, c - a) points OUT
// of it (world/skinnedBake.js recalculateNormals says the same of the sails). Every face here is laid with the normal
// it should face, and its corners are turned to agree with that normal before they are written: a part built from
// either side comes out facing the way it was asked to.
//
// Flat-shaded unless a face is given its corners' own normals: Mac's ship is low-polygon and faceted, and so is
// Daggerfall's world. Not a DFU member. Ledger A (GALLEON).
import { GALLEON_ARCHIVE } from './galleonArt.js';

/** @typedef {[number, number, number]} V3 */
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Newell's normal of a polygon (unnormalised: its length is twice the area) - the direction its corners' own
 *  cross(b - a, c - a) takes, which for the port's winding points out of the face. */
export function newell(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** Two unit vectors spanning the plane square to `n` (any pair - a projection's axes). */
export function basisOf(n) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(a, n));
  return [u, cross(n, u)];
}

/**
 * A mesh being built: triangles grouped by the texture record they wear.
 */
export class MeshBench {
  constructor(archive = GALLEON_ARCHIVE) {
    this.archive = archive;
    /** @type {Map<number, { p: number[], n: number[], uv: number[] }>} */
    this.groups = new Map();
  }
  /** @param {number} rec */
  group(rec) {
    let g = this.groups.get(rec);
    if (!g) { g = { p: [], n: [], uv: [] }; this.groups.set(rec, g); }
    return g;
  }
  /**
   * One triangle facing `facing` (a direction it should face; its corners are swapped if they wind the other way),
   * with each corner's uv, and a normal - its own flat one unless `normals` gives the corners theirs.
   */
  tri(rec, a, b, c, ua, ub, uc, facing = null, normals = null) {
    let n = cross(sub(b, a), sub(c, a));
    if (facing && dot(n, facing) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; if (normals) normals = [normals[0], normals[2], normals[1]]; n = scl(n, -1); }
    const l = len(n);
    if (!(l > 1e-12)) return;   // no area, no face
    const fn = scl(n, 1 / l);
    const g = this.group(rec);
    const corners = [[a, ua], [b, ub], [c, uc]];
    corners.forEach(([p, uv], i) => {
      g.p.push(p[0], p[1], p[2]);
      const nn = normals ? norm(normals[i]) : fn;
      g.n.push(nn[0], nn[1], nn[2]);
      g.uv.push(uv[0], uv[1]);
    });
  }
  /** A convex polygon facing `facing`, fanned from its first corner. */
  poly(rec, pts, uvs, facing) {
    for (let i = 1; i + 1 < pts.length; i++) this.tri(rec, pts[0], pts[i], pts[i + 1], uvs[0], uvs[i], uvs[i + 1], facing);
  }
  /** A quad a-b-c-d (in order round it) facing `facing`. */
  quad(rec, a, b, c, d, uvs, facing) { this.poly(rec, [a, b, c, d], uvs, facing); }
  // AUDIT GN2-BK6: `merge` (another bench through a matrix) gone - nothing called it, and it turned normals by the
  // matrix's linear part (not its inverse transpose) and kept a mirror's winding
  get triangleCount() { let n = 0; for (const g of this.groups.values()) n += g.p.length / 9; return n; }
  /**
   * The CSA geometry: positions, normals, uvs and indices, a sub-mesh per texture in record order, the slots that
   * name each sub-mesh's texture, and the box (Mesh.bounds - center and extent). Null when it holds nothing.
   */
  finish() {
    const recs = [...this.groups.keys()].filter((r) => this.groups.get(r).p.length).sort((a, b) => a - b);
    if (!recs.length) return null;
    let nv = 0;
    for (const r of recs) nv += this.groups.get(r).p.length / 3;
    const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
    const indices = new Uint32Array(nv);
    const subMeshes = [], slots = [];
    let v = 0;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const r of recs) {
      const g = this.groups.get(r);
      const start = v;
      positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
      for (let i = 0; i < g.p.length / 3; i++) indices[v + i] = v + i;
      for (let i = 0; i < g.p.length; i += 3) for (let k = 0; k < 3; k++) { const x = g.p[i + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x; }
      v += g.p.length / 3;
      subMeshes.push({ startIndex: start, primitiveCount: (v - start) / 3 });
      slots.push({ archive: this.archive, record: r });
    }
    return {
      vertexCount: nv, positions, normals, uvs, indices, subMeshes, slots, blendIndices: null, bindPoses: null,
      aabb: { center: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), extent: [0, 1, 2].map((k) => (max[k] - min[k]) / 2) },
    };
  }
}

/** A collider's triangles (positions and indices, the CSA geometry's two fields a collider reads) out of a geometry -
 *  every triangle, its corners welded where they coincide (to 0.1 mm), so triangles that meet share their corners.
 *  AUDIT GN-NITS: welding closes nothing - a drawing open somewhere is a collider open there (her hull's: her planking
 *  along the gun deck's line, her rail's and parapet's feet, her castle doorway's sill, and her stair wells where their
 *  ramps are left out of it); this said the collider's mesh came out closed. */
export function colliderOf(geometry) {
  if (!geometry) return null;
  const key = new Map(), pos = [], idx = [];
  const p = geometry.positions;
  for (let i = 0; i < geometry.indices.length; i++) {
    const v = geometry.indices[i];
    const k = `${p[v * 3].toFixed(4)},${p[v * 3 + 1].toFixed(4)},${p[v * 3 + 2].toFixed(4)}`;
    let at = key.get(k);
    if (at === undefined) { at = pos.length / 3; key.set(k, at); pos.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); }
    idx.push(at);
  }
  const positions = Float32Array.from(pos), indices = Uint32Array.from(idx);
  return { vertexCount: positions.length / 3, positions, normals: new Float32Array(positions.length), uvs: new Float32Array((positions.length / 3) * 2), indices, subMeshes: [{ startIndex: 0, primitiveCount: indices.length / 3 }], blendIndices: null, bindPoses: null, aabb: geometry.aabb };
}

// ── the primitives ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Planar uv for a point on a face facing `n`: its two in-plane coordinates over the tile (`tile` [u, v] metres). The
 *  axes are the world's where the face is square to one (so neighbouring faces' grains meet), else the face's own. */
export function planarUv(p, n, tile) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  let u, v;
  if (ay >= ax && ay >= az) { u = p[2]; v = p[0]; }                 // a floor or a ceiling: the grain runs fore and aft
  else if (ax >= az) { u = n[0] >= 0 ? p[2] : -p[2]; v = p[1]; }   // a side
  else { u = n[2] >= 0 ? -p[0] : p[0]; v = p[1]; }                  // a face to the bow or the stern
  return [tile[0] ? u / tile[0] : u, tile[1] ? v / tile[1] : v];
}

/**
 * A box: centre `c`, half sizes `h` along its own axes `axes` (three unit vectors - the world's by default), its six
 * faces outward, each uv'd planar on its tile (or by `uvFace(faceIndex, corner(0..3)) -> [u, v]`).
 */
export function box(bench, rec, c, h, { axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], tile = [1, 1], skip = [], uvFace = null } = {}) {
  const [X, Y, Z] = axes;
  const pt = (sx, sy, sz) => add(add(add(c, scl(X, sx * h[0])), scl(Y, sy * h[1])), scl(Z, sz * h[2]));
  const faces = [
    [X, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [scl(X, -1), [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [Y, [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [scl(Y, -1), [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
    [Z, [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]], [scl(Z, -1), [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
  ];
  faces.forEach(([n, cs], fi) => {
    if (skip.includes(fi)) return;
    const pts = cs.map((s) => pt(...s));
    const uvs = uvFace ? cs.map((_, k) => uvFace(fi, k)) : pts.map((p) => planarUv(p, n, tile));
    bench.quad(rec, pts[0], pts[1], pts[2], pts[3], uvs, n);
  });
}

/**
 * A tapered prism from `p0` (radius r0) to `p1` (radius r1), `sides` faces round it, the ends capped unless asked not
 * to. Its sides wear the texture round (u: once round over `uRound` repeats) and along (v: metres over `tileV`), with
 * normals round it (`smooth`) or flat. `twist` turns the first corner (radians) about the axis.
 */
export function prism(bench, rec, p0, p1, r0, r1, sides, { capRec = rec, caps = [true, true], smooth = false, uRound = 1, tileV = 1, twist = 0, ref = null } = {}) {
  const axis = sub(p1, p0);
  const L = len(axis);
  if (!(L > 1e-9)) return;
  const w = scl(axis, 1 / L);
  const [e1, e2] = ref ? (() => { const a = norm(sub(ref, scl(w, dot(ref, w)))); return [a, cross(w, a)]; })() : basisOf(w);
  const ringAt = (p, r, k) => { const a = twist + (k / sides) * Math.PI * 2; return add(p, add(scl(e1, Math.cos(a) * r), scl(e2, Math.sin(a) * r))); };
  const dirAt = (k) => { const a = twist + (k / sides) * Math.PI * 2; return add(scl(e1, Math.cos(a)), scl(e2, Math.sin(a))); };
  for (let k = 0; k < sides; k++) {
    const a0 = ringAt(p0, r0, k), a1 = ringAt(p0, r0, k + 1), b0 = ringAt(p1, r1, k), b1 = ringAt(p1, r1, k + 1);
    const mid = norm(add(dirAt(k), dirAt(k + 1)));
    const u0 = (k / sides) * uRound, u1 = ((k + 1) / sides) * uRound, v1 = L / tileV;
    if (smooth) {
      const n0 = dirAt(k), n1 = dirAt(k + 1);
      bench.tri(rec, a0, a1, b1, [u0, 0], [u1, 0], [u1, v1], mid, [n0, n1, n1]);
      bench.tri(rec, a0, b1, b0, [u0, 0], [u1, v1], [u0, v1], mid, [n0, n1, n0]);
    } else bench.quad(rec, a0, a1, b1, b0, [[u0, 0], [u1, 0], [u1, v1], [u0, v1]], mid);
  }
  const cap = (p, r, n) => {
    const pts = [], uvs = [];
    for (let k = 0; k < sides; k++) { pts.push(ringAt(p, r, k)); const a = (k / sides) * Math.PI * 2; uvs.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]); }
    bench.poly(capRec, pts, uvs, n);
  };
  if (caps[0] && r0 > 0) cap(p0, r0, scl(w, -1));
  if (caps[1] && r1 > 0) cap(p1, r1, w);
}

/** A rope along a polyline: a thin prism from each point to the next (four sides - enough at a rope's width), its uv
 *  round it and along it on the rope's tile. */
export function rope(bench, rec, points, r, { sides = 4, tileV = 0.5 } = {}) {
  let along = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const L = len(sub(b, a));
    const before = bench.group(rec).uv.length;
    prism(bench, rec, a, b, r, r, sides, { caps: [false, false], smooth: true, tileV });
    // carry the run's length into v, so a rope's lay runs on round its bends
    const uv = bench.group(rec).uv;
    for (let k = before + 1; k < uv.length; k += 2) uv[k] += along / tileV;
    along += L;
  }
}

/** A catenary's sag between two points: `n` pieces, the middle `sag` metres under the chord. */
export function sagging(a, b, sag, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = lerp3(a, b, t);
    p[1] -= sag * 4 * t * (1 - t);
    out.push(p);
  }
  return out;
}
