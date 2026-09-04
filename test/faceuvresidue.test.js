// ROAD-E E8 - WHERE FaceUVTool CAN STILL DIVERGE, and where it cannot.
//
// Port-Ledger.md:512 has carried "1,803 of 1,917,087 corpus UVs still
// differ... Not precision and not the normalize - cause unknown" since
// AUDIT 18. This file is the part of that investigation which can be
// run without ARENA2: it fences the divergence surface by reading
// DFU's own sources, and it demonstrates the one arithmetic seam that
// is live, with numbers rather than with adjectives.
//
// WHAT IS RULED OUT, from the C# itself:
//
// - DFU's Vector3 IS DOUBLE. API/Vector3.cs declares x/y/z as `double`
//   (:35-45), Magnitude as `Math.Sqrt(SumComponentSqrs())` returning
//   double (:151-160), DotProduct as double (:508-520) and Normalize
//   as `double inverse = 1 / Magnitude` times each component
//   (:583-597). So P0..P2, V0, V1, the orthogonalisation, both
//   magnitudes, both normalizes and all six basis dot products are
//   ALREADY double on both sides. Ledger row 18's float->double
//   widening cannot reach them and neither can the residual.
//
// - POINTS 0, 1 AND 2 CANNOT DIFFER AT ALL. Their UVs are the integer
//   delta sums u0, u0+u1, u0+u1+u2 (FaceUVTool.cs:169-186) - Int32
//   addition on both sides, no floating point anywhere on the path.
//   So the whole residual lives at point index >= 3, which means only
//   on faces with MORE THAN THREE corner points.
//
// - Math.trunc and C#'s (Int32) agree for every in-range value,
//   negatives included: both truncate toward zero.
//
// WHAT IS RULED IN: the SINGLE-PRECISION half of FaceUVTool, which is
// exactly `df3duvparams_lt` (float[] X/Y/Z/U/V, :55-63),
// `df3duvmatrix_t` (float UA..VD, :66-76) and
// l_ComputeDFUVMatrixXY's `float determinant` + `float[] Xi/Yi/Zi`
// (:222-229), ending in `(Int32)((pn.x * UA) + (pn.y * UB) + UD)`
// (:169-170) - a float expression truncated to an integer. The port
// computes every one of those in double, which is Ledger A row 18.
// The test below measures how often that alone flips the truncation.
//
// WHAT REMAINS UNKNOWN, stated honestly: the row's 1,803 figure was
// taken against a DFU built AT MATCHED PRECISION, and the edit that
// builds it was not in the tree - E8 adds it as
// tools/parity/patches/FaceUVTool.cs.patch so the measurement is
// reproducible at all. Re-running it needs ARENA2 plus mono/mcs:
// `bash tools/parity/prepare.sh` then
// `ARENA2_PATH=... bash tools/parity/run.sh`, and the faceuv line's
// second column is the number. Nothing in this container can produce
// it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFaceUVCoordinates } from '../src/formats/faceUVTool.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const f = Math.fround;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The 2D basis, which is double on BOTH sides (Vector3 is double). */
function basis(P0, P1, P2) {
  const V0 = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]];
  let V1 = [P2[0] - P0[0], P2[1] - P0[1], P2[2] - P0[2]];
  const k = dot(V1, V0) / dot(V0, V0);
  V1 = [V1[0] - V0[0] * k, V1[1] - V0[1] * k, V1[2] - V0[2] * k];
  const i0 = 1 / Math.sqrt(dot(V0, V0)), i1 = 1 / Math.sqrt(dot(V1, V1));
  return [[V0[0] * i0, V0[1] * i0, V0[2] * i0], [V1[0] * i1, V1[1] * i1, V1[2] * i1]];
}

/** l_ComputeDFUVMatrixXY in SINGLE precision - DFU's declared types,
 *  one Math.fround per float operation. This is the measuring
 *  instrument, not the port: the port computes the same expressions in
 *  double, and the gap between the two is what row :483's widening
 *  accounts for. */
function matrixFloat(X, Y, U, V) {
  const d = f(f(f(f(f(f(X[0] * Y[1]) + f(Y[0] * X[2])) + f(X[1] * Y[2])) - f(Y[1] * X[2])) - f(Y[0] * X[1])) - f(X[0] * Y[2]));
  if (d === 0) return null;
  const Xi = [f(f(Y[1] - Y[2]) / d), f(f(-X[1] + X[2]) / d), f(f(f(X[1] * Y[2]) - f(X[2] * Y[1])) / d)];
  const Yi = [f(f(-Y[0] + Y[2]) / d), f(f(X[0] - X[2]) / d), f(f(f(-X[0] * Y[2]) + f(X[2] * Y[0])) / d)];
  const Zi = [f(f(Y[0] - Y[1]) / d), f(f(-X[0] + X[1]) / d), f(f(f(X[0] * Y[1]) - f(X[1] * Y[0])) / d)];
  const c3 = (a, b, c, d2, e, g) => f(f(f(a * b) + f(c * d2)) + f(e * g));
  return {
    UA: c3(U[0], Xi[0], U[1], Yi[0], U[2], Zi[0]),
    UB: c3(U[0], Xi[1], U[1], Yi[1], U[2], Zi[1]),
    UD: c3(U[0], Xi[2], U[1], Yi[2], U[2], Zi[2]),
    VA: c3(V[0], Xi[0], V[1], Yi[0], V[2], Zi[0]),
    VB: c3(V[0], Xi[1], V[1], Yi[1], V[2], Zi[1]),
    VD: c3(V[0], Xi[2], V[1], Yi[2], V[2], Zi[2]),
  };
}

