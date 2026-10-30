// ARMORY-MIRROR (2026-10-30, the owner: "New guild arm band isnt correct on the sprite. Head aura doesnt allign on the
// sprite"; bible/04-Characters/Aura-Armory.md section 7): A SPRITE'S PIECES WHERE ITS PICTURE IS. The world's lens is
// mirrored (world/mat4.js mirrorProjectionX), so the view's first row is the screen's LEFT; the pass stood a sprite's
// head, chest, arms and legs along it, across the card from where the billboard paints them. And a side view's arms are
// the body's own sides, so the Insignia Armlet is its left arm's there. Then the owner: "Guild patch is still wrong",
// "Still wrong on one of the angles", "Only worry about the layered system": the patch where the picture paints the arm
// clear of the body and as wide, a side view's at the body's back edge. tools/armorySpriteProbe.mjs draws it for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArmoryRenderer, armoryDraws, armletSide, armSide, cardRightOf, ARMORY_ARMLET } from '../../src/render/armoryPass.js';
import { newPose, poseFromFigure, poseWorld, spriteMarks, POSE_AT, ARM_BAND, ARM_PX } from '../../src/render/armoryPose.js';
import { lookAt, perspective, mirrorProjectionX, ortho, multiply } from '../../src/world/mat4.js';

const near = (/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b, eps = 1e-5) => [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < eps);
/** The world's camera at `eye` facing `yaw` (forward (sin, cos) - world.js's), its lens mirrored as the world's is. */
const worldCam = (/** @type {number[]} */ eye, /** @type {number} */ yaw) => ({
  proj: mirrorProjectionX(perspective(1.1, 1.5, 0.1, 100)),
  view: lookAt(eye, [eye[0] + Math.sin(yaw), eye[1], eye[2] + Math.cos(yaw)], [0, 1, 0]),
});
/** A point's NDC x under `proj` and `view`. */
const ndcX = (/** @type {any} */ proj, /** @type {any} */ view, /** @type {number[]} */ p) => {
  const m = multiply(proj, view), w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w;
};
/** A sprite's pose, its picture's marks given: the head `head` px right of the middle, the arms read or not. */
const spritePose = (/** @type {number} */ head, arms = true) => {
  const pose = newPose();
  const arm = (/** @type {number} */ s) => ({ sh: 10 * s, el: 13 * s, wa: 15 * s, rows: [86, 67, 50] });
  poseFromFigure({ base: 0, mpp: 0.019, marks: { top: 108, head, chest: head, pelvis: head, beast: null, arms: arms ? { L: arm(-1), R: arm(1) } : null }, shift: 0.05 }, pose);
  return pose;
};

test('ARMORY-MIRROR the card\'s right: the billboards\' camRight under the world\'s mirrored lens, the view\'s first row under a plain one (the profile\'s stage) - on the screen\'s right under both (mutants: the lens\'s mirror unread)', () => {
  for (const yaw of [0, 0.7, 2.1, -1.3]) {
    const eye = [3, 1.6, -2], { proj, view } = worldCam(eye, yaw);
    assert.ok(near(cardRightOf(proj, view), [Math.cos(yaw), 0, -Math.sin(yaw)]), `the world's: eotbBody's camRight at yaw ${yaw}`);
    const ahead = [eye[0] + Math.sin(yaw) * 5, eye[1], eye[2] + Math.cos(yaw) * 5], r = cardRightOf(proj, view);
    assert.ok(ndcX(proj, view, [ahead[0] + r[0], ahead[1], ahead[2] + r[2]]) > 0.1, 'on the world\'s screen, the right');
    const plain = perspective(1.1, 1.5, 0.1, 100), rp = cardRightOf(plain, view);
    assert.ok(near(rp, [view[0], view[4], view[8]]), 'a plain lens: the view\'s first row');
    assert.ok(ndcX(plain, view, [ahead[0] + rp[0], ahead[1], ahead[2] + rp[2]]) > 0.1, 'on a plain screen, the right');
    assert.ok(near(cardRightOf(ortho(1, 1, 0.1, 8), view), [view[0], view[4], view[8]]), 'the stage\'s orthographic lens: the first row');
  }
});

