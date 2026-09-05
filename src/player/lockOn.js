// TI1 - LOCK-ON: the touch layer's targeting (Mac, 2026-09-05: "touch
// to lock on to enemy using a dark souls like dot over your targeted
// foe"). NO DFU ORIGINAL. Daggerfall Unity has no lock-on and no touch
// input at all - zero Input.touch / TouchPhase reads anywhere under
// Assets/Scripts/Game - so this is the port's own, recorded in the
// Ledger's section A (MOBILE TOUCH INPUT, TI1).
//
// THE LAW. A tap locks the live foe nearest its RAY inside a small
// cone (pickFoeNearRay below: LOCK_PICK_ANGLE, LOCK_PICK_DISTANCE, the
// line of sight to the chest through the collider) - TI1c replaced the
// quest click's box hit, which a thumb misses. A tap on the locked
// foe unlocks it. The lock lets go by itself when the foe dies or
// stands past LOCK_BREAK_DISTANCE. While locked the camera FACES the
// foe: each frame the yaw and pitch error to its chest is paid into
// the host's LookFilter - the ONE door every look takes (AUDIT 28 W7,
// mat4's HANDEDNESS law), so mouse smoothing, the pitch clamp and the
// swing-settle rule (F-C2) all hold over the lock exactly as they hold
// over a drag. With the camera facing the foe, the right-half drag is
// free to be the swipe (ui/touchGestures.js), and DFU's own melee -
// which resolves along the camera ray behind the in-view gate
// (player/cameraView.js) - lands on the locked foe without a second
// aim of its own.
//
// The dot is the HOST's to draw: tick() answers the chest point in
// world space, the host projects it through the frame's own matrices
// (player/tapRay.js projectToScreen) and hands the touch layer a
// screen position. This module never sees a pixel.

/** m: a tap locks what its ray reaches this far. */
export const LOCK_PICK_DISTANCE = 24;
/** m: a lock lets go past this - the foe walked away, not the player. */
export const LOCK_BREAK_DISTANCE = 32;
/** 1/s: the fraction of the remaining error paid per second (k = min(1, gain*dt)). */
export const LOCK_FACE_GAIN = 8;
/** The dot and the facing aim at the CHEST, not the feet: this far up the foe's height. */
export const CHEST_FRACTION = 0.6;

/** Wrap to (-PI, PI] so a foe just across the seam turns the short way. */
export function wrapAngle(a) {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/** The foe's chest: feet + CHEST_FRACTION of its height (pickQuestFoe's
 *  1.8 default when the AI carries none). */
export function chestPoint(foe) {
  const feet = foe?.ai?.feet;
  if (!feet) return null;
  // TI1d (review): the DRAWN height, not the capsule's - enemyAnchor
  // floors the controller at 1.6 m, so a rat's capsule "chest" stood
  // above its 0.9 m sprite and no thumb on the rat was inside the
  // cone. The record's idleH is the sprite; ai.centreOffset is half of
  // it (the draw's own centre, flyers included); the capsule is the
  // last resort.
  const h = foe.idleH ?? (foe.ai?.centreOffset != null ? foe.ai.centreOffset * 2 : null) ?? foe.ai?.height ?? 1.8;
  return [feet[0], feet[1] + h * CHEST_FRACTION, feet[2]];
}

/**
 * The lock: one per camera. `cam` is the host's {yaw, pitch}; the
 * forward it draws is [sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)]
 * (every host's useFwd), so the yaw TO a point is atan2(dx, dz) and the
 * pitch atan2(dy, horizontal) - the errors below are in those terms.
 */
/** TI1c: the lock's own pick tolerance - about seven degrees, a thumb's
 *  miss on a phone at arm's length. */
export const LOCK_PICK_ANGLE = 0.12;

/**
 * TI1c (Mac: "touch to lock on still doesn't work"): THE LOCK'S OWN
 * PICK. activate.js's pickFoe is the quest click's law - the ray must
 * strike the foe's 0.9-unit box - which is the mouse's precision: a
 * sprite six metres off is twenty pixels wide under a thumb, and a
 * miss by a finger's width locked nothing. The lock takes the nearest
 * live foe to the tap's RAY inside a small cone instead: the smallest
 * angle wins, a nearer body wins the tie, and the line of sight runs
 * through the collider to the CHEST - the point the lock faces. The
 * quest click keeps its box; a lock is not a click.
 * @returns the foe, or null
 */
export function pickFoeNearRay(eye, dir, foes, collider, distance = LOCK_PICK_DISTANCE, maxAngle = LOCK_PICK_ANGLE) {
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  let best = null, bestAngle = Infinity, bestDist = Infinity;
  for (const f of foes ?? []) {
    if (!f || f.dead) continue;
    const chest = chestPoint(f);
    if (!chest) continue;
    const v = [chest[0] - eye[0], chest[1] - eye[1], chest[2] - eye[2]];
    const len = Math.hypot(v[0], v[1], v[2]);
    if (len === 0 || len > distance) continue;
    const cos = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / len;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > maxAngle) continue;
    const better = angle < bestAngle - 1e-6 || (Math.abs(angle - bestAngle) <= 1e-6 && len < bestDist);
    if (!better) continue;
    const toward = [v[0] / len, v[1] / len, v[2] / len];
    const wall = collider?.raycast?.(eye, toward, len) ?? Infinity;
    if (Number.isFinite(wall) && wall < len - 0.05) continue;
    best = f; bestAngle = angle; bestDist = len;
  }
  return best;
}

export function createLockOn({
  breakDistance = LOCK_BREAK_DISTANCE,
  gain = LOCK_FACE_GAIN,
} = {}) {
  let target = null;
  return {
    get target() { return target; },
    get locked() { return target !== null; },
    lock(foe) { target = foe ?? null; },
    unlock() { target = null; },
    /** A tap on the locked foe unlocks; on any other foe re-locks. */
    toggle(foe) {
      target = (target === foe) ? null : (foe ?? null);
      return target;
    },
    /**
     * One frame. Pays the facing error into `lookFilter` and answers the
     * chest point for the dot, or null (and clears) when the lock breaks.
     */
    tick(dt, cam, eye, lookFilter) {
      if (!target) return null;
      if (target.dead) { target = null; return null; }
      const chest = chestPoint(target);
      if (!chest) { target = null; return null; }
      const dx = chest[0] - eye[0], dy = chest[1] - eye[1], dz = chest[2] - eye[2];
      const horiz = Math.hypot(dx, dz);
      if (Math.hypot(horiz, dy) > breakDistance) { target = null; return null; }
      const yawErr = wrapAngle(Math.atan2(dx, dz) - cam.yaw);
      const pitchErr = Math.atan2(dy, horiz) - cam.pitch;
      const k = Math.min(1, gain * dt);
      lookFilter.add(yawErr * k, pitchErr * k);
      return chest;
    },
  };
}
