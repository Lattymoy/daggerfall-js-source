// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAP3 — THE QUAD MAP: a flat sheet's rectangle to the four screen
// corners its picture lands on, and back.
//
// The Morrowind held pose draws a paper piece in the first-person arm
// pass (combat/fpArm.js), a flat quad under perspective. The ink sheet
// stays a DOM canvas - the picture at full resolution and the pointer's
// surface - laid over that quad by a CSS matrix3d, and every pointer
// event is mapped back through the inverse. A flat quad under a
// projective camera is exactly a homography, so both directions are
// the same 3x3 matrix and its inverse; nothing here is approximate.
//
// Pure: no DOM. The window hands in the sheet's own width and height
// and the four corners the rig projected (top-left, top-right,
// bottom-right, bottom-left, in CSS pixels of the canvas the arm pass
// composites onto), and takes back a matrix3d string and a mapper.
// ═══════════════════════════════════════════════════════════════════

/** The 3x3 homography (row-major, 9 numbers) taking the unit square
 *  (0,0)-(1,0)-(1,1)-(0,1) to four points, by the adjugate method
 *  (Heckbert): the projective basis that sends the three unit vectors
 *  and (1,1,1) to the corners. */
export function unitSquareTo([p0, p1, p2, p3]) {
  const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-12 || Math.abs(dy3) > 1e-12) {
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return [a, b, c, d, e, f, g, h, 1];
}

/** The homography taking the sheet's (0,0)-(w,0)-(w,h)-(0,h) to the four
 *  corners: the unit-square one after a scale. */
export function sheetToCorners(w, h, corners) {
  const H = unitSquareTo(corners);
  if (!H || !(w > 0) || !(h > 0)) return null;
  // H * diag(1/w, 1/h, 1)
  return [H[0] / w, H[1] / h, H[2], H[3] / w, H[4] / h, H[5], H[6] / w, H[7] / h, H[8]];
}

/** Apply a homography to a point. */
export function applyH(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  if (Math.abs(d) < 1e-12) return null;
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

/** The inverse of a 3x3 (row-major), or null when singular. */
export function invertH(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, I2 = -(a * f - c * d), J = a * e - b * d;
  return [A / det, D / det, G / det, B / det, E / det, I2 / det, C / det, F / det, J / det];
}

/**
 * The CSS `matrix3d(...)` for an element of the sheet's size whose
 * transform-origin is its top-left: the 3x3 homography spread into the
 * 4x4 the browser wants (column-major, z untouched, the projective row
 * last). Set `transform-origin: 0 0` on the element.
 */
export function matrix3dOf(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const m = [
    a, d, 0, g,
    b, e, 0, h,
    0, 0, 1, 0,
    c, f, 0, i,
  ];
  return `matrix3d(${m.map((v) => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 1e6) / 1e6))).join(', ')})`;
}

/**
 * Everything the window needs for one placement: the forward map (for
 * the CSS), the inverse (for the pointer), and the corners' bounding
 * box (for the layout). Null when the corners are degenerate.
 * @param {number} w the sheet's width in CSS px (its untransformed size)
 * @param {number} h
 * @param {number[][]} corners [[x,y] x4] in CSS px of the composite canvas, TL TR BR BL
 */
export function quadPlacement(w, h, corners) {
  if (!Array.isArray(corners) || corners.length !== 4 || corners.some((p) => !p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return null;
  const H = sheetToCorners(w, h, corners);
  if (!H) return null;
  const inv = invertH(H);
  if (!inv) return null;
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  return {
    H, inv,
    css: matrix3dOf(H),
    box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
    /** a screen point to sheet coordinates (CSS px on the untransformed sheet) */
    toSheet: (sx, sy) => applyH(inv, sx, sy),
    /** a sheet point to the screen */
    toScreen: (px, py) => applyH(H, px, py),
  };
}
