// Head details (hair + race features) on the neutral rig, geometric.
// Sits just outside the head, front left open (the face). Race-keyed;
// this is the human base + hooks for elf ears etc. Separate mesh,
// tagged 'head' so it bobs with the head.
import { loftPiece, compress } from './pieceLoft.js';

// Hair ramps by broad colour; race/character will pick one later.
export const HAIR_RAMPS = {
  brown: [[22, 15, 10], [40, 28, 18], [60, 44, 28], [84, 62, 42]],
  black: [[12, 10, 12], [24, 20, 24], [38, 33, 40], [54, 48, 56]],
  blonde:[[70, 54, 28], [104, 82, 44], [140, 114, 66], [178, 150, 96]],
};

function shadeHair(faces, ramp) {
  const Lx = 0.5, Ly = 0.55, Lz = 0.67, Ln = Math.hypot(Lx, Ly, Lz);
  const snap = (t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
  for (const f of faces) { const it = Math.max(0.1, (f.n[0]*Lx + f.n[1]*Ly + f.n[2]*Lz) / Ln * 0.9 + 0.2); f.c = snap(Math.min(1, it)); }
  return faces;
}

// race: 'Human' | 'Elf' | 'Khajiit' | 'Argonian' (morphology groups).
export function buildHair(ramp = HAIR_RAMPS.brown, race = 'Human') {
  const faces = [];
  const P = 0.8;
  // Top cap: full over the crown down to the hairline band.
  loftPiece(faces, [
    { y: 2.055, rx: 0.058, rz: 0.064, p: P, cz: -0.012 }, // crown
    { y: 2.000, rx: 0.114, rz: 0.128, p: P, cz: -0.018 }, // upper
    { y: 1.945, rx: 0.146, rz: 0.158, p: P, cz: -0.018 }, // widest
    { y: 1.910, rx: 0.148, rz: 0.160, p: P, cz: -0.014 }, // hairline band
  ], { group: 'head', seg: 26, capBottom: false });
  // Back + sides drop: continue down the nape/sides, front (face) open.
  const drop = [
    { y: 1.910, rx: 0.148, rz: 0.160, p: P, cz: -0.014 },
    { y: 1.820, rx: 0.146, rz: 0.156, p: P, cz: -0.020 },
    { y: 1.740, rx: 0.132, rz: 0.146, p: P, cz: -0.026 }, // nape
  ];
  // cover from PI/2+GAP round to PI/2-GAP (skip the front face arc)
  const GAP = 1.0;
  loftPiece(faces, drop, { group: 'head', seg: 22, arc: [Math.PI/2 + GAP, Math.PI/2 - GAP + Math.PI*2] });

  shadeHair(faces, ramp);

  // Elf ears: pointed ears out the sides (added as dark-skin later; for
  // now geometry hook). Khajiit/Argonian handled with their own details.
  // (kept minimal here; race branches expand next.)

  compress(faces);
  return faces;
}
