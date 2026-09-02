// ROAD TO 1:1, group D2 (scrollbar thumbs): the two windows that still
// drew VerticalScrollBar's thumb as something other than DFU's art -
// the chargen list picker, which drew NOTHING at all, and the
// spellbook, which drew a flat brass rectangle. Both now go through
// ui/verticalScrollBar.js, whose three 5x1 strips ROAD-A7 carried into
// the repo.
//
// Every pin here fails under a one-character mutation of the DFU
// member it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { thumbSpan, THUMB_TOP_ROW, THUMB_BODY_ROW, THUMB_BOTTOM_ROW, THUMB_COLUMNS } from '../src/ui/verticalScrollBar.js';
import { drawPickerScrollThumb, PICK_PANEL, RECTS, CLASS_LIST_ROWS } from '../src/ui/chargenArt.js';
import { SpellbookWindow, SPELLBOOK_RECTS, SPELLBOOK_LAYOUT } from '../src/ui/spellbookWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const recorder = () => {
  const quads = [];
  return {
    quads,
    uploadTexture: () => 'tex', releaseTexture: () => {},
    drawScreenQuad: (tex, r, uv, color) => quads.push({ tex, ...r, color }),
  };
};
const M = { ox: 0, oy: 0, s: 1 };
const font = (w = 4, h = 6) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });
const canvas = { width: 320, height: 200 };

/** The quads a bar rect's columns took, in draw order. The thumb is
 *  the only greyscale (r == g == b) fill inside the rail's x band. */
const barQuads = (quads, [bx, , bw]) => quads.filter((q) => q.tex === null && q.color
  && q.color[0] === q.color[1] && q.color[1] === q.color[2]
  && q.x >= bx && q.x < bx + bw);
const grey = (q) => Math.round(q.color[0] * 255);

// ── the chargen list picker (AUDIT 17g's thumb) ───────────────────

test('ROAD-D2: the picker\'s thumb is DFU\'s three slices on the panel\'s own 5x82 rail', () => {
  // DaggerfallListPickerWindow.cs:96-99 - a pickerPanel child at
  // (181,23), 5x82, and the panel itself is Center/Middle at (60,36).
  assert.deepEqual([...RECTS.pickScroll], [181, 23, 5, 82]);
  const [ox, oy] = PICK_PANEL;
  const [sx, sy, sw, sh] = RECTS.pickScroll;

  const r = recorder();
  // twenty careers in a nine-row window (ListBox.cs:36 rowsDisplayed)
  assert.equal(drawPickerScrollThumb(r, M, 20, CLASS_LIST_ROWS, 0), true);
  const bar = barQuads(r.quads, [ox + sx, oy + sy, sw]);
  assert.equal(bar.length, THUMB_COLUMNS * 3, 'three bands of five stretched columns');
  // thumbHeight = 82 * 9/20 = 36.9, thumbY = 0 (:207-209)
  const span = thumbSpan(sh, 20, CLASS_LIST_ROWS, 0);
  assert.equal(Math.round(span.h * 10), 369);
  assert.equal(bar[0].y, oy + sy, 'the top slice sits at the rail top with scrollIndex 0');
  assert.equal(bar[0].h, 1, 'VScrollThumbTop.png is one pixel tall');
  assert.equal(bar[0].x, ox + sx, 'and the bar starts at the panel-child x - 60 + 181');
  assert.equal(bar[0].w, 1, 'a 5-wide rail is the 5-wide texture 1:1');
  assert.deepEqual(bar.slice(0, THUMB_COLUMNS).map(grey), [...THUMB_TOP_ROW]);
  assert.deepEqual(bar.slice(THUMB_COLUMNS, THUMB_COLUMNS * 2).map(grey), [...THUMB_BODY_ROW]);
  assert.deepEqual(bar.slice(THUMB_COLUMNS * 2).map(grey), [...THUMB_BOTTOM_ROW]);
  assert.equal(bar[THUMB_COLUMNS * 2].h, 1);
  // the body is thumbHeight less the two one-pixel slices, TRUNCATED
  // (:214) - which is where DisplayUnits being the caller's row count
  // and not some other number shows up in the paint
  assert.equal(bar[THUMB_COLUMNS].h, Math.trunc(36.9 - 2));
  assert.equal(bar[THUMB_COLUMNS].y, oy + sy + 1, 'the body starts at topRect.yMax');

  // scrolled to the bottom, thumbY = 11 * (82 - 36.9) / 11 = 45.1, and
  // the origin TRUNCATES (the (int) casts at :213-215)
  const r2 = recorder();
  drawPickerScrollThumb(r2, M, 20, CLASS_LIST_ROWS, 11);
  const bar2 = barQuads(r2.quads, [ox + sx, oy + sy, sw]);
  assert.equal(bar2[0].y, Math.trunc(oy + sy + 45.1));

  // ...and a list that FITS draws nothing at all: Draw returns before
  // DrawScrollBar (:135-139). The class list is eighteen careers plus
  // Custom, so this is the skill and help pickers' shorter lists.
  const r3 = recorder();
  assert.equal(drawPickerScrollThumb(r3, M, CLASS_LIST_ROWS, CLASS_LIST_ROWS, 0), false);
  assert.equal(r3.quads.length, 0);
  const r4 = recorder();
  assert.equal(drawPickerScrollThumb(r4, M, 4, CLASS_LIST_ROWS, 0), false);
  assert.equal(r4.quads.length, 0);
});

