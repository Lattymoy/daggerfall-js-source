// ENH-NOTICE1 (2026-09-21, Mac: "classic DFU has text that shows in
// the middle of the screen, instead of this, for enhanced I want a
// panel that slides in from the right side of the screen showing the
// notification. This should work for any and all mods that utilize
// this text."): THE NOTICE PANEL.
//
// The model is the box (ActionTextBox, the no-options ChoiceWindow -
// the port's two homes for DFU's click-anywhere DaggerfallMessageBox);
// what the skin changes is the paint. These drive the enhanced arm
// over the fake document test/hudtext.test.js drives its toasts
// through, and the classic arm over a recording renderer, and each pin
// names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawEnhancedNotice, releaseEnhancedNotice, destroyEnhancedNotice, enhancedNoticeKeys, noticeDraw, noticeKey,
  noticeHold, drawEnhancedToasts, releaseEnhancedToasts, enhancedToastOwners,
  _setNoticeClockForTests, ENHANCED_NOTICE_ID, NOTICE_SLIDE_MS, NOTICE_WATCHDOG_MS, NOTICE_HINT,
} from '../src/ui/enhancedNotice.js';
import { ActionTextBox, ActionInputBox } from '../src/ui/actionText.js';
import { enhancedInputBoxOwner } from '../src/ui/enhancedInputBox.js';   // AUDIT HCC U5
import { StatusReadout } from '../src/ui/statusBox.js';   // STATUS-LIVE: the one box whose caption is not ClickAnywhereToClose
import { ChoiceWindow } from '../src/ui/talkWindow.js';
import { ENHANCED_CSS, ENHANCED_STYLE_ID } from '../src/ui/enhancedStyle.js';

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '',
    style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = n.children.indexOf(ref); if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); },
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
  // PLUS-DEFAULT: these pins read plain Enhanced's slide; Plus's toast fade is hudtext.test.js's
  globalThis.location = { search: `?skin=${skin}${skin === 'enhanced' ? '&plus=0' : ''}` };
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
    assert.equal(stackOf(doc), null, 'mutants: the input box handed to the panel');
    // AUDIT HCC U5: its own window is the skin's face now (ui/enhancedInputBox.js), not the parchment's quads
    assert.equal(r.quads.length, 0, 'mutants: the parchment painted under the enhanced window');
    assert.equal(enhancedInputBoxOwner(), box._faceKey, 'the field stands in its own window');
    box.input('Escape');
    assert.equal(enhancedInputBoxOwner(), null, 'and leaves with the box');
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
  assert.match(stack, /z-index: 31/);   // AUDIT ENH-NOTICE3 A7: off the tie with the update scrim at 30
  assert.match(stack, /max-height: 90vh; overflow: hidden;/, 'AUDIT ENH-NOTICE3 A1: what will not fit is clipped, not spilled off the screen');
  const panel = /\n\.notice \{([^}]*)\}/.exec(ENHANCED_CSS)?.[1] ?? '';
  assert.match(panel, /transform: translateX\(110%\)/, 'mutants: the panel resting on screen before its slide');
  assert.match(panel, new RegExp(`transition: transform ${NOTICE_SLIDE_MS}ms`), 'mutants: the sheet\'s slide and the module\'s removal out of step');
  assert.match(ENHANCED_CSS, /\.notice\.notice-in \{ transform: translateX\(0\)/);
  assert.match(ENHANCED_CSS, /\.notice\.notice-out \{ transform: translateX\(110%\)/);
  assert.match(ENHANCED_CSS, /\.notice-row\.highlight \{ color: var\(--blood\)/);
  assert.match(ENHANCED_CSS, /\.notice-row\.cells \{ display: flex/);
  assert.ok(NOTICE_WATCHDOG_MS > NOTICE_SLIDE_MS, 'a watchdog shorter than the slide would chase its own tail');
});

// ── ENH-NOTICE2: THE WINDOWS' OWN BOXES ──────────────────────────────
// Eight classic windows drawn on both skins raise DFU's click-anywhere
// box from inside themselves and paint it as their own parchment (a
// host holds one overlay slot, so they do not push an ActionTextBox).
// `noticeFrame` is their seam: rows while such a box is up, null when
// none - or when the box up is a decision or a field.
import { readFileSync, readdirSync } from 'node:fs';
import { noticeFrame, noticeRelease } from '../src/ui/enhancedNotice.js';
import { GuildServiceWindow, _setGuildServiceArtForTests } from '../src/ui/guildServiceWindow.js';
import { CovenWindow, _setCovenArtForTests } from '../src/ui/covenWindow.js';
import { ServiceFlowWindow } from '../src/ui/guildServiceWindows.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const artRecorder = () => ({ quads: [], uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); } });
const IMG = { tex: 't', w: 130, h: 51 };
const NATIVE = { width: 320, height: 200 };

test('ENH-NOTICE2: noticeFrame - rows raise the owner\'s panel, null releases it, the classic skin mints nothing', () => {
  withSkin('classic', (doc) => {
    const w = {};
    assert.equal(noticeFrame(w, ['x']), false, 'mutants: the classic window handed to the panel');
    assert.equal(w._noticeKey, undefined);
    assert.equal(stackOf(doc), null);
  });
  withSkin('enhanced', (doc) => {
    fakeClock();
    const w = {};
    assert.equal(noticeFrame(w, [{ text: 'a refusal', center: true }]), true);
    assert.ok(w._noticeKey, 'mutants: no key for the window');
    assert.deepEqual(textsOf(panelsOf(doc)[0]), ['a refusal']);
    assert.equal(noticeFrame(w, ['a refusal', 'more']), true, 'the same panel, repainted');
    assert.equal(panelsOf(doc).length, 1);
    assert.equal(noticeFrame(w, null), false, 'mutants: null taking the frame');
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: null not releasing');
    assert.equal(panelsOf(doc)[0].className, 'notice notice-out');
    noticeRelease(w); noticeRelease({});   // twice, and for an owner that never drew: harmless
    assert.equal(noticeFrame(w, ['again']), true, 'the same owner raises a fresh panel after a release');
    assert.deepEqual(enhancedNoticeKeys(), [w._noticeKey]);
  });
});

test('ENH-NOTICE2: the guild service window - a text step is the panel, the Yes/No step that follows takes it down', () => {
  _setGuildServiceArtForTests({ base: IMG, member: IMG });
  try {
    withSkin('enhanced', (doc) => {
      fakeClock();
      let n = 0;
      const w = new GuildServiceWindow({
        member: () => true, service: () => 'Training',
        steps: () => [{ textId: 7, clickAnywhere: true }, { textId: 8, buttons: 'YesNo', onYes: () => {}, closesWindow: true }],
        rows: (id) => [{ text: `[${id}] variant ${++n}`, center: true }],
      });
      const r = artRecorder();
      for (let i = 0; i < 3; i++) w.draw(r, NATIVE, FONT);
      assert.equal(w._box, null, 'mutants: the parchment laid out under the panel');
      assert.equal(panelsOf(doc).length, 1);
      assert.deepEqual(textsOf(panelsOf(doc)[0]), ['[7] variant 1'], 'BOX1 still holds: one read over three frames');
      assert.equal(n, 1);
      w.click(10, 10);   // click-anywhere: the next box
      w.draw(r, NATIVE, FONT);
      assert.ok(w._box, 'the Yes/No box is the parchment');
      assert.equal(panelsOf(doc)[0].className, 'notice notice-out', 'mutants: the text step\'s panel outliving it under the decision');
      assert.deepEqual(enhancedNoticeKeys(), []);
      w.input('KeyY');
      assert.equal(w.done, true);
    });
    // the classic skin: untouched
    withSkin('classic', (doc) => {
      const w = new GuildServiceWindow({ member: () => true, service: () => 'Training',
        steps: () => [{ textId: 7, clickAnywhere: true }], rows: () => [{ text: 'x', center: true }] });
      w.draw(artRecorder(), NATIVE, FONT);
      assert.ok(w._box, 'mutants: the classic parchment gone');
      assert.equal(stackOf(doc), null);
    });
  } finally { _setGuildServiceArtForTests(null); }
});

test('ENH-NOTICE2: the coven - the same seam; closing the window takes the panel with it', () => {
  _setCovenArtForTests({ base: IMG });
  try {
    withSkin('enhanced', (doc) => {
      fakeClock();
      const w = new CovenWindow({ rows: (id) => [{ text: `coven ${id}`, center: true }], onSummon: () => ({ textId: 9 }), onTalk: () => {}, onClose: () => {} });
      w.boxes.push({ textId: 3, closesWindow: true });
      const r = artRecorder();
      w.draw(r, NATIVE, FONT);
      assert.equal(w._box, null);
      assert.deepEqual(textsOf(panelsOf(doc)[0]), ['coven 3']);
      w.click(10, 10);   // click-anywhere on a closesWindow box: the window closes
      assert.equal(w.done, true);
      assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: _close not releasing - the host drops the window and never draws it again');
      assert.equal(panelsOf(doc)[0].className, 'notice notice-out');
    });
  } finally { _setCovenArtForTests(null); }
});

test('ENH-NOTICE2: the service flow - plain text steps ride the panel in place, a picker or a field step releases it, the last step\'s close releases it', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const w = new ServiceFlowWindow([
      { rows: [{ text: 'welcome' }] },
      { rows: [{ text: 'and then' }], buttons: 'YesNo', onYes: () => null, onNo: () => null },
    ]);
    const r = recorder();
    w.draw(r, NATIVE, FONT);
    assert.equal(r.quads.length, 0, 'mutants: the parchment painted under the panel');
    assert.equal(w._box, null);
    assert.deepEqual(textsOf(panelsOf(doc)[0]), ['welcome']);
    w.click(0, 0);   // click-anywhere advances
    w.draw(r, NATIVE, FONT);
    assert.ok(w._box, 'the Yes/No step is the parchment');
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: the decision not releasing the text step\'s panel');
    w.input('KeyN');
    assert.equal(w.done, true);
    // a field step after a text step
    const w2 = new ServiceFlowWindow([{ rows: [{ text: 'how much?' }] }, { rows: [], field: { label: 'x' }, onInput: () => null }]);
    w2.draw(r, NATIVE, FONT);
    assert.equal(enhancedNoticeKeys().length, 1);
    w2.click(0, 0);
    w2.draw(r, NATIVE, FONT);
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: the field step keeping the text panel up');
    // the last text step closes the window: the panel goes with it, before any watchdog
    const w3 = new ServiceFlowWindow([{ rows: [{ text: 'farewell' }] }]);
    w3.draw(r, NATIVE, FONT);
    assert.equal(enhancedNoticeKeys().length, 1);
    w3.click(0, 0);
    assert.equal(w3.done, true);
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutants: _close not releasing');
  });
});

