// The animation runtime, extracted from the viewer (engine-world
// integration slice 1): renderer-AGNOSTIC. animateTarget writes
// T.pos from T.base under gait + pose + clip state and sets T.dirty;
// the host (THREE viewer today, the raw-GL engine next) flushes
// dirty targets to its own buffers. createAnimContext binds the
// joint constants once from the body geometry - identical math to
// the template's former locals (grpRange/grpMeanX).

export function rotX(y, z, pivotY, ang) { const c=Math.cos(ang), sn=Math.sin(ang); const dy=y-pivotY; return [pivotY + c*dy - sn*z, sn*dy + c*z]; }
export function rotZ(x, y, px, py, ang) { const c=Math.cos(ang), s=Math.sin(ang), dx=x-px, dy=y-py; return [px + c*dx - s*dy, py + s*dx + c*dy]; }
export function rotY(x, z, px, pz, ang) { const c=Math.cos(ang), s=Math.sin(ang), dx=x-px, dz=z-pz; return [px + c*dx + s*dz, pz - s*dx + c*dz]; }

export const POSE_L = { strideAmp: 0, counterFrac: 0, kneeBase: 0, kneeAmp: 0, elbowBase: 0, elbowAmp: 0, lean: 0 }; // zero loco for the posed idle
export const IDLE = { strideAmp: 0.05, cadence: 1.7, counterFrac: 1.0, bobAmp: 0.006, kneeAmp: 0.12, kneeBase: 0.0, elbowAmp: 0.12, elbowBase: 0.0, lean: 0 }; // standing sway (canonicalized from interiorContext's pre-animate.js inline loco)
export const WALK = { strideAmp: 0.44, cadence: 6.0, counterFrac: 1.1, bobAmp: 0.024, kneeAmp: 0.9, kneeBase: 0.0,  elbowAmp: 0.35, elbowBase: 0.18, lean: 0.05, kneeR: 4, elbowR: 2 };
export const RUN  = { strideAmp: 0.60, cadence: 9.6, counterFrac: 0.95, bobAmp: 0.075, kneeAmp: 1.5, kneeBase: 0.18, elbowAmp: 0.55, elbowBase: 1.42, lean: 0.42, headPitch: -0.30, kneeR: 4, elbowR: 2 };

export function createAnimContext({ basePos, vgrp, armX, wristY, neckY }) {
  const grpRange = (g) => { let mn=Infinity, mx=-Infinity; for (let i=0;i<vgrp.length;i++) if (vgrp[i]===g) { const y=basePos[i*3+1]; if(y<mn)mn=y; if(y>mx)mx=y; } return [mn,mx]; };
  const grpMeanX = (g) => { let sx=0, n=0; for (let i=0;i<vgrp.length;i++) if (vgrp[i]===g) { sx+=basePos[i*3]; n++; } return n ? sx/n : 0; };
  const [ankL, hipY] = grpRange(4);
  const [wristL, shoulderY] = grpRange(2);
  return {
    hipY, shoulderY,
    kneeY: hipY - 0.52*(hipY-ankL),
    elbowY: shoulderY - 0.50*(shoulderY-wristL),
    wristY, armX, neckY,
    armRootX: { 2: grpMeanX(2), 3: grpMeanX(3) },
  };
}

