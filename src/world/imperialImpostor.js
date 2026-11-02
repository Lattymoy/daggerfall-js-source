// @ts-check
// IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY FROM AFAR: twenty kilometres of city outrun the
// stream (its land view a few pixels each way, the world's far plane 6 km), so from the city wall the White-Gold Tower,
// 8.4 pixels off, stood nowhere. The city's silhouette stands where nothing of the stream does: one landmark a slice
// handed to the far ring (render/farLandmarks.js FAR-LANDMARK, stream B's hook - its pass draws it in its painter's order,
// and a slice the stream has built stands down; scenes/capitalSkyline.js hands them in) - the tower, the walls, the
// landmarks and the streets' buildings as a few masses a slice (each its neighbourhood's height and colours, world/
// imperialFabric.js's styles). Coarse by law: tens of triangles a slice where only streets stand.
//
// The city's metres (x east, z south, y up from its ground) - the anchor's frame; a landmark's frame is its pixel's (x
// east and z north from its south-west corner).
import {
  IMPERIAL,
  IMPERIAL_CELLS,
  IMPERIAL_SPAN,
  IMPERIAL_SECTORS,
  polar,
  imperialLand,
  imperialDistrictAt,
  imperialGeo,
  imperialRoadAt,
  bridgeLine,
  PALACE,
  imperialTowerLod,
  imperialPalaceLod,
} from './imperialCity.js';
import { hoodAt, STOREY } from './imperialFabric.js';
import { BLOCK_M } from './spawnedDungeons.js';

const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M,
  PIXEL = 8 * B;
/** The impostor's colours, by material (the ring's own bytes - its ground's tints' range). */
export const IMPOSTOR_COLOURS = Object.freeze({
  marble: [232, 228, 218],
  gold: [212, 172, 80],
  stone: [168, 160, 144],
  dark: [92, 86, 78],
  facadeOchre: [204, 158, 102],
  facadeBrick: [150, 74, 50],
  facadeWhite: [224, 220, 208],
  facadeStone: [170, 164, 150],
  facadeTimber: [196, 182, 152],
  terracotta: [176, 84, 50],
  blueSlate: [66, 94, 134],
  roof: [82, 90, 102],
  leaves: [58, 96, 40],
  lake: [40, 66, 92],
  plaza: [184, 176, 160],
});
/** How far in from a cell's edges its mass stands, metres (the streets between - each side's half). */
export const IMPOSTOR_INSET = 11;

