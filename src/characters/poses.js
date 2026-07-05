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
  // 1H melee ready, LEFT-handed, v4 - matched to Mac's grip reference
  // (2026-07-05): the LOW READY. Weapon arm HANGS with a soft elbow
  // (the baked sword grip does the work - blade rides up-forward
  // ~47deg on its own; the mesh's wide axis lives in the swing plane
  // so the flat already faces sideways - no roll). Off arm relaxed. Easy right-lead
  // stagger, soft knees, near-upright torso. The low arm swings with
  // the gait (gaitArm 0.55) so the blade genuinely sweeps at a run.
  melee1H: {
    lean: 0.03,
    gaitArm: 0.55,
    gaitElbow: 0.35,
    runElbow: 0.55,   // extra elbow bend while moving (Mac: elbows bend when running)
    armL: { sw: -0.04, bd: 0.08, spread: 0.06, handRoll: 0, handPitch: 0, handYaw: 0 },
    armR: { sw: -0.05, bd: 0.12, spread: 0.04, handRoll: 0, handPitch: 0, handYaw: 0 },
    legL: { sw: 0.08, bd: 0.08 },
    legR: { sw: -0.14, bd: 0.10 },
  },
};
