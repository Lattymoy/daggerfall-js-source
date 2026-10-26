// @ts-check
// IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY'S FABRIC, BUILT: the meshes of its streets'
// buildings (world/imperialFabric.js lays them out) - near, a cell's every building whole with its ledges, balconies,
// parapets, pavements, the ways up and the bridges between its roofs, its yards' walls, the park's statues and the
// sewers' covers in its streets (world/imperialSewers.js); far, a slice's blocks as masses (its skyline). In the city's
// metres turned into the world's frame (+z north, the block rows' - world/capitalModels.js northward's law), every model's
// origin the city's middle on its ground, as the landmarks' are. The port's own shapes and pictures (CAPITAL_ARCHIVE) - no
// game data.
//
// THE PICTURES' LAW, the fabric's own (not world/capitalModels.js vanillaTexels' box projection): a wall's picture runs a
// bay (BAY, 64 texels - vanilla's 40 a metre) along it and a storey (128) down from its eave, so a window sits where a
// window is; its ground floor the street's shopfront or arcade picture, a storey high; a roof's slates run along its ridge, 1.6 m
// a picture (64 texels: vanilla's density); a flat roof's, a pavement's and a stone's pictures in the world's metres, so
// they run on across their neighbours.
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, robedFigure } from './capitalShapes.js';
import { fabricCell, fabricMasses, outwardOf, STOREY, BAY, LEDGE_Y, PARAPET, STACK_STEP, STACK_DEPTH, STACK_RUN, YARD_WALL, SHED, WELL, SQUARE_FOUNTAIN, PAVEMENT, STATUE, streetKind } from './imperialFabric.js';
import { sewerCoversIn, sewerBranchesIn, IMPERIAL_SEWERS } from './imperialSewers.js';
import { BLOCK_M } from './spawnedDungeons.js';
import { IMPERIAL_CELLS, imperialSliceRect, imperialClassic, imperialSlicePlan, imperialCellRect, IMPERIAL_SPAN, imperialDistrictAt } from './imperialCity.js';

const HALF = IMPERIAL_CELLS / 2;
/** A picture by its name in CAPITAL_ART. */
const T = (name) => art(CAPITAL_ART[name] ?? CAPITAL_ART.wallStone);
/** The city's map frame (x east, z south) to the world's (+z north). */
const W = (x, y, z) => [x, y, -z];
const WN = (nx, ny, nz) => [nx, ny, -nz];
const PIC = 1.6;   // a 64-texel picture's metres (vanilla's density)

/** A wall face from a to b (map frame points) between heights y0 and y1, facing n (map frame), its picture a bay along and
 *  a storey down from `vTop` (the height its picture's top row sits at). */
function wallFace(mb, tex, a, b, y0, y1, n, vTop = y1, bay = BAY) {
  if (y1 - y0 < 1e-3) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = len / bay;
  const v0 = (vTop - y0) / STOREY, v1 = (vTop - y1) / STOREY;
  mb.quad(tex, W(a[0], y0, a[1]), W(b[0], y0, b[1]), W(b[0], y1, b[1]), W(a[0], y1, a[1]), WN(n[0], 0, n[1]), [[0, v0], [u, v0], [u, v1], [0, v1]]);
}
/** A horizontal quad (map frame corners) at height y facing up (or down), its picture in the world's metres. */
function flat(mb, tex, q, y, up = 1) {
  const uv = q.map((p) => [p[0] / PIC, p[1] / PIC]);
  mb.quad(tex, W(q[0][0], y, q[0][1]), W(q[1][0], y, q[1][1]), W(q[2][0], y, q[2][1]), W(q[3][0], y, q[3][1]), [0, up, 0], uv);
}
/** A box along a segment a-b (map frame) - `out` its depth out along n from the line, from y0 to y1: its top, its outer
 *  face, its two ends and its bottom (the face against a wall left out). */
