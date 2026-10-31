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
//
// BLD (the owner, 2026-10-26, walking the city: "some windows are upside down"): A PICTURE'S TOP ROW IS AT v = 0 FROM
// BELOW, ITS ROWS DOWN THE WALL AT v FALLING - Daggerfall's own models' law (world/meshReader.js: v = -(texel row /
// height)), because every picture reaches the GL bottom-up (formats/color32Order.js: row 0 of the buffer the picture's
// BOTTOM row - the stand-in door's toColor32, systems/textureReplacement.js) and the GL samples it unflipped. The fabric
// had laid v rising down the wall (a top-down raster's rows), so every wall, ground floor, gable and roof of it drew
// upside down in the game - its sills over its windows, its arcades' arches and its shopfronts' stall boards on their
// heads - while the scratch rasterizer that checked it read the raw top-down picture and showed them right (Home.md's
// Process: an orientation check samples what the GL samples).
import { MeshBuilder } from './detStandIns.js';
import { CAPITAL_ART, art, robedFigure } from './capitalShapes.js';
import {
  fabricCell,
  fabricMasses,
  outwardOf,
  inQuad,
  STOREY,
  BAY,
  LEDGE_Y,
  PARAPET,
  STAIR,
  STAIR_DEPTH,
  YARD_WALL,
  SHED,
  WELL,
  SQUARE_FOUNTAIN,
  PAVEMENT,
  STATUE,
  streetKind,
} from './imperialFabric.js';
import { FACADE_PLAIN, FACADE_TEXELS } from './imperialArt.js';
import { sewerCoversIn, sewerBranchesIn, IMPERIAL_SEWERS } from './imperialSewers.js';
import { BLOCK_M } from './spawnedDungeons.js';
import {
  IMPERIAL_CELLS,
  imperialSliceRect,
  imperialCellRect,
  IMPERIAL_SPAN,
  imperialDistrictAt,
} from './imperialCity.js';

const HALF = IMPERIAL_CELLS / 2;
/** A picture by its name in CAPITAL_ART. */
const T = (name) => art(CAPITAL_ART[name] ?? CAPITAL_ART.wallStone);
/** The city's map frame (x east, z south) to the world's (+z north). */
const W = (x, y, z) => [x, y, -z];
const WN = (nx, ny, nz) => [nx, ny, -nz];
const PIC = 1.6; // a 64-texel picture's metres (vanilla's density)

/** A wall face from a to b (map frame points) between heights y0 and y1, facing n (map frame), its picture a bay along and
 *  a storey down from `vTop` (the height its picture's top row sits at). */
function wallFace(mb, tex, a, b, y0, y1, n, vTop = y1, bay = BAY) {
  if (y1 - y0 < 1e-3) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = len / bay;
  const v0 = (y0 - vTop) / STOREY,
    v1 = (y1 - vTop) / STOREY; // BLD: the picture's top row at vTop, v falling down the wall
  mb.quad(tex, W(a[0], y0, a[1]), W(b[0], y0, b[1]), W(b[0], y1, b[1]), W(a[0], y1, a[1]), WN(n[0], 0, n[1]), [
    [0, v0],
    [u, v0],
    [u, v1],
    [0, v1],
  ]);
}
/**
 * BLD (the owner, 2026-10-26: windows that "clip into the ground and into the roofs") - A WALL OF STOREYS: its windowed
 * storeys counted down from its eave (a window under every eave, where a window is), each whole - a whole number of bays
 * along the wall (wholeBay: the bay stretched to fit, never a window cut at a corner) - and whatever is left at its foot,
 * less than a storey, a PLAIN BAND (a plinth over the street, or a mezzanine over a shopfront) laid in the picture's plain
 * rows (world/imperialArt.js FACADE_PLAIN); under the ground a plain band too. Measured on the city before (5,230
 * buildings in 147 cells): half the eaves stood an odd half storey up, so the lowest windows of half the city stood half
 * under the street.
 */
function storeys(mb, tex, a, b, y0, h, n) {
  const bay = wholeBay(a, b),
    k = Math.floor((h - y0) / STOREY + 1e-6),
    foot = h - k * STOREY;
  if (k > 0) wallFace(mb, tex, a, b, foot, h, n, h, bay);
  plainBand(mb, tex, a, b, y0, foot, n, bay);
  if (y0 > -0.5) plainBand(mb, tex, a, b, -0.5, Math.min(0, y0), n, bay);
}
/** BLD: a wall's bay - BAY stretched so the wall carries a whole number of them. */
const wholeBay = (a, b) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return len / Math.max(1, Math.round(len / BAY));
};
/** BLD: the plain rows' v: the band's top row FACADE_PLAIN.top at its top, the rows on down at the picture's own density
 *  stretched to fit a half storey (FACADE_PLAIN.rows over STOREY / 2) - the GL's law (v falling down the wall). */
const PLAIN_TOP = -FACADE_PLAIN.top / FACADE_TEXELS.h,
  PLAIN_PER_M = FACADE_PLAIN.rows / FACADE_TEXELS.h / (STOREY / 2);
