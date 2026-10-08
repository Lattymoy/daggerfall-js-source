// @ts-check
// GOTHWAY-TABLE (2026-10-08, the owner: "Put a table in gothway tavern"): A CARD TABLE STOOD WHERE THE ROOM HAS NONE -
// pure, DOM-free. Tavern-Cards.md section 2 finds the tables Daggerfall already put in a tavern, and only one table model
// is nameable (world/cardTables.js CARD_TABLE_MODELS - the rest wait on the census), so Gothway Garden - the first town out of
// Privateer's Hold - may stand none. This finds the floor for one: the host (scenes/interiorContext.js, asked by
// scenes/worldModes.js for a tavern in Gothway Garden) stands that one table model there, and from then on it is a card
// table like any other - the same `tables` row, its seats round its own box through the same probe.
//
// THE SPOT IS FOUND, not guessed: the room's own floor is walked from its entrance on a grid (PLACE_CELL), a cell walkable
// where the floor under it is the entrance's storey and a body's height above it is clear; the spot is the walkable
// cell NEAREST the entrance by that walk, at least PLACE_FROM_DOOR_M in, whose table AND a ring round it a seated body
// needs (PLACE_RING_M) are all walkable and clear of the room's doors, people, flats and markers. Nearest by the walk,
// not the crow: a closed door stops it, so the table stands in the room the player walks into, never behind a wall. The
// walk's order is fixed, so every client stands the same table in the same place (the relay keys a table by its index).

import { CARD_TABLE_MODELS } from './cardTables.js';
import { SEAT_OUT } from '../player/seatPose.js';

/** The table it stands: the one model the tree names a table (cardTables.js). */
export const PLACED_CARD_TABLE_MODEL = [...CARD_TABLE_MODELS][0];
/** The walk's cell (metres). */
export const PLACE_CELL = 0.5;
/** How far from the entrance the walk looks (metres, each way). */
export const PLACE_REACH_M = 16;
/** The nearest to the entrance, by the walk, the table may stand - the threshold stays clear (metres). */
export const PLACE_FROM_DOOR_M = 3;
/** The clear floor round the table's edge: the seat's distance out and a seated body behind it (metres). */
export const PLACE_RING_M = SEAT_OUT + 0.45;
/** A body's radius, and the two heights above the floor it must be clear at (the knees' and the head's). */
export const PLACE_BODY_R = 0.3;
export const PLACE_CLEAR_HEIGHTS = Object.freeze([0.6, 1.5]);
/** How far the floor under a cell may sit from the entrance's and still be its storey (a sill, a rug's model). */
export const PLACE_STOREY_SLACK = 0.2;
/** The height above the floor a cell's floor is looked for from - a head's: whatever stands under it (a bench, the
 *  bar's counter, a chair) is met first and is no floor. */
export const PLACE_PROBE_M = 1.9;
/** A door, a person, a flat or a marker further than this above or below the entrance's floor is on another storey. */
export const PLACE_AVOID_DY = 2.5;

/**
 * Where a table of `box` (its model's own box, `{min, max}`) stands, in the room's own frame: `{ x, y, z }` the model's
 * translation (its lowest point on the floor), `{ cx, cz }` its footprint's middle - or null when the room has no such
 * floor. `start` is the entrance ([x, y, z], an enter marker), `probe.floor(x, y, z)` the floor's height straight down
 * from a point (null for none within reach), `probe.open(x, y, z, r)` whether nothing of the room is within `r` of a
 * point. `avoid` is `[x, y, z, r]` the table and its ring keep `r` clear of (doors, people, flats, markers) on the
 * entrance's storey (PLACE_AVOID_DY).
 * @param {{min: number[], max: number[]}} box
 * @param {number[]} start
 * @param {{floor: (x: number, y: number, z: number) => number|null, open: (x: number, y: number, z: number, r: number) => boolean}} probe
 * @param {number[][]} [avoid]
 */
export function placedTableSpot(box, start, probe, avoid = []) {
  const floor0 = probe.floor(start[0], start[1] + 1, start[2]);
  if (floor0 == null) return null;   // (a NaN floor walks no cell: every storey test fails it)
  const n = Math.round(PLACE_REACH_M / PLACE_CELL);
  const side = 2 * n + 1;
  const at = (i) => (i - n) * PLACE_CELL;   // a cell's offset from the entrance
  const walk = new Int8Array(side * side);   // 0 unasked, 1 walkable, -1 not
  const walkable = (i, k) => {
    if (i < 0 || k < 0 || i >= side || k >= side) return false;
    const c = k * side + i;
    if (!walk[c]) {
      const x = start[0] + at(i), z = start[2] + at(k);
      const fy = probe.floor(x, floor0 + PLACE_PROBE_M, z);
      const ok = fy != null && Math.abs(fy - floor0) <= PLACE_STOREY_SLACK
        && PLACE_CLEAR_HEIGHTS.every((h) => probe.open(x, floor0 + h, z, PLACE_BODY_R));
      walk[c] = ok ? 1 : -1;
    }
    return walk[c] === 1;
  };
  // the walk's first cell: the entrance's own, or the nearest walkable one beside it (a marker at the door's frame)
  let first = -1;
  for (let r = 0; r <= 2 && first < 0; r++) {
    for (let dk = -r; dk <= r && first < 0; dk++) for (let di = -r; di <= r && first < 0; di++) {
      if (Math.max(Math.abs(di), Math.abs(dk)) !== r) continue;
      if (walkable(n + di, n + dk)) first = (n + dk) * side + (n + di);
    }
  }
  if (first < 0) return null;
  const dist = new Int32Array(side * side).fill(-1);
  dist[first] = 0;
  const order = [first];
  for (let q = 0; q < order.length; q++) {
    const c = order[q], i = c % side, k = (c - i) / side;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nk = k + dk;
      if (!walkable(ni, nk)) continue;
      const nc = nk * side + ni;
      if (dist[nc] >= 0) continue;
      dist[nc] = dist[c] + 1;
      order.push(nc);
    }
  }
  const [x0, y0, z0] = box.min, [x1, , z1] = box.max;
  const hx = (x1 - x0) / 2 + PLACE_RING_M, hz = (z1 - z0) / 2 + PLACE_RING_M;
  const ri = Math.ceil(hx / PLACE_CELL), rk = Math.ceil(hz / PLACE_CELL);
  const near = avoid.filter((a) => Math.abs(a[1] - floor0) <= PLACE_AVOID_DY);
  const fromDoor = Math.ceil(PLACE_FROM_DOOR_M / PLACE_CELL);
  for (const c of order) {
    if (dist[c] < fromDoor) continue;
    const i = c % side, k = (c - i) / side;
    const cx = start[0] + at(i), cz = start[2] + at(k);
    let ok = true;   // every cell the table and its ring cover, walked to (the cells' own clear radius past the ring's edge)
    for (let dk = -rk; dk <= rk && ok; dk++) for (let di = -ri; di <= ri && ok; di++) {
      if (i + di < 0 || k + dk < 0 || i + di >= side || k + dk >= side || dist[(k + dk) * side + (i + di)] < 0) ok = false;
    }
    if (!ok) continue;
    if (near.some(([ax, , az, r]) => Math.abs(ax - cx) < hx + r && Math.abs(az - cz) < hz + r)) continue;
    return { x: cx - (x0 + x1) / 2, y: floor0 - y0, z: cz - (z0 + z1) / 2, cx, cz };
  }
  return null;
}
