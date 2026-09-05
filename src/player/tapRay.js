// TI1 - THE TAP RAY: DFU's free-cursor activation arm, on a finger.
// PlayerActivate.cs:283-306 - when the cursor is active the activation
// ray is `mainCamera.ScreenPointToRay(Input.mousePosition)` (:303);
// the centre ray the port's hosts build from cam.yaw/pitch is the
// LOCKED-cursor arm. A touch holds no lock and has no centre: the
// finger's point IS the pointer, and this is that arm.
//
// HANDEDNESS (mat4's law). The frame's projection is
// mirrorProjectionX(perspective(...)): NDC x runs the other way from a
// right-handed pipeline, and the bible records a vertically flipped
// billboard shader and a transposed row-major shipping green for
// milestones because a sign was DERIVED instead of measured. Nothing
// here derives one. The ray is the numerical inverse of the SAME
// proj*view the frame drew with, the dot is the same product forward,
// and test/touchinput.test.js pins both against the real
// perspective/mirrorProjectionX/lookAt with an ABSOLUTE anchor (at
// yaw 0, +x lands screen-right and +y screen-up) as well as the
// round-trip - a round-trip alone would bless two matching mistakes.
//
// THE RECT. ROAD-E E5: the world pass draws into the strip ABOVE a
// docked large HUD (ui/hudLarge.js largeHudViewportRect - a normalized
// GL rect, y from the bottom), so screen<->NDC maps through that rect,
// not the canvas. A finger in the bar's strip is no world tap at all:
// the ray answers null and the host leaves the tap alone.

import { multiply } from '../world/mat4.js';

/** Column-major 4x4 inverse (gl-matrix's layout - mat4.js's own). */
export function invert4(m, out = new Float32Array(16)) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

/** The world strip in top-left CSS pixels, from the normalized GL
 *  rect the host hands the renderer (null = the whole canvas). */
export function worldRectPx(rect, w, h) {
  if (!rect) return { x: 0, y: 0, w, h };
  return { x: rect.x * w, y: (1 - rect.y - rect.h) * h, w: rect.w * w, h: rect.h * h };
}

/** Screen (top-left CSS px) -> NDC inside the world strip, or null
 *  outside it. */
export function ndcFromScreen(sx, sy, w, h, rect = null) {
  const r = worldRectPx(rect, w, h);
  if (!(r.w > 0) || !(r.h > 0)) return null;
  if (sx < r.x || sx > r.x + r.w || sy < r.y || sy > r.y + r.h) return null;
  return [(2 * (sx - r.x)) / r.w - 1, 1 - (2 * (sy - r.y)) / r.h];
}

/**
 * The unit direction from `eye` through the finger's point, or null
 * when the point is outside the world strip (or the frame has no
 * invertible projection - a zero-area canvas).
 */
export function rayDirFromScreen(sx, sy, w, h, proj, view, eye, rect = null) {
  const ndc = ndcFromScreen(sx, sy, w, h, rect);
  if (!ndc) return null;
  const inv = invert4(multiply(proj, view));
  if (!inv) return null;
  const [nx, ny] = ndc;
  // the far-plane point (NDC z = 1) through the same lens the frame drew with
  const fx = inv[0] * nx + inv[4] * ny + inv[8] + inv[12];
  const fy = inv[1] * nx + inv[5] * ny + inv[9] + inv[13];
  const fz = inv[2] * nx + inv[6] * ny + inv[10] + inv[14];
  const fw = inv[3] * nx + inv[7] * ny + inv[11] + inv[15];
  if (!fw) return null;
  const dx = fx / fw - eye[0], dy = fy / fw - eye[1], dz = fz / fw - eye[2];
  const len = Math.hypot(dx, dy, dz);
  return len > 0 ? [dx / len, dy / len, dz / len] : null;
}

/**
 * A world point on the screen (top-left CSS px), through the frame's
 * own matrices. `front` is false behind the camera - the caller hides
 * the mark rather than drawing it mirrored somewhere on the strip.
 */
export function projectToScreen(p, w, h, proj, view, rect = null) {
  const pv = multiply(proj, view);
  const [x, y, z] = p;
  const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
  if (!(cw > 0)) return { x: 0, y: 0, front: false };
  const nx = (pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / cw;
  const ny = (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / cw;
  const r = worldRectPx(rect, w, h);
  return { x: r.x + ((nx + 1) / 2) * r.w, y: r.y + ((1 - ny) / 2) * r.h, front: true };
}
