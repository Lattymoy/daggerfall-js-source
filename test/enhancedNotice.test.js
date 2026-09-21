// ENH-NOTICE1 (2026-09-21, Mac: "classic DFU has text that shows in
// the middle of the screen, instead of this, for enhanced I want a
// panel that slides in from the right side of the screen showing the
// notification. This should work for any and all mods that utilize
// this text."): THE NOTICE PANEL.
//
// The model is the box (ActionTextBox, the no-options ChoiceWindow -
// the port's two homes for DFU's click-anywhere DaggerfallMessageBox);
// what the skin changes is the paint. These drive the enhanced arm
// over the fake document test/hudtext.test.js drives its column
// through, and the classic arm over a recording renderer, and each pin
// names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawEnhancedNotice, releaseEnhancedNotice, destroyEnhancedNotice, enhancedNoticeKeys, noticeDraw, noticeKey,
  _setNoticeClockForTests, ENHANCED_NOTICE_ID, NOTICE_SLIDE_MS, NOTICE_WATCHDOG_MS, NOTICE_HINT,
} from '../src/ui/enhancedNotice.js';
import { ActionTextBox, ActionInputBox } from '../src/ui/actionText.js';
import { ChoiceWindow } from '../src/ui/talkWindow.js';
import { ENHANCED_CSS, ENHANCED_STYLE_ID } from '../src/ui/enhancedStyle.js';

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '',
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const recorder = () => ({ quads: [], drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); } });
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const CANVAS = { width: 640, height: 400 };

/** A clock the test turns by hand: every schedule() lands here with
 *  its delay, cancel() strikes it, and `fire(ms)` runs what is due. */
function fakeClock() {
  const due = [];
  let id = 0;
  _setNoticeClockForTests(
    (fn, ms) => { const t = { id: ++id, fn, ms, live: true }; due.push(t); return t; },
    (t) => { if (t) t.live = false; },
  );
  return {
    due,
    pending: () => due.filter((t) => t.live),
    fire(ms) { for (const t of due.filter((t) => t.live && t.ms === ms)) { t.live = false; t.fn(); } },
  };
}
/** The skin and the document, for one test; everything torn down after. */
const withSkin = (skin, fn, { doc = fakeDocument() } = {}) => {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  if (doc) globalThis.document = doc;
  try { return fn(doc); } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
    destroyEnhancedNotice();
    _setNoticeClockForTests((fn2, ms) => setTimeout(fn2, ms), (t) => clearTimeout(t));
  }
};
const stackOf = (doc) => doc.getElementById(ENHANCED_NOTICE_ID);
const panelsOf = (doc) => stackOf(doc)?.children ?? [];
const bodyOf = (panel) => panel.children.find((c) => c.className === 'notice-body');
const rowsOf = (panel) => bodyOf(panel).children.filter((c) => c.style.display !== 'none');
const textsOf = (panel) => rowsOf(panel).map((r) => r.textContent);

test('ENH-NOTICE1: the classic skin is untouched - ActionTextBox paints its quads and raises no DOM', () => {
  withSkin('classic', (doc) => {
    const box = new ActionTextBox(['You feel a warm glow.']);
    const r = recorder();
    box.draw(r, CANVAS, FONT, 2);
    assert.ok(r.quads.length > 0, 'mutants: the enhanced gate dropped, the classic box painting nothing');
    assert.equal(stackOf(doc), null, 'mutants: the panel raised on the classic skin too');
    assert.equal(box._noticeKey, undefined, 'mutants: a key minted on the classic skin');
    box.click();
    assert.equal(box.done, true);
  });
});

