// Minimal column-major 4x4 matrix math for world assembly.
// TRS matches Unity's Matrix4x4.TRS with Quaternion.Euler semantics: rotation
// applied in Z, then X, then Y order (R = Ry * Rx * Rz), degrees in, and
// matrices compose parent * child. This is the contract RMBLayout's verbatim
// placement formulas assume.

export function identity() {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/** out = a * b (apply b first, then a). May alias out with a or b. */
export function multiply(a, b, out = new Float32Array(16)) {
  const r = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      r[col * 4 + row] = sum;
    }
  }
  out.set(r);
  return out;
}

const DEG2RAD = Math.PI / 180;

/**
 * Translation * Rotation(euler degrees, Unity ZXY order) * Scale.
 */
export function trs(tx, ty, tz, rxDeg, ryDeg, rzDeg, sx = 1, sy = 1, sz = 1) {
  const rx = rxDeg * DEG2RAD;
  const ry = ryDeg * DEG2RAD;
  const rz = rzDeg * DEG2RAD;
  const cx = Math.cos(rx), sxn = Math.sin(rx);
  const cy = Math.cos(ry), syn = Math.sin(ry);
  const cz = Math.cos(rz), szn = Math.sin(rz);

  // R = Ry * Rx * Rz
  const r00 = cy * cz + syn * sxn * szn;
  const r01 = -cy * szn + syn * sxn * cz;
  const r02 = syn * cx;
  const r10 = cx * szn;
  const r11 = cx * cz;
  const r12 = -sxn;
  const r20 = -syn * cz + cy * sxn * szn;
  const r21 = syn * szn + cy * sxn * cz;
  const r22 = cy * cx;

  // prettier-ignore
  return new Float32Array([
    r00 * sx, r10 * sx, r20 * sx, 0,
    r01 * sy, r11 * sy, r21 * sy, 0,
    r02 * sz, r12 * sz, r22 * sz, 0,
    tx, ty, tz, 1,
  ]);
}

/** Transform point (x,y,z,1) by m; returns [x,y,z]. */
export function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Right-handed perspective projection (GL clip space). */
export function perspective(fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** Right-handed lookAt view matrix. */
export function lookAt(eye, center, up) {
  const zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz);
  const z = [zx / zl, zy / zl, zz / zl];
  const x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
  const xl = Math.hypot(x[0], x[1], x[2]);
  x[0] /= xl; x[1] /= xl; x[2] /= xl;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  // prettier-ignore
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1,
  ]);
}

export function ortho(halfW, halfH, near, far) {
  const out = new Float32Array(16);
  out[0] = 1 / halfW;
  out[5] = 1 / halfH;
  out[10] = -2 / (far - near);
  out[14] = -(far + near) / (far - near);
  out[15] = 1;
  return out;
}
