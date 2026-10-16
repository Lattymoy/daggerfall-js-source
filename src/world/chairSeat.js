// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SIT1 (2026-10-14, Mac: "Implement the ability to interact and sit on chairs. Morrowind model should use the sitting
// animation we use for the card game"): A CHAIR, AND THE SEAT ON IT - which of a room's models are sat on, and where on
// one the sitter's body goes. Pure: the room's own probe is handed in (scenes/worldModes.js, the room's collider).
//
// THE CHAIRS: Daggerfall's own seats, by model id - the wooden chair (41100), the benches (41105, 41106 - the ones the
// colosseum's plazas stand, world/arena/arenaCity.js - and 43307) and the two thrones (41122, 41123) - the ones the vendored
// World of Daggerfall names (vendor/world-of-daggerfall/Scripts/LocationHelper.cs: "Wooden Chair", "Wooden Bench
// Simple", "Wooden Throne", "Wooden Throne 2", "Wooden Bench") and the arena's benches. Daggerfall has no seat
// activation of its own (DFU neither); this is the port's.
//
// THE SEAT (`chairSeatOf`): the chair's own box (its model's world box), and the room's probe straight down through it:
// - its SEAT is the first surface under the box's middle, probed down from the top of the seat's band (CHAIR_SEAT_MAX
//   over its floor, the box's foot - so a table's top over it is never taken for it), counted between CHAIR_SEAT_MIN and
//   CHAIR_SEAT_MAX; CHAIR_SEAT_DEFAULT over the floor where the probe meets nothing there;
// - its BACK is the side, along the chair's own four axes (its model's matrix), whose probe - down from over the box's
//   top, at CHAIR_BACK_REACHES of the way to that side, the highest kept (AUDIT FIVE-ASKS C4: a thin back, a tall
//   throne's) - stands CHAIR_BACK_RISE over the seat - the sitter faces away from it; a bench, a stool and a throne seen from its side have none, and the sitter
//   faces the axis nearest the way they came from;
// - the body is the card table's (player/seatPose.js seatRigInput - Morrowind has no sitting animation, so the seat is
//   posed on the skeleton by the climb rig's solver): its feet at the chair's middle on the floor (lowered to rest the
//   hips nearer the seat, never the ankles under the floor - the wagon bench's law, world/wagonModels.js driverSeatFor),
//   its hands on its knees (`top` CHAIR_LAP_TOP - the table the card seat lays them on, at the lap), its eye the seated
//   eye over its feet.
//
// Not a DFU member. Ledger A (SIT1).
// ═══════════════════════════════════════════════════════════════════

import { SEATED_EYE_HEIGHT, SEATED_HIP_HEIGHT, SEAT_ANKLE } from '../player/seatPose.js';

/** The models sat on, by id (see the header). */
export const CHAIR_MODELS = Object.freeze(new Set([41100, 41105, 41106, 41122, 41123, 43307]));
export const isChairModel = (modelId) => CHAIR_MODELS.has(modelId);
/** Which kind each is, for its name on the plaque. */
export const CHAIR_KIND = Object.freeze({ 41100: 'chair', 41105: 'bench', 41106: 'bench', 41122: 'throne', 41123: 'throne', 43307: 'bench' });

/** A seat's top over the chair's floor, metres: the probe's surface counts between these, and stands at the default
 *  where it finds none. */
export const CHAIR_SEAT_MIN = 0.2;
export const CHAIR_SEAT_MAX = 0.9;
export const CHAIR_SEAT_DEFAULT = 0.45;
/** A side whose probe stands this far over the seat is the chair's back. */
export const CHAIR_BACK_RISE = 0.25;
/** How far toward a side the back is probed for, of the box's half-width that way - the highest of the three kept. */
export const CHAIR_BACK_REACHES = Object.freeze([0.5, 0.75, 0.95]);
/** The hands' "table" over the feet (seatRigInput's `top`): the lap - the hips stand SEATED_HIP_HEIGHT over the feet, the
 *  hands SEAT_OUT + SEAT_HAND_ON before them, on the knees. */
