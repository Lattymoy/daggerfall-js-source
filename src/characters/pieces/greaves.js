// Greaves (leg armour): designed plate on the neutral rig, INSPIRED by
// the classic. Hip fauld over the pelvis + per-leg plate (thigh ->
// knee poleyn -> shin), sitting just outside the leg. Thinner than the
// first pass. Sprites kept for the inventory icon.
import { loftPiece, shadePiece, compress, STEEL_RAMP } from './pieceLoft.js';

const LEG_X = 0.082; // mirror neutralBody.js

export function buildGreaves(ramp) {
  const faces = [];
  const P = 0.6;
  // Hip fauld (skirt) over the pelvis.
  loftPiece(faces, [
    { y: 1.140, rx: 0.182, rz: 0.098, p: P }, // overlaps UNDER the cuirass hem (no waist gap)
    { y: 1.040, rx: 0.202, rz: 0.108, p: P }, // flare (widest)
    { y: 0.930, rx: 0.196, rz: 0.104, p: P },
    { y: 0.870, rx: 0.188, rz: 0.100, p: P }, // hem over the thigh tops
  ], { group: 'body' }); // fauld rides the pelvis
  // Per-leg plate: thin offset over the leg (thigh -> poleyn -> shin).
  const legPlate = (sign) => loftPiece(faces, [
    { y: 0.900, rx: 0.132, rz: 0.134, p: P }, // upper thigh guard
    { y: 0.720, rx: 0.120, rz: 0.122, p: P }, // thigh
    { y: 0.560, rx: 0.100, rz: 0.102, p: P }, // above knee
    { y: 0.500, rx: 0.106, rz: 0.112, p: P }, // knee poleyn
    { y: 0.420, rx: 0.090, rz: 0.093, p: P }, // upper shin
    { y: 0.260, rx: 0.072, rz: 0.075, p: P }, // shin
    { y: 0.150, rx: 0.056, rz: 0.059, p: P }, // ankle
  ], { cx: sign * LEG_X, group: sign < 0 ? 'legL' : 'legR' }); // swings with the leg
  legPlate(-1); legPlate(1);
  compress(faces);
  return shadePiece(faces, ramp);
}
