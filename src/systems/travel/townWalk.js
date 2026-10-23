// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-TOWN-WALK (2026-10-19, the owner: "When in a town, slow down overworld navigation and have it navigate properly
// on town pathways instead of bumping into buildings"; bible/06-Systems/Travel-View.md OW-TOWN-WALK): A JOURNEY THROUGH
// A TOWN WALKS ITS STREETS, AT A TOWN'S PACE.
//
// Travel Options aims a journey straight at its next point (the mod's autopilot), and the port's steering feels its way
// round what stands in front (travelSteer.js). Across open country that is enough; in a town it is a walk into walls -
// the journey that starts at a tavern door, the spot clicked in a market square, the resume in the street a fight
// stopped it in - at a hundred times walking pace. DFU walks its townsfolk on the town's own grid (CityNavigation.cs:
// 1.6 m cells, a building's footprint none, the ground weighted by its tile - "Roads are great!"), and the port already
// paths its residents over it (systems/livingWorld/townPaths.js: an A* on the same weights, so a walk keeps to the
// streets). A journey in a town now takes the same way: from where the traveller stands to the street cell nearest its
// point, or - its point outside the town - to the town's edge nearest it, through the gates; that way's turns
// string-pulled to straight runs the grid can see along (a four-neighbour path is a staircase on every diagonal
// street); and walked as one line (travelAutopilot.js pathPursuit), at no more than TOWN_PACE_MAX - a town walked at
// x100 is a wall met at forty metres a frame.
//
// THE WALLS AND THEIR GATES (measured on the game's own cities - ARENA2 replayed in Node, test/lwRealTown.mjs). A walled
// city's wall is covered cells of its grid, and so is each of its gates: the gate model's automap footprint closes the
// passage (LW-WALLS found the same: DFU's walkers never cross it, so its streets and the fields about them are two
// pieces of the grid in 407 of the game's 410 cities). A way out asked of the bare grid found none from 1,776 of 1,920
// doors of the twelve greatest cities. So a journey's grid is the town's with each OPEN gate's passage carved through it
// (`gatePassage`, `carveNav`: from the gate's cell, the axis along which covered cells end in a street on both sides
// within GATE_REACH_CELLS - the arch walked through, as the player walks through it); a closed gate (DaggerfallCityGate
// swaps a wall in at night, offline - world/city/cityGate.js) carves nothing. Its pieces are labelled once
// (`componentsOf`, a flood over the grid, kept on the grid) and every way is asked only of the piece the traveller stands
// in: the edge streets tried are that piece's, a point in another piece is met at that piece's cell nearest it - so a
// search never walks a whole piece to learn it is the wrong one (it cost ~200 ms a door before).
//
// PURE: a grid in (the town's CityNavigation, or any { width, height, weightAt, grid? }), cells out. The host
// (scenes/townWalkHost.js) finds the town the traveller stands in and turns cells into the world's natives.
// Not a DFU member: DFU's fast travel never walks a town (it fades to black), and Travel Options' autopilot never
// paths. Ledger A row (OW-TOWN-WALK).
// ═══════════════════════════════════════════════════════════════════
import { findTownPath } from '../livingWorld/townPaths.js';

/** The fastest a journey runs while it walks a town's streets (the clock's rate - travelPace.js's dials run to x100 on
 *  a road). Five times a walk: a town of eight blocks crossed in under a minute, the streets' turns taken at a pace the
 *  motor and the collider meet a frame at a time. */
export const TOWN_PACE_MAX = 5;
/** How far round a cell that is no street (a doorstep, a building's footprint the traveller stands at the edge of) the
 *  nearest street cell is looked for, cells. */
export const TOWN_SNAP_CELLS = 8;
/** How many of the edge streets nearest the journey's point - of the traveller's own piece of the grid - are tried as its
 *  way out, nearest first (the first is all but always reached: they are its piece's). */
export const TOWN_EXIT_TRIES = 6;
/** The search's heuristic, weighted (`townPathSearch` hWeight - bounded: a way never dearer than this many times the
 *  cheapest). Measured over 960 of the game's own ways out (the four greatest cities and every twentieth, each from ten
 *  doors toward four sides): the cheapest search 12.3 ms on the mean and 51 ms at the worst, this one 7.6 and 38 ms -
 *  about 1.6 times as quick (AUDIT OW-REVISITED L6-7: "twice" was 9.5 against 5.6 ms, 1.7) - its ways 2.7% dearer, still
 *  the streets' (a residents' walk stays the cheapest: their weight is 1). Over every city of the game (410; twelve doors
 *  each toward four sides, their open gates carved; re-measured at the audit with TOWN_WAY_MARGIN): all 19,680 ways found,
 *  every run clear, 6.9 ms on the mean, 61 ms at the worst - once a leg, never a frame; the worst is a grid's FIRST ask,
 *  which labels its pieces once (`componentsOf`, AUDIT OW-REVISITED L6-9: 62-114 ms in the greatest cities on a shared
 *  machine), in the frame the leg starts. */
