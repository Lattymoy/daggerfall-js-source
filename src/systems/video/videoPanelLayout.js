// @ts-check
// VIDEO1 — screen rect for a YouTube DOM panel over a painting mount.

/** YouTube's practical minimum for usable official controls. */
export const VIDEO_YT_MIN_W = 320;
export const VIDEO_YT_MIN_H = 180;

/**
 * World point → canvas CSS pixels, or null if behind the eye.
 * Eye axes match worldModes: forward (sin yaw cos pitch, sin pitch, cos yaw cos pitch),
 * right (cos yaw, 0, -sin yaw), up = forward × right.
 * @param {number[]} pos
 * @param {{ pos: number[], yaw: number, pitch: number }} cam
 * @param {number} fovYRad
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function videoProjectToScreen(pos, cam, fovYRad, canvasW, canvasH) {
  if (!pos || !cam?.pos || !Number.isFinite(fovYRad) || canvasW < 1 || canvasH < 1) return null;
  const dx = pos[0] - cam.pos[0], dy = pos[1] - cam.pos[1], dz = pos[2] - cam.pos[2];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const fx = sy * cp, fy = sp, fz = cy * cp;
  const rx = cy, rz = -sy;
  const ux = -fy * sy, uy = fz * cy + fx * sy, uz = -fy * cy;
  const depth = dx * fx + dy * fy + dz * fz;
  if (!(depth > 0.05)) return null;
  const camX = dx * rx + dz * rz;
  const camY = dx * ux + dy * uy + dz * uz;
  const aspect = canvasW / canvasH;
  const f = 1 / Math.tan(fovYRad * 0.5);
  const ndcX = (camX * f / aspect) / depth;
  const ndcY = (camY * f) / depth;
  return {
    x: (ndcX * 0.5 + 0.5) * canvasW,
    y: (-ndcY * 0.5 + 0.5) * canvasH,
  };
}

/**
 * Axis-aligned screen box over projected mount corners, grown to YouTube's minimum.
 * @param {number[][]} corners world-space quad corners
 * @param {(p: number[]) => ({ x: number, y: number } | null)} project
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function videoScreenRectOfCorners(corners, project) {
  if (!Array.isArray(corners) || corners.length < 2 || typeof project !== 'function') return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
  for (const c of corners) {
    const p = project(c);
    if (!p) continue;
    n++;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (n < 2 || !(maxX > minX) || !(maxY > minY)) return null;
  let width = maxX - minX, height = maxY - minY;
  let left = minX, top = minY;
  const cx = left + width * 0.5, cy = top + height * 0.5;
  if (width < VIDEO_YT_MIN_W) { width = VIDEO_YT_MIN_W; left = cx - width * 0.5; }
  if (height < VIDEO_YT_MIN_H) { height = VIDEO_YT_MIN_H; top = cy - height * 0.5; }
  return { left, top, width, height };
}
