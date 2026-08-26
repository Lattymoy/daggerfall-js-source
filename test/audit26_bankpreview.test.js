// AUDIT 26 - THE BANK PURCHASE WINDOW'S 3D PREVIEW, against
// DaggerfallBankPurchasePopUp.cs:163-178 / :200-280 and
// DaggerfallBankManager.cs:101 / :124.
//
// The 104x91 panel at (117,12) was drawn and left empty. DFU renders
// the SELECTED row's own model there on a camera of its own:
//
//   - the model is GetShipModelId(index) in ship mode (:247) and the
//     BuildingSummary's own ModelID in house mode (:253) - the mesh
//     RADIUS the price is taken from is a different read of the same
//     record and is NOT what the panel shows;
//   - the camera stands at (0, 12, GetShipCameraDist(type)) for a ship
//     (:246) and at a fixed (0, 3, -20) for any house (:251);
//   - the model turns -1 degree about UP every 0.02 REAL seconds
//     (:68, :167-175), and a new pick destroys goModel and builds
//     another (:236-240), so the turn starts again from zero;
//   - the render becomes displayPanel's BackgroundTexture (:278), at
//     the rect's size times the UI scale (:203-204).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BankPurchaseWindow, PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y,
  HOUSE_CAMERA_POS, SHIP_CAMERA_Y, PREVIEW_ROT_SPEED, PREVIEW_ROT_STEP,
  PREVIEW_NEAR_CLIP, PREVIEW_FAR_CLIP, PREVIEW_LIGHT_POS, PREVIEW_LIGHT_INTENSITY,
} from '../src/ui/bankPurchaseWindow.js';
import {
  SHIP_TYPES, SHIP_MODEL_IDS, SHIP_CAMERA_DIST, shipCameraDist,
} from '../src/systems/banking.js';

const rows = (id) => [{ text: `#${id}`, center: true }];

/** Every drawScreenQuad the window makes, in order. */
function fakeRenderer() {
  const quads = [];
  return { quads, drawScreenQuad: (tex, dst) => quads.push({ tex, dst }) };
}

test('A26: GetShipCameraDist is DFU\'s own table, and None reads nothing (DaggerfallBankManager.cs:101, :124)', () => {
  assert.deepEqual([...SHIP_CAMERA_DIST], [-30, -50]);
  assert.equal(shipCameraDist(SHIP_TYPES.Small), -30);
  assert.equal(shipCameraDist(SHIP_TYPES.Large), -50);
  assert.equal(shipCameraDist(SHIP_TYPES.None), 0, '`ship >= 0` guards it, so None is 0 and not dist[-1]');
});

test('A26: the preview picks the SHIP model and the SHIP camera (:244-248)', () => {
  const pw = new BankPurchaseWindow({ buy: () => {}, rows, onClose: () => {} });
  assert.equal(pw.ships, true);
  assert.equal(pw.previewSpec(), null, 'SelectNone (:298): nothing picked, nothing rendered');

  pw.selected = SHIP_TYPES.Small;
  assert.deepEqual(pw.previewSpec(), {
    modelId: SHIP_MODEL_IDS[0],
    camera: [0, SHIP_CAMERA_Y, -30],
    angle: 0,
    near: PREVIEW_NEAR_CLIP,
    far: PREVIEW_FAR_CLIP,
    light: [...PREVIEW_LIGHT_POS],
    intensity: PREVIEW_LIGHT_INTENSITY,
  });
  assert.deepEqual(pw.previewSpec().camera, [0, 12, -30], 'new Vector3(0, 12, GetShipCameraDist) verbatim');

  pw.selected = SHIP_TYPES.Large;
  assert.equal(pw.previewSpec().modelId, SHIP_MODEL_IDS[1], 'the picked INDEX is the ShipType');
  assert.deepEqual(pw.previewSpec().camera, [0, 12, -50], 'the large ship is framed from twenty further back');
});

test('A26: the preview picks the HOUSE\'s own ModelID from a fixed stand (:249-253)', () => {
  const houses = [
    { buildingKey: 7, meshRadius: 10, modelIdNum: 1234 },
    { buildingKey: 8, meshRadius: 20, modelIdNum: 5678 },
    { buildingKey: 9, meshRadius: 30, modelIdNum: null },
  ];
  const pw = new BankPurchaseWindow({ houses: () => houses, buy: () => ({}), rows, onClose: () => {} });

  pw.selected = 0;
  assert.equal(pw.previewSpec().modelId, 1234, 'BuildingSummary.ModelID, not the mesh radius the PRICE is taken from');
  assert.deepEqual(pw.previewSpec().camera, [0, 3, -20]);
  assert.deepEqual([...HOUSE_CAMERA_POS], [0, 3, -20], 'a house is framed from the same stand whatever it is');

  pw.selected = 1;
  assert.equal(pw.previewSpec().modelId, 5678, 'a new pick is a new model (:236-240)');
  assert.deepEqual(pw.previewSpec().camera, [0, 3, -20], '...and the stand does not move for it');

  pw.selected = 2;
  assert.equal(pw.previewSpec(), null, 'a building record with no 3D object has nothing to render');
});