export const TOWN_WAY_H_WEIGHT = 1.5;
/** How far a gate's covered footprint is searched across for the streets either side of it, cells - a gate's arch is a
 *  few metres deep; past this the way is a wall's. */
export const GATE_REACH_CELLS = 24;
/** AUDIT OW-REVISITED L1-2: how far a string-pulled run keeps from every covered cell, cells - the body's capsule (motor.js:
 *  0.35 m, a fifth of a 1.6 m cell) and a little more. Clear by the cell alone, a run grazed a footprint's corner on 86% of
 *  the game's town ways and touched one on 10%; a street a cell wide still walks its middle (half a cell off its walls). */
export const TOWN_WAY_MARGIN = 0.3;

const inb = (nav, x, y) => x >= 0 && y >= 0 && x < nav.width && y < nav.height;
const open = (nav, x, y) => inb(nav, x, y) && nav.weightAt(x, y) > 0;

/** The nearest street cell to `cell` (itself when it is one) within `radius` cells, ring by ring - null for none.
 *  `ok(x, y)` narrows which streets count (a piece of the grid's). */
export function snapCell(nav, cell, radius = TOWN_SNAP_CELLS, ok = null) {
  const [cx, cy] = cell;
  const take = (x, y) => open(nav, x, y) && (!ok || ok(x, y));
  if (take(cx, cy)) return [cx, cy];
  for (let r = 1; r <= radius; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !take(cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [cx + dx, cy + dy]; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** The town's edge cells that are streets, nearest `toward` first (a cell anywhere, inside the grid or past it), at most
 *  `max`; `ok(x, y)` narrows them (a piece of the grid's). */
export function exitCells(nav, toward, max = TOWN_EXIT_TRIES, ok = null) {
  const out = [];
  const W = nav.width, H = nav.height;
  const add = (x, y) => { if (open(nav, x, y) && (!ok || ok(x, y))) out.push([x, y, (x - toward[0]) ** 2 + (y - toward[1]) ** 2]); };
  for (let x = 0; x < W; x++) { add(x, 0); if (H > 1) add(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { add(0, y); if (W > 1) add(W - 1, y); }
  out.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  return out.slice(0, Math.max(0, max)).map(([x, y]) => [x, y]);
}

/** The distance from the segment a-b (cell centres) to the covered cell (cx, cy)'s square - one the segment never enters
 *  (its supercover is open): the nearer of the square's corners to the segment and the segment's ends to the square. */
function squareGap(a, b, cx, cy) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const toSeg = (px, py) => { const u = l2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0; return Math.hypot(px - (a[0] + dx * u), py - (a[1] + dy * u)); };
  const toSq = (px, py) => Math.hypot(Math.max(0, Math.abs(px - cx) - 0.5), Math.max(0, Math.abs(py - cy) - 0.5));
  return Math.min(toSeg(cx - 0.5, cy - 0.5), toSeg(cx + 0.5, cy - 0.5), toSeg(cx - 0.5, cy + 0.5), toSeg(cx + 0.5, cy + 0.5), toSq(a[0], a[1]), toSq(b[0], b[1]));
}
/** Whether every cell the straight line from cell `a` to cell `b` passes through is a street - the line's whole
 *  supercover (each cell it touches, the corner cells of a diagonal step both), so a straight run never shaves a wall's
 *  corner - and (AUDIT OW-REVISITED L1-2) passes no covered cell beside it nearer than `margin` cells. */
export function clearLine(nav, a, b, margin = 0) {
  let x = a[0], y = a[1];
  const dx = Math.abs(b[0] - x), dy = Math.abs(b[1] - y), sx = Math.sign(b[0] - x), sy = Math.sign(b[1] - y);
  if (!open(nav, x, y)) return false;
  const walked = margin > 0 ? [[x, y]] : null;
  let e = dx - dy;
  for (let n = dx + dy; n > 0; n--) {
    const e2 = 2 * e;
    if (e2 > -dy && e2 < dx) {   // a diagonal step through a corner: both cells beside it walked too
      if (!open(nav, x + sx, y) || !open(nav, x, y + sy)) return false;
      x += sx; y += sy; e += dx - dy; n--;
    } else if (e2 > -dy) { x += sx; e -= dy; }
    else { y += sy; e += dx; }
    if (!open(nav, x, y)) return false;
    walked?.push([x, y]);
  }
  if (walked) {
    for (const [wx, wy] of walked) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!open(nav, wx + ox, wy + oy) && squareGap(a, b, wx + ox, wy + oy) < margin) return false;
        }
      }
    }
  }
  return true;
}

/** A four-neighbour path string-pulled: from each kept cell, on to the farthest later cell it can see along clearLine,
 *  TOWN_WAY_MARGIN clear of every covered cell (AUDIT OW-REVISITED L1-2: the body's capsule, never its centre alone) -
 *  both ends kept. A staircase down a diagonal street is one run; a turn at a corner stays a turn. Two cells a step apart
 *  are always clear (half a cell off what stands beside them), so the string-pull never fails. */
export function simplifyWay(nav, cells, margin = TOWN_WAY_MARGIN) {
  if (!cells || cells.length <= 2) return cells ? cells.map((c) => [c[0], c[1]]) : [];
  const out = [[cells[0][0], cells[0][1]]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !clearLine(nav, cells[i], cells[j], margin)) j--;
    out.push([cells[j][0], cells[j][1]]);
    i = j;
  }
  return out;
}

