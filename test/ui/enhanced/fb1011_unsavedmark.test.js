// UNSAVED-MARK (FIELD BUGS 2026-10-11, bible/01-Overview/bugs/Field-Bugs-2026-10-11.md): "I am trying to set a hotkey for
// 'Overworld' ... It shows that my selected key is set, but when I close the UI and try to use the hotkey, it doesn't
// work. Checking the settings page after shows that it just didn't save." Nothing in TravelView's road was broken: the
// key pane STAGES until Confirm (FIX-F's law, kept), and the player never saw a Confirm owed - a staged key drew exactly
// as a saved one, on a page whose every other row saves as it is set; and the sticky head that carried Confirm stood
// under Settings' sticky toolbar (312 px of it, its top behind the bar) and, on a phone, over the row just bound (462
// px). Driven: what a Confirm owes (the pure law), the row and the head that say so, gone on Confirm and on leaving;
// the how-to scrolled away out of the sticky head; and the head stood under the toolbar at the toolbar's measured height.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paneControls, discardControlsStaging, controlsStaging, UNSAVED_ROW, unsavedCount, CONFIRM_LABEL } from '../../../src/ui/enhanced/enhancedControls.js';
import { stickUnderToolbar } from '../../../src/ui/enhanced/enhancedMenu.js';
import { setBindings } from '../../../src/ui/input.js';
import { createBindings, resetDefaults, getBinding } from '../../../src/systems/inputActions.js';
import { createUnsavedKeybinds, setUnsavedBinding, applyUnsavedKeybinds, unsavedEdits } from '../../../src/systems/controlsConfig.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const FREE = 'F1';   // no default holds it (the report's own pick was F2 - UI-CALM gave it to SaddlePanel)