/** BLD: A PLAIN BAND of a wall from y0 up to y1 - half storeys of the picture's plain rows from the top down (no window). */
function plainBand(mb, tex, a, b, y0, y1, n, bay = wholeBay(a, b)) {
  const u = Math.hypot(b[0] - a[0], b[1] - a[1]) / bay;
  for (let top = y1; top - y0 > 1e-3; top -= STOREY / 2) {
    const bot = Math.max(y0, top - STOREY / 2),
      v0 = PLAIN_TOP - (top - bot) * PLAIN_PER_M;
    mb.quad(tex, W(a[0], bot, a[1]), W(b[0], bot, b[1]), W(b[0], top, b[1]), W(a[0], top, a[1]), WN(n[0], 0, n[1]), [
      [0, v0],
      [u, v0],
      [u, PLAIN_TOP],
      [0, PLAIN_TOP],
    ]);
  }
}
/** BLD: A GABLE - the wall's triangle over its eave a-b (height h) up to its ridge R, laid in plain bands a half storey each
 *  from the eave up (a trapezoid each, the last a triangle): the roof's slopes cut no window. */
function gable(mb, tex, a, b, h, R, ridge, n) {
  const bay = wholeBay(a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const at = (P, y) => {
    const s = (y - h) / (ridge - h);
    return [P[0] + (R[0] - P[0]) * s, P[1] + (R[1] - P[1]) * s];
  };
  const U = (P) => ((P[0] - a[0]) * t[0] + (P[1] - a[1]) * t[1]) / bay;
  for (let bot = h; ridge - bot > 1e-3; bot += STOREY / 2) {
    const top = Math.min(ridge, bot + STOREY / 2),
      v0 = PLAIN_TOP - (top - bot) * PLAIN_PER_M;
    const [p0, p1, p2, p3] = [at(a, bot), at(b, bot), at(b, top), at(a, top)];
    if (top >= ridge - 1e-6)
      mb.tri(
        tex,
        W(p0[0], bot, p0[1]),
        W(p1[0], bot, p1[1]),
        W(R[0], ridge, R[1]),
        WN(n[0], 0, n[1]),
        [U(p0), v0],
        [U(p1), v0],
        [U(R), PLAIN_TOP],
      );
    else
      mb.quad(
        tex,
        W(p0[0], bot, p0[1]),
        W(p1[0], bot, p1[1]),
        W(p2[0], top, p2[1]),
        W(p3[0], top, p3[1]),
        WN(n[0], 0, n[1]),
        [
          [U(p0), v0],
          [U(p1), v0],
          [U(p2), PLAIN_TOP],
          [U(p3), PLAIN_TOP],
        ],
      );
  }
}
/** A horizontal quad (map frame corners) at height y facing up (or down), its picture in the world's metres. */
function flat(mb, tex, q, y, up = 1) {
  const uv = q.map((p) => [p[0] / PIC, p[1] / PIC]);
  mb.quad(
    tex,
    W(q[0][0], y, q[0][1]),
    W(q[1][0], y, q[1][1]),
    W(q[2][0], y, q[2][1]),
    W(q[3][0], y, q[3][1]),
    [0, up, 0],
    uv,
  );
}
/** A box along a segment a-b (map frame) - `out` its depth out along n from the line, from y0 to y1: its top, its outer
 *  face, its two ends and its bottom (the face against a wall left out). */
function slab(mb, tex, a, b, n, out, y0, y1, { bottom = true, back = false } = {}) {
  const A = a,
    Bp = b,
    C = [b[0] + n[0] * out, b[1] + n[1] * out],
    D = [a[0] + n[0] * out, a[1] + n[1] * out];
  flat(mb, tex, [A, Bp, C, D], y1, 1);
  if (bottom && y0 > 0.05) flat(mb, tex, [A, Bp, C, D], y0, -1);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0];
  wallFace(mb, tex, D, C, y0, y1, n, y1, PIC * 2);
  wallFace(mb, tex, A, D, y0, y1, [-t[0], -t[1]], y1, PIC * 2);
  wallFace(mb, tex, C, Bp, y0, y1, t, y1, PIC * 2);
  if (back) wallFace(mb, tex, Bp, A, y0, y1, [-n[0], -n[1]], y1, PIC * 2);
}
/** A free-standing wall along a-b, `t` thick, from y0 to y1 - both faces, its top and its ends. */
function freeWall(mb, tex, a, b, thick, y0, y1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-3) return;
  const n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    h = thick / 2;
  slab(mb, tex, [a[0] - n[0] * h, a[1] - n[1] * h], [b[0] - n[0] * h, b[1] - n[1] * h], n, thick, y0, y1, {
    bottom: false,
    back: true,
  });
}
/** An axis-free box: a square of side `s` about (x, z) from y0 to y1 (its top and four sides). */
function post(mb, tex, x, z, s, y0, y1) {
  const h = s / 2,
    q = [
      [x - h, z - h],
      [x + h, z - h],
      [x + h, z + h],
      [x - h, z + h],
    ];
  flat(mb, tex, q, y1, 1);
  for (let e = 0; e < 4; e++) wallFace(mb, tex, q[e], q[(e + 1) & 3], y0, y1, outwardOf(q, e), y1, PIC * 2);
}