test('ENH-NOTICE2: THE ROSTER - the eight windows drawn on both skins that raise their own click-anywhere box, and (ENH-NOTICE3) the model, the three DOM windows and the hunt - no more and no fewer', () => {
  const ROSTER = ['potionMakerWindow', 'itemMakerWindow', 'spellMakerWindow', 'bankWindow', 'restWindow', 'covenWindow', 'guildServiceWindow', 'guildServiceWindows'];
  for (const f of ROSTER) {
    const src = rd(`src/ui/${f}.js`);
    assert.match(src, /import \{ noticeFrame, noticeRelease \} from '\.\/enhancedNotice\.js'/, `${f}: the seam not imported`);
    assert.match(src, /noticeFrame\(this, /, `${f}: draw does not decide the frame`);
    assert.match(src, /_close\(\) \{[^}]*noticeRelease\(this\)/, `${f}: _close does not release - the host drops the window and never draws it again`);
  }
  // nobody else imports the seam: the two homes take noticeDraw; the
  // PopupText model takes drawEnhancedToasts (ENH-NOTICE3 - the HUD line
  // as a toast); the DOM-native windows that raise a box of their own
  // take noticeHold; the hunt window's busy page takes noticeFrame.
  const importers = readdirSync(new URL('../src/ui/', import.meta.url)).filter((f) => f.endsWith('.js') && /from '\.\/enhancedNotice\.js'/.test(rd(`src/ui/${f}`))).map((f) => f.replace(/\.js$/, '')).sort();
  assert.deepEqual(importers, [...ROSTER, 'actionText', 'talkWindow', 'hudText', 'enhancedTavern', 'enhancedInventory', 'heldMap', 'huntWindow'].sort());
});

// ── ENH-NOTICE3 (2026-09-21, Mac: "All mods, including climates and
// calories need to utilize the enhanced notification popup") - THE
// SAME STACK CARRIES THE HUD LINE, AND A DOM WINDOW HOLDS A PANEL ────
//
// The toasts' laws as HudText drives them are pinned where the model
// is (test/hudtext.test.js); these are the module's own two doors.

test('ENH-NOTICE3: noticeHold - a DOM window\'s box is HELD with no watchdog until it releases; null releases; the classic skin mints nothing', () => {
  withSkin('enhanced', (doc) => {
    const clock = fakeClock();
    const win = {};
    assert.equal(noticeHold(win, ['You cannot carry any more.']), true);
    assert.equal(panelsOf(doc).length, 1);
    assert.equal(bodyOf(panelsOf(doc)[0]).children[0].textContent, 'You cannot carry any more.');
    assert.equal(panelsOf(doc)[0].className, 'notice notice-in', 'a box the window keeps the dismissal of - the hint and the edge are the box\'s');
    assert.equal(clock.pending().length, 0,
      'mutants: the watchdog armed on a held panel, so a DOM window\'s box - which draws no frame - slides out on its own after NOTICE_WATCHDOG_MS');
    // repainted in place - a second hold is the same panel
    noticeHold(win, ['You cannot carry any more.', 'Drop something first.']);
    assert.equal(panelsOf(doc).length, 1, 'mutant: a second hold raises a second panel');
    assert.equal(bodyOf(panelsOf(doc)[0]).children.length, 2);
    // null releases; so does noticeRelease
    assert.equal(noticeHold(win, null), false);
    assert.equal(panelsOf(doc)[0].className, 'notice notice-out', 'mutant: null does not release');
    clock.fire(NOTICE_SLIDE_MS);
    assert.equal(stackOf(doc), null);
    noticeHold(win, ['again']);
    noticeRelease(win);
    assert.equal(panelsOf(doc)[0].className, 'notice notice-out', 'mutant: noticeRelease does not know a held owner');
  });
  withSkin('classic', (doc) => {
    const win = {};
    assert.equal(noticeHold(win, ['You cannot carry any more.']), false, 'the classic skin: the window paints its own card');
    assert.equal(stackOf(doc), null);
    assert.equal(win._noticeKey, undefined, 'no key minted for a panel that was never raised');
  });
});

test('ENH-NOTICE3: drawEnhancedToasts - one panel per row id under the owner, released when the row leaves the frame, hidden as one, disposed as one', () => {
  withSkin('enhanced', (doc) => {
    const clock = fakeClock();
    const out = drawEnhancedToasts({ rows: ['a', 'b'], ids: [1, 2] }, doc, 'town1');
    assert.equal(out.length, 2);
    assert.deepEqual(out.map((p) => p.dataset.owner), ['town1:1', 'town1:2']);
    assert.deepEqual(out.map((p) => p.className), ['notice notice-toast notice-in', 'notice notice-toast notice-in']);
    assert.equal(out[0].children.find((c) => c.className === 'notice-hint'), undefined, 'mutant: a hint on a toast');
    assert.equal(drawEnhancedToasts({ rows: [], ids: [] }, doc, 'dungeon1').length, 0, 'silence from another owner builds nothing');
    // the front row pops: its toast alone slides out
    drawEnhancedToasts({ rows: ['b'], ids: [2] }, doc, 'town1');
    assert.equal(out[0].className, 'notice notice-toast notice-out', 'mutants: the popped row left standing; the class dropped on release');
    assert.equal(out[1].className, 'notice notice-toast notice-in', 'mutant: every toast released on a pop (index keys)');
    clock.fire(NOTICE_SLIDE_MS);
    assert.ok(out[0].removed);
    // hidden as one, with an EMPTY frame (HudText.hide's shape) - not released
    drawEnhancedToasts({ rows: [], ids: [], visible: false }, doc, 'town1');
    assert.equal(out[1].style.display, 'none', 'mutant: an empty hidden frame treated as "all popped" - the rows slide out and re-slide in when the HUD returns');
    assert.equal(out[1].className, 'notice notice-toast notice-in');
    drawEnhancedToasts({ rows: ['b'], ids: [2] }, doc, 'town1');
    assert.equal(out[1].style.display, '');
    // the watchdog still guards a model whose host stopped drawing
    assert.ok(clock.pending().some((t) => t.ms === NOTICE_WATCHDOG_MS), 'a toast is drawn per frame, so silence releases it');
    // disposed as one
    drawEnhancedToasts({ rows: ['c'], ids: [1] }, doc, 'dungeon1');
    releaseEnhancedToasts('town1');
    assert.equal(out[1].className, 'notice notice-toast notice-out', 'mutant: dispose a no-op');
    assert.deepEqual(enhancedNoticeKeys(), ['dungeon1:1'], 'and it takes only its own');
  });
});

test('ENH-NOTICE3 (AUDIT): a box raised over toasts stands ABOVE them - the panel the player must answer reads first', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    drawEnhancedToasts({ rows: ['a', 'b'], ids: [1, 2] }, doc, 'town1');
    drawEnhancedNotice({ rows: ['The door is locked.'] }, doc, 'box1');
    assert.deepEqual(panelsOf(doc).map((p) => p.dataset.owner), ['box1', 'town1:1', 'town1:2'],
      'mutant: the box appended at the foot, under four skill-ups the player is not waiting on');
    // a toast that joins later still goes to the foot, under the box
    drawEnhancedToasts({ rows: ['a', 'b', 'c'], ids: [1, 2, 3] }, doc, 'town1');
    assert.deepEqual(panelsOf(doc).map((p) => p.dataset.owner), ['box1', 'town1:1', 'town1:2', 'town1:3']);
    // and a second box goes in front of the toasts, behind the first box
    drawEnhancedNotice({ rows: ['Another.'] }, doc, 'box2');
    assert.deepEqual(panelsOf(doc).map((p) => p.dataset.owner), ['box1', 'box2', 'town1:1', 'town1:2', 'town1:3'],
      'boxes keep their raising order among themselves');
  });
});

