// @ts-check
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

/** The upright quad's vertical - every sprite's but a leaned one's (AUDIT OW4 J6). */
const WORLD_UP = Object.freeze([0, 1, 0]);

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
/** PR-BOW1 (2026-09-24, player report: "Equipping a bow enlarges your
 *  character"): `anchor`, optional - the point the picture is OF. The
 *  ortho image is true world size, so where the quad stands sets the
 *  figure's size on screen, and it stood at the box's CENTRE - which gear
 *  moves. Weapon Sheathing's iron longsword runs y 2.9..59.5 out from its
 *  grip and its long bow -38.5..46 (gripped mid-stave): the sword pushed
 *  the Morrowind body's quad a third of a metre past the body, away from
 *  a camera behind it, and drew the body 10-14% small, the bow 4-6%, so
 *  going from the one to the other GREW the character. With an anchor the
 *  picture is taken along the eye's ray to the ANCHOR (still centred on
 *  the box, so the gear stays in the window) and the quad stands where
 *  the anchor's own image lands on the anchor (landAnchor): every point
 *  then draws at a place that does not depend on the box at all, so the
 *  box is only the window and its resolution. No anchor - the voxel rigs,
 *  whose box is the body - is exactly what stood. */
/** AUDIT OW4 J6: `up`, optional - the quad's own vertical (the travel view's leaned up, player/travelCamera.js
 *  leanedUp; world up when absent). The picture is taken along the PITCHED ray - already the body as the raised eye sees
 *  it - and was pasted on an UPRIGHT quad, which the same eye then saw foreshortened again: at the Overworld's 52-75
 *  degree tilt the grown Morrowind body stood a half to a quarter of its height, squashed. The sprite lane leans its quad
 *  by the view's up (eotbBody.js, the flats' own lean); the body's quad now leans with it - built on `up`, the anchor
 *  landed on itself along it, and its resolution read along it. */
/** MWNPC5: the texels a body's picture is padded by on every side for its tells - the outline's two (a glint, an elite,
 *  an elite's corpse), and the embers' climb over an elite's head (ELITE_RISE 18, the outline's 2 under it). Symmetric,
 *  so the picture's centre and the quad's stay where they stood; 0 for a body with none - its picture exactly as it was. */
export function bodyFxPad(fx) {
  if (!fx || fx.dissolve?.[0] > 0) return 0;   // a body burning away draws no outline (the shader's own gate)
  if (fx.elite > 0) return 20;
  return fx.elite < 0 || fx.glint?.[3] > 0 ? 2 : 0;
}

