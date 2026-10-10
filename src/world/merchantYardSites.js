// @ts-check
// MERCHANT-YARDS (2026-10-10): WHERE A TOWN'S TWO YARDS STAND - the Stable and the Wagon Yard (systems/merchantYards.js)
// on the town's own open ground, read off its layout alone, so every client stands each on one spot.
//
// THE GROUND: the town's navgrid (world/cityNavigation.js, DFU's CityNavigation carve - every automap byte a building,
// a tree or a lamp draws is closed, the water with it; always the enhanced lane's water table, as LEFAY1's monument
// reads it, so the classic lane's shallows are never ground), and over it what the caller measured of the town's
// blocks: every BUILDING's box kept BUILDING_CLEAR_M away (a home's yard lot is its box and HOME-YARD's YARD_MARGIN,
// 6 m, round it - scenes/homeYards.js - and a guild hall's is the same: no yard stands on a lot a player may decorate,
// nor before anyone's door), every other model's box (a wall, a well, a fence, a stall, a mod's carriage) PROP_CLEAR_M
// away, and every flat (a tree, a lamp, a sign, a person) FLAT_CLEAR_M round its foot. A block that holds a palace is
// left whole (a yard in a castle's court is no street's). LEFAY1's monument keeps its own ground.
//
// THE PLACE: a yard is a rectangle (YARD_FOOT, metres, its front its +z - the gate's side), turned to one of the four
// axes. Its own ground must be open and off every road and path (the street stays clear - FB1001 ROAD-LOT's law for a
// yard); a ring of YARD_PAD_M round it open too, a road allowed there - a yard stands BESIDE a street. Of every place
// that fits, the one nearest the middle of the town's block grid wins, a place whose front faces no road within
// FRONT_ROAD_CELLS costing NO_ROAD_COST cells of distance more (a yard opens onto a street where the town gives it one);
// ties to the lower row, then the lower column, then the lower turn. The Stable is placed first, then the Wagon Yard
// on what is left, YARD_GAP_M clear of it.
//
// A town with no room for one stands none of it (said once, in the console), never a yard over a house, a road or a lot.
//
// Pure: no renderer, no GL, no clock. Not a DFU member. Ledger A (MERCHANT-YARDS).
import { CityNavigation, NAV_CELL, NAV_CELLS_PER_BLOCK } from './cityNavigation.js';
import { ROAD_WEIGHT } from '../systems/gothwayBoards.js';
import { YARD_KIND_ORDER } from '../systems/merchantYards.js';

/** Each yard's ground, metres: half its width (x) and half its depth (z) - its fence and the apron before its gate
 *  where its sign and its keeper stand (world/merchantYardModels.js lays both out inside it). */
export const YARD_FOOT = Object.freeze({
  stable: Object.freeze({ hx: 7, hz: 5.75 }),
  transport: Object.freeze({ hx: 9, hz: 6.75 }),
});
/** The ring round a yard that must be open ground too (a road allowed), metres. */
export const YARD_PAD_M = NAV_CELL;
/** How far a yard keeps from a building's box: HOME-YARD's lot margin (scenes/homeYards.js YARD_MARGIN). */
export const BUILDING_CLEAR_M = 6;
/** How far from any other model's box, and round a flat's foot, metres. */
export const PROP_CLEAR_M = 1;
export const FLAT_CLEAR_M = 0.8;
/** How far apart the two yards stand, metres. */
export const YARD_GAP_M = 3;
/** How deep before a yard's front a road is looked for, cells; what facing none costs, cells of distance. */
export const FRONT_ROAD_CELLS = 2;
export const NO_ROAD_COST = 12;
/** The ground LEFAY1's monument keeps (its clear disc and a margin), metres. */
export const MONUMENT_KEEP_M = 8;

/** The four turns: a yard's front (+z in its frame) along +z, +x, -z, -x of the town - its yaw, degrees, as
 *  world/mat4.js trs turns it (ryDeg: +90 takes +z to +x). */
export const YARD_TURNS = Object.freeze([0, 90, 180, 270]);

/** A cell grid's summed-area table: `sum(x0, y0, x1, y1)` over cells x0..x1-1, y0..y1-1 (clipped to the grid). */
function summed(w, h, at) {
  const S = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += at(x, y); S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; }
  }
  return (x0, y0, x1, y1) => {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
    if (x1 <= x0 || y1 <= y0) return 0;
    return S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
  };
}

