// MWHEAD1 (2026-09-25, Mac: "The morrowind's model's head gets cut off in third person view. This is pre exhisting and
// has happened for awhile"; asked what it looks like: the top sliced flat, the same at every zoom and look).
//
// The third-person body is a picture: an ortho of the rig along the eye's ray (render/characterSprite.js
// drawRigSpriteBox), stood upright in the world. Its window was the box's WORLD half-height, but the ray is pitched -
// the Morrowind eye sits at the head (mwCamera FOCAL_HEIGHT 124) and looks down to the body's middle - and a pitched
// ortho lifts whatever stands far along the view: picture height v cos p + h sin p. The head stands forward of a box
// centre that a sheathed longsword pulls back toward the camera, so its top rose out of the window and was cut flat.
//
// Driven through the real drawRigSpriteBox against a capturing renderer: every corner of the box, at every eye the
// Morrowind camera can take around the body, must land inside the picture it is drawn from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawRigSpriteBox } from '../src/render/characterSprite.js';
import { perspective, lookAt, trs, multiply } from '../src/world/mat4.js';
import { FOCAL_HEIGHT, BASE_DISTANCE, MIN_DISTANCE, MAX_DISTANCE, MW_UNITS_PER_METER } from '../src/player/mwCamera.js';

const canvas = { clientWidth: 1600, clientHeight: 1000 };
const id = trs(0, 0, 0, 0, 0, 0, 1, 1, 1);
const proj = perspective(Math.PI / 3, 1.6, 0.1, 2000);
const capture = () => {
  const c = {};
  return { c, renderCharacterSprite: (mesh, model, op, ov, pw, ph) => { Object.assign(c, { op, ov, pw, ph }); return {}; }, drawCharacterSpriteQuad: (t, center, hw, hh) => { Object.assign(c, { center, hw, hh }); } };
};
/** A point's place in the captured picture, in NDC (inside is |x|, |y| <= 1). */
const inPicture = (c, p) => {
  const m = multiply(c.op, c.ov);
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w];
};
const U = 1 / MW_UNITS_PER_METER;

// A Morrowind body facing +z (away from a camera behind it), 128 units tall, with a sheathed longsword trailing ~60
// units behind the hip: the drawn box's centre sits well behind the head.
const BODY = { minX: -22, maxX: 22, minZ: -62, maxZ: 14, minY: 0, maxY: 131 };   // x lateral, z forward, y up (MW units)
const box = {
  center: [0, (BODY.minY + BODY.maxY) / 2 * U, (BODY.minZ + BODY.maxZ) / 2 * U],
  halfW: Math.hypot(BODY.maxX - BODY.minX, BODY.maxZ - BODY.minZ) * U / 2,
  halfH: (BODY.maxY - BODY.minY) * U / 2,
  anchor: [0, 64 * U, 0],   // PR-BOW1: the actor's own axis at the body's mid-height
};
const HEAD_TOP = [0, 131 * U, 4 * U];   // the crown, over the neck - forward of the box centre by ~28 units
const corners = [];
for (const x of [BODY.minX, BODY.maxX]) for (const y of [BODY.minY, BODY.maxY]) for (const z of [BODY.minZ, BODY.maxZ]) corners.push([x * U, y * U, z * U]);

/** The Morrowind third-person eye: the focal point at the head, pulled back along the look by `dist` units. */
const mwEye = (dist, pitch) => {
  const focal = [0, FOCAL_HEIGHT * U, 0];
  return [focal[0], focal[1] - Math.sin(pitch) * dist * U, focal[2] - Math.cos(pitch) * dist * U];
};

