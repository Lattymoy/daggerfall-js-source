// ROAD TO 1:1, WAVE G - G4: THE LAST DRAG LATCHES ON THE MOUSE-UP SEAM.
//
// Wave E built the overlay mouse-UP seam and wired the shared list
// picker to it (test/roade_up_seam.test.js). It left THREE consumers of
// `ui/verticalScrollBar.js` still on the old, wrong edge - or on no edge
// at all - and each recorded the fact in a comment that cited the
// remainder as though it were still open:
//
//   - `ui/spellbookWindow.js` had the bar's DRAW and its two paging arms
//     and NO drag: "no host hands this window a held-button frame"
//     (Ledger C's F159/F170/F180 row). That reason was already false
//     twice over - ROAD-A7 gave the hosts' hover the DOM event, wave E
//     gave every overlay slot the button-UP edge - so the departure had
//     outlived both halves of its blocker. DFU's own scroller is a live
//     `VerticalScrollBar` (DaggerfallSpellBookWindow.cs:363-372) whose
//     `Update` (:101-130) drags the thumb like any other.
//   - `ui/spellIconPickerWindow.js` had the scroller's CLAMP alone: the
//     rail took no press, the thumb no drag, and the window painted a
//     grey trough with a grey block riding on it - pixels DFU does not
//     draw at all, because `Draw` returns before `DrawScrollBar`
//     whenever the content fits (:135-139) and that scroller sets no
//     BackgroundColor (SpellIconPickerWindow.cs:91-94).
//   - `ui/chargen.js`'s picker bar dropped its latch on the NEXT MOVE,
//     and said so: "Releasing the button drops the latch on the next
//     move, which is the overlay mouse-UP remainder the shared picker
//     already records".
//
// And one host was short a half: `scenes/interior.js` routed its
// overlay's hover WITHOUT the DOM event, so a window mounted there could
// latch a thumb on the press and never move it - the four-hosts rule's
// own failure mode, silent because nothing errors on a latch.
//
// Every pin below fails under a one-line mutation of the DFU member it
// names; the mutants are named in each test - sixteen of them, all dead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpellbookWindow, SPELLBOOK_RECTS, SPELLBOOK_LAYOUT } from '../src/ui/spellbookWindow.js';
import {
  SpellIconPickerWindow, ICON_PICKER_PANEL_SIZE, ICON_PICKER_SCROLLER,
} from '../src/ui/spellIconPickerWindow.js';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { createChargenWindow } from '../src/systems/chargenSession.js';
import { PICK_SCROLL_RECT } from '../src/ui/chargenArt.js';
import { THUMB_COLUMNS, thumbSpan } from '../src/ui/verticalScrollBar.js';
import { SKILLS } from '../src/systems/skills.js';

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
const canvas = { width: 320, height: 200 };
const font = (w = 4, h = 6) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });

// ═══════════════════════════════════════════════════════════════════
// 1. THE SPELLBOOK'S THUMB (DaggerfallSpellBookWindow.cs:363-372 over
//    VerticalScrollBar.cs:101-130)
// ═══════════════════════════════════════════════════════════════════

const spell = (name, cost) => ({ name, cost, index: 1, icon: 3, element: 0, rangeType: 2, effects: [] });
const book = (n) => new SpellbookWindow({
  spells: () => Array.from({ length: n }, (_, i) => spell(`S${i}`, i + 1)),
  entity: { name: 'Nyra', magicka: 99, maxMagicka: 99, items: [], stats: { personality: 50 } },
  castCost: (sp) => sp.cost,
  rows: () => [],
});
const ROWS_DISPLAYED = 16;                       // spellsListBox.RowsDisplayed (:349)
const [BSX, BSY, , BSH] = SPELLBOOK_RECTS.scrollBar;   // (122,28,7,103), :48
/** a native point on the book's rail at bar-local y */
const railPoint = (localY) => [SPELLBOOK_LAYOUT.x + BSX + 3, SPELLBOOK_LAYOUT.y + BSY + localY];

