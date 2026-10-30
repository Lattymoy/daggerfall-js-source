// ARMORY-MIRROR (2026-10-30, the owner: "New guild arm band isnt correct on the sprite. Head aura doesnt allign on the
// sprite"; bible/04-Characters/Aura-Armory.md section 7): A SPRITE'S PIECES WHERE ITS PICTURE IS. The world's lens is
// mirrored (world/mat4.js mirrorProjectionX), so the view's first row is the screen's LEFT; the pass stood a sprite's
// head, chest, arms and legs along it, across the card from where the billboard paints them. And a side view's arms are
// the body's own sides, so the Insignia Armlet is its left arm's there. tools/armorySpriteProbe.mjs draws it for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArmoryRenderer, armoryDraws, armletSide, cardRightOf, ARMORY_ARMLET } from '../../src/render/armoryPass.js';
import { newPose, poseFromFigure, poseWorld, POSE_AT } from '../../src/render/armoryPose.js';
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
