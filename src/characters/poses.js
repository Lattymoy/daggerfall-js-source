// Static poses for the neutral rig - FULL joint set (v2), matching the
// viewer tuner's proven transforms exactly (pivots, order, mirroring):
//
//   arms: { sw, bd, spread, handRoll, handPitch, handYaw }
//   legs: { sw, bd }
//   pose: { lean, gaitArm, gaitElbow, ...limbs }
//
// Per vertex (base-y joint gates; held objects take the whole hand
// chain), applied in this order:
//   1. handRoll  - rotY about the FOREARM AXIS (+/-ARM_X, z 0), mirrored.
//                  Stacks on the rig's baked HAND_REST_ROLL.
//   2. handPitch - rotX about the wrist junction (flex/extend).
//   3. handYaw   - rotZ about (+/-ARM_X, wrist), mirrored (side wave).
//   4. bd        - knee/elbow bend about the mid joint (elbow forward).
//   5. sw        - swing about the root (hip/shoulder); NEGATIVE = forward.
//   6. spread    - rotZ abduction about the arm root, mirrored (arms only).
//   7. lean      - torso lean (adds to the gait's own lean when moving).
//
// GAIT BLEND: posed LEGS give the stance at rest and hand over to the
// gait. Posed ARMS stay ALIVE while moving - the pose is the BASE and
// a damped fraction of the gait's arm motion rides on top:
//   sw_run = pose.sw + gaitArm  * (loco arm swing)
//   bd_run = pose.bd + gaitElbow * (loco elbow pump - its midpoint)
// so the fighter pumps around the grip instead of freezing.

export const POSES = {
  // 1H melee ready, LEFT-handed, redesigned (Mac). Bladed fighting
  // stance: weapon arm raised AND spread off the ribs, blade upright
  // (~9deg) with the EDGES rolled fore-aft toward the opponent
  // (handRoll 1.57 ~= mirrored -90deg over the baked rest roll); guard
  // arm up across the body, palm turned out (handPitch); combat
  // crouch - deep right-lead stagger, both knees bent, slight forward
  // lean. handYaw 0.28 counter-cancels the spread's lateral blade tip
  // (empirically signed: -0.28 doubled it to 31deg; +0.28 -> 4.2deg).
  // Runs alive: guard pumps, weapon arm bobs damped, grip kept
  // (probed: guard-fist z swing 0.117, weapon 0.021, blade 16-40deg
  // through the charge).
  melee1H: {
    lean: 0.10,
    gaitArm: 0.30,
    gaitElbow: 0.22,
    armL: { sw: -0.62, bd: 2.42, spread: 0.28, handRoll: 1.57, handPitch: -0.10, handYaw: 0.28 },
    armR: { sw: -0.55, bd: 1.35, spread: 0.22, handRoll: 0, handPitch: -0.50, handYaw: 0 },
    legL: { sw: 0.16, bd: 0.30 },
    legR: { sw: -0.30, bd: 0.26 },
  },
};
