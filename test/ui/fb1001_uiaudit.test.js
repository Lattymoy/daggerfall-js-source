// AUDIT 2026-10-01 part five (Mac: "audit this") - ORBIT-FREE and CURSOR-EDGE. Real-cursor checks ran in Chromium under
// Xvfb (the X server's cursor read back through XFixes). Both fixes hold for what was reported; and:
//   UI1 the classic skin never lays ENHANCED_CSS, so its scrollers - the chat (it mounts on either skin), the social
//       panel, the profile, the decorator - kept native bars, the OS arrow over them: the document cursor now brings
//       the dress itself (ui/cursor.js CURSOR_SCROLLBAR_CSS);
//   UI2 the unscoped dress turned a touch screen's invisible overlay scrollbar into a standing 10 px bar (the front
//       page 915 px wide to 905) - for a pointer device only now;
//   UI3 the classic arrow's sizing was pinned by its source text alone (a fixed 2x again, the whole image drawn, the
//       full size, a moved hotspot all passed) - pinned on the real canvas path; CLASSIC-CURSOR (FIELD BUGS 2026-10-03)
//       made the arrow DFU's own Cursor2.png, laid as a rule, so the pin reads the rule;
//   UI4 ORBIT-FREE's leftward drift, the freeing move's own along-lock travel and a fresh drag's clean start - unpinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installCursor, CLASSIC_CURSOR_STYLE_ID } from '../../src/ui/cursor.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

/** installCursor over a fake document (CLASSIC-CURSOR, FIELD BUGS 2026-10-03: DFU's own arrow, laid as a rule - no game
 *  data, no canvas). */
function install(head = [], opts = { classic: true }) {
  const doc = { head: { append: (el) => head.push(el) }, getElementById: (id) => head.find((e) => e.id === id) ?? null, createElement: () => ({}) };
  const ok = installCursor(doc, opts);
  installCursor(doc, opts);
  return { ok, head };
}

test('AUDIT UI1: the classic cursor brings its own scrollbar dress - once, unscoped, for a pointer device - so the classic skin\'s chat and panels keep the arrow over their bars (mutant: none laid)', () => {
  const { ok, head } = install();
  assert.ok(ok);
  const bars = head.filter((e) => /::-webkit-scrollbar/.test(e.textContent));
  assert.equal(bars.length, 1, 'laid once, however often the cursor is installed');
  const css = bars[0].textContent;
  assert.match(css, /@media \(any-pointer: fine\)\s*\{\s*::-webkit-scrollbar\s*\{[^}]*width:\s*\d+px/);
  assert.doesNotMatch(css, /scrollbar-(color|width)\s*:/, 'never the standard pair, which turns the dress off');
});

test('AUDIT UI2: the enhanced sheet\'s unscoped dress is a pointer device\'s - a touch screen keeps its overlay scrollbar (mutant: the media gate dropped)', () => {
  assert.match(ENHANCED_CSS, /@media \(any-pointer: fine\)[^{]*\{[^{]*::-webkit-scrollbar\s*\{[^}]*width:\s*10px/);
  const outside = ENHANCED_CSS.replace(/@media \(any-pointer: fine\)[^{]*\{[^{]*::-webkit-scrollbar\s*\{[^}]*\}\s*\}/, '');
  assert.doesNotMatch(outside, /(^|\})\s*::-webkit-scrollbar\s*\{[^}]*width/m, 'no other unscoped width');
});

test('AUDIT UI3 / CLASSIC-CURSOR: the classic arrow is DFU\'s own default cursor, its hotspot (0,0), worn over every element (a panel\'s own pointer never shows the OS hand), a text field\'s caret and a pad-hidden canvas apart; once; not on Enhanced Plus (mutants: the hotspot moved; the rule not !important; the caret lost; laid on Plus)', () => {
  const { ok, head } = install();
  assert.ok(ok);
  const rules = head.filter((e) => e.id === CLASSIC_CURSOR_STYLE_ID);
  assert.equal(rules.length, 1, 'laid once');
  const css = rules[0].textContent;
  assert.match(css, /html, html \*, html \*::before, html \*::after \{ cursor: url\("[^"]*art\/dfu-cursor\/Cursor2\.png"\) 0 0, auto !important; \}/);
  assert.match(css, /html canvas\[style\*="cursor: none"\] \{ cursor: none !important; \}/);
  assert.match(css, /html textarea, html \[contenteditable="true"\] \{ cursor: text !important; \}/);
  assert.deepEqual(install([], { classic: false }), { ok: false, head: [] }, 'Enhanced Plus wears its gauntlet');
});

/** test/ui/fb1001_orbitfree.test.js's rig, but ONE window across several drags. */
function rig() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [], className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  globalThis.document = { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
    woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
  });
  const got = [];
  win._phase = 'map'; win._paperPoint = (x, y) => [x, y];
  Object.defineProperty(win, '_sheet', { value: { solid: true, orbitHold() {}, orbitFrom() {}, orbitBy: (dx, dy) => got.push([dx, dy]) } });
  return { stage: win._chrome.stage, got, done: () => { win.dispose?.(); delete globalThis.document; } };
}
const fire = (n, type, e) => { for (const [t, fn] of n.listeners ?? []) if (t === type) fn(e); };
const mouse = (o) => ({ pointerId: 1, pointerType: 'mouse', preventDefault() {}, stopPropagation() {}, ...o });
const sum = (got) => got.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
const drag = (stage, path) => {
  fire(stage, 'pointerdown', mouse({ button: 2, buttons: 2, clientX: 100, clientY: 100 }));
  for (const [x, y] of path) fire(stage, 'pointermove', mouse({ buttons: 2, clientX: x, clientY: y }));
  fire(stage, 'pointerup', mouse({ button: 2, buttons: 0 }));
};

test('AUDIT UI4: ORBIT-FREE - a LEFTWARD turn forgives its drift as a rightward one does; the freeing move spends its own along-lock travel; one drag\'s held-back travel never starts the next (mutants: a signed `on`; the move\'s own travel dropped; `off` kept across drags)', () => {
  const r = rig();
  try {
    const p = [[90, 100]];
    for (let i = 1; i <= 15; i++) p.push([90 - 20 * i, 100 + 4 * i]);
    drag(r.stage, p);
    assert.deepEqual(sum(r.got), [-310, 0], 'a leftward sweep that drifts down never tilts');
    r.got.length = 0;
    drag(r.stage, [[110, 100], [130, 100], [145, 140]]);
    assert.deepEqual(r.got.at(-1), [15, 32.5], 'the move that frees turns by its own 15 and tilts by the 32.5 held');
    r.got.length = 0;
    drag(r.stage, [[110, 100], [130, 100], [130, 122]]);   // holds 22 back - under the bar
    r.got.length = 0;
    drag(r.stage, [[110, 100], [110, 110]]);   // a fresh drag: 10 across (it locks to a turn), then 10 down
    assert.deepEqual(sum(r.got), [10, 0], 'the last drag\'s 22 held back is not this one\'s');
  } finally { r.done(); }
});
