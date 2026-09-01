// ROAD TO 1:1, group a7 (ui-pickers): DaggerfallMessageBox's two
// unported halves - the SCROLLING variant (MaxTextHeight + the bar)
// and the IMAGE PANEL the paintings ride - plus GetRandomTokens'
// dfRand draw and the painting box that finally shows a picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  layoutMessageBox, messageBoxWheel, MB_BUTTONS,
  MARGIN, BUTTON_H, BUTTON_TEXT_DISTANCE, SLICE, MIN_BOX_SIDE,
  SCROLL_PANEL_PAD, SCROLL_BAR_W, SCROLL_WHEEL_STEP, IMAGE_PANEL_Y,
} from '../src/ui/messageBox.js';
import { TextRsc, dfRandPick, RSC } from '../src/formats/textRsc.js';
import { srand, rand } from '../src/formats/dfRandom.js';
import { itemInfoRows, itemInfoPanelRows, setPaintFile, INFO_TEXT } from '../src/systems/itemInfo.js';

// The producer's own font shape: measureText walks glyphWidth and adds
// one pixel between glyphs, so an n-char row is 5n - 1 wide at 4px.
const font = (w = 4, h = 9) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });

// ── EnableVerticalScrolling (:461-470, :571-590) ──────────────────

test('ROAD-A7: MaxTextHeight CAPS the label, and ActualTextHeight over-counts by a row', () => {
  const f = font();
  const rows = Array.from({ length: 20 }, (_, i) => `row ${i}`);
  const plain = layoutMessageBox(f, rows);
  assert.equal(plain.textH, 20 * 9, 'uncapped, the label is every row');
  assert.equal(plain.scroll, null, 'and no MaxTextHeight means no bar');
  const capped = layoutMessageBox(f, rows, [], { maxTextHeight: 60 });
  assert.equal(capped.textH, 60, 'RefreshLayout :393-396 clamps totalHeight');
  // :389 - actualTextHeight = totalHeight + lastLabel.TextHeight, and
  // totalHeight ALREADY includes that last row. The over-count is
  // DFU's, and the scroll range is built on it.
  assert.equal(capped.actualTextHeight, 21 * 9);
  // the box is sized off the CAPPED height, which is the whole point:
  // a long record no longer grows the parchment off the screen
  assert.ok(capped.h < plain.h);
  assert.equal(capped.h, Math.ceil((60 + MARGIN * 2) / SLICE) * SLICE);
});

test('ROAD-A7: the scroll bar is 8 wide, Right/Top, over MaxTextHeight + 9', () => {
  assert.equal(SCROLL_PANEL_PAD, 9);      // GetScrollingPanelHeight :603-606
  assert.equal(SCROLL_BAR_W, 8);          // :577
  const f = font();
  const rows = Array.from({ length: 20 }, (_, i) => `row ${i}`);
  const box = layoutMessageBox(f, rows, [], { maxTextHeight: 60 });
  const s = box.scroll;
  assert.ok(s, 'ActualTextHeight (189) passes MaxTextHeight (60)');
  assert.equal(s.displayUnits, 60 + SCROLL_PANEL_PAD);
  assert.equal(s.totalUnits, box.actualTextHeight + 1, ':578 - ActualTextHeight + 1');
  assert.deepEqual(s.bar, [box.x + box.w - MARGIN - SCROLL_BAR_W, box.y + MARGIN, SCROLL_BAR_W, 69]);
  assert.deepEqual(s.panel, [box.x + Math.round((box.w - box.textW) / 2), box.y + MARGIN, box.textW, 69]);
  // ...and a record that FITS turns the bar off (:583-586)
  const short = layoutMessageBox(f, ['one', 'two'], [], { maxTextHeight: 60 });
  assert.equal(short.scroll, null);
  // exactly at the boundary the test is `>`, not `>=`
  const edge = layoutMessageBox(f, ['a', 'b'], [], { maxTextHeight: 27 });
  assert.equal(edge.actualTextHeight, 27);
  assert.equal(edge.scroll, null, 'ActualTextHeight == MaxTextHeight does NOT scroll');
});