function fakeEl(tag) {
  const n = {
    tag, tagName: tag.toUpperCase(), children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {}, onclick: null, oncontextmenu: null,
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, removeEventListener() {},
  };
  return n;
}
const find = (n, cls, out = []) => { if (n.className.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const textOf = (n) => (n.textContent || '') + n.children.map(textOf).join(' ');

function withPane(fn) {
  const store = createBindings();
  resetDefaults(store);
  setBindings(store);
  discardControlsStaging();
  const listeners = [];
  globalThis.document = { createElement: fakeEl, addEventListener: (type, fn) => listeners.push({ type, fn }), removeEventListener: (type, fn) => { const i = listeners.findIndex((l) => l.fn === fn); if (i >= 0) listeners.splice(i, 1); } };
  const view = { body: fakeEl('div') };
  const render = () => { view.body = fakeEl('div'); paneControls(view.body, { render }); };
  try {
    paneControls(view.body, { render });
    const bind = (action, code) => {
      find(view.body, 'ctl-key').find((b) => b.dataset.action === action).onclick();
      listeners.find((l) => l.type === 'keydown').fn({ code, preventDefault() {}, stopPropagation() {} });
    };
    const row = (action) => find(view.body, 'ctl-row').find((r) => one(r, 'ctl-key').dataset.action === action);
    return fn({ view, store, render, bind, row });
  } finally { discardControlsStaging(); delete globalThis.document; }
}

test('UNSAVED-MARK what a Confirm owes: none off the registry, each staged edit by its dict, none once applied', () => {
  const store = createBindings();
  resetDefaults(store);
  const u = createUnsavedKeybinds(store);
  assert.deepEqual(unsavedEdits(store, u), [], 'a staging fresh off the registry owes nothing');
  assert.deepEqual(unsavedEdits(store, null), []);
  setUnsavedBinding(u, 'TravelView', FREE);
  assert.deepEqual(unsavedEdits(store, u), [{ action: 'TravelView', primary: true }]);
  u.usingPrimary = false;
  setUnsavedBinding(u, 'TravelView', 'F4');
  assert.deepEqual(unsavedEdits(store, u), [{ action: 'TravelView', primary: true }, { action: 'TravelView', primary: false }], 'the secondary dict too, whichever is shown');
  applyUnsavedKeybinds(store, u);
  assert.deepEqual(unsavedEdits(store, u), [], 'applied: nothing owed');
});

test('UNSAVED-MARK the pane: the Overworld row bound and not saved says so, the head counts it and lights Confirm; Confirm saves and clears it; leaving drops it', () => {
  withPane(({ view, store, render, bind, row }) => {
    assert.equal(find(view.body, 'ctl-unsaved').length, 0, 'nothing owed on arrival');
    assert.equal(one(view.body, 'ctl-pending'), undefined);
    assert.ok(!one(view.body, 'ctl-head').className.includes('ctl-owed'));
    bind('TravelView', FREE);
    assert.equal(one(row('TravelView'), 'ctl-key').textContent, FREE, 'the row shows the key - as it did');
    assert.ok(row('TravelView').className.split(/\s+/).includes('ctl-unsaved'), 'and now says it is not saved');
    assert.equal(one(row('TravelView'), 'ctl-unsaved-note').textContent, UNSAVED_ROW);
    assert.equal(find(view.body, 'ctl-unsaved').length, 1, 'that row alone');
    const head = one(view.body, 'ctl-head');
    assert.ok(head.className.split(/\s+/).includes('ctl-owed'), 'the head lights its Confirm');
    assert.equal(one(head, 'ctl-pending').textContent, unsavedCount(1));
    assert.equal(unsavedCount(1), `1 change not saved yet. Press ${CONFIRM_LABEL} to keep it.`, 'PIN MOVED (VOICE2): a second sentence, no dash aside');
    assert.equal(unsavedCount(2), `2 changes not saved yet. Press ${CONFIRM_LABEL} to keep them.`, 'PIN MOVED (VOICE2): a second sentence, no dash aside');
    assert.equal(getBinding(store, 'TravelView', true), null, 'staged only');
    one(head, 'ctl-continue').onclick();
    assert.equal(getBinding(store, 'TravelView', true), FREE, 'Confirm commits it');
    assert.equal(find(view.body, 'ctl-unsaved').length, 0, 'and nothing is owed');
    assert.equal(one(view.body, 'ctl-pending'), undefined);
    // a second edit, then a walk away: dropped, and the page comes back owing nothing
    bind('TravelView', 'F12');   // F3 is auto-run's default and F4 the ship's hold, so neither stages as a free key
    assert.equal(find(view.body, 'ctl-unsaved').length, 1);
    discardControlsStaging();
    render();
    assert.equal(find(view.body, 'ctl-unsaved').length, 0);
    assert.equal(getBinding(store, 'TravelView', true), FREE);
    assert.ok(controlsStaging());
  });
});

test('UNSAVED-MARK the sticky head is the law and its buttons: the how-to scrolls away in the intro, the head keeps the law', () => {
  withPane(({ view }) => {
    const intro = one(view.body, 'ctl-intro'), head = one(view.body, 'ctl-head');
    assert.ok(view.body.children.indexOf(intro) < view.body.children.indexOf(head), 'the intro first, above the head');
    assert.match(textOf(intro), /Click a binding, then press the key you want\./);
    assert.match(textOf(intro), /A key already in use asks whether to move it or use it for both/);
    assert.match(textOf(intro), /A key not saved yet is marked on its row\./);
    assert.doesNotMatch(textOf(head), /Click a binding|already in use asks whether/, 'none of the how-to rides the sticky head');
    assert.match(textOf(head), /Nothing is saved until you press Confirm, including Defaults\./);
  });
});

test('UNSAVED-MARK the head stands under the Settings toolbar: the bar measured onto its list, and the card stuck at that height', () => {
  const observers = [];
  class RO { constructor(cb) { this.cb = cb; this.on = true; observers.push(this); } observe(n) { this.n = n; } disconnect() { this.on = false; } }
  const set = {};
  const list = { style: { setProperty: (k, v) => { set[k] = v; } } };
  const bar = { offsetHeight: 131, isConnected: true };
  const ro = stickUnderToolbar(list, bar, RO);
  assert.equal(ro.n, bar, 'the bar watched');
  ro.cb();
  assert.equal(set['--opt-tools-h'], '131px');
  bar.offsetHeight = 156;   // the chips wrapped
  ro.cb();
  assert.equal(set['--opt-tools-h'], '156px');
  bar.isConnected = false; bar.offsetHeight = 0;   // a repaint built a new bar
  ro.cb();
  assert.equal(ro.on, false, 'let go with the bar');
  assert.equal(set['--opt-tools-h'], '156px', 'and a bar gone writes nothing');
  assert.equal(stickUnderToolbar(list, bar, undefined), null, 'no observer: the card sticks at the top, as before');
  const css = read('src/ui/enhanced/enhancedStyle.js'), menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(css, /\.opt-tools \+ \.opt-body \.ctl-head \{ top: var\(--opt-tools-h, 0px\); \}/);
  assert.match(css, /\.ctl-head \{ position: sticky; top: 0; z-index: 2; \}/, 'sticky, as TORCH-BIND made it');
  assert.match(menu, /const tools = optionsToolbar\(body, \{ pause \}\);\n\s*list\.append\(tools, body\);\n\s*stickUnderToolbar\(list, tools\);/, 'the Settings list measures its own toolbar');
});