test('A26: the model turns -1 degree per 0.02 REAL seconds, and a new pick starts it over (:68, :163-178)', () => {
  assert.equal(PREVIEW_ROT_SPEED, 0.02);
  assert.equal(PREVIEW_ROT_STEP, -1);
  const pw = new BankPurchaseWindow({ buy: () => {}, rows, onClose: () => {} });
  pw.selected = SHIP_TYPES.Small;
  assert.equal(pw.previewSpec().angle, 0, 'RenderModel runs BEFORE the Rotate (:173-175)');

  assert.equal(pw.update(0.02), false, 'the test is `>`, not `>=`');
  assert.equal(pw.previewSpec().angle, 0);
  assert.equal(pw.update(0.021), true);
  assert.equal(pw.previewSpec().angle, -1, 'Rotate(Vector3.up, -1) - NEGATIVE one degree');
  assert.equal(pw.update(0.03), false, 'inside the same tick nothing moves');
  assert.equal(pw.update(0.05), true);
  assert.equal(pw.previewSpec().angle, -2);

  // lastRotTime advances above the `if (goModel)` (:169), so an empty
  // panel still consumes its ticks.
  const empty = new BankPurchaseWindow({ buy: () => {}, rows, onClose: () => {} });
  assert.equal(empty.update(1), false, 'nothing picked, nothing turns');
  assert.equal(empty.lastRotTime, 1, '...but the clock moved anyway');

  // A new pick destroys goModel and builds another, unrotated.
  pw.selected = SHIP_TYPES.Large;
  assert.equal(pw.previewSpec().angle, 0, 'the new model starts its turn from zero');
});

test('A26: the display rect is no longer empty - the render lands on displayPanelRect (:23, :203-204, :278)', () => {
  const asked = [];
  const pw = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 7, meshRadius: 10, modelIdNum: 1234 }],
    buy: () => ({}),
    rows,
    previewTexture: (spec) => { asked.push(spec); return 'MODEL-TEX'; },
    onClose: () => {},
  });
  const m = { s: 3, ox: 10, oy: 4 };
  const r = fakeRenderer();

  // Nothing picked: DFU's Display3dModelSelection has never run, so
  // the panel is the base art and nothing else.
  assert.equal(pw.drawDisplayPanel(r, m), false);
  assert.deepEqual(r.quads, []);
  assert.deepEqual(asked, [], 'a window with no selection asks for no render');

  pw.selected = 0;
  assert.equal(pw.drawDisplayPanel(r, m), true, 'THE RECT IS DRAWN');
  assert.equal(r.quads.length, 1);
  const [dx, dy, dw, dh] = PURCHASE_RECTS.display;
  assert.deepEqual([dx, dy, dw, dh], [117, 12, 104, 91], 'displayPanelRect, verbatim');
  assert.equal(r.quads[0].tex, 'MODEL-TEX');
  assert.deepEqual(r.quads[0].dst, {
    x: m.ox + (PURCHASE_PANEL_X + 117) * m.s,
    y: m.oy + (PURCHASE_PANEL_Y + 12) * m.s,
    w: 104 * m.s,
    h: 91 * m.s,
  }, 'the BackgroundTexture covers the panel rect exactly');
  assert.equal(asked.length, 1);
  assert.equal(asked[0].modelId, 1234);
  assert.deepEqual(asked[0].camera, [0, 3, -20]);
  assert.deepEqual([asked[0].width, asked[0].height], [104 * m.s, 91 * m.s],
    'displayResolution is the rect times the UI scale (:203)');

  // The turning model reaches the render: the angle the host is asked
  // for is the one Update left behind.
  pw.update(1);
  pw.drawDisplayPanel(r, m);
  assert.equal(asked[1].angle, -1);
});

test('A26: with no host behind the hook the rect is left as the base art drew it', () => {
  // The port's standing gap - the renderer has no offscreen path for a
  // world mesh - must cost the picture and nothing else.
  const pw = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 7, meshRadius: 10, modelIdNum: 1234 }],
    buy: () => ({}), rows, onClose: () => {},
  });
  pw.selected = 0;
  const r = fakeRenderer();
  assert.equal(pw.drawDisplayPanel(r, { s: 1, ox: 0, oy: 0 }), false);
  assert.deepEqual(r.quads, [], 'nothing invented into the rect');
  assert.equal(pw.update(1), true, 'and the model still turns behind it');
});
