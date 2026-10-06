// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE TOWN'S PLACES - where a resident can go, read off the town as
// it is built: its buildings' doors (the host hands each in the location frame with its outward normal), its navgrid
// (world/cityNavigation.js) and its buildings' types.
//
//  - A DOOR is the walkable cell just before it: out along the door's normal until the ground takes a foot (the other
//    way where the model's normal faces in - a footprint is never street), else the nearest walkable cell about it - and
//    always on the town's one connected street net, so every door can be walked to from every other. A building whose
//    doors stand off the net (a fenced yard, a tower in the water) keeps none: its people stay in.
//  - THE STREET NET is the walkable component (four-neighbour) the most of the town's buildings open onto (`doorsNet`) -
//    not the grid's largest: a walled city's wall and gates are covered cells, so its streets and the fields outside its
//    walls are two components, and the fields are the larger in 407 of the game's 410 cities.
//  - THE SQUARE is the most open ground near the town's middle (the walkable cells about a cell, sampled on a stride).
//    LW-SPREAD: and it is GROUND, not a point - its POINTS (`squares`, the square's own spot first) are the most open
//    cells about it, apart, seen from it over the street: where the town's people gather at the square, each to their
//    own (dayPlan.js squareOf). And a town has its CORNERS (`corners`): each block's most open street, apart from the
//    social spots and from one another - where a neighbourhood gathers (a hamlet of seven social spots stood its whole
//    evening at them).
//  - SOCIAL SPOTS stand a few paces before the taverns, temples, guild halls and the palace, and the square is one;
//    MARKET SPOTS before the shops; the DOCK is a Ship building's door where the town has one.
//  - THE EXITS are, for each side of the grid, the street-net cell nearest that edge: on the border itself in an open
//    town, in the gate's passage in a walled one (the gate's own footprint ends the street there) - and where the net
//    reaches no edge at all, the farthest it reaches toward it.
//
// PURE: the doors, the grid and the types in; plain records out.
import { NAV_CELL, HALF_CELL } from '../../world/cityNavigation.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { hasShopJob } from './census.js';

/** How far out along a door's normal its cell is looked for (m), and the ring searched about it after (cells). */
export const DOOR_REACH_M = [0.9, 1.6, 2.4, 3.2, 4.0];
export const DOOR_RING = 4;
/** A social spot's distance before its door (cells), and a market spot's. */
export const SOCIAL_OUT = 4;
export const MARKET_OUT = 2;
/** The square's openness window (cells either side) and its search stride (cells). */
export const SQUARE_WINDOW = 3;
export const SQUARE_STRIDE = 3;
/** LW-SPREAD: THE SQUARE'S POINTS - looked for within SQUARE_REACH cells of the square, each SQUARE_GAP cells from every
 *  other, at least SQUARE_OPEN as open as the square itself, to SQUARE_POINTS with the square's own. */
export const SQUARE_REACH = 14;
export const SQUARE_GAP = 6;
export const SQUARE_OPEN = 0.75;
export const SQUARE_POINTS = 5;
/** LW-SPREAD: THE TOWN'S CORNERS - each block's most open street cell (the square's window, a margin of CORNER_MARGIN
 *  cells inside the block), at least CORNER_OPEN as open as the square, CORNER_GAP cells from every social spot, every
 *  point of the square and every other corner. */
export const CORNER_MARGIN = 6;
export const CORNER_OPEN = 0.6;
export const CORNER_GAP = 16;
/** The grid's cells to a block's side (world/cityNavigation.js NAV_CELLS_PER_BLOCK). */
const BLOCK_CELLS = 64;

/** The buildings before which a town gathers to talk. @type {Set<number>} */
const SOCIAL_TYPES = new Set([BUILDING_TYPES.Tavern, BUILDING_TYPES.Temple, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Palace]);