/** @type {WeakMap<object, Int32Array>} */
const piecesOf = new WeakMap();
/**
 * THE GRID'S PIECES: each street cell labelled with the piece it belongs to (four neighbours, as the walkers step), 0 for
 * none - flooded once a grid and kept on it.
 */
export function componentsOf(nav) {
  let label = piecesOf.get(nav);
  if (label && label.length === nav.width * nav.height) return label;
  const W = nav.width, H = nav.height;
  label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let next = 0;
  for (let i = 0; i < W * H; i++) {
    if (label[i] || !open(nav, i % W, (i / W) | 0)) continue;
    next++;
    let top = 0;
    stack[top++] = i; label[i] = next;
    while (top) {
      const c = stack[--top], x = c % W, y = (c / W) | 0;
      if (x + 1 < W && !label[c + 1] && open(nav, x + 1, y)) { label[c + 1] = next; stack[top++] = c + 1; }
      if (x > 0 && !label[c - 1] && open(nav, x - 1, y)) { label[c - 1] = next; stack[top++] = c - 1; }
      if (y + 1 < H && !label[c + W] && open(nav, x, y + 1)) { label[c + W] = next; stack[top++] = c + W; }
      if (y > 0 && !label[c - W] && open(nav, x, y - 1)) { label[c - W] = next; stack[top++] = c - W; }
    }
  }
  piecesOf.set(nav, label);
  return label;
}

/** @type {WeakMap<object, { edge: Set<number>, all: number }>} */
const edgesOf = new WeakMap();
/** AUDIT OW-REVISITED L1-4: the pieces of a grid that reach its edge (`edge`) and how many pieces it has (`all`) - a
 *  walled city's fields reach it, its streets inside the wall and its closed gates do not (LW-WALLS); kept on the grid as
 *  its labels are. */
export function edgePieces(nav) {
  let got = edgesOf.get(nav);
  if (got) return got;
  const label = componentsOf(nav), W = nav.width, H = nav.height;
  const edge = new Set();
  for (let x = 0; x < W; x++) { if (label[x]) edge.add(label[x]); if (label[(H - 1) * W + x]) edge.add(label[(H - 1) * W + x]); }
  for (let y = 0; y < H; y++) { if (label[y * W]) edge.add(label[y * W]); if (label[y * W + W - 1]) edge.add(label[y * W + W - 1]); }
  let all = 0;
  for (let i = 0; i < label.length; i++) if (label[i] > all) all = label[i];
  got = { edge, all };
  edgesOf.set(nav, got);
  return got;
}

/**
 * A GATE'S PASSAGE, cells: from its cell (`gate`, the gate model's middle on the grid), the axis along which the covered
 * cells end in a street on BOTH sides within GATE_REACH_CELLS - the shorter where both do - and the covered cells between
 * (a street's either end left as it is). Null where none does: a gate the grid cannot see through is a wall's.
 */
