// MOVER-BODY (FIELD BUGS 2026-10-19f, two players' private reports: stuck in a dungeon's lift; out of the map under a
// floor that lowered onto them while they swam): A MOVER NEVER CLOSES ON THE BODY.
//
// A dungeon's movers (world/actionSystem.js, DaggerfallAction's Move tween) stand their collider bucket again at every
// frame's pose, and nothing asked where the body was. DFU's mover asks nothing either: TweenToEnd/TweenToStart hand
// iTween a linear MoveTo and RotateBy (DaggerfallAction.cs) and the tween plays to its end whatever stands in the
// way; the body on it is carried by PlayerGroundMotor.MoveWithMovingPlatform - the platform's point under the
// controller, moved (activePlatform.TransformPoint(activeLocalPlatformPoint)), through one CharacterController.Move,
// which stops at whatever blocks it - and a body the mover meets without standing on it is left to PhysX's overlap
// recovery. The port's ride (shared.js ridePlatform, retired here) was that adhesion for a body standing on the mover,
// and only that: a rider whose head met a lip stopped while its lift rose on, into the lift and the floor above it,
// held there by both their inner faces (the collider is two-sided); and a swimmer under a lowering floor was never on
// it, so the floor came down through the body and left it under the dungeon.
//
// So every mover's step is met here: a body the new pose would press - standing on it or not, pushed up, down or
// aside - is carried by the mover's motion at it (DFU's adhesion, from any side), swept through everything else that
// stands; and where the sweep is stopped - the body pinned between the mover and the world - THE MOVER HOLDS at the
// pose before, its tween waiting until the body is clear (a departure from DaggerfallAction's tween, which never
// stops: Port-Ledger A, MOVER-BODY).
import { CAPSULE_RADIUS } from './motor.js';
import { invert4 } from './tapRay.js';
import { transformPoint } from '../world/mat4.js';

/** How deep a mover's face may stand inside the body's capsule before the mover presses it, in metres: the collider
 *  pushes a body out of a face to its radius exactly, so a body resting on a mover stands a hair from pressing it. */
export const MOVER_PRESS = 1e-3;
/** The farthest one meet carries the body, in metres: a frame whose tween moves the mover farther at the body is met in
 *  steps of this - half the capsule's radius, so no face crosses a sphere of the body's chain unmet in one. */
export const MOVER_STEP = CAPSULE_RADIUS / 2;
/** The most steps one frame's tween is met in: a motion past MOVER_STEP times this is met in this many longer ones. */
export const MOVER_STEPS_MAX = 16;

const centreOf = (body) => [body.pos[0], body.pos[1] + body.height / 2, body.pos[2]];

/** Whether the mover's bucket `key`, where the collider stands it now, presses the body's capsule. */
export function moverPresses(collider, key, body) {
  return collider.capsuleContact(body.pos, body.height, -MOVER_PRESS, { only: [key] }) !== null;
}

/** How far the mover carries the point `p` going from pose `m0` to pose `m1`: the point of the mover's own frame under
 *  `p`, moved - MoveWithMovingPlatform's adhesionDirection (a turn's sweep as well as a slide). */
export function carriedBy(m0, m1, p) {
  const inv = invert4(m0);
  if (!inv) return [0, 0, 0];
  const l = transformPoint(inv, p[0], p[1], p[2]);
  const q = transformPoint(m1, l[0], l[1], l[2]);
  return [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
}

/** How many meets the mover's step from `m0` to `m1` (its bucket stood at `m1`) is taken in: none when the body neither
 *  stands on it nor is anywhere its step could reach, else one per MOVER_STEP of its motion at the body. */
export function moverSteps(collider, key, m0, m1, body) {
  const d = carriedBy(m0, m1, centreOf(body)), travel = Math.hypot(d[0], d[1], d[2]);
  if (body.groundKey !== key && collider.capsuleContact(body.pos, body.height, travel, { only: [key] }) === null) return 0;
  return Math.min(MOVER_STEPS_MAX, Math.max(1, Math.ceil(travel / MOVER_STEP)));
}

/**
 * THE MEET: the mover `key` stood at `m1` from `m0`; `place(m)` stands its bucket at a pose (null takes it away). The
 * body standing on it (its motor's `groundKey`) or pressed by the new pose is carried by the mover's motion at its
 * centre - one bare Move (MoveWithMovingPlatform's: no ground snap) through everything but the mover, the body's own
 * stance, its render span and its fall carried with it (`carryBy`). Answers whether the pose stands: false when the pose
 * still presses the body after the carry - the sweep was stopped short, the body pinned - and did not press it at `m0`
 * (a body the mover already held, stood there by a load or a snap, is no reason to stop it); the bucket is left at `m1`
 * either way.
 */
export function meetBody(collider, key, m0, m1, body, place) {
  if (body.groundKey !== key && !moverPresses(collider, key, body)) return true;
  place(m0);
  const before = moverPresses(collider, key, body);
  const want = carriedBy(m0, m1, centreOf(body)), to = [body.pos[0], body.pos[1], body.pos[2]];
  place(null);
  collider.move(to, want[0], want[1], want[2], body.height, false);
  body.carryBy(to[0] - body.pos[0], to[1] - body.pos[1], to[2] - body.pos[2]);
  place(m1);
  return before || !moverPresses(collider, key, body);
}
