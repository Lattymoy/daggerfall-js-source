// H4 - THE BANK PURCHASE WINDOW'S LIVE 3D PREVIEW, pinned against
// DaggerfallBankPurchasePopUp's Update (:163-178) and
// Display3dModelSelection (:239-260). The WINDOW owns the rotation
// clock and the camera law; the HOST owns the scissored second camera
// pass - the split is the pin's subject, because either half alone
// draws nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { THUMB_MIN_H, THUMB_TOP_ROW, THUMB_BODY_ROW, THUMB_BOTTOM_ROW } from '../src/ui/verticalScrollBar.js';   // G5
import {
  BankPurchaseWindow, PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y,
  PREVIEW_ROT_SPEED, PREVIEW_HOUSE_CAMERA, PREVIEW_NEAR, PREVIEW_FAR,
  previewShipCamera, SHIP_LIST, priceRow,
  PURCHASE_ARROWS_FULL, PURCHASE_UP_ARROW_RECT, PURCHASE_DOWN_ARROW_RECT,
  PURCHASE_GREEN_ARROWS, PURCHASE_RED_ARROWS,
  purchaseArrowArtLoaded, _setPurchaseArtForTests, LIST_ROWS,
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

// ── AUDIT 58: THE PRICE LIST'S TWO ARROWS ────────────────────────
//
// DaggerfallBankPurchasePopUp cuts a green and a red 9x16 arrow out of
// BANK01I1.IMG / BANK01I2.IMG (:51-52, LoadTextures :355-366) against
// arrowsFullSize 9x80, puts them at (105,23) and (105,87)
// (SetupScrollButtons :316-336), and swaps each on every redraw
// (UpdateListScrollerButtons :339-352). The port loaded neither strip
// and drew nothing there, so canScrollUp/canScrollDown were computed,
// pinned by tests, and read by NO pixel - the player was never told
// the list scrolls.
test('A54: the price list draws its GREEN/RED arrows, and the states are DFU\'s', () => {
  // the sub-rects are the popup's own, and NOT the item scroller's
  // 9x152 / y=136 pair
  assert.deepEqual(PURCHASE_ARROWS_FULL, { w: 9, h: 80 }, 'arrowsFullSize (:28)');
  assert.deepEqual([...PURCHASE_UP_ARROW_RECT], [0, 0, 9, 16], 'upArrowRect (:26)');
  assert.deepEqual([...PURCHASE_DOWN_ARROW_RECT], [0, 64, 9, 16], 'downArrowRect (:27)');
  assert.equal(PURCHASE_GREEN_ARROWS, 'BANK01I1.IMG');
  assert.equal(PURCHASE_RED_ARROWS, 'BANK01I2.IMG');
  // and the buttons sit where SetupScrollButtons puts them
  assert.deepEqual([...PURCHASE_RECTS.upArrow], [105, 23, 9, 16]);
  assert.deepEqual([...PURCHASE_RECTS.downArrow], [105, 87, 9, 16]);

  const market = Array.from({ length: 14 }, (_, i) => ({ buildingKey: i, meshRadius: 10, modelIdNum: 1000 + i }));
  const w = new BankPurchaseWindow({ houses: () => market, onClose: () => {} });
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv) => quads.push({ tex, ...rect, uv }) };
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 }, tex: 'font' };
  const art = { tex: 'BANK01I0', w: 225, h: 129 };
  const arrows = { green: { tex: 'GREEN', w: 9, h: 80 }, red: { tex: 'RED', w: 9, h: 80 } };
  _setPurchaseArtForTests(art, arrows);
  try {
    const canvas = { width: 320, height: 200 };
    const at = (tex) => quads.filter((q) => q.tex === tex);
    // top of a 14-row list in a 10-row window: nothing above (RED up),
    // four rows below (GREEN down)
    w.draw(renderer, canvas, font);
    assert.equal(at('RED').length, 1, 'the up arrow is red at the top');
    assert.equal(at('GREEN').length, 1, 'and the down arrow green');
    assert.equal(at('RED')[0].y, at('GREEN')[0].y - 64 * 1, 'the two sit 64 native px apart (23 -> 87)');
    // the down crop reads the strip's SECOND arrow (y=64 of 80)
    assert.ok(Math.abs(at('GREEN')[0].uv.v0 - 64 / 80) < 1e-9, 'downArrowRect y=64 against a 9x80 strip');
    assert.equal(at('RED')[0].uv.v0, 0, 'upArrowRect y=0');

    // scrolled to the end: green above, red below
    quads.length = 0;
    for (let i = 0; i < 20; i++) w.wheel(1);
    assert.equal(w.canScrollUp(), true);
    assert.equal(w.canScrollDown(), false);
    w.draw(renderer, canvas, font);
    assert.ok(Math.abs(at('GREEN')[0].uv.v0) < 1e-9, 'the GREEN one is now the UP arrow');
    assert.ok(Math.abs(at('RED')[0].uv.v0 - 64 / 80) < 1e-9, 'and the RED one the DOWN arrow');

    // a list that FITS forces both red (`count <= listDisplayUnits`)
    quads.length = 0;
    const two = new BankPurchaseWindow({ onClose: () => {} });   // the shipyard: two rows
    two.draw(renderer, canvas, font);
    assert.equal(at('RED').length, 2, 'both arrows red when the list does not scroll');
    assert.equal(at('GREEN').length, 0);

    // a missing strip is not fatal - the base image's arrows stand
    quads.length = 0;
    _setPurchaseArtForTests(art, null);
    assert.equal(purchaseArrowArtLoaded(), false);
    w.draw(renderer, canvas, font);
    assert.equal(at('GREEN').length + at('RED').length, 0, 'no arrow pass, and no throw');
  } finally {
    _setPurchaseArtForTests(null, null);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROAD-G G5 - THE PRICE LIST'S SCROLL BAR (SetupScrollBar :303-314).
//
// AUDIT 58's windows lane drew the two arrows above and below it and
// left the bar itself, so the rail between them was dead pixels: the
// widget DFU gives this list to be GRABBED could only be paged, one
// row at a time, from the buttons. The component is ROAD-A7's shared
// ui/verticalScrollBar.js; what is pinned here is this window's rect,
// its two-way index sync, and the fact that the rail is now hit.
//
// Twelve mutants driven, twelve dead: (1) the rect -> the list picker's
// [181,23,5,82]; (2) `displayUnits: LIST_ROWS` -> 1; (3) syncScrollBar
// stops refreshing TotalUnits from the live list; (4) the press arm
// deleted from click(); (5) `this.scroll = this.scrollBar.scrollIndex`
// dropped after the press; (6) syncScrollBar's `if (bar.draggingThumb)`
// inverted; (7) drawScrollThumb removed from draw(); (8) `release()`
// stops dropping the latch; (9) `hover` stops running Update;
// (10) `update(..., vy)` -> `vx`, the horizontal drag; (11)
// `!!(e?.buttons & 1)` -> `true`, the ignored mouse button; (12) the
// thumb drawn at `{ y: 0, h }`, pinned to the top of the rail.
// ═══════════════════════════════════════════════════════════════════
test('G5: SetupScrollBar - the rect is [106,39,7,48] with DisplayUnits = listDisplayUnits', () => {
  assert.deepEqual([...PURCHASE_RECTS.scrollBar], [106, 39, 7, 48], 'Position (106,39), Size (7,48) (:306-311)');
  const w = new BankPurchaseWindow({ houses: () => [], onClose: () => {} });
  assert.deepEqual([...w.scrollBar.rect],
    [PURCHASE_PANEL_X + 106, PURCHASE_PANEL_Y + 39, 7, 48],
    'the rect is folded onto the panel origin, so hit test and draw share one');
  assert.equal(w.scrollBar.displayUnits, LIST_ROWS, 'DisplayUnits = listDisplayUnits (:310)');
  // ...and it sits BETWEEN the two arrows, touching neither
  assert.equal(PURCHASE_RECTS.upArrow[1] + PURCHASE_RECTS.upArrow[3], PURCHASE_RECTS.scrollBar[1]);
  assert.equal(PURCHASE_RECTS.scrollBar[1] + PURCHASE_RECTS.scrollBar[3], PURCHASE_RECTS.downArrow[1]);
});

test('G5: the rail PAGES by DisplayUnits and the thumb DRAGS - the two arms of the widget', () => {
  const market = Array.from({ length: 30 }, (_, i) => ({ buildingKey: i, meshRadius: 10 }));
  const w = new BankPurchaseWindow({ houses: () => market, onClose: () => {} });
  const [bx, by, bw, bh] = w.scrollBar.rect;
  w.syncScrollBar();
  assert.equal(w.scrollBar.totalUnits, 30, 'TotalUnits comes off the live list (:299)');
  // BELOW the thumb: MouseClick pages DOWN by DisplayUnits (:146-149)
  assert.equal(w.click(bx + 3, by + bh - 1), true, 'the bar owns the press');
  assert.equal(w.scroll, LIST_ROWS, 'one page down');
  assert.equal(w.rows()[0].index, LIST_ROWS, 'and the list moved with it');
  // ABOVE it: one page back
  assert.equal(w.click(bx + 3, by), true);
  assert.equal(w.scroll, 0);
  // ON the thumb: nothing moves, the DRAG latches (Update :108-113)
  const span = w.scrollBar.thumbSpan;
  assert.ok(span && span.h >= THUMB_MIN_H, 'a 30-row list has a thumb, floored at 10px');
  w.click(bx + 3, by + span.y + 1);
  assert.equal(w.scroll, 0, 'a press ON the thumb pages nothing - there is no third arm');
  assert.equal(w.scrollBar.draggingThumb, true, 'it latches instead');
  // ...and the drag then drives the LIST, through the host's hover seam.
  // The value is the LAW, not merely "it moved": VerticalScrollBar
  // .Update (:115-121) is `scale = Size.y / totalUnits` and
  // `unitsMoved = dragDistance.y / scale`.
  w.hover(bx + 3, by + span.y + 1 + bh / 3, { buttons: 1 });
  assert.equal(w.scroll, 10,
    'Update (:115-121): scale = 48/30 = 1.6, dragDistance.y = 16, unitsMoved = 10');
  assert.equal(w.rows()[0].index, 10, 'and the list slice starts there');
  // MUTANT: `this.scrollBar.update(!!(e?.buttons & 1), vy)` -> `..., vx)`.
  // RED here: Update reads the VERTICAL delta only (`dragDistance.y`,
  // :117-119), so a cursor dragged far off the rail in X moves nothing.
  w.hover(bx + bw + 40, by + span.y + 1 + bh / 3, { buttons: 1 });
  assert.equal(w.scroll, 10, 'the cursor off the rail in x drags the list nowhere');
  // MUTANT: `!!(e?.buttons & 1)` -> `true`. RED here: GetMouseButton(0)
  // came up, so Update takes its ELSE arm (:123-129) and drops the latch
  // without moving anything - under the mutant this frame drags on to 15.
  w.hover(bx + 3, by + span.y + 1 + bh / 3 + 8, { buttons: 0 });
  assert.equal(w.scrollBar.draggingThumb, false, 'the released button drops the latch');
  assert.equal(w.scroll, 10, 'and that frame moved nothing');
  // the button comes up: the latch drops and a later held move does
  // NOT resume from the stale anchor
  const held = w.scroll;
  w.release();
  assert.equal(w.scrollBar.draggingThumb, false);
  w.hover(bx + 3, by + bh - 1, { buttons: 1 });
  assert.equal(w.scroll, held, 'a released drag is over');
  // a press one pixel outside the bar is not the bar's
  assert.equal(w.scrollBar.contains(bx + bw, by + 2), false);
});

test('G5: the thumb is DRAWN, in DFU\'s own three strips, and vanishes when the list fits', () => {
  const market = Array.from({ length: 30 }, (_, i) => ({ buildingKey: i, meshRadius: 10 }));
  const w = new BankPurchaseWindow({ houses: () => market, onClose: () => {} });
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, color }) };
  const font = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 }, tex: 'font' };
  _setPurchaseArtForTests({ tex: 'BANK01I0', w: 225, h: 129 }, null);
  try {
    // BOTTOM the list first: at index 0 the thumb sits at the rail's own
    // top, and a thumb frozen there would be indistinguishable from one
    // that walks. Thirty rows, ten displayed - ArrowDown thirty times
    // leaves scrollIndex at the max, 20.
    for (let i = 0; i < 30; i++) w.input('ArrowDown');
    w.syncScrollBar();
    const span = w.scrollBar.thumbSpan;
    assert.ok(span.y > 0, 'a bottomed 30-row list moves the thumb OFF the rail top');
    assert.deepEqual({ ...span }, { y: 32, h: 16 },
      'thumbY = scrollIndex * (height - thumbHeight) / (totalUnits - displayUnits) = 20 * 32 / 20 (:208-210)');
    w.draw(renderer, { width: 320, height: 200 }, font);
    // the thumb is untextured colour bands - five columns per strip,
    // each one fifth of the 7px rail wide (the screen dim behind the
    // window is untextured too, and is 320 wide, so width picks them out)
    const [bx, by, bw] = w.scrollBar.rect;
    const bands = quads.filter((q) => q.tex === null && q.color && q.w <= bw);
    assert.ok(bands.length >= 10, 'the top and bottom strips at least, five columns each');
    const greys = new Set(bands.map((b) => Math.round(b.color[0] * 255)));
    assert.ok(greys.has(THUMB_TOP_ROW[0]), 'the dark left edge is DFU\'s 77');
    assert.ok(greys.has(THUMB_BODY_ROW[1]) || greys.has(THUMB_TOP_ROW[1]), 'and the body/highlight greys');
    assert.deepEqual([...THUMB_BOTTOM_ROW], [77, 77, 77, 77, 77]);
    for (const b of bands) {
      assert.ok(b.x >= bx - 1e-6 && b.x + b.w <= bx + bw + 1e-6, 'every band stays inside the 7px rail');
    }
    // MUTANT: `drawScrollThumb(..., this.scrollBar.thumbSpan)` ->
    // `..., { y: 0, h: span.h }`. RED here - the three strips would land
    // at 75/76/90, the rail's top, instead of walking down it with the
    // scroll index (VerticalScrollBar.cs:210 thumbY, :216-218 the rects).
    const ys = [...new Set(bands.map((b) => b.y))].sort((a, b) => a - b);
    assert.deepEqual(ys, [107, 108, 122]);
    assert.equal(ys[0], Math.trunc(by + span.y), 'topRect.y is (int)(totalRect.y + thumbY) (:216)');
    assert.equal(ys[1], ys[0] + 1, 'the body starts at topRect.yMax (:217)');
    assert.equal(ys[2], ys[1] + Math.trunc(span.h - 2), 'and the bottom on bodyRect.yMax (:218)');
    // a list that FITS draws NOTHING (Draw :136 returns before DrawScrollBar)
    quads.length = 0;
    const two = new BankPurchaseWindow({ onClose: () => {} });   // the shipyard: two rows
    two.draw(renderer, { width: 320, height: 200 }, font);
    assert.equal(two.scrollBar.thumbSpan, null);
    assert.equal(quads.filter((q) => q.tex === null && q.color && q.w <= bw).length, 0,
      'a two-hull shipyard shows a bare rail');
  } finally {
    _setPurchaseArtForTests(null, null);
  }
});

test('G5: the index flows FROM the bar while dragging and TO it otherwise (:400-410)', () => {
  const market = Array.from({ length: 30 }, (_, i) => ({ buildingKey: i, meshRadius: 10 }));
  const w = new BankPurchaseWindow({ houses: () => market, onClose: () => {} });
  // PriceListBox_OnScroll: the LIST moves the bar
  w.wheel(1); w.wheel(1); w.wheel(1);
  w.syncScrollBar();
  assert.equal(w.scroll, 3);
  assert.equal(w.scrollBar.scrollIndex, 3, 'the arrows and the wheel push the index INTO the bar');
  // PriceScrollBar_OnScroll: the BAR moves the list
  w.scrollBar.draggingThumb = true;
  w.scrollBar.scrollIndex = 11;
  w.syncScrollBar();
  assert.equal(w.scroll, 11, 'and a dragged thumb pushes it back OUT');
  // the keyboard still clamps the same list
  w.scrollBar.draggingThumb = false;
  for (let i = 0; i < 60; i++) w.input('ArrowDown');
  w.syncScrollBar();
  assert.equal(w.scroll, 20, '30 rows in a 10-row window');
  assert.equal(w.scrollBar.scrollIndex, 20);
});