/**
 * ONE BUILDING: its walls - each street front its ground floor's picture a storey high and its upper floors' over it to
 * its eave, every other face its wall's picture (BLD: storeys, whole, from the eave down - a plain band at the foot;
 * a PARTY WALL, `party` bit e - an edge against a neighbour's, partyEdges - blind, plain bands its whole height: no
 * window under a neighbour's roof); its roof - flat, under its parapet on its street fronts (PARAPET, a vault's), or
 * pitched on its ridge, two slopes and two gables (BLD: plain bands, no window cut by a slope); a ledge along a street
 * front at LEDGE_Y; a balcony or two on a front over the ledge, on a floor (BALCONY_FLOORS); and a pavement along a main
 * street's front (PAVEMENT, a step). IC-STAIRS: `stairs` the ways up near it (world/imperialFabric.js nearStairs) - a
 * front a stair climbs keeps its ledge and its balconies off the stair's run, and a flat roof's parapet stands open over
 * the head landing of its own stair (stairSpans, headSpan).
 */
export function buildPlot(mb, p, party = 0, stairs = []) {
  const wallT = T(p.wall),
    groundT = T(p.ground),
    stone = T('wallStone'),
    paving = T('bridgeStone'),
    timber = T('timber');
  for (let e = 0; e < 4; e++) {
    const a = p.q[e],
      b = p.q[(e + 1) & 3],
      n = outwardOf(p.q, e),
      front = !!(p.out & (1 << e));
    if (!front && party & (1 << e)) plainBand(mb, wallT, a, b, -0.5, p.h, n);
    else if (front && p.h > STOREY + 0.5) {
      wallFace(mb, groundT, a, b, 0, STOREY, n, STOREY, wholeBay(a, b));
      plainBand(mb, wallT, a, b, -0.5, 0, n);
      storeys(mb, wallT, a, b, STOREY, p.h, n);
    } else storeys(mb, wallT, a, b, 0, p.h, n);
    if (!front) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      under = stairSpans(stairs, a, b, n, 0.1),
      on = alongOf(a, b);
    if (p.ledge && len > 2 && p.h > LEDGE_Y + 2)
      for (const [u0, u1] of openRuns(len, under, 0.5))
        slab(mb, stone, on(u0), on(u1), n, 0.42, LEDGE_Y - 0.3, LEDGE_Y);
    const y = balconyFloor(p.h);
    if (p.balcony && len > 4 && y + STOREY <= p.h + 1e-6) {
      for (let k = 0; k < p.balcony; k++) {
        const t0 = (k + 0.5) / (p.balcony + 0.5) - 0.18,
          t1 = t0 + 0.36;
        if (under.some(([u0, u1]) => t1 * len > u0 - 0.5 && t0 * len < u1 + 0.5)) continue; // IC-STAIRS: none over a stair
        const A = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
          Bp = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        slab(mb, timber, A, Bp, n, 1.1, y - 0.25, y);
        const C = [Bp[0] + n[0] * 1.05, Bp[1] + n[1] * 1.05],
          D = [A[0] + n[0] * 1.05, A[1] + n[1] * 1.05];
        freeWall(mb, timber, D, C, 0.08, y, y + 0.95);
      }
    }
    if (streetKind(p.sw?.[e] ?? 0) === 'main' && len > 1)
      slab(mb, paving, a, b, n, PAVEMENT.w, 0, PAVEMENT.h, { bottom: false });
  }
  // the roof
  const roofT = T(p.roofTex);
  if (p.roof === 'flat') {
    flat(mb, paving, p.q, p.h, 1);
    for (let e = 0; e < 4; e++) {
      if (!(p.out & (1 << e))) continue;
      const a = p.q[e],
        b = p.q[(e + 1) & 3],
        n = outwardOf(p.q, e),
        on = alongOf(a, b);
      const heads = stairs.filter((s) => s.key === p.key && s.edge === e).map((s) => headSpan(s, a, b, n)); // IC-STAIRS: its stair's head
      for (const [u0, u1] of openRuns(Math.hypot(b[0] - a[0], b[1] - a[1]), heads)) {
        const A = on(u0),
          Bp = on(u1);
        slab(
          mb,
          stone,
          [A[0] - n[0] * 0.4, A[1] - n[1] * 0.4],
          [Bp[0] - n[0] * 0.4, Bp[1] - n[1] * 0.4],
          n,
          0.4,
          p.h,
          p.h + PARAPET,
          { bottom: false, back: true },
        );
      }
    }
    return;
  }
  // pitched: the ridge along edge 0 ('gableS') or edge 1 ('gableT')
  const q = p.q,
    mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  const [s0, s1, g0, g1] =
    p.roof === 'gableS'
      ? [
          [q[0], q[1]],
          [q[2], q[3]],
          [q[3], q[0]],
          [q[1], q[2]],
        ]
      : [
          [q[1], q[2]],
          [q[3], q[0]],
          [q[0], q[1]],
          [q[2], q[3]],
        ];
  const R0 = mid(g0[0], g0[1]),
    R1 = mid(g1[0], g1[1]);
  for (const [a, b] of [s0, s1]) {
    // a slope from its eave a-b up to the ridge (the ridge's end over b first: R1 lies beside b for s0, R0 beside b for s1)
    const [rb, ra] =
      Math.hypot(R1[0] - b[0], R1[1] - b[1]) < Math.hypot(R0[0] - b[0], R0[1] - b[1]) ? [R1, R0] : [R0, R1];
    const along = Math.hypot(b[0] - a[0], b[1] - a[1]),
      up = Math.hypot(Math.hypot(rb[0] - b[0], rb[1] - b[1]), p.ridge - p.h);
    const n = outwardOf(q, q.indexOf(a));
    const slope = [n[0] * (p.ridge - p.h), Math.hypot(rb[0] - b[0], rb[1] - b[1]), n[1] * (p.ridge - p.h)],
      sl = Math.hypot(...slope);
    mb.quad(
      roofT,
      W(a[0], p.h, a[1]),
      W(b[0], p.h, b[1]),
      W(rb[0], p.ridge, rb[1]),
      W(ra[0], p.ridge, ra[1]),
      WN(slope[0] / sl, slope[1] / sl, slope[2] / sl),
      [
        [0, -up / PIC],
        [along / PIC, -up / PIC],
        [along / PIC, 0],
        [0, 0],
      ],
    ); // BLD: the slates' top row at the ridge
  }
  for (const [a, b] of [g0, g1]) gable(mb, wallT, a, b, p.h, mid(a, b), p.ridge, outwardOf(q, q.indexOf(a)));
}
/** BLD: THE FLOORS A BALCONY STANDS ON - a floor line of the wall's storeys (counted from the eave down; the heights are
 *  half storeys, world/imperialFabric.js) at a second storey's floor: 4.8 m where the eave stands an odd half storey up
 *  (over a shopfront's mezzanine), 6.4 m where it stands even - its deck never across a window. */