test('ENH-NOTICE3 (AUDIT B2-B4): THE HINT TELLS THE TRUTH - the default is the box\'s, a window whose box clears on its own terms passes false or its own caption, a toast never carries one', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    const box = {}; const inv = {}; const hunt = {};
    noticeHold(box, ['The door is locked.']);
    noticeHold(inv, ['You cannot carry any more.'], { hint: false });
    assert.equal(noticeFrame(hunt, ['You search...'], { hint: 'Escape to walk away' }), true);
    const hints = panelsOf(doc).map((p) => p.children.find((c) => c.className === 'notice-hint')?.textContent ?? null);
    assert.deepEqual(hints, [NOTICE_HINT, null, 'Escape to walk away'],
      'mutants: the option ignored (a refusal nothing dismisses promising "click or press a key"); the caption not the window\'s own');
    // a caption can change under the same owner (a page whose key changes)
    noticeFrame(hunt, ['You search...'], { hint: 'Any key' });
    assert.equal(panelsOf(doc)[2].children.find((c) => c.className === 'notice-hint').textContent, 'Any key');
    drawEnhancedToasts({ rows: ['a'], ids: [1] }, doc, 'town1');
    assert.equal(panelsOf(doc).at(-1).children.find((c) => c.className === 'notice-hint'), undefined, 'a toast is never dismissed');
  });
});

