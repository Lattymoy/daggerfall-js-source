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
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  // AUDIT-MAP2: a sheet turned nearly edge-on is not a place to put the
  // ink - the guards above are absolute and pass a quad whose corners are
  // all but collinear, and the browser would smear the canvas across the
  // screen. Shoelace area against the longest edge squared: under a
  // fiftieth (a sheet fifty times wider than it is tall on screen),
  // nothing - it could not be read or picked at that angle anyway.
  let area = 0, edge2 = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    area += a[0] * b[1] - b[0] * a[1];
    edge2 = Math.max(edge2, (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  }
  if (!(Math.abs(area) / 2 > 0.02 * edge2)) return null;
  // the inverse's divisor is POSITIVE on the sheet's side of the paper
  // plane's vanishing line and negative beyond it, for every quad:
  // adj(H) * H = det * I puts it at exactly 1 on the sheet's own origin,
  // whichever way the corners wind. So toSheet refuses a non-positive
  // divisor - a screen point behind the paper's horizon is not a
  // mirrored sheet point, it is nowhere.
  return {
    H, inv,
    css: matrix3dOf(H),
    box,
    /** a screen point to sheet coordinates (CSS px on the untransformed
     *  sheet), or null beyond the paper plane's vanishing line */
    toSheet: (sx, sy) => {
      const d = inv[6] * sx + inv[7] * sy + inv[8];
      if (!(d > 1e-12)) return null;
      return [(inv[0] * sx + inv[1] * sy + inv[2]) / d, (inv[3] * sx + inv[4] * sy + inv[5]) / d];
    },
    /** a sheet point to the screen */
    toScreen: (px, py) => applyH(H, px, py),
  };
}
