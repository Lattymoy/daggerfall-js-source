// @ts-check
// IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY FROM AFAR: twenty kilometres of city outrun the
// stream (its land view a few pixels each way, the world's far plane 6 km), so from the city wall the White-Gold Tower,
// 8.4 pixels off, stood nowhere. The city's impostor stands where nothing of the stream does: the far ring's pass draws
// it (render/farRing.js, render/ringImpostors.js) at the far plane, so every pixel the stream has built paints over it,
// and its slices the stream has built are left out of it - the tower, the walls, the landmarks and a mass a cell for the
// streets' buildings (each its district's height and colours, world/imperialFabric.js's styles), Lake Rumare round the
// isle. Coarse by law: a box a cell, its fronts towards the eye's pixel alone, painted far to near (the pass writes no
// depth) - re-ordered as the eye's pixel or the built set moves, never a frame.
//
// The city's metres (x east, z south, y up from its ground) - the anchor's frame; the ring's frame is +z north.
import { IMPERIAL, IMPERIAL_CELLS, IMPERIAL_SPAN, IMPERIAL_SECTORS, polar, imperialLand, imperialDistrictAt, imperialGeo, imperialRoadAt, bridgeLine, PALACE } from './imperialCity.js';
import { hoodAt, STOREY } from './imperialFabric.js';
import { BLOCK_M } from './spawnedDungeons.js';

const HALF = IMPERIAL_CELLS / 2, B = BLOCK_M, PIXEL = 8 * B;
/** The impostor's colours, by material (the ring's own bytes - its ground's tints' range). */
export const IMPOSTOR_COLOURS = Object.freeze({
  marble: [232, 228, 218], gold: [212, 172, 80], stone: [168, 160, 144], dark: [92, 86, 78],
  facadeOchre: [204, 158, 102], facadeBrick: [150, 74, 50], facadeWhite: [224, 220, 208], facadeStone: [170, 164, 150], facadeTimber: [196, 182, 152],
  terracotta: [176, 84, 50], blueSlate: [66, 94, 134], roof: [82, 90, 102], leaves: [58, 96, 40], lake: [40, 66, 92], plaza: [184, 176, 160],
});
/** How far in from a cell's edges its mass stands, metres (the streets between - each side's half). */
export const IMPOSTOR_INSET = 11;

/** A hash of integers in [0, 1). */
function u01(...k) {
  let h = 0x2f6b;
  for (const v of k) { h = Math.imul(h ^ (v | 0), 0x9e3779b1); h ^= h >>> 15; }
  return (h >>> 0) / 4294967296;
}
/** The slice a point of the city's metres stands in (its index, sy * IMPERIAL_SPAN + sx), or -1 off the grid. */
export function impostorSliceAt(x, z) {
  const sx = Math.floor(x / PIXEL + IMPERIAL_SPAN / 2), sy = Math.floor(z / PIXEL + IMPERIAL_SPAN / 2);
  return sx < 0 || sy < 0 || sx >= IMPERIAL_SPAN || sy >= IMPERIAL_SPAN ? -1 : sy * IMPERIAL_SPAN + sx;
}

/**
 * THE IMPOSTOR'S QUADS, onto `out`: each `{ v: four corners [x, y, z], n: its outward normal, c: its colour, sea: 1 on the
 * lake, ground: 1 under everything (the lake), s: its slice, mid: its middle }` - `rows` the cell rows whose masses it
 * lays (null: the landmarks, the walls and the lake alone).
 * @param {any[]} out @param {[number, number] | null} rows
 */
