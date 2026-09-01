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
  return drawRigSpriteBox(renderer, canvas, rig.mesh, rigMat, { center, halfW, halfH }, proj, view, eye);
}

/**
 * The pixelize standard's TAIL, one home (MW-D24 extracted it verbatim
 * so the Morrowind third-person body and the voxel foes size and
 * composite through the SAME law): given the world-space box a rig
 * occupies - its center, half-height along world up and azimuth-safe
 * half-width - render the mesh into the low-res sprite under a fitted
 * ortho from the main view's azimuth and composite the camera-facing
 * fogged quad. Callers own the box because they own the rig's space
 * (the voxel rigs measure Y-up rig bounds; the Morrowind body measures
 * its Z-up assembly and maps axes before calling).
 */
/** MW-D43b (Mac: "3rd person is still pixelated"): `pixel` defaults to
 *  CHAR_PIXEL, which is the SPRITE standard and stays the law for every
 *  Daggerfall character drawn through here. The Morrowind third-person
 *  body is not one - it is the same mesh the first-person arm is, and
 *  MW-D43 already gave that its own dial while missing this pass, which
 *  is the OTHER half of the same picture and the half Mac was looking
 *  at when he said it was still wrong. */
export function drawRigSpriteBox(renderer, canvas, mesh, rigMat, { center, halfW, halfH }, proj, view, eye, pixel = CHAR_PIXEL) {
  const dx = center[0] - eye[0], dy = center[1] - eye[1], dz = center[2] - eye[2];
  const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
  const pvS = multiply(proj, view);
  const prjY = (x, y, z) => { const w = pvS[3]*x + pvS[7]*y + pvS[11]*z + pvS[15]; return (pvS[1]*x + pvS[5]*y + pvS[9]*z + pvS[13]) / w; };
  const screenPxH = Math.abs(prjY(center[0], center[1] + halfH, center[2]) - prjY(center[0], center[1] - halfH, center[2])) * canvas.clientHeight / 2;
  const ph = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(screenPxH / pixel)));
  const pw = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(ph * halfW / halfH)));
  const camDir = [dx / dist, dy / dist, dz / dist];
  const rl = Math.hypot(camDir[0], camDir[2]) || 1;
  const right = [-camDir[2] / rl, 0, camDir[0] / rl];   // horizontal billboard right (classic Y-only rotation)
  const miniEye = [center[0] - camDir[0] * 4, center[1] - camDir[1] * 4, center[2] - camDir[2] * 4];
  const sTex = renderer.renderCharacterSprite(mesh, rigMat, ortho(halfW, halfH, 0.1, 8), lookAt(miniEye, center, [0, 1, 0]), pw, ph);
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
// ON ICE (2026-08-17, Mac): the voxel FP viewmodel is parked in
// favor of the TRUE classic method (combat/fpsWeapon.js, WEAPON*.CIF
// per FPSWeapon). No consumer; kept whole with its probe
// (tools/fpProbe.mjs) and pins for a reversible thaw.
export function drawFirstPersonViewmodel(renderer, canvas, rig, feet, yaw, eyeHeight) {
  const wantW = canvas.clientWidth / CHAR_PIXEL, wantH = canvas.clientHeight / CHAR_PIXEL;
  const scale = Math.min(1, CHAR_SPRITE_RT_SIZE / wantW, CHAR_SPRITE_RT_SIZE / wantH);
  const pw = Math.max(2, Math.round(wantW * scale));
  const ph = Math.max(2, Math.round(wantH * scale));
  const s = rig.scale;
  // FP viewmodel framing. The rig is the player's own body; the FP
  // camera "rides the head". Two things must be true or the body fills
  // the screen (Mac's "stuck in a hole" = the inside of his own torso):
  //   1. NO world pitch on this camera. The original applied
  //      sin(pitch)/cos(pitch), so pitching up tilted the lens into the
  //      head/torso from beneath. Design law (anims.js): "the camera
  //      rides the head - lean pitches the EYE" - pitch is the anim
  //      lean channel, never a camera tilt. This camera looks LEVEL.
  //   2. The body must sit BEHIND the lens, not centered on it. The
  //      camera is at the head; the torso/head are at the camera's own
  //      xz, i.e. point-blank in front of the lens even looking level.
  //      So place the rig BACK along the view dir (and the head just
  //      behind the near plane) - only the raised forearm/weapon of the
  //      fpMelee1H pose reaches forward into the lower frame.
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  // Framing constants are PROBE-LOCKED (tools/fpProbe.mjs, 2026-08-16
  // audit). The P9 hole-fix values (back 0.45, cast -0.12) overshot: the
  // whole rig, raised forearm included, sat below/left of the frustum and
  // the viewmodel rendered ZERO pixels in every state and frame. At back
  // 0.25 / cast -0.20 the fist enters the frame from the bottom-right
  // corner at idle (~4.8% cover, classic 1H ready) and every strike
  // sweeps across; the body still sits behind the near plane.
  const back = 0.25;                       // push the body back so head/torso clear the lens
  const rigX = feet[0] - sinY * back;
  const rigZ = feet[2] - cosY * back;
  const rigMat = trs(rigX, feet[1] - rig.liveFootY * s, rigZ, 0, yaw * 180 / Math.PI, 0, s, s, s);
  const eye = [feet[0], feet[1] + eyeHeight, feet[2]];
  const fwd = [sinY, -0.20, cosY];         // yaw + a fixed downward cast to the hands (NOT world pitch)
  const proj = perspective(Math.PI / 3, pw / ph, 0.05, 12);
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
  const tex = renderer.renderCharacterSprite(rig.mesh, rigMat, proj, view, pw, ph);
  renderer.drawScreenOverlayQuad(tex, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE);
}
