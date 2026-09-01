// ROAD TO 1:1, group a7 (ui-pickers): VerticalScrollBar as one real
// component, the list picker's ListBox laws (double-click / hover
// colours / drag) and the item scroller's red/green arrows.
//
// Every pin here fails under a one-character mutation of the DFU
// member it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  VerticalScrollBar, clampScrollIndex, thumbSpan, scrollBarClick, dragScrollIndex,
  drawScrollThumb, THUMB_MIN_H, THUMB_TOP_ROW, THUMB_BODY_ROW, THUMB_BOTTOM_ROW, THUMB_COLUMNS,
} from '../src/ui/verticalScrollBar.js';
import {
  ListPickerWindow, PICKER_X, PICKER_Y, PICKER_RECTS, ROWS_DISPLAYED,
  rowTextColor, rowShadowOffset,
  SELECTED_TEXT_COLOR, HIGHLIGHTED_TEXT_COLOR, HIGHLIGHTED_SELECTED_TEXT_COLOR,
} from '../src/ui/listPicker.js';
import { DEFAULT_TEXT_COLOR } from '../src/ui/nativePanel.js';
import {
  arrowStates, playScrollerArrowClick, scrollThumbSpan, LIST_SLOTS,
  SCROLLBAR_H, SCROLLBAR_Y, SCROLLBAR_W, ARROWS_FULL, UP_ARROW_RECT, DOWN_ARROW_RECT, ARROW_H,
} from '../src/ui/itemScroller.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const recorder = () => {
  const quads = [];
  return { quads, drawScreenQuad: (tex, r, uv, color) => quads.push({ tex, ...r, color }) };
};
const withAudio = (fn) => {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(played); } finally { audio.playOneShot = orig; }
};

// ── SetScrollIndex (:187-202) ─────────────────────────────────────

test('ROAD-A7: SetScrollIndex clamps into [0, totalUnits - displayUnits]', () => {
  assert.equal(clampScrollIndex(5, 20, 4), 5);
  assert.equal(clampScrollIndex(-3, 20, 4), 0);
  assert.equal(clampScrollIndex(99, 20, 4), 16, 'maxScroll = total - display');
  // maxScroll floors at 0 (:189-191), so a list SHORTER than the
  // window can only ever sit at 0 - which is what makes every rail
  // click on such a list a no-op after the clamp.
  assert.equal(clampScrollIndex(3, 2, 9), 0);
  assert.equal(clampScrollIndex(0, 0, 9), 0);
});

// ── DrawScrollBar's thumb (:204-211) ──────────────────────────────

test('ROAD-A7: the thumb is the displayed fraction with a 10px floor', () => {
  assert.equal(THUMB_MIN_H, 10);
  // half the content visible -> half the bar, at the top
  assert.deepEqual(thumbSpan(100, 20, 10, 0), { y: 0, h: 50 });
  // ...and at the bottom it sits on the LEFTOVER, not on the bar
  assert.deepEqual(thumbSpan(100, 20, 10, 10), { y: 50, h: 50 });
  // the floor: 1 of 200 rows over an 82px bar is 0.41px without it
  const tiny = thumbSpan(82, 200, 1, 0);
  assert.equal(tiny.h, THUMB_MIN_H);
  // and the leftover shrinks by the FLOORED height, so the walk still
  // ends flush with the bottom of the bar
  const end = thumbSpan(82, 200, 1, 199);
  assert.equal(Math.round(end.y + end.h), 82);
  // a list that FITS never draws a thumb at all (Draw :136)
  assert.equal(thumbSpan(82, 9, 9, 0), null);
  assert.equal(thumbSpan(82, 4, 9, 0), null);
});

// ── MouseClick (:142-150) ─────────────────────────────────────────

