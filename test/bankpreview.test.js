// H4 - THE BANK PURCHASE WINDOW'S LIVE 3D PREVIEW, pinned against
// DaggerfallBankPurchasePopUp's Update (:163-178) and
// Display3dModelSelection (:239-260). The WINDOW owns the rotation
// clock and the camera law; the HOST owns the scissored second camera
// pass - the split is the pin's subject, because either half alone
// draws nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BankPurchaseWindow, PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y,
  PREVIEW_ROT_SPEED, PREVIEW_HOUSE_CAMERA, PREVIEW_NEAR, PREVIEW_FAR,
} from '../src/ui/bankPurchaseWindow.js';
import { SHIP_MODEL_IDS, SHIP_CAMERA_DIST } from '../src/systems/banking.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('H4: the constants are the popup\'s own - rot 0.02s, houses at (0,3,-20), near 0.7 far 100, the ship pairs', () => {
  assert.equal(PREVIEW_ROT_SPEED, 0.02, 'rotSpeed (:68)');
  assert.deepEqual(PREVIEW_HOUSE_CAMERA, { y: 3, z: -20 }, 'Display3dModelSelection :245');
  assert.equal(PREVIEW_NEAR, 0.7);
  assert.equal(PREVIEW_FAR, 100);
  assert.deepEqual([...SHIP_MODEL_IDS], [910, 909], 'shipModelIds (:100)');
  assert.deepEqual([...SHIP_CAMERA_DIST], [-30, -50], 'shipCameraDist (:101), paired by index');
  assert.deepEqual([...PURCHASE_RECTS.display], [117, 12, 104, 91], 'the panel rect stands');
});

test('H4: the rotation clock turns ONE NEGATIVE degree per 0.02s of real time, across any frame pacing', () => {
  const w = new BankPurchaseWindow({});
  assert.equal(w.yawDeg, 0);
  w.tick(0.05);   // 2 whole steps, ~0.01 carried
  assert.equal(w.yawDeg, -2, 'Update rotates Vector3.up by -1 (:175)');
  w.tick(0.003);
  assert.equal(w.yawDeg, -2, 'sub-step time accumulates');
  w.tick(0.011);  // ~0.024 accumulated: one more step (values sit off
                  // the 0.02 boundary - the accumulator is FLOAT math)
  assert.equal(w.yawDeg, -3);
  w.tick(1.001);
  assert.equal(w.yawDeg, -53, 'a long stall spins 50 degrees, never a reset');
});

test('H4: the window fires the door only with a SELECTION and no result box, after the chrome, in canvas pixels', () => {
  const src = read('src/ui/bankPurchaseWindow.js');
  const drawAt = src.indexOf('draw(renderer, canvas, font)');
  const body = src.slice(drawAt);
  const chrome = body.indexOf('drawImg(renderer, _art, m, PURCHASE_PANEL_X, PURCHASE_PANEL_Y);');
  const door = body.indexOf('this.hooks.drawModelPreview?.(');
  assert.ok(chrome > 0 && door > chrome, 'the pass paints INSIDE the display rect over the chrome, so it runs after');
  assert.ok(body.includes("sel?.modelIdNum != null"),
    'SelectNone shows an empty panel (:298); F138 removed the window-local result box entirely');
  assert.ok(body.includes('x: m.ox + (PURCHASE_PANEL_X + dx) * m.s'),
    'the rect travels in CANVAS pixels - the scissor\'s frame, not native units');
  assert.ok(body.includes('}, this.yawDeg, PREVIEW_HOUSE_CAMERA);'), 'the window\'s clock and camera law ride the call');
});

test('H4: the host pass - scissor brackets beginFrame\'s clear, viewport follows it, the one mirror, both restored', () => {
  const wm = read('src/scenes/worldModes.js');
  const i = wm.indexOf('function drawBankModelPreview(');
  assert.ok(i > 0, 'worldModes implements the door');
  const fn = wm.slice(i, wm.indexOf('\n  }\n', i));
  // order: scissor on -> beginFrame (its CLEAR is what the scissor
  // exists for) -> viewport (beginFrame sets the full one) -> draw ->
  // restore both
  const scissorOn = fn.indexOf('gl.enable(gl.SCISSOR_TEST);');
  const begin = fn.indexOf('renderer.beginFrame(');
  const viewport = fn.indexOf('gl.viewport(rect.x');
  const draw = fn.indexOf('renderer.drawMesh(gpu, trs(0, 0, 0, 0, yawDeg, 0));');
  const scissorOff = fn.indexOf('gl.disable(gl.SCISSOR_TEST);');
  const viewportBack = fn.indexOf('gl.viewport(0, 0, renderer.canvas.width');
  assert.ok(scissorOn > 0 && begin > scissorOn, 'scissor BEFORE beginFrame - the clear must not wipe the window');
  assert.ok(viewport > begin, 'viewport AFTER beginFrame, which sets the full one');
  assert.ok(draw > viewport && scissorOff > draw && viewportBack > scissorOff, 'and both are restored');
  assert.ok(fn.includes('mirrorProjectionX(perspective(60 * (Math.PI / 180)'),
    'the ONE mirror rides the projection (mat4\'s law - this pass culls); Unity\'s default 60-degree lens');
  assert.ok(fn.includes('const prevClear = gl.getParameter(gl.COLOR_CLEAR_VALUE);') && fn.includes('gl.clearColor(prevClear[0]'),
    'the clear color is borrowed and returned');
  assert.ok(fn.includes('getGpuMesh(modelIdNum).then('), 'the mesh loads through the pipeline\'s own async door');
  assert.ok(wm.includes('drawModelPreview: drawBankModelPreview'), 'and the window is handed the door');
});
