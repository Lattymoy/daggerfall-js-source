// @ts-check
// FIGUREHEAD (2026-10-30, the owner: "Ship figurehead customizations"; bible/03-World/Naval-Refit.md FIGUREHEAD) - A
// CARVING AT HER STEM: where it stands on each hull, and its meshes drawn. The port's own: Daggerfall has no sea.
// Her stem is read where she is drawn, as SHIP-PLAQUE reads her bows: rays cast aft along her middle into her planking
// (`stemOf`). The carving is fitted under what stands over her stem (`fitCarving`): it crosses nothing solid of hers -
// her bowsprit, a chaser - and only its root leans on her planking. A rope's faces are no obstacle: the carrack's
// bobstay runs a hand off her stem. The highest place that fits wins, the largest size first; one mount a hull serves
// every carving (each inside figureheadModels.js CARVING_BOX), found once a session.
import { plankingOf } from './shipPlaque.js';
import { figureheadHull, figureheadId } from '../../systems/naval/figurehead.js';
import { paintedCarving, allCarvings, CARVING_BOX } from '../../world/ships/figureheadModels.js';
import { FIGUREHEAD_ARCHIVE, carvingArt } from '../../world/ships/figureheadArt.js';

/** A carving's size (its frame's unit, m): this share of her length, between the least and the most. */
export const FIGURE_SHARE = 0.05;
export const FIGURE_MIN = 0.5;
export const FIGURE_MAX = 2.8;
/** The sizes tried, largest first, and how far down her stem a carving may stand (of its size, under her stem's head). */
export const FIGURE_SIZES = Object.freeze([1, 0.9, 0.8, 0.7, 0.6, 0.5]);
export const FIGURE_DROP = 1.4;
/** The leans tried after its own (radians, + further forward). */
export const FIGURE_LEANS = Object.freeze([0, 0.14, -0.14, 0.28]);
/** A carving's root: its faces nearer her stem than this (its frame's z) may lean on her planking. */
export const FIGURE_ROOT_Z = 0.2;
/** The lowest a carving may reach over the water (m). */
export const FIGURE_WATER = 0.3;
/** Her stem is in her bows: a hit this share of her length aft of her bow's end is no stem. */
export const STEM_SHARE = 0.3;
/** A face narrower than this (m - twice its area over its longest edge) is a rope's or a pole's. */
export const ROPE_M = 0.08;
/** A carving not drawn for this many of the pool's draws gives its mesh back. */
export const FIGURE_IDLE_DRAWS = 1800;
/** The rays read her stem a hair to starboard of her middle line, never along the seam her two sides meet on. */
const STEM_X = 1e-3;

/** Where segment P..Q crosses the triangle at `T[j..j+8]`, as its share of the way (0..1) - or -1. Scalars alone: the fit
 *  asks it millions of times. */
