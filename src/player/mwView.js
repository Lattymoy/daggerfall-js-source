// MW-D25: THE VIEW SYNC - the one seam between the camera machine and
// the player's rigs, so the four hosts wire three calls instead of
// re-deriving the lockstep four times (MW-D15's lesson: the camera dep
// drifted per host until it had one home).
//
// EOTB4 (2026-09-15): THIS SEAM NOW SERVES TWO BODIES. Mac, on why the
// port carries a second third-person system: "This is moreso for those
// who opt out of using morrowind." So the wheel is ONE LADDER and the
// question it asks is "which body can answer" -
//
//     the Morrowind rig, when fpArm has built one;
//     Eye Of The Beholder's sprite, when it has not.
//
// and when neither can, the wheel does nothing, exactly as it has
// always done. There is no setting to choose between them, because
// there is nothing to choose: a player with Morrowind data has the
// Morrowind body, and a player without it never had a third person at
// all until now.
//
// THE FILE IS STILL CALLED mwView, AND THAT IS A DEBT, not an
// oversight. The name is written into four hosts and ten test files;
// renaming it buys no behaviour and risks a great deal, so it is
// recorded here and on the mod's bible page as a housekeeping item
// rather than left to be discovered as a quiet lie.
//
// The reference couples these through Camera::processViewChange
// (camera.cpp:346-369): the mode decides which rig the NpcAnimation
// wears, and a mode the rig cannot serve does not exist. Here the
// coupling runs the same direction - the camera machine is asked to
// move only where the rig can follow - plus one port-honest guard: a
// player with NO Morrowind data (or a refused body) has no third
// person at all, and the wheel then does nothing rather than pulling
// the eye out of an invisible head.

import { mwCamera } from './mwCamera.js';
import { fpArm } from '../combat/fpArm.js';
import { eotbCamera } from './eotbCamera.js';
import { modSetting } from '../systems/modSettings.js';

/**
 * EOTB4: is Eye Of The Beholder the lane this frame?
 *
 * Three things have to hold, and the THIRD is the one that matters
 * today: the mod is enabled, the Morrowind rig cannot serve, and the
 * mod's own body can actually be DRAWN. Until the drawing lands
 * (EOTB5) `eotbBodyReady` answers false, so this lane is wired, pinned
 * and inert - a player sees exactly what they see now rather than a
 * camera swinging out behind an invisible body, which is the failure
 * mwView's own head has always refused for the Morrowind rig.
 *
 * It is a predicate rather than a comment so that turning the lane on
 * is one line, and so that "the lane is off" is a thing the pins can
 * state and the next slice can flip.
 */
let eotbBodyReady = () => false;
/** EOTB5's door: the host tells the seam its body can draw. */
export function setEotbBodyReady(fn) { eotbBodyReady = typeof fn === 'function' ? fn : () => false; }
export function eotbLane() {
  if (fpArm.canThirdPerson()) return false;          // the Morrowind body wins where it exists
  try {
    if (!modSetting('eye-of-the-beholder', 'Enabled')) return false;
  } catch { return false; }                          // not vendored: no lane
  return !!eotbBodyReady();
}

// MW-D30: the reference accumulates the frame's zoom presses and calls
// zoom() ONCE per frame with their sum (actionbindings.lua:98-115 -
// `zoomInOut` collects every ZoomIn/ZoomOut, Zoom3rdPerson reads
// `zoomInOut * 10` once, then zeroes it). The port had applied each DOM
// wheel event separately against a stale pull-in distance, so a burst
// of N notches subtracted the obstacle debt N times. The pending count
// flushes in mwViewFrame, where the frame's camera state is fresh.
let pendingClicks = 0;

/**
 * Per-frame, before the host composes its view matrix. Resolves any
 * queued view change (camera.cpp:135), keeps the rig on the camera's
 * mode (setViewMode + force refresh, npcanimation.cpp:295-317 /
 * character.cpp:2798), and answers the frame's eye (camera.cpp:160-209).
 *
 * @returns {{eye:number[], thirdPerson:boolean, distance:number}}
 */
