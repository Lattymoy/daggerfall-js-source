// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FAST-REFUSAL (2026-10-26, the owner: "Take care of exclusions and gaps"; bible/06-Systems/Travel-View.md FAST-REFUSAL) -
// THE LAND'S PIECES PAST THE BAY. A plan past the Bay's table with no way by land (Mournhold to Ebonheart: Vvardenfell
// over the Inner Sea, no boat to hand) spent the planner's whole count of cells before it said so - ROAD-BEYOND's
// 300,000, one to four seconds. The Bay's own pieces (travelRoute.js routeGround `apart`) are its table's; past it the
// land is the trace's smooth law (world/tamriel/tamrielLand.js landLaw), and that law answers land at a point only in a
// square of the picture's centres with one of the trace's land centres at a corner (a square of four sea centres is the
// sea whole). Two neighbouring pixels lie in one square or two that touch, so their land centres stand within two
// centres of each other: the trace's land centres joined to every one within two (the longest axis) are pieces that no
// way on land crosses between. The Bay's own ground, its seam and its blend (tamrielGround.js SEAM_PX, BLEND_PX) are one
// piece with every centre within BAY_PAD of the Bay's rectangle - the Bay's land is not the trace's, so it is joined to
// all of them. Built once a land (the trace and the fit: the pieces of one are kept by its object and the fit's numbers),
// some 64,000 centres and a dozen joins each: milliseconds, and every refusal after it costs a lookup.
//
// An end whose square holds no land centre (the sea, an isle of the Eltheric Ocean's that the trace does not draw, a
// pixel past the picture) is in no piece known here: never refused - the search answers it.
// ═══════════════════════════════════════════════════════════════════
import { tamrielFit, bayPictureRect } from '../../world/tamriel/tamrielFrame.js';
import { tamrielTrace } from '../../world/tamriel/tamrielLand.js';
import { landLabelOf, landRingDry } from '../../world/tamrielLandPieces.js'; // EXACT-PIECES: a region's runs and ring

/** How far about the Bay's rectangle (picture units) every centre is the Bay's own piece: its seam and blend (14 pixels,
 *  under one unit at the fit) and the two centres a square's corner may stand from a point in it. */
export const BAY_PAD = 3;
/** Two land centres within this many centres (the longest axis) are one piece - a step's two squares' corners. */
export const PIECE_REACH = 2;

let _for = null,
  _fx = NaN,
  _fy = NaN,
  _fp = NaN,
  _pieces = /** @type {Int32Array|null} */ (null);

/** The pieces of the trace's land centres (each centre's root, -1 the sea), made once a land. */
function piecesNow() {
  const trace = tamrielTrace(),
    fit = tamrielFit();
  if (!trace || !fit) return null;
  if (trace === _for && fit.ox === _fx && fit.oy === _fy && fit.ppu === _fp) return _pieces;
  const { w, h, land } = trace,
    n = w * h;
  const r = bayPictureRect();
  const bayX0 = Math.floor(r.x0) - BAY_PAD,
    bayX1 = Math.ceil(r.x1) + BAY_PAD,
    bayY0 = Math.floor(r.y0) - BAY_PAD,
    bayY1 = Math.ceil(r.y1) + BAY_PAD;
  // a centre (cx, cy) stands at picture point (cx + 0.5, cy + 0.5)
  const bay = (cx, cy) => cx + 0.5 >= bayX0 && cx + 0.5 <= bayX1 && cy + 0.5 >= bayY0 && cy + 0.5 <= bayY1;
  const root = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (land[i] || bay(i % w, Math.floor(i / w))) root[i] = i;
  const find = (i) => {
    while (root[i] !== i) {
      root[i] = root[root[i]];
      i = root[i];
    }
    return i;
  };
  const join = (a, b) => {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) root[ra] = rb;
  }; // the Bay's centres, a rectangle, join each other
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const a = cy * w + cx;
      if (root[a] < 0) continue;
      // the half of the 5 x 5 about it after it in reading order
      for (let dy = 0; dy <= PIECE_REACH; dy++) {
        for (let dx = -PIECE_REACH; dx <= PIECE_REACH; dx++) {
          if (dy === 0 && dx <= 0) continue;
          const bx = cx + dx,
            by = cy + dy;
          if (bx < 0 || bx >= w || by >= h) continue;
          const b = by * w + bx;
          if (root[b] >= 0) join(a, b);
        }
      }
    }
  }
  for (let i = 0; i < n; i++) if (root[i] >= 0) root[i] = find(i);
  _for = trace;
  _fx = fit.ox;
  _fy = fit.oy;
  _fp = fit.ppu;
  _pieces = root;
  return root;
}

