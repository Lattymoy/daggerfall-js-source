// MW-D25: THE VIEW SYNC - the one seam between the Morrowind camera
// machine (mwCamera.js) and the player's two rigs (fpArm.js), so the
// four hosts wire three calls instead of re-deriving the lockstep four
// times (MW-D15's lesson: the camera dep drifted per host until it had
// one home).
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

/**
 * Per-frame, before the host composes its view matrix. Resolves any
 * queued view change (camera.cpp:135), keeps the rig on the camera's
 * mode (setViewMode + force refresh, npcanimation.cpp:295-317 /
 * character.cpp:2798), and answers the frame's eye (camera.cpp:160-209).
 *
 * @returns {{eye:number[], thirdPerson:boolean, distance:number}}
 */
export function mwViewFrame({ fpEye, feet, yaw, pitch, heightScale = 1, raycast = null }) {
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
  if (mwCamera.mode() === 'first' && clicks < 0 && !fpArm.canThirdPerson()) return false;
  mwCamera.wheel(clicks, { ready: fpArm.upperBodyReady() });
  return true;
}

/** The third-person body composite, after the host's world draw. A
 *  no-op in first person or when the body cannot draw. */
export function mwViewDrawBody(canvas, { proj, view, eye, feet, yaw }) {
  if (!mwCamera.thirdPerson()) return false;
  return fpArm.drawThird(canvas, { proj, view, eye, feet, yaw });
}