test('ROAD-A7: the wheel steps SIX pixels through SetScrollIndex\'s clamp', () => {
  assert.equal(SCROLL_WHEEL_STEP, 6);
  const f = font();
  const rows = Array.from({ length: 40 }, (_, i) => `row ${i}`);
  let box = layoutMessageBox(f, rows, [], { maxTextHeight: 60 });
  assert.equal(box.scroll.index, 0);
  assert.equal(messageBoxWheel(box, 1), 6, 'ScrollIndex += 6 (:680)');
  assert.equal(messageBoxWheel(box, -1), 0, 'and never below zero');
  box = layoutMessageBox(f, rows, [], { maxTextHeight: 60, scrollIndex: 9999 });
  assert.equal(box.scroll.index, box.scroll.totalUnits - box.scroll.displayUnits,
    'SetScrollIndex clamps at total - display');
  // a box with no bar has nowhere to go
  assert.equal(messageBoxWheel(layoutMessageBox(f, ['x']), 1), 0);
});

// ── the IMAGE PANEL (:527-534, :555) ──────────────────────────────

test('ROAD-A7: an image makes the box taller and moves the label to the BOTTOM', () => {
  const f = font();
  const rows = ['a painting', 'by somebody'];
  const plain = layoutMessageBox(f, rows);
  const withImg = layoutMessageBox(f, rows, [], { image: { width: 80, height: 44 } });
  // :537's gate opens on the image height ALONE, with no buttons at
  // all, so the label block grows by buttonTextDistance - the +4 that
  // looks like a typo and is the gate firing.
  assert.equal(plain.textH, 18);
  assert.equal(withImg.h - plain.h,
    Math.ceil((18 + BUTTON_TEXT_DISTANCE + 44 + MARGIN * 2) / SLICE) * SLICE - MIN_BOX_SIDE);
  assert.equal(withImg.h, Math.ceil((18 + BUTTON_TEXT_DISTANCE + 44 + MARGIN * 2) / SLICE) * SLICE);
  // VerticalAlignment.Bottom: yMax - BottomMargin - labelH
  const labelH = 18 + BUTTON_TEXT_DISTANCE;
  assert.equal(withImg.textY, withImg.y + withImg.h - MARGIN - labelH);
  // the panel is Center horizontally, Position.y 5 under the top margin
  assert.deepEqual(withImg.image,
    [withImg.x + Math.round((withImg.w - 80) / 2), withImg.y + MARGIN + IMAGE_PANEL_Y, 80, 44]);
  assert.equal(IMAGE_PANEL_Y, 5);
  assert.equal(plain.image, null);
});

test('ROAD-A7: buttons still size the box exactly as before the image arm', () => {
  // The image arm must not have moved the ordinary case: with buttons
  // and no image, labelH is still textH + BUTTON_H + 4.
  const f = font();
  const a = layoutMessageBox(f, ['one', 'two', 'three'], [MB_BUTTONS.Yes, MB_BUTTONS.No]);
  const labelH = 3 * 9 + BUTTON_H + BUTTON_TEXT_DISTANCE;
  assert.equal(a.h, Math.ceil((labelH + MARGIN * 2) / SLICE) * SLICE);
  assert.equal(a.textY, a.y + Math.round((a.h - labelH) / 2), 'still Center/Middle without an image');
});

// ── GetRandomTokens' dfRand draw (TextProvider.cs:203-233) ────────

// A minimal TEXT.RSC with one record of four variants, so the pick is
// observable. Header: length u16, then {id u16, offset u32} per record
// plus one terminator pair, then the record bytes.
function rscWithVariants(id, variants) {
  const body = [];
  variants.forEach((v, i) => {
    for (const ch of v) body.push(ch.charCodeAt(0));
    if (i < variants.length - 1) body.push(RSC.SubrecordSeparator);
  });
  body.push(RSC.EndOfRecord);
  const headerLen = 12;            // one record + the terminator pair
  const bytes = new Uint8Array(headerLen + body.length);
  const dv = new DataView(bytes.buffer);
  dv.setUint16(0, headerLen, true);
  dv.setUint16(2, id, true);
  dv.setUint32(4, headerLen, true);
  dv.setUint16(8, 0, true);
  dv.setUint32(10, headerLen + body.length, true);
  bytes.set(body, headerLen);
  return new TextRsc().load(bytes);
}