function crossing(px, py, pz, qx, qy, qz, T, j) {
  const ax = T[j],
    ay = T[j + 1],
    az = T[j + 2];
  const e1x = T[j + 3] - ax,
    e1y = T[j + 4] - ay,
    e1z = T[j + 5] - az,
    e2x = T[j + 6] - ax,
    e2y = T[j + 7] - ay,
    e2z = T[j + 8] - az;
  const dx = qx - px,
    dy = qy - py,
    dz = qz - pz;
  const hx = dy * e2z - dz * e2y,
    hy = dz * e2x - dx * e2z,
    hz = dx * e2y - dy * e2x,
    det = e1x * hx + e1y * hy + e1z * hz;
  if (Math.abs(det) < 1e-14) return -1;
  const f = 1 / det,
    sx = px - ax,
    sy = py - ay,
    sz = pz - az,
    u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return -1;
  const cx = sy * e1z - sz * e1y,
    cy = sz * e1x - sx * e1z,
    cz = sx * e1y - sy * e1x,
    v = f * (dx * cx + dy * cy + dz * cz);
  if (v < 0 || u + v > 1) return -1;
  const t = f * (e2x * cx + e2y * cy + e2z * cz);
  return t >= 0 && t <= 1 ? t : -1;
}
/** Whether the triangles at A[i..] and B[j..] cross: an edge of either through the other. */
function trianglesCross(A, i, B, j) {
  for (const [P, p, Q, q] of [
    [A, i, B, j],
    [B, j, A, i],
  ]) {
    for (let k = 0; k < 3; k++) {
      const a = p + k * 3,
        b = p + ((k + 1) % 3) * 3;
      if (crossing(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], Q, q) >= 0) return true;
    }
  }
  return false;
}
/** Every triangle of `meshes` as nine numbers. */
function flatTriangles(meshes) {
  const out = [];
  for (const m of meshes) {
    const p = m.positions;
    for (let i = 0; i < m.indices.length; i++) {
      const j = m.indices[i] * 3;
      out.push(p[j], p[j + 1], p[j + 2]);
    }
  }
  return Float64Array.from(out);
}
/** Each triangle's box `[x0, y0, z0, x1, y1, z1]`. */
function boxesOf(T) {
  const B = new Float64Array((T.length / 9) * 6);
  for (let i = 0, b = 0; i < T.length; i += 9, b += 6)
    for (let k = 0; k < 3; k++) {
      B[b + k] = Math.min(T[i + k], T[i + 3 + k], T[i + 6 + k]);
      B[b + 3 + k] = Math.max(T[i + k], T[i + 3 + k], T[i + 6 + k]);
    }
  return B;
}
/** A sliver - a rope's or a pole's face: twice its area over its longest edge under ROPE_M. */
function sliver(T, i) {
  const ux = T[i + 3] - T[i],
    uy = T[i + 4] - T[i + 1],
    uz = T[i + 5] - T[i + 2],
    vx = T[i + 6] - T[i],
    vy = T[i + 7] - T[i + 1],
    vz = T[i + 8] - T[i + 2];
  const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  const edge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(vx - ux, vy - uy, vz - uz));
  return edge > 0 && area2 / edge < ROPE_M;
}

/**
 * HER STEM on planking mesh `m`: its face's z at each height up to its head, read by rays cast aft along her middle -
 * `{ yHead, zHead, zAt(y) }` (zAt null where no stem is), or null for a bow the rays never meet.
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number> }} m @param {{ bowZ: number, aftZ: number, deck: number, top: number }} build
 */