export const BALCONY_FLOORS = Object.freeze([STOREY * 1.5, STOREY * 2]);
const balconyFloor = (h) => BALCONY_FLOORS[Math.round(h / (STOREY / 2)) % 2 === 0 ? 1 : 0];
/**
 * BLD: A BUILDING'S PARTY WALLS - the bits of its edges that are no street front and stand against another building of the
 * cell's layout (`near`): the ground a hand out from the edge, at a quarter, the middle and three quarters along it,
 * under a neighbour. Its windows would stand under the neighbour's roof (9,687 of the 14,639 inner walls measured).
 */
export function partyEdges(L, p) {
  let bits = 0;
  for (let e = 0; e < 4; e++) {
    if (p.out & (1 << e)) continue;
    const a = p.q[e],
      b = p.q[(e + 1) & 3],
      n = outwardOf(p.q, e);
    for (const s of [0.25, 0.5, 0.75]) {
      const x = a[0] + (b[0] - a[0]) * s + n[0] * 0.3,
        z = a[1] + (b[1] - a[1]) * s + n[1] * 0.3;
      if (L.near.some((o) => o !== p && inQuad(o.q, x, z))) {
        bits |= 1 << e;
        break;
      }
    }
  }
  return bits;
}

/** A point `u` metres along a front from a toward b. */
const alongOf = (a, b) => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return (u) => [a[0] + ((b[0] - a[0]) * u) / l, a[1] + ((b[1] - a[1]) * u) / l];
};
/** IC-STAIRS: where along a front a-b (metres from a, clipped to it) a stair's own run [x0, x1] stands - the stair's wall
 *  on the front's line (within STAIR.tol), facing its way - or null. */
function spanOn(s, a, b, n, x0, x1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    e = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  if (
    s.n[0] * n[0] + s.n[1] * n[1] < 0.98 ||
    Math.abs((a[0] - s.at[0]) * s.n[0] + (a[1] - s.at[1]) * s.n[1]) > STAIR.tol + 0.05
  )
    return null;
  const u = (x) => (s.at[0] + s.t[0] * x - a[0]) * e[0] + (s.at[1] + s.t[1] * x - a[1]) * e[1];
  const u0 = Math.max(0, Math.min(u(x0), u(x1))),
    u1 = Math.min(len, Math.max(u(x0), u(x1)));
  return u1 > u0 ? [u0, u1] : null;
}
/** IC-STAIRS: the runs of a front a stair climbs before, `pad` past its ends. */
const stairSpans = (stairs, a, b, n, pad) => stairs.map((s) => spanOn(s, a, b, n, -pad, s.len + pad)).filter(Boolean);
/** IC-STAIRS: the run of its head building's front a stair's head landing opens onto the roof - from the landing's start
 *  to its end wall. */
