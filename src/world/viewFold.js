// THE ONE VIEW-SPACE FOLD. BA1's (systems/betterAmbience.js - Better
// Ambience's CameraShaker, the camera's parent) moved here at DRUNK1
// (2026-10-17) so a module that only wants the fold need not import the
// mod: survival/drunkFeel.js imports this leaf, and the HUD imports
// drunkFeel, so a drunkFeel -> betterAmbience edge put the whole mod in
// the HUD's import graph and evaluated it before the weather it reads
// (a dead-zone crash at load in every suite that imports the HUD).
// betterAmbience.js re-exports rigidInverse and shakeView by their old
// names. A leaf: it imports the matrices and nothing else.

import { multiply, trs } from './mat4.js';

/** The inverse of a rigid 4x4 (column-major): [R | t]^-1 = [R^T | -R^T t]. */
export function rigidInverse(m) {
  const r = new Float32Array(16);
  r[0] = m[0]; r[1] = m[4]; r[2] = m[8];
  r[4] = m[1]; r[5] = m[5]; r[6] = m[9];
  r[8] = m[2]; r[9] = m[6]; r[10] = m[10];
  r[12] = -(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]);
  r[13] = -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]);
  r[14] = -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14]);
  r[15] = 1;
  return r;
}
/** The shaker is the camera's PARENT (SetUpPlayer :41-49): a local offset and a local euler on the
 *  camera's own frame. In the port that is a rigid transform in VIEW space, folded into the view
 *  matrix the frame is drawn with; Unity's local +z is forward, the view's is -z. */
export function shakeView(view, pos, rotDeg) {
  if (!pos || (pos[0] === 0 && pos[1] === 0 && pos[2] === 0 && rotDeg[0] === 0 && rotDeg[1] === 0 && rotDeg[2] === 0)) return view;
  const local = trs(pos[0], pos[1], -pos[2], rotDeg[0], rotDeg[1], rotDeg[2]);
  return multiply(rigidInverse(local), view);
}

/** DRUNK1: THE VIEW'S OTHER FOLDS. FIELD-GUN6 found it first: the port has one view-space fold and every host already
 *  calls it (`betterAmbience.view(lookAt(...))`, the four hosts' view line), so a camera motion that is not the mod's
 *  rides it rather than a fifth seam in every host. A fold registered here runs after the shake, each frame, in the
 *  order registered, whether the mod is on or off; it answers the view it was handed when it has nothing to add.
 *  survival/drunkFeel.js registers the drink's sway as it loads. */
const folds = [];
export const afterShakeFolds = () => folds;
export function foldAfterShake(fold) { if (typeof fold === 'function' && !folds.includes(fold)) folds.push(fold); }