test('MWHEAD1: the head\'s crown is inside the picture at the Morrowind camera\'s own framing - the flat slice Mac saw', () => {
  const eye = mwEye(BASE_DISTANCE, 0);   // the default distance, looking level: the eye at the head, the ray down to the middle
  const r = capture();
  drawRigSpriteBox(r, canvas, null, id, box, proj, lookAt(eye, [0, FOCAL_HEIGHT * U, 1], [0, 1, 0]), eye, 3);
  const [, y] = inPicture(r.c, HEAD_TOP);
  assert.ok(y <= 1, `the crown draws at picture height ${y.toFixed(3)} - above 1 is the slice`);
  // and the world half-height alone would have cut it: the pitch is the whole cause
  const t = Math.abs(box.anchor[1] - eye[1]) / Math.hypot(box.anchor[1] - eye[1], box.anchor[2] - eye[2]);
  const oldTop = (HEAD_TOP[1] - box.center[1]) * Math.sqrt(1 - t * t) + (HEAD_TOP[2] - box.center[2]) * t;
  assert.ok(oldTop > box.halfH, `under the old window (${box.halfH.toFixed(3)}) the crown stood at ${oldTop.toFixed(3)}`);
});

test('MWHEAD1: every corner of the box is inside its picture at every eye the camera can take - every zoom, every look, every side', () => {
  for (const dist of [MIN_DISTANCE, 60, BASE_DISTANCE, 400, MAX_DISTANCE]) {
    for (let pitchDeg = -80; pitchDeg <= 80; pitchDeg += 10) {
      for (const yawDeg of [0, 90, 180, 270]) {
        const e0 = mwEye(dist, pitchDeg * Math.PI / 180);
        const a = yawDeg * Math.PI / 180;
        const eye = [e0[0] * Math.cos(a) + e0[2] * Math.sin(a), e0[1], -e0[0] * Math.sin(a) + e0[2] * Math.cos(a)];
        const r = capture();
        drawRigSpriteBox(r, canvas, null, id, box, proj, lookAt(eye, [0, FOCAL_HEIGHT * U, 0], [0, 1, 0]), eye, 3);
        for (const p of corners) {
          const [x, y] = inPicture(r.c, p);
          assert.ok(Math.abs(x) <= 1 + 1e-6 && Math.abs(y) <= 1 + 1e-6, `dist ${dist}, pitch ${pitchDeg}, yaw ${yawDeg}: corner ${p.map((v) => v.toFixed(2))} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
        }
      }
    }
  }
});

test('MWHEAD1: a level ray draws exactly what it did - the window grows only by what the pitch lifts, and the quad carries it at one texel law', () => {
  // an eye level with the anchor: no tilt, the world half-height
  const eye = [0, box.anchor[1], -3];
  const r = capture();
  drawRigSpriteBox(r, canvas, null, id, box, proj, lookAt(eye, box.anchor, [0, 1, 0]), eye, 3);
  assert.ok(Math.abs(1 / r.c.op[5] - box.halfH) < 1e-6, 'level: the box\'s own half-height');
  assert.equal(r.c.hh, box.halfH, 'and the quad the same');
  // pitched: the quad is as tall as the window, so the picture still draws at true world size
  const e2 = mwEye(BASE_DISTANCE, 0.4);
  const r2 = capture();
  drawRigSpriteBox(r2, canvas, null, id, box, proj, lookAt(e2, [0, FOCAL_HEIGHT * U, 0], [0, 1, 0]), e2, 3);
  const t2 = Math.abs(box.anchor[1] - e2[1]) / Math.hypot(box.anchor[0] - e2[0], box.anchor[1] - e2[1], box.anchor[2] - e2[2]);
  assert.ok(Math.abs(r2.c.hh - (box.halfH * Math.sqrt(1 - t2 * t2) + box.halfW * t2)) < 1e-9, 'the window is the box pitched along the ray');
  assert.ok(Math.abs(1 / r2.c.op[5] - r2.c.hh) < 1e-6, 'and the quad is the window');
  assert.ok(Math.abs(1 / r2.c.op[0] - box.halfW) < 1e-6, 'the width is untouched');
  assert.ok(Math.abs(r2.c.pw / r2.c.ph - r2.c.hw / r2.c.hh) < 1 / r2.c.ph + 1e-9, 'texels stay square');
});