test('STATUS-LIVE: the BOX carries its own caption to the panel, and the status readout is the one that does', () => {
  withSkin('enhanced', (doc) => {
    fakeClock();
    // the ordinary box is untouched: ClickAnywhereToClose, said the
    // enhanced way, is still what a message box promises
    const plain = new ActionTextBox(['A quest speaks.']);
    plain.draw(recorder(), CANVAS, FONT, 2);
    // ...and the readout, which a click does NOT close (the world is
    // running under it), says what does. Driven through the real draw,
    // because the hint reaching the PANEL is the thing that matters -
    // a caption held on the box and never painted is a caption nobody
    // can read.
    const readout = new StatusReadout(['You are healthy.']);
    readout.draw(recorder(), CANVAS, FONT, 2);
    const hints = panelsOf(doc).map((p) => p.children.find((c) => c.className === 'notice-hint')?.textContent ?? null);
    assert.deepEqual(hints, [NOTICE_HINT, readout.noticeHint],
      'mutants: noticeDraw dropping the box\'s hint, so the readout promises a click it declines');
    assert.match(readout.noticeHint, /ESC to close$/);
    assert.notEqual(readout.noticeHint, NOTICE_HINT);
    // and the rows really are the readout's, on the panel, not on a canvas
    const rows = panelsOf(doc).at(-1).children.find((c) => c.className === 'notice-body').children.map((r) => r.textContent);
    assert.deepEqual(rows, ['You are healthy.']);
  });
});

