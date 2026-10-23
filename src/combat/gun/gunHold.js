// PISTOL-STANCE (2026-10-22): A GUN HELD IN THE HANDS, BY ITS KIND - the row's `holdAs` (characters/ownModels/ownWeaponModels.js)
// says which stance solves the arms onto it: 'rifle' the Thunderlock's two-handed hold (combat/gun/rifleStance.js,
// RIFLE-STANCE), 'pistol' the Pistolet's one-handed hold and a pair's two (combat/gun/pistolStance.js). Both are stepped by the
// one law (rifleStanceStep) and handed to poseAssembly's one `hold` slot by the arm (combat/fpArm.js stepRifle, rifleHold),
// which reads this rather than either module.

import { applyRifleStance } from './rifleStance.js';
import { applyPistolStance } from './pistolStance.js';

/** The weapon is a gun the arms hold in a stance of its own. */
export const holdsGun = (weapon) => weapon?.holdAs === 'rifle' || weapon?.holdAs === 'pistol';

/** The stance for a row's `holdAs`, solved on this frame's body (poseAssembly's `hold`): answers the solver's fit, or null.
 *  `opts` are the stances' own - `pair` the pistol's alone (the left hand on the second pistol). */
export function applyGunStance(holdAs, skeleton, pose, rootRef, skelMats, opts) {
  return holdAs === 'pistol' ? applyPistolStance(skeleton, pose, rootRef, skelMats, opts) : applyRifleStance(skeleton, pose, rootRef, skelMats, opts);
}
