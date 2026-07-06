// The shared pixelize pass (C8 E1 extraction): projection-exact sizing
// against hand-computed values, divisor = CHAR_PIXEL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCharacterSprite } from '../src/render/characterSprite.js';
import { CHAR_PIXEL } from '../src/render/renderer.js';
import { perspective, lookAt, trs } from '../src/world/mat4.js';

const approx = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('characterSprite: projection-exact sizing at CHAR_PIXEL', () => {
  const calls = [];
  const renderer = {
    renderCharacterSprite: (mesh, mat, o, v, pw, ph) => { calls.push({ pw, ph }); return {}; },
    drawCharacterSpriteQuad: () => {},
  };
  const canvas = { clientWidth: 1280, clientHeight: 720 };
  const rig = {
    mesh: {}, scale: 1,
    liveBounds: { minX: -0.3, maxX: 0.3, minY: 0, maxY: 1.8, minZ: -0.2, maxZ: 0.2 },
  };
  const rigMat = trs(0, 0, 10, 0, 0, 0, 1, 1, 1);
  const proj = perspective(Math.PI / 3, 1280 / 720, 0.1, 2000);
  const view = lookAt([0, 0.9, 0], [0, 0.9, 1], [0, 1, 0]);
  const d = drawCharacterSprite(renderer, canvas, rig, rigMat, proj, view, [0, 0.9, 0]);
  // center = model bounds centre translated to (0, 0.9, 10)
  approx(d.center[0], 0); approx(d.center[1], 0.9); approx(d.center[2], 10);
  approx(d.halfH, 0.9);
  approx(d.halfW, Math.hypot(0.6, 0.4) / 2);
  // screen half-height: worldH/dist * cot(fov/2) * H/2 -> px height,
  // ph = round(px / CHAR_PIXEL)
  const pxH = (1.8 / 10) * (1 / Math.tan(Math.PI / 6)) * (720 / 2);
  assert.equal(d.ph, Math.round(pxH / CHAR_PIXEL));
  assert.equal(d.pw, Math.round(d.ph * d.halfW / d.halfH));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ph, d.ph);
});
