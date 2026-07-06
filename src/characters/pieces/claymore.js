// The Claymore (template 122, 2H) - a greatsword on the same grip
// system as the Longsword: authored at the LEFT-fist column, every
// face tagged 'armL' (the dominant-hand chain carries it; the OFF
// hand is POSED onto the hilt by melee2H, not parented). Same baked
// GRIP SEAT as the Longsword (Mac's +45: -2.40 + pi/4 about the grip
// point y 0.90), so the seat sliders and every pose/gait/attack
// transform apply unchanged.
//
// Proportions vs the Longsword: 0.95-unit blade (~171cm overall),
// broad quillons, a LONG two-hand grip (0.34 units - two fists and a
// gap, pommel-ward of the guard) and a heavy wheel pommel. Blade wide
// axis in Z (swing plane) per the reference convention.
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

const ARM_X = -0.235;
const GRIP_Y = 0.90;
const GRIP_PITCH = -2.40 + Math.PI / 4;

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

export function buildClaymore(ramp) {
  const faces = [];
  const G = { group: 'armL', cx: ARM_X, seg: 10 };
  // WHEEL POMMEL: heavy counterweight at the hilt's top.
  loftPiece(faces, [
    { y: 1.058, rx: 0.016, rz: 0.016 },
    { y: 1.078, rx: 0.030, rz: 0.030 },
    { y: 1.104, rx: 0.022, rz: 0.022 },
  ], G);
  // TWO-HAND GRIP: dominant fist sits at the grip point (0.82..0.985
  // through the mitten); the hilt runs pommel-ward 0.72..1.058 so the
  // off hand has a full fist of handle above it.
  // 0.90 = the GRIP STATION (bake pivot; dominant fist), 0.74 = the
  // OFF-HAND STATION - real on-axis rings so the true hilt anchor and
  // axis read as ring centroids (the phantom-axis bug: end-only tubes
  // put "nearest vert to the grip" 0.1+ off axis).
  loftPiece(faces, [
    { y: 0.720, rx: 0.016, rz: 0.017 },
    { y: 0.740, rx: 0.0175, rz: 0.0185 },
    { y: 0.900, rx: 0.0175, rz: 0.0185 },
    { y: 1.058, rx: 0.016, rz: 0.017 },
  ], { ...G, capTop: false, capBottom: false });
  // BROAD CRUCIFORM GUARD: quillons in the flat plane (wide z).
  loftPiece(faces, [
    { y: 0.694, rx: 0.018, rz: 0.118, p: 0.45 },
    { y: 0.724, rx: 0.020, rz: 0.126, p: 0.45 },
  ], G);
  // BLADE: 0.95 units, wide-in-z flat, straight taper to the point.
  loftPiece(faces, [
    { y: 0.694, rx: 0.010, rz: 0.036, p: 0.55 },
    { y: 0.420, rx: 0.0095, rz: 0.034, p: 0.55 },
    { y: 0.120, rx: 0.009, rz: 0.030, p: 0.55 },
    { y: -0.150, rx: 0.007, rz: 0.020, p: 0.55 },
    { y: -0.256, rx: 0.003, rz: 0.003, p: 0.55 }, // point
  ], { ...G, capTop: false });
  return compress(shadePiece(bakeGrip(faces), ramp));
}
