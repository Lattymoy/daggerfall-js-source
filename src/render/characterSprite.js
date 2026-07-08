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
  // The FP viewmodel is the player's OWN BODY rig. The real camera sits
  // at eye height 1.7, which is INSIDE the 1.8-tall body - so rendering
  // the body at the player's feet with the mini-camera at eye height
  // put the camera INSIDE the torso and the mesh filled the screen from
  // every angle: Mac's "stuck in a hole" was the inside of his own
  // character. This frames it as a real FP weapon instead: the body is
  // placed in a FIXED local rig-space in front of a FIXED mini-camera
  // that looks slightly down, so only the upper body / arms / weapon
  // occupy the lower frame. It does NOT track the player's pitch (the
  // real camera pitch aiming into the body was the trap); yaw is baked
  // into the rig so it always faces the viewer. Placement is in the
  // rig's OWN space (origin), decoupled from world feet entirely.
  const rigMat = trs(0, -rig.liveFootY * s, 0, 0, 180, 0, s, s, s);   // face the camera, foot at origin
  const camY = 1.15;                     // below the head, at chest/arms level
  const camBack = 1.6;                   // stand back so the whole near body isn't clipping the lens
  const eye = [0, camY, -camBack];       // looking toward +z at the rig
  const look = [0, 0.55, 0];             // aim at the lower torso/hands
  const proj = perspective(Math.PI / 3, pw / ph, 0.05, 12);
  const view = lookAt(eye, look, [0, 1, 0]);
  const tex = renderer.renderCharacterSprite(rig.mesh, rigMat, proj, view, pw, ph);
  renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
}