function slab(mb, tex, a, b, n, out, y0, y1, { bottom = true, back = false } = {}) {
  const A = a, Bp = b, C = [b[0] + n[0] * out, b[1] + n[1] * out], D = [a[0] + n[0] * out, a[1] + n[1] * out];
  flat(mb, tex, [A, Bp, C, D], y1, 1);
  if (bottom && y0 > 0.05) flat(mb, tex, [A, Bp, C, D], y0, -1);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0];
  wallFace(mb, tex, D, C, y0, y1, n, y1, PIC * 2);
  wallFace(mb, tex, A, D, y0, y1, [-t[0], -t[1]], y1, PIC * 2);
  wallFace(mb, tex, C, Bp, y0, y1, t, y1, PIC * 2);
  if (back) wallFace(mb, tex, Bp, A, y0, y1, [-n[0], -n[1]], y1, PIC * 2);
}
/** A free-standing wall along a-b, `t` thick, from y0 to y1 - both faces, its top and its ends. */
function freeWall(mb, tex, a, b, thick, y0, y1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-3) return;
  const n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len], h = thick / 2;
  slab(mb, tex, [a[0] - n[0] * h, a[1] - n[1] * h], [b[0] - n[0] * h, b[1] - n[1] * h], n, thick, y0, y1, { bottom: false, back: true });
}
/** An axis-free box: a square of side `s` about (x, z) from y0 to y1 (its top and four sides). */
function post(mb, tex, x, z, s, y0, y1) {
  const h = s / 2, q = [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]];
  flat(mb, tex, q, y1, 1);
  for (let e = 0; e < 4; e++) wallFace(mb, tex, q[e], q[(e + 1) & 3], y0, y1, outwardOf(q, e), y1, PIC * 2);
}

/**
 * ONE BUILDING: its walls - each street front its ground floor's picture a storey high and its upper floors' over it to
 * its eave, every other face its wall's picture; its roof - flat, under its parapet on its street fronts (PARAPET, a
 * vault's), or pitched on its ridge, two slopes and two gables; a ledge along a street front at LEDGE_Y; a balcony or two
 * on a front over the ledge; and a pavement along a main street's front (PAVEMENT, a step).
 */
export function buildPlot(mb, p) {
  const wallT = T(p.wall), groundT = T(p.ground), stone = T('wallStone'), paving = T('bridgeStone'), timber = T('timber');
  for (let e = 0; e < 4; e++) {
    const a = p.q[e], b = p.q[(e + 1) & 3], n = outwardOf(p.q, e), front = !!(p.out & (1 << e));
    if (front && p.h > STOREY + 0.5) {
      wallFace(mb, groundT, a, b, -0.5, STOREY, n, STOREY);
      wallFace(mb, wallT, a, b, STOREY, p.h, n, p.h);
    } else wallFace(mb, wallT, a, b, -0.5, p.h, n, p.h);
    if (!front) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (p.ledge && len > 2 && p.h > LEDGE_Y + 2) slab(mb, stone, a, b, n, 0.42, LEDGE_Y - 0.3, LEDGE_Y);
    if (p.balcony && len > 4 && p.h > STOREY * 2 + 1) {
      for (let k = 0; k < p.balcony; k++) {
        const t0 = (k + 0.5) / (p.balcony + 0.5) - 0.18, t1 = t0 + 0.36, y = STOREY * 2 - 0.2;
        const A = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], Bp = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        slab(mb, timber, A, Bp, n, 1.1, y - 0.25, y);
        const C = [Bp[0] + n[0] * 1.05, Bp[1] + n[1] * 1.05], D = [A[0] + n[0] * 1.05, A[1] + n[1] * 1.05];
        freeWall(mb, timber, D, C, 0.08, y, y + 0.95);
      }
    }
    if (streetKind(p.sw?.[e] ?? 0) === 'main' && len > 1) slab(mb, paving, a, b, n, PAVEMENT.w, 0, PAVEMENT.h, { bottom: false });
  }
  // the roof
  const roofT = T(p.roofTex);
  if (p.roof === 'flat') {
    flat(mb, paving, p.q, p.h, 1);
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e))) continue;
      const a = p.q[e], b = p.q[(e + 1) & 3], n = outwardOf(p.q, e);
      slab(mb, stone, [a[0] - n[0] * 0.4, a[1] - n[1] * 0.4], [b[0] - n[0] * 0.4, b[1] - n[1] * 0.4], n, 0.4, p.h, p.h + PARAPET, { bottom: false, back: true });
    }
    return;
  }
  // pitched: the ridge along edge 0 ('gableS') or edge 1 ('gableT')
  const q = p.q, mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  const [s0, s1, g0, g1] = p.roof === 'gableS' ? [[q[0], q[1]], [q[2], q[3]], [q[3], q[0]], [q[1], q[2]]] : [[q[1], q[2]], [q[3], q[0]], [q[0], q[1]], [q[2], q[3]]];
  const R0 = mid(g0[0], g0[1]), R1 = mid(g1[0], g1[1]);
  for (const [a, b] of [s0, s1]) {
    // a slope from its eave a-b up to the ridge (the ridge's end over b first: R1 lies beside b for s0, R0 beside b for s1)
    const [rb, ra] = Math.hypot(R1[0] - b[0], R1[1] - b[1]) < Math.hypot(R0[0] - b[0], R0[1] - b[1]) ? [R1, R0] : [R0, R1];
    const along = Math.hypot(b[0] - a[0], b[1] - a[1]), up = Math.hypot(Math.hypot(rb[0] - b[0], rb[1] - b[1]), p.ridge - p.h);
    const n = outwardOf(q, q.indexOf(a));
    const slope = [n[0] * (p.ridge - p.h), Math.hypot(rb[0] - b[0], rb[1] - b[1]), n[1] * (p.ridge - p.h)], sl = Math.hypot(...slope);
    mb.quad(roofT, W(a[0], p.h, a[1]), W(b[0], p.h, b[1]), W(rb[0], p.ridge, rb[1]), W(ra[0], p.ridge, ra[1]), WN(slope[0] / sl, slope[1] / sl, slope[2] / sl), [[0, up / PIC], [along / PIC, up / PIC], [along / PIC, 0], [0, 0]]);
  }
  for (const [a, b] of [g0, g1]) {
    const R = mid(a, b), n = outwardOf(q, q.indexOf(a));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rv = (p.ridge - p.h) / STOREY;
    mb.tri(wallT, W(a[0], p.h, a[1]), W(b[0], p.h, b[1]), W(R[0], p.ridge, R[1]), WN(n[0], 0, n[1]), [0, rv], [len / BAY, rv], [len / BAY / 2, 0]);
  }
}