test('ENH-NOTICE3 (AUDIT A2): a toast the WATCHDOG sweeps leaves its owner\'s id set too; a row popped while COVERED is released, and a row that arrives covered is not counted', () => {
  withSkin('enhanced', (doc) => {
    const clock = fakeClock();
    drawEnhancedToasts({ rows: ['a', 'b'], ids: [1, 2] }, doc, 'town1');
    assert.deepEqual(enhancedToastOwners(), ['town1']);
    // the draws stop (a backgrounded tab, a host gone without dispose): the watchdog sweeps
    clock.fire(NOTICE_WATCHDOG_MS);
    clock.fire(NOTICE_SLIDE_MS);
    assert.deepEqual(enhancedNoticeKeys(), [], 'the panels went');
    assert.deepEqual(enhancedToastOwners(), [], 'mutant: the owner\'s set outlives its panels - garbage per abandoned model, and a resumed draw counting rows it has no panel for');
    // a row popped while the frame is COVERED: released, not merely hidden
    drawEnhancedToasts({ rows: ['a', 'b'], ids: [1, 2] }, doc, 'town1');
    drawEnhancedToasts({ rows: ['b'], ids: [2], visible: false }, doc, 'town1');
    assert.equal(panelsOf(doc).find((p) => p.dataset.owner === 'town1:1')?.className, 'notice notice-toast notice-out',
      'mutant: a hidden frame treated as a hide of everything, so a popped row keeps a hidden panel forever');
    assert.equal(panelsOf(doc).find((p) => p.dataset.owner === 'town1:2')?.style.display, 'none', 'the row still queued is hidden, not released');
    // a row that ARRIVES covered builds no panel and is not counted as the owner's
    drawEnhancedToasts({ rows: ['b', 'c'], ids: [2, 3], visible: false }, doc, 'town1');
    assert.equal(panelsOf(doc).find((p) => p.dataset.owner === 'town1:3'), undefined, 'no panel for an invisible arrival');
    // ...and it is not RECORDED as the owner's either: a model whose
    // every row arrived covered owns nothing, so the set does not
    // outlive it (mutant: the id counted although no panel was built).
    drawEnhancedToasts({ rows: ['x'], ids: [1], visible: false }, doc, 'dungeon9');
    assert.deepEqual(enhancedToastOwners(), ['town1'], 'mutant: an owner recorded for rows that never became panels');
    drawEnhancedToasts({ rows: ['b', 'c'], ids: [2, 3] }, doc, 'town1');
    assert.equal(panelsOf(doc).find((p) => p.dataset.owner === 'town1:3')?.className, 'notice notice-toast notice-in', 'and it slides in when the cover lifts');
  });
});