export function animateTarget(ctx, T, wt, L, bob, pose, moving) {
  const { armRootX, wristY, elbowY, kneeY, hipY, shoulderY, armX, neckY } = ctx;

  const P = T.pos, B = T.base, VG = T.vgrp;
  const leanPivot = hipY + 0.10;                     // lean the upper body about the low spine
  const lean = (L.lean || 0) + (pose && pose.lean || 0);   // pose crouch adds to the gait's own lean
  const twist = (pose && pose.twist) || 0;                 // attack body commitment (rotY about the spine)
  const headPitch = (L.headPitch || 0) + (pose && pose.headPitch || 0); // run look-up + attack follow
  const rX = (pose && pose.rootX) || 0, rY = (pose && pose.rootY) || 0, rZ = (pose && pose.rootZ) || 0; // ROOT MOTION: whole-body translation
  const held = !!T.held;                                   // gripped rigid object: whole hand chain
  const applyLimb = (g, phase, isLeg, limbKey) => {
    const pp = pose && pose[limbKey];
    let swing, bend;
    const gaitSwing = -L.strideAmp * (isLeg ? 1 : L.counterFrac) * Math.sin(wt + phase);
    const gaitBend  = isLeg ? L.kneeBase  + L.kneeAmp  * Math.max(0, Math.sin(wt + phase + 1.2))
                            : L.elbowBase + L.elbowAmp * (0.5 + 0.5*Math.sin(wt + phase - 0.6));
    if (pp && !isLeg) {   // posed arms: pose is the BASE; moving adds runElbow + a damped gait pump (alive, grip kept)
      swing = pp.sw + (moving ? (pose.gaitArm ?? 0) * gaitSwing : 0);
      bend  = pp.bd + (moving ? (pose.runElbow ?? 0) + (pose.gaitElbow ?? 0) * (gaitBend - L.elbowBase - 0.5 * L.elbowAmp) : 0);
    } else if (pp && !moving) { swing = pp.sw; bend = pp.bd; }   // posed legs: stance at rest
    else if (moving) { swing = gaitSwing; bend = gaitBend; }     // gait
    else { swing = 0; bend = 0; }
    const jointY = isLeg ? kneeY : elbowY, rootY = isLeg ? hipY : shoulderY, bendSign = isLeg ? 1 : -1;
    const rollA = pp && !isLeg ? (g === 2 ? -1 : 1) * (pp.handRoll || 0) : 0;
    const pitchA = pp && !isLeg ? (pp.handPitch || 0) : 0;
    const yawA = pp && !isLeg ? (g === 2 ? -1 : 1) * (pp.handYaw || 0) : 0;
    const sprA = pp && !isLeg ? (g === 2 ? -1 : 1) * (pp.spread || 0) : 0;
    const rollH = pp && !isLeg ? (g === 2 ? -1 : 1) * (pp.roll || 0) : 0;   // humeral rotation
    const wpx = g === 2 ? -armX : armX;
    for (let i=0;i<VG.length;i++) if (VG[i]===g) {
      let x = B[i*3], y = B[i*3+1], z = B[i*3+2]; const by = y;   // joint gates read REST y
      if (!isLeg && (held || by < wristY)) {                      // hand chain (pose joints), forearm-axis pivots
        if (rollA)  [x,z] = rotY(x, z, wpx, 0, rollA);
        if (pitchA) [y,z] = rotX(y, z, wristY, pitchA);
        if (yawA)   [x,y] = rotZ(x, y, wpx, wristY, yawA);
      }
      if (held || by < jointY) [y,z] = rotX(y, z, jointY, bendSign*bend);   // knee / elbow
      if (rollH && (held || by < jointY)) [x,z] = rotY(x, z, wpx, 0, rollH); // HUMERAL roll: the bent forearm folds about the upper-arm axis
      [y,z] = rotX(y, z, rootY, swing);                            // hip / shoulder swing
      if (!isLeg && sprA) [x,y] = rotZ(x, y, armRootX[g], shoulderY, sprA); // abduction
      if (!isLeg && twist) [x,z] = rotY(x, z, 0, 0, twist);        // body commitment (arms + held follow the spine)
      if (!isLeg) [y,z] = rotX(y, z, leanPivot, lean);             // arms lean with the torso
      P[i*3] = x + rX; P[i*3+1] = y + bob + rY; P[i*3+2] = z + rZ;
    }
  };
  applyLimb(4, 0, true, 'legL'); applyLimb(5, Math.PI, true, 'legR');   // legs
  applyLimb(2, Math.PI, false, 'armL'); applyLimb(3, 0, false, 'armR'); // arms
  for (let i=0;i<VG.length;i++) if (VG[i]===0 || VG[i]===1) {      // torso + head: twist + lean + bob (head adds pitch)
    let x = B[i*3], y = B[i*3+1], z = B[i*3+2];
    if (VG[i] === 1 && headPitch) [y,z] = rotX(y, z, neckY, headPitch); // look up/down about the neck
    if (twist) [x,z] = rotY(x, z, 0, 0, twist);
    [y,z] = rotX(y, z, leanPivot, lean);
    P[i*3] = x + rX; P[i*3+1] = y + bob + rY; P[i*3+2] = z + rZ;
  }
  T.dirty = true;   // renderer-agnostic: the host flushes dirty targets to its own buffers
}
