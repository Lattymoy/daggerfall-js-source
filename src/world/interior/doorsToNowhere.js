// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIELD BUGS 2026-10-25 DOOR-VOID — A DOOR THAT OPENS ONTO NOTHING STAYS SHUT.
//
// Players reported falling through the floor in their own houses. Some
// interiors hang an action door in a wall with no room behind it: the
// door's far side has no floor at all. Daggerfall's own data has them in
// blocks no town places; Beautiful Cities' House2 design (DARKAB00-02,
// record 0) has them in towns players buy houses in. Opened and walked
// through, such a door drops the player into the void, and the room's
// failsafe (player/enterExit.js standFromVoid) stands them back at the
// door. DFU builds every interior door as it finds it
// (DaggerfallInterior.AddActionDoors); this is our departure: a door
// with a floor on one side and none on the other is SEALED when the
// room is built, and nothing opens it (world/actionSystem.js `sealed`).
//
// The test is the room's own collider, finished but for the doors' own
// buckets: a side has a floor when a ray down from a stride past the
// leaf (DOOR_SIDE_STEP) meets one within DOOR_FLOOR_REACH - a stairwell
// or a cellar below the doorway is a floor, only nothing at all is not.
// A door with no floor on either side hangs in no room and is left as it
// is.
// ═══════════════════════════════════════════════════════════════════

import { t } from '../../systems/textManager.js';   // the sealed door's line, in the player's language

/** The player's line at a sealed door (world/actionSystem.js onSealedDoor), in English. */
export const SEALED_DOOR_TEXT = 'This door will not open.';
/** The player's line at a sealed door, in the player's language. */
export const sealedDoorText = () => t('player.sealedDoor', SEALED_DOOR_TEXT);

/** How far below the doorway a floor still counts - standsOnFloor's own reach (player/enterExit.js). */
export const DOOR_FLOOR_REACH = 10;

/** How far out from the closed leaf each side is sampled, metres - a stride through the doorway. Nearer is not enough:
 *  Beautiful Cities' House2 doors stand on a lip of floor half a metre deep with nothing past it. */
export const DOOR_SIDE_STEP = 1.0;
/** Where across the doorway each side is sampled, as fractions of the leaf's width. */
const ACROSS = Object.freeze([0.25, 0.5, 0.75]);
/** How far above the leaf's foot the rays start - over a sill, under any lintel. */
const RAY_LIFT = 0.5;

/**
 * Whether each side of a closed door has a floor - `[near, far]` along the leaf's thin axis. `door` is an action door
 * as ActionSystem.addDoor registers it (`cpu.positions` local, `base` its closed matrix, `key` its collider bucket).
 * @param {{ raycast: (o: number[], d: number[], max: number, f?: any) => number }} collider
 * @param {{ key: string, cpu: { positions: ArrayLike<number> }, base: ArrayLike<number> }} door
 * @returns {[boolean, boolean]}
 */
export function doorSidesFloored(collider, door) {
  const p = door.cpu.positions, m = door.base;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (p[i + k] < lo[k]) lo[k] = p[i + k];
      if (p[i + k] > hi[k]) hi[k] = p[i + k];
    }
  }
  // the leaf's thin local axis (x or z) is the way through it; the other is its width
  const through = hi[0] - lo[0] < hi[2] - lo[2] ? 0 : 2;
  const across = 2 - through;
  const at = (local) => [0, 1, 2].map((r) => m[r] * local[0] + m[4 + r] * local[1] + m[8 + r] * local[2] + m[12 + r]);
  const axis = (k) => {
    const v = [m[4 * k], 0, m[4 * k + 2]];
    const len = Math.hypot(v[0], v[2]) || 1;
    return [v[0] / len, 0, v[2] / len];
  };
  const out = axis(through);
  const skip = { skip: [door.key] };
  const floored = (side) => ACROSS.some((f) => {
    const local = [0, lo[1], 0];
    local[through] = (lo[through] + hi[through]) / 2;
    local[across] = lo[across] + f * (hi[across] - lo[across]);
    const base = at(local);
    const origin = [base[0] + side * DOOR_SIDE_STEP * out[0], base[1] + RAY_LIFT, base[2] + side * DOOR_SIDE_STEP * out[2]];
    return Number.isFinite(collider.raycast(origin, [0, -1, 0], DOOR_FLOOR_REACH + RAY_LIFT, skip));
  });
  return [floored(-1), floored(1)];
}

/**
 * Seal every action door of a room that opens onto nothing - a floor on one side, none on the other. Answers the keys
 * it sealed, in the room's door order.
 * @param {{ objects: Map<string, any>, collider: any }} actions the room's ActionSystem, its doors registered
 * @returns {string[]}
 */
export function sealDoorsToNowhere(actions) {
  const sealed = [];
  for (const o of actions.objects.values()) {
    if (o.kind !== 'door' || o.special || !o.cpu?.positions) continue;
    const [near, far] = doorSidesFloored(actions.collider, o);
    if (near === far) continue;
    o.sealed = true;
    sealed.push(o.key);
  }
  return sealed;
}