test('ROAD-A7: the trough pages by DisplayUnits off thumbRect, never off the midpoint', () => {
  const span = thumbSpan(82, 30, 9, 10);   // somewhere in the middle
  assert.ok(span.y > 0 && span.y + span.h < 82);
  assert.equal(scrollBarClick(span.y - 1, span, 10, 30, 9), 1, 'above yMin pages UP by 9');
  assert.equal(scrollBarClick(span.y + span.h + 1, span, 10, 30, 9), 19, 'below yMax pages DOWN by 9');
  // a click ON the thumb has no arm at all
  assert.equal(scrollBarClick(span.y + 1, span, 10, 30, 9), 10);
  // AUDIT 39 F126's law, kept: with no thumb, thumbRect is the zero
  // rect, so every y falls into the `>` arm and the clamp eats it.
  assert.equal(scrollBarClick(40, null, 0, 4, 9), 0);
});

// ── Update's drag (:115-121) ──────────────────────────────────────

test('ROAD-A7: the drag scale reads TOTAL units and the cast truncates toward zero', () => {
  // scale = Size.y / totalUnits: an 80px bar over 40 rows is 2px a row
  assert.equal(dragScrollIndex(10, 0, 0, 80, 40, 10), 5, '10px / 2px = 5 rows');
  // (int) is a C# cast, NOT a floor - it truncates toward zero, so a
  // drag of 2.9 rows moves 2 and a drag of -2.9 rows moves -2
  assert.equal(dragScrollIndex(5, 0, 10, 80, 40, 10), 12, '5/2 = 2.5 -> 2');
  assert.equal(dragScrollIndex(0, 5, 10, 80, 40, 10), 8, '-2.5 -> -2, not -3');
  // and the scale being TOTAL rather than (total - display) is DFU's
  // own quirk: dragging the thumb the full bar overshoots the end and
  // SetScrollIndex absorbs it.
  assert.equal(dragScrollIndex(80, 0, 0, 80, 40, 10), 30, 'clamped at 40 - 10');
});

test('ROAD-A7: a press inside thumbRect latches the drag; outside it pages', () => {
  const bar = new VerticalScrollBar({ rect: [181, 23, 5, 82], totalUnits: 30, displayUnits: 9 });
  const span = bar.thumbSpan;
  // pressing the thumb moves nothing and starts the drag
  assert.equal(bar.press(183, 23 + span.y + 1), true);
  assert.equal(bar.draggingThumb, true);
  assert.equal(bar.scrollIndex, 0);
  // ...and the move now walks the index (bar-local y, owner space in)
  bar.update(true, 23 + span.y + 1 + 27.34);
  assert.equal(bar.scrollIndex, dragScrollIndex(span.y + 1 + 27.34, span.y + 1, 0, 82, 30, 9));
  assert.ok(bar.scrollIndex > 0);
  // letting go drops the latch (Update's else arm)
  bar.update(false, 200);
  assert.equal(bar.draggingThumb, false);
  // a press BELOW the thumb pages down and starts no drag
  const b2 = new VerticalScrollBar({ rect: [181, 23, 5, 82], totalUnits: 30, displayUnits: 9 });
  b2.press(183, 23 + 81);
  assert.equal(b2.draggingThumb, false);
  assert.equal(b2.scrollIndex, 9);
  // outside the bar entirely, the press is not the bar's
  assert.equal(b2.press(100, 100), false);
  // Reset raises no scroll event (:171-176)
  let raised = 0;
  const b3 = new VerticalScrollBar({ rect: [0, 0, 5, 82], totalUnits: 20, displayUnits: 4, onScroll: () => { raised++; } });
  b3.reset(4, 20, 7);
  assert.equal(b3.scrollIndex, 7);
  assert.equal(raised, 0);
  b3.setScrollIndexWithoutRaisingScrollEvent(3);
  assert.equal(raised, 0, 'and neither does the without-event setter');
  b3.scrollDown();
  assert.equal(raised, 1);
  assert.equal(b3.scrollIndex, 4, 'MouseScrollDown is one unit (:158-162)');
});

// ── the thumb ART (:213-221) ──────────────────────────────────────