const headSpan = (s, a, b, n) => spanOn(s, a, b, n, s.len - STAIR.head, s.len - STAIR.wall) ?? [0, 0];
/** The pieces of [0, len] none of `spans` covers, each longer than `min`. */
function openRuns(len, spans, min = 0.05) {
  const out = [];
  let at = 0;
  for (const [u0, u1] of [...spans].sort((p, q) => p[0] - q[0])) {
    if (u0 - at > min) out.push([at, u0]);
    at = Math.max(at, u1);
  }
  if (len - at > min) out.push([at, len]);
  return out;
}
/**
 * IC-STAIRS: THE PAVING'S COURSE a step is laid in - CAPITAL_ART.bridgeStone's middle course, its rows `top` to `top +
 * rows` as painted (world/capitalModels.js masonry: its joint the row at `top`, the next course's at `top + rows`). A
 * tread's whole going is that course, its joint along the nosing; its riser the same stone's face, the joint along its
 * top - so each step reads as one laid stone, its edge drawn; the stone's joints across the stair stagger step to step.
 */
export const STAIR_COURSE = Object.freeze({ top: 21, rows: 16 });
/** IC-STAIRS: the parapet's coping - its thickness and its overhang either side. */
export const STAIR_CAP = Object.freeze({ h: 0.1, over: 0.04 });
/** IC-STAIRS: the newel at a stair's foot - its side, its height over the parapet's foot, its cap's side and height. */
export const STAIR_NEWEL = Object.freeze({ side: 0.42, over: 0.3, cap: 0.54, capH: 0.12 });
/** IC-STAIRS: a flight's and a landing's waist (its soffit under the nosings' line, the landing's floor), and a landing's
 *  pier (its side along the wall and its depth in from the parapet's face). */
export const STAIR_WAIST = STAIR.waist;
export const STAIR_PIER = Object.freeze({ along: STAIR.pier, out: STAIR.pier });
/**
 * IC-STAIRS - A WAY UP: a built stair of the city's own stone along a street front (world/imperialFabric.js blockStair,
 * stairRuns). Each step a riser and a tread of the paving's stone, one course of it (STAIR_COURSE), running from inside
 * the wall behind (STAIR.into) to the parapet; the landings and the head in the paving's picture by the world's metres,
 * as the roofs and the pavements are laid (the head meets a flat roof flush, in its own stone); a solid parapet of the
 * walls' stone on the street side, STAIR.rail over the nosings, its top raking with the flights and level on the
 * landings, its coping of the paving's stone. The first flight and its landing stand on a solid base down into the
 * street, a newel at the foot, capped; every flight above spans to the next landing on its waist (STAIR_WAIST, its soffit
 * raking under it), each landing carried on a pier at the parapet (STAIR_PIER), the head on its end wall down to the
 * street - the shopfronts behind seen under them. The pictures the fabric's own two stones (CAPITAL_ART wallStone,
 * bridgeStone - the city wall's and the paving's), so a cell's model gains no draw.
 */
