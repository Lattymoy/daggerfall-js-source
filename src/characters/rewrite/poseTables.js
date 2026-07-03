// Vendored from project-final's Rewrite Engine (rewrite/rig/poseTables.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json.
// Do not hand-diverge: upstream first, then re-vendor + re-capture.
// Pose + locomotion data tables (carved from body.js on the ceiling
// breach - pure data, byte-identical move; the assembly stays there).
export const CROUCH_STANCE = { leadSide: 1, leadX: 0.16, leadFwd: 0.15, leadY: 0.06, leadPitch: -3, trailX: 0.13, trailBack: 0.11, trailY: 0.06, trailPitch: -10, crouchWeight: 0.02 }; // staggered crouch ready-stance: lead foot fwd + flat, trail foot back on the ball, weight listed onto the back leg (asymmetric, slide-style)
export const WALK_GRIP = { rhX: 0.0225, rhY: -0.0575, rhZ: -0.075, rhPitch: -14, rhYaw: -16, rhRoll: 0, rCurl: 0, rHandSize: 0.25, rfCurl: 0.4, rfSpread: 0.5, rfLen: 0.6, rtCurl: 1.6, rtSpread: 0.6, lhX: -0.0125, lhY: -0.03, lhZ: -0.01, lhPitch: 4, lhYaw: -22, lhRoll: -90, lCurl: 1.5, lHandSize: 0.25, lfCurl: 2, lfSpread: 0.6, lfLen: 0.56, ltCurl: 1.75, ltSpread: 0.6 };
export const PISTOL_GRIP = { rhX: 0.03, rhY: 0.03, rhZ: -0.0975, rhPitch: 13, rhYaw: 0, rhRoll: 203, rCurl: 1.25, rHandSize: 0.23, rfCurl: 0.65, rfSpread: 0.85, rfLen: 0.6, rtCurl: 0.6, rtSpread: 0.45, lhX: -0.0375, lhY: 0.0375, lhZ: -0.0675, lhPitch: 0, lhYaw: 189, lhRoll: 0, lCurl: 0.95, lHandSize: 0.23, lfCurl: 1.25, lfSpread: 0.85, lfLen: 0.66, ltCurl: 1.5, ltSpread: 0.45 };
export const WALK_AIMED = { scale: 0.16, gunX: 0.165, gunY: 1.48, gunZ: 0.42, gunPitch: -3, gunYaw: 0, gunRoll: 0, rPoleX: 0.6, rPoleY: -1, rPoleZ: -0.3, lPoleX: -0.5, lPoleY: -1, lPoleZ: -0.1 };
export const RUN_AIMED = { scale: 0.16, gunX: -0.015, gunY: 1.42, gunZ: 0.345, gunPitch: 16, gunYaw: -45, gunRoll: -1, rPoleX: 0.6, rPoleY: -1, rPoleZ: -0.3, lPoleX: -0.5, lPoleY: -1, lPoleZ: -0.1 };
export const PISTOL_AIMED = { scale: 0.18, gunX: 0.05, gunY: 1.6, gunZ: 0.7, gunPitch: 0, gunYaw: 0, gunRoll: 0, rPoleX: 1.45, rPoleY: -1.5, rPoleZ: -1.5, lPoleX: -0.45, lPoleY: -0.6, lPoleZ: 0.7 };
export const SLIDE_POSE = { crouch: 0.53, leadSide: 1, leadFwd: 0.74, leadY: 0.04, leadPitch: 3, trailBack: 0.19, trailY: 0.07, trailPitch: -65 }; // slide leg targets (inert for non-slide states)
export const ZERO_LOCO = { strideAmp: 0, liftAmp: 0, cadence: 0, bobAmp: 0, swayAmp: 0, pelvisYaw: 0, pelvisRoll: 0, pelvisPitch: 0, chestLean: 0, counterFrac: 1, lateralFlex: 0, weaponBob: 0, gaitPhase: 0 };
export const WALK_LOCO = { strideAmp: 0.44, liftAmp: 0.2, cadence: 6, bobAmp: 0.024, swayAmp: 0.002, pelvisYaw: 15, pelvisRoll: 0, pelvisPitch: 0, chestLean: 2.5, counterFrac: 1.1, lateralFlex: -0.5, weaponBob: 0.018, gaitPhase: 0 };
export const RUN_LOCO = { strideAmp: 0.5, liftAmp: 0.3, cadence: 9.6, bobAmp: 0.072, swayAmp: 0.002, pelvisYaw: -2, pelvisRoll: -1.5, pelvisPitch: 2, chestLean: 23, counterFrac: 0.75, lateralFlex: 0.5, weaponBob: 0.05, gaitPhase: 80 };
export const RUN_LOCO_PISTOL = { strideAmp: 0.5, liftAmp: 0.3, cadence: 9.6, bobAmp: 0.062, swayAmp: 0.01, pelvisYaw: 4.5, pelvisRoll: 0, pelvisPitch: -3.5, chestLean: 14, counterFrac: 0.7, lateralFlex: 1, weaponBob: 0.05, gaitPhase: 0 }; // pistol-run dial (own object; diverged from rifle RUN_LOCO)
export const STRAFE_LOCO = { strideAmp: 0.34, liftAmp: 0.15, cadence: 5.5, bobAmp: 0.022, swayAmp: 0.025, pelvisYaw: 4, pelvisRoll: 5, pelvisPitch: 0, chestLean: 2, counterFrac: 0.3, lateralFlex: 0, weaponBob: 0.018, gaitPhase: 0 }; // sidestep: body faces forward (low twist/counter), hips list + sway, gait strides along moveDir (omnidirectional)
export const SLIDE_LOCO = { ...ZERO_LOCO, pelvisYaw: 2.5, pelvisRoll: 1, pelvisPitch: -4.5, chestLean: 9, ...SLIDE_POSE };
export const CROUCH_LOCO = { ...ZERO_LOCO, crouch: 0.3, ...CROUCH_STANCE }; // stationary crouch: pelvis drop + asymmetric planted stance (posed in the normal branch)
export const CROUCHWALK_LOCO = { ...WALK_LOCO, crouch: 0.3, strideAmp: 0.3, liftAmp: 0.09, cadence: 5, bobAmp: 0.02, chestLean: 4, pelvisYaw: 9 }; // moving crouch: a low, short strided gait carried under the pelvis drop