test('G4-1: a press ON the spellbook thumb latches the drag and pages nothing', () => {
  // MUTANT: drop `this.draggingThumb = true` from VerticalScrollBar.press
  // (Update's latch, :105-113) - the press then falls into MouseClick's
  // `>` arm and pages instead of grabbing.
  const w = book(40);
  w.scrollIndex = 12;
  const span = thumbSpan(BSH, 40, ROWS_DISPLAYED, 12);   // y 30.9, h 41.2
  assert.equal(Math.round(span.y * 10), 309);
  assert.equal(w.click(...railPoint(50)), true, 'the bar consumes its own press');
  assert.equal(w.scrollIndex, 12, 'a press on the thumb moves nothing - there is no third MouseClick arm');
  assert.equal(w.scrollBar.draggingThumb, true, 'and it LATCHES (:105-113)');
});

test('G4-2: the spellbook drag is Update\'s own arithmetic - TOTAL units, and a C# (int) cast', () => {
  // MUTANT: scale = Size.y / (totalUnits - displayUnits), or Math.floor
  // for the cast. Both are red here: the scale below is 103/40 and the
  // backward pull truncates TOWARD ZERO.
  const w = book(40);
  w.scrollIndex = 12;
  w.click(...railPoint(50));                       // latch, dragStartY = 50
  // scale = 103/40 = 2.575; +30px is 11.65 units -> 11
  w.hover(...railPoint(80), { buttons: 1 });
  assert.equal(w.scrollIndex, 23, 'dragStartScrollIndex + (int)unitsMoved (:115-121)');
  // -5px is -1.94 units -> -1 (a floor would give -2)
  w.hover(...railPoint(45), { buttons: 1 });
  assert.equal(w.scrollIndex, 11, 'truncation toward zero, not a floor');
  // and the clamp absorbs an overshoot, SetScrollIndex (:187-202)
  w.hover(...railPoint(400), { buttons: 1 });
  assert.equal(w.scrollIndex, 40 - ROWS_DISPLAYED);
});

test('G4-3: the BUTTON COMING UP drops the book\'s latch, so a later held move cannot resume it', () => {
  // THE SLICE'S OWN LAW. MUTANT: empty `SpellbookWindow.release()` - the
  // latch then survives the release exactly as it did before wave E's
  // seam, and the next held move teleports the list from the STALE
  // anchor (index 23 below instead of 12).
  const w = book(40);
  w.scrollIndex = 12;
  w.click(...railPoint(50));
  assert.equal(w.scrollBar.draggingThumb, true);
  w.release();                                     // Update's else arm (:123-129)
  assert.equal(w.scrollBar.draggingThumb, false);
  w.hover(...railPoint(80), { buttons: 1 });
  assert.equal(w.scrollIndex, 12, 'a released drag does not resume from its old anchor');
  // ...and the press is what re-latches it, never the held button alone
  w.hover(...railPoint(80), { buttons: 1 });
  assert.equal(w.scrollIndex, 12);
});

test('G4-4: the drawn thumb and the drag read ONE index - the live component\'s', () => {
  // MUTANT: drop `hover`'s `update()` poll - the thumb is then drawn
  // where the PRESS left it (12) instead of where the DRAG put it (23).
  // What this pin adds over G4-2 is the OTHER end of the one index: the
  // art is DrawScrollBar's over the same live component, so the picture
  // and the drag cannot part the way ROAD-D2 found the trough and the
  // art parted.
  const w = book(40);
  w.scrollIndex = 12;
  w.click(...railPoint(50));
  w.hover(...railPoint(80), { buttons: 1 });       // dragged to 23
  const r = recorder();
  w.draw(r, canvas, font());
  const bx = SPELLBOOK_LAYOUT.x + BSX;
  const bar = r.quads.filter((q) => q.tex === null && q.color
    && q.color[0] === q.color[1] && q.color[1] === q.color[2]
    && q.x >= bx && q.x < bx + 7);
  assert.equal(bar.length, THUMB_COLUMNS * 3, 'the three slices, still DFU\'s art');
  const span = thumbSpan(BSH, 40, ROWS_DISPLAYED, 23);
  assert.equal(bar[0].y, Math.trunc(SPELLBOOK_LAYOUT.y + BSY + span.y),
    'the thumb is drawn where the DRAG left it');
});

