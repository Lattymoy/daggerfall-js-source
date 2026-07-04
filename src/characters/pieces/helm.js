// Helm (107): a simple medieval helm - a rounded dome that stops at the
// brow, plus two cheek guards hanging down the sides. One loft, no
// carving. Separate mesh, tagged 'head'.
import { loftPiece, shadePiece, compress } from './pieceLoft.js';

export function buildHelm(ramp) {
  const faces = [];
  const P = 0.78;
  // Dome: crown down to the brow, covers the whole skull. Capped top.
  loftPiece(faces, [
    { y: 2.070, rx: 0.052, rz: 0.058, p: P, cz: -0.012 }, // crown
    { y: 2.010, rx: 0.108, rz: 0.122, p: P, cz: -0.016 }, // upper skull
    { y: 1.945, rx: 0.140, rz: 0.152, p: P, cz: -0.014 }, // widest
    { y: 1.885, rx: 0.144, rz: 0.156, p: P, cz: -0.008 }, // brow line
    { y: 1.855, rx: 0.140, rz: 0.150, p: P, cz: -0.004 }, // just below brow
  ], { group: 'head', seg: 26, capBottom: false });

  // Cheek guards: short plates hanging down the SIDES from the brow
  // (skip the front face and the back of the neck). Two arcs.
  const cheeks = [
    { y: 1.855, rx: 0.142, rz: 0.150, p: P, cz: -0.004 },
    { y: 1.790, rx: 0.140, rz: 0.146, p: P, cz: 0 },
    { y: 1.740, rx: 0.132, rz: 0.138, p: P, cz: 0.004 }, // jaw
  ];
  // right side arc (around a=0), left side arc (around a=PI): each a
  // ~70-degree band, leaving the front and back open.
  loftPiece(faces, cheeks, { group: 'head', seg: 8, arc: [-0.6, 0.6] });
  loftPiece(faces, cheeks, { group: 'head', seg: 8, arc: [Math.PI - 0.6, Math.PI + 0.6] });

  compress(faces);
  return shadePiece(faces, ramp);
}