export function impostorQuads(out = [], rows = [0, IMPERIAL_CELLS]) {
  const quad = (v, n, c, { sea = 0, ground = 0, at = null } = {}) => {
    const m = at ?? [(v[0][0] + v[2][0]) / 2, (v[0][2] + v[2][2]) / 2];
    out.push({ v, n, c, sea, ground, s: impostorSliceAt(m[0], m[1]), mid: [(v[0][0] + v[1][0] + v[2][0] + v[3][0]) / 4, (v[0][1] + v[1][1] + v[2][1] + v[3][1]) / 4, (v[0][2] + v[1][2] + v[2][2] + v[3][2]) / 4] });
  };
  /** A box's top and four sides, axis-aligned: [x0, z0]-[x1, z1] from y0 to y1, its walls `wall` and its top `top`. */
  const box = (x0, z0, x1, z1, y0, y1, wall, top = wall) => {
    quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], top);
    quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], wall);
    quad([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1], wall);
    quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], wall);
    quad([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0], wall);
  };
  /** A wall's run from a to b (the map's [x, z]), `t` thick, `h` tall: its two faces and its top. */
  const run = (a, b, t, h, c) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len], o = [n[0] * t / 2, n[1] * t / 2];
    const A = [a[0] + o[0], a[1] + o[1]], Bq = [b[0] + o[0], b[1] + o[1]], C = [b[0] - o[0], b[1] - o[1]], D = [a[0] - o[0], a[1] - o[1]];
    quad([[A[0], 0, A[1]], [Bq[0], 0, Bq[1]], [Bq[0], h, Bq[1]], [A[0], h, A[1]]], [n[0], 0, n[1]], c);
    quad([[C[0], 0, C[1]], [D[0], 0, D[1]], [D[0], h, D[1]], [C[0], h, C[1]]], [-n[0], 0, -n[1]], c);
    quad([[A[0], h, A[1]], [Bq[0], h, Bq[1]], [C[0], h, C[1]], [D[0], h, D[1]]], [0, 1, 0], c);
  };
  /** A ring of runs round the middle at radius r, `n` of them (a bearing's span each). */
  const ring = (r, n, t, h, c, skip = (/** @type {number} */ _b) => false) => {
    for (let i = 0; i < n; i++) {
      const b0 = (i * 360) / n, b1 = ((i + 1) * 360) / n;
      if (!skip((b0 + b1) / 2)) run(polar(b0, r), polar(b1, r), t, h, c);
    }
  };
  /** An n-sided prism about (x, z) from (r0, y0) to (r1, y1): its sides (and its top where `cap`). */
  const prism = (x, z, n, r0, y0, r1, y1, c, cap = true) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i * 2 * Math.PI) / n, a1 = ((i + 1) * 2 * Math.PI) / n, am = (a0 + a1) / 2;
      const p = (a, r, y) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      quad([p(a0, r0, y0), p(a1, r0, y0), p(a1, r1, y1), p(a0, r1, y1)], [Math.cos(am), (r0 - r1) / Math.max(1, y1 - y0), Math.sin(am)], c, { at: [x, z] });
    }
    if (cap && r1 > 0) for (let i = 0; i < n; i += 2) {
      const a = (k) => [x + Math.cos((k * 2 * Math.PI) / n) * r1, y1, z + Math.sin((k * 2 * Math.PI) / n) * r1];
      quad([[x, y1, z], a(i), a(i + 1), a(i + 2)], [0, 1, 0], c, { at: [x, z] });
    }
  };
  const I = IMPERIAL, g = imperialGeo(), C = IMPOSTOR_COLOURS, W = I.waterfront, [tx, tz] = g.temple, P = I.temple;
  if (rows) return cellQuads(out, rows, box, { I, g, C, W, tx, tz, P });
  // the lake round the isle (the ground's, first), the docks' reach where the Waterfront stands out into it
  for (let i = 0; i < 120; i++) {
    const b0 = i * 3, b1 = b0 + 3, inner = (b) => (b >= W.b0 && b <= W.b1 ? W.r1 : I.isle);
    const p = (b, r) => { const [x, z] = polar(b, r); return [x, 0.2, z]; };
    quad([p(b0, inner(b0 + 1.5)), p(b1, inner(b0 + 1.5)), p(b1, I.lake), p(b0, I.lake)], [0, 1, 0], C.lake, { sea: 1, ground: 1, at: polar(b0 + 1.5, (I.isle + I.lake) / 2) });
  }
  // the tower: its foundation, its fins' mass, its shaft, its gallery, its crown and its gilt spire
  const T = I.tower;
  prism(0, 0, 8, T.plinthR, 0, T.plinthR, T.plinthH, C.marble);
  prism(0, 0, 8, T.finR * 0.7, T.plinthH, T.shaftR0, T.finTop, C.marble, false);
  prism(0, 0, 8, T.shaftR0, T.finTop, T.shaftR1, T.shaftTop, C.marble, false);
  prism(0, 0, 8, T.galleryR, T.shaftTop, T.galleryR, T.galleryTop, C.gold);
  prism(0, 0, 8, T.crownR0, T.galleryTop, T.crownR1, T.crownTop, C.marble, false);
  prism(0, 0, 8, T.crownR1, T.crownTop, 0, T.spireTop, C.gold, false);
  // the walls: the palace's and the city's rings (their gates open), the district walls' runs, the watch towers
  const gateAt = (gates, w, r) => (b) => gates.some((q) => Math.abs(((b - q + 540) % 360) - 180) < ((w / r) * 180) / Math.PI);
  ring(I.palaceWall.r, 96, I.palaceWall.thick, I.palaceWall.h, C.stone, gateAt(IMPERIAL_SECTORS.map(([, b]) => b + 30), I.palaceWall.gate * 4, I.palaceWall.r));
  ring(I.cityWall.r, 240, I.cityWall.thick, I.cityWall.h, C.stone, gateAt(I.cityWall.gates, I.cityWall.gate * 4, I.cityWall.r));
  for (let i = 0; i < 360; i += I.cityWall.towerEvery * 6) { const [x, z] = polar(i, I.cityWall.r); box(x - I.cityWall.towerR, z - I.cityWall.towerR, x + I.cityWall.towerR, z + I.cityWall.towerR, 0, I.cityWall.towerH, C.stone, C.roof); }
  for (const [a, b] of g.walls) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 200);
    for (let k = 0; k < n; k++) run([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n], I.districtWall.thick, I.districtWall.h, C.stone);
    box(b[0] - I.cityWall.watchR, b[1] - I.cityWall.watchR, b[0] + I.cityWall.watchR, b[1] + I.cityWall.watchR, 0, I.cityWall.watchH, C.stone, C.roof);
  }
  // the landmarks: the Temple of the One, Talos's statue, the Prison and its Bastion, the University, its spire and its
  // hall, the arena (Daggerfall's, in its cell), the Talos Bridge's deck over the lake
  box(tx - P.w / 2, tz - P.l / 2, tx + P.w / 2, tz + P.l / 2, 0, P.h + 8, C.marble, C.blueSlate);
  prism(tx, tz, 8, P.domeR, P.h + 8, P.domeR * 0.4, P.h + 8 + P.domeR, C.gold);
  box(g.statue[0] - 6, g.statue[1] - 6, g.statue[0] + 6, g.statue[1] + 6, 0, 52, C.gold);
  for (const [[cx, cz], half, h] of [[g.prison, I.prison.half, I.prison.h], [g.uni, I.university.half, I.university.h]]) {
    const q = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]];
    for (let e = 0; e < 4; e++) run(q[e], q[(e + 1) & 3], 10, h, C.stone);
  }
  prism(g.prison[0], g.prison[1], 8, I.prison.bastionR, 0, I.prison.bastionR * 0.85, I.prison.bastionH, C.dark);
  prism(g.uniTower[0], g.uniTower[1], 8, I.university.spireR, 0, I.university.spireR * 0.6, I.university.spireH, C.marble);
  box(g.uniHall[0] - I.university.hall / 2, g.uniHall[1] - I.university.hall / 2, g.uniHall[0] + I.university.hall / 2, g.uniHall[1] + I.university.hall / 2, 0, 34, C.marble, C.blueSlate);
  prism(g.arena[0], g.arena[1], 12, 46, 0, 46, 24, C.facadeOchre, false);
  const [ba, bb] = bridgeLine(I), bn = Math.ceil(Math.hypot(bb[0] - ba[0], bb[1] - ba[1]) / 150);
  for (let k = 0; k < bn; k++) run([ba[0] + ((bb[0] - ba[0]) * k) / bn, ba[1] + ((bb[1] - ba[1]) * k) / bn], [ba[0] + ((bb[0] - ba[0]) * (k + 1)) / bn, ba[1] + ((bb[1] - ba[1]) * (k + 1)) / bn], I.bridge.w, I.bridge.deck, C.stone);
  return out;
}
/** The streets' masses of cell rows [r0, r1) onto `out` (impostorQuads' `box`). */
function cellQuads(out, [r0, r1], box, { I, g, C, W, tx, tz, P }) {
  // the streets' buildings: a mass a cell of its neighbourhood's height and colours, off the landmarks, the roads and the
  // lake (the Arboretum's park a tree clump where one stands; the Palace District's lawns none)
  const clear = (x, z) => {
    const rr = Math.hypot(x, z);
    if (rr < I.palaceWall.r + 40 || Math.abs(rr - I.cityWall.r) < 60 || !imperialLand(x, z)) return false;
    if (imperialDistrictAt(x, z) === PALACE || imperialRoadAt(x, z, 6)) return false;
    if (Math.abs(x - tx) < P.w / 2 + 50 && Math.abs(z - tz) < P.l / 2 + 50) return false;
    for (const [p, d] of [[g.statue, I.statue.plaza + 40], [g.divines, I.divines.court + 40], [g.pool, I.pool.r0 + 40], [g.market, I.market.half * 1.5], [g.arena, 120], [g.uniTower, 80]]) if (Math.hypot(x - p[0], z - p[1]) < d) return false;
    for (const [p, half] of [[g.prison, I.prison.half], [g.uni, I.university.half]]) if (Math.max(Math.abs(x - p[0]), Math.abs(z - p[1])) < half + 40) return false;
    return !g.walls.some(([a, b]) => { const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2))); return Math.hypot(x - a[0] - t * (b[0] - a[0]), z - a[1] - t * (b[1] - a[1])) < 50; });
  };
  for (let r = r0; r < r1; r++) {
    for (let c = 0; c < IMPERIAL_CELLS; c++) {
      const x = (c - HALF + 0.5) * B, z = (r - HALF + 0.5) * B;
      if (Math.hypot(x, z) > W.r1 + B || !clear(x, z)) continue;
      const h = hoodAt(x, z);
      if (!h) continue;
      const j = (k) => (u01(r, c, k) - 0.5) * 10, x0 = x - B / 2 + IMPOSTOR_INSET + j(1), z0 = z - B / 2 + IMPOSTOR_INSET + j(2), x1 = x + B / 2 - IMPOSTOR_INSET + j(3), z1 = z + B / 2 - IMPOSTOR_INSET + j(4);
      if (h.kind === 'park') { if (u01(r, c, 5) < 0.55) box(x0 + 8, z0 + 8, x1 - 8, z1 - 8, 0, 12 + u01(r, c, 6) * 6, C.leaves); continue; }
      const storeys = h.k[0] + u01(r, c, 7) * (h.k[1] - h.k[0]), top = storeys * STOREY + (u01(r, c, 8) < h.gable ? 2.4 : 0.9);
      box(x0, z0, x1, z1, 0, top, C[h.style.walls[0]] ?? C.stone, C[h.style.roof] ?? C.roof);
    }
  }
  return out;
}
/** How many cell rows a step of the impostor's making lays (a few milliseconds' worth). */
export const IMPOSTOR_ROWS_A_STEP = 4;
/**
 * THE IMPOSTOR, MADE A STEP AT A TIME (the landmarks first, then IMPOSTOR_ROWS_A_STEP cell rows a step - the ring's pass
 * steps it a frame, so its making is never one long frame): `step()` true once it is whole; then `mesh()` - its vertices,
 * four a quad, in the ring's frame about the anchor (the city's middle on its ground; +z north): positions, normals,
 * colours (bytes) and the sea's flag (255 on the lake) - and `order(ex, ey, ez, built)`: the ground's quads first, then
 * every quad whose face turns to the eye (the city's metres, x east, z south, y up), farthest first in bands of
 * IMPOSTOR_BAND metres (the pass writes no depth - the nearer paints over), a pair of triangles each; a quad of a slice
 * `built(s)` says the stream stands left out.
 */