export const CHAIR_LAP_TOP = 0.64;
/** How far over the band's top (the seat's probe) and the box's top (the back's) a probe starts, metres. */
export const CHAIR_PROBE_OVER = 0.05;
/** SIT1 (AUDIT FIVE-ASKS C6): the most a chair's floor may stand above or below the sitter's feet - a chair on a landing,
 *  a balcony or the floor below, within the ray's reach, is not sat on from here. */
export const CHAIR_FLOOR_STEP = 0.6;

/** SIT1 (AUDIT FIVE-ASKS C8): THE ROOM'S PROBE for a chair - over `collider` (player/collider.js: raycast(origin, dir, max)
 *  answers a distance, Infinity for a miss), the height of the first surface straight down through (x, z) from `fromY`
 *  to the chair's foot, or null. */
export const chairProbeOver = (collider, aabb) => (x, z, fromY) => {
  const len = fromY - aabb.min[1] + CHAIR_PROBE_OVER;
  const d = collider?.raycast?.([x, fromY, z], [0, -1, 0], len);
  return Number.isFinite(d) && d <= len ? fromY - d : null;
};

/**
 * THE SEAT ON A CHAIR: `{ feet, yaw, top, eye, pitch, seatY }`, or null for no box. `aabb` the chair's world box
 * (activate.js worldAabb's `{ min, max }`); `matrix` its model's (a column-major 4x4 - its local x and z columns are its
 * four sides); `probe(x, z, fromY)` the height of the first surface straight down through (x, z) from `fromY`, or null;
 * `from` where the sitter stands. Pure.
 * @param {{ min: number[], max: number[] }} aabb
 * @param {ArrayLike<number>} matrix
 * @param {(x: number, z: number, fromY: number) => (number|null)} probe
 * @param {ArrayLike<number>} from
 */
export function chairSeatOf(aabb, matrix, probe, from) {
  if (!aabb?.min || !aabb?.max) return null;
  const floorY = aabb.min[1];
  const cx = (aabb.min[0] + aabb.max[0]) / 2, cz = (aabb.min[2] + aabb.max[2]) / 2;
  const hx = (aabb.max[0] - aabb.min[0]) / 2, hz = (aabb.max[2] - aabb.min[2]) / 2;
  const h = probe(cx, cz, floorY + CHAIR_SEAT_MAX + CHAIR_PROBE_OVER);
  const rise = Number.isFinite(h) ? /** @type {number} */ (h) - floorY : NaN;
  const seatY = rise >= CHAIR_SEAT_MIN && rise <= CHAIR_SEAT_MAX ? /** @type {number} */ (h) : floorY + CHAIR_SEAT_DEFAULT;
  // the chair's four sides: its model's local x and z, flat and unit
  const unit = (x, z) => { const l = Math.hypot(x, z); return l > 1e-6 ? [x / l, z / l] : null; };
  const ax = unit(matrix?.[0] ?? 1, matrix?.[2] ?? 0) ?? [1, 0];
  const az = unit(matrix?.[8] ?? 0, matrix?.[10] ?? 1) ?? [0, 1];
  const sides = [ax, [-ax[0], -ax[1]], az, [-az[0], -az[1]]];
  let back = null, backH = seatY + CHAIR_BACK_RISE;
  const topY = aabb.max[1] + CHAIR_PROBE_OVER;
  for (const s of sides) {
    const half = Math.abs(s[0]) * hx + Math.abs(s[1]) * hz;
    for (const k of CHAIR_BACK_REACHES) {
      const y = probe(cx + s[0] * half * k, cz + s[1] * half * k, topY);
      if (Number.isFinite(y) && /** @type {number} */ (y) > backH) { backH = /** @type {number} */ (y); back = s; }
    }
  }
  let face;
  if (back) face = [-back[0], -back[1]];
  else {
    const to = unit((from?.[0] ?? cx) - cx, (from?.[2] ?? cz) - cz) ?? az;
    face = sides.reduce((best, s) => (s[0] * to[0] + s[1] * to[1] > best[0] * to[0] + best[1] * to[1] ? s : best), sides[0]);
  }
  const feetY = Math.max(floorY - SEAT_ANKLE, seatY - SEATED_HIP_HEIGHT);
  return {
    feet: [cx, feetY, cz], yaw: Math.atan2(face[0], face[1]), top: CHAIR_LAP_TOP,
    eye: [cx, feetY + SEATED_EYE_HEIGHT, cz], pitch: 0, seatY,
  };
}