test('ROAD-A7: the thumb draws DFU\'s three slices, top and bottom one pixel each', () => {
  // VScrollThumbTop/Body/Bottom.png are 5x1 RGB strips; the body is
  // the light 186 with a 223 highlight on the right and the 77 edge on
  // the left, and the bottom slice is all 77.
  assert.deepEqual([...THUMB_TOP_ROW], [77, 223, 223, 223, 223]);
  assert.deepEqual([...THUMB_BODY_ROW], [77, 186, 186, 186, 223]);
  assert.deepEqual([...THUMB_BOTTOM_ROW], [77, 77, 77, 77, 77]);
  assert.equal(THUMB_COLUMNS, 5);

  const r = recorder();
  const m = { ox: 0, oy: 0, s: 1 };
  const span = { y: 4.7, h: 20 };
  assert.equal(drawScrollThumb(r, m, [181, 23, 5, 82], span), true);
  assert.equal(r.quads.length, THUMB_COLUMNS * 3, 'three bands of five columns');
  // the origins are TRUNCATED, as DFU's (int) casts are: 23 + 4.7 -> 27
  assert.equal(r.quads[0].y, 27);
  assert.equal(r.quads[0].h, 1, 'the top texture is one pixel tall');
  assert.equal(r.quads[THUMB_COLUMNS].y, 28, 'the body starts at topRect.yMax');
  assert.equal(r.quads[THUMB_COLUMNS].h, 18, 'thumbHeight - top - bottom');
  assert.equal(r.quads[THUMB_COLUMNS * 2].y, 46, 'and the bottom sits on bodyRect.yMax');
  assert.equal(r.quads[THUMB_COLUMNS * 2].h, 1);
  // the columns are the stretched texture: left edge dark, body light
  assert.equal(Math.round(r.quads[0].color[0] * 255), 77);
  assert.equal(Math.round(r.quads[1].color[0] * 255), 223);
  assert.equal(Math.round(r.quads[THUMB_COLUMNS + 1].color[0] * 255), 186);
  assert.equal(Math.round(r.quads[THUMB_COLUMNS + 4].color[0] * 255), 223);
  assert.equal(r.quads[0].w, 1, 'a 5-wide bar is the 5-wide texture 1:1');
  // ...and a list that fits paints NOTHING (Draw returns at :136)
  const none = recorder();
  assert.equal(drawScrollThumb(none, m, [181, 23, 5, 82], null), false);
  assert.equal(none.quads.length, 0);
});

// ── the list picker's ListBox laws ────────────────────────────────

test('ROAD-A7: DecideTextColor\'s four arms are DaggerfallUI\'s four colours', () => {
  assert.deepEqual(rowTextColor(false, false), DEFAULT_TEXT_COLOR);
  assert.deepEqual(rowTextColor(true, false), SELECTED_TEXT_COLOR);
  assert.deepEqual(rowTextColor(false, true), HIGHLIGHTED_TEXT_COLOR);
  assert.deepEqual(rowTextColor(true, true), HIGHLIGHTED_SELECTED_TEXT_COLOR);
  const to255 = (c) => c.slice(0, 3).map((v) => Math.round(v * 255));
  assert.deepEqual(to255(HIGHLIGHTED_TEXT_COLOR), [255, 130, 40], 'DaggerfallAlternateHighlightTextColor (DaggerfallUI.cs:57)');
  assert.deepEqual(to255(HIGHLIGHTED_SELECTED_TEXT_COLOR), [254, 56, 18], 'DaggerfallBrighterSelectedTextColor (:63)');
  // the shadow goes with the SELECTION, not with the hover
  assert.equal(rowShadowOffset(true), 0);
  assert.equal(rowShadowOffset(false), 1);
});

test('ROAD-A7: MouseMove sets highlightedIndex against the SCROLLED list', () => {
  const items = Array.from({ length: 25 }, (_, i) => `item${i}`);
  const w = new ListPickerWindow({ items });
  w._font = { fnt: { fixedHeight: 6 } };      // rowHeight 7
  w.scrollIndex = 9;
  const [lx, ly] = PICKER_RECTS.list;
  w.hover(PICKER_X + lx + 1, PICKER_Y + ly + 2 * 7 + 1);
  assert.equal(w.highlightedIndex, 11, 'scrollIndex + row, as MouseMove reads it (:436-441)');
  // MouseLeave (:460-463): off the list is nothing highlighted
  w.hover(2, 2);
  assert.equal(w.highlightedIndex, -1);
  // an index past the end highlights nothing either (:438)
  const shortList = new ListPickerWindow({ items: ['a', 'b'] });
  shortList._font = { fnt: { fixedHeight: 6 } };
  shortList.hover(PICKER_X + lx + 1, PICKER_Y + ly + 5 * 7 + 1);
  assert.equal(shortList.highlightedIndex, -1);
});