test('ENH-NOTICE1: the enhanced skin hands the rows to the panel and paints NO quads', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const box = new ActionTextBox(['You feel a warm glow.', { text: 'Your hands tingle.', center: true }]);
    const r = recorder();
    box.draw(r, CANVAS, FONT, 2);
    assert.equal(r.quads.length, 0, 'mutants: the box painting its parchment under the panel');
    const stack = stackOf(doc);
    assert.ok(stack, 'the stack is in the body');
    assert.equal(stack.parent, doc.body);
    assert.equal(stack.className, 'notice-stack');
    assert.equal(stack.attrs['aria-live'], 'polite', 'mutants: the words not read out');
    assert.ok(doc.getElementById(ENHANCED_STYLE_ID), 'mutants: the sheet not injected');
    assert.equal(panelsOf(doc).length, 1, 'one box, one panel');
    const panel = panelsOf(doc)[0];
    assert.equal(panel.dataset.owner, box._noticeKey, 'mutants: the panel not keyed to its box');
    // armed at once, after the resting style is flushed
    assert.equal(panel.className, 'notice notice-in', 'mutants: the slide-in class never set');
    assert.deepEqual(textsOf(panel), ['You feel a warm glow.', 'Your hands tingle.'], 'mutants: rows dropped, reordered');
    assert.equal(rowsOf(panel)[1].className, 'notice-row center', 'mutants: the centred row not marked');
    assert.equal(rowsOf(panel)[0].className, 'notice-row');
    const hint = panel.children.find((c) => c.className === 'notice-hint');
    assert.equal(hint?.textContent, NOTICE_HINT, 'mutants: ClickAnywhereToClose unsaid');
  });
});

test('ENH-NOTICE1: a highlight row and a tab-stopped row keep their marks and their columns', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const box = new ActionTextBox([
      { text: 'DEFAULTED', highlight: true },
      { cells: [{ text: 'Region', x: 0 }, { text: 'Daggerfall', x: 60 }] },
    ]);
    box.draw(recorder(), CANVAS, FONT, 2);
    const [hi, cells] = rowsOf(panelsOf(doc)[0]);
    assert.equal(hi.className, 'notice-row highlight', 'mutants: the caller\'s highlight lost');
    assert.equal(cells.className, 'notice-row cells');
    assert.deepEqual(cells.children.map((c) => [c.className, c.textContent]), [['notice-cell', 'Region'], ['notice-cell', 'Daggerfall']],
      'mutants: the columns flattened into one string');
    // the next frame narrows the row to one cell: the spare span hides, nothing is rebuilt
    box.lines = [{ text: 'DEFAULTED', highlight: true }, { cells: [{ text: 'Region' }] }];
    box.draw(recorder(), CANVAS, FONT, 2);
    const cells2 = rowsOf(panelsOf(doc)[0])[1];
    assert.equal(cells2, cells, 'the same node, repainted');
    assert.equal(cells2.children.length, 2);
    assert.equal(cells2.children[1].style.display, 'none', 'mutants: the stale cell still shown');
    // and a plain row after a cells row drops the spans
    box.lines = ['plain'];
    box.draw(recorder(), CANVAS, FONT, 2);
    const only = rowsOf(panelsOf(doc)[0]);
    assert.equal(only.length, 1);
    assert.equal(only[0].textContent, 'plain');
    assert.equal(only[0].children.length, 0, 'mutants: the cell spans left inside a text row');
    assert.equal(bodyOf(panelsOf(doc)[0]).children[1].style.display, 'none', 'mutants: the second row still shown');
  });
});

test('ENH-NOTICE1: dismissal slides the panel out, and the node leaves after the transition', () => {
  withSkin('enhanced', (doc) => {
    const clock = fakeClock();
    const box = new ActionTextBox(['A door.']);
    box.draw(recorder(), CANVAS, FONT, 2);
    const panel = panelsOf(doc)[0];
    box.click();
    assert.equal(box.done, true);
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: the panel still owned after the box is done');
    assert.equal(panel.className, 'notice notice-out', 'mutants: the slide-out class never set');
    assert.equal(panel.removed, undefined, 'mutants: the node yanked before the sheet could carry it out');
    assert.ok(clock.pending().some((t) => t.ms === NOTICE_SLIDE_MS), 'mutants: the removal not scheduled at the slide\'s length');
    assert.ok(!clock.pending().some((t) => t.ms === NOTICE_WATCHDOG_MS), 'mutants: the watchdog left armed on a released panel');
    // the host paints the done box one more frame: nothing is raised, nothing is painted
    const r = recorder();
    box.draw(r, CANVAS, FONT, 2);
    assert.equal(r.quads.length, 0, 'mutants: the parchment flashing on the done frame');
    assert.equal(panelsOf(doc).length, 1, 'mutants: a second panel raised for the done box');
    clock.fire(NOTICE_SLIDE_MS);
    assert.equal(panel.removed, true);
    assert.equal(stackOf(doc), null, 'mutants: the empty stack left in the body');
  });
});

