// THE THROW'S ARC, DRAWN. Handheld Torches' Throwing.ShowTrajectory fed its arc to a Unity LineRenderer; this
// renderer has no world-space line, so the arc is dots on the screen: every few steps of throwArcPoints
// (handheldTorches.js, the flight's own law) taken through the last frame's camera, small near the hand and growing
// toward the landing, which is marked larger.

/** Every how many of the arc's 0.02 s steps a dot is drawn, the dots' sizes in pixels at 1080 lines, and colours. */
export const ARC_LOOK = Object.freeze({ every: 4, dotPx: 4, landPx: 9, rgba: Object.freeze([1, 0.78, 0.35, 0.85]) });

/** A world point through `proj` x `view` (column-major, as the renderer uploads them) to pixels from the top left of a
 *  `width` x `height` screen, or null behind the eye. */
export function worldToScreen(point, proj, view, width, height) {
  const viewMatrix = view,
    projMatrix = proj;
  const eyeX = viewMatrix[0] * point[0] + viewMatrix[4] * point[1] + viewMatrix[8] * point[2] + viewMatrix[12];
  const eyeY = viewMatrix[1] * point[0] + viewMatrix[5] * point[1] + viewMatrix[9] * point[2] + viewMatrix[13];
  const eyeZ = viewMatrix[2] * point[0] + viewMatrix[6] * point[1] + viewMatrix[10] * point[2] + viewMatrix[14];
  const eyeW = viewMatrix[3] * point[0] + viewMatrix[7] * point[1] + viewMatrix[11] * point[2] + viewMatrix[15];
  const clipX = projMatrix[0] * eyeX + projMatrix[4] * eyeY + projMatrix[8] * eyeZ + projMatrix[12] * eyeW;
  const clipY = projMatrix[1] * eyeX + projMatrix[5] * eyeY + projMatrix[9] * eyeZ + projMatrix[13] * eyeW;
  const clipW = projMatrix[3] * eyeX + projMatrix[7] * eyeY + projMatrix[11] * eyeZ + projMatrix[15] * eyeW;
  if (!(clipW > 1e-4)) return null;
  return [(clipX / clipW + 1) * 0.5 * width, (1 - clipY / clipW) * 0.5 * height];
}

/** The dots of an arc on a `width` x `height` screen: [x, y, size] each, the hand's end skipped, the last point the landing. */
export function arcDots(points, proj, view, width, height) {
  const out = [];
  if (!points || points.length < 2 || !proj || !view) return out;
  const k = height / 1080;
  const last = points.length - 1;
  for (let i = ARC_LOOK.every; i <= last; i += ARC_LOOK.every) {
    if (last - i < ARC_LOOK.every) i = last; // the landing is always drawn
    const at = worldToScreen(points[i], proj, view, width, height);
    if (!at || at[0] < 0 || at[1] < 0 || at[0] > width || at[1] > height) continue;
    const size = i === last ? ARC_LOOK.landPx : ARC_LOOK.dotPx * (0.6 + (0.4 * i) / last);
    out.push([at[0], at[1], Math.max(1, size * k)]);
  }
  return out;
}

/** Draw an arc's dots over the frame, through the renderer's own camera and screen quads. */
export function drawArc(renderer, points) {
  const gl = renderer?.gl;
  if (!gl || !renderer._proj || !renderer._view || typeof renderer.drawScreenQuad !== 'function') return 0;
  const [offsetX, offsetY] = renderer.screenOffset ?? [0, 0];
  const dots = arcDots(points, renderer._proj, renderer._view, gl.drawingBufferWidth, gl.drawingBufferHeight);
  for (const [x, y, size] of dots) renderer.drawScreenQuad(null, { x: x - size / 2 - offsetX, y: y - size / 2 - offsetY, w: size, h: size }, undefined, ARC_LOOK.rgba);
  return dots.length;
}