/** A WAY UP: a stair of crates and sheds along a street front, each STACK_STEP over the last, STACK_RUN along it and
 *  STACK_DEPTH out - its last top within a vault of the roof's edge (world/imperialFabric.js waysOf: `top`). */
function buildStack(mb, s) {
  const tex = T('timber');
  for (let k = 0; k < s.steps; k++) {
    const a = [s.at[0] + s.t[0] * k * STACK_RUN, s.at[1] + s.t[1] * k * STACK_RUN], b = [a[0] + s.t[0] * STACK_RUN, a[1] + s.t[1] * STACK_RUN];
    slab(mb, tex, a, b, s.n, STACK_DEPTH, 0, (k + 1) * STACK_STEP, { bottom: false });
  }
}
/** A BRIDGE between two roofs across a street: a plank deck from the near front `len` out along n, its two rails. */
function buildBridge(mb, br) {
  const tex = T('timber'), hw = br.width / 2, t = [-br.n[1], br.n[0]];
  const a = [br.from[0] + t[0] * hw, br.from[1] + t[1] * hw], b = [br.from[0] - t[0] * hw, br.from[1] - t[1] * hw];
  // the deck runs out from the near wall to the far one: a slab from the edge a-b along n
  slab(mb, tex, b, a, br.n, br.len, br.y - 0.3, br.y + 0.05);
  for (const side of [a, b]) freeWall(mb, tex, side, [side[0] + br.n[0] * br.len, side[1] + br.n[1] * br.len], 0.1, br.y + 0.05, br.y + 1.0);
}
/** A STATUE of the Arboretum on its plinth, facing the way its seed says. */
function buildStatue(mb, at, seed) {
  const marble = T('marble');
  post(mb, marble, at[0], at[1], STATUE.plinth, -0.3, STATUE.plinthH);
  const a = ((seed % 8) / 8) * Math.PI * 2, face = [Math.cos(a), Math.sin(a)];
  // the figure, built as a map reads and turned to the world's frame by hand: robedFigure's points are (x, y, z) map frame
  const fig = new MeshBuilder();
  robedFigure(fig, marble, at[0], at[1], STATUE.plinthH, STATUE.figure, face, seed % 4);
  for (const g of fig.groups.values()) for (let i = 0; i < g.indices.length; i += 3) {
    const P = (k) => { const v = g.indices[i + k] * 3; return [g.positions[v], g.positions[v + 1], -g.positions[v + 2]]; };
    const N = [g.normals[g.indices[i] * 3], g.normals[g.indices[i] * 3 + 1], -g.normals[g.indices[i] * 3 + 2]];
    mb.tri(marble, P(0), P(1), P(2), N);
  }
}
/** IC-GRAND: A YARD'S WELL - its round kerb of stone (eight sides), two timber posts and a little pitched roof over it. */
function buildWell(mb, at) {
  const [x, z] = at, stone = T('wallStone'), timber = T('timber'), roof = T('roof'), n = 8, r = WELL.r;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    wallFace(mb, stone, p0, p1, -0.2, WELL.h, [Math.cos(am), Math.sin(am)], WELL.h, PIC * 2);
    mb.tri(stone, W(x, WELL.h, z), W(p0[0], WELL.h, p0[1]), W(p1[0], WELL.h, p1[1]), [0, 1, 0]);
  }
  for (const side of [1, -1]) post(mb, timber, x + side * (r + 0.1), z, 0.18, 0, WELL.roofH);
  const e = r + 0.5, y0 = WELL.roofH, y1 = WELL.roofH + 0.7;
  for (const side of [1, -1]) {
    const a = [x - e, z + side * 0.9], b = [x + e, z + side * 0.9];
    mb.quad(roof, W(a[0], y0, a[1]), W(b[0], y0, b[1]), W(b[0], y1, z), W(a[0], y1, z), WN(0, 0.79, side * 0.62));
  }
}
/** IC-GRAND: A SQUARE'S FOUNTAIN - an octagonal basin's kerb, its water, a column with a bowl on it. */
function buildSquareFountain(mb, at) {
  const [x, z] = at, stone = T('wallStone'), marble = T('marble'), n = 8, r = SQUARE_FOUNTAIN.r, k = 0.7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2, c = Math.cos(am), s = Math.sin(am);
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const q0 = [x + Math.cos(a0) * (r - 0.4), z + Math.sin(a0) * (r - 0.4)], q1 = [x + Math.cos(a1) * (r - 0.4), z + Math.sin(a1) * (r - 0.4)];
    wallFace(mb, stone, p0, p1, -0.2, k, [c, s], k, PIC * 2);
    wallFace(mb, stone, q1, q0, 0.1, k, [-c, -s], k, PIC * 2);
    mb.quad(stone, W(p0[0], k, p0[1]), W(p1[0], k, p1[1]), W(q1[0], k, q1[1]), W(q0[0], k, q0[1]), [0, 1, 0]);
    mb.tri(T('water'), W(x, 0.45, z), W(q0[0], 0.45, q0[1]), W(q1[0], 0.45, q1[1]), [0, 1, 0]);
  }
  post(mb, marble, x, z, 0.6, 0, SQUARE_FOUNTAIN.h);
  post(mb, marble, x, z, 1.8, SQUARE_FOUNTAIN.h - 0.4, SQUARE_FOUNTAIN.h);
}
/** A SEWER'S COVER in the street: a manhole's iron disc, or a grate at the kerb, a hair proud of the ground. */
function buildCover(mb, cv) {
  const tex = T('dark'), r = cv.kind === 'manhole' ? IMPERIAL_SEWERS.coverR : 0.45, n = cv.kind === 'manhole' ? 8 : 4, y = 0.03;
  const [x, z] = cv.at;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / n, a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / n;
    mb.tri(tex, W(x, y, z), W(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r), W(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r), [0, 1, 0], [0.5, 0.5], [0.5 + Math.cos(a0) / 2, 0.5 + Math.sin(a0) / 2], [0.5 + Math.cos(a1) / 2, 0.5 + Math.sin(a1) / 2]);
  }
}

