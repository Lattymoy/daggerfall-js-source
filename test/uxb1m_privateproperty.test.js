// UXB1-M (2026-09-25, the UX backlog: "Private Property uses daggerfall's default Y/N prompt. Make the options
// clickable at least or convert to new UI.").
//
// THE ROOT CAUSE, found by driving the box: the options WERE clickable - in the wrong place. ChoiceWindow's click
// bands were [ty - lineH, ty) for a row whose glyphs start AT ty, so every band covered the row above its label: on
// the private-property box a click on the blank spacer answered Yes, a click on "Y - yes" answered No, and "N - no"
// answered nothing. Every keyed menu (the anchor prompt, the surrender, the repair interrupt, townTalk's lists) had it.
//
// And the box was never DFU's. PlayerActivate raises CommonMessageBoxButtons.YesNo (PlayerActivate.cs:916-918): the
// record on the parchment, BUTTONS.RCI's Yes and No under it, Y and N as hotkeys, Return pressing the default No,
// Escape doing nothing. ui/yesNoBox.js is that box - the parchment on the classic skin, a card with two buttons on the
// enhanced one - and the private-property arm raises it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ChoiceWindow } from '../src/ui/talkWindow.js';
import { YesNoBoxWindow, YES_NO_BOX_ID, YES_NO_LABELS, yesNoFaceOwner, releaseYesNoFace, _setYesNoClockForTests } from '../src/ui/yesNoBox.js';
import { MB_BUTTONS, _setMessageBoxArtForTests } from '../src/ui/messageBox.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { privatePropertyRows, PRIVATE_PROPERTY_FALLBACK_ROWS } from '../src/systems/shopStock.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const CANVAS = { width: 640, height: 400 };
const recorder = () => ({ quads: [], drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); } });

