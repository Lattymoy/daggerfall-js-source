// UV calculation for N-point faces.
// 1:1 translation of Daggerfall Unity's FaceUVTool.cs (MIT, Daggerfall
// Workshop / Gavin Clayton), itself based on Dave Humphrey's DF_3DSTex.CPP
// (DFTo3DS, www.uesp.net).
//
// Numeric note: C# mixes float/double here; JS computes in doubles
// throughout. (Int32) casts are preserved as Math.trunc. Divergence is only
// possible where C# float rounding would flip a truncation boundary; the
// full-corpus decode gate in test/arch3d.test.js pins the observed output.

function dot(ax, ay, az, bx, by, bz) {
  return ax * bx + ay * by + az * bz;
}

/**
 * Calculates absolute UV values for all points of a face.
 * @param {Array<{x,y,z,nx,ny,nz,u,v}>} faceVertsIn - native point values.
 * @param {Array} faceVertsOut - destination buffer (fixed length 24, as DFU).
 * @returns {boolean} true if successful.
 */
export function computeFaceUVCoordinates(faceVertsIn, faceVertsOut) {
  if (faceVertsIn.length > faceVertsOut.length) {
    // C# overruns its 24-entry calculatedUVBuffer and throws; mirror that.
    throw new RangeError('calculatedUVBuffer overflow');
  }

  // Get first three vertices of ngon (always non-collinear).
  const P0 = [faceVertsIn[0].x, faceVertsIn[0].y, faceVertsIn[0].z];
  const P1 = [faceVertsIn[1].x, faceVertsIn[1].y, faceVertsIn[1].z];
  const P2 = [faceVertsIn[2].x, faceVertsIn[2].y, faceVertsIn[2].z];

  // Create coplanar vectors from p1->p0 and p2->p0.
  const V0 = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]];
  let V1 = [P2[0] - P0[0], P2[1] - P0[1], P2[2] - P0[2]];

  // Orthogonalize V1.
  const k =
    dot(V1[0], V1[1], V1[2], V0[0], V0[1], V0[2]) /
    dot(V0[0], V0[1], V0[2], V0[0], V0[1], V0[2]);
  V1 = [V1[0] - V0[0] * k, V1[1] - V0[1] * k, V1[2] - V0[2] * k];

  // Normalize both vectors (throws on zero magnitude, as DFU's Vector3 does).
  const m0 = Math.sqrt(dot(V0[0], V0[1], V0[2], V0[0], V0[1], V0[2]));
  const m1 = Math.sqrt(dot(V1[0], V1[1], V1[2], V1[0], V1[1], V1[2]));
  if (m0 === 0 || m1 === 0) throw new Error('Can not normalize a vector when it\'s magnitude is zero');
  // AUDIT 18 F4: DFU's Vector3.Normalize (API/Vector3.cs:583-597) computes
  // `double inverse = 1 / Magnitude` and MULTIPLIES each component by it.
  // x*(1/m) and x/m are not the same double, and the difference survives
  // the (Int32) truncations below that pick the 2D basis: dividing put 611
  // of 1,917,087 corpus UVs one raw unit (1/16 texel) off DFU. Ledger row
  // 18 authorises the float->double widening here, not a different
  // normalize formulation.
  const i0 = 1 / m0, i1 = 1 / m1;
  const n0 = [V0[0] * i0, V0[1] * i0, V0[2] * i0];
  const n1 = [V1[0] * i1, V1[1] * i1, V1[2] * i1];

  // Compute first three vertices in 2D space ((Int32) casts preserved).
  const p0x = Math.trunc(dot(P0[0], P0[1], P0[2], n0[0], n0[1], n0[2]));
  const p0y = Math.trunc(dot(P0[0], P0[1], P0[2], n1[0], n1[1], n1[2]));
  const p1x = Math.trunc(dot(P1[0], P1[1], P1[2], n0[0], n0[1], n0[2]));
  const p1y = Math.trunc(dot(P1[0], P1[1], P1[2], n1[0], n1[1], n1[2]));
  const p2x = Math.trunc(dot(P2[0], P2[1], P2[2], n0[0], n0[1], n0[2]));
  const p2y = Math.trunc(dot(P2[0], P2[1], P2[2], n1[0], n1[1], n1[2]));

  // Store the first 3 points of texture coordinates (deltas accumulated).
  const U = [
    faceVertsIn[0].u,
    faceVertsIn[1].u + faceVertsIn[0].u,
    faceVertsIn[2].u + faceVertsIn[1].u + faceVertsIn[0].u,
  ];
  const V = [
    faceVertsIn[0].v,
    faceVertsIn[1].v + faceVertsIn[0].v,
    faceVertsIn[2].v + faceVertsIn[1].v + faceVertsIn[0].v,
  ];
  const X = [p0x, p1x, p2x];
  const Y = [p0y, p1y, p2y];

  // Compute the solution using an XY linear equation: U = AX + BY + D.
  const matrix = computeDFUVMatrixXY(X, Y, U, V);
  if (!matrix) return false;

  // Assign matrix to all points.
  for (let point = 0; point < faceVertsIn.length; point++) {
    let u = 0;
    let v = 0;
    if (point > 2) {
      // Use generated matrix to calculate UV value from 2D point.
      const P = faceVertsIn[point];
      const pnx = Math.trunc(dot(P.x, P.y, P.z, n0[0], n0[1], n0[2]));
      const pny = Math.trunc(dot(P.x, P.y, P.z, n1[0], n1[1], n1[2]));
      u = Math.trunc(pnx * matrix.UA + pny * matrix.UB + matrix.UD);
      v = Math.trunc(pnx * matrix.VA + pny * matrix.VB + matrix.VD);
    } else if (point === 0) {
      // UV[0] is absolute.
      u = faceVertsIn[0].u;
      v = faceVertsIn[0].v;
    } else if (point === 1) {
      // UV[1] is a delta from UV[0].
      u = faceVertsIn[0].u + faceVertsIn[1].u;
      v = faceVertsIn[0].v + faceVertsIn[1].v;
    } else {
      // UV[2] is a delta from UV[1] + UV[0].
      u = faceVertsIn[0].u + faceVertsIn[1].u + faceVertsIn[2].u;
      v = faceVertsIn[0].v + faceVertsIn[1].v + faceVertsIn[2].v;
    }

    faceVertsOut[point] = {
      x: faceVertsIn[point].x,
      y: faceVertsIn[point].y,
      z: faceVertsIn[point].z,
      nx: faceVertsIn[point].nx,
      ny: faceVertsIn[point].ny,
      nz: faceVertsIn[point].nz,
      u,
      v,
    };
  }

  return true;
}