test('ARMORY-MIRROR the pass stands a sprite\'s crown over the head its picture paints, under the world\'s lens - the card\'s right, never the view\'s first row (mutants: the pass reads the view\'s row)', () => {
  const uniforms = /** @type {Record<string, any[]>} */ ({});
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z][A-Z_0-9]*$/.test(k) ? k
    : k === 'getUniformLocation' ? (/** @type {any} */ _p, /** @type {string} */ n) => ({ n })
    : k === 'uniform3fv' ? (/** @type {any} */ loc, /** @type {any} */ v) => { (uniforms[loc?.n] ??= []).push(Array.from(v)); }
    : () => ({})) });
  const pass = new ArmoryRenderer(/** @type {any} */ (gl), { crest: () => null });
  const yaw = 2.6, eye = [4 * Math.sin(yaw), 1.7, 4 * Math.cos(yaw)], { proj, view } = worldCam(eye, yaw + Math.PI);   // the eye before the body, facing it
  const pose = spritePose(6), w = { at: [0, 0, 0], yaw, kit: 'a0000', pose, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 4 };
  pass.draw([w], proj, view, new Float32Array(eye), 1, null, true);
  assert.equal(pass.drawn, 1);
  const brow = uniforms.uA[0], card = [Math.cos(yaw + Math.PI), 0, -Math.sin(yaw + Math.PI)];   // the crown's band at the brow; eotbBody's camRight
  const dx = pose.dx[POSE_AT.head / 3];
  assert.ok(Math.abs(dx - (0.05 + 6 * 0.019)) < 1e-6, 'the head 6 px right of the picture\'s middle, the card 5 cm right of the feet');
  const along = brow[0] * card[0] + brow[2] * card[2];
  assert.ok(Math.abs(along - dx) < 0.012, `the brow ${along.toFixed(3)} m along the card's right, where the picture's head is (${dx.toFixed(3)})`);
  assert.ok(ndcX(proj, view, brow) > 0, 'right of the feet on the screen, as the picture paints it');
});

test('ARMORY-MIRROR the armlet\'s side on a side view: the arms not read off the picture are the body\'s own, so its left arm\'s from before or behind it, as a rig\'s; a picture read keeps its sides (mutants: a side view read as the picture\'s; the arms called read)', () => {
  assert.equal(spritePose(0).armsTurned, false, 'arms read off the picture');
  const side = spritePose(0, false);
  assert.equal(side.armsTurned, true, 'a side view: the sets\' rows turned with the body');
  assert.equal(armletSide(side, [0, 0, 1], [0, 1.3, 0], [0.2, 1.6, 3]), 'L');
  assert.equal(armletSide(side, [0, 0, 1], [0, 1.3, 0], [0.2, 1.6, -3]), 'L', 'from either side of its chest');
  assert.equal(armletSide(spritePose(0), [0, 0, 1], [0, 1.3, 0], [0, 1.6, 3]), 'R', 'a front view: the picture\'s right');
  // read off the picture, facing +z, its right +x: behind and to its right the left arm is behind the body
  const read = spritePose(0), fwd = [0, 0, 1], chest = [0, 1.3, 0];
  assert.equal(armletSide(read, fwd, chest, [2, 1.6, -2]), null, 'three-quarter behind its right: none');
  assert.equal(armletSide(read, fwd, chest, [-2, 1.6, -2]), 'L', 'three-quarter behind its left: the near arm, the picture\'s left');
  assert.equal(armletSide(read, fwd, chest, [0.3, 1.6, -3]), 'L', 'square behind: the picture\'s left');
  assert.equal(armletSide(read, fwd, chest, [2, 1.6, 2]), 'R', 'three-quarter before its right: the far arm, beside the body');
  assert.deepEqual(armoryDraws('insigniaarmlet', { at: [0, 0, 0], yaw: 0, kit: '00c00', pose: read, kindle: 1, torn: -1, _d: 3 }, [2, 1.6, -2], true, [-0.7, 0, -0.7]), [], 'nothing drawn there');
  // the body facing +z seen square from its left (-x): the band on the near arm, the body's left
  const yaw = 0, eye = [-3, 1.5, 0.1], card = [0, 0, -1];   // the view's right from -x looking +x
  const draws = armoryDraws('insigniaarmlet', { at: [0, 0, 0], yaw, kit: '00c00', pose: side, kindle: 1, torn: -1, _d: 3 }, eye, true, card);
  const band = draws[0], mid = [0, 1, 2].map((i) => (band.A[i] + band.B[i]) / 2);
  const shL = poseWorld(side, 'shL', [0, 0, 0], yaw, [0, 0, 0], 0, card), elL = poseWorld(side, 'elL', [0, 0, 0], yaw, [0, 0, 0], 0, card);
  const at = [0, 1, 2].map((i) => shL[i] + (elL[i] - shL[i]) * ARMORY_ARMLET.at);
  assert.ok(near(mid, at, 1e-5), 'on the left upper arm');
  assert.ok(mid[0] < -0.1, 'the near side, toward the eye');
});