/**
 * @typedef {{ key: string, kind: 'door'|'social'|'square'|'corner'|'market'|'dock'|'exit', cell: number[], x: number, z: number,
 *   yaw: number, building?: number, side?: 'n'|'s'|'e'|'w' }} Spot - LW-SPREAD: a point of the square is a 'square' too, a
 *   town's corner a 'corner' - `yaw` the way one faces standing there (a door: in
 *   toward it; a spot: toward its building; an exit: out of town)
 * @typedef {{ doors: Map<number, Spot>, square: Spot|null, squares: Spot[], corners: Spot[], social: Spot[], market: Spot[], dock: Spot[], exits: Spot[],
 *   types: Map<number, number>, factions: Map<number, number>, net: Int32Array, netId: number }} Places - LW-SPREAD
 *   `squares` the square's points (the square's own spot first; none without a square), `corners` the town's corners;
 *   LW-ERRANDS `factions` each building's faction (its summary's factionId: a guild hall's guild, a temple's god)
 */

/**
 * The grid's walkable components (four-neighbour), and the largest's label.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 */
export function streetNet(nav) {
  const W = nav.width, H = nav.height;
  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  // LW-PERF: the walkable cells read once (the grid's own bytes where it has them: the weight in the high nibble)
  const grid = /** @type {any} */ (nav).grid;
  const walk = new Uint8Array(W * H);
  if (grid instanceof Uint8Array && grid.length === W * H) for (let i = 0; i < W * H; i++) walk[i] = grid[i] >> 4 > 0 ? 1 : 0;
  else for (let i = 0; i < W * H; i++) walk[i] = nav.weightAt(i % W, (i / W) | 0) > 0 ? 1 : 0;
  let next = 0, best = 0, bestSize = 0;
  for (let i = 0; i < W * H; i++) {
    if (label[i] || !walk[i]) continue;
    const id = ++next;
    let sp = 0, size = 0;
    stack[sp++] = i; label[i] = id;
    while (sp > 0) {
      const c = stack[--sp];
      size++;
      const x = c % W, y = (c / W) | 0;
      if (x > 0 && !label[c - 1] && walk[c - 1]) { label[c - 1] = id; stack[sp++] = c - 1; }
      if (x < W - 1 && !label[c + 1] && walk[c + 1]) { label[c + 1] = id; stack[sp++] = c + 1; }
      if (y > 0 && !label[c - W] && walk[c - W]) { label[c - W] = id; stack[sp++] = c - W; }
      if (y < H - 1 && !label[c + W] && walk[c + W]) { label[c + W] = id; stack[sp++] = c + W; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  return { label, id: best, size: bestSize };
}

/**
 * The cell `ok` takes (by its index in the grid) nearest a location-frame point within `ring` cells (Chebyshev rings
 * outward, the nearest by distance within the first ring holding one), or null.
 * @param {{ width: number, height: number }} nav @param {(i: number) => boolean} ok
 * @param {number} x @param {number} z @param {number} ring
 */
function nearestCell(nav, ok, x, z, ring) {
  const W = nav.width, H = nav.height;
  const gx = Math.floor(x / NAV_CELL), gy = Math.floor(z / NAV_CELL);
  for (let r = 0; r <= ring; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = gx + dx, cy = gy + dy;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H || !ok(cy * W + cx)) continue;
        const d = Math.hypot(cx * NAV_CELL + HALF_CELL - x, cy * NAV_CELL + HALF_CELL - z);
        if (d < bestD) { bestD = d; best = [cx, cy]; }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * The street-net cell nearest a location-frame point within `ring` cells, or null.
 * @param {{ width: number, height: number }} nav @param {Int32Array} net @param {number} netId
 * @param {number} x @param {number} z @param {number} ring
 */
export function nearestNetCell(nav, net, netId, x, z, ring) {
  return nearestCell(nav, (i) => net[i] === netId, x, z, ring);
}

/**
 * The cell a door opens onto, of those `ok` takes: out along its normal (DOOR_REACH_M) to the first - the other way
 * where a model's normal faces in (a footprint is never street) - else the nearest within DOOR_RING of a point 1.6 m
 * out; with the normal it was found along. Null where none is.
 * @param {{ width: number, height: number }} nav @param {{ x: number, z: number, nx: number, nz: number }} d
 * @param {(i: number) => boolean} ok
 * @returns {{ cell: number[], nx: number, nz: number } | null}
 */
function doorCell(nav, d, ok) {
  const W = nav.width, H = nav.height;
  const nl = Math.hypot(d.nx, d.nz) || 1;
  const nx = d.nx / nl, nz = d.nz / nl;
  for (const sign of [1, -1]) {
    for (const m of DOOR_REACH_M) {
      const cx = Math.floor((d.x + sign * nx * m) / NAV_CELL), cy = Math.floor((d.z + sign * nz * m) / NAV_CELL);
      if (cx >= 0 && cy >= 0 && cx < W && cy < H && ok(cy * W + cx)) return { cell: [cx, cy], nx: nx * sign, nz: nz * sign };
    }
  }
  const cell = nearestCell(nav, ok, d.x + nx * 1.6, d.z + nz * 1.6, DOOR_RING);
  return cell ? { cell, nx, nz } : null;
}

/**
 * FIELD (2026-10-06, MD-Geist: "In Ripmarket (Daggerfall Province) the last few days there have been 0 NPC's walking
 * around in the city"): THE TOWN'S STREET NET IS THE ONE ITS DOORS OPEN ONTO - of the grid's walkable components
 * (`streets`, streetNet's labels), the one the most of the town's buildings open onto (each building once, by any of its
 * doors - doorCell on any walkable cell), the larger on a tie, then the first labelled; a town whose doors reach none
 * (no doors) keeps the largest. The largest was taken for the town's own, and a walled city's wall and gates are covered
 * cells (the gate model's automap footprint closes its passage; DFU's walkers, spawned about the player, never cross it):
 * its streets inside the walls and the fields about them are two components, and the fields are the larger in 407 of
 * the game's 410 cities (Ripmarket's 77,611 cells to its streets' 57,539) - every door off the net, every one of its 305
 * people at home all day, a street with nobody on it at every hour.
 * @param {{ width: number, height: number }} nav
 * @param {readonly { key: number, x: number, z: number, nx: number, nz: number }[]} doors - location frame
 * @param {{ label: Int32Array, id: number }} streets
 * @returns {number} the component's label
 */
export function doorsNet(nav, doors, streets) {
  const { label } = streets;
  /** @type {Map<number, Set<number>>} each component's buildings */
  const opens = new Map();
  for (const d of doors) {
    const at = doorCell(nav, d, (i) => label[i] > 0);
    if (!at) continue;
    const id = label[at.cell[1] * nav.width + at.cell[0]];
    const keys = opens.get(id) ?? new Set();
    keys.add(d.key);
    opens.set(id, keys);
  }
  if (!opens.size) return streets.id;
  const size = new Map([...opens.keys()].map((id) => [id, 0]));
  for (let i = 0; i < label.length; i++) { const n = size.get(label[i]); if (n !== undefined) size.set(label[i], n + 1); }
  let best = 0, bestKeys = -1, bestSize = -1;
  for (const [id, keys] of [...opens].sort((a, b) => a[0] - b[0])) {
    const n = /** @type {number} */ (size.get(id));
    if (keys.size > bestKeys || (keys.size === bestKeys && n > bestSize)) { best = id; bestKeys = keys.size; bestSize = n; }
  }
  return best;
}

const centre = (c) => [c[0] * NAV_CELL + HALF_CELL, c[1] * NAV_CELL + HALF_CELL];
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);

/** LW5: how far from a harbour's berth a town's dock is looked for (street cells - a berth lies off the shore, often
 *  eighty metres and more out, HARBOUR-BOOK's). */
export const HARBOUR_RING = 120;

/** LW-STAND: half a person's breadth (m) - a body is the square this far about its middle. */
export const STAND_REACH_M = 0.4;

/** AUDIT LW-STAND: the slack the street's geometry gives at a boundary (m) - a body's own steps along a way the street
 *  holds are never refused for their rounding. */
const STREET_SLACK = 1e-6;

/**
 * @typedef {{ holds: (x: number, z: number) => boolean, reach: (ax: number, az: number, bx: number, bz: number) => number,
 *   clear: (ax: number, az: number, bx: number, bz: number) => boolean }} Street
 */

/**
 * LW-STAND (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water, or be stuck running into walls"): THE
 * STREET A PERSON STANDS AND WALKS ON - the street net's cells (the grid's own walkable cells: a building's footprint
 * and the water are none - world/cityNavigation.js - nor is the grid's outside), and a body the square of `reach`
 * about its middle. AUDIT LW-STAND: EXACT. A body stands where the square overlaps no cell off the net (`holds`) - its
 * corners too: four probes on its axes stood a body over a building's corner - and a straight way holds it where the
 * square swept along it overlaps none: the off-net cells grown by `reach`, against the way (the slab test). So any part
 * of a way the street holds it holds too, and a walker sounding its way afresh each step never finds shut what was open
 * (the samples a quarter-metre apart did, and one walked on the spot between two answers). `reach(a, b)` how far along
 * the way from `a` toward `b` the street holds a body; `clear(a, b)` whether it holds the whole way. Pure: every reader
 * alike. Positions in the location's frame (metres).
 * @param {{ width: number, height: number }} nav @param {{ net: Int32Array, netId: number }} places
 * @param {number} [reach]
 * @returns {Street}
 */
export function streetGeometry(nav, places, reach = STAND_REACH_M) {
  const W = nav.width, H = nav.height, C = NAV_CELL, net = places.net, id = places.netId;
  const r = reach - STREET_SLACK;
  /** the way from (ax, az) to (bx, bz) as a share of its length: the first share at which a body walking it would
   *  overlap a cell off the net - Infinity for none */
  const enter = (/** @type {number} */ ax, /** @type {number} */ az, /** @type {number} */ bx, /** @type {number} */ bz) => {
    const dx = bx - ax, dz = bz - az;
    const x0 = Math.floor((Math.min(ax, bx) - reach) / C), x1 = Math.floor((Math.max(ax, bx) + reach) / C);
    const y0 = Math.floor((Math.min(az, bz) - reach) / C), y1 = Math.floor((Math.max(az, bz) + reach) / C);
    let first = Infinity;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx >= 0 && cy >= 0 && cx < W && cy < H && net[cy * W + cx] === id) continue;
        // the cell grown by the reach, open: the shares of the way strictly inside it
        let lo = 0, hi = 1;
        const lx = cx * C - r, hx = (cx + 1) * C + r, lz = cy * C - r, hz = (cy + 1) * C + r;
        if (dx === 0) { if (!(ax > lx && ax < hx)) continue; } else {
          const ta = (lx - ax) / dx, tb = (hx - ax) / dx;
          lo = Math.max(lo, Math.min(ta, tb)); hi = Math.min(hi, Math.max(ta, tb));
        }
        if (dz === 0) { if (!(az > lz && az < hz)) continue; } else {
          const ta = (lz - az) / dz, tb = (hz - az) / dz;
          lo = Math.max(lo, Math.min(ta, tb)); hi = Math.min(hi, Math.max(ta, tb));
        }
        if (lo < hi && lo < first) first = lo;
      }
    }
    return first;
  };
  return {
    holds: (x, z) => enter(x, z, x, z) === Infinity,
    reach: (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az) * Math.min(1, enter(ax, az, bx, bz)),
    clear: (ax, az, bx, bz) => enter(ax, az, bx, bz) === Infinity,
  };
}