/** A yard's cell spans for a turn: [across x, across z]. Pure. */
export function yardSpans(kind, turn) {
  const F = YARD_FOOT[kind];
  const sx = turn % 2 ? F.hz : F.hx, sz = turn % 2 ? F.hx : F.hz;
  return [Math.ceil((2 * sx) / NAV_CELL - 1e-9), Math.ceil((2 * sz) / NAV_CELL - 1e-9)];
}

/**
 * THE GRID THE YARDS ARE PLACED ON: `blocked` 1 where a yard may not stand (closed, water, a building's or a prop's
 * clearance, a flat's, a palace's block, the monument's), `road` 1 on a road or a path. Pure.
 * @param {{width: number, height: number, weightAt: (gx: number, gy: number) => number}} nav
 * @param {{buildings?: number[][], props?: number[][], flats?: number[][], closedBlocks?: number[][], keep?: number[][]}} [o]
 *   `buildings`/`props` boxes [x0, z0, x1, z1] in the location frame (metres), `flats` [x, z] feet, `closedBlocks`
 *   [bx, by], `keep` discs [x, z, r] kept clear
 */
export function yardGround(nav, { buildings = [], props = [], flats = [], closedBlocks = [], keep = [] } = {}) {
  const W = nav.width, H = nav.height;
  const blocked = new Uint8Array(W * H), road = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const w = nav.weightAt(gx, gy), i = gy * W + gx;
    if (!(w > 0)) blocked[i] = 1;
    else if (w === ROAD_WEIGHT) road[i] = 1;
  }
  // a box grown by `pad` closes every cell whose centre is in it
  const closeBox = (b, pad) => {
    if (!Array.isArray(b) || b.length < 4 || !b.every(Number.isFinite)) return;
    const gx0 = Math.max(0, Math.ceil((b[0] - pad) / NAV_CELL - 0.5)), gx1 = Math.min(W - 1, Math.floor((b[2] + pad) / NAV_CELL - 0.5));
    const gy0 = Math.max(0, Math.ceil((b[1] - pad) / NAV_CELL - 0.5)), gy1 = Math.min(H - 1, Math.floor((b[3] + pad) / NAV_CELL - 0.5));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) blocked[gy * W + gx] = 1;
  };
  const closeDisc = (x, z, r) => {
    if (![x, z, r].every(Number.isFinite)) return;
    const gx0 = Math.max(0, Math.floor((x - r) / NAV_CELL)), gx1 = Math.min(W - 1, Math.floor((x + r) / NAV_CELL));
    const gy0 = Math.max(0, Math.floor((z - r) / NAV_CELL)), gy1 = Math.min(H - 1, Math.floor((z + r) / NAV_CELL));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      if (Math.hypot((gx + 0.5) * NAV_CELL - x, (gy + 0.5) * NAV_CELL - z) <= r + NAV_CELL / 2) blocked[gy * W + gx] = 1;
    }
  };
  for (const b of buildings) closeBox(b, BUILDING_CLEAR_M);
  for (const b of props) closeBox(b, PROP_CLEAR_M);
  for (const f of flats) closeDisc(f[0], f[1], FLAT_CLEAR_M);
  for (const k of keep) closeDisc(k[0], k[1], k[2]);
  for (const [bx, by] of closedBlocks) {
    closeBox([bx * NAV_CELLS_PER_BLOCK * NAV_CELL, by * NAV_CELLS_PER_BLOCK * NAV_CELL, (bx + 1) * NAV_CELLS_PER_BLOCK * NAV_CELL, (by + 1) * NAV_CELLS_PER_BLOCK * NAV_CELL], 0);
  }
  return { width: W, height: H, blocked, road };
}

/** The cells a yard's front looks onto, FRONT_ROAD_CELLS deep: [x0, y0, x1, y1). Pure. */
function frontStrip(gx, gy, nx, nz, turn) {
  const d = FRONT_ROAD_CELLS;
  if (turn === 0) return [gx, gy + nz, gx + nx, gy + nz + d];
  if (turn === 1) return [gx + nx, gy, gx + nx + d, gy + nz];
  if (turn === 2) return [gx, gy - d, gx + nx, gy];
  return [gx - d, gy, gx, gy + nz];
}

/**
 * ONE YARD'S PLACE on the ground (yardGround's): the best fit, or null. `x`, `z` its middle in the location frame
 * (metres from its origin), `yaw` its turn (degrees), and its cells. Pure.
 * @param {{width: number, height: number, blocked: Uint8Array, road: Uint8Array}} g @param {string} kind
 */