function fakeNode(tag) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', type: '',
    style: {}, attrs: {}, onclick: null,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { createElement: (t) => fakeNode(t) };
  doc.head = fakeNode('head'); doc.body = fakeNode('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };
/** The skin (uiSkin reads ?skin) and a document, for one test. */
function withSkin(skin, fn) {
  const hadLoc = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search: `?skin=${skin}` };
  const doc = fakeDocument();
  globalThis.document = doc;
  try { return fn(doc); } finally {
    if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
}
/** The native point at the vertical middle of a keyed menu's row `i` (its glyphs start at the row's ty). */
function rowPoint(w, i, s) {
  const m = nativeMetrics(CANVAS);
  const ty = w._hitBox.y + 12 * s + i * 12 * s;
  const px = w._hitBox.x + 20 * s, py = ty + 3 * s;
  return [(px - m.ox) / m.s, (py - m.oy) / m.s];
}

test('UXB1-M: a keyed menu\'s rows answer WHERE THEY ARE DRAWN - "Y - yes" is Yes, "N - no" is No, the blank spacer is nothing', () => {
  const s = nativeMetrics(CANVAS).s;
  const got = [];
  const menu = () => new ChoiceWindow({ lines: ['This looks like private property.'], options: [
    { code: 'KeyY', label: 'Y - yes', action: () => got.push('Y') },
    { code: 'KeyN', label: 'N - no', action: () => got.push('N') },
  ] });
  // rows: 0 the text, 1 the spacer, 2 "Y - yes", 3 "N - no"
  let w = menu(); w.draw(recorder(), CANVAS, FONT, s);
  w.click(...rowPoint(w, 2, s));
  assert.deepEqual(got, ['Y'], 'a click on "Y - yes" answers Yes (it answered No)');
  w = menu(); w.draw(recorder(), CANVAS, FONT, s);
  w.click(...rowPoint(w, 3, s));
  assert.deepEqual(got, ['Y', 'N'], 'a click on "N - no" answers No (it answered nothing)');
  w = menu(); w.draw(recorder(), CANVAS, FONT, s);
  assert.equal(w.click(...rowPoint(w, 1, s)), true, 'swallowed');
  assert.deepEqual(got, ['Y', 'N'], 'the spacer answers nothing (it answered Yes)');
  assert.equal(w.done, false);
  // the bands tile the rows: each one lineH tall, the second starting where the first ends
  const [a, b] = w._hitRows;
  assert.equal(a.y1 - a.y0, 12 * s);
  assert.equal(b.y0, a.y1);
});

test('UXB1-M: DFU\'s YesNo keys - Y yes, N no, Return the DEFAULT (No), Escape nothing (a box with buttons cannot be cancelled); one answer', () => {
  const got = [];
  const box = () => new YesNoBoxWindow({ rows: ['Q?'], onYes: () => got.push('yes'), onNo: () => got.push('no') });
  let b = box(); b.input('KeyY'); assert.deepEqual(got, ['yes']); assert.equal(b.done, true);
  b.input('KeyN'); assert.deepEqual(got, ['yes'], 'answered once');
  b = box(); b.input('KeyN'); assert.deepEqual(got, ['yes', 'no']);
  b = box(); b.input('Enter'); assert.deepEqual(got, ['yes', 'no', 'no'], 'Return presses No (AddButton(No, true), :631)');
  b = box(); b.input('Escape'); b.input('back');
  assert.equal(b.done, false, 'AllowCancel = false (:383)');
  b.input('KeyY', { shiftKey: true });
  assert.equal(b.done, false, 'Shift-Y is not the shortcut (CheckSetModifiers)');
  assert.equal(b.isChoiceWindow, true, 'the hosts route it raw codes');
});

test('UXB1-M: the CLASSIC box is DFU\'s parchment with BUTTONS.RCI\'s Yes and No, pressed through messageBoxHit', () => {
  withSkin('classic', () => {
    _setMessageBoxArtForTests({ slices: Array.from({ length: 9 }, (_, i) => `spop:${i}`), buttons: new Map([[MB_BUTTONS.Yes, 'tex:yes'], [MB_BUTTONS.No, 'tex:no']]) });
    try {
      const got = [];
      const b = new YesNoBoxWindow({ rows: privatePropertyRows(null), onYes: () => got.push('yes'), onNo: () => got.push('no') });
      const r = recorder();
      b.draw(r, CANVAS, FONT, 2);
      assert.ok(r.quads.some((q) => q.tex === 'tex:yes') && r.quads.some((q) => q.tex === 'tex:no'), 'both buttons are drawn');
      assert.deepEqual(b._box.buttons.map((x) => x.button), [MB_BUTTONS.Yes, MB_BUTTONS.No], 'in DFU\'s order');
      const [nx, ny, nw, nh] = b._box.buttons[1].rect;
      assert.equal(b.click(nx - 30, ny - 30), true, 'a miss is swallowed');
      assert.deepEqual(got, []);
      b.click(nx + nw / 2, ny + nh / 2);
      assert.deepEqual(got, ['no'], 'the No button answers No');
      const c = new YesNoBoxWindow({ rows: ['Q?'], onYes: () => got.push('yes') });
      c.draw(recorder(), CANVAS, FONT, 2);
      const [yx, yy, yw, yh] = c._box.buttons[0].rect;
      c.click(yx + yw / 2, yy + yh / 2);
      assert.deepEqual(got, ['no', 'yes'], 'the Yes button answers Yes');
    } finally { _setMessageBoxArtForTests(null); }
    // without the parchment art it is the keyed panel - whose rows answer where they are drawn (above)
    const got = [];
    const flat = new YesNoBoxWindow({ rows: ['Q?'], onYes: () => got.push('yes') });
    const s = nativeMetrics(CANVAS).s;
    flat.draw(recorder(), CANVAS, FONT, s);
    assert.ok(flat._flat, 'the art-less arm');
    flat.click(...rowPoint(flat._flat, 2, s));
    assert.deepEqual(got, ['yes']);
    assert.equal(flat.done, true);
  });
});

test('UXB1-M: the ENHANCED box is a card in the skin\'s face - the question, two real buttons, gone with the answer', () => {
  withSkin('enhanced', (doc) => {
    const clock = [];
    _setYesNoClockForTests((fn, ms) => { const t = { fn, ms, live: true }; clock.push(t); return t; }, (t) => { if (t) t.live = false; });
    try {
      const got = [];
      const b = new YesNoBoxWindow({ rows: privatePropertyRows(null), onYes: () => got.push('yes'), onNo: () => got.push('no') });
      const r = recorder();
      b.draw(r, CANVAS, FONT, 2);
      assert.equal(r.quads.length, 0, 'nothing on the canvas - no parchment over the enhanced HUD');
      const card = doc.getElementById(YES_NO_BOX_ID);
      assert.ok(card, 'the card is mounted');
      assert.equal(card.attrs.role, 'alertdialog');
      assert.deepEqual(find(card, 'notice-row').map((n) => n.textContent), PRIVATE_PROPERTY_FALLBACK_ROWS.map((x) => x.text));
      assert.ok(find(card, 'notice-row').every((n) => n.className.includes('center')), 'record 37\'s centring kept');
      const [yes, no] = [find(card, 'yesnobox-yes')[0], find(card, 'yesnobox-no')[0]];
      assert.equal(yes.tagName, 'BUTTON'); assert.equal(yes.textContent, YES_NO_LABELS.yes);
      assert.equal(no.tagName, 'BUTTON'); assert.ok(no.className.includes('primary'), 'No is marked as the default Return presses');
      assert.equal(b.click(160, 100), true, 'a canvas click is swallowed - the card\'s own buttons take the presses');
      assert.deepEqual(got, []);
      yes.onclick();
      assert.deepEqual(got, ['yes']);
      assert.equal(b.done, true);
      assert.equal(doc.getElementById(YES_NO_BOX_ID), null, 'the card leaves with the answer');
      assert.equal(yesNoFaceOwner(), null);
      // a card whose draws stop (a host gone without closing it) is taken down by the watchdog
      const c = new YesNoBoxWindow({ rows: ['Q?'] });
      c.draw(recorder(), CANVAS, FONT, 2);
      assert.equal(yesNoFaceOwner(), c);
      for (const t of clock.filter((x) => x.live)) t.fn();
      assert.equal(yesNoFaceOwner(), null);
      assert.equal(doc.getElementById(YES_NO_BOX_ID), null);
      c.dispose();
    } finally {
      releaseYesNoFace(yesNoFaceOwner());
      _setYesNoClockForTests((fn, ms) => setTimeout(fn, ms), (t) => clearTimeout(t));
    }
  });
});

test('UXB1-M: the private-property arm raises DFU\'s YesNo box over record 37, its rows centred as the record sets them', () => {
  assert.deepEqual(privatePropertyRows([{ text: 'This looks like private property. Do you', center: true }, { text: 'still want to look through it?', center: true }]),
    PRIVATE_PROPERTY_FALLBACK_ROWS.map((r) => ({ ...r })));
  assert.deepEqual(privatePropertyRows([]), PRIVATE_PROPERTY_FALLBACK_ROWS.map((r) => ({ ...r })), 'no TEXT.RSC: record 37\'s own two lines');
  assert.deepEqual(privatePropertyRows(['a']), [{ text: 'a', center: true }]);
  // the record itself, as the vendored DFU text carries it
  const csv = read('vendor/dfu-text/Internal_RSC.csv');
  assert.match(csv, /37,"This looks like private property\. Do you\[\/center\]\nstill want to look through it\?\[\/center\]/);
  const wm = read('src/scenes/worldModes.js');
  const arm = wm.slice(wm.lastIndexOf("if (key.startsWith('container:')) {"));
  const raise = arm.slice(arm.indexOf('interiorOverlay = new YesNoBoxWindow({'), arm.indexOf('});', arm.indexOf('interiorOverlay = new YesNoBoxWindow({')));
  assert.match(raise, /rows: privatePropertyRows\(townTalk\?\.lines\?\.\(PRIVATE_PROPERTY_TEXT_ID\)\),/);
  assert.match(raise, /onYes: \(\) => openLoot\(true\),/);
  assert.doesNotMatch(arm.slice(0, arm.indexOf('interiorCtx.actions.activate')), /new ChoiceWindow\(\{\s*lines: _rowsText\(townTalk\?\.lines\?\.\(PRIVATE_PROPERTY_TEXT_ID\)/, 'the keyed panel is gone from the arm');
});