test('ENH-NOTICE1: AddNextMessageBox repaints the SAME panel; only the last dismissal releases it', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const box = new ActionTextBox(['first']).addNext(['second', 'third']);
    box.draw(recorder(), CANVAS, FONT, 2);
    const panel = panelsOf(doc)[0];
    box.click();
    assert.equal(box.done, false);
    assert.equal(panel.className, 'notice notice-in', 'mutants: the chain\'s first click sliding the panel out');
    box.draw(recorder(), CANVAS, FONT, 2);
    assert.equal(panelsOf(doc)[0], panel, 'mutants: a new panel per chained box');
    assert.deepEqual(textsOf(panel), ['second', 'third']);
    box.click();
    assert.equal(box.done, true);
    assert.equal(panel.className, 'notice notice-out');
  });
});

test('ENH-NOTICE1: the watchdog - a box whose draws stop is released; a box that keeps drawing is not', () => {
  withSkin('enhanced', (doc) => {
    const clock = fakeClock();
    const box = new ActionTextBox(['gone with the scene']);
    box.draw(recorder(), CANVAS, FONT, 2);
    const first = clock.pending().filter((t) => t.ms === NOTICE_WATCHDOG_MS);
    assert.equal(first.length, 1, 'one watchdog per panel');
    box.draw(recorder(), CANVAS, FONT, 2);
    assert.equal(first[0].live, false, 'mutants: the watchdog not re-armed on the next draw');
    assert.equal(clock.pending().filter((t) => t.ms === NOTICE_WATCHDOG_MS).length, 1, 'mutants: watchdogs piling up');
    const panel = panelsOf(doc)[0];
    clock.fire(NOTICE_WATCHDOG_MS);
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: the orphaned panel kept forever (AUDIT 64 F37\'s persistent overlay)');
    assert.equal(panel.className, 'notice notice-out');
    // the box was never dismissed; a draw that returns raises it again under the same key
    box.draw(recorder(), CANVAS, FONT, 2);
    assert.equal(panelsOf(doc).length, 2, 'the old one sliding out, the new one in');
    assert.equal(panelsOf(doc)[1].dataset.owner, box._noticeKey);
  });
});

test('ENH-NOTICE1: two boxes alive at once are two panels, each its own', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const a = new ActionTextBox(['under']);
    const b = new ActionTextBox(['over']);
    a.draw(recorder(), CANVAS, FONT, 2);
    b.draw(recorder(), CANVAS, FONT, 2);
    assert.notEqual(a._noticeKey, b._noticeKey, 'mutants: one key for every box');
    assert.equal(panelsOf(doc).length, 2);
    assert.deepEqual(panelsOf(doc).map((p) => textsOf(p)), [['under'], ['over']], 'newest last');
    b.click();
    assert.equal(panelsOf(doc)[1].className, 'notice notice-out');
    assert.equal(panelsOf(doc)[0].className, 'notice notice-in', 'mutants: the other box\'s panel released with this one');
    assert.deepEqual(enhancedNoticeKeys(), [a._noticeKey]);
  });
});

test('ENH-NOTICE1: ChoiceWindow - the no-options box is the panel; a keyed menu keeps the canvas', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const notice = new ChoiceWindow({ lines: ['The shop is closed.'] });
    const r = recorder();
    notice.draw(r, CANVAS, FONT, 2);
    assert.equal(r.quads.length, 0, 'mutants: the no-options box painting under the panel');
    assert.equal(panelsOf(doc).length, 1);
    assert.deepEqual(textsOf(panelsOf(doc)[0]), ['The shop is closed.']);
    notice.click(10, 10);
    assert.equal(notice.done, true);
    assert.equal(panelsOf(doc)[0].className, 'notice notice-out', 'mutants: ChoiceWindow\'s dismissal not releasing the panel');
    // the keyed menu is a decision, not a notice
    const menu = new ChoiceWindow({ lines: ['Buy?'], options: [{ code: 'KeyY', label: 'Y - yes', action() {} }] });
    const r2 = recorder();
    menu.draw(r2, CANVAS, FONT, 2);
    assert.ok(r2.quads.length > 0, 'mutants: the menu handed to the panel');
    assert.equal(panelsOf(doc).length, 1, 'mutants: a panel for the keyed menu');
    assert.equal(menu._noticeKey, undefined);
    menu.input('Escape');
    assert.equal(menu.done, false, 'a keyed menu does not close on Escape (its law, unchanged)');
  });
});