/** A hash of integers in [0, 1). */
function u01(...k) {
  let h = 0x2f6b;
  for (const v of k) {
    h = Math.imul(h ^ (v | 0), 0x9e3779b1);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}
/** The slice a point of the city's metres stands in (its index, sy * IMPERIAL_SPAN + sx), or -1 off the grid. */
export function impostorSliceAt(x, z) {
  const sx = Math.floor(x / PIXEL + IMPERIAL_SPAN / 2),
    sy = Math.floor(z / PIXEL + IMPERIAL_SPAN / 2);
  return sx < 0 || sy < 0 || sx >= IMPERIAL_SPAN || sy >= IMPERIAL_SPAN ? -1 : sy * IMPERIAL_SPAN + sx;
}

/**
 * THE SILHOUETTE'S QUADS, onto `out`: each `{ v: four corners [x, y, z], n: its outward normal, c: its colour, sea: 1 on the
 * lake, ground: 1 under everything (the lake), s: its slice, mid: its middle }` - `slice` the slice whose streets' masses it
 * lays (sliceMasses), null the landmarks, the walls and the lake alone.
 * @param {any[]} out @param {number | null} slice
 */
export function impostorQuads(out = [], slice = null) {
  const quad = (v, n, c, { sea = 0, ground = 0, at = null } = {}) => {
    const m = at ?? [(v[0][0] + v[2][0]) / 2, (v[0][2] + v[2][2]) / 2];
    out.push({
      v,
      n,
      c,
      sea,
      ground,
      s: impostorSliceAt(m[0], m[1]),
      mid: [
        (v[0][0] + v[1][0] + v[2][0] + v[3][0]) / 4,
        (v[0][1] + v[1][1] + v[2][1] + v[3][1]) / 4,
        (v[0][2] + v[1][2] + v[2][2] + v[3][2]) / 4,
      ],
    });
  };
  /** A box's top and four sides, axis-aligned: [x0, z0]-[x1, z1] from y0 to y1, its walls `wall` and its top `top`. */
  const box = (x0, z0, x1, z1, y0, y1, wall, top = wall) => {
    quad(
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 1, 0],
      top,
    );
    quad(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 0, -1],
      wall,
    );
    quad(
      [
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z1],
        [x1, y1, z1],
      ],
      [0, 0, 1],
      wall,
    );
    quad(
      [
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      [1, 0, 0],
      wall,
    );
    quad(
      [
        [x0, y0, z1],
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
      ],
      [-1, 0, 0],
      wall,
    );
  };
  /** A wall's run from a to b (the map's [x, z]), `t` thick, `h` tall: its two faces and its top. */
  const run = (a, b, t, h, c) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
      o = [(n[0] * t) / 2, (n[1] * t) / 2];
    const A = [a[0] + o[0], a[1] + o[1]],
      Bq = [b[0] + o[0], b[1] + o[1]],
      C = [b[0] - o[0], b[1] - o[1]],
      D = [a[0] - o[0], a[1] - o[1]];
    quad(
      [
        [A[0], 0, A[1]],
        [Bq[0], 0, Bq[1]],
        [Bq[0], h, Bq[1]],
        [A[0], h, A[1]],
      ],
      [n[0], 0, n[1]],
      c,
    );
    quad(
      [
        [C[0], 0, C[1]],
        [D[0], 0, D[1]],
        [D[0], h, D[1]],
        [C[0], h, C[1]],
      ],
      [-n[0], 0, -n[1]],
      c,
    );
    quad(
      [
        [A[0], h, A[1]],
        [Bq[0], h, Bq[1]],
        [C[0], h, C[1]],
        [D[0], h, D[1]],
      ],
      [0, 1, 0],
      c,
    );
  };
  /** A ring of runs round the middle at radius r, `n` of them (a bearing's span each). */
  const ring = (r, n, t, h, c, skip = (/** @type {number} */ _b) => false) => {
    for (let i = 0; i < n; i++) {
      const b0 = (i * 360) / n,
        b1 = ((i + 1) * 360) / n;
      if (!skip((b0 + b1) / 2)) run(polar(b0, r), polar(b1, r), t, h, c);
    }
  };
  /** An n-sided prism about (x, z) from (r0, y0) to (r1, y1): its sides (and its top where `cap`). */
  const prism = (x, z, n, r0, y0, r1, y1, c, cap = true) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i * 2 * Math.PI) / n,
        a1 = ((i + 1) * 2 * Math.PI) / n,
        am = (a0 + a1) / 2;
      const p = (a, r, y) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      quad(
        [p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1)],
        [Math.cos(am), (r0 - r1) / Math.max(1, y1 - y0), Math.sin(am)],
        c,
        { at: [x, z] },
      );
    }
    if (cap && r1 > 0)
      for (let i = 0; i < n; i += 2) {
        const a = (k) => [x + Math.cos((k * 2 * Math.PI) / n) * r1, y1, z + Math.sin((k * 2 * Math.PI) / n) * r1];
        quad([[x, y1, z], a(i), a(i + 1), a(i + 2)], [0, 1, 0], c, { at: [x, z] });
      }
  };
  const I = IMPERIAL,
    g = imperialGeo(),
    C = IMPOSTOR_COLOURS,
    W = I.waterfront,
    [tx, tz] = g.temple,
    P = I.temple;
  if (slice != null) return sliceMasses(out, slice, box, { I, g, C, W, tx, tz, P });
  // the lake round the isle (the ground's, first), the docks' reach where the Waterfront stands out into it
  for (let i = 0; i < 120; i++) {
    const b0 = i * 3,
      b1 = b0 + 3,
      inner = (b) => (b >= W.b0 && b <= W.b1 ? W.r1 : I.isle);
    const p = (b, r) => {
      const [x, z] = polar(b, r);
      return [x, 0.2, z];
    };
    quad([p(b0, inner(b0 + 1.5)), p(b1, inner(b0 + 1.5)), p(b1, I.lake), p(b0, I.lake)], [0, 1, 0], C.lake, {
      sea: 1,
      ground: 1,
      at: polar(b0 + 1.5, (I.isle + I.lake) / 2),
    });
  }
  // the tower: its foundation, its fins' mass, its shaft, its gallery, its crown and its gilt spire
  // IC-GRAND (the owner's tower): its rotunda and its low dome, its round shaft (a band at every other tier's balcony),
  // its gallery, its crown and its gilt spire - IC-TOWER-LOD: the far view's coarse tower's own prisms (imperialTowerLod)
  const mats = { marble: C.marble, gold: C.gold, slate: C.blueSlate };
  for (const t of imperialTowerLod(I.tower)) prism(0, 0, t.n, t.r0, t.y0, t.r1, t.y1, mats[t.mat], t.cap);
  // IC-GRAND: the palace round its foot - its wings under their slate, its pillar-towers; the tombs - IC-TOWER-LOD: the
  // far view's coarse palace's own (imperialPalaceLod)
  const PLod = imperialPalaceLod(I);
  for (const w of PLod.runs) run(w.a, w.b, w.t, w.h, mats[w.mat]);
  for (const p of PLod.prisms) prism(p.x, p.z, p.n, p.r0, p.y0, p.r1, p.y1, mats[p.mat], p.cap);
  for (const [x, z] of g.tombs)
    box(x - I.tombs.w / 2, z - I.tombs.w / 2, x + I.tombs.w / 2, z + I.tombs.w / 2, 0, I.tombs.h + 10, C.marble);
  // the walls: the palace's and the city's rings (their gates open), the district walls' runs, the watch towers
  const gateAt = (gates, w, r) => (b) =>
    gates.some((q) => Math.abs(((b - q + 540) % 360) - 180) < ((w / r) * 180) / Math.PI);
  ring(
    I.palaceWall.r,
    96,
    I.palaceWall.thick,
    I.palaceWall.h,
    C.stone,
    gateAt(
      IMPERIAL_SECTORS.map(([, b]) => b + 30),
      I.palaceWall.gate * 4,
      I.palaceWall.r,
    ),
  );
  ring(
    I.cityWall.r,
    240,
    I.cityWall.thick,
    I.cityWall.h,
    C.stone,
    gateAt(I.cityWall.gates, I.cityWall.gate * 4, I.cityWall.r),
  );
  for (let i = 0; i < 360; i += I.cityWall.towerEvery * 6) {
    const [x, z] = polar(i, I.cityWall.r);
    box(
      x - I.cityWall.towerR,
      z - I.cityWall.towerR,
      x + I.cityWall.towerR,
      z + I.cityWall.towerR,
      0,
      I.cityWall.towerH,
      C.stone,
      C.roof,
    );
  }
  for (const [a, b] of g.walls) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 200);
    for (let k = 0; k < n; k++)
      run(
        [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n],
        [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n],
        I.districtWall.thick,
        I.districtWall.h,
        C.stone,
      );
    box(
      b[0] - I.cityWall.watchR,
      b[1] - I.cityWall.watchR,
      b[0] + I.cityWall.watchR,
      b[1] + I.cityWall.watchR,
      0,
      I.cityWall.watchH,
      C.stone,
      C.roof,
    );
  }
  // the landmarks: the Temple of the One, Talos's statue, the Prison and its Bastion, the University, its spire and its
  // hall, the arena (Daggerfall's, in its cell), the Talos Bridge's deck over the lake
  box(tx - P.w / 2, tz - P.l / 2, tx + P.w / 2, tz + P.l / 2, 0, P.h + 8, C.marble, C.blueSlate);
  prism(tx, tz, 8, P.domeR, P.h + 8, P.domeR * 0.4, P.h + 8 + P.domeR, C.gold);
  box(g.statue[0] - 6, g.statue[1] - 6, g.statue[0] + 6, g.statue[1] + 6, 0, 52, C.gold);
  for (const [[cx, cz], half, h] of [
    [g.prison, I.prison.half, I.prison.h],
    [g.uni, I.university.half, I.university.h],
  ]) {
    const q = [
      [cx - half, cz - half],
      [cx + half, cz - half],
      [cx + half, cz + half],
      [cx - half, cz + half],
    ];
    for (let e = 0; e < 4; e++) run(q[e], q[(e + 1) & 3], 10, h, C.stone);
  }
  prism(g.prison[0], g.prison[1], 8, I.prison.bastionR, 0, I.prison.bastionR * 0.85, I.prison.bastionH, C.dark);
  prism(
    g.uniTower[0],
    g.uniTower[1],
    8,
    I.university.spireR,
    0,
    I.university.spireR * 0.6,
    I.university.spireH,
    C.marble,
  );
  box(
    g.uniHall[0] - I.university.hall / 2,
    g.uniHall[1] - I.university.hall / 2,
    g.uniHall[0] + I.university.hall / 2,
    g.uniHall[1] + I.university.hall / 2,
    0,
    34,
    C.marble,
    C.blueSlate,
  );
  prism(g.arena[0], g.arena[1], 12, 46, 0, 46, 24, C.facadeOchre, false);
  const [ba, bb] = bridgeLine(I),
    bn = Math.ceil(Math.hypot(bb[0] - ba[0], bb[1] - ba[1]) / 150);
  for (let k = 0; k < bn; k++)
    run(
      [ba[0] + ((bb[0] - ba[0]) * k) / bn, ba[1] + ((bb[1] - ba[1]) * k) / bn],
      [ba[0] + ((bb[0] - ba[0]) * (k + 1)) / bn, ba[1] + ((bb[1] - ba[1]) * (k + 1)) / bn],
      I.bridge.w,
      I.bridge.deck,
      C.stone,
    );
  return out;
}
/** A park's clump of trees, metres tall, as the far view stands it. */
const PARK_TOP = 15;
/**
 * A SLICE'S STREETS AS A FEW MASSES onto `out` (impostorQuads' `box`): each of its 8 x 8 cells keyed by what stands on it
 * - its neighbourhood's walls, roof and height (a storey at a time, its eave and its roof's rise), a park's grove (a 2 x 2
 * of cells, one in two), or nothing (the landmarks' grounds, the roads, the walls, the lake, the Palace District's lawns) - and
 * the cells of one key merged into rectangles (greedy, row by row, as wide and then as deep as the key runs), each a box
 * inset IMPOSTOR_INSET from its outer edges: a district's slice a handful of boxes, ten triangles each.
 */
