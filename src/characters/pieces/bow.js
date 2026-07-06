// Bows (templates 129 Short Bow, 130 Long Bow) - ranged weapons on
// the same grip system: authored at the LEFT-fist column, every face
// 'armL' (the bow hand); the DRAW hand is POSED onto the STRING
// STATION by rangedAim, exactly like the claymore's off hand.
//
// GRIP: a bow is held handshake-style - the stave PERPENDICULAR to
// the forearm. GRIP_PITCH is -pi/2 about the grip point, so the
// carried bow lies fore-aft at a hanging arm and stands VERTICAL
// when the aim pose extends the arm forward.
//
// STATIONS (real on-axis rings, per the phantom-axis rule):
//   grip ring at pre-bake y 0.90 (the fist), string ring at the
//   string's midpoint - its centroid is the nock point the draw hand
//   targets. The string is rigid (a thin loft, undrawn line); the
//   DRAW reads through the arm, not string deformation - a geometric
//   simplification at mitten fidelity, same class as the fused hand.
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

const ARM_X = -0.235;
const GRIP_Y = 0.90;
const GRIP_PITCH = -Math.PI / 2;

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

function buildBow(ramp, half) {
  const faces = [];
  const G = { group: 'armL', cx: ARM_X, seg: 8 };
  const lo = GRIP_Y - half, hi = GRIP_Y + half;
  // STAVE: recurve - riser bulges forward at the grip, limbs sweep
  // back to the tips (where the string meets them).
  const limb = (t) => -0.05 + 0.082 * Math.sin(Math.PI * t);   // cz along the stave (t 0..1)
  const rows = [];
  const N = 8;
  for (let k = 0; k <= N; k++) {
    const t = k / N, y = lo + (hi - lo) * t;
    const taper = 0.009 + 0.016 * Math.sin(Math.PI * t);
    rows.push({ y, rx: taper, rz: taper + 0.004, cz: limb(t) });
  }
  // grip station: a fatter wrap ring exactly at the bake pivot
  rows.push({ y: GRIP_Y, rx: 0.028, rz: 0.032, cz: limb(0.5) });
  loftPiece(faces, rows, G);
  // STRING: DRAWN - two thin segments tip -> NOCK -> tip, the nock
  // pulled 0.25 toward the archer. The aim pose IS the drawn
  // bow (the pose is aiming); the NOCK STATION ring sits at the pull
  // point and is what the draw hand targets - an undrawn string put
  // the station out by the bow, outside the draw arm's reach.
  const NOCK_CZ = 0.30;   // authoring-space + = the ARCHER side after the -pi/2 bake (rest-above-grip -> behind the fist at aim)
  loftPiece(faces, [
    { y: lo + 0.012, rx: 0.0035, rz: 0.0035, cz: -0.05 },
    { y: GRIP_Y - 0.02, rx: 0.0035, rz: 0.0035, cz: NOCK_CZ - 0.012 },
  ], { ...G, seg: 6, capTop: false, capBottom: false });
  loftPiece(faces, [
    { y: GRIP_Y + 0.02, rx: 0.0035, rz: 0.0035, cz: NOCK_CZ - 0.012 },
    { y: hi - 0.012, rx: 0.0035, rz: 0.0035, cz: -0.05 },
  ], { ...G, seg: 6, capTop: false, capBottom: false });
  // NOCK STATION: pre-bake (0.90, +0.30) -> post-bake above the grip
  // at rest, at the CHEEK LINE when the arm extends to aim.
  loftPiece(faces, [
    { y: GRIP_Y - 0.012, rx: 0.007, rz: 0.007, cz: NOCK_CZ },
    { y: GRIP_Y + 0.012, rx: 0.007, rz: 0.007, cz: NOCK_CZ },
  ], { ...G, seg: 8, capTop: true, capBottom: true });
  return compress(shadePiece(bakeGrip(faces), ramp));
}

// THE NOCKED ARROW (template 131) - its OWN piece/target since the
// projectile arc: nocked, it rides the armL chain exactly like the
// bow (alignment by construction); at the verbatim bow hit frame it
// LOOSES - detaches into straight flight along its own axis at the
// DFU missile speed. One arrow serves both bows.
export function buildNockedArrow(ramp) {
  const faces = [];
  const G = { group: 'armL', cx: ARM_X, seg: 6 };
  const NOCK_CZ = 0.30;
  // loftPiece is Y-only: author the arrow along Y, then rotate it
  // locally onto the cz (aim) axis about the grip line before the
  // shared bake carries everything. Y +0.29 (tail) .. -0.24 (head)
  // maps to cz +0.29 .. -0.24.
  const arrow = [];
  loftPiece(arrow, [
    { y: GRIP_Y - 0.24, rx: 0.002, rz: 0.002 },       // point
    { y: GRIP_Y - 0.20, rx: 0.013, rz: 0.013 },       // head base
    { y: GRIP_Y - 0.19, rx: 0.0045, rz: 0.0045 },     // shaft
    { y: GRIP_Y + 0.19, rx: 0.0045, rz: 0.0045 },
    { y: GRIP_Y + 0.20, rx: 0.012, rz: 0.012 },       // fletching
    { y: GRIP_Y + 0.27, rx: 0.012, rz: 0.012 },
    { y: GRIP_Y + 0.29, rx: 0.004, rz: 0.004 },       // tail at the nock
  ], { ...G, seg: 6 });
  const AROT = Math.PI / 2;   // +y -> +cz (sign probed at the module)
  const ac = Math.cos(AROT), as = Math.sin(AROT);
  for (const f of arrow) {
    for (let i = 0; i < 4; i++) {
      const dy = f.p[i*3+1] - GRIP_Y, z = f.p[i*3+2];
      f.p[i*3+1] = GRIP_Y + ac*dy - as*z;
      f.p[i*3+2] = as*dy + ac*z;
    }
    const ny = f.n[1], nz = f.n[2];
    f.n[1] = ac*ny - as*nz; f.n[2] = as*ny + ac*nz;
    faces.push(f);
  }
  return compress(shadePiece(bakeGrip(faces), ramp));
}

export function buildLongBow(ramp) { return buildBow(ramp, 0.62); }
export function buildShortBow(ramp) { return buildBow(ramp, 0.44); }
