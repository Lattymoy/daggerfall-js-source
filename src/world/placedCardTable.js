// @ts-check
// TAVERN-TABLE (2026-10-08, the owner: "Lets instead place a specific table in each inn. A new property specifficaly used
// for the card table"): WHERE A TAVERN'S CARD TABLE STANDS - pure, DOM-free. Every tavern stands the card table's own prop
// (world/cardTableProp.js); this finds its floor, and the host (scenes/interiorContext.js, asked by scenes/worldModes.js
// for a tavern) stands it there - one of the room's `tables`, its seats round its own box through the host's probe.
//
// THE SPOT IS FOUND, not guessed: the room's own floor is walked from its entrance on a grid (PLACE_CELL), a cell walkable
// where the floor under it is the entrance's storey and a body's height above it is clear; the spot is the walkable
// cell NEAREST the entrance by that walk, at least PLACE_FROM_DOOR_M in (counted in the walk's own steps), whose table
// AND a ring round it a seated body needs (PLACE_RING_M) are all walkable and clear of the room's doors, people, flats
// and markers - the table along x there, else turned a quarter (AUDIT TAVERN-TABLE M4: a hall the table fits only
// across stood none). Nearest by the walk, not the crow: a closed door stops it, so the table stands in the room the
// player walks into, never behind a wall. It stands on the highest floor under its own top (AUDIT TAVERN-TABLE L3: on
// the entrance's, a table past a doorstep floated by the step).
//
// EVERY CLIENT THE SAME TABLE (AUDIT TAVERN-TABLE M3). The walk's order is fixed and its avoid list is the record's,
// but its probes run in each client's own world frame - the streamer's compensation shifts a building by however far
// that player has travelled, and every placement there is rounded to float32 - so a probe exactly on one of its
// thresholds could fall either way on two clients, and a table stood 6 m from where the other saw it. Daggerfall's
// geometry stands on a 1/40 m lattice, so the walk stands off it: its grid PLACE_GRID_OFF from the lattice (an eighth
// and a sixteenth of a unit, so no cell lies on a lattice line or a diagonal), and every threshold half a unit off it
// (the storey's slack, the body's radius, the probe's height) - no probe of a lattice room meets a tie. The frame's
// rounding (a tenth of a millimetre at most) is far short of the margins left: nine millimetres from the body's
// radius to a face, twelve from the slack to a storey or the probe's height to a surface. Only a lattice CORNER can
// come nearer the radius (two hundredths of a millimetre at the closest), a chance a room has to stand exactly so.

import { SEAT_OUT } from '../player/seatPose.js';
import { trs, transformPoint } from './mat4.js';

/** TAVERN-TABLES (2026-10-09, bible/11-Multiplayer/Tavern-Cards.md section 30): the card tables a tavern stands, each
 *  found by this walk with the ones before it stood - the chips table, then the gold one (net/holdemTable.js
 *  HOLDEM_GOLD_TABLE is its index; a pin holds the two alike). */
export const TAVERN_CARD_TABLES = 2;
/** The walk's cell (metres). */
export const PLACE_CELL = 0.5;
/** The grid's x and z off Daggerfall's 1/40 m lattice: an eighth and a sixteenth of a unit (metres). */
export const PLACE_GRID_OFF = Object.freeze([1 / 320, 1 / 640]);
/** How far from the entrance the walk looks (metres, each way). */
export const PLACE_REACH_M = 16;
/** The nearest to the entrance, by the walk's own steps, the table may stand - the threshold stays clear (metres). */
export const PLACE_FROM_DOOR_M = 3;
/** The clear floor round the table's edge: the seat's distance out and a seated body behind it (metres). */
export const PLACE_RING_M = SEAT_OUT + 0.4;
/** A body's radius (half a unit off the lattice), and the two heights above the floor it must be clear at (the knees'
 *  and the head's). */
export const PLACE_BODY_R = 0.2875;
export const PLACE_CLEAR_HEIGHTS = Object.freeze([0.6, 1.5]);
/** How far the floor under a cell may sit from the entrance's and still be its storey (a sill, a rug's model) - half a
 *  unit off the lattice. */
export const PLACE_STOREY_SLACK = 0.2125;
/** The height above the floor a cell's floor is looked for from - a head's: whatever stands under it (a bench, the
 *  bar's counter, a chair) is met first and is no floor. Half a unit off the lattice. */
export const PLACE_PROBE_M = 1.9125;
/** A door, a person, a flat or a marker further than this above or below the entrance's floor is on another storey. */
export const PLACE_AVOID_DY = 2.5;