export function stemOf(m, build) {
  if (!m) return null;
  const T = flatTriangles([m]),
    from = build.bowZ + 10,
    aftMost = build.bowZ - STEM_SHARE * (build.bowZ - build.aftZ);
  const zAt = (y) => {
    let best = -1;
    for (let j = 0; j < T.length; j += 9) {
      const t = crossing(STEM_X, y, from, STEM_X, y, aftMost, T, j);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    return best < 0 ? null : from + (aftMost - from) * best;
  };
  const top = Math.max(build.deck, build.top) + 2,
    dy = Math.max(0.02, top / 240);
  let head = null,
    miss = null;
  for (let y = 0.15; y <= top; y += dy) {
    if (zAt(y) != null) head = y;
    else if (head != null) {
      miss = y;
      break;
    }
  }
  if (head == null) return null;
  if (miss != null)
    for (let k = 0; k < 8; k++) {
      const mid = (head + miss) / 2;
      if (zAt(mid) != null) head = mid;
      else miss = mid;
    }
  return { yHead: head, zHead: /** @type {number} */ (zAt(head)), zAt };
}

/** A mount's matrix (column-major, her MeshObject's frame from the carving's): stood at `at`, leant `lean` forward, `s` its size. */
export function mountMatrix(at, lean, s) {
  const c = Math.cos(lean) * s,
    n = Math.sin(lean) * s;
  return new Float32Array([s, 0, 0, 0, 0, c, n, 0, 0, -n, c, 0, at[0], at[1], at[2], 1]);
}

/** Every carving's triangles, in one grid over CARVING_BOX (cells GRID on a side, keyed by number), and which are roots. */
const GRID = 0.08,
  CELL_OFF = 32;
const cellKey = (x, y, z) => ((x + CELL_OFF) * 64 + (y + CELL_OFF)) * 64 + (z + CELL_OFF);
let _union = null;
function carvingUnion() {
  if (_union) return _union;
  const T = flatTriangles(allCarvings()),
    B = boxesOf(T),
    n = T.length / 9,
    root = new Uint8Array(n),
    cells = new Map();
  for (let i = 0; i < n; i++) {
    root[i] = B[i * 6 + 2] < FIGURE_ROOT_Z ? 1 : 0;
    const g = (v) => Math.floor(v / GRID);
    for (let x = g(B[i * 6]); x <= g(B[i * 6 + 3]); x++)
      for (let y = g(B[i * 6 + 1]); y <= g(B[i * 6 + 4]); y++)
        for (let z = g(B[i * 6 + 2]); z <= g(B[i * 6 + 5]); z++) {
          const k = cellKey(x, y, z),
            c = cells.get(k);
          if (c) c.push(i);
          else cells.set(k, [i]);
        }
  }
  _union = { T, B, root, cells, stamp: new Int32Array(n), mark: 0 };
  return _union;
}
/** Whether the triangle at `L[0..8]` (the carving's frame) crosses a carving's - `planking`: only one past its root. */
function crossesCarving(L, planking) {
  const U = carvingUnion(),
    bx = CARVING_BOX;
  const lo = [0, 1, 2].map((k) => Math.min(L[k], L[3 + k], L[6 + k])),
    hi = [0, 1, 2].map((k) => Math.max(L[k], L[3 + k], L[6 + k]));
  if (hi[0] < bx[0] || lo[0] > bx[3] || hi[1] < bx[1] || lo[1] > bx[4] || hi[2] < bx[2] || lo[2] > bx[5]) return false;
  const mark = ++U.mark,
    g = (v) => Math.floor(v / GRID);
  for (let x = g(lo[0]); x <= g(hi[0]); x++)
    for (let y = g(lo[1]); y <= g(hi[1]); y++)
      for (let z = g(lo[2]); z <= g(hi[2]); z++) {
        for (const i of U.cells.get(cellKey(x, y, z)) ?? []) {
          if (U.stamp[i] === mark || (planking && U.root[i])) continue;
          U.stamp[i] = mark;
          const b = i * 6;
          if (
            U.B[b] > hi[0] ||
            U.B[b + 3] < lo[0] ||
            U.B[b + 1] > hi[1] ||
            U.B[b + 4] < lo[1] ||
            U.B[b + 2] > hi[2] ||
            U.B[b + 5] < lo[2]
          )
            continue;
          if (trianglesCross(L, 0, U.T, i * 9)) return true;
        }
      }
  return false;
}

/** A carving's size on a hull of `build` (m a unit). */
export const figureSizeOf = (build) =>
  Math.min(FIGURE_MAX, Math.max(FIGURE_MIN, FIGURE_SHARE * (build.bowZ - build.aftZ)));

/**
 * THE MOUNT on a hull: her `surface` (the pool's hullSurface) and `build` - `{ at, lean, size, matrix, stem }`, the
 * carving stood on her stem at `at` (her MeshObject's frame), leant `lean`, `size` its unit - or null where no carving
 * fits her stem (none is drawn there).
 */
export function fitCarving(surface, build) {
  if (!surface?.length || !build) return null;
  const pi = plankingOf(surface, build);
  const stem = pi >= 0 ? stemOf(surface[pi], build) : null;
  if (!stem) return null;
  const full = figureSizeOf(build),
    reach = full * 1.6;
  const region = [
    -reach,
    stem.yHead - (FIGURE_DROP + 0.6) * full,
    stem.zHead - reach,
    reach,
    stem.yHead + reach,
    stem.zHead + reach * 1.2,
  ];
  // her solid parts near her stem (a rope's or a pole's faces left out), and her planking there
  const near = (T, ropes) => {
    const B = boxesOf(T),
      keep = [];
    for (let i = 0, b = 0; i < T.length; i += 9, b += 6) {
      if (
        B[b + 3] < region[0] ||
        B[b] > region[3] ||
        B[b + 4] < region[1] ||
        B[b + 1] > region[4] ||
        B[b + 5] < region[2] ||
        B[b + 2] > region[5]
      )
        continue;
      if (!ropes || !sliver(T, i)) for (let k = 0; k < 9; k++) keep.push(T[i + k]);
    }
    const out = Float64Array.from(keep);
    return { T: out, B: boxesOf(out) };
  };
  const others = near(flatTriangles(surface.filter((_, i) => i !== pi)), true),
    planks = near(flatTriangles([surface[pi]]), false);
  const bx = CARVING_BOX,
    L = new Float64Array(9);
  const fits = (at, lean, s) => {
    const c = Math.cos(lean),
      n = Math.sin(lean);
    // the box the carving's own box stands in, in her frame - and over the water
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [bx[0], bx[3]])
      for (const y of [bx[1], bx[4]])
        for (const z of [bx[2], bx[5]]) {
          const p = [at[0] + s * x, at[1] + s * (y * c - z * n), at[2] + s * (y * n + z * c)];
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p[k]);
            hi[k] = Math.max(hi[k], p[k]);
          }
        }
    if (lo[1] < FIGURE_WATER) return false;
    for (const planking of [false, true]) {
      const { T, B } = planking ? planks : others;
      for (let i = 0, b = 0; i < T.length; i += 9, b += 6) {
        if (
          B[b + 3] < lo[0] ||
          B[b] > hi[0] ||
          B[b + 4] < lo[1] ||
          B[b + 1] > hi[1] ||
          B[b + 5] < lo[2] ||
          B[b + 2] > hi[2]
        )
          continue;
        for (let k = 0; k < 9; k += 3) {
          // into the carving's frame: the mount undone
          const dx = T[i + k] - at[0],
            dy = T[i + k + 1] - at[1],
            dz = T[i + k + 2] - at[2];
          L[k] = dx / s;
          L[k + 1] = (dy * c + dz * n) / s;
          L[k + 2] = (-dy * n + dz * c) / s;
        }
        if (crossesCarving(L, planking)) return false;
      }
    }
    return true;
  };
  for (const k of FIGURE_SIZES) {
    const s = full * k;
    for (const lean of FIGURE_LEANS) {
      for (let y = stem.yHead - 0.04 * s; y >= stem.yHead - FIGURE_DROP * s; y -= 0.04 * s) {
        const z = stem.zAt(y);
        if (z == null) continue;
        const at = [0, y, z];
        if (fits(at, lean, s))
          return {
            at,
            lean,
            size: s,
            matrix: mountMatrix(at, lean, s),
            stem: { yHead: stem.yHead, zHead: stem.zHead },
          };
      }
    }
  }
  return null;
}

