// @ts-check
// HORSE-VIEW (2026-10-21; bible/07-Rendering/Performance-Priority.md HORSE-VIEW and HORSE-VIEW II) - A 3D HORSE IS POSED
// WHERE IT IS SEEN, ONE LAW.
//
// A horse stepped with `pose: false` (world/horseRig.js step) runs its gait's clock every frame and stands in the last
// pose sent; this is where its pose is due. HORSE-VIEW wrote it into the Horse Cart pool (scenes/horseCartPool.js
// pose3dTeam); HORSE-VIEW II found the road's strangers' teams (world/road/roadTeams.js) and the standing horses
// (world/standingHorses.js) still posed every frame at any range and the road's out of the view too, and gave them the
// same law - so it lives here, read by all three. A riding peer's horse is posed with its rider's body instead
// (net/peer/peerBodies.js _poseHorse): it is in the rider's picture.
//
//  - THE VIEW. Out of the camera's view a horse is not posed. Its caller hands the answer (`out`) to the draw as
//    `fresh` (horseRig.js draw), so a horse the view swings onto is caught up before its picture is queued - never
//    drawn in the pose it had when last seen. And back to the law the next frame (`wasOut`): a horse judged in the view
//    that was out of it when last judged is posed then, whatever its cadence says - one that moved into the camera's
//    view between two judgements (a jump, a team come round the eye) is judged in by the very camera that judged it out,
//    so the draw's `fresh` never catches it (AUDIT HORSE-VIEW II: one come in on a frame its cadence skips was drawn in
//    the pose it had when last seen - two frames of three past 25 m). The standing horses hand none: they are judged by
//    the camera they are drawn through, and their draw's `fresh` is the judgement before. With no camera yet (before
//    any body pass) every horse is held seen.
//  - THE CADENCE. In the view, the peers' bodies' (net/peer/peerBodies.js poseCadenceFor: every frame within 10 m,
//    every second to 25, every third past it) by how far the horse looks from the camera that draws it - its eye, over
//    its lens (cadenceD2, lensOf: the zoomed-out boom's, the spyglass's) - each horse on a phase of its own. Before any
//    pass the distance is from the frame's own eye; with no eye at all, every frame.
//
// The pose is the gait's clock alone (horseModel.js writeHorsePalette), so a horse posed on any frame shows the very
// palette an every-frame horse shows on it. Not a DFU member: Daggerfall's horse is a sprite, and the 3D horse is the
// port's own (world/horseRig.js).
import { poseCadenceFor, cadenceD2 } from '../net/peer/peerBodies.js';

/**
 * Is a 3D horse's pose due this frame - its cadence at how far it looks from `cam`, staggered by its phase?
 * @param {number} frame - the caller's frame count
 * @param {number} phase - the horse's own (each new horse the next)
 * @param {ArrayLike<number>} at - where it stands
 * @param {{ eye?: ArrayLike<number> | null, lens?: number } | null} cam - the camera that draws it (its eye, its lens), or null
 * @param {ArrayLike<number> | null} eye - the frame's own eye, read when there is no camera
 */
export function horsePoseDue(frame, phase, at, cam, eye) {
  const from = cam?.eye ?? eye;
  if (!from) return true;
  return (frame + phase) % poseCadenceFor(cadenceD2(at, from, cam?.lens ?? 1)) === 0;
}

/**
 * A horse stepped with `pose: false` (and placed), posed where it is seen: out of `cam`'s view nothing is written or
 * sent; in it, on its cadence (horsePoseDue) - or at once, come into it since it was last judged out (`wasOut`).
 * Answers whether it was out of the view - the draw's `fresh`, and the next frame's `wasOut`.
 * @param {{ seen: Function, pose: Function }} rig - the horse's rig (world/horseRig.js)
 * @param {any} horse
 * @param {ArrayLike<number>} at - where it stands (its feet)
 * @param {{ view: any, proj: any, eye?: ArrayLike<number> | null, lens?: number } | null} cam - the camera whose view
 *   judges it (a body pass's, `lens` its lensOf), or null: none yet, every horse held seen
 * @param {ArrayLike<number> | null} eye - the frame's own eye
 * @param {number} frame
 * @param {number} phase
 * @param {boolean} [wasOut] - its last answer: out of the view when last judged (none: the standing horses')
 */
export function poseWhereSeen(rig, horse, at, cam, eye, frame, phase, wasOut = false) {
  const out = !!cam && !rig.seen(horse, cam.view, cam.proj);
  if (!out && (wasOut || horsePoseDue(frame, phase, at, cam, eye))) rig.pose(horse);
  return out;
}
