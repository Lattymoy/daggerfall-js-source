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
  previewShipCamera, SHIP_LIST, priceRow,
} from '../src/ui/bankPurchaseWindow.js';
import {
  SHIP_MODEL_IDS, SHIP_CAMERA_DIST, SHIP_TYPES, shipPrice, shipModelId, shipCameraDist,
  TRANSACTION_RESULT,
} from '../src/systems/banking.js';

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
  assert.ok(body.includes('if (modelIdNum != null) {'),
    'SelectNone shows an empty panel (:298); F138 removed the window-local result box entirely');
  assert.ok(body.includes('x: m.ox + (PURCHASE_PANEL_X + dx) * m.s'),
    'the rect travels in CANVAS pixels - the scissor\'s frame, not native units');
  assert.ok(body.includes('}, this.yawDeg, this.isShips ? previewShipCamera(sel) : PREVIEW_HOUSE_CAMERA);'),
    'the window\'s clock and BOTH camera laws ride the call (D6: :243-244 is the ships arm)');
});

test('D6: a NULL house list IS the shipyard (:181-185) - two ShipTypes at flat prices', () => {
  // DFU has ONE popup and its discriminator is the list it was
  // constructed with: BuyShipButton pushes it with `null` (:463) and
  // PopulatePriceList reads that as `for (int i = 0; i < 2; i++)`.
  let bought = 'untouched', shown = null;
  const w = new BankPurchaseWindow({
    buy: (ship) => { bought = ship; return { result: TRANSACTION_RESULT.PURCHASED_SHIP, amount: shipPrice(ship) }; },
    showResult: (result, amount) => { shown = { result, amount }; },
    onClose: () => {},
  });
  assert.equal(w.isShips, true, 'no houses hook is DFU\'s null list');
  assert.deepEqual([...SHIP_LIST], [SHIP_TYPES.Small, SHIP_TYPES.Large], 'the list IS ShipType order');
  assert.deepEqual(w.rows().map((r) => r.text), [priceRow(100000), priceRow(200000)],
    'the ship price is a FLAT table read, where a house is measured off its own mesh');
  assert.equal(w.canScrollDown(), false, 'two rows never scroll a ten-row list');
  assert.equal(w.canScrollUp(), false);
  // SelectNone, then the FIRST row - which is ShipType.Small, and
  // ShipType.Small is 0
  assert.equal(w.selected, -1);
  w.input('Enter');
  assert.equal(bought, 'untouched', 'BUY with no selection is DFU\'s `if (SelectedIndex < 0) return;`');
  w.input('ArrowDown');
  assert.equal(w.selected, SHIP_TYPES.Small);
  w.input('Enter');
  assert.equal(bought, SHIP_TYPES.Small, 'a truthiness guard makes the small ship the one row that cannot be bought');
  assert.equal(w.done, true, 'CloseWindow runs before the outcome is known (F138)');
  assert.equal(shown.result, TRANSACTION_RESULT.PURCHASED_SHIP);
  assert.equal(shown.amount, 100000);
  // ...and a houses hook still means houses
  const h = new BankPurchaseWindow({ houses: () => [{ buildingKey: 1, meshRadius: 10 }] });
  assert.equal(h.isShips, false);
  assert.equal(h.rows().length, 1);
});

test('D6: the shipyard frames each hull from (0, 12, GetShipCameraDist) with its own model (:243-244)', () => {
  assert.deepEqual(previewShipCamera(SHIP_TYPES.Small), { y: 12, z: -30 });
  assert.deepEqual(previewShipCamera(SHIP_TYPES.Large), { y: 12, z: -50 });
  // GetShipCameraDist carries the same `ship >= 0` guard as every
  // other table read (:118-124), so None indexes nothing
  assert.equal(shipCameraDist(SHIP_TYPES.None), 0);
  assert.deepEqual(previewShipCamera(SHIP_TYPES.None), { y: 12, z: 0 });
  assert.equal(shipModelId(SHIP_TYPES.Small), 910);
  assert.equal(shipModelId(SHIP_TYPES.Large), 909);
  // the draw arm picks the model off the ShipType, not off a record
  // that a ShipType does not have
  const src = read('src/ui/bankPurchaseWindow.js');
  assert.ok(src.includes('this.isShips ? shipModelId(sel) : sel.modelIdNum ?? null'),
    'a ShipType has no modelIdNum, so the shipyard would preview nothing');
});

test('H4: the host pass - scissor brackets beginFrame\'s clear, viewport follows it, the one mirror, both restored', () => {
  const wm = read('src/scenes/worldModes.js');
  const i = wm.indexOf('function drawBankModelPreview(');
  assert.ok(i > 0, 'worldModes implements the door');
  const fn = wm.slice(i, wm.indexOf('\n  }\n', i));
  // PIN MOVED, ROAD-C c2/S2. This pass was the tree's THIRD hand-rolled
  // copy of the panel bracket. It got the two hard parts right -
  // scissor BEFORE beginFrame (SCISSOR_TEST gates gl.clear) and
  // viewport AFTER it (beginFrame sets the full one) - and still
  // leaked fog and lighting, and paid a synchronous
  // gl.getParameter(COLOR_CLEAR_VALUE) every frame. The whole
  // sequence now lives ONCE, in renderer.beginPanelFrame, where its
  // ordering is pinned as observed GL calls rather than as source
  // order in a consumer (test/roadc_panelframe.test.js), and its
  // return runs in a finally that a throwing body cannot skip.
  assert.ok(fn.includes('renderer.panelFrame({'), 'the pass runs inside the renderer\'s bracket');
  assert.ok(!fn.includes('gl.enable(gl.SCISSOR_TEST)') && !fn.includes('gl.viewport('),
    'and holds no scissor/viewport sequence of its own');
  assert.ok(!fn.includes('gl.getParameter('), 'no per-frame synchronous driver query survives');
  assert.ok(fn.includes('renderer.drawMesh(gpu, trs(0, 0, 0, 0, yawDeg, 0))'), 'the model still draws, spun by the window\'s yaw');
  assert.ok(fn.includes('clear: [0, 0, 0, 1]'), 'this camera\'s SolidColor clear is opaque black, and says so');
  assert.ok(fn.includes('mirrorProjectionX(perspective(60 * (Math.PI / 180)'),
    'the ONE mirror rides the projection (mat4\'s law - this pass culls); Unity\'s default 60-degree lens');
  assert.ok(fn.includes('getGpuMesh(modelIdNum).then('), 'the mesh loads through the pipeline\'s own async door');
  assert.ok(wm.includes('drawModelPreview: drawBankModelPreview'), 'and the window is handed the door');
});
