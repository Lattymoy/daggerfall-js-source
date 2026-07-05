// The Longsword, held in the rig's LEFT fist. Authored in rest space
// (pre-HSCALE, like every piece): the mitten grips a vertical hilt, so
// at rest the blade hangs point-down beside the leg (a natural carry),
// and the melee1H pose / gait transforms carry it rigidly - every face
// is tagged 'armL', so it folds with the forearm about the elbow and
// swings about the shoulder exactly like the arm (no separate weapon
// transform). Left fist: cx = -ARM_X 0.235, palm y 0.82..0.985.
//
// Proportions from the body's 2.0-unit (~180cm) height: a big 0.70-unit
// blade (~126cm - a hand-and-a-half presence), broad cruciform guard,
// round grip + pommel. Shading = the classic metal ramp for the item's
// material (weapons.js weaponMaterialRamp over dyes METAL_TABLES +
// ART_PAL).
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

const ARM_X = -0.235; // left-fist column (mirrors neutralBody)

export function buildSword(ramp) {
  const faces = [];
  const G = { group: 'armL', cx: ARM_X, seg: 10 };
  // POMMEL: round counterweight above the fist.
  loftPiece(faces, [
    { y: 0.998, rx: 0.014, rz: 0.014 },
    { y: 1.018, rx: 0.024, rz: 0.024 },
    { y: 1.042, rx: 0.018, rz: 0.018 },
  ], G);
  // GRIP: through the fist (hidden inside the mitten), a leather-thin
  // column; visible only in the gap between fingertips and guard.
  loftPiece(faces, [
    { y: 0.790, rx: 0.015, rz: 0.016 },
    { y: 0.998, rx: 0.015, rz: 0.016 },
  ], { ...G, capTop: false, capBottom: false });
  // CROSSGUARD: broad cruciform bar, wide across x, squarish section.
  loftPiece(faces, [
    { y: 0.766, rx: 0.084, rz: 0.015, p: 0.45 },
    { y: 0.792, rx: 0.090, rz: 0.017, p: 0.45 },
  ], G);
  // BLADE: flat tapered loft - wide edge-to-edge (rx), thin through
  // (rz), low p for a faceted lens section; straight taper to a point.
  loftPiece(faces, [
    { y: 0.766, rx: 0.030, rz: 0.009, p: 0.55 },
    { y: 0.560, rx: 0.028, rz: 0.0085, p: 0.55 },
    { y: 0.340, rx: 0.024, rz: 0.008, p: 0.55 },
    { y: 0.150, rx: 0.016, rz: 0.006, p: 0.55 },
    { y: 0.068, rx: 0.003, rz: 0.003, p: 0.55 }, // point
  ], { ...G, capTop: false });
  return compress(shadePiece(faces, ramp));
}