/**
 * A CELL'S MODEL (row r, column c of the plan): every building whose middle stands in it whole, its ways up, its bridges,
 * its yards' walls and sheds, its dead ends' walls, the park's statues there, and the sewers' covers in its streets (the
 * mains' under its roads and the branches' under its own) - null where it holds none of them. The world's frame, the
 * city's middle its origin.
 */
export function fabricCellModel(r, c) {
  const L = fabricCell(r, c), mb = new MeshBuilder();
  for (const p of L.plots) buildPlot(mb, p);
  for (const s of L.stacks) buildStack(mb, s);
  for (const br of L.bridges) buildBridge(mb, br);
  const stone = T('wallStone'), timber = T('timber');
  for (const y of L.yards) freeWall(mb, stone, y.a, y.b, YARD_WALL.t, -0.3, YARD_WALL.h);
  for (const d of L.deadEnds) freeWall(mb, stone, d.a, d.b, 0.6, -0.3, 2.4);
  for (const s of L.sheds) { post(mb, timber, s[0], s[1], SHED.w, -0.3, SHED.h); }
  for (const w of L.wells) buildWell(mb, w);   // IC-GRAND: the yards' wells and the squares' fountains
  for (const f of L.fountains) buildSquareFountain(mb, f);
  L.statues.forEach((s, i) => buildStatue(mb, s, (r * 977 + c * 131 + i) >>> 0));
  const [x0, z0, x1, z1] = imperialCellRect(r, c);
  for (const cv of sewerCoversIn(x0, z0, x1, z1)) buildCover(mb, cv);
  if (L.plots.length) for (const cv of sewerBranchesIn(r, c).covers) buildCover(mb, cv);
  if (!mb.groups.size) return null;
  return mb.build();
}