/**
 * LW5: A DOCK FROM THE HARBOUR - a port with no Ship building (most: Daggerfall stands no piers) has its dock where its
 * streets meet the water nearest its harbour's berth (`x`, `z` the berth, the location's frame): the street cell nearest
 * it, facing it. Null where no street lies within HARBOUR_RING.
 * @param {{ width: number, height: number }} nav @param {{ net: Int32Array, netId: number }} places @param {number} x @param {number} z
 * @returns {Spot|null}
 */
export function harbourDock(nav, places, x, z) {
  const c = nearestNetCell(nav, places.net, places.netId, x, z, HARBOUR_RING);
  if (!c) return null;
  const [cx, cz] = centre(c);
  return { key: 'dharbour', kind: 'dock', cell: c, x: cx, z: cz, yaw: yawTo(cx, cz, x, z) };
}

/**
 * The town's places.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 * @param {readonly { key: number, x: number, z: number, nx: number, nz: number }[]} doors - location frame; the normal
 *   points out of the building
 * @param {readonly { key: number, type: number, factionId?: number }[]} buildings
 * @returns {Places}
 */
export function townPlaces(nav, doors, buildings) {
  const W = nav.width, H = nav.height;
  const types = new Map((buildings ?? []).map((b) => [b.key, b.type]));
  const factions = new Map((buildings ?? []).map((b) => [b.key, b.factionId ?? 0]));
  const ordered = [...(doors ?? [])].filter((d) => Number.isFinite(d.x) && Number.isFinite(d.z)).sort((a, b) => a.key - b.key || a.x - b.x || a.z - b.z);
  const streets = streetNet(nav);
  const net = streets.label, netId = doorsNet(nav, ordered, streets);   // FIELD 2026-10-06: the street its doors open onto
  /** @type {Map<number, Spot>} */
  const doorSpots = new Map();
  /** @type {Map<number, { x: number, z: number, nx: number, nz: number }>} */
  const doorOf = new Map();
  for (const d of ordered) {
    if (doorSpots.has(d.key)) continue;
    const at = doorCell(nav, d, (i) => net[i] === netId);
    if (!at) continue;
    const [x, z] = centre(at.cell);
    doorSpots.set(d.key, { key: `d${d.key}`, kind: 'door', cell: at.cell, x, z, yaw: yawTo(x, z, d.x, d.z), building: d.key });
    doorOf.set(d.key, { x: d.x, z: d.z, nx: at.nx, nz: at.nz });
  }
  /** A spot `out` cells before a building's door, on the net (else the door's own cell). */
  const before = (key, out, kind) => {
    const door = doorSpots.get(key), d = doorOf.get(key);
    if (!door || !d) return null;
    const c = nearestNetCell(nav, net, netId, door.x + d.nx * out * NAV_CELL, door.z + d.nz * out * NAV_CELL, 2) ?? door.cell;
    const [x, z] = centre(c);
    return /** @type {Spot} */ ({ key: `${kind[0]}${key}`, kind, cell: c, x, z, yaw: yawTo(x, z, door.x, door.z), building: key });
  };
  const social = [], market = [], dock = [];
  for (const key of [...doorSpots.keys()].sort((a, b) => a - b)) {
    const t = types.get(key);
    if (SOCIAL_TYPES.has(t)) { const s = before(key, SOCIAL_OUT, 'social'); if (s) social.push(s); }
    else if (hasShopJob(t)) { const s = before(key, MARKET_OUT, 'market'); if (s) market.push(s); }
    else if (t === BUILDING_TYPES.Ship) { const s = before(key, MARKET_OUT, 'dock'); if (s) dock.push(s); }
  }
  // the square: the most open net cell near the middle (the walkable cells in its window), sampled on a stride.
  // LW-PERF: each window's count off the net's running sums (one pass), not counted cell by cell
  const W1 = W + 1, sums = new Int32Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) { row += net[y * W + x] === netId ? 1 : 0; sums[(y + 1) * W1 + x + 1] = sums[y * W1 + x + 1] + row; }
  }
  const openIn = (x0, y0, x1, y1) => sums[(y1 + 1) * W1 + x1 + 1] - sums[y0 * W1 + x1 + 1] - sums[(y1 + 1) * W1 + x0] + sums[y0 * W1 + x0];
  let square = null, bestOpen = -1, bestD = Infinity;
  const mx = W / 2, my = H / 2, reach = Math.max(W, H) * 0.35;
  for (let y = SQUARE_WINDOW; y < H - SQUARE_WINDOW; y += SQUARE_STRIDE) {
    for (let x = SQUARE_WINDOW; x < W - SQUARE_WINDOW; x += SQUARE_STRIDE) {
      if (net[y * W + x] !== netId) continue;
      const d = Math.hypot(x - mx, y - my);
      if (d > reach) continue;
      const open = openIn(x - SQUARE_WINDOW, y - SQUARE_WINDOW, x + SQUARE_WINDOW, y + SQUARE_WINDOW);
      if (open > bestOpen || (open === bestOpen && d < bestD)) { bestOpen = open; bestD = d; square = [x, y]; }
    }
  }
  /** @type {Spot|null} */
  let squareSpot = null;
  /** @type {Spot[]} */
  const squares = [];
  if (square) {
    const [x, z] = centre(square);
    squareSpot = { key: 'sq', kind: 'square', cell: square, x, z, yaw: 0 };
    social.unshift(squareSpot);
    squares.push(squareSpot);
    // LW-SPREAD: THE SQUARE'S POINTS - the most open cells about it (the same window), SQUARE_GAP apart and seen from it
    // over the street, the nearer first on a tie: where the square's people gather, each to their own. The square was
    // one point, and a town's every stall and a third of its evening stood about it (Bubyrydata at six: sixty-four)
    const [sx, sy] = square;
    /** @type {{ x: number, y: number, open: number, d: number }[]} */
    const near = [];
    for (let y = Math.max(SQUARE_WINDOW, sy - SQUARE_REACH); y <= Math.min(H - 1 - SQUARE_WINDOW, sy + SQUARE_REACH); y++) {
      for (let cx = Math.max(SQUARE_WINDOW, sx - SQUARE_REACH); cx <= Math.min(W - 1 - SQUARE_WINDOW, sx + SQUARE_REACH); cx++) {
        const d = Math.hypot(cx - sx, y - sy);
        if (d > SQUARE_REACH || net[y * W + cx] !== netId) continue;
        const open = openIn(cx - SQUARE_WINDOW, y - SQUARE_WINDOW, cx + SQUARE_WINDOW, y + SQUARE_WINDOW);
        if (open >= SQUARE_OPEN * bestOpen) near.push({ x: cx, y, open, d });
      }
    }
    near.sort((a, b) => b.open - a.open || a.d - b.d || a.y - b.y || a.x - b.x);
    for (const c of near) {
      if (squares.length >= SQUARE_POINTS) break;
      if (squares.some((s) => Math.hypot(s.cell[0] - c.x, s.cell[1] - c.y) < SQUARE_GAP)) continue;
      if (!netLine(net, netId, W, square, [c.x, c.y])) continue;
      const [px, pz] = centre([c.x, c.y]);
      squares.push({ key: `sq${squares.length}`, kind: 'square', cell: [c.x, c.y], x: px, z: pz, yaw: 0 });
    }
  }
  // LW-SPREAD: THE TOWN'S CORNERS - each block's most open street cell inside its margin (the first in the grid's order on
  // a tie), as open as CORNER_OPEN of the square; then, the most open first, each CORNER_GAP from every social spot, every
  // point of the square and every corner taken - where a neighbourhood gathers
  /** @type {Spot[]} */
  const corners = [];
  if (square) {
    /** @type {{ x: number, y: number, open: number, bx: number, by: number }[]} */
    const best = [];
    for (let by = 0; by * BLOCK_CELLS < H; by++) {
      for (let bx = 0; bx * BLOCK_CELLS < W; bx++) {
        let top = null;
        for (let y = Math.max(SQUARE_WINDOW, by * BLOCK_CELLS + CORNER_MARGIN); y < Math.min(H - SQUARE_WINDOW, (by + 1) * BLOCK_CELLS - CORNER_MARGIN); y++) {
          for (let x = Math.max(SQUARE_WINDOW, bx * BLOCK_CELLS + CORNER_MARGIN); x < Math.min(W - SQUARE_WINDOW, (bx + 1) * BLOCK_CELLS - CORNER_MARGIN); x++) {
            if (net[y * W + x] !== netId) continue;
            const open = openIn(x - SQUARE_WINDOW, y - SQUARE_WINDOW, x + SQUARE_WINDOW, y + SQUARE_WINDOW);
            if (!top || open > top.open) top = { x, y, open, bx, by };
          }
        }
        if (top && top.open >= CORNER_OPEN * bestOpen) best.push(top);
      }
    }
    best.sort((a, b) => b.open - a.open || a.by - b.by || a.bx - b.bx);
    const taken = [...social, ...squares].map((s) => s.cell);
    for (const c of best) {
      if (taken.some((t) => Math.hypot(t[0] - c.x, t[1] - c.y) < CORNER_GAP)) continue;
      const [px, pz] = centre([c.x, c.y]);
      corners.push({ key: `c${c.bx}.${c.by}`, kind: 'corner', cell: [c.x, c.y], x: px, z: pz, yaw: 0 });
      taken.push([c.x, c.y]);
    }
  }
  // the exits: per side, the net cell nearest that edge (ties to the side's middle, then the first in the grid's order).
  // LW-PERF: each side read in from its edge, a row or a column at a time, to the first that holds the net - never the
  // whole grid four times
  const SIDES = /** @type {const} */ (['n', 's', 'e', 'w']);
  /** The cell of line `i` (a row for n and s, a column for e and w) at `j` along it. @param {number} k @param {number} i @param {number} j */
  const cellOf = (k, i, j) => (k < 2 ? [j, i] : [i, j]);
  const exits = [];
  for (let k = 0; k < 4; k++) {
    const side = SIDES[k];
    const lines = k < 2 ? H : W, along = k < 2 ? W : H, half = k < 2 ? W / 2 : H / 2;
    let best = null;
    for (let n = 0; n < lines && !best; n++) {
      const i = k === 0 ? H - 1 - n : k === 1 ? n : k === 2 ? W - 1 - n : n;
      let bestMid = Infinity;
      for (let j = 0; j < along; j++) {
        const [x, y] = cellOf(k, i, j);
        if (net[y * W + x] !== netId) continue;
        const mid = Math.abs(j - half);
        if (mid < bestMid) { bestMid = mid; best = [x, y]; }
      }
    }
    if (!best) continue;
    const [x, z] = centre(best);
    const yaw = side === 'n' ? 0 : side === 's' ? Math.PI : side === 'e' ? Math.PI / 2 : -Math.PI / 2;
    exits.push(/** @type {Spot} */ ({ key: `x${side}`, kind: 'exit', cell: best, x, z, yaw, side }));
  }
  return { doors: doorSpots, square: squareSpot, squares, corners, social, market, dock, exits, types, factions, net, netId };
}