/** A picture the sets' size: a torso, a head, and two arms that hang against it at the shoulder and stand clear of it
 *  below row 74 (a gap of two columns) - Layered Gearing's arms in a strap's or a pauldron's rows. */
const armsPicture = (/** @type {boolean} */ clear = true) => {
  const w = 64, h = 112, px = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * w + x] = 0xff000000; };
  fill(26, 37, 0, 90); fill(28, 35, 91, 104);   // the torso and legs, the head
  fill(38, 43, 75, 88); fill(20, 25, 75, 88);   // the upper arms against the body
  if (clear) { fill(40, 45, 60, 74); fill(18, 23, 60, 74); } else { fill(38, 43, 60, 74); fill(20, 25, 60, 74); }
  return { px, w, h };
};

test('ARMORY-MIRROR a picture\'s band: from ARM_BAND.at down the upper arm, the first row where the arm stands clear of the body - its middle and its width; none where it never does; a side view\'s body edges instead (mutants: the band read at the shoulder\'s merged run; the run\'s far end; a side view\'s edges unread)', () => {
  const { px, w, h } = armsPicture();
  const m = spriteMarks(px, w, h);
  assert.deepEqual(m.arms.R.band, { row: 74, c: 42.5 - 31.5, wd: 6 }, 'the right arm\'s: row 74, its run 40..45');
  assert.deepEqual(m.arms.L.band, { row: 74, c: 20.5 - 31.5, wd: 6 }, 'the left\'s, mirrored');
  assert.ok(m.arms.R.band.row < 86 - (86 - 67) * ARM_BAND.at, 'below the shoulder\'s merged rows (the sets\' shoulder 86, elbow 67)');
  const stuck = armsPicture(false), ms = spriteMarks(stuck.px, stuck.w, stuck.h);
  assert.equal(ms.arms.R.band, null, 'an arm never clear of the body: none');
  assert.equal(m.flank, null, 'arms read: no flank');
  const side = spriteMarks(px, w, h, { arms: false });
  assert.deepEqual([side.flank.lo, side.flank.hi], [20 - 31.5, 43 - 31.5], 'a side view: the body\'s two edges at the band\'s row');
});