export function gatePassage(nav, gate, reach = GATE_REACH_CELLS) {
  let best = null;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const end = (s) => { for (let k = 0; k <= reach; k++) { const x = gate[0] + dx * s * k, y = gate[1] + dy * s * k; if (!inb(nav, x, y)) return null; if (open(nav, x, y)) return k; } return null; };
    const a = end(1), b = end(-1);
    if (a == null || b == null || (a === 0 && b === 0)) continue;
    if (best && a + b >= best.span) continue;
    const cells = [];
    for (let k = -b + 1; k < a; k++) cells.push([gate[0] + dx * k, gate[1] + dy * k]);
    best = { span: a + b, cells };
  }
  return best ? best.cells : null;
}

/**
 * THE JOURNEY'S GRID: the town's with each passage given carved through it - its cells a street of the road's own weight
 * (15). The town's grid itself is never written (its residents' walls stay theirs); with nothing to carve, it is the
 * grid itself.
 */
export function carveNav(nav, passages) {
  const cells = (passages ?? []).flat();
  if (!cells.length) return nav;
  const W = nav.width, H = nav.height;
  const grid = new Uint8Array(W * H);
  if (nav.grid instanceof Uint8Array && nav.grid.length === W * H) grid.set(nav.grid);
  else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y * W + x] = (nav.weightAt(x, y) & 15) << 4;
  for (const [x, y] of cells) if (inb(nav, x, y)) grid[y * W + x] = 15 << 4;
  for (let i = 0; i < W * H; i++) grid[i] &= 0xf0;   // the walkers' occupancy flags are the town's, never the journey's
  return { width: W, height: H, grid, weightAt: (x, y) => (inb(nav, x, y) ? grid[y * W + x] >> 4 : 0) };
}

/** The street cell of piece `id` nearest `to` (cells, anywhere) - of any piece when `id` is 0 - the grid read once. */
function nearestIn(nav, label, id, to) {
  const W = nav.width;
  let best = null, bd = Infinity;
  for (let i = 0; i < label.length; i++) {
    if (id ? label[i] !== id : !label[i]) continue;
    const x = i % W, y = (i / W) | 0, d = (x - to[0]) ** 2 + (y - to[1]) ** 2;
    if (d < bd) { bd = d; best = [x, y]; }
  }
  return best;
}

/**
 * THE WAY THROUGH THE TOWN, cells: from the street cell nearest `from` to the street cell nearest `to` when `to` lies
 * in the grid (`inside`), else to the nearest edge street of the traveller's own piece (round a wall, through a gate the
 * journey's grid carved) - string-pulled. `reached`: whether the way ends at its point (or out of the town) - false
 * where the point lies in a piece no way reaches (behind a shut gate), the way then to this piece's cell nearest it.
 * Null when the traveller stands nowhere near a street, or the town's edge is no street of their piece (a walled city
 * whose gates are shut).
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number, grid?: Uint8Array }} nav
 * @param {number[]} from - [gx, gy] @param {number[]} to - [gx, gy], anywhere
 * @returns {{ cells: number[][], inside: boolean, reached: boolean } | null}
 */
export function townWayCells(nav, from, to, { maxExpansions = nav.width * nav.height, hWeight = TOWN_WAY_H_WEIGHT } = {}) {   // the whole grid's cells: a way in its piece is never given up on early (the greatest cities' pieces are 200,000 cells)
  const a = snapCell(nav, from);
  if (!a) return null;
  const label = componentsOf(nav), W = nav.width, id = label[a[1] * W + a[0]];
  const mine = (x, y) => label[y * W + x] === id;   // the traveller's own piece - the only one a way can reach
  if (inb(nav, to[0], to[1])) {
    const b = snapCell(nav, to, TOWN_SNAP_CELLS, mine) ?? nearestIn(nav, label, id, to);   // a point in another piece (a shut gate's far side): this piece's nearest
    const path = b ? findTownPath(nav, a, b, { maxExpansions, hWeight }) : null;
    const own = snapCell(nav, to) ?? nearestIn(nav, label, 0, to);   // the point's own street, of whichever piece: reached when it is the traveller's
    return path ? { cells: simplifyWay(nav, path), inside: true, reached: !!own && mine(own[0], own[1]) } : null;
  }
  for (const exit of exitCells(nav, to, TOWN_EXIT_TRIES, mine)) {
    const path = findTownPath(nav, a, exit, { maxExpansions, hWeight });
    if (path) return { cells: simplifyWay(nav, path), inside: false, reached: true };
  }
  return null;
}