/**
 * THE FIGUREHEADS, a pool's: `drawFor(boat, n, paint)` the mesh of carving `n` in `paint` and the matrix that stands it
 * on her hull (`{ mesh, matrix }` - her hull's mount found once, `surfaceOf` the pool's hullSurface), or null; `prime(hull)`
 * finds a hull's mount now (the pool's preload: never inside its draw); `sweep()` once a draw lets go of a carving not
 * drawn for FIGURE_IDLE_DRAWS, and of the pictures once none is drawn. A renderer without meshes draws none.
 * @param {{ renderer: any, surfaceOf: (hull: number) => any[] | null, buildOf: (hull: number) => any }} deps
 */
export function createFigureheads(deps) {
  const mounts = new Map(); // hull -> fitCarving's, or null
  const meshes = new Map(); // `${id}|${paint}` -> { mesh, seen }
  let draws = 0,
    art = null; // the records the pictures went up under, while they are up
  const mountOf = (hull) => {
    if (!mounts.has(hull))
      mounts.set(hull, figureheadHull(hull) ? fitCarving(deps.surfaceOf(hull), deps.buildOf(hull)) : null);
    return mounts.get(hull);
  };
  return {
    prime: (hull) => {
      mountOf(hull);
    },
    mountOf,
    drawFor(boat, n, paint) {
      const r = deps.renderer,
        id = figureheadId(n);
      if (!id || !r?.createMesh || !r.uploadTexture || !figureheadHull(boat.hull)) return null;
      const mount = mountOf(boat.hull);
      if (!mount) return null;
      if (!art) {
        art = [];
        for (const [rec, pic] of carvingArt()) {
          r.uploadTexture(FIGUREHEAD_ARCHIVE, rec, pic, { opaque: true });
          art.push(rec);
        }
      }
      const key = `${id}|${paint | 0}`;
      let had = meshes.get(key);
      if (!had) meshes.set(key, (had = { mesh: r.createMesh(paintedCarving(id, paint | 0)), seen: draws }));
      had.seen = draws;
      return { mesh: had.mesh, matrix: mount.matrix };
    },
    sweep() {
      draws++;
      for (const [key, c] of meshes)
        if (draws - c.seen > FIGURE_IDLE_DRAWS) {
          deps.renderer?.destroyMesh?.(c.mesh);
          meshes.delete(key);
        }
      if (art && !meshes.size) {
        for (const rec of art) deps.renderer?.releaseTexture?.(FIGUREHEAD_ARCHIVE, rec);
        art = null;
      }
    },
    _meshes: meshes,
  };
}