export function mwViewFrame({ fpEye, feet, yaw, pitch, heightScale = null, raycast = null, ...state }) {
  // EOTB4: the other lane, resolved first and returned whole - its
  // camera keeps its own ladder, its own smoothing and its own
  // obstacle casts (EOTB2), and nothing of Morrowind's runs.
  if (eotbLane()) {
    // ...and A STRANDED NOTCH IS DROPPED rather than left to fire
    // later. A click can only be queued above while the lane is SHUT,
    // so a count surviving into this branch means the lane opened
    // underneath it - the Morrowind body finished building, or the mod
    // was switched mid-scroll. Carrying it would spend an old notch on
    // a camera the player was not looking through when they turned the
    // wheel, and leaving it uncleared means this frame never drains it
    // at all. Found by a test helper that span forever waiting for it.
    pendingClicks = 0;
    eotbCamera.tick(state);
    return eotbCamera.eye({ fpEye, feet, yaw, pitch, raycast, ...state });
  }
  if (pendingClicks) {
    mwCamera.wheel(pendingClicks, { ready: fpArm.upperBodyReady() });
    pendingClicks = 0;
  }
  // MW-D34: the focal height rides the actor's race HEIGHT (adjustScale's
  // z, npc.cpp:1127/1134 - the camera tracks a node on the SCALED body).
  // Answered here, once, by the rig itself - the hosts stay out of it
  // (MW-D25's law); a caller may still hand an explicit value.
  if (heightScale == null) heightScale = fpArm.raceHeightScale();
  mwCamera.update({ ready: fpArm.upperBodyReady() });
  if (mwCamera.thirdPerson()) {
    if (!fpArm.setViewMode('third')) {
      // The body refused (or was never built): third person does not
      // exist for this player. Fall back rather than float an empty
      // camera - the card carries the body's own refusal sentence.
      mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
      fpArm.setViewMode('first');
    }
  } else {
    fpArm.setViewMode('first');
  }
  return mwCamera.eye({ fpEye, feet, yaw, pitch, heightScale, raycast });
}

/**
 * The wheel. Browser deltaY is positive scrolling DOWN; Morrowind's
 * ZoomIn is wheel UP (bindingsmanager.cpp:300-301), so up = +1 click.
 * Leaving first person needs a body to show; leaving third person (or
 * zooming within it) needs nothing extra.
 */
export function mwViewWheel(deltaY) {
  const clicks = deltaY < 0 ? 1 : deltaY > 0 ? -1 : 0;
  if (!clicks) return false;
  // EOTB4: the SAME notch, handed to whichever body answers. Both
  // ladders read a click the same way round - negative is out of the
  // head - so nothing about the sign moves at the seam.
  if (eotbLane()) return eotbCamera.wheel(clicks);
  if (mwCamera.mode() === 'first' && clicks < 0 && !fpArm.canThirdPerson()) return false;
  pendingClicks += clicks;   // flushed once per frame (actionbindings.lua:113-114)
  return true;
}

/** The frame's pending, exposed for the pins - a probe with its own
 *  counter measures the copy. */
export function mwViewPendingClicks() { return pendingClicks; }

/** The third-person body composite, after the host's world draw. A
 *  no-op in first person or when the body cannot draw. */
export function mwViewDrawBody(canvas, { proj, view, eye, feet, yaw }) {
  // EOTB4: the sprite lane draws its own body. `eotbLane()` already
  // requires `eotbBodyReady()`, so this arm cannot be reached with
  // nothing to draw - the gate and the draw are the same question
  // asked once.
  if (eotbLane()) return eotbCamera.thirdPerson() && drawEotbBody(canvas, { proj, view, eye, feet, yaw });
  if (!mwCamera.thirdPerson()) return false;
  return fpArm.drawThird(canvas, { proj, view, eye, feet, yaw });
}

/** EOTB5's door, matching `setEotbBodyReady`: the host hands the seam
 *  the one call that paints the mod's sprite. Null until then, which
 *  is why `eotbBodyReady` answers false. */
let drawEotbBody = () => false;
export function setEotbDrawBody(fn) { drawEotbBody = typeof fn === 'function' ? fn : () => false; }
