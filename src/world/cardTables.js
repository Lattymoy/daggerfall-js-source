// @ts-check
// CARDS2 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 2; Mac: "needing to be in a tavern and being set up in
// a sort of table enviroment"): THE CARD TABLE AND ITS SEATS - pure, DOM-free. Where a card table's seats stand, and the
// eye a seated player looks from. The host (scenes/worldModes.js) hands in the table's own box, its matrix and its world
// box, and a probe of its own collider; nothing here reads a mesh or the scene.
//
// THE TABLE IS ITS OWN PROP (TAVERN-TABLE, 2026-10-08; the owner: "a new property specifficaly used for the card
// table"): every tavern stands one (world/cardTableProp.js, its floor found by world/placedCardTable.js), and it is the
// tavern's one card table - Daggerfall's own tables are furniture.
//
// THE SEATS stand round the table's OWN box (its model's, turned by its matrix - AUDIT CARDS B6: a table turned off the
// square has a world box that bulges past it, and seats round the bulge sat in the air), on the floor it stands on:
// along each side as many as fit at SEAT_SPACING (one at least on a side as long as SEAT_SIDE_MIN), SEAT_OUT out from
// its edge (player/seatPose.js - the body's own distance), each sitting SQUARE to its side (AUDIT CARDS D3: a seat
// turned to the table's middle put one hand off the edge). A seat the host's probe calls blocked - a wall, a pillar,
// the bar between it and the table, or no floor under it - is not a seat. At most HOLDEM_SEATS_MAX seats, and a table
// that keeps fewer than HOLDEM_SEATS_MIN is no card table.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from '../net/cardLaw.js';
import { SEATED_EYE_HEIGHT, SEAT_OUT } from '../player/seatPose.js';   // CARDS2b: the seated eye is the seated body's head, and the sitter's distance from the edge the body's own
import { transformPoint } from './mat4.js';

/** MEASURE (CARDS2): a seat's width along the table's edge, in metres - a chair and an elbow either side. */
export const SEAT_SPACING = 0.75;
/** MEASURE (CARDS2): a side shorter than this seats nobody (a narrow table's end). */
export const SEAT_SIDE_MIN = 0.6;
/** How far below a seat's eye the probe looks for its floor before it calls the seat floorless. */
export const SEAT_FLOOR_PROBE = 2;
/** MEASURE (CARDS2): the highest a thing under a seat may stand and still be sat over - a chair's seat, a bench. */
export const SEAT_SURFACE_MAX = 0.55;
/** A seat with another player's seated feet within this of it, on the ground, is theirs (AUDIT CARDS B3). */
export const SEAT_TAKEN_RADIUS = 0.3;

/** Is what the probe met straight down from a seat's eye, `down` metres below it, something to sit over - the floor, a
 *  chair, a bench; not the air, not another table's top. */
export const seatFloorOk = (down) => down >= SEATED_EYE_HEIGHT - SEAT_SURFACE_MAX && down <= SEAT_FLOOR_PROBE;   // a miss (Infinity) and NaN fail both

/** The stick's throw that stands a seated player up, as a step would. */
export const SEAT_STICK_LEAVE = 0.3;
/** Does this frame's movement stand a seated player up: a move key, a jump (or any other press the host hands in - the
 *  autorun latch, a swing key), or the stick thrown. */
export const leavesSeat = (mv, jump) => !!(mv?.forwards || mv?.backwards || mv?.left || mv?.right || jump
  || (mv?.analog && Math.hypot(Number(mv.analog.x) || 0, Number(mv.analog.y) || 0) > SEAT_STICK_LEAVE));

/**
 * The heading from (x, z) toward (tx, tz), in the camera's own yaw - its forward is [sin(yaw), 0, cos(yaw)]
 * (worldModes.js frame's `fwd`).
 */
export const yawToward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/**
 * The seats a table's OWN box could hold, before the probe: `{lx, lz, nx, nz, side}` in the box's space - the seat's
 * point SEAT_OUT out from its side, and the side's inward normal - in a fixed order (the +x side, the -x side, the +z
 * side, the -z side, each from its low end), so the same table always numbers its seats the same.
 * @param {{min: readonly number[], max: readonly number[]}} box
 */