export const IMPOSTOR_BAND = 8;
export function createImperialImpostor() {
  const quads = [];
  let row = -1, made = null;
  const step = () => {
    if (made) return true;
    if (row < 0) { impostorQuads(quads, null); row = 0; return false; }
    impostorQuads(quads, [row, Math.min(IMPERIAL_CELLS, row + IMPOSTOR_ROWS_A_STEP)]);
    row += IMPOSTOR_ROWS_A_STEP;
    if (row < IMPERIAL_CELLS) return false;
    const n = quads.length, mid = new Float32Array(n * 3), nrm = new Float32Array(n * 3), slice = new Int16Array(n), ground = new Uint8Array(n);
    quads.forEach((p, i) => { mid.set(p.mid, i * 3); nrm.set(p.n, i * 3); slice[i] = p.s; ground[i] = p.ground; });
    made = { quads: n, mid, nrm, slice, ground, mesh: meshOf(quads) };
    quads.length = 0;
    return true;
  };
  const order = (ex, ey, ez, built) => {
    if (!made) return new Uint32Array(0);
    const { quads: n, mid, nrm, slice, ground } = made, keep = new Uint8Array(IMPERIAL_SPAN * IMPERIAL_SPAN);
    for (let s = 0; s < keep.length; s++) keep[s] = built(s) ? 0 : 1;
    const bands = Math.ceil((2 * IMPERIAL.lake * Math.SQRT2) / IMPOSTOR_BAND) + 1, count = new Uint32Array(bands + 1), band = new Int32Array(n);
    let grounds = 0;
    for (let i = 0; i < n; i++) {
      band[i] = -1;
      if (slice[i] >= 0 && !keep[slice[i]]) continue;
      if (ground[i]) { band[i] = bands; grounds++; continue; }
      const dx = mid[i * 3] - ex, dy = mid[i * 3 + 1] - ey, dz = mid[i * 3 + 2] - ez;
      if (nrm[i * 3 + 1] < 0.9 && dx * nrm[i * 3] + dy * nrm[i * 3 + 1] + dz * nrm[i * 3 + 2] >= 0) continue;   // a side turned away (a roof always kept: the eye may stand above it)
      band[i] = Math.max(0, bands - 1 - Math.min(bands - 1, Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz) / IMPOSTOR_BAND)));   // farthest the lowest
      count[band[i]]++;
    }
    // the ground first, then the bands far to near (a counting sort - the order's cost a pass over the quads)
    const start = new Uint32Array(bands + 1);
    let total = grounds;
    for (let b = 0; b < bands; b++) { start[b] = total; total += count[b]; }
    const out = new Uint32Array(total * 6);
    let g = 0;
    for (let i = 0; i < n; i++) {
      const b = band[i];
      if (b < 0) continue;
      const o = (b === bands ? g++ : start[b]++) * 6, v = i * 4;
      out[o] = v; out[o + 1] = v + 1; out[o + 2] = v + 2; out[o + 3] = v; out[o + 4] = v + 2; out[o + 5] = v + 3;
    }
    return out;
  };
  return { step, order, mesh: () => made?.mesh ?? null, get ready() { return !!made; } };
}
/** The quads' vertices, four a quad (createImperialImpostor's mesh). */
function meshOf(q) {
  const n = q.length;
  const positions = new Float32Array(n * 12), normals = new Float32Array(n * 12), colors = new Uint8Array(n * 12), sea = new Uint8Array(n * 4);
  q.forEach((p, i) => {
    const l = Math.hypot(p.n[0], p.n[1], p.n[2]) || 1;
    for (let k = 0; k < 4; k++) {
      const o = (i * 4 + k) * 3;
      positions[o] = p.v[k][0]; positions[o + 1] = p.v[k][1]; positions[o + 2] = -p.v[k][2];
      normals[o] = p.n[0] / l; normals[o + 1] = p.n[1] / l; normals[o + 2] = -p.n[2] / l;
      colors[o] = p.c[0]; colors[o + 1] = p.c[1]; colors[o + 2] = p.c[2];
      sea[i * 4 + k] = p.sea ? 255 : 0;
    }
  });
  return { positions, normals, colors, sea, quads: n };
}
/**
 * THE CITY'S RING IMPOSTOR (render/ringImpostors.js): `anchor()` the city's centre pixel (null while the capitals do not
 * stand), its reach the span's half, its making and its order createImperialImpostor's - the eye's offset and the built
 * pixels read in the slices' own terms (a slice s at the anchor's pixel plus its column and row less the half).
 * @param {() => ({ px: number, py: number } | null)} anchor
 */
export function imperialRingImpostor(anchor) {
  const imp = createImperialImpostor(), R = (IMPERIAL_SPAN - 1) / 2;
  return Object.freeze({
    anchor, reach: R,
    step: () => imp.step(),
    mesh: () => imp.mesh(),
    order: (dx, dy, dz, builtAt) => {
      const at = anchor();
      return at ? imp.order(dx, dy, -dz, (s) => builtAt(at.px + (s % IMPERIAL_SPAN) - R, at.py + Math.floor(s / IMPERIAL_SPAN) - R)) : new Uint32Array(0);
    },
  });
}
