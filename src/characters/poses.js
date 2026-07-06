// Static poses for the neutral rig - FULL joint set (v2), matching the
// viewer tuner's proven transforms exactly (pivots, order, mirroring):
//
//   arms: { sw, bd, spread, roll, handRoll, handPitch, handYaw }
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
//   4b. roll     - HUMERAL rotation (arms): the bent forearm + hand
//                  swing about the upper-arm axis (rotY about the arm
//                  column at the elbow), mirrored. The missing DOF
//                  that lets an elbow fold ACROSS instead of only
//                  forward - without it a cross-body reach contorts.
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
  // 2H melee ready (Claymore): BOTH hands on the hilt in front of the
  // body, blade up-forward. The weapon rides the LEFT (dominant)
  // chain; the RIGHT arm is posed so its fist lands on the hilt one
  // fist pommel-ward of the left. Values SOLVED by the two-stage grip
  // sweep: left fist to the centreline hilt seat (-0.09,0.88,0.33),
  // right fist onto the OFF-HAND STATION ring (dist 0.050; the first
  // solve aimed at a phantom axis - see the grip-station note in
  // C-Weapons). Blade up-forward, left fist 0.012 off the true hilt
  // line, 84deg wrap. LOCKED GRIP through the gait: gaitArm/gaitElbow/
  // runElbow are 0 - the coupled hands must not pump apart; life
  // comes from lean, bob and the root. Square-ish right-lead stance.
  melee2H: {
    lean: 0.06,
    gaitArm: 0,
    gaitElbow: 0,
    runElbow: 0,
    armL: { sw: -0.23, bd: 0.60, spread: -0.25, handRoll: 0, handPitch: 0, handYaw: 0 },
    armR: { sw: -0.10, bd: 0.33, spread: -0.42, handRoll: 0, handPitch: 0, handYaw: 0 },
    legL: { sw: 0.12, bd: 0.18 },
    legR: { sw: -0.18, bd: 0.14 },
  },
  // RANGED AIM (bows): bow arm extended (the perpendicular grip bake
  // stands the stave near-vertical at the extended arm, 13deg), draw
  // fist ON the drawn string's NOCK STATION (solved to 0.002). The
  // aim line follows the bladed frame, not world +z - facing is the
  // game's job. Locked through the gait like 2H.
  rangedAim: {
    lean: 0.05,
    twist: 0.65,    // BLADED archer, CORRECT form: bow shoulder forward, draw shoulder back. FORM IS A CONSTRAINT, NOT AN OUTCOME - a reach-optimizing twist sweep once inverted the stance (draw shoulder led by 0.24; Mac: "the left arm looks so off"); with the seat frame-fixed, positive twist reaches the nock at 0.011.
    gaitArm: 0,
    gaitElbow: 0,
    runElbow: 0,
    armL: { sw: -1.50, bd: 0, spread: -0.285, handRoll: 0, handPitch: 0, handYaw: 0 },
    armR: { sw: -0.69, bd: 1.035, spread: -0.875, roll: -1.315, handRoll: 0, handPitch: 0, handYaw: 0 },   // draw arm: upper arm out-back, forearm FOLDED ACROSS by the humeral roll (elbow x +0.15 below the shoulder) - the railed -1.5 cross-spread contorted (Mac); the roll DOF dissolves it at nock 0.012
    legL: { sw: 0.10, bd: 0.10 },
    legR: { sw: -0.16, bd: 0.10 },
  },
  // FIRST-PERSON 1H ready: the viewmodel state - weapon raised into
  // the eye's frame (classic DF ready), gait pumps OFF so the
  // viewmodel holds steady; the camera carries the bob instead.
  // NOTE: left-handed viewmodel (the rig is left-dominant); a
  // render-time mirror can flip the frame if wanted. Solved in VIEW
  // SPACE (fist low-left NDC, blade raked up across, near-plane
  // clear).
  fpMelee1H: {
    lean: 0.02,
    gaitArm: 0,
    gaitElbow: 0,
    runElbow: 0,
    armL: { sw: -1.56, bd: 0.14, spread: 0.11, handRoll: 0, handPitch: 0.91, handYaw: -0.11, },   // VIEW-SPACE solved: fist NDC (0.40,-0.52) bottom-right, tip (0.08,0.76) raked tall, near-plane clean, whole blade in frame
    armR: { sw: -0.15, bd: 0.35, spread: -0.10, handRoll: 0, handPitch: 0, handYaw: 0 },
    legL: { sw: 0.08, bd: 0.08 },
    legR: { sw: -0.12, bd: 0.08 },
  },
};