export function buildStair(mb, s) {
  const pave = T('bridgeStone'),
    stone = T('wallStone'),
    D = STAIR_DEPTH,
    IW = STAIR.width,
    IN = -STAIR.into,
    R = STAIR.rail,
    C = STAIR_CAP,
    TH = STAIR_WAIST;
  const P = (x, o) => [s.at[0] + s.t[0] * x + s.n[0] * o, s.at[1] + s.t[1] * x + s.n[1] * o];
  const V = (x, y, o) => {
    const p = P(x, o);
    return W(p[0], y, p[1]);
  };
  const along = WN(s.t[0], 0, s.t[1]),
    back = WN(-s.t[0], 0, -s.t[1]),
    out = WN(s.n[0], 0, s.n[1]),
    wallward = WN(-s.n[0], 0, -s.n[1]);
  const vN = -STAIR_COURSE.top / 64,
    vB = -(STAIR_COURSE.top + STAIR_COURSE.rows) / 64;
  /** A face of the stair's frame along it, between along x0 and x1 at out o, its foot y0a-y0b and its top y1a-y1b. */
  const side = (tex, o, x0, x1, y0a, y0b, y1a, y1b, n) =>
    mb.quad(tex, V(x0, y0a, o), V(x1, y0b, o), V(x1, y1b, o), V(x0, y1a, o), n, [
      [x0 / PIC, y0a / PIC],
      [x1 / PIC, y0b / PIC],
      [x1 / PIC, y1b / PIC],
      [x0 / PIC, y1a / PIC],
    ]);
  /** An end face (across the stair, at along x) between out o0 and o1, from y0 to y1. */
  const end = (tex, x, o0, o1, y0, y1, n) =>
    mb.quad(tex, V(x, y0, o0), V(x, y0, o1), V(x, y1, o1), V(x, y1, o0), n, [
      [o0 / PIC, y0 / PIC],
      [o1 / PIC, y0 / PIC],
      [o1 / PIC, y1 / PIC],
      [o0 / PIC, y1 / PIC],
    ]);
  /** A box in the stair's frame: its four sides, and its top (`top`). */
  const box = (tex, x0, x1, o0, o1, y0, y1, top = true) => {
    if (top) flat(mb, tex, [P(x0, o0), P(x1, o0), P(x1, o1), P(x0, o1)], y1, 1);
    side(tex, o1, x0, x1, y0, y0, y1, y1, out);
    side(tex, o0, x0, x1, y0, y0, y1, y1, wallward);
    end(tex, x1, o0, o1, y0, y1, along);
    end(tex, x0, o0, o1, y0, y1, back);
  };
  // the steps and the landings; the parapet's runs over them - the nosings' line from the foot to the head, each
  // { xa, ha, xb, hb }, `solid` on the first flight's base, `landing` a level run on a pier
  const runs = [];
  let k = 0,
    flights = 0,
    last = null;
  for (const g of s.runs) {
    if (g.kind === 'flight') {
      for (let i = 1; i <= g.m; i++, k++) {
        const x = g.s0 + (i - 1) * STAIR.tread,
          y0 = g.y + (i - 1) * s.rise,
          y1 = y0 + s.rise,
          sh = (k * 0.618) % 1,
          u0 = IN / PIC + sh,
          u1 = IW / PIC + sh;
        mb.quad(pave, V(x, y0, IN), V(x, y0, IW), V(x, y1, IW), V(x, y1, IN), back, [
          [u0, vB],
          [u1, vB],
          [u1, vN],
          [u0, vN],
        ]);
        if (i < g.m)
          mb.quad(
            pave,
            V(x, y1, IN),
            V(x, y1, IW),
            V(x + STAIR.tread, y1, IW),
            V(x + STAIR.tread, y1, IN),
            [0, 1, 0],
            [
              [u0, vN],
              [u1, vN],
              [u1, vB],
              [u0, vB],
            ],
          );
      }
      // the pitch line through the nosings - from the landing below, a tread before the flight's first riser
      const a = flights ? [g.s0 - STAIR.tread, g.y] : [g.s0, g.y + s.rise];
      if (last) runs.push({ xa: last[0], ha: last[1], xb: a[0], hb: a[1], solid: flights === 1, landing: flights > 1 });
      runs.push({ xa: a[0], ha: a[1], xb: g.s1, hb: g.y + g.m * s.rise, solid: flights === 0, landing: false });
      last = [g.s1, g.y + g.m * s.rise];
      flights++;
    } else {
      // a landing's paving laid along the stair; the head's from the wall's line, where a flat roof's own begins
      const o0 = g.kind === 'head' ? 0 : IN;
      mb.quad(
        pave,
        V(g.s0, g.y, o0),
        V(g.s1, g.y, o0),
        V(g.s1, g.y, IW),
        V(g.s0, g.y, IW),
        [0, 1, 0],
        [
          [g.s0 / PIC, o0 / PIC],
          [g.s1 / PIC, o0 / PIC],
          [g.s1 / PIC, IW / PIC],
          [g.s0 / PIC, IW / PIC],
        ],
      );
      if (g.kind === 'head' && last)
        runs.push({ xa: last[0], ha: last[1], xb: g.s1 - STAIR.wall, hb: g.y, solid: flights === 1, landing: false });
    }
  }
  const L = s.len,
    H = s.top;
  for (const [n, r] of runs.entries()) {
    const { xa, ha, xb, hb, solid } = r,
      rake = Math.abs(hb - ha) > 1e-6 ? s.rise : 0,
      slope = (hb - ha) / (xb - xa),
      nl = Math.hypot(slope, 1);
    // the parapet's outer face - down into the street on the base, else down to the waist - and its face over the steps
    side(stone, D, xa, xb, solid ? -0.3 : ha - TH, solid ? -0.3 : hb - TH, ha + R, hb + R, out);
    side(stone, IW, xa, xb, ha - rake, hb - rake, ha + R + C.h, hb + R + C.h, wallward);
    // its coping: flush over the steps, proud of the street face
    const ya = ha + R + C.h,
      yb = hb + R + C.h,
      po = D + C.over;
    mb.quad(
      pave,
      V(xa, ya, IW),
      V(xb, yb, IW),
      V(xb, yb, po),
      V(xa, ya, po),
      WN((-slope * s.t[0]) / nl, 1 / nl, (-slope * s.t[1]) / nl),
      [
        [xa / PIC, IW / PIC],
        [xb / PIC, IW / PIC],
        [xb / PIC, po / PIC],
        [xa / PIC, po / PIC],
      ],
    );
    side(pave, po, xa, xb, ha + R, hb + R, ya, yb, out);
    if (solid) {
      // the base's end, where the flights above leave it
      if (runs[n + 1] && !runs[n + 1].solid) end(stone, xb, IN, D, -0.3, hb - TH, along);
      continue;
    }
    // the waist's soffit under it, raking with the flight; a landing's pier
    mb.quad(
      stone,
      V(xa, ha - TH, IN),
      V(xb, hb - TH, IN),
      V(xb, hb - TH, D),
      V(xa, ha - TH, D),
      WN((slope * s.t[0]) / nl, -1 / nl, (slope * s.t[1]) / nl),
      [
        [xa / PIC, IN / PIC],
        [xb / PIC, IN / PIC],
        [xb / PIC, D / PIC],
        [xa / PIC, D / PIC],
      ],
    );
    if (r.landing) {
      const m = (xa + xb) / 2;
      box(stone, m - STAIR_PIER.along / 2, m + STAIR_PIER.along / 2, D - STAIR_PIER.out, D, -0.3, ha - TH, false);
    }
  }
  // the head's end wall: across the stair from the wall to the street and down into it, the head landing's rail high, its
  // coping; the parapet's outer face beside it on down to the street
  end(stone, L, IN, D, -0.3, H + R, along);
  end(stone, L - STAIR.wall, IN, IW, H, H + R, back);
  end(stone, L - STAIR.wall, IN, D, -0.3, H - TH, back);
  side(stone, D, L - STAIR.wall, L, -0.3, -0.3, H + R, H + R, out);
  box(pave, L - STAIR.wall - C.over, L + C.over, IN, D + C.over, H + R, H + R + C.h);
  // the newel at the foot, over the parapet's first rise, capped
  const N = STAIR_NEWEL,
    top = s.y0 + s.rise + R + N.over;
  box(stone, 0, N.side, D - N.side, D, -0.3, top);
  box(
    pave,
    N.side / 2 - N.cap / 2,
    N.side / 2 + N.cap / 2,
    D - N.side / 2 - N.cap / 2,
    D - N.side / 2 + N.cap / 2,
    top,
    top + N.capH,
  );
}
/** A BRIDGE between two roofs across a street: a plank deck from the near front `len` out along n, its two rails. */
function buildBridge(mb, br) {
  const tex = T('timber'),
    hw = br.width / 2,
    t = [-br.n[1], br.n[0]];
  const a = [br.from[0] + t[0] * hw, br.from[1] + t[1] * hw],
    b = [br.from[0] - t[0] * hw, br.from[1] - t[1] * hw];
  // the deck runs out from the near wall to the far one: a slab from the edge a-b along n
  slab(mb, tex, b, a, br.n, br.len, br.y - 0.3, br.y + 0.05);
  for (const side of [a, b])
    freeWall(mb, tex, side, [side[0] + br.n[0] * br.len, side[1] + br.n[1] * br.len], 0.1, br.y + 0.05, br.y + 1.0);
}
/** A STATUE of the Arboretum on its plinth, facing the way its seed says. */
function buildStatue(mb, at, seed) {
  const marble = T('marble');
  post(mb, marble, at[0], at[1], STATUE.plinth, -0.3, STATUE.plinthH);
  const a = ((seed % 8) / 8) * Math.PI * 2,
    face = [Math.cos(a), Math.sin(a)];
  // the figure, built as a map reads and turned to the world's frame by hand: robedFigure's points are (x, y, z) map frame
  const fig = new MeshBuilder();
  robedFigure(fig, marble, at[0], at[1], STATUE.plinthH, STATUE.figure, face, seed % 4);
  for (const g of fig.groups.values())
    for (let i = 0; i < g.indices.length; i += 3) {
      const P = (k) => {
        const v = g.indices[i + k] * 3;
        return [g.positions[v], g.positions[v + 1], -g.positions[v + 2]];
      };
      const N = [g.normals[g.indices[i] * 3], g.normals[g.indices[i] * 3 + 1], -g.normals[g.indices[i] * 3 + 2]];
      mb.tri(marble, P(0), P(1), P(2), N);
    }
}
/** IC-GRAND: A YARD'S WELL - its round kerb of stone (eight sides), two timber posts and a little pitched roof over it. */
function buildWell(mb, at) {
  const [x, z] = at,
    stone = T('wallStone'),
    timber = T('timber'),
    roof = T('roof'),
    n = 8,
    r = WELL.r;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2,
      am = (a0 + a1) / 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r],
      p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    wallFace(mb, stone, p0, p1, -0.2, WELL.h, [Math.cos(am), Math.sin(am)], WELL.h, PIC * 2);
    mb.tri(stone, W(x, WELL.h, z), W(p0[0], WELL.h, p0[1]), W(p1[0], WELL.h, p1[1]), [0, 1, 0]);
  }
  for (const side of [1, -1]) post(mb, timber, x + side * (r + 0.1), z, 0.18, 0, WELL.roofH);
  const e = r + WELL.eave,
    y0 = WELL.roofH,
    y1 = WELL.roofH + 0.7;
  for (const side of [1, -1]) {
    const a = [x - e, z + side * WELL.ridge],
      b = [x + e, z + side * WELL.ridge];
    mb.quad(roof, W(a[0], y0, a[1]), W(b[0], y0, b[1]), W(b[0], y1, z), W(a[0], y1, z), WN(0, 0.79, side * 0.62), [
      [0, -1],
      [1, -1],
      [1, 0],
      [0, 0],
    ]); // BLD: its top row at the ridge
  }
}
/** IC-GRAND: A SQUARE'S FOUNTAIN - an octagonal basin's kerb, its water, a column with a bowl on it. */
function buildSquareFountain(mb, at) {
  const [x, z] = at,
    stone = T('wallStone'),
    marble = T('marble'),
    n = 8,
    r = SQUARE_FOUNTAIN.r,
    k = 0.7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2,
      am = (a0 + a1) / 2,
      c = Math.cos(am),
      s = Math.sin(am);
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r],
      p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const q0 = [x + Math.cos(a0) * (r - 0.4), z + Math.sin(a0) * (r - 0.4)],
      q1 = [x + Math.cos(a1) * (r - 0.4), z + Math.sin(a1) * (r - 0.4)];
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
  const tex = T('dark'),
    r = cv.kind === 'manhole' ? IMPERIAL_SEWERS.coverR : 0.45,
    n = cv.kind === 'manhole' ? 8 : 4,
    y = 0.03;
  const [x, z] = cv.at;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + Math.PI / n,
      a1 = ((i + 1) / n) * Math.PI * 2 + Math.PI / n;
    mb.tri(
      tex,
      W(x, y, z),
      W(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r),
      W(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r),
      [0, 1, 0],
      [0.5, 0.5],
      [0.5 + Math.cos(a0) / 2, 0.5 + Math.sin(a0) / 2],
      [0.5 + Math.cos(a1) / 2, 0.5 + Math.sin(a1) / 2],
    );
  }
}