test('G4-5: the book\'s bar is the component, so no count gate stands in front of it', () => {
  // DFU's scroll bar is a child of mainPanel whether or not it painted:
  // MouseClick fires on a list that FITS too, falls into the `>` arm
  // (thumbRect is the zero rect) and SetScrollIndex clamps it away.
  // MUTANT: put the old `_rows.length > ROWS_DISPLAYED` gate back in
  // front of the branch. It is the SOURCE assertion below that kills it,
  // and deliberately so: the gate and the component agree on every
  // observable (both leave the index at 0 and both consume the click),
  // so what is pinned is that this window no longer states an arm of
  // VerticalScrollBar's that VerticalScrollBar states.
  const w = book(ROWS_DISPLAYED);                  // exactly one page - no thumb
  assert.equal(w.click(...railPoint(90)), true);
  assert.equal(w.scrollIndex, 0, 'paged down and clamped back (:187-202)');
  assert.equal(w.scrollBar.draggingThumb, false, 'and nothing to latch onto');
  const s = read('src/ui/spellbookWindow.js');
  assert.match(s, /if \(this\._syncScrollBar\(\)\.contains\(vx - PANEL_X, vy - PANEL_Y\)\) \{/,
    'the press is the component\'s, tested against the component\'s own rect');
  assert.equal(/scrollBarClick/.test(s), false,
    'and the window states none of the bar\'s arms itself any more');
});

// ═══════════════════════════════════════════════════════════════════
// 2. THE SPELL ICON PICKER'S SCROLLER (SpellIconPickerWindow.cs:91-94)
// ═══════════════════════════════════════════════════════════════════

const [IPX, IPY] = [(320 - ICON_PICKER_PANEL_SIZE[0]) / 2, (200 - ICON_PICKER_PANEL_SIZE[1]) / 2];
const [ICX, ICY, ICW, ICH] = ICON_PICKER_SCROLLER;      // (265,2,8,176)
/** a native point on the picker's rail at bar-local y */
const iconRail = (localY) => [IPX + ICX + 4, IPY + ICY + localY];
/** a picker whose content really scrolls (classic-only content cannot) */
const tallPicker = () => { const w = new SpellIconPickerWindow(); w.scrollSteps = 20; return w; };

test('G4-6: the icon picker\'s rail PAGES and LATCHES - it was inert', () => {
  // MUTANT: delete the scroller branch from `click()` - the press then
  // falls to ScrollingPanel_OnMouseClick, which hit-tests icons the rail
  // has none of, and the index never moves.
  const w = tallPicker();
  assert.equal(w.displayUnits, 8);
  const span = thumbSpan(ICH, 20, 8, 0);                // y 0, h 70.4
  assert.equal(Math.round(span.h * 10), 704);
  assert.equal(w.click(...iconRail(100)), true, 'below thumbRect.yMax');
  assert.equal(w.scrollIndex, 8, 'MouseClick pages by DisplayUnits (:148-149)');
  assert.equal(w.click(...iconRail(1)), true, 'above thumbRect.yMin');
  assert.equal(w.scrollIndex, 0, '(:146-147)');
  // ...and a press on the thumb latches instead of paging
  w.click(...iconRail(30));
  assert.equal(w.scrollIndex, 0);
  assert.equal(w.scroller.draggingThumb, true);
});

test('G4-7: the icon picker drags on the held button and lets go on the UP edge', () => {
  // MUTANT: empty `SpellIconPickerWindow.release()`. The drag below then
  // resumes from the stale anchor on the last move and lands on 13.
  const w = tallPicker();
  w.click(...iconRail(30));                             // latch at bar-local 30
  // scale = 176/20 = 8.8; +70px is 7.95 units -> 7
  w.hover(...iconRail(100), { buttons: 1 });
  assert.equal(w.scrollIndex, 7, 'Update\'s drag arm (:115-121)');
  w.release();
  assert.equal(w.scroller.draggingThumb, false, 'the else arm (:123-129), on the mouse-UP seam');
  w.hover(...iconRail(150), { buttons: 1 });
  assert.equal(w.scrollIndex, 7, 'and a held move after the release moves nothing');
});

test('G4-8: the picker paints DFU\'s thumb, and paints NOTHING while the content fits', () => {
  // MUTANT: restore the grey trough/block pair - the fitting case below
  // then draws two quads DFU never draws (Draw returns at :135-139, and
  // this scroller has no BackgroundColor at all, :91-94).
  const railQuads = (quads) => quads.filter((q) => q.tex === null
    && q.x >= IPX + ICX && q.x < IPX + ICX + ICW);
  const r = recorder();
  new SpellIconPickerWindow().draw(r, canvas, font());   // 7 steps in 8 units: it fits
  assert.deepEqual(railQuads(r.quads), [], 'no trough, no block - the main panel\'s black shows');
  const r2 = recorder();
  tallPicker().draw(r2, canvas, font());
  assert.equal(railQuads(r2.quads).length, THUMB_COLUMNS * 3, 'the three slices, StretchToFill');
  assert.equal(railQuads(r2.quads)[0].w, ICW / THUMB_COLUMNS, 'an 8-wide rail stretches the 5-wide strip');
});

test('G4-9: BOTH windows that NEST the picker forward the release, on the class that owns it', () => {
  // The wave-E lesson, kept: a forwarder on a sibling class satisfies
  // nothing. MUTANT: drop either forward - the nested picker's latch
  // then survives the button coming up.
  const bk = book(4);
  bk._openIconPicker();
  assert.equal(bk.top, 'iconPicker');
  bk._iconPicker.scrollSteps = 20;
  bk._iconPicker.click(...iconRail(30));
  assert.equal(bk._iconPicker.scroller.draggingThumb, true);
  bk.release();
  assert.equal(bk._iconPicker.scroller.draggingThumb, false, 'the spellbook forwards it while the picker is up');

  const mk = new SpellMakerWindow({ entity: { items: [], spells: [] } });
  mk._openIconPicker();
  assert.ok(mk.picker instanceof SpellIconPickerWindow);
  mk.picker.scrollSteps = 20;
  mk.picker.click(...iconRail(30));
  assert.equal(mk.picker.scroller.draggingThumb, true);
  mk.release();
  assert.equal(mk.picker.scroller.draggingThumb, false, 'and the maker forwards it from its own class');
});

test('G4-12: the hosts\' (-1,-1) SENTINEL never reaches either drag', () => {
  // ROAD-C c2 flight 2 found this pair - every host's answer for a
  // pointer OFF its letterboxed panel - driving the town map's chrome as
  // though it were a position. A thumb drag that strays into the black
  // border would be flung to row 0 the same way.
  // MUTANT: drop the `vy >= 0` guard from either window's hover.
  const w = book(40);
  w.scrollIndex = 12;
  w.click(...railPoint(50));
  w.hover(-1, -1, { buttons: 1 });
  assert.equal(w.scrollIndex, 12, 'the book ignores the fabricated point');
  assert.equal(w.scrollBar.draggingThumb, true, 'and the latch is NOT what the skip ends - release() is');
  // ...and the icon picker, from an index the fling can be seen from:
  // its thumb at scrollIndex 5 spans bar-local 44..114.4, and the
  // sentinel's -13 would pull it to -3 and clamp to the top.
  const p = tallPicker();
  p.scrollIndex = 5;
  p.click(...iconRail(60));
  assert.equal(p.scroller.draggingThumb, true);
  p.hover(-1, -1, { buttons: 1 });
  assert.equal(p.scrollIndex, 5, 'and so does the icon picker');
  assert.equal(p.scroller.draggingThumb, true);
});

// ═══════════════════════════════════════════════════════════════════
// 3. THE CHARGEN PICKER'S LATCH, AND THE HOSTS' HALF OF THE SEAM
// ═══════════════════════════════════════════════════════════════════

const CAREER = {
  name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1,
  strength: 40, intelligence: 60, willpower: 72, agility: 48,
  endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy],
  majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging],
};
const careers = () => Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: CAREER }));
const [PBX, PBY] = PICK_SCROLL_RECT;