export function yardSite(g, kind) {
  if (!g || !YARD_FOOT[kind]) return null;
  const { width: W, height: H } = g;
  const closed = summed(W, H, (x, y) => g.blocked[y * W + x]);
  const roads = summed(W, H, (x, y) => g.road[y * W + x]);
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9);
  const mx = W / 2, my = H / 2;
  let best = null, bestScore = Infinity;
  for (let turn = 0; turn < 4; turn++) {
    const [nx, nz] = yardSpans(kind, turn);
    for (let gy = pad; gy + nz + pad <= H; gy++) {
      for (let gx = pad; gx + nx + pad <= W; gx++) {
        const cx = gx + nx / 2, cy = gy + nz / 2;
        const d = Math.hypot(cx - mx, cy - my);
        if (d >= bestScore) continue;   // facing a road only lowers the score to d: a place already further cannot win
        if (closed(gx - pad, gy - pad, gx + nx + pad, gy + nz + pad) !== 0) continue;
        if (roads(gx, gy, gx + nx, gy + nz) !== 0) continue;
        const s = frontStrip(gx, gy, nx, nz, turn);
        const score = d + (roads(s[0], s[1], s[2], s[3]) > 0 ? 0 : NO_ROAD_COST);
        if (score < bestScore || (score === bestScore && best && (gy < best.gy || (gy === best.gy && (gx < best.gx || (gx === best.gx && turn < best.turn)))))) {
          bestScore = score; best = { gx, gy, nx, nz, turn };
        }
      }
    }
  }
  if (!best) return null;
  return {
    kind, turn: best.turn, yaw: YARD_TURNS[best.turn],
    x: (best.gx + best.nx / 2) * NAV_CELL, z: (best.gy + best.nz / 2) * NAV_CELL,
    gx: best.gx, gy: best.gy, nx: best.nx, nz: best.nz,
  };
}

/** Close a placed yard's ground and YARD_GAP_M round it on the placing grid (the next yard stands clear of it). */
function closeSite(g, s) {
  const gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
  for (let gy = Math.max(0, s.gy - gap); gy < Math.min(g.height, s.gy + s.nz + gap); gy++) {
    for (let gx = Math.max(0, s.gx - gap); gx < Math.min(g.width, s.gx + s.nx + gap); gx++) g.blocked[gy * g.width + gx] = 1;
  }
}

/** BOTH YARDS on a ground, in YARD_KIND_ORDER: each placed on what the last left. Answers the sites found (none, one or
 *  both). Pure (it closes `g` as it goes - a ground is placed on once). */
export function yardSitesOn(g) {
  const out = [];
  for (const kind of YARD_KIND_ORDER) {
    const s = yardSite(g, kind);
    if (!s) continue;
    out.push(s);
    closeSite(g, s);
  }
  return out;
}

/**
 * The yards of a laid-out location (world/locationLayout.js layoutLocation's `{width, height, blocks}`): its navgrid
 * carved on the enhanced lane's water table, its blocks' measures over it (`measures`, yardGround's), then
 * yardSitesOn. Pure.
 * @param {{width: number, height: number, blocks: any[]}} loc @param {Parameters<typeof yardGround>[1]} [measures]
 */
export function yardSitesOf(loc, measures = {}) {
  if (!loc?.blocks?.length || !(loc.width > 0) || !(loc.height > 0)) return [];
  const nav = new CityNavigation(loc.width, loc.height);
  for (const b of loc.blocks) {
    const fld = b.dfBlock?.rmbBlock?.fldHeader;
    if (!fld?.autoMapData || !fld.groundData?.groundTiles) continue;
    const tiles = fld.groundData.groundTiles;
    nav.setBlockData(b.x, b.y, fld.autoMapData, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater: true });
  }
  return yardSitesOn(yardGround(nav, measures));
}

/** Close the yards' own ground on the wandering people's navgrid, so they walk round them (the gate's gap is no road
 *  of theirs). Answers how many cells it closed. */
export function carveYards(nav, sites) {
  if (!nav?.grid) return 0;
  let n = 0;
  for (const s of sites ?? []) {
    for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) {
      if (!nav.inBounds(gx, gy)) continue;
      const i = gy * nav.width + gx;
      if (nav.grid[i] !== 0) { nav.grid[i] = 0; n++; }
    }
  }
  return n;
}