export function seatSpots(box) {
  const [x0, , z0] = box.min;
  const [x1, , z1] = box.max;
  const spots = [];
  const along = (len) => (len < SEAT_SIDE_MIN ? 0 : Math.max(1, Math.floor(len / SEAT_SPACING)));
  const sides = [
    { side: '+x', n: along(z1 - z0), at: (t) => [x1 + SEAT_OUT, z0 + t * (z1 - z0)], nx: -1, nz: 0 },
    { side: '-x', n: along(z1 - z0), at: (t) => [x0 - SEAT_OUT, z0 + t * (z1 - z0)], nx: 1, nz: 0 },
    { side: '+z', n: along(x1 - x0), at: (t) => [x0 + t * (x1 - x0), z1 + SEAT_OUT], nx: 0, nz: -1 },
    { side: '-z', n: along(x1 - x0), at: (t) => [x0 + t * (x1 - x0), z0 - SEAT_OUT], nx: 0, nz: 1 },
  ];
  for (const s of sides) for (let k = 0; k < s.n; k++) {
    const [lx, lz] = s.at((k + 0.5) / s.n);
    spots.push({ lx, lz, nx: s.nx, nz: s.nz, side: s.side });
  }
  return spots;
}

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * A table's seats: its spots the probe keeps, each `{x, z, floorY, side, feet, top, eye, yaw, pitch}` - the feet the
 * sitter's body stands at, the table's top above them, the eye a seated player looks from, the yaw square to its side
 * and the pitch down at the table's middle. At most HOLDEM_SEATS_MAX, taken round the table in seatSpots' order so the
 * kept ones spread over the sides; empty when fewer than HOLDEM_SEATS_MIN are kept - a table two cannot sit at is no
 * card table. `table` is `{aabb, box?, matrix?}`: the world box (its floor and its top), the model's own box and its
 * matrix (without them, the world box with no turn). `clear(from, to)` is the host's probe: true when nothing stands
 * between the table's middle and the seat's eye and the seat has a floor.
 * @param {{aabb: {min: number[], max: number[]}, box?: {min: number[], max: number[]}, matrix?: ArrayLike<number>}} table
 * @param {(from: number[], to: number[]) => boolean} clear
 */
export function cardTableSeats(table, clear) {
  const { aabb } = table;
  const box = table.box ?? aabb;
  const m = table.matrix ?? IDENTITY;
  const floorY = aabb.min[1], topY = aabb.max[1];
  const midL = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const midW = transformPoint(m, midL[0], midL[1], midL[2]);
  const kept = [];
  for (const s of seatSpots(box)) {
    const p = transformPoint(m, s.lx, midL[1], s.lz);
    const q = transformPoint(m, s.lx + s.nx, midL[1], s.lz + s.nz);   // a metre in, along the side's inward normal
    const eye = [p[0], floorY + SEATED_EYE_HEIGHT, p[2]];
    if (!clear([midW[0], eye[1], midW[2]], eye)) continue;
    kept.push({
      x: p[0], z: p[2], floorY, side: s.side,
      feet: [p[0], floorY, p[2]], top: topY - floorY, eye,
      yaw: yawToward(p[0], p[2], q[0], q[2]),
      pitch: Math.atan2(topY - eye[1], Math.hypot(midW[0] - eye[0], midW[2] - eye[2])),
    });
  }
  if (kept.length < HOLDEM_SEATS_MIN) return [];
  if (kept.length <= HOLDEM_SEATS_MAX) return kept;
  // Too many: take them round the sides in turn, so a long table's six are not all on one edge.
  const bySide = new Map();
  for (const s of kept) { if (!bySide.has(s.side)) bySide.set(s.side, []); bySide.get(s.side).push(s); }
  const queues = [...bySide.values()];
  const out = [];
  for (let k = 0; out.length < HOLDEM_SEATS_MAX; k++) for (const q of queues) if (q[k] && out.length < HOLDEM_SEATS_MAX) out.push(q[k]);
  return kept.filter((s) => out.includes(s));
}

/**
 * CARDS3: the table's own frame - `{centre, axisYaw, halfLong, halfShort}`: the middle of its top (world), the yaw its
 * long side runs along (the camera's yaw law), and half its length and breadth - from its own box turned by its matrix
 * (cardTableSeats' table), so the board lies along a turned table too.
 * @param {{aabb: {min: number[], max: number[]}, box?: {min: number[], max: number[]}, matrix?: ArrayLike<number>}} table
 */
export function tableFrame(table) {
  const box = table.box ?? table.aabb, m = table.matrix ?? IDENTITY;
  const mid = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const lx = box.max[0] - box.min[0], lz = box.max[2] - box.min[2];
  const c = transformPoint(m, mid[0], mid[1], mid[2]);
  const along = lx >= lz ? transformPoint(m, mid[0] + 1, mid[1], mid[2]) : transformPoint(m, mid[0], mid[1], mid[2] + 1);
  return { centre: [c[0], table.aabb.max[1], c[2]], axisYaw: yawToward(c[0], c[2], along[0], along[2]), halfLong: Math.max(lx, lz) / 2, halfShort: Math.min(lx, lz) / 2 };
}

/**
 * The seats other players already sit in: the indices of `seats` with one of `feet` (their seated feet, in the same
 * space) within SEAT_TAKEN_RADIUS on the ground.
 * @param {{x: number, z: number}[]} seats
 * @param {number[][]} feet
 */
export const takenSeats = (seats, feet) => seats.flatMap((s, i) => (feet.some((f) => Math.hypot(f[0] - s.x, f[2] - s.z) <= SEAT_TAKEN_RADIUS) ? [i] : []));

/**
 * The seat a player standing at (x, z) takes: the nearest of the table's seats not in `taken` (indices), or -1.
 * @param {{x: number, z: number}[]} seats
 * @param {number} x
 * @param {number} z
 * @param {Iterable<number>} [taken]
 */
export function nearestFreeSeat(seats, x, z, taken = []) {
  const busy = new Set(taken);
  let best = -1, bestD = Infinity;
  seats.forEach((s, i) => {
    if (busy.has(i)) return;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) { best = i; bestD = d; }
  });
  return best;
}