test('ROAD-A7: the picker\'s bar drags, pages and feeds the list back', () => {
  const items = Array.from({ length: 30 }, (_, i) => `item${i}`);
  const w = new ListPickerWindow({ items });
  w._font = { fnt: { fixedHeight: 6 } };
  const [sx, sy] = PICKER_RECTS.scrollBar;
  const bx = PICKER_X + sx + 2;
  // a press BELOW the thumb pages the LIST by RowsDisplayed
  // (Update :117 carries scrollBar.ScrollIndex back into the ListBox)
  assert.equal(w.click(bx, PICKER_Y + sy + 80), true);
  assert.equal(w.scrollIndex, ROWS_DISPLAYED);
  assert.equal(w.selectedIndex, 0, 'paging the bar never moves the selection');
  // ...and pressing the thumb latches the drag instead
  w.scrollIndex = 0;
  w.syncScrollBar();
  const span = w.scrollBar.thumbSpan;
  w.click(bx, PICKER_Y + sy + span.y + 1);
  assert.equal(w.scrollBar.draggingThumb, true);
  assert.equal(w.scrollIndex, 0, 'the press itself moved nothing');
  // dragging down 30px on an 82px bar over 30 units: 30 / (82/30) = 10
  w.hover(bx, PICKER_Y + sy + span.y + 1 + 30, { buttons: 1 });
  assert.equal(w.scrollIndex, 10);
  // letting go drops the latch and the bar follows the LIST again
  w.hover(bx, PICKER_Y + sy + span.y + 1 + 30, { buttons: 0 });
  assert.equal(w.scrollBar.draggingThumb, false);
  w.wheel(-1);
  assert.equal(w.scrollIndex, 9);
  w.syncScrollBar();
  assert.equal(w.scrollBar.scrollIndex, 9, 'Update :117 - the bar follows the list when idle');
  // a host that hands no DOM event holds no button, so the drag ends
  w.click(bx, PICKER_Y + sy + w.scrollBar.thumbSpan.y + 1);
  assert.equal(w.scrollBar.draggingThumb, true);
  w.hover(bx, PICKER_Y + sy + 40);
  assert.equal(w.scrollBar.draggingThumb, false);
});

// ── the item scroller's arrows (ItemListScroller.cs:486-516) ──────

test('ROAD-A7: UpdateListScrollerButtons\' red/green states', () => {
  assert.equal(LIST_SLOTS, 4);
  // scrolled to the top of a long list: nothing above, more below
  assert.deepEqual(arrowStates(0, 20), { up: 'red', down: 'green' });
  assert.deepEqual(arrowStates(1, 20), { up: 'green', down: 'green' });
  // the last page: `index < count - listDisplayUnits` is FALSE at 16
  assert.deepEqual(arrowStates(16, 20), { up: 'green', down: 'red' });
  assert.deepEqual(arrowStates(15, 20), { up: 'green', down: 'green' });
  // a list that FITS forces both red, overriding the two lines above
  // (:496-500) - which is the arm that makes an empty pack read right
  assert.deepEqual(arrowStates(0, 4), { up: 'red', down: 'red' });
  assert.deepEqual(arrowStates(0, 0), { up: 'red', down: 'red' });
});

test('ROAD-A7: the two arrow rects are cut from a 9x152 strip', () => {
  assert.deepEqual(ARROWS_FULL, { w: 9, h: 152 });
  assert.deepEqual([...UP_ARROW_RECT], [0, 0, 9, ARROW_H]);
  assert.deepEqual([...DOWN_ARROW_RECT], [0, 136, 9, ARROW_H]);
  assert.equal(ARROW_H, 16);
});

test('ROAD-A7: only the ARROWS play ButtonClick', () => {
  withAudio((played) => {
    playScrollerArrowClick('up');
    playScrollerArrowClick('down');
    assert.deepEqual(played, [SOUND.ButtonClick, SOUND.ButtonClick]);
    played.length = 0;
    // the rail, the thumb and the slots are silent (:606-614 plays
    // nothing for the wheel either)
    playScrollerArrowClick('page-up');
    playScrollerArrowClick('page-down');
    playScrollerArrowClick('thumb');
    playScrollerArrowClick('slot');
    assert.deepEqual(played, []);
  });
});

