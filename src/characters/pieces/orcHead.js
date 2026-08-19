// Orc head furniture: the two lower TUSKS and the heavy BROW shelf.
// These are the only pieces of an orc that are not expressible as a
// girth multiplier on the neutral rig - everything else (the barrel
// chest, the slab shoulders, the heavy jaw) is BUILD_IDENTITY scaling,
// which is why this file is small and the design file is data.
//
// Built in FINAL (compressed) body space - same convention as tail.js
// and hair.js - and tagged 'head' so both ride headPitch with the
// skull instead of hanging in the air when the orc looks up mid-swing.
//
// ANCHORING: the jaw rows this sits on are scaled by BD.jaw at build
// time, so the anchors take the same multiplier. A tusk pinned to the
// unscaled human jaw line sinks into a 1.35-jaw orc's cheek and floats
// off a 0.9-jaw one; passing the build through is what keeps the root
// buried in the lip at every jaw width in the clamp band.

import { HSCALE } from './pieceLoft.js';

// Ivory: warm bone, its own ramp - a tusk shaded off the hide ramp
// reads as a green growth rather than a tooth.
export const IVORY_RAMP = [[92, 84, 66], [124, 114, 92], [156, 146, 120], [188, 178, 150], [214, 206, 180], [236, 230, 210]];

// Head landmarks, PRE-compress (mirroring neutralBody's head loft rows
// so a change there is a one-line change here, not a hunt).
const CHIN_Y = 1.70, JAW_Y = 1.74, CHEEK_Y = 1.79, TEMPLE_Y = 1.85;
const JAW_RX = 0.082, JAW_RZ = 0.105;      // jaw row half-extents
const CHEEK_RX = 0.102, CHEEK_RZ = 0.130;  // cheek row half-extents

function shadeOrc(faces, ramp) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) {
    const it = Math.min(1, Math.max(0.08, (f.n[0] * Lx + f.n[1] * Ly + f.n[2] * Lz) / Ln * 0.9 + 0.18));
    f._i = it; f.c = snap(it);
  }
  return faces;
}

/** Tusks: a pair of lower canines rooted in the jaw and curving UP and
 *  slightly OUT past the upper lip. Tapered square prisms, not cones -
 *  the rig's whole language is faceted, and a smooth cone reads as a
 *  different renderer's asset dropped onto the model.
 *
 *  `size` scales length/thickness only (a warlord's are heavier than a
 *  shaman's); the ROOT position is fixed by the jaw so a big tusk grows
 *  out of the same socket rather than sliding down the chin. */
export function buildTusks(ramp = IVORY_RAMP, { jaw = 1, size = 1 } = {}) {
  const faces = [];
  const quad = (a, b, c, d) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx / L, ny / L, nz / L], g: 'head' });
  };

  // Root: on the jaw ring, off to each side of the chin and forward.
  // Both offsets ride `jaw`, which is what keeps the socket in the lip.
  const rootY = ((CHIN_Y + JAW_Y) / 2) * HSCALE;
  const rootX = JAW_RX * 0.62 * jaw;
  const rootZ = JAW_RZ * 0.72 * jaw;
  // Tip: up past the cheek line, splayed out and back a touch. Height
  // is measured in the SAME compressed space, so a tusk cannot outgrow
  // the face when HSCALE changes.
  const len = (CHEEK_Y - JAW_Y) * HSCALE * 1.45 * size;

  for (const sgn of [-1, 1]) {
    // Four spine nodes, curving up/out/back - a curve, not a spike.
    const nodes = [
      { x: sgn * rootX,               y: rootY,              z: rootZ,         r: 0.019 * size },
      { x: sgn * rootX * 1.12,        y: rootY + len * 0.38, z: rootZ * 0.98,  r: 0.016 * size },
      { x: sgn * rootX * 1.30,        y: rootY + len * 0.74, z: rootZ * 0.88,  r: 0.011 * size },
      { x: sgn * rootX * 1.46,        y: rootY + len,        z: rootZ * 0.74,  r: 0.0025 * size },
    ];
    // Square cross-section (4 sides) = faceted ivory that catches the
    // cel bands the way every other piece on this rig does.
    const ringOf = (n) => [
      [n.x - n.r, n.y, n.z - n.r], [n.x + n.r, n.y, n.z - n.r],
      [n.x + n.r, n.y, n.z + n.r], [n.x - n.r, n.y, n.z + n.r],
    ];
    const rings = nodes.map(ringOf);
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        quad(rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]);
      }
    }
    // Cap the root so the socket is not see-through from below.
    const r0 = rings[0];
    quad(r0[3], r0[2], r0[1], r0[0]);
  }
  return shadeOrc(faces, ramp);
}

/** Brow: a heavy shelf across the forehead, above the eye line and
 *  proud of the face plane. Scales with the SKULL (it is cranium, not
 *  jaw) so it tracks the head it sits on. */
export function buildBrow(ramp, { skull = 1, jut = 1 } = {}) {
  const faces = [];
  const quad = (a, b, c, d) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    faces.push({ p: [...a, ...b, ...c, ...d], n: [nx / L, ny / L, nz / L], g: 'head' });
  };

  const yLo = ((CHEEK_Y + TEMPLE_Y) / 2) * HSCALE;   // eye line
  const yHi = (TEMPLE_Y + 0.020) * HSCALE;           // just under the crown curve
  const halfW = CHEEK_RX * 0.94 * skull;
  const zFace = CHEEK_RZ * 0.86 * skull;             // the face plane
  const zOut = zFace + 0.030 * jut * skull;          // the shelf's leading edge

  // Five columns across the brow so it arcs with the skull instead of
  // sitting as one flat plank bolted to the front of the head.
  const COLS = 5;
  const colX = (i) => -halfW + (2 * halfW) * (i / COLS);
  // Arc: deepest at centre, receding at the temples.
  const arcZ = (x) => zOut - (Math.abs(x) / halfW) ** 2 * (zOut - zFace) * 0.55;

  for (let i = 0; i < COLS; i++) {
    const x0 = colX(i), x1 = colX(i + 1);
    const z0 = arcZ(x0), z1 = arcZ(x1);
    // front face of the shelf
    quad([x0, yLo, z0], [x1, yLo, z1], [x1, yHi, z1], [x0, yHi, z0]);
    // underside (the overhang that shadows the eyes - the whole point)
    quad([x0, yLo, zFace], [x1, yLo, zFace], [x1, yLo, z1], [x0, yLo, z0]);
    // top, blending back into the forehead
    quad([x0, yHi, z0], [x1, yHi, z1], [x1, yHi, zFace], [x0, yHi, zFace]);
  }
  // Cap each end so the shelf does not read as a floating slab.
  for (const sgn of [-1, 1]) {
    const x = sgn * halfW, z = arcZ(x);
    quad([x, yLo, zFace], [x, yLo, z], [x, yHi, z], [x, yHi, zFace]);
  }
  return shadeOrc(faces, ramp);
}
