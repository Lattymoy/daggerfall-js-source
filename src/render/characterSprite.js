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
import { multiply, ortho, lookAt, perspective, transformPoint, trs } from '../world/mat4.js';
import { CHAR_PIXEL, CHAR_SPRITE_RT_SIZE } from './renderer.js';

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
  const ph = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(screenPxH / CHAR_PIXEL)));
  const pw = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(ph * halfW / halfH)));
  const camDir = [dx / dist, dy / dist, dz / dist];
  const rl = Math.hypot(camDir[0], camDir[2]) || 1;
  const right = [-camDir[2] / rl, 0, camDir[0] / rl];   // horizontal billboard right (classic Y-only rotation)
  const miniEye = [center[0] - camDir[0] * 4, center[1] - camDir[1] * 4, center[2] - camDir[2] * 4];
  const sTex = renderer.renderCharacterSprite(rig.mesh, rigMat, ortho(halfW, halfH, 0.1, 8), lookAt(miniEye, center, [0, 1, 0]), pw, ph);
  renderer.drawCharacterSpriteQuad(sTex, center, halfW, halfH, right, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);   // sample the sub-rect (fixed RT, audit fix)
  return { center, halfW, halfH, pw, ph };
}

/**
 * THE FP VIEWMODEL PASS (E3d): the player's own rig, rendered from
 * the player's eye through the SAME pixelize standard, composited as
 * a fullscreen overlay (classic draws the weapon over everything).
 * The FP clips were authored with the camera riding the head ("lean
 * pitches the EYE"; deltas start/end 0 so the frame is exact at both
 * ends). pw/ph = screen / CHAR_PIXEL, clamped PROPORTIONALLY to the
 * fixed RT (both shrink together so the overlay never squashes;
 * pixel size grows slightly past ~3.5k-wide displays).
 */
export function drawFirstPersonViewmodel(renderer, canvas, rig, feet, yaw, pitch, eyeHeight) {
  const wantW = canvas.clientWidth / CHAR_PIXEL, wantH = canvas.clientHeight / CHAR_PIXEL;
  const scale = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
  const pw = Math.max(2, Math.round(wantW * scale));
  const ph = Math.max(2, Math.round(wantH * scale));
  const s = rig.scale;
  const rigMat = trs(feet[0], feet[1] - rig.liveFootY * s, feet[2], 0, yaw * 180 / Math.PI, 0, s, s, s);
  const eye = [feet[0], feet[1] + eyeHeight, feet[2]];
  const cp = Math.cos(pitch);
  const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const proj = perspective(Math.PI / 3, pw / ph, 0.05, 12);
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
  const tex = renderer.renderCharacterSprite(rig.mesh, rigMat, proj, view, pw, ph);
  renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
}