/**
 * A CELL'S MODEL (row r, column c of the plan): every building whose middle stands in it whole, its ways up, its bridges,
 * its yards' walls and sheds, its dead ends' walls, the park's statues there, and the sewers' covers in its streets (the
 * mains' under its roads and the branches' under its own) - null where it holds none of them. The world's frame, the
 * city's middle its origin.
 */
export function fabricCellModel(r, c) {
  const L = fabricCell(r, c),
    mb = new MeshBuilder();
  for (const p of L.plots) buildPlot(mb, p, partyEdges(L, p), L.nearStairs);
  for (const s of L.stairs) buildStair(mb, s);
  for (const br of L.bridges) buildBridge(mb, br);
  const stone = T('wallStone'),
    timber = T('timber');
  for (const y of L.yards) freeWall(mb, stone, y.a, y.b, YARD_WALL.t, -0.3, YARD_WALL.h);
  for (const d of L.deadEnds) freeWall(mb, stone, d.a, d.b, 0.6, -0.3, 2.4);
  for (const s of L.sheds) {
    post(mb, timber, s[0], s[1], SHED.w, -0.3, SHED.h);
  }
  for (const w of L.wells) buildWell(mb, w); // IC-GRAND: the yards' wells and the squares' fountains
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
  if (
    L.plots.length ||
    L.stairs.length ||
    L.bridges.length ||
    L.yards.length ||
    L.deadEnds.length ||
    L.sheds.length ||
    L.statues.length ||
    L.wells.length ||
    L.fountains.length
  )
    return true;
  const [x0, z0, x1, z1] = imperialCellRect(r, c);
  return sewerCoversIn(x0, z0, x1, z1).length > 0;
}
/** A far mass's walls and roof (a block's run, world/imperialFabric.js fabricMasses): its four walls to its height, its top
 *  flat or ridged along its longer side. */
