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

// THE GRIP (Mac's reference photo, 2026-07-05): a sword is NOT held
// collinear with the forearm - the handle crosses the palm, so with
// the arm hanging the blade sweeps UP-FORWARD (~42deg off vertical)
// and the pommel sits low behind the fist. Baked as a rotation of the
// whole sword (verts + normals) about the GRIP POINT in the y-z
// plane; every arm/pose/gait transform then carries the correct grip
// for free.
const GRIP_Y = 0.90;          // grip point inside the fist (pre-HSCALE)
const GRIP_PITCH = -2.40 + Math.PI / 4;   // Mac: swd pitch +45deg baked (2026-07-05) - near-horizontal point-forward carry

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
  // 0.90 = the GRIP STATION: real on-axis vertices at the bake pivot
  // (a leather collar) so the true hilt anchor reads as the ring
  // centroid - end-only tubes put "nearest vert to the grip" 0.1 off
  // axis (the phantom-axis bug).
  loftPiece(faces, [
    { y: 0.790, rx: 0.015, rz: 0.016 },
    { y: 0.900, rx: 0.0165, rz: 0.0175 },
    { y: 0.998, rx: 0.015, rz: 0.016 },
  ], { ...G, capTop: false, capBottom: false });
  // CROSSGUARD: broad cruciform bar, wide across x, squarish section.
  loftPiece(faces, [
    { y: 0.766, rx: 0.015, rz: 0.084, p: 0.45 },
    { y: 0.792, rx: 0.017, rz: 0.090, p: 0.45 },
  ], G);
  // BLADE: flat tapered loft - wide edge-to-edge in Z (the swing
  // plane, so the FLAT faces sideways like the reference once the
  // grip pitch is baked), thin through in X; straight taper to a point.
  loftPiece(faces, [
    { y: 0.766, rx: 0.009, rz: 0.030, p: 0.55 },
    { y: 0.560, rx: 0.0085, rz: 0.028, p: 0.55 },
    { y: 0.340, rx: 0.008, rz: 0.024, p: 0.55 },
    { y: 0.150, rx: 0.006, rz: 0.016, p: 0.55 },
    { y: 0.068, rx: 0.003, rz: 0.003, p: 0.55 }, // point
  ], { ...G, capTop: false });
  return compress(shadePiece(bakeGrip(faces), ramp));
}
