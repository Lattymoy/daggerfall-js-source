// Pauldrons (shoulder armour): standoff plate caps over each deltoid.
// Separate mesh (they stand off the silhouette). Tagged armL/armR so
// they swing with the shoulder. Left = 105, Right = 106.
import { loftPiece, shadePiece, compress, STEEL_RAMP } from './pieceLoft.js';

const SH_X = 0.235; // mirror neutralBody arm centre

export function buildPauldrons(ramp) {
  const faces = [];
  const P = 0.6;
  const cap = (sign) => loftPiece(faces, [
    { y: 1.635, rx: 0.072, rz: 0.078, p: P }, // crown
    { y: 1.590, rx: 0.118, rz: 0.118, p: P }, // widest over the deltoid
    { y: 1.525, rx: 0.108, rz: 0.104, p: P }, // skirt over the upper arm
    { y: 1.475, rx: 0.082, rz: 0.080, p: P }, // lower edge
  ], { cx: sign * SH_X, group: sign < 0 ? 'armL' : 'armR', seg: 20 });
  cap(-1); cap(1);
  compress(faces);
  return shadePiece(faces, ramp);
}
export { STEEL_RAMP };
