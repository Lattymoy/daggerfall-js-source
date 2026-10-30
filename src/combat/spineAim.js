// @ts-check
// BOW-AIM (FIELD BUGS 2026-10-26c, feature-feedback via Mac: "Bow, while being drawn, is pointed upwards too much";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26c.md) - THE THIRD-PERSON BODY AIMS A RANGED WEAPON WHERE ITS OWNER LOOKS.
//
// The reference's law, ported whole (bible/02-Formats/Morrowind-Rules.md, the three [C] rules from "The ranged aim pitch
// is TWO RotateControllers"): in third person (VM_Normal) "bip01 spine1" and "bip01 spine2" each carry a
// RotateController (addControllers), and every frame both are given HALF of the actor's pitch times the pitch factor
// about -X, in the actor root's space (configureControllers - both weaponanimation.cpp:175-211; the controller itself,
// rotatecontroller.cpp:41-60). spine2 hangs off spine1, so the two halves compose and the chest, the arms and the
// bow carry the whole pitch, curved through two joints. The factor is 0 unless a Ranged or Thrown weapon is in its
// wind-up, its release or its follow (or a cast, `> WeaponEquipped`) - eased in over the wind-up's pre-section and out
// over the follow, a crossbow's in its first tenth (character.cpp:1868-1895).
//
// The port had none of it: the body stood level however the player looked (fpArm.js MW-D24 - right of the neck, which
// IS a first-person law, and not of these), so a drawn bow pointed where Morrowind's clip holds it whatever the aim -
// and a player looking down at their target from behind the body saw it aimed over the target's head. The arrow was
// never wrong: it flies along the look, as the reference's does (weaponanimation.cpp:111-114).
//
// The argument is the reference's: rot[0] + getBodyPitchRadians() - the actor's pitch, + DOWNWARD (the body's swimming
// pitch is 0 here: the port has no swimming body). This port's cam.pitch counts UPWARD, so the caller negates it, as it
// does for the first-person neck (fpArm.js `neckPitch`). A peer's body and a townsperson's stand at pitch 0
// (net/peer/peerBodies.js: the wire carries no look), so their drawn bows keep the clip's own angle.

import {
  MW_WEAPON_TYPE,
  MW_WEAPON_CLASS,
  weaponClass,
  rotNegX,
  applyRotateController,
} from '../formats/morrowind/mwFirstPerson.js';

/** addControllers' two bones (weaponanimation.cpp:175-211), spine1 first - the second hangs off it. */
export const SPINE_AIM_BONES = Object.freeze(['bip01 spine1', 'bip01 spine2']);

/** isRandomAttackAnimation (character.cpp:2934-2938): the groups with no pre-wind-up section to ease in over. */
export const RANDOM_ATTACK_GROUPS = Object.freeze(
  new Set(['attack1', 'attack2', 'attack3', 'swimattack1', 'swimattack2', 'swimattack3']),
);

/** UpperBodyState above WeaponEquipped (character.hpp:107-117), by the names combat/fpArm.js UPPER_BODY_NAME gives them. */
export const AIMING_STATES = Object.freeze(new Set(['AttackWindUp', 'AttackRelease', 'AttackEnd', 'Casting']));

/**
 * setPitchFactor's law, verbatim (character.cpp:1868-1895). `upper` the upper body's state name, `weaponType` the stance's
 * MW_WEAPON_TYPE (mWeaponType), `group` the weapon group (mCurrentWeapon), `time` its playhead (-1 when it is not
 * playing), `startTime` and `minAttackTime` the "<type> start" and "<type> min attack" keys' times (-1 when absent -
 * getTextKeyTime's own answer, and the reference's guard reads it as it is), `completion` the playing section's
 * (AnimState::getCompletion). Pure.
 * @param {{ upper?: string, weaponType?: number, group?: string | null, time?: number, startTime?: number, minAttackTime?: number, completion?: number }} s
 */
export function spinePitchFactor({
  upper = 'None',
  weaponType = MW_WEAPON_TYPE.None,
  group = null,
  time = -1,
  startTime = -1,
  minAttackTime = -1,
  completion = 0,
} = {}) {
  const cls = weaponClass(weaponType);
  if (!AIMING_STATES.has(upper) || (cls !== MW_WEAPON_CLASS.Ranged && cls !== MW_WEAPON_CLASS.Thrown)) return 0;
  if (upper === 'AttackWindUp' && !RANDOM_ATTACK_GROUPS.has(group ?? '')) {
    // "A smooth transition can be provided if a pre-wind-up section is defined"
    if (startTime <= time && time < minAttackTime) return (time - startTime) / (minAttackTime - startTime);
    return 1;
  }
  if (upper === 'AttackEnd') {
    // "technically we do not need a pitch for crossbow reload animation, but we should avoid abrupt repositioning"
    return weaponType === MW_WEAPON_TYPE.MarksmanCrossbow ? Math.max(0, 1 - completion * 10) : 1 - completion;
  }
  return 1;
}

/**
 * configureControllers (weaponanimation.cpp:175-211) on a posed skeleton: `pitch` (radians, + down: the actor's pitch
 * times the factor) laid as HALF about -X in the root's space on each spine bone in turn, spine1 first, so spine2's
 * frame is read under spine1's new turn - the order the reference's update callbacks run in. A zero pitch, or either
 * factor zero, leaves the clip's pose untouched (`mPitchFactor == 0.f || characterPitchRadians == 0.f`). A skeleton
 * missing a bone pitches the one it has (each controller slot is its own). Answers how many bones it turned.
 */
export function applySpineAim(skeleton, pose, rootRef, skelMats, pitch) {
  if (!pitch || !skeleton?.byName) return 0;
  const half = rotNegX(pitch / 2);
  let turned = 0;
  for (const name of SPINE_AIM_BONES)
    if (applyRotateController(skeleton, pose, rootRef, skelMats, skeleton.byName.get(name), half)) turned++;
  return turned;
}

/** The slot poseAssembly runs (its `aim`) for a frame's pitch: null where there is nothing to lay. */
export function spineAimSlot(pitch) {
  return pitch ? (skeleton, pose, rootRef, skelMats) => applySpineAim(skeleton, pose, rootRef, skelMats, pitch) : null;
}
