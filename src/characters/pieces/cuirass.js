// Cuirass (chest armour): designed plate on the neutral rig, INSPIRED
// by the classic, not a sprite-shell. Wraps the torso (shoulders ->
// waist) with a neckline, pauldron shelf and hem. Sprites kept for the
// inventory icon. Shared loft = correct outward normals.
import { loftPiece, shadePiece, compress, STEEL_RAMP } from './pieceLoft.js';

export function buildCuirass(ramp) {
  const faces = [];
  const P = 0.62,
    seg = 28;
  loftPiece(
    faces,
    [
      { y: 1.605, rx: 0.19, rz: 0.098, p: P }, // neckline shoulder line
      { y: 1.56, rx: 0.232, rz: 0.116, p: P }, // upper chest / pauldron shelf
      { y: 1.48, rx: 0.236, rz: 0.12, p: P }, // chest (broadest)
      { y: 1.38, rx: 0.22, rz: 0.114, p: P }, // lower chest
      { y: 1.27, rx: 0.192, rz: 0.1, p: P }, // upper waist
      { y: 1.18, rx: 0.178, rz: 0.094, p: P }, // waist (cinch)
      { y: 1.12, rx: 0.198, rz: 0.104, p: P }, // hem flare
    ],
    { seg, group: 'body' },
  ); // rides the torso (bob)
  compress(faces);
  return shadePiece(faces, ramp);
}
export { STEEL_RAMP };