function sliceMasses(out, s, box, { I, g, C, W, tx, tz, P }) {
  const clear = (x, z) => {
    const rr = Math.hypot(x, z);
    if (rr < I.palaceWall.r + 40 || Math.abs(rr - I.cityWall.r) < 60 || !imperialLand(x, z)) return false;
    if (imperialDistrictAt(x, z) === PALACE || imperialRoadAt(x, z, 6)) return false;
    if (Math.abs(x - tx) < P.w / 2 + 50 && Math.abs(z - tz) < P.l / 2 + 50) return false;
    for (const [p, d] of [
      [g.statue, I.statue.plaza + 40],
      [g.divines, I.divines.court + 40],
      [g.pool, I.pool.r0 + 40],
      [g.market, I.market.half * 1.5],
      [g.arena, 120],
      [g.uniTower, 80],
    ])
      if (Math.hypot(x - p[0], z - p[1]) < d) return false;
    for (const [p, half] of [
      [g.prison, I.prison.half],
      [g.uni, I.university.half],
    ])
      if (Math.max(Math.abs(x - p[0]), Math.abs(z - p[1])) < half + 40) return false;
    return !g.walls.some(([a, b]) => {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2),
        ),
      );
      return Math.hypot(x - a[0] - t * (b[0] - a[0]), z - a[1] - t * (b[1] - a[1])) < 50;
    });
  };
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  /** @type {Array<?string>} */ const key = new Array(64).fill(null);
  const spec = new Map();
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const r = sy * 8 + i,
        c = sx * 8 + j,
        x = (c - HALF + 0.5) * B,
        z = (r - HALF + 0.5) * B;
      if (Math.hypot(x, z) > W.r1 + B || !clear(x, z)) continue;
      const h = hoodAt(x, z);
      if (!h) continue;
      if (h.kind === 'park') {
        if (u01(r >> 1, c >> 1, 5) >= 0.5) continue; // a grove a 2 x 2 of cells, one in two
        key[i * 8 + j] = 'park';
        spec.set('park', { top: PARK_TOP, wall: C.leaves, roof: C.leaves });
        continue;
      }
      const storeys = Math.round((h.k[0] + h.k[1]) / 2),
        gable = h.gable >= 0.5,
        k = `${h.style.walls[0]}|${h.style.roof}|${storeys}|${gable ? 1 : 0}`;
      key[i * 8 + j] = k;
      if (!spec.has(k))
        spec.set(k, {
          top: storeys * STOREY + (gable ? 2.4 : 0.9),
          wall: C[h.style.walls[0]] ?? C.stone,
          roof: C[h.style.roof] ?? C.roof,
        });
    }
  const used = new Uint8Array(64);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const k = key[i * 8 + j];
      if (!k || used[i * 8 + j]) continue;
      let w = 1,
        d = 1;
      while (j + w < 8 && !used[i * 8 + j + w] && key[i * 8 + j + w] === k) w++;
      for (; i + d < 8; d++) {
        let row = true;
        for (let q = j; q < j + w; q++)
          if (used[(i + d) * 8 + q] || key[(i + d) * 8 + q] !== k) {
            row = false;
            break;
          }
        if (!row) break;
      }
      for (let a = i; a < i + d; a++) for (let q = j; q < j + w; q++) used[a * 8 + q] = 1;
      const { top, wall, roof } = /** @type {{ top: number, wall: number[], roof: number[] }} */ (spec.get(k));
      const c0 = sx * 8 + j,
        r0 = sy * 8 + i;
      box(
        (c0 - HALF) * B + IMPOSTOR_INSET,
        (r0 - HALF) * B + IMPOSTOR_INSET,
        (c0 + w - HALF) * B - IMPOSTOR_INSET,
        (r0 + d - HALF) * B - IMPOSTOR_INSET,
        0,
        top + (u01(s, i, j, 9) - 0.5) * 2,
        wall,
        roof,
      );
    }
  return out;
}