/** The float side's answer for point 3 of a four-point face. */
function floatSideUV(face) {
  const P = face.map((p) => [p.x, p.y, p.z]);
  const [n0, n1] = basis(P[0], P[1], P[2]);
  const X = [0, 1, 2].map((i) => Math.trunc(dot(P[i], n0)));
  const Y = [0, 1, 2].map((i) => Math.trunc(dot(P[i], n1)));
  const U = [f(face[0].u), f(face[1].u + f(face[0].u)), f(face[2].u + f(face[1].u + f(face[0].u)))];
  const V = [f(face[0].v), f(face[1].v + f(face[0].v)), f(face[2].v + f(face[1].v + f(face[0].v)))];
  const m = matrixFloat(X, Y, U, V);
  const pnx = Math.trunc(dot(P[3], n0)), pny = Math.trunc(dot(P[3], n1));
  return {
    u: Math.trunc(f(f(f(pnx * m.UA) + f(pny * m.UB)) + m.UD)),
    v: Math.trunc(f(f(f(pnx * m.VA) + f(pny * m.VB)) + m.VD)),
  };
}

/** A four-point face whose point-3 v lands on opposite sides of the
 *  truncation boundary under the two precisions. Found by walking
 *  400,000 random Daggerfall-scale faces (|coord| <= 4096, |uv| <=
 *  2048): 76 of them - 0.019% - diverge on u or v this way. */
const DEMO_FACE = [
  { x: -210, y: -2909, z: -1019, nx: 0, ny: 256, nz: 0, u: 540, v: 1033 },
  { x: -3307, y: 1082, z: 963, nx: 0, ny: 256, nz: 0, u: 1457, v: -989 },
  { x: -2110, y: -295, z: 944, nx: 0, ny: 256, nz: 0, u: -1020, v: -1894 },
  { x: -3169, y: 3436, z: -2175, nx: 0, ny: 256, nz: 0, u: 0, v: 0 },
];

// The flip needs BOTH halves of the single-precision path together:
// rounding only the matrix coefficients, or only the final
// accumulate, leaves the pinned face at 11009. It is the float
// determinant/Xi/Yi/Zi chain AND `(Int32)((pn.x*UA)+(pn.y*UB)+UD)`
// evaluated in float, which is exactly what C# does with those
// declared types - so the mutation that kills the pin below has to be
// both, and a half-mutation proves nothing.
test('E8/:483: the residual seam is the FLOAT matrix chain, and the port sits on the double side', () => {
  const out = new Array(24);
  assert.equal(computeFaceUVCoordinates(DEMO_FACE, out), true);
  // the port's answer - every expression of l_ComputeDFUVMatrixXY in
  // double, which is Ledger A row 18
  assert.deepEqual([out[3].u, out[3].v], [4957, 11009]);
  // ...and DFU's own declared types, which put the same v one unit up
  assert.deepEqual(floatSideUV(DEMO_FACE), { u: 4957, v: 11010 });
  // The two differ, which is the whole point: the seam is live at
  // Daggerfall's own scale, on a face the corpus could hold.
  assert.notEqual(out[3].v, floatSideUV(DEMO_FACE).v);
});

test('E8/:483: points 0, 1 and 2 are pure Int32 sums - no float can reach them', () => {
  // FaceUVTool.cs:172-186. Whatever the matrix does, these three are
  // u0, u0+u1, u0+u1+u2 on both sides, so the residual cannot be in
  // them and only faces with MORE than three points can carry it.
  const out = new Array(24);
  computeFaceUVCoordinates(DEMO_FACE, out);
  const u = DEMO_FACE.map((p) => p.u), v = DEMO_FACE.map((p) => p.v);
  assert.deepEqual([out[0].u, out[0].v], [u[0], v[0]]);
  assert.deepEqual([out[1].u, out[1].v], [u[0] + u[1], v[0] + v[1]]);
  assert.deepEqual([out[2].u, out[2].v], [u[0] + u[1] + u[2], v[0] + v[1] + v[2]]);
  // a THREE-point face therefore cannot diverge at all: no point of it
  // ever reaches the matrix
  const tri = DEMO_FACE.slice(0, 3);
  const triOut = new Array(24);
  assert.equal(computeFaceUVCoordinates(tri, triOut), true);
  assert.deepEqual(triOut.slice(0, 3).map((p) => [p.u, p.v]),
    [[u[0], v[0]], [u[0] + u[1], v[0] + v[1]], [u[0] + u[1] + u[2], v[0] + v[1] + v[2]]]);
});

test('E8/:483: the matched-precision harness build is reproducible from the tree', () => {
  // The row calls the harness "re-runnable", and until E8 the edit
  // that makes the faceuv corpus a MATCHED-PRECISION comparison lived
  // only in a scratchpad tree - so the number could not be reproduced
  // by anyone with ARENA2 and this repo.
  const patch = 'tools/parity/patches/FaceUVTool.cs.patch';
  assert.ok(existsSync(join(ROOT, patch)), `${patch} is missing`);
  const p = read(patch);
  // it widens exactly the float-typed members named above, and nothing else
  assert.match(p, /-\s+public float\[\] X;/);
  assert.match(p, /\+\s+public double\[\] X;/);
  assert.match(p, /-\s+public float UA;/);
  assert.match(p, /\+\s+public double UA;/);
  assert.match(p, /-\s+float determinant;/);
  assert.match(p, /\+\s+double determinant;/);
  assert.match(p, /new double\[3\]/);
  assert.equal(/Vector3/.test(p), false, 'Vector3 is already double in DFU - the patch must not touch it');
  // ...and prepare.sh applies it with the other five
  const prep = read('tools/parity/prepare.sh');
  assert.match(prep, /for f in Arch3dFile BlocksFile DFBlock SpellRecord DaggerfallSpellReader FaceUVTool; do/);
  assert.match(prep, /ONE that is not behaviour-neutral/);
});
