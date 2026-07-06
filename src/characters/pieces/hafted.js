// The hafted family (Daggerfall 115 Staff, 124 Mace, 125 Flail, 126
// Warhammer, 127 Battle Axe, 128 War Axe): ONE parameterized builder
// on the grip system. House layout: the business end DESCENDS below
// the grip (the seat bake maps down to point-forward carry).
//   - 1H (Mace, Battle Axe): longsword grip + station, inherit
//     melee1H + ATTACKS_1H free.
//   - 2H (Staff, Flail, Warhammer, War Axe): the CLAYMORE-STANDARD
//     grip block - the off-hand station at (-0.235, 0.8038, -0.1578)
//     is the 2H CONTRACT: solved melee2H pose + station-coupled
//     attack tracks transfer by construction.
// Fidelity notes: the flail's chain-and-ball is RIGID (a thin tube +
// ball along the haft line - same simplification class as the drawn
// bow string); axe blades are flat plates hanging forward of the
// shaft (single-bit) or both sides (double-bit war axe).
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

const ARM_X = -0.235;
const GRIP_Y = 0.90;
const GRIP_PITCH = -2.40 + Math.PI / 4;   // Mac's +45 seat, family-wide

function bakeGrip(faces) {
  const c = Math.cos(GRIP_PITCH), s = Math.sin(GRIP_PITCH);
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      const dy = f.p[i*3+1] - GRIP_Y, z = f.p[i*3+2];
      f.p[i*3+1] = GRIP_Y + c*dy - s*z;
      f.p[i*3+2] = s*dy + c*z;
    }
    const ny = f.n[1], nz = f.n[2];
    f.n[1] = c*ny - s*nz; f.n[2] = s*ny + c*nz;
  }
  return faces;
}

// spec: { twoHand, shaft, shaftR, head, staffUp }
function buildHafted(ramp, spec) {
  const faces = [];
  const G = { group: 'armL', cx: ARM_X, seg: 8 };
  const sR = spec.shaftR ?? 0.020;   // girth pass (Mac 2026-07-06)
  let gripLo;
  if (spec.twoHand) {
    gripLo = 0.720;
    loftPiece(faces, [
      { y: 0.720, rx: 0.026, rz: 0.027 },
      { y: 0.740, rx: 0.028, rz: 0.029 },
      { y: 0.900, rx: 0.028, rz: 0.029 },
      { y: 1.058, rx: 0.026, rz: 0.027 },
    ], { ...G, capTop: false, capBottom: false });
  } else {
    gripLo = 0.790;
    loftPiece(faces, [
      { y: 0.790, rx: 0.019, rz: 0.020 },
      { y: 0.900, rx: 0.021, rz: 0.022 },
      { y: 0.998, rx: 0.019, rz: 0.020 },
    ], { ...G, capTop: false, capBottom: false });
  }
  // butt cap above the grip
  const bTop = spec.twoHand ? 1.058 : 0.998;
  loftPiece(faces, [
    { y: bTop, rx: sR + 0.003, rz: sR + 0.003 },
    { y: bTop + (spec.staffUp ?? 0.028), rx: spec.staffUp ? sR : 0.006, rz: spec.staffUp ? sR : 0.006 },
  ], G);
  // shaft descending to the head seat
  const headY = gripLo - 0.02 - spec.shaft;
  loftPiece(faces, [
    { y: gripLo - 0.002, rx: sR, rz: sR },
    { y: headY + 0.02, rx: sR, rz: sR },
  ], { ...G, capTop: false, capBottom: false });
  // heads
  if (spec.head === 'mace') {
    loftPiece(faces, [
      { y: headY + 0.02, rx: 0.022, rz: 0.022 },
      { y: headY - 0.02, rx: 0.070, rz: 0.070 },
      { y: headY - 0.12, rx: 0.078, rz: 0.078 },
      { y: headY - 0.17, rx: 0.026, rz: 0.026 },
    ], G);
  } else if (spec.head === 'axe' || spec.head === 'waraxe') {
    const sides = spec.head === 'waraxe' ? [0.082, -0.082] : [0.075];
    for (const off of sides) {
      loftPiece(faces, [
        { y: headY + 0.08, rx: 0.013, rz: 0.082, p: 0.5, cz: off * 0.45 },
        { y: headY - 0.03, rx: 0.016, rz: 0.140, p: 0.5, cz: off },
        { y: headY - 0.14, rx: 0.013, rz: 0.082, p: 0.5, cz: off * 0.45 },
      ], G);
    }
    loftPiece(faces, [   // poll/spike cap
      { y: headY + 0.02, rx: 0.016, rz: 0.016 },
      { y: headY - 0.05, rx: 0.012, rz: 0.012 },
    ], G);
  } else if (spec.head === 'hammer') {
    loftPiece(faces, [
      { y: headY + 0.04, rx: 0.060, rz: 0.060, cz: 0.026 },
      { y: headY - 0.08, rx: 0.068, rz: 0.068, cz: 0.032 },
      { y: headY - 0.13, rx: 0.030, rz: 0.030, cz: 0.016 },
    ], G);
  } else if (spec.head === 'ball') {
    // rigid chain + ball continuing down the haft line
    loftPiece(faces, [
      { y: headY + 0.02, rx: 0.009, rz: 0.009 },
      { y: headY - 0.10, rx: 0.009, rz: 0.009 },
    ], { ...G, capTop: false, capBottom: false });
    loftPiece(faces, [
      { y: headY - 0.10, rx: 0.016, rz: 0.016 },
      { y: headY - 0.16, rx: 0.055, rz: 0.055 },
      { y: headY - 0.22, rx: 0.018, rz: 0.018 },
    ], G);
  } else {
    loftPiece(faces, [   // staff foot
      { y: headY + 0.02, rx: sR + 0.002, rz: sR + 0.002 },
      { y: headY - 0.02, rx: 0.007, rz: 0.007 },
    ], G);
  }
  return compress(shadePiece(bakeGrip(faces), ramp));
}

export const HAFTED_SPECS = {
  Mace:       { shaft: 0.44, head: 'mace' },
  Battle_Axe: { shaft: 0.56, head: 'axe' },
  Staff:      { shaft: 0.72, shaftR: 0.011, staffUp: 0.34, twoHand: true },
  Flail:      { shaft: 0.36, head: 'ball', twoHand: true },
  Warhammer:  { shaft: 0.62, head: 'hammer', twoHand: true },
  War_Axe:    { shaft: 0.64, head: 'waraxe', twoHand: true },
};

export function buildHaftedWeapon(ramp, name) {
  return buildHafted(ramp, HAFTED_SPECS[name]);
}