test('G4-10: the wizard\'s picker bar releases on the edge, not on the next move', () => {
  // MUTANT: empty `ChargenFlow.releasePickBar()` - the class list then
  // jumps on the first move after the button came up, which is exactly
  // the remainder the old comment beside `hover` cited as still open.
  const f = new ChargenFlow(careers(), () => 0);
  f.state = 'class';
  f.classScroll = 5;
  assert.equal(f.pressPickBar(PBX + 2, PBY + 30), true);   // a press on the thumb
  assert.equal(f.pickBar.draggingThumb, true);
  f.releasePickBar();
  assert.equal(f.pickBar.draggingThumb, false);
  f.hover(PBX + 2, PBY + 70, { buttons: 1 });
  assert.equal(f.classScroll, 5, 'the released drag is gone, anchor and all');

  // ...and the session wrapper is the door every host already calls.
  const win = createChargenWindow({ careers: careers(), roll: () => 0 });
  assert.equal(typeof win.release, 'function', 'the overlay slot sees a release()');
  win.hover(PBX + 2, PBY + 30, { buttons: 0 });
  assert.match(read('src/systems/chargenSession.js'),
    /release\(\) \{ if \(!_fired\) flow\.releasePickBar\?\.\(\); \},/,
    'the wrapper forwards it to the flow');
});