test('ROAD-D2: drawListPicker draws that thumb, so all three chargen pickers get it', () => {
  // The class list, the custom-class skill/help picker and the two
  // special-advantage pickers all share drawListPicker; the thumb has
  // to hang off THAT, not off one caller. (The body needs PICK00I0 to
  // run, so this is the seam a bare suite can reach.)
  const code = read('src/ui/chargenArt.js');
  assert.match(code, /drawPickerScrollThumb\(renderer, m, names\.length, rows, scroll\);/,
    'the live list length and the CALLER\'s row count are Update\'s TotalUnits/DisplayUnits (:103-106)');
  assert.equal(code.includes('AUDIT 17g FLAGGED: the scrollbar THUMB does not draw'), false,
    'and the flag it closes is gone from the index');
});

// ── the spellbook (F180's flat brass bar) ─────────────────────────

const spell = (name, cost) => ({ name, cost, index: 1, icon: 3, element: 0, rangeType: 2, effects: [] });
const book = (n) => new SpellbookWindow({
  spells: () => Array.from({ length: n }, (_, i) => spell(`S${i}`, i + 1)),
  entity: { name: 'Nyra', magicka: 99, maxMagicka: 99, items: [], stats: { personality: 50 } },
  castCost: (sp) => sp.cost,
  rows: () => [],
});
const ROWS_DISPLAYED = 16;   // spellsListBox.RowsDisplayed (:349)

test('ROAD-D2: the spellbook\'s thumb is the same three slices, not a brass rectangle', () => {
  assert.deepEqual([...SPELLBOOK_RECTS.scrollBar], [122, 28, 7, 103]);   // :48
  const { x: px, y: py } = SPELLBOOK_LAYOUT;
  const [sx, sy, sw, sh] = SPELLBOOK_RECTS.scrollBar;

  const r = recorder();
  book(20).draw(r, canvas, font());
  const bar = barQuads(r.quads, [px + sx, py + sy, sw]);
  assert.equal(bar.length, THUMB_COLUMNS * 3, 'fifteen quads, not one flat bar');
  assert.deepEqual(bar.slice(0, THUMB_COLUMNS).map(grey), [...THUMB_TOP_ROW]);
  assert.deepEqual(bar.slice(THUMB_COLUMNS, THUMB_COLUMNS * 2).map(grey), [...THUMB_BODY_ROW]);
  assert.deepEqual(bar.slice(THUMB_COLUMNS * 2).map(grey), [...THUMB_BOTTOM_ROW]);
  // thumbHeight = 103 * 16/20 = 82.4; the body is thumbHeight less the
  // two one-pixel slices, TRUNCATED (:214)
  assert.equal(bar[0].y, py + sy);
  assert.equal(bar[0].h, 1);
  assert.equal(bar[THUMB_COLUMNS].h, Math.trunc(82.4 - 2));
  // a 7-wide rail STRETCHES the 5-wide texture (ScaleMode.StretchToFill)
  assert.equal(bar[0].w, 7 / THUMB_COLUMNS);

  // sixteen spells fit, so Draw returns and NOTHING is painted there
  const r2 = recorder();
  book(ROWS_DISPLAYED).draw(r2, canvas, font());
  assert.deepEqual(barQuads(r2.quads, [px + sx, py + sy, sw]), []);
});

test('ROAD-D2: the spellbook\'s trough pages off the SAME span the art draws', () => {
  const { x: px, y: py } = SPELLBOOK_LAYOUT;
  const [sx, sy, , sh] = SPELLBOOK_RECTS.scrollBar;
  const w = book(20);
  const span = thumbSpan(sh, 20, ROWS_DISPLAYED, 0);   // y 0, h 82.4

  // below thumbRect.yMax: += displayUnits, clamped to total - display
  w.click(px + sx + 3, py + sy + span.h + 5);
  assert.equal(w.scrollIndex, 4, 'MouseClick :148-149 pages by DisplayUnits and SetScrollIndex clamps');
  // above thumbRect.yMin: -= displayUnits
  const top = thumbSpan(sh, 20, ROWS_DISPLAYED, 4);
  assert.ok(top.y > 1);
  w.click(px + sx + 3, py + sy + 1);
  assert.equal(w.scrollIndex, 0, 'MouseClick :146-147');
  // and a click ON the thumb moves nothing - there is no third arm
  w.click(px + sx + 3, py + sy + span.h - 1);
  assert.equal(w.scrollIndex, 0);
});