test('ARMORY-MIRROR the Insignia Armlet on a picture\'s band: there and as wide - the band round the arm\'s run, the crest in proportion; a side view\'s on the arm at the body\'s back edge, along the eye\'s line; none with the right side to the eye (mutants: the band unread; its width unread; the back edge the front; the eye\'s line lost; the right side drawn)', () => {
  const { px, w, h } = armsPicture(), mpp = 0.019;
  const pose = newPose();
  poseFromFigure({ base: 0, mpp, marks: spriteMarks(px, w, h), shift: 0 }, pose);
  assert.ok(Math.abs(pose.bands.L.y - 74 * mpp) < 1e-9 && Math.abs(pose.bands.L.dx + 11 * mpp) < 1e-9 && Math.abs(pose.bands.L.w - 6 * mpp) < 1e-9, 'the band carried in metres');
  // from behind (the picture's left the body's left), the world's card right
  const yaw = 0, eye = [0.3, 1.6, -3], right = [-1, 0, 0];
  const draws = armoryDraws('insigniaarmlet', { at: [0, 0, 0], yaw, kit: '00c00', pose, kindle: 1, torn: -1, _d: 3 }, eye, true, right);
  const band = draws[0], mid = [0, 1, 2].map((i) => (band.A[i] + band.B[i]) / 2);
  assert.ok(near(mid, [11 * mpp, 74 * mpp, 0], 1e-6), `on the arm's clear run (${mid.map((v) => v.toFixed(3))})`);
  assert.ok(Math.abs(band.r[0] - 3 * mpp) < 1e-9, 'the band as wide as the painted arm');
  assert.ok(Math.abs(draws[2].size - ARMORY_ARMLET.size * (3 * mpp) / ARMORY_ARMLET.r) < 1e-9, 'the crest in proportion to it');
  // a side view: arms not read, the body's edges; facing +z and seen from its left (-x), its back is the card's right
  const side = newPose();
  poseFromFigure({ base: 0, mpp, marks: spriteMarks(px, w, h, { arms: false }), shift: 0 }, side);
  const sEye = [-3, 1.5, 0.1], sRight = [0, 0, -1];
  const sd = armoryDraws('insigniaarmlet', { at: [0, 0, 0], yaw, kit: '00c00', pose: side, kindle: 1, torn: -1, _d: 3 }, sEye, true, sRight)[0];
  const sMid = [0, 1, 2].map((i) => (sd.A[i] + sd.B[i]) / 2), back = (11.5 - ARM_PX.half) * mpp, card = [0, side.flank.y, -back];
  const toMid = [0, 1, 2].map((i) => sMid[i] - sEye[i]), toCard = [0, 1, 2].map((i) => card[i] - sEye[i]);
  const cross = [toMid[1] * toCard[2] - toMid[2] * toCard[1], toMid[2] * toCard[0] - toMid[0] * toCard[2], toMid[0] * toCard[1] - toMid[1] * toCard[0]];
  assert.ok(Math.hypot(...cross) / Math.hypot(...toCard) < 1e-6, 'on the eye\'s line through the arm painted at its back edge');
  assert.ok(Math.hypot(...toMid) < Math.hypot(...toCard) - 0.1, 'before the card: the near arm');
  assert.deepEqual(armoryDraws('insigniaarmlet', { at: [0, 0, 0], yaw, kit: '00c00', pose: side, kindle: 1, torn: -1, _d: 3 }, [3, 1.5, 0.5], true, [0, 0, 1]), [], 'its right side to the eye, a little before it: none');
});

