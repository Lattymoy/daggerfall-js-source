// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE TOWN'S PLACES - where a resident can go, read off the town as
// it is built: its buildings' doors (the host hands each in the location frame with its outward normal), its navgrid
// (world/cityNavigation.js) and its buildings' types.
//
//  - A DOOR is the walkable cell just before it: out along the door's normal until the ground takes a foot (the other
//    way where the model's normal faces in - a footprint is never street), else the nearest walkable cell about it - and always on the town's one connected street net (the grid's largest walkable
//    component), so every door can be walked to from every other. A building whose doors stand off the net (a fenced
//    yard, a tower in the water) keeps none: its people stay in.
//  - THE SQUARE is the most open ground near the town's middle (the walkable cells about a cell, sampled on a stride).
//  - SOCIAL SPOTS stand a few paces before the taverns, temples, guild halls and the palace, and the square is one;
//    MARKET SPOTS before the shops; the DOCK is a Ship building's door where the town has one.
//  - THE EXITS are, for each side of the grid, the street-net cell nearest that edge: on the border itself in an open
//    town, at the gate in a walled one (the wall is a covered cell, the gate the street's only way through) - and where
//    the net reaches no edge at all, the farthest it reaches toward it.
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

/** The buildings before which a town gathers to talk. @type {Set<number>} */
const SOCIAL_TYPES = new Set([BUILDING_TYPES.Tavern, BUILDING_TYPES.Temple, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Palace]);

/**
 * @typedef {{ key: string, kind: 'door'|'social'|'square'|'market'|'dock'|'exit', cell: number[], x: number, z: number,
 *   yaw: number, building?: number, side?: 'n'|'s'|'e'|'w' }} Spot - `yaw` the way one faces standing there (a door: in
 *   toward it; a spot: toward its building; an exit: out of town)
 * @typedef {{ doors: Map<number, Spot>, square: Spot|null, social: Spot[], market: Spot[], dock: Spot[], exits: Spot[],
 *   types: Map<number, number>, net: Int32Array, netId: number }} Places
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
 * The street-net cell nearest a location-frame point within `ring` cells (Chebyshev rings outward, the nearest by
 * distance within the first ring holding one), or null.
 * @param {{ width: number, height: number }} nav @param {Int32Array} net @param {number} netId
 * @param {number} x @param {number} z @param {number} ring
 */
export function nearestNetCell(nav, net, netId, x, z, ring) {
  const W = nav.width, H = nav.height;
  const gx = Math.floor(x / NAV_CELL), gy = Math.floor(z / NAV_CELL);
  for (let r = 0; r <= ring; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = gx + dx, cy = gy + dy;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H || net[cy * W + cx] !== netId) continue;
        const d = Math.hypot(cx * NAV_CELL + HALF_CELL - x, cy * NAV_CELL + HALF_CELL - z);
        if (d < bestD) { bestD = d; best = [cx, cy]; }
      }
    }
    if (best) return best;
  }
  return null;
}

const centre = (c) => [c[0] * NAV_CELL + HALF_CELL, c[1] * NAV_CELL + HALF_CELL];
const yawTo = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz);

/** LW5: how far from a harbour's berth a town's dock is looked for (street cells - a berth lies off the shore, often
 *  eighty metres and more out, HARBOUR-BOOK's). */
export const HARBOUR_RING = 120;

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
 * @param {readonly { key: number, type: number }[]} buildings
 * @returns {Places}
 */
export function townPlaces(nav, doors, buildings) {
  const { label: net, id: netId } = streetNet(nav);
  const W = nav.width, H = nav.height;
  const types = new Map((buildings ?? []).map((b) => [b.key, b.type]));
  const onNet = (c) => c && c[0] >= 0 && c[1] >= 0 && c[0] < W && c[1] < H && net[c[1] * W + c[0]] === netId;
  /** @type {Map<number, Spot>} */
  const doorSpots = new Map();
  /** @type {Map<number, { x: number, z: number, nx: number, nz: number }>} */
  const doorOf = new Map();
  for (const d of [...(doors ?? [])].sort((a, b) => a.key - b.key || a.x - b.x || a.z - b.z)) {
    if (doorSpots.has(d.key) || !Number.isFinite(d.x) || !Number.isFinite(d.z)) continue;
    const nl = Math.hypot(d.nx, d.nz) || 1;
    let nx = d.nx / nl, nz = d.nz / nl;
    let cell = null;
    // out along the normal - and, a model's normal facing in (the building's footprint is no street), the other way
    for (const sign of [1, -1]) {
      for (const m of DOOR_REACH_M) {
        const c = [Math.floor((d.x + sign * nx * m) / NAV_CELL), Math.floor((d.z + sign * nz * m) / NAV_CELL)];
        if (onNet(c)) { cell = c; break; }
      }
      if (cell) { nx *= sign; nz *= sign; break; }
    }
    cell ??= nearestNetCell(nav, net, netId, d.x + nx * 1.6, d.z + nz * 1.6, DOOR_RING);
    if (!cell) continue;
    const [x, z] = centre(cell);
    doorSpots.set(d.key, { key: `d${d.key}`, kind: 'door', cell, x, z, yaw: yawTo(x, z, d.x, d.z), building: d.key });
    doorOf.set(d.key, { x: d.x, z: d.z, nx, nz });
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
  if (square) {
    const [x, z] = centre(square);
    squareSpot = { key: 'sq', kind: 'square', cell: square, x, z, yaw: 0 };
    social.unshift(squareSpot);
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
  return { doors: doorSpots, square: squareSpot, social, market, dock, exits, types, net, netId };
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