/**
 * Where a table of `box` (its model's own box, `{min, max}`) stands, in the room's own frame: `{ x, y, z, yawDeg }` the
 * model's translation (its lowest point on the floor under it) and its turn about the vertical (0, or 90 when only
 * across does it fit), `{ cx, cz }` its footprint's middle, `{ hx, hz }` its ring's half-extents along the room's x and z
 * (the table's, turned, and PLACE_RING_M round it) - or null when the room has no such floor. `start` is the
 * entrance ([x, y, z], an enter marker), `probe.floor(x, y, z)` the floor's height straight down from a point (null for
 * none within reach), `probe.open(x, y, z, r)` whether nothing of the room is within `r` of a point. `avoid` is
 * `[x, y, z, r]` the table and its ring keep `r` clear of (doors, people, flats, markers) on the entrance's storey
 * (PLACE_AVOID_DY) - or `[x, y, z, rx, rz]`, clear of a box of those half-extents (TAVERN-TABLES: a table already
 * stood, and its ring - the second keeps its own ring off the first's).
 * @param {{min: readonly number[], max: readonly number[]}} box
 * @param {number[]} start
 * @param {{floor: (x: number, y: number, z: number) => number|null, open: (x: number, y: number, z: number, r: number) => boolean}} probe
 * @param {number[][]} [avoid]
 */
export function placedTableSpot(box, start, probe, avoid = []) {
  const sx = start[0] + PLACE_GRID_OFF[0], sz = start[2] + PLACE_GRID_OFF[1];
  const floor0 = probe.floor(sx, start[1] + 1, sz);
  if (floor0 == null) return null;   // (a NaN floor walks no cell: every storey test fails it)
  const n = Math.round(PLACE_REACH_M / PLACE_CELL);
  const side = 2 * n + 1;
  const at = (i) => (i - n) * PLACE_CELL;   // a cell's offset from the entrance
  const walk = new Int8Array(side * side);   // 0 unasked, 1 walkable, -1 not
  const floorOf = new Float64Array(side * side);   // a walkable cell's own floor
  const walkable = (i, k) => {
    if (i < 0 || k < 0 || i >= side || k >= side) return false;
    const c = k * side + i;
    if (!walk[c]) {
      const x = sx + at(i), z = sz + at(k);
      const fy = probe.floor(x, floor0 + PLACE_PROBE_M, z);
      const ok = fy != null && Math.abs(fy - floor0) <= PLACE_STOREY_SLACK
        && PLACE_CLEAR_HEIGHTS.every((h) => probe.open(x, floor0 + h, z, PLACE_BODY_R));
      walk[c] = ok ? 1 : -1;
      if (ok) floorOf[c] = fy;
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
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  // the two ways it may stand: its half-extents along x and z, the ring's and the top's
  const ways = [0, 90].map((yawDeg) => {
    const [ax, az] = yawDeg ? [(z1 - z0) / 2, (x1 - x0) / 2] : [(x1 - x0) / 2, (z1 - z0) / 2];
    const hx = ax + PLACE_RING_M, hz = az + PLACE_RING_M;
    // AUDIT TAVERN-TABLE M4: the cells out to where their own clear radius reaches the ring's edge - no further (a
    // cell a step past it asked half a metre of floor the ring never needs)
    const ri = Math.max(0, Math.ceil((hx - PLACE_BODY_R) / PLACE_CELL)), rk = Math.max(0, Math.ceil((hz - PLACE_BODY_R) / PLACE_CELL));
    const ti = Math.floor(ax / PLACE_CELL), tk = Math.floor(az / PLACE_CELL);   // the cells under its top
    const m = transformPoint(trs(0, 0, 0, 0, yawDeg, 0), mid[0], 0, mid[1]);   // its middle, turned with it
    return { yawDeg, hx, hz, ri, rk, ti, tk, mx: m[0], mz: m[2] };
  });
  const near = avoid.filter((a) => Math.abs(a[1] - floor0) <= PLACE_AVOID_DY);
  const fromDoor = Math.ceil(PLACE_FROM_DOOR_M / PLACE_CELL);
  for (const c of order) {
    if (dist[c] < fromDoor) continue;
    const i = c % side, k = (c - i) / side;
    const cx = sx + at(i), cz = sz + at(k);
    for (const w of ways) {
      let ok = true;   // every cell the table and its ring cover, walked to
      for (let dk = -w.rk; dk <= w.rk && ok; dk++) for (let di = -w.ri; di <= w.ri && ok; di++) {
        if (i + di < 0 || k + dk < 0 || i + di >= side || k + dk >= side || dist[(k + dk) * side + (i + di)] < 0) ok = false;
      }
      if (!ok) continue;
      if (near.some(([ax, , az, r, rz = r]) => Math.abs(ax - cx) < w.hx + r && Math.abs(az - cz) < w.hz + rz)) continue;
      let fy = -Infinity;   // the highest floor under its top
      for (let dk = -w.tk; dk <= w.tk; dk++) for (let di = -w.ti; di <= w.ti; di++) fy = Math.max(fy, floorOf[(k + dk) * side + (i + di)]);
      return { x: cx - w.mx, y: fy - y0, z: cz - w.mz, yawDeg: w.yawDeg, cx, cz, hx: w.hx, hz: w.hz };
    }
  }
  return null;
}