test('ARMORY-MIRROR both arms\' pieces, each arm as the picture paints it: the right arm\'s side and where it is hidden, as the left\'s mirrored; one chain from three-quarters behind; each band on its arm\'s clear run and as wide (the owner: "ensure the armory aura sets dont show through the body and allign perfectly on the sprites"; mutants: the right arm read as the left; its picture side swapped; the hidden arm drawn; the band unread)', () => {
  const { px, w, h } = armsPicture(), mpp = 0.019, fwd = [0, 0, 1], chest = [0, 1.3, 0];
  const read = newPose();
  poseFromFigure({ base: 0, mpp, marks: spriteMarks(px, w, h), shift: 0 }, read);
  assert.equal(armSide(read, fwd, chest, [0, 1.6, 3], 'right'), 'L', 'from before it: the picture\'s left');
  assert.equal(armSide(read, fwd, chest, [0.3, 1.6, -3], 'right'), 'R', 'from behind: the picture\'s right');
  assert.equal(armSide(read, fwd, chest, [-2, 1.6, -2], 'right'), null, 'three-quarter behind its left: the right arm hidden');
  assert.equal(armSide(read, fwd, chest, [2, 1.6, -2], 'right'), 'R', 'three-quarter behind its right: the near arm');
  assert.equal(armSide(newPose(), fwd, chest, [0, 1.6, 3], 'right'), 'R', 'a rig\'s right bones');
  const side = newPose();
  poseFromFigure({ base: 0, mpp, marks: spriteMarks(px, w, h, { arms: false }), shift: 0 }, side);
  assert.deepEqual([armSide(side, fwd, chest, [-3, 1.5, 0.5], 'right'), armSide(side, fwd, chest, [-3, 1.5, 0.5], 'left')], [null, 'L'], 'its left side seen: the right arm behind it');
  const wearer = (/** @type {string} */ kit, /** @type {any} */ pose) => ({ at: [0, 0, 0], yaw: 0, kit, pose, kindle: 1, torn: -1, _d: 3 });
  const behind = armoryDraws('ashbound', wearer('00a00', read), [2, 1.6, -2], true, [-0.7, 0, 0.7]);
  assert.equal(behind.filter((d) => d.mesh === 0).length, 1, 'three-quarter behind: one arm\'s chain, the near one\'s');
  // from before it, its card right +x: each band on its arm's clear run, as wide
  const right = [1, 0, 0], front = armoryDraws('eternalarmlets', wearer('00b00', read), [0, 1.6, 3], true, right).filter((d) => d.mesh === 0);
  assert.equal(front.length, 2, 'both arms');
  const across = front.map((d) => +(((d.A[0] + d.B[0]) / 2) / mpp).toFixed(1)).sort((p, q) => p - q);
  assert.ok(Math.abs(across[0] + 11) < 0.3 && Math.abs(across[1] - 11) < 0.3, `each band on its arm's run, 11 px either side (${across})`);
  assert.ok(Math.abs(front[0].r[1] - 0.066 * (6 * mpp) / (2 * 0.064)) < 1e-9, 'as wide as the painted arm');
  // the chain runs the arm's own slope, moved across to pass through its band (the reader's line stands 1.7 px inside it)
  const chains = armoryDraws('ashbound', wearer('00a00', read), [0, 1.6, 3], true, right).filter((d) => d.mesh === 0);
  for (const c of chains) {
    const y = read.bands.R.y, t = (y - c.A[1]) / (c.B[1] - c.A[1]), x = (c.A[0] + (c.B[0] - c.A[0]) * t) / mpp;
    assert.ok(Math.abs(Math.abs(x) - 11) < 0.05, `through the band at its row (${x.toFixed(2)} px)`);
  }
});

test('ARMORY-MIRROR an arm never clear of the body (a three-quarter back view\'s near arm against its back): its band where its colour ends - when most rows agree on a steady width; none on a picture with no step (mutants: the colour unread; the far side of the step taken)', () => {
  const w = 64, h = 112, px = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1, /** @type {number} */ c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * w + x] = c; };
  const DARK = 0xff202020, SKIN = 0xff7090d0;   // a dark back; a bare arm (color32: red low byte)
  fill(26, 37, 0, 90, DARK); fill(28, 35, 91, 104, DARK);
  fill(38, 46, 60, 88, SKIN); fill(17, 25, 60, 88, DARK);   // the right arm a skin column against the back; the left as dark as it
  const m = spriteMarks(px, w, h);
  assert.equal(m.arms.R.band.wd, 9, 'the skin column, 9 px');
  assert.equal(m.arms.R.band.c, 42 - 31.5, 'its middle');
  assert.equal(m.arms.L.band, null, 'no step on the left: none');
  for (let y = 60; y <= 88; y++) fill(17, y % 2 ? 20 : 25, y, y, SKIN);   // a step that jumps 4 to 9 px row by row: a strap's, not an arm's
  assert.equal(spriteMarks(px, w, h).arms.L.band, null, 'an unsteady width: none');
});