test('ROAD-A7: dfRandPick is DFRandom.rand() % count, and it CONSUMES a draw', () => {
  const rsc = rscWithVariants(250, ['AAA', 'BBB', 'CCC', 'DDD']);
  assert.equal(rsc.variantCount(250), 4);
  // the same seed picks the same variant, every time - which a uniform
  // Random.Range cannot promise and classic depends on
  srand(1234);
  const first = rsc.variantLinesById(250, dfRandPick)[0].text;
  srand(1234);
  assert.equal(rsc.variantLinesById(250, dfRandPick)[0].text, first);
  // ...and it is exactly rand() % 4 off the same stream
  srand(1234);
  const expected = ['AAA', 'BBB', 'CCC', 'DDD'][rand() % 4];
  assert.equal(first, expected);
  // the DRAW ITSELF is spent: reading a variant leaves the stream one
  // value on, which is why every painting macro's next read differs
  // from a uniform reader's.
  srand(99);
  rsc.variantLinesById(250, dfRandPick);
  const afterRead = rand();
  srand(99);
  rand();                       // the pick
  assert.equal(rand(), afterRead, 'the pick consumed exactly one value');
  // the uniform default is untouched
  assert.equal(rsc.variantLinesById(250, () => 0)[0].text, 'AAA');
  assert.equal(rsc.variantLinesById(250, () => 0.999)[0].text, 'DDD', 'Range\'s exclusive top');
});

test('ROAD-A7: the token reader takes the same dfRand draw', () => {
  const rsc = rscWithVariants(6100, ['ONE', 'TWO', 'SIX']);
  srand(7);
  const want = ['ONE', 'TWO', 'SIX'][rand() % 3];
  srand(7);
  assert.equal(rsc.variantTokensById(6100, dfRandPick)[0].text, want);
});

// ── the painting's info, through the dfRand reader ────────────────

test('ROAD-A7: the painting reads ask the host for the dfRand pick', () => {
  // itemInfoRows hands `rows` a SECOND argument for the painting arm -
  // InitPaintingInfo :65 and the four macro readers are all
  // GetRandomTokens(id, dfRand: true), and nothing else in GetItemInfo
  // is. A host that ignores it keeps its uniform pick; one that
  // forwards it gets classic's stream.
  const asked = [];
  const rows = (id, pick) => { asked.push([id, pick?.dfRand === true]); return [{ text: `r${id} %sub %adj`, center: true }]; };
  const record = new Uint8Array(40).fill(0xff);
  record[0] = 1; record[1] = 0xff;
  record[10] = 2; record[11] = 0xff;
  record[20] = 3; record[21] = 0xff;
  record[30] = 4; record[31] = 0xff;
  setPaintFile({ read: () => record });
  try {
    const item = { group: 'Paintings', message: 4242, templateIndex: 284 };
    const out = itemInfoRows(item, rows);
    assert.ok(asked.length >= 5, 'the record plus the four part reads');
    assert.ok(asked.every(([, df]) => df), 'every painting read is the dfRand one');
    assert.equal(asked[0][0], INFO_TEXT.painting, 'and the first is record 250');
    assert.ok(out.length);
    // the identity is FROZEN on the item (DaggerfallUnityItemMCP :40)
    assert.ok(item.paintingInfo);
    assert.match(item.paintingInfo.filename, /^[A-W]PAINT\.CIF$/);
    assert.ok(item.paintingInfo.fileIdx >= 0 && item.paintingInfo.fileIdx <= 7);
  } finally { setPaintFile(null); }
});

test('ROAD-A7: the little info PANEL keeps only a painting\'s title', () => {
  // UpdateItemInfoPanel :1135-1137 - "Only keep the title part for
  // paintings", the LAST token, trimmed. Every other item keeps the
  // whole record, which is the arm this must not disturb.
  const rows = (id) => (id === INFO_TEXT.painting
    ? [{ text: 'This is a painting of ' }, { text: '  The Title  ' }]
    : [{ text: 'line one' }, { text: 'line two' }]);
  const record = new Uint8Array(40).fill(0xff);
  setPaintFile({ read: () => record });
  try {
    const painting = { group: 'Paintings', message: 7, templateIndex: 284 };
    assert.deepEqual(itemInfoPanelRows(painting, rows).map((r) => r.text), ['The Title']);
    assert.equal(itemInfoRows(painting, rows).length, 2, 'the POPUP still shows both');
  } finally { setPaintFile(null); }
  const sword = { group: 'Weapons', templateIndex: 0 };
  assert.deepEqual(itemInfoPanelRows(sword, rows).map((r) => r.text), ['line one', 'line two']);
});
