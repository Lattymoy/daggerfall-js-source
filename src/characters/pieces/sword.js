// The Longsword, held in the rig's right fist. Authored in rest space
// (pre-HSCALE, like every piece): the mitten grips a vertical hilt, so
// at rest the blade hangs point-down beside the leg (a natural carry),
// and the melee1H pose / gait transforms carry it rigidly - every face
// is tagged 'armR', so it folds with the forearm about the elbow and
// swings about the shoulder exactly like the arm (no separate weapon
// transform). Right fist: cx = ARM_X 0.235, palm y 0.82..0.985.
//
// Proportions from the body's 2.0-unit (~180cm) height: 0.50-unit
// blade (~90cm longsword), cruciform guard, round grip + pommel.
// Shading = the classic metal ramp for the item's material
// (weapons.js weaponMaterialRamp over dyes METAL_TABLES + ART_PAL).
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

const ARM_X = 0.235; // right-fist column (mirrors neutralBody)

export function buildSword(ramp) {
  const faces = [];
  const G = { group: 'armR', cx: ARM_X, seg: 10 };
  // POMMEL: round counterweight above the fist.
  loftPiece(faces, [
    { y: 0.998, rx: 0.010, rz: 0.010 },
    { y: 1.012, rx: 0.017, rz: 0.017 },
    { y: 1.030, rx: 0.013, rz: 0.013 },
  ], G);
  // GRIP: through the fist (hidden inside the mitten), a leather-thin
  // column; visible only in the gap between fingertips and guard.
  loftPiece(faces, [
    { y: 0.795, rx: 0.011, rz: 0.012 },
    { y: 0.998, rx: 0.011, rz: 0.012 },
  ], { ...G, capTop: false, capBottom: false });
  // CROSSGUARD: cruciform bar, wide across x, squarish section.
  loftPiece(faces, [
    { y: 0.773, rx: 0.058, rz: 0.011, p: 0.45 },
    { y: 0.793, rx: 0.062, rz: 0.012, p: 0.45 },
  ], G);
  // BLADE: flat tapered loft - wide edge-to-edge (rx), thin through
  // (rz), low p for a faceted lens section; straight taper to a point.
  loftPiece(faces, [
    { y: 0.773, rx: 0.021, rz: 0.007, p: 0.55 },
    { y: 0.620, rx: 0.020, rz: 0.0065, p: 0.55 },
    { y: 0.460, rx: 0.017, rz: 0.006, p: 0.55 },
    { y: 0.340, rx: 0.012, rz: 0.005, p: 0.55 },
    { y: 0.283, rx: 0.002, rz: 0.002, p: 0.55 }, // point
  ], { ...G, capTop: false });
  return compress(shadePiece(faces, ramp));
}
