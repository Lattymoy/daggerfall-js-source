// @ts-check
// CARDS2 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 2; Mac: "needing to be in a tavern and being set up in
// a sort of table enviroment"): THE CARD TABLE AND ITS SEATS - pure, DOM-free. Which of a tavern's own pieces is a card
// table, where its seats stand, and the eye a seated player looks from. The host (scenes/worldModes.js) hands in the
// table's world box and a probe of its own collider; nothing here reads a mesh or the scene.
//
// THE TABLES ARE DAGGERFALL'S. No placed prop and no new mesh: a card table is a table model a tavern already stands.
// FLAGGED: CARD_TABLE_MODELS holds the one ARCH3D id this tree can name as a table - 41130, "Table" in the vendored World of Daggerfall's model list (vendor/world-of-daggerfall/Scripts/LocationHelper.cs, its {"41130", "Table"} row). The tavern blocks' other tables are unmeasured: the container carries no ARENA2, and `node tools/cardTableCensus.mjs <arena2>` lists every furniture model the tavern interiors stand, with its count and its size, for Mac's eye.
//
// THE SEATS stand round the table's box, on the floor it stands on: along each side as many as fit at SEAT_SPACING
// (one at least on a side as long as SEAT_SIDE_MIN), SEAT_OUT out from its edge, each facing the table's middle. A seat
// the host's probe calls blocked - a wall, a pillar, the bar between it and the table, or no floor under it - is not a
// seat. At most HOLDEM_SEATS_MAX seats, and a table that keeps fewer than HOLDEM_SEATS_MIN is no card table.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from '../net/cardLaw.js';
import { SEATED_EYE_HEIGHT } from '../player/seatPose.js';   // CARDS2b: the seated eye is the seated body's head

/** The ARCH3D ids a card table may be (classic ids: the host maps a town mod's alias through classicModelIdOf first). */
export const CARD_TABLE_MODELS = Object.freeze(new Set([41130]));
export const isCardTableModel = (id) => CARD_TABLE_MODELS.has(id);

/** MEASURE (CARDS2): a seat's width along the table's edge, in metres - a chair and an elbow either side. */
export const SEAT_SPACING = 0.75;
/** MEASURE (CARDS2): a side shorter than this seats nobody (a narrow table's end). */
export const SEAT_SIDE_MIN = 0.6;
/** MEASURE (CARDS2): how far out from the table's edge a seat stands - where a chair's sitter's feet are. */
export const SEAT_OUT = 0.45;
/** How far below a seat's eye the probe looks for its floor before it calls the seat floorless. */
export const SEAT_FLOOR_PROBE = 2;
/** MEASURE (CARDS2): the highest a thing under a seat may stand and still be sat over - a chair's seat, a bench. */
export const SEAT_SURFACE_MAX = 0.55;

/** Is what the probe met straight down from a seat's eye, `down` metres below it, something to sit over - the floor, a
 *  chair, a bench; not the air, not another table's top. */
export const seatFloorOk = (down) => down >= SEATED_EYE_HEIGHT - SEAT_SURFACE_MAX && down <= SEAT_FLOOR_PROBE;   // a miss (Infinity) and NaN fail both

/** The stick's throw that stands a seated player up, as a step would. */
export const SEAT_STICK_LEAVE = 0.3;
/** Does this frame's movement stand a seated player up: a move key, a jump, or the stick thrown. */
export const leavesSeat = (mv, jump) => !!(mv?.forwards || mv?.backwards || mv?.left || mv?.right || jump
  || (mv?.analog && Math.hypot(Number(mv.analog.x) || 0, Number(mv.analog.y) || 0) > SEAT_STICK_LEAVE));

/**
 * The heading from (x, z) toward (tx, tz), in the camera's own yaw - its forward is [sin(yaw), 0, cos(yaw)]
 * (worldModes.js frame's `fwd`).
 */
export const yawToward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/**
 * The seats a table's world box could hold, before the probe: `{x, z, floorY, side}` in a fixed order - the +x side, the
 * -x side, the +z side, the -z side, each from its low end - so the same table always numbers its seats the same.
 * @param {{min: number[], max: number[]}} aabb
 */
export function seatSpots(aabb) {
  const [x0, y0, z0] = aabb.min;
  const [x1, , z1] = aabb.max;
  const spots = [];
  const along = (len) => (len < SEAT_SIDE_MIN ? 0 : Math.max(1, Math.floor(len / SEAT_SPACING)));
  const sides = [
    { side: '+x', n: along(z1 - z0), at: (t) => [x1 + SEAT_OUT, z0 + t * (z1 - z0)] },
    { side: '-x', n: along(z1 - z0), at: (t) => [x0 - SEAT_OUT, z0 + t * (z1 - z0)] },
    { side: '+z', n: along(x1 - x0), at: (t) => [x0 + t * (x1 - x0), z1 + SEAT_OUT] },
    { side: '-z', n: along(x1 - x0), at: (t) => [x0 + t * (x1 - x0), z0 - SEAT_OUT] },
  ];
  for (const s of sides) for (let k = 0; k < s.n; k++) {
    const [x, z] = s.at((k + 0.5) / s.n);
    spots.push({ x, z, floorY: y0, side: s.side });
  }
  return spots;
}

/**
 * A table's seats: its spots the probe keeps, each with the eye a seated player looks from and the yaw and pitch that
 * look at the table's middle - at most HOLDEM_SEATS_MAX, taken round the table in seatSpots' order so the kept ones
 * spread over the sides. Empty when fewer than HOLDEM_SEATS_MIN are kept: a table two cannot sit at is no card table.
 * `clear(from, to)` is the host's probe: true when nothing stands between the table's middle and the seat's eye and
 * the seat has a floor.
 * @param {{min: number[], max: number[]}} aabb
 * @param {(from: number[], to: number[]) => boolean} clear
 */
export function cardTableSeats(aabb, clear) {
  const mid = [(aabb.min[0] + aabb.max[0]) / 2, aabb.max[1], (aabb.min[2] + aabb.max[2]) / 2];
  const kept = [];
  for (const s of seatSpots(aabb)) {
    const eye = [s.x, s.floorY + SEATED_EYE_HEIGHT, s.z];
    if (!clear([mid[0], eye[1], mid[2]], eye)) continue;
    const dx = mid[0] - eye[0], dz = mid[2] - eye[2];
    kept.push({ ...s, eye, feet: [s.x, s.floorY, s.z], top: mid[1] - s.floorY, yaw: yawToward(eye[0], eye[2], mid[0], mid[2]), pitch: Math.atan2(mid[1] - eye[1], Math.hypot(dx, dz)) });   // CARDS2b: the body's feet and the table's top above them
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
