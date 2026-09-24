// @ts-check
// THE PACE A PEER WALKS AT, measured off its drawn pose - MWBODY1's law (it was net/peerBodies.js `_place`'s own
// lines), lifted here by HT-WAIST-BACK (2026-09-24) because a second layer reads it: DISC23-B's walkers
// (net/peerRiders.js) swing a peer's lantern off the pace, as the Morrowind body's rig plays its walk clip off it.
// The pose carries no speed (`mv` is a walk-or-run bit), so the ground speed is the drawn feet's own travel, eased.

/** A drawn pose farther than this from the last (scene units) is a jump, not a stride: the pace resets. */
export const JUMP_UNITS = 5;

/**
 * One frame of the pace: eased toward the feet's travel over `dt` (`from` last frame's feet, `to` this frame's),
 * and reset by a jump (a snap, a recenter missed) rather than read as a sprint - or when there is no last frame.
 * @param {number} speed @param {ArrayLike<number>|null} from @param {ArrayLike<number>} to @param {number} dt
 * @returns {number}
 */
export function stepPeerPace(speed, from, to, dt) {
  if (!from) return 0;
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  if (d > JUMP_UNITS) return 0;
  return dt > 0 ? speed * 0.8 + (d / dt) * 0.2 : speed;
}