function buildMass(mb, m) {
  const wallT = T(m.wall),
    roofT = T(m.roofTex);
  for (let e = 0; e < 4; e++) storeys(mb, wallT, m.q[e], m.q[(e + 1) & 3], 0, m.h, outwardOf(m.q, e)); // BLD: the near walls' law
  if (!m.gable) {
    flat(mb, T('bridgeStone'), m.q, m.h, 1);
    return;
  }
  const q = m.q,
    l0 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]),
    l1 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2],
    rise = Math.min(l0, l1) * 0.3;
  const [a, b, c, d] = l0 >= l1 ? q : [q[1], q[2], q[3], q[0]];
  const R0 = mid(d, a),
    R1 = mid(b, c),
    up = m.h + rise;
  for (const [p0, p1, r0, r1, e] of [
    [a, b, R0, R1, 0],
    [c, d, R1, R0, 2],
  ]) {
    const n = outwardOf([a, b, c, d], e),
      ny = Math.hypot(r0[0] - p0[0], r0[1] - p0[1]),
      sl = Math.hypot(ny, rise);
    mb.quad(
      roofT,
      W(p0[0], m.h, p0[1]),
      W(p1[0], m.h, p1[1]),
      W(r1[0], up, r1[1]),
      W(r0[0], up, r0[1]),
      WN((n[0] * rise) / sl, ny / sl, (n[1] * rise) / sl),
    );
  }
  for (const [p0, p1, R, e] of [
    [b, c, R1, 1],
    [d, a, R0, 3],
  ])
    gable(mb, wallT, p0, p1, m.h, R, up, outwardOf([a, b, c, d], e)); // BLD: no window cut by a slope
}
/**
 * A SLICE'S SKYLINE (s, sy * IMPERIAL_SPAN + sx): its fabric's blocks as masses - the far view's buildings
 * (world/imperialBlocks.js), no collider (nothing walks there before its slice is built near). IC-PROPS: Daggerfall's
 * blocks' rings of houses gone with the blocks (world/imperialCity.js cellOf). The world's frame, the city's middle its
 * origin. Null for a slice with none.
 */
export function skylineModel(s) {
  const mb = new MeshBuilder();
  for (const m of fabricMasses(imperialSliceRect(s))) buildMass(mb, m);
  if (!mb.groups.size) return null;
  return mb.build();
}
/** The cell's middle, for a test's own frame. */
export const cellMiddle = (r, c) => [(c - HALF + 0.5) * BLOCK_M, (r - HALF + 0.5) * BLOCK_M];
/** The district a cell's middle stands in. */
export const cellDistrict = (r, c) => imperialDistrictAt(...cellMiddle(r, c));