test('ROAD-A7: the scroller\'s thumb math is now the shared component\'s', () => {
  // Same numbers as before the extraction - AUDIT 39 F126's law is
  // untouched, it just lives in one place now.
  assert.equal(SCROLLBAR_Y, 18);
  assert.equal(SCROLLBAR_W, 6);
  assert.equal(SCROLLBAR_H, 117);
  assert.equal(scrollThumbSpan(0, 4), null, 'a list that fits has no thumb');
  assert.deepEqual(scrollThumbSpan(0, 8), thumbSpan(SCROLLBAR_H, 8, LIST_SLOTS, 0));
  assert.deepEqual(scrollThumbSpan(3, 20), thumbSpan(SCROLLBAR_H, 20, LIST_SLOTS, 3));
});

// ── host wiring (the art itself needs ARENA2, absent here) ────────

test('ROAD-A7: both default-rect scroller windows load and draw the arrows', () => {
  // The two windows whose lists ride ItemListScroller's DEFAULT rect
  // (9,0,50,152) - the only ones itemScroller.js's constants describe.
  for (const rel of ['src/ui/nativeInventory.js', 'src/ui/nativeTrade.js']) {
    const code = read(rel);
    assert.match(code, /preloadScrollerArrowArt\(deps\)/, `${rel} loads INVE06I0/INVE07I0`);
    assert.match(code, /drawScrollerArrows\(renderer, m, rect, scroll, items\.length\)/, `${rel} draws them`);
    assert.match(code, /drawScrollerThumb\(renderer, m, rect, scroll, items\.length\)/, `${rel} draws the thumb`);
    assert.match(code, /playScrollerArrowClick\(/, `${rel} clicks on the arrows`);
  }
  // ...and the item maker, which hands the scroller its OWN rect
  // (DaggerfallItemMakerWindow.cs:44 - (10,0,50,148)), takes the
  // rect-independent SOUND and none of the rect-bound art.
  const maker = read('src/ui/itemMakerWindow.js');
  assert.match(maker, /playScrollerArrowClick\(/);
  assert.equal(/drawScrollerArrows/.test(maker), false,
    'the shared arrow art would land four pixels wrong in this window');
});

test('ROAD-A7: the picker\'s hover seam reaches it through every window that wraps one', () => {
  // ListBox.MouseMove's highlight and VerticalScrollBar.Update's drag
  // both ride the host hover seam, so a picker inside another window
  // is only reachable if that window forwards it.
  for (const rel of ['src/ui/guildServiceWindows.js', 'src/ui/potionMakerWindow.js',
    'src/ui/itemMakerWindow.js', 'src/ui/travelMapWindow.js']) {
    assert.match(read(rel), /picker\??\.hover\(vx, vy, e\)/, `${rel} forwards the hover`);
  }
  // and the two overlay channels carry the DOM event that stands in
  // for InputManager.GetMouseButton(0)
  assert.match(read('src/scenes/dungeonContext.js'), /overlayHover\(vx, vy, e = null\)/);
  assert.match(read('src/scenes/dungeon.js'), /ctx\.overlayHover\?\.\([^)]*, e\)/);
  assert.match(read('src/scenes/worldModes.js'), /interiorOverlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\)/);
});

test('ROAD-A7: the painting box asks for the picture and sizes the parchment round it', () => {
  const code = read('src/ui/nativeInventory.js');
  // ShowInfoPopup's painting arm (:1619-1631): the image, and NO
  // chained second box.
  assert.match(code, /this\.boxes = \[\{ rows: infoRows, painting: it\.paintingInfo \}\]/);
  assert.match(code, /paintingImage\(box\.painting\)/);
  assert.match(code, /image: \{ width: pic\.w, height: pic\.h \}/,
    'the picture is MEASURED into the layout, not stamped over it');
  // the little panel takes the title-only read
  assert.match(code, /itemInfoPanelRows\(this\.infoItem/);
});
