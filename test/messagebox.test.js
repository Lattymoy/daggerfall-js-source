// U11: DaggerfallMessageBox's parchment frame and its sizing law.
// Every pin fails under a one-character mutation of the law it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutMessageBox, messageBoxHit, MB_BUTTONS,
  SLICE, MARGIN, MIN_BOX_WIDTH, MIN_BOX_SIDE, BUTTON_W, BUTTON_H,
  BUTTON_SPACING, BUTTON_TEXT_DISTANCE, SINGLE_BUTTON_NUDGE,
} from '../src/ui/messageBox.js';

// TEST THE SHAPE THE PRODUCER MINTS: measureText calls
// fnt.glyphWidth(code - 33) and adds FNT_GLYPH_SPACING (1) between
// glyphs, so a fake font must expose that method, not a glyph map.
// A uniform 4px glyph makes an n-char row 5n - 1 wide, checkable by
// hand.
const font = (w = 4, h = 9) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });

test('U11: the frame constants are DFU\'s', () => {
  assert.equal(SLICE, 22, 'SPOP.RCI records are 22x22 - the reason the box rounds to 22');
  assert.equal(MARGIN, 10);            // SetDaggerfallPopupStyle:931
  assert.equal(MIN_BOX_WIDTH, 132);    // minBoxWidth :30
  assert.equal(MIN_BOX_SIDE, 44);      // the `minimum` in UpdatePanelSizes
  assert.equal(BUTTON_W, 32);
  assert.equal(BUTTON_H, 16);          // BUTTONS.RCI records are 32x16
  assert.equal(BUTTON_SPACING, 32);    // :39
  assert.equal(BUTTON_TEXT_DISTANCE, 4); // :40
  assert.equal(SINGLE_BUTTON_NUDGE, 11); // the :546-548 quirk
});

test('U11: MessageBoxButtons values ARE the BUTTONS.RCI records', () => {
  // DaggerfallMessageBox.cs:67-90 + :369 - AddButton indexes the CIF
  // by the enum value, so a drifted number draws the wrong button.
  assert.equal(MB_BUTTONS.Accept, 0);
  assert.equal(MB_BUTTONS.Cancel, 2);
  assert.equal(MB_BUTTONS.Yes, 3);
  assert.equal(MB_BUTTONS.No, 4);
  assert.equal(MB_BUTTONS.OK, 5);
  assert.equal(MB_BUTTONS.Male, 6);
  assert.equal(MB_BUTTONS.Female, 7);
  assert.equal(MB_BUTTONS.Teleport, 20);
});

test('U11: UpdatePanelSizes rounds to the slice and floors at 132', () => {
  const f = font();
  // one short line, no buttons: the width floor bites, and the height
  // is one row + both margins rounded up to a multiple of 22
  const a = layoutMessageBox(f, ['hi']);
  assert.equal(a.w, 132, 'under minBoxWidth -> minBoxWidth (already a multiple of 22)');
  assert.equal(a.h, MIN_BOX_SIDE, '9 + 20 = 29 is under 44, so the minimum applies');
  // tall enough to pass 44: five rows = 45 + 20 = 65 -> ceil(65/22)*22
  const b = layoutMessageBox(f, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(b.h, 66);
  // wide enough to pass 132: 40 glyphs = 200 + 20 = 220, already exact
  const wide = layoutMessageBox(f, ['x'.repeat(40)]);
  assert.equal(wide.w, 220);
  // and one glyph more rounds UP a whole slice
  assert.equal(layoutMessageBox(f, ['x'.repeat(41)]).w, 242);
  // the box is centred on the 320x200 native panel
  assert.equal(a.x, Math.round((320 - a.w) / 2));
  assert.equal(a.y, Math.round((200 - a.h) / 2));
});

test('U11: buttons grow the label block ONCE, and one button is nudged', () => {
  const f = font();
  const plain = layoutMessageBox(f, ['hi']);
  const one = layoutMessageBox(f, ['hi'], [MB_BUTTONS.OK]);
  const two = layoutMessageBox(f, ['hi'], [MB_BUTTONS.Yes, MB_BUTTONS.No]);
  // the `finalSize.y - buttonPanel.Size.y > 0` gate passes only on the
  // FIRST button, so one and two buttons grow the block identically
  assert.equal(one.h, two.h, 'the second button adds no height');
  assert.ok(one.h > plain.h, 'but the first one does');
  // two buttons: 32 + 32 + 32 = 96 wide, still under the 132 floor
  assert.equal(two.w, MIN_BOX_WIDTH);
  assert.equal(two.buttons.length, 2);
  assert.equal(two.buttons[1].rect[0] - two.buttons[0].rect[0], BUTTON_W + BUTTON_SPACING);
  // the strip is centred
  const stripW = 2 * BUTTON_W + BUTTON_SPACING;
  assert.equal(two.buttons[0].rect[0], two.x + Math.round((two.w - stripW) / 2));
  // the strip never rides into the text: DFU computes buttonY from
  // the panel's PREVIOUS height and lands 6px above the last row, so
  // the port clamps to the reservation the label block already made
  // (4px under the text, which 16px of button exactly fills)
  const rowsBottom = two.textY + 1 * (two.rowH);   // one row of text
  assert.equal(two.buttons[0].rect[1], rowsBottom + BUTTON_TEXT_DISTANCE);
  // the single-button HACK still moves it DOWN relative to the
  // verbatim two-button placement, so one button never sits higher
  assert.ok(one.buttons[0].rect[1] >= two.buttons[0].rect[1]);
});

test('U11: a wide button strip drives the width when it beats the text', () => {
  const f = font();
  // four buttons: 4*32 + 3*32 = 224, + 20 margins = 244 -> ceil to 264
  const four = layoutMessageBox(f, ['hi'], [MB_BUTTONS.Yes, MB_BUTTONS.No, MB_BUTTONS.OK, MB_BUTTONS.Cancel]);
  assert.equal(four.w, 264);
  assert.equal(four.buttons.length, 4);
});

test('U11: clicks land on the button rects, and only on them', () => {
  const f = font();
  const box = layoutMessageBox(f, ['hi'], [MB_BUTTONS.Yes, MB_BUTTONS.No]);
  const [yx, yy] = box.buttons[0].rect;
  const [nx] = box.buttons[1].rect;
  assert.equal(messageBoxHit(box, yx + 1, yy + 1), MB_BUTTONS.Yes);
  assert.equal(messageBoxHit(box, nx + 1, yy + 1), MB_BUTTONS.No);
  assert.equal(messageBoxHit(box, yx + BUTTON_W, yy + 1), null, 'the gap BETWEEN the buttons is dead');
  assert.equal(messageBoxHit(box, yx + 1, yy + BUTTON_H), null, 'and so is the row under them');
  assert.equal(messageBoxHit(box, box.x + 1, box.y + 1), null, 'the frame is not a button');
  assert.equal(messageBoxHit(layoutMessageBox(f, ['hi']), yx + 1, yy + 1), null, 'a box with no buttons has no hits');
});