/** The pieces a Bay-coordinate pixel past the table may stand on: the roots of its square's land centres (none: unknown).
 *  A pixel on the Bay's table is the Bay's own piece. @param {number} x @param {number} y @returns {Set<number>|null} */
function piecesAt(x, y, width, height) {
  const root = piecesNow();
  if (!root) return null;
  const trace = /** @type {{ w: number, h: number }} */ (tamrielTrace()),
    fit = /** @type {{ ox: number, oy: number, ppu: number }} */ (tamrielFit());
  const { w, h } = trace;
  // the table's own pixels: the Bay's piece (asked at the table's middle - every centre about the Bay is one piece)
  const onTable = x >= 0 && y >= 0 && x < width && y < height;
  const px = onTable
    ? [(width / 2 + fit.ox) / fit.ppu, (height / 2 + fit.oy) / fit.ppu]
    : [(x + 0.5 + fit.ox) / fit.ppu, (y + 0.5 + fit.oy) / fit.ppu];
  const ix = Math.floor(px[0] - 0.5),
    iy = Math.floor(px[1] - 0.5),
    out = new Set();
  for (const [cx, cy] of [
    [ix, iy],
    [ix + 1, iy],
    [ix, iy + 1],
    [ix + 1, iy + 1],
  ]) {
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const r = root[cy * w + cx];
    if (r >= 0) out.add(r);
  }
  return out;
}

/**
 * NO WAY BY LAND past the Bay: both ends stand in pieces known here and no piece is shared. False wherever an end is in
 * no known piece, or no trace has landed (the search answers).
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to @param {number} width @param {number} height
 */
export function apartPastBay(from, to, width, height) {
  const a = piecesAt(from.x, from.y, width, height),
    b = piecesAt(to.x, to.y, width, height);
  if (!a || !b || !a.size || !b.size) return false;
  for (const r of a) if (b.has(r)) return false;
  return true;
}

// ── EXACT-PIECES (bible/06-Systems/Travel-View.md EXACT-PIECES): the land's pieces at the pixel ─────────────────────────
// The roads' regions label their cores' dry pixels as they are laid (world/tamrielLandPieces.js, world/tamrielRoads.js
// regionLand); the world's roads host hands each region's labels here as it lands (scenes/tamrielRoadsHost.js), and each
// region's pieces are joined to its landed neighbours' where a dry pixel of one stands beside a dry pixel of the other
// across their shared edge. A core beside one the build lays nothing in (the open sea: no land seen in it past the Bay,
// none of the Bay's own) or past the lattice is UNKNOWN where the pixel beyond the edge is dry (the region's ring): its
// dry pixel there is joined to the one UNKNOWN piece, so nothing reached through it is ever told apart. Once every region of the build has landed with its land, two ends whose
// pieces share none have no way by land - exactly the planner's step law, pixel by pixel.

/** @type {null | { lattice: any, cw: number, ch: number, want: Set<string>, regions: Map<string, { region: any, land: any, base: number }>, root: Int32Array, next: number }} */
let _exact = null;
const UNKNOWN = 0;
const rk = (i, j) => `${i},${j}`;

/** A build begins: its lattice and the regions it lays (each with land - the rest of the lattice is UNKNOWN), each with
 *  its core (world/tamrielRoads.js regionOf). @param {{ x0: number, y0: number, cols: number, rows: number }} lattice
 *  @param {Array<{ i: number, j: number, core: { x0: number, y0: number, x1: number, y1: number } }>} regions */
export function resetExactPieces(lattice, regions) {
  const c = regions[0]?.core ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  _exact = {
    lattice,
    cw: c.x1 - c.x0,
    ch: c.y1 - c.y0,
    want: new Set(regions.map((r) => rk(r.i, r.j))),
    regions: new Map(),
    root: new Int32Array(1 << 12).fill(-1),
    next: 1,
  };
  _exact.root[UNKNOWN] = UNKNOWN;
}
/** No build (a world unmounted, the land past the Bay off). */
export const clearExactPieces = () => {
  _exact = null;
};

function findX(i) {
  const r = /** @type {any} */ (_exact).root;
  while (r[i] !== i) {
    r[i] = r[r[i]];
    i = r[i];
  }
  return i;
}
function joinX(a, b) {
  const ra = findX(a),
    rb = findX(b);
  if (ra !== rb) /** @type {any} */ (_exact).root[Math.max(ra, rb)] = Math.min(ra, rb);
}

