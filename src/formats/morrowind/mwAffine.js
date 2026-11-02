// AUDIT 68 S11-affine-dup (2026-09-24): THE AFFINE, ONE HOME.
//
// {a: Float32Array(9) row-major rotation*scale, t: [x, y, z]} is the shape
// the skin (mwSkin.js), the particle systems (mwParticles.js) and the rig's
// placement (combat/fpArm.js, through mwParticles' re-export) compose. The
// skin and the particles each carried a copy of the NIF-transform affine
// and of the product; the copies were bit-identical, and the next fix to
// composition order (the MW-D20 / MW-D31 class) would have landed in one.
// The two INVERSES stay where they are: they are different algorithms
// (mwSkin's transpose / s^2 for a rotation times a uniform scale,
// mwParticles' guarded cofactor), not two copies of one.

import { mat33Apply, mat33Mul } from './mwNifMesh.js';

/** A NIF transform ({rotation, translation, scale}) as an affine. */
export function affineOfTransform(tr) {
  const a = new Float32Array(9);
  for (let i = 0; i < 9; i++) a[i] = tr.rotation[i] * tr.scale;
  return { a, t: [tr.translation[0], tr.translation[1], tr.translation[2]] };
}
export const AFFINE_IDENTITY = Object.freeze({ a: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [0, 0, 0] });
/** out = p ∘ q  (apply q first, then p). */
export function affineMul(p, q) {
  const a = mat33Mul(p.a, q.a);
  const [tx, ty, tz] = mat33Apply(p.a, q.t[0], q.t[1], q.t[2]);
  return { a, t: [p.t[0] + tx, p.t[1] + ty, p.t[2] + tz] };
}
export function affineApply(m, x, y, z) {
  const [px, py, pz] = mat33Apply(m.a, x, y, z);
  return [px + m.t[0], py + m.t[1], pz + m.t[2]];
}
export function affineRotate(m, x, y, z) {
  return mat33Apply(m.a, x, y, z);
}