test('G4-11: EVERY host hands its overlay slot the DOM event with the hover', () => {
  // The other half of the seam, and the half `scenes/interior.js` was
  // missing: `e.buttons & 1` is the port's only reading of
  // InputManager.GetMouseButton(0) (VerticalScrollBar.cs:105), so a host
  // that routes a bare (x, y) can latch a drag and never move it.
  // MUTANT: drop `, e` from any one route below.
  const ROUTES = [
    ['src/scenes/townTalk.js', /overlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/],
    ['src/scenes/worldModes.js', /interiorOverlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/],
    ['src/scenes/worldModes.js', /dungeonCtx\.overlayHover\?\.\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/],
    ['src/scenes/dungeonContext.js', /overlayHover\(vx, vy, e = null\) \{ activeOverlay\?\.hover\?\.\(vx, vy, e\); \},/],
    ['src/scenes/dungeon.js', /ctx\.overlayHover\?\.\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/],
    ['src/scenes/interior.js', /overlay\.hover\?\.\(v\[0\], v\[1\], e\);/],
  ];
  for (const [file, re] of ROUTES) {
    assert.match(read(file), re, `${file} drops the event from its hover route`);
  }
  // and the window under them takes it: the book's hover is the frame
  // VerticalScrollBar.Update polls.
  assert.match(read('src/ui/spellbookWindow.js'),
    /hover\(vx, vy, e = null\) \{/, 'the spellbook reads the event');
  assert.match(read('src/ui/spellIconPickerWindow.js'),
    /hover\(vx, vy, e = null\) \{/, 'and so does the icon picker');
});
