// THE CHARACTER PIXELIZE PASS - shared (C8 E1). Extracted VERBATIM
// from exterior.js slice 4 so every scene that draws a rig (player in
// the exterior, enemies in dungeons) renders through ONE
// implementation: the rig renders into a low-res sprite (projected
// screen height / CHAR_PIXEL, NEAREST) under a fitted ortho camera
// from the main view's azimuth, then composites as a camera-facing
// fogged alpha-cut quad, depth-tested like classic billboards. The
// world pass is untouched (the standard excludes it). Sizing is
// PROJECTION-EXACT (project center and head, divide) - analytic fov
// estimates disagree with the true projection at high pitch.
import { multiply, ortho, lookAt, transformPoint } from '../world/mat4.js';
import { CHAR_PIXEL } from './renderer.js';

/**
 * @returns diagnostics {center, halfW, halfH, pw, ph} for probes
 */
export function drawCharacterSprite(renderer, canvas, rig, rigMat, proj, view, eye) {
  const s = rig.scale;
  const b = rig.liveBounds;
  const worldH = (b.maxY - b.minY) * s;
  const halfH = worldH / 2;
  const halfW = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * s / 2;   // azimuth-safe upper bound - holds under rig yaw for free
  const center = transformPoint(rigMat, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);   // through rigMat, so yaw rotation is exact
  const dx = center[0] - eye[0], dy = center[1] - eye[1], dz = center[2] - eye[2];
  const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
  const pvS = multiply(proj, view);
  const prjY = (x, y, z) => { const w = pvS[3]*x + pvS[7]*y + pvS[11]*z + pvS[15]; return (pvS[1]*x + pvS[5]*y + pvS[9]*z + pvS[13]) / w; };
  const screenPxH = Math.abs(prjY(center[0], center[1] + halfH, center[2]) - prjY(center[0], center[1] - halfH, center[2])) * canvas.clientHeight / 2;
  const ph = Math.min(256, Math.max(2, Math.round(screenPxH / CHAR_PIXEL)));
  const pw = Math.min(256, Math.max(2, Math.round(ph * halfW / halfH)));
  const camDir = [dx / dist, dy / dist, dz / dist];
  const rl = Math.hypot(camDir[0], camDir[2]) || 1;
  const right = [-camDir[2] / rl, 0, camDir[0] / rl];   // horizontal billboard right (classic Y-only rotation)
  const miniEye = [center[0] - camDir[0] * 4, center[1] - camDir[1] * 4, center[2] - camDir[2] * 4];
  const sTex = renderer.renderCharacterSprite(rig.mesh, rigMat, ortho(halfW, halfH, 0.1, 8), lookAt(miniEye, center, [0, 1, 0]), pw, ph);
  renderer.drawCharacterSpriteQuad(sTex, center, halfW, halfH, right);
  return { center, halfW, halfH, pw, ph };
}
