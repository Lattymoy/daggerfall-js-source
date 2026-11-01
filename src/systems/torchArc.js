// OWN-AUDIT (2026-11-01; bible/06-Systems/Handheld-Torches.md): THE THROW'S ARC, DRAWN. Handheld Torches'
// Throwing.ShowTrajectory fed its arc to a Unity LineRenderer; this renderer has no world-space line, so the arc is
// dots on the screen: every few steps of throwArcPoints (handheldTorches.js, the flight's own law) taken through the
// last frame's camera, small near the hand and growing toward the landing, which is marked larger.

/** Every how many of the arc's 0.02 s steps a dot is drawn, the dots' sizes in pixels at 1080 lines, and colours. */
export const ARC_LOOK = Object.freeze({ every: 4, dotPx: 4, landPx: 9, rgba: Object.freeze([1, 0.78, 0.35, 0.85]) });

/** A world point through `proj` x `view` (column-major, as the renderer uploads them) to pixels from the top left of a
 *  `w` x `h` screen, or null behind the eye. */
export function toScreen(p, proj, view, w, h) {
  const v = view,
    m = proj;
  const ex = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
  const ey = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
  const ez = v[2] * p[0] + v[6] * p[1] + v[10] * p[2] + v[14];
  const ew = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
  const cx = m[0] * ex + m[4] * ey + m[8] * ez + m[12] * ew;
  const cy = m[1] * ex + m[5] * ey + m[9] * ez + m[13] * ew;
  const cw = m[3] * ex + m[7] * ey + m[11] * ez + m[15] * ew;
  if (!(cw > 1e-4)) return null;
  return [(cx / cw + 1) * 0.5 * w, (1 - cy / cw) * 0.5 * h];
}

/** The dots of an arc on a `w` x `h` screen: [x, y, size] each, the hand's end skipped, the last point the landing. */
export function arcDots(points, proj, view, w, h) {
  const out = [];
  if (!points || points.length < 2 || !proj || !view) return out;
  const k = h / 1080;
  const last = points.length - 1;
  for (let i = ARC_LOOK.every; i <= last; i += ARC_LOOK.every) {
    if (last - i < ARC_LOOK.every) i = last; // the landing is always drawn
    const at = toScreen(points[i], proj, view, w, h);
    if (!at || at[0] < 0 || at[1] < 0 || at[0] > w || at[1] > h) continue;
    const size = i === last ? ARC_LOOK.landPx : ARC_LOOK.dotPx * (0.6 + (0.4 * i) / last);
    out.push([at[0], at[1], Math.max(1, size * k)]);
  }
  return out;
}

/** Draw an arc's dots over the frame, through the renderer's own camera and screen quads. */
export function drawArc(renderer, points) {
  const gl = renderer?.gl;
  if (!gl || !renderer._proj || !renderer._view || typeof renderer.drawScreenQuad !== 'function') return 0;
  const [ox, oy] = renderer.screenOffset ?? [0, 0];
  const dots = arcDots(points, renderer._proj, renderer._view, gl.drawingBufferWidth, gl.drawingBufferHeight);
  for (const [x, y, s] of dots) renderer.drawScreenQuad(null, { x: x - s / 2 - ox, y: y - s / 2 - oy, w: s, h: s }, undefined, ARC_LOOK.rgba);
  return dots.length;
}