export function drawRigSpriteBox(renderer, canvas, mesh, rigMat, { center, halfW: boxW, halfH: boxH, anchor = null, hitFlash = 0, conceal = null, up = null, fx = null }, proj, view, eye, pixel = CHAR_PIXEL) {
  const aim = anchor && Math.hypot(anchor[0] - eye[0], anchor[1] - eye[1], anchor[2] - eye[2]) > 1e-6 ? anchor : center;   // PR-BOW1: the ray the picture is taken along
  const dx = aim[0] - eye[0], dy = aim[1] - eye[1], dz = aim[2] - eye[2];
  const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
  const camDir = [dx / dist, dy / dist, dz / dist];
  // MWHEAD1 (2026-09-25, Mac: "The morrowind's model's head gets cut off in third person view" - the top sliced flat,
  // the same at every zoom): THE WINDOW IS THE BOX AS THE PICTURE SEES IT. The picture is an ortho along camDir, and
  // camDir is PITCHED - the third-person eye sits at the head (mwCamera FOCAL_HEIGHT) and looks down the ray to the
  // body's middle. Tilted by p, a box point `v` above the centre and `h` further along the view draws at picture height
  // v cos p + h sin p, so the box's far top corner stands above `halfH` whenever h sin p > halfH (1 - cos p). The
  // window was the world half-height alone, so whatever stood far and high was cut: on the Morrowind body the head,
  // which stands forward of a box centre that a sheathed longsword (PR-BOW1: y 2.9..59.5 from its grip) pulls back
  // toward a camera behind it - a flat slice off the top of the head at every zoom. `halfW` is the box's
  // azimuth-safe horizontal radius, so |h| <= halfW and the window below holds the whole box at any pitch; level
  // (tilt 0) it is the world half-height, so a level look draws exactly what it did.
  // The ray's own slope - off the true length, not `dist`: that is floored at 0.5 (an eye on the aim has no ray),
  // which leaves camDir short of unit length for an eye closer than that, and read a close camera's pitch low.
  const tilt = Math.min(1, Math.abs(dy) / (Math.hypot(dx, dy, dz) || 1));
  let halfW = boxW;
  let halfH = boxH * Math.sqrt(1 - tilt * tilt) + halfW * tilt;
  const rl = Math.hypot(camDir[0], camDir[2]) || 1;
  const right = [-camDir[2] / rl, 0, camDir[0] / rl];   // horizontal billboard right (classic Y-only rotation)
  const qUp = up ?? WORLD_UP;   // AUDIT OW4 J6: the quad's vertical
  const at = aim === center ? center : landAnchor(center, anchor, camDir, right, qUp);   // PR-BOW1: where the quad stands
  const pvS = multiply(proj, view);
  const prjY = (x, y, z) => { const w = pvS[3]*x + pvS[7]*y + pvS[11]*z + pvS[15]; return (pvS[1]*x + pvS[5]*y + pvS[9]*z + pvS[13]) / w; };
  // PR-BOW1: the resolution is read where the quad is drawn, so a texel stays `pixel` screen pixels. AUDIT RETRO1 C6:
  // under retro mode the world is drawn into its small image, so the sprite is sized in the IMAGE's pixels and a texel
  // is a whole number of them - a canvas-sized texel (9 px) is 1.67 of a 200-row image's, and the sprite's texels came
  // out 1 and 2 pixels wide and shimmered
  const span = renderer.retroImageSpan ?? null;
  const texel = span ? Math.max(1, Math.round(pixel * span[0] / span[1])) : pixel;
  const screenPxH = Math.abs(prjY(at[0] + qUp[0] * halfH, at[1] + qUp[1] * halfH, at[2] + qUp[2] * halfH) - prjY(at[0] - qUp[0] * halfH, at[1] - qUp[1] * halfH, at[2] - qUp[2] * halfH)) * (span ? span[0] : canvas.clientHeight) / 2;
  let ph = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(screenPxH / texel)));
  // MWNPC5: the tells' room - `pad` texels a side, the world half-extents grown by the same texels (one texel the
  // picture's 2 halfH / ph), so a texel stays the size it was
  const pad = bodyFxPad(fx);
  if (pad) {
    const grow = (2 * pad) / ph;
    halfW += halfH * grow; halfH *= 1 + grow;
    ph = Math.min(CHAR_SPRITE_RT_SIZE, ph + 2 * pad);
  }
  const pw = Math.min(CHAR_SPRITE_RT_SIZE, Math.max(2, Math.round(ph * halfW / halfH)));
  // AUDIT OW3 J6: the picture's depth holds the WHOLE box - no point of it lies farther along the ray from its centre than
  // halfW + boxH, so the eye stands at least that far back (and the far plane as far past). A body's box is a metre or
  // two - the 4 m that always stood; a body the travel view grows (OW-BIG, up to x12) was sliced by the fixed planes
  const reach = Math.max(4, halfW + boxH + 1);
  const miniEye = [center[0] - camDir[0] * reach, center[1] - camDir[1] * reach, center[2] - camDir[2] * reach];
  const sProj = ortho(halfW, halfH, 0.1, 2 * reach), sView = lookAt(miniEye, center, [0, 1, 0]);
  // MWNPC2: an open batch (renderer.js beginCharacterSpriteBatch) takes the picture as measured, and the flush draws it
  // in its own tile of the one bind; a lone call takes its own pass, as every call did
  if (renderer.characterSpriteBatchOpen) {
    renderer.queueCharacterSprite({ mesh, model: rigMat, proj: sProj, view: sView, pw, ph, tx: 0, ty: 0, quad: { at, halfW, halfH, right, hitFlash, conceal, up, fx } });
    return { center: at, halfW, halfH, pw, ph };
  }
  const sTex = renderer.renderCharacterSprite(mesh, rigMat, sProj, sView, pw, ph);
  renderer.drawCharacterSpriteQuad(sTex, at, halfW, halfH, right, pw / CHAR_SPRITE_RT_SIZE, ph / CHAR_SPRITE_RT_SIZE, hitFlash, conceal, up, null, fx);   // MWNPC5: and a foe's tells   // HITFLASH1: a struck body's red; INVIS-LOOK: a concealed peer's body blends; AUDIT OW4 J6: leaned by `up`   // sample the sub-rect (fixed RT, audit fix)
  return { center: at, halfW, halfH, pw, ph };
}

/** PR-BOW1: the quad centre that lands `anchor`'s own image ON `anchor`.
 *  The picture is an ortho along `dir` centred on `center` - its x is the
 *  billboard's `right`, its y lookAt's up for that axis - so a point P
 *  sits at picture (x.(P - center), y.(P - center)); the quad draws the
 *  picture upright, x along `right` and y along WORLD up, about its
 *  centre Q. Q = anchor - right x.(anchor - center) - up y.(anchor - center)
 *  puts the anchor on itself, and then every P draws at
 *  anchor + right x.(P - anchor) + up y.(P - anchor): `center` has left
 *  the law. With anchor = center it is center. AUDIT OW4 J6: `quadUp` the
 *  quad's own vertical when it leans (drawRigSpriteBox's `up`) - Q moves
 *  down IT, not world up; upright it is exactly what stood. */
export function landAnchor(center, anchor, dir, right, quadUp = WORLD_UP) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const nx = dir[0] / l, ny = dir[1] / l, nz = dir[2] / l;
  const hl = Math.hypot(nx, nz) || 1;
  const up = [-nx * ny / hl, hl, -nz * ny / hl];   // (-dir) x right: lookAt's y for a camera looking along dir
  const ax = anchor[0] - center[0], ay = anchor[1] - center[1], az = anchor[2] - center[2];
  const px = ax * right[0] + ay * right[1] + az * right[2];
  const py = ax * up[0] + ay * up[1] + az * up[2];
  return [anchor[0] - right[0] * px - quadUp[0] * py, anchor[1] - right[1] * px - quadUp[1] * py, anchor[2] - right[2] * px - quadUp[2] * py];
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
