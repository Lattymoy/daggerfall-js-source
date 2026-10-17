// FIELD BUGS 2026-09-29h (TOUCH-HELD) - "(Mobile) Can't accept terms of entry for palaces. The onscreen keyboard won't
// pop up when talking to the guard to accept the terms of entry."
//
// The terms are TEXT.RSC 5464, an RDB ShowTextWithInput (type 12): the player TYPES an answer the table accepts and
// presses Return (DaggerfallAction.cs:566, TYPE_12_ANSWERS). A castle runs in the world host's dungeon mode, so the box
// goes up on the dungeon's own window stack. A phone's only way to type into a classic box is the touch layer's nav
// row - its abc field raises the keyboard and replays the letters, its ⏎ is Return - and the row shows while the host's
// `overlayActive` says a window holds the game. The world host's said so for the TOWN's slot and the travel view alone:
// a window on a building's or a dungeon's stack (modes.overlayHeld) left the row hidden, and the guard's box had no
// keyboard and no Return. The standalone dungeon host's hook always read its own stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachTouch } from '../../src/ui/touch/touch.js';
import { routeKey } from '../../src/ui/input.js';
import { ActionInputBox } from '../../src/ui/actionText.js';
import { TYPE_12_ANSWERS } from '../../src/world/actionSystem.js';

const W = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');

/** The world host's own `overlayActive` hook, lifted off its source (the one the touch layer and the pad share). */
function worldOverlayHook() {
  const m = /\n\s*overlayActive: \(\) => ([^\n]+?),\s+\/\/ AUDIT DEEP2 A2/.exec(W);
  assert.ok(m, 'the world host\'s overlayActive hook moved');
  // eslint-disable-next-line no-new-func
  return new Function('townTalk', 'travelView', 'modes', `return ${m[1]};`);
}

function stubEl() {
  return {
    textContent: '', children: [], _l: new Map(), style: { cssText: '' }, value: '',
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
/** attachTouch over a document just big enough, torn down whatever happens (its nav poll is a real interval). */
async function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const made = [];
  const keys = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => { const e = stubEl(); made.push(e); return e; }, body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; } };
  let h = null;
  try { return await fn((canvas, hooks) => (h = attachTouch(canvas, hooks)), made, keys); } finally {
    h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
  }
}
const poll = () => new Promise((r) => { setTimeout(r, 400); });   // past the nav row's poll (touch.js NAV_POLL_MS)
/** A finger on a layer button: its press is the touchstart (touch.js button()), its lift the touchend. */
const press = (b) => { const ev = { preventDefault() {}, stopPropagation() {} }; b.fire('touchstart', ev); b.fire('touchend', ev); };

test('TOUCH-HELD: the world host\'s hook says a window on a mode\'s own stack holds the game - and only then (mutant: the modes\' stacks unread)', () => {
  const hook = worldOverlayHook();
  const town = { overlayActive: false };
  assert.equal(hook(town, null, { overlayHeld: true }), true, 'the castle guard\'s terms box, up on the dungeon\'s stack');
  assert.equal(hook(town, null, { overlayHeld: false }), false, 'no window anywhere: the finger is the world\'s');
  assert.equal(hook(town, null, undefined), false, 'before the modes exist (a var until the boot builds them)');
  assert.equal(hook({ overlayActive: true }, null, { overlayHeld: false }), true, 'the town\'s slot, as before');
  assert.equal(hook(town, { active: true }, { overlayHeld: false }), true, 'the travel view, as before (AUDIT DEEP2 A2)');
});

test('TOUCH-HELD: on a phone the guard\'s box takes "yes" and Return - the nav row stands, abc raises the keyboard, the letters and ⏎ reach the box through the dungeon\'s own key route', async () => {
  const hook = worldOverlayHook();
  const modes = { overlayHeld: true };
  const said = [];
  const box = new ActionInputBox(['Do ye agree with these terms?'], (text) => said.push(text));
  const dungeonCtx = { uiOverlayActive: true, overlayIsNative: false, overlayInput: (a, e) => box.input(a, e) };
  await withTouchDom(async (attach, made, keys) => {
    const h = attach(stubEl(), { overlayActive: () => hook({ overlayActive: false }, null, modes) });
    await poll();
    const abc = made.find((e) => e.textContent === 'abc');
    const enter = made.find((e) => e.textContent === '⏎');
    assert.ok(abc && enter, 'the nav row has its abc and ⏎');
    const nav = made.find((e) => e.children.includes(abc) && e.style.cssText.includes('inset:0;display:none'));   // the row itself (a button is the layer's child too)
    assert.equal(nav.style.display, 'block', 'the nav row stands over the guard\'s box');
    // the finger on abc: a real text field, focused inside the gesture - the phone's keyboard
    press(abc);
    const field = made.find((e) => e.type === 'text');
    assert.ok(field?.focused, 'the field is up and focused - the keyboard rises');
    field.value = 'yes';
    field.fire('keydown', { key: 'Enter' });
    press(enter);
    // what the layer sent, through the dungeon's route (worldModes.js: routeKey(e, dungeonCtx, ...)) into the box
    const downs = keys.filter((e) => e.type === 'keydown');
    assert.ok(downs.length >= 4, `the letters and Return were sent (${downs.map((e) => e.key || e.code).join(' ')})`);
    for (const e of downs) routeKey(e, dungeonCtx);
    void h;
  });
  assert.deepEqual(said, ['yes'], 'the box submitted what the player typed');
  assert.ok(TYPE_12_ANSWERS[5464].some((a) => a.toLowerCase() === said[0]), 'and the guard\'s table takes it');
});