/**
 * A region landed with its land's pieces (null: none carried - the build is then never whole here).
 * @param {{ i: number, j: number }} region
 * @param {?{ w: number, h: number, count: number, rowStart: Uint32Array, runLen: Uint16Array, runLabel: Uint32Array, ring: Uint8Array }} land
 */
export function addExactPieces(region, land) {
  const X = _exact;
  if (!X || !land || !X.want.has(rk(region.i, region.j)) || X.regions.has(rk(region.i, region.j))) return;
  const base = X.next;
  X.next += land.count;
  if (X.root.length < X.next) {
    const grown = new Int32Array(Math.max(X.next, X.root.length * 2)).fill(-1);
    grown.set(X.root);
    X.root = grown;
  }
  for (let k = 1; k <= land.count; k++) X.root[base + k - 1] = base + k - 1;
  const me = {
    region: {
      i: region.i,
      j: region.j,
      core: { x0: X.lattice.x0 + region.i * X.cw, y0: X.lattice.y0 + region.j * X.ch },
    },
    land,
    base,
  };
  X.regions.set(rk(region.i, region.j), me);
  const id = (r, u, v) => {
    const l = landLabelOf(r.land, u, v);
    return l ? r.base + l - 1 : -1;
  };
  // the four edges: a landed neighbour's dry pixel beside ours joins the two; a neighbour the build lays nothing in, UNKNOWN
  const W = X.cw,
    H = X.ch;
  for (const [di, dj, side] of /** @type {const} */ ([
    [1, 0, 'E'],
    [-1, 0, 'W'],
    [0, 1, 'S'],
    [0, -1, 'N'],
  ])) {
    const ni = region.i + di,
      nj = region.j + dj,
      k = rk(ni, nj);
    const inLattice = ni >= 0 && nj >= 0 && ni < X.lattice.cols && nj < X.lattice.rows;
    const them = X.regions.get(k);
    if (inLattice && X.want.has(k) && !them) continue; // laid later: joined then
    const n = di ? H : W;
    for (let t = 0; t < n; t++) {
      const [u, v] = di === 1 ? [W - 1, t] : di === -1 ? [0, t] : dj === 1 ? [t, H - 1] : [t, 0];
      const a = id(me, u, v);
      if (a < 0) continue;
      if (!them) {
        if (landRingDry(land, side, t)) joinX(a, UNKNOWN);
        continue;
      }
      const [p, q] = di === 1 ? [0, t] : di === -1 ? [W - 1, t] : dj === 1 ? [t, 0] : [t, H - 1];
      const b = id(them, p, q);
      if (b >= 0) joinX(a, b);
    }
  }
}

/** The pieces a pixel's step can stand on: its own where it is dry, else its dry neighbours' (a step's four sides - a
 *  diagonal one is two steps through a dry side); null where a pixel of it is in no landed region. */
function exactAt(x, y) {
  const X = /** @type {any} */ (_exact);
  const at = (px, py) => {
    const i = Math.floor((px - X.lattice.x0) / X.cw),
      j = Math.floor((py - X.lattice.y0) / X.ch),
      r = X.regions.get(rk(i, j));
    if (!r) return null;
    const l = landLabelOf(r.land, px - r.region.core.x0, py - r.region.core.y0);
    return l ? findX(r.base + l - 1) : -1;
  };
  const own = at(x, y);
  if (own === null) return null;
  if (own >= 0) return new Set([own]);
  const out = new Set();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const p = at(x + dx, y + dy);
    if (p === null) return null;
    if (p >= 0) out.add(p);
  }
  return out;
}

/**
 * NO WAY BY LAND, EXACTLY: every region of the build has landed with its land, and the two ends' pieces share none (and
 * neither is the UNKNOWN's). False otherwise - the search answers.
 * @param {{x:number,y:number}} from @param {{x:number,y:number}} to
 */
export function apartExact(from, to) {
  const X = _exact;
  if (!X || X.regions.size < X.want.size) return false;
  const a = exactAt(from.x, from.y),
    b = exactAt(to.x, to.y);
  if (!a?.size || !b?.size) return false; // an end in no landed region, or on the water with no dry pixel beside it
  for (const r of a) if (r === findX(UNKNOWN) || b.has(r)) return false;
  for (const r of b) if (r === findX(UNKNOWN)) return false;
  return true;
}
