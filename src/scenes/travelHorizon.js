// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-HORIZON (2026-10-20, the owner: "the overworld map as it stands doesnt allow you to see as far as the eye can
// see, this needs to change without impacting performance"; bible/06-Systems/Travel-View.md OW-HORIZON): AS FAR AS
// THE EYE CAN SEE, FROM THE AIR.
//
// WHY THE VIEW STOPPED SHORT. Three laws, each right for the eye they were made for, met under the Overworld:
//   1. The haze. DFU's sunny and overcast rows are a LINEAR fog, 0 to 2400 m - its draw distance's edge, tuned for
//      TerrainDistance 3 (EV4 grew it to 2400 x TD/3: 4,000 m at the default Land View). Measured from the traveller
//      (TV1's law: the weather is the traveller's), it closed 100 m inside the streamed grid, and the far ring past
//      it (EV8) stood at its 85% haze hold. From 260-450 m up every league past the fourth kilometre was one pale wash.
//   2. The lens. The world is drawn through a 6,000 m far plane; from a raised eye standing back from the traveller
//      the grid's far corners lie past it - hidden only because the haze had already closed.
//   3. The tilt. The camera could not look up past 30 degrees down - so as not to show the haze's wall
//      (player/travelCamera.js TV_TILT_MIN, lowered to 15 by this slice).
//
// THE LAW. Under the view, and only there, a LINEAR row's haze is the horizon's: its end runs out to TV_HAZE_END, the
// far ring's nearest rim (render/farRing.js RING_RIM_END), where the ring already closes its land into the sky - so
// the streamed land, the far ring and the sea past it fog by ONE ramp from the traveller to the horizon
// (render/horizonHaze.js horizonHaze, the ring's own law; FAR-SEA1 made the streamed sea take it). The lens's far
// plane grows to hold the whole grid from the raised eye, and its near plane, 150 m and more over the ground, grows
// with it, so the depth buffer keeps its precision out there. All of it eases with the rise and the fall (the eye's
// own smoothstep), so nothing pops as the camera leaves the head or comes back to it.
//
// WHAT IS NOT CHANGED. An EXPONENTIAL row is weather - rain, snow, a fog, a sandstorm - and stays the traveller's,
// exactly as TV1 measured it (the far ring stands down under it, as ever). On the ground nothing moves: with no view
// up every function here hands back what it was given, the same object.
//
// THE COST. None of it draws anything new: the haze and the lens are numbers the frame already sends. The far
// ring's pass (one draw) was drawn under the view before; past the grid it is what the eye now sees.
// ═══════════════════════════════════════════════════════════════════

import { RING_RIM_END } from '../render/farRing.js';
import { perspective, mirrorProjectionX } from '../world/mat4.js';
import { smooth01 } from '../player/travelCamera.js';
import { groundHit } from '../player/travelPick.js';

/** The haze's end under the view, metres from the traveller: the far ring's nearest rim, where its land meets the sky. */
export const TV_HAZE_END = RING_RIM_END;
/** The world lens's planes on the ground (scenes/world.js's own: the eye's 0.2, 6000 out). */
export const WORLD_NEAR = 0.2;
export const WORLD_FAR = 6000;
/** ...and under the view. FAR holds the whole grid from the raised eye: its farthest corner at the widest Land View is
 *  7 x 819.2 x sqrt(2) = 8,110 m from the traveller, and the eye stands at most hypot(450, 450 / tan 15) = 1,739 m from
 *  them (more only when it is lifted clear of a mountain). NEAR: the eye keeps 25 m over the ground under it - nothing
 *  stands this close but a drop of the rain wrapped round it - and at 2 m the depth buffer's step 8 km out is 1.9 m
 *  (it was 4.8 m at 4 km through the eye's 0.2). */
export const TV_LENS_NEAR = 2;
export const TV_LENS_FAR = 12000;

/** How far up the view stands this frame, 0 on the ground to 1 risen: the eye's own smoothstep of its blend. */
export const viewShare = (view) => (view ? smooth01(view.blend) : 0);

/**
 * THE FRAME'S FOG ROW. `row` is the weather's (the front's row, EV4-scaled); `view` the travel view's frame (null while
 * it is down). Off the view, or under any row but a linear one, the row itself; else a copy whose end has run out
 * toward TV_HAZE_END by the view's share - never nearer than the row's own.
 * @template {{ mode: string, end: number }} R
 * @param {R} row
 * @param {{ blend: number } | null} view
 * @returns {R}
 */
export function horizonFog(row, view) {
  const s = viewShare(view);
  if (!(s > 0) || row?.mode !== 'linear' || !(row.end < TV_HAZE_END)) return row;
  return { ...row, end: row.end + (TV_HAZE_END - row.end) * s };
}

/** THE LENS'S PLANES, [near, far]: the frame's own near (the spyglass's focus, else the eye's) and WORLD_FAR on the
 *  ground; under the view eased toward TV_LENS_NEAR (never nearer than the frame's own) and TV_LENS_FAR. */
export function horizonPlanes(near, view) {
  const s = viewShare(view);
  if (!(s > 0)) return [near, WORLD_FAR];
  return [Math.max(near, near + (TV_LENS_NEAR - near) * s), WORLD_FAR + (TV_LENS_FAR - WORLD_FAR) * s];
}

/** The world pass's projection - mat4's mirrored perspective (HANDEDNESS) through horizonPlanes. */
export function horizonProj(fovY, aspect, near, view) {
  const [n, f] = horizonPlanes(near, view);
  return mirrorProjectionX(perspective(fovY, aspect, n, f));
}

/** A ground pick's reach under the view: the haze's end - the land past it is the sky's. */
export const TV_PICK_REACH = TV_HAZE_END;

/** THE VIEW'S CLICK, as far as it can see: player/travelPick.js groundHit out to TV_PICK_REACH over `ground` - the host's
 *  land past the built grid too (the far ring's height there), so a click on the land the view now shows is a journey
 *  there, never "beyond what you can see" (it reached the lens's old 6,000 m over the built grid alone). */
export const horizonHit = (eye, dir, ground) => groundHit(eye, dir, ground, { maxDist: TV_PICK_REACH });