/** Does a cell have a model of its own (fabricCellModel's not null) - its layout's pieces or the sewers' covers in it,
 *  asked without building it. */
export function fabricCellHasModel(r, c) {
  const L = fabricCell(r, c);
  if (L.plots.length || L.stacks.length || L.bridges.length || L.yards.length || L.deadEnds.length || L.sheds.length || L.statues.length || L.wells.length || L.fountains.length) return true;
  const [x0, z0, x1, z1] = imperialCellRect(r, c);
  return sewerCoversIn(x0, z0, x1, z1).length > 0;
}
/** A far mass's walls and roof (a block's run, world/imperialFabric.js fabricMasses): its four walls to its height, its top
 *  flat or ridged along its longer side. */
function buildMass(mb, m) {
  const wallT = T(m.wall), roofT = T(m.roofTex);
  for (let e = 0; e < 4; e++) wallFace(mb, wallT, m.q[e], m.q[(e + 1) & 3], -0.5, m.h, outwardOf(m.q, e), m.h);
  if (!m.gable) { flat(mb, T('bridgeStone'), m.q, m.h, 1); return; }
  const q = m.q, l0 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), l1 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2], rise = Math.min(l0, l1) * 0.3;
  const [a, b, c, d] = l0 >= l1 ? q : [q[1], q[2], q[3], q[0]];
  const R0 = mid(d, a), R1 = mid(b, c), up = m.h + rise;
  for (const [p0, p1, r0, r1, e] of [[a, b, R0, R1, 0], [c, d, R1, R0, 2]]) {
    const n = outwardOf([a, b, c, d], e), ny = Math.hypot(r0[0] - p0[0], r0[1] - p0[1]), sl = Math.hypot(ny, rise);
    mb.quad(roofT, W(p0[0], m.h, p0[1]), W(p1[0], m.h, p1[1]), W(r1[0], up, r1[1]), W(r0[0], up, r0[1]), WN((n[0] * rise) / sl, ny / sl, (n[1] * rise) / sl));
  }
  for (const [p0, p1, R, e] of [[b, c, R1, 1], [d, a, R0, 3]]) {
    const n = outwardOf([a, b, c, d], e);
    mb.tri(wallT, W(p0[0], m.h, p0[1]), W(p1[0], m.h, p1[1]), W(R[0], up, R[1]), WN(n[0], 0, n[1]));
  }
}
/** A Daggerfall block's mass far off: a ring of houses round the cell's edge, a street in from it (its blocks' own houses
 *  stand on their edges' streets). */
function classicMass(r, c) {
  const [x0, z0, x1, z1] = imperialCellRect(r, c), i = 8, d = 18;
  const q = (ax, az, bx, bz) => [[ax, az], [bx, az], [bx, bz], [ax, bz]];
  return [q(x0 + i, z0 + i, x1 - i, z0 + i + d), q(x1 - i - d, z0 + i + d, x1 - i, z1 - i - d), q(x0 + i, z1 - i - d, x1 - i, z1 - i), q(x0 + i, z0 + i + d, x0 + i + d, z1 - i - d)]
    .map((qq, k) => ({ q: qq, h: 7 + ((r * 7 + c * 3 + k) % 3) * 1.6, gable: true, wall: 'facadeTimber', roofTex: 'roof' }));
}
/**
 * A SLICE'S SKYLINE (s, sy * IMPERIAL_SPAN + sx): its fabric's blocks as masses and Daggerfall's blocks' rings - the far
 * view's buildings (world/imperialBlocks.js), no collider (nothing walks there before its slice is built near). The
 * world's frame, the city's middle its origin. Null for a slice with none.
 */
export function skylineModel(s) {
  const mb = new MeshBuilder();
  for (const m of fabricMasses(imperialSliceRect(s))) buildMass(mb, m);
  const plan = imperialSlicePlan(s), sx = s % IMPERIAL_SPAN, sy = Math.floor(s / IMPERIAL_SPAN);
  plan.forEach((row, i) => row.forEach((cell, j) => { if (imperialClassic(cell)) for (const m of classicMass(sy * 8 + i, sx * 8 + j)) buildMass(mb, m); }));
  if (!mb.groups.size) return null;
  return mb.build();
}
/** The cell's middle, for a test's own frame. */
export const cellMiddle = (r, c) => [(c - HALF + 0.5) * BLOCK_M, (r - HALF + 0.5) * BLOCK_M];
/** The district a cell's middle stands in. */
export const cellDistrict = (r, c) => imperialDistrictAt(...cellMiddle(r, c));