/** LW-SPREAD: whether every cell the straight line from cell `a` to cell `b` crosses (their middles, sampled a quarter
 *  cell apart) is on the street net - the square's points seen from it over open street.
 *  @param {Int32Array} net @param {number} netId @param {number} W @param {number[]} a @param {number[]} b */
function netLine(net, netId, W, a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4));
  for (let i = 0; i <= n; i++) {
    const x = Math.floor(a[0] + 0.5 + ((b[0] - a[0]) * i) / n), y = Math.floor(a[1] + 0.5 + ((b[1] - a[1]) * i) / n);
    if (net[y * W + x] !== netId) return false;
  }
  return true;
}

/** The exit facing a direction (a world yaw out of town: 0 north, +PI/2 east). @param {Places} places @param {number} yaw */
export function exitToward(places, yaw) {
  let best = null, bestD = Infinity;
  for (const e of places.exits) {
    const d = Math.abs(Math.atan2(Math.sin(e.yaw - yaw), Math.cos(e.yaw - yaw)));
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** The exit nearest a cell. @param {Places} places @param {number[]} cell */
export function exitNearest(places, cell) {
  let best = null, bestD = Infinity;
  for (const e of places.exits) {
    const d = Math.abs(e.cell[0] - cell[0]) + Math.abs(e.cell[1] - cell[1]);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