test('ENH-NOTICE1: the input box is a decision, not a notice - it keeps its own window on the enhanced skin', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const box = new ActionInputBox(['Name?'], () => {});
    const r = recorder();
    box.draw(r, CANVAS, FONT, 2);
    assert.ok(r.quads.length > 0);
    assert.equal(stackOf(doc), null, 'mutants: the input box handed to the panel');
  });
});

test('ENH-NOTICE1: the enhanced skin OFF a document falls back to the canvas', () => {
  withSkin('enhanced', () => {
    fakeClock();
    const box = new ActionTextBox(['no DOM here']);
    const r = recorder();
    box.draw(r, CANVAS, FONT, 2);
    assert.ok(r.quads.length > 0, 'mutants: nothing painted where there is no document to paint into');
    assert.equal(drawEnhancedNotice({ rows: ['x'] }, null, 'k'), null);
    assert.equal(noticeDraw({ done: false }, ['x']), false);
  }, { doc: null });
});

test('ENH-NOTICE1: drawEnhancedNotice - visible:false hides without releasing; an empty frame for no panel raises nothing', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    assert.equal(drawEnhancedNotice({ rows: [] }, doc, 'k'), null, 'mutants: an empty panel raised');
    assert.equal(stackOf(doc), null);
    const host = drawEnhancedNotice({ rows: ['a', 'b'] }, doc, 'k');
    assert.equal(host.style.display, '');
    drawEnhancedNotice({ rows: ['a', 'b'], visible: false }, doc, 'k');
    assert.equal(host.style.display, 'none', 'mutants: visible:false ignored');
    assert.deepEqual(enhancedNoticeKeys(), ['k'], 'mutants: hiding released the panel');
    drawEnhancedNotice({ rows: ['a'] }, doc, 'k');
    assert.equal(host.style.display, '');
    assert.deepEqual(textsOf(host), ['a'], 'mutants: the stale second row still shown');
    releaseEnhancedNotice('k');
    releaseEnhancedNotice('k');   // twice is harmless
    assert.deepEqual(enhancedNoticeKeys(), []);
    assert.equal(noticeKey('p').startsWith('p'), true);
  });
});

test('ENH-NOTICE1: the sheet - right edge, pointer-transparent, a slide the module\'s clock matches', () => {
  const stack = /\.notice-stack \{([^}]*)\}/.exec(ENHANCED_CSS)?.[1] ?? '';
  assert.match(stack, /position: fixed; right: 0;/, 'mutants: the stack not pinned to the right edge');
  assert.match(stack, /pointer-events: none/, 'mutants: the panel eating the click that dismisses the box');
  assert.match(stack, /z-index: 30/);
  const panel = /\n\.notice \{([^}]*)\}/.exec(ENHANCED_CSS)?.[1] ?? '';
  assert.match(panel, /transform: translateX\(110%\)/, 'mutants: the panel resting on screen before its slide');
  assert.match(panel, new RegExp(`transition: transform ${NOTICE_SLIDE_MS}ms`), 'mutants: the sheet\'s slide and the module\'s removal out of step');
  assert.match(ENHANCED_CSS, /\.notice\.notice-in \{ transform: translateX\(0\)/);
  assert.match(ENHANCED_CSS, /\.notice\.notice-out \{ transform: translateX\(110%\)/);
  assert.match(ENHANCED_CSS, /\.notice-row\.highlight \{ color: var\(--blood\)/);
  assert.match(ENHANCED_CSS, /\.notice-row\.cells \{ display: flex/);
  assert.ok(NOTICE_WATCHDOG_MS > NOTICE_SLIDE_MS, 'a watchdog shorter than the slide would chase its own tail');
});