/** The landmarks' quads by their slice - the tower, the walls, the landmarks (the lake left to the ground the far ring
 *  draws) - made once. @type {?Map<number, any[]>} */
let _landmarks = null;
const landmarksOf = (s) => {
  if (!_landmarks) {
    _landmarks = new Map();
    for (const q of impostorQuads([], null))
      if (!q.sea && !q.ground && q.s >= 0) {
        const l = _landmarks.get(q.s);
        if (l) l.push(q);
        else _landmarks.set(q.s, [q]);
      }
  }
  return _landmarks.get(s) ?? [];
};
/**
 * ONE SLICE'S SILHOUETTE (FAR-LANDMARK's mesh, render/farLandmarks.js): the landmarks whose middles stand in slice `s` and
 * its streets' masses, in its pixel's frame - x east and z north from its south-west corner, metres (TERRAIN_SIZE a pixel),
 * y up from its ground (the host lifts it onto the ground the far ring stands there) - four vertices a quad, two
 * triangles; null where nothing stands (the lake, the open shore).
 * @param {number} s
 * @returns {?{ positions: Float32Array, normals: Float32Array, colors: Uint8Array, indices: Uint16Array | Uint32Array }}
 */
export function imperialLandmarkMesh(s) {
  const quads = [...landmarksOf(s), ...impostorQuads([], s)];
  if (!quads.length) return null;
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN),
    ox = (sx - IMPERIAL_SPAN / 2) * PIXEL,
    oz = (sy - IMPERIAL_SPAN / 2 + 1) * PIXEL;
  const n = quads.length,
    positions = new Float32Array(n * 12),
    normals = new Float32Array(n * 12),
    colors = new Uint8Array(n * 12);
  const indices = n * 4 <= 65536 ? new Uint16Array(n * 6) : new Uint32Array(n * 6);
  quads.forEach((q, i) => {
    const l = Math.hypot(q.n[0], q.n[1], q.n[2]) || 1;
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 3;
      positions[o] = q.v[k][0] - ox;
      positions[o + 1] = q.v[k][1];
      positions[o + 2] = oz - q.v[k][2];
      normals[o] = q.n[0] / l;
      normals[o + 1] = q.n[1] / l;
      normals[o + 2] = -q.n[2] / l;
      colors[o] = q.c[0];
      colors[o + 1] = q.c[1];
      colors[o + 2] = q.c[2];
    }
    const v = i * 4;
    indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  });
  return { positions, normals, colors, indices };
}