/**
 * Computes the UV conversion parameters (U = AX + BY + D). Returns null on a
 * singular matrix. Ports l_ComputeDFUVMatrixXY, including its quirk of
 * assigning UD twice during init (harmless, kept for fidelity of record).
 */
function computeDFUVMatrixXY(X, Y, U, V) {
  // Compute the determinant of the coefficient matrix.
  const determinant =
    X[0] * Y[1] + Y[0] * X[2] + X[1] * Y[2] - Y[1] * X[2] - Y[0] * X[1] - X[0] * Y[2];

  // Check for a singular matrix indicating no valid solution.
  if (determinant === 0) return null;

  // Compute parameters of the inverted XYZ matrix.
  const Xi = [
    (Y[1] - Y[2]) / determinant,
    (-X[1] + X[2]) / determinant,
    (X[1] * Y[2] - X[2] * Y[1]) / determinant,
  ];
  const Yi = [
    (-Y[0] + Y[2]) / determinant,
    (X[0] - X[2]) / determinant,
    (-X[0] * Y[2] + X[2] * Y[0]) / determinant,
  ];
  const Zi = [
    (Y[0] - Y[1]) / determinant,
    (-X[0] + X[1]) / determinant,
    (X[0] * Y[1] - X[1] * Y[0]) / determinant,
  ];

  // Compute the UV conversion parameters.
  return {
    UA: U[0] * Xi[0] + U[1] * Yi[0] + U[2] * Zi[0],
    UB: U[0] * Xi[1] + U[1] * Yi[1] + U[2] * Zi[1],
    UC: 0,
    UD: U[0] * Xi[2] + U[1] * Yi[2] + U[2] * Zi[2],
    VA: V[0] * Xi[0] + V[1] * Yi[0] + V[2] * Zi[0],
    VB: V[0] * Xi[1] + V[1] * Yi[1] + V[2] * Zi[1],
    VC: 0,
    VD: V[0] * Xi[2] + V[1] * Yi[2] + V[2] * Zi[2],
  };
}
