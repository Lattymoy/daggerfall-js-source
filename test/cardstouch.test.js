// CARDS-TOUCH (2026-10-09, bible/11-Multiplayer/Tavern-Cards.md section 31; AUDIT CARDS-6 lane E's first HIGH, found
// live on main): A PHONE'S FINGER AT A CARD TABLE IS THE TABLE'S. The cards' own listeners (scenes/worldModes.js
// cardPointerListen) take a finger on the hand, the chips or the cloth at the capture phase - but the touch layer
// (ui/touch.js) reads the raw touch events, not the pointer ones, and read the same finger again: a tap was the
// activate press (world.js inputHooks.tap -> the activate gate -> tryExit), and seated the press stands the player up -
// folded out of turn, cashed out - from a tap on his own cards; a chip drag turned the seated head under the chips.
// Driven: the real touch layer, over test/audit0928_input.test.js's stub document, its `cardTable` hook the hosts' own
// line over worldModes' own `cardSeated` - seated, a tap, a drag, a hold-and-drag and the stick's half tap say nothing
// (a swing held into the seat let go once); standing, each says what it always said.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachTouch } from '../src/ui/touch.js';
import { HOLD_MS } from '../src/ui/touchGestures.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const grab = (src, re, what) => { const m = re.exec(src); assert.ok(m, `${what} is no longer where this pin reads it`); return m[1]; };

/** test/audit0928_input.test.js's stub element and document, the touch layer over them. */
function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {}, style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
function withTouch(hooks, drive) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: () => true, prompt: () => null };
  resetPrefs();
  setPref('touchStickAnchor', 'float');
  const canvas = stubEl();
  const layer = attachTouch(canvas, hooks);
  try {
    const ev = (type, x, y, ts, id = 7) => ({ type, timeStamp: ts, preventDefault() {}, stopPropagation() {}, changedTouches: [{ identifier: id, clientX: x, clientY: y }] });
    drive({ canvas, ev });
  } finally {
    layer.dispose();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    resetPrefs();
  }
}

/** The hosts' `cardTable` hook (world.js's own line) over worldModes' own `cardSeated`, on a room and a seat. */
function seatHook(state) {
  const seated = grab(read('src/scenes/worldModes.js'), /\n {4}cardSeated: (\(\) => [^\n]*?),\n/, 'worldModes\' cardSeated');
  const hook = grab(read('src/scenes/world.js'), /\n {4}cardTable: (\(\) => [^\n]*?),   \/\/ CARDS-TOUCH/, 'world.js\'s cardTable hook');
  const modes = { cardSeated: new Function('S', `return () => { const { mode, cardSeat } = S; return (${seated})(); };`)(state) };
  return new Function('modes', `return ${hook};`)(modes);
}
function rig(state) {
  const said = { look: 0, attack: [], tap: [] };
  const hooks = { look: () => { said.look++; }, attack: (dx, dy, held) => said.attack.push(held), tap: (x, y, o) => said.tap.push(o?.lockOnly ? 'lock' : 'tap'), cardTable: seatHook(state) };
  return { said, hooks };
}
const tap = (canvas, ev, x, y, t0) => { canvas.fire('touchstart', ev('touchstart', x, y, t0)); canvas.fire('touchend', ev('touchend', x, y, t0 + 60)); };
const drag = (canvas, ev, x, y, t0) => { canvas.fire('touchstart', ev('touchstart', x, y, t0)); for (let i = 1; i <= 6; i++) canvas.fire('touchmove', ev('touchmove', x, y - i * 20, t0 + i * 16)); canvas.fire('touchend', ev('touchend', x, y - 120, t0 + 120)); };
const holdDrag = (canvas, ev, x, y, t0) => { canvas.fire('touchstart', ev('touchstart', x, y, t0)); canvas.fire('touchmove', ev('touchmove', x + 1, y, t0 + HOLD_MS + 40)); for (let i = 1; i <= 4; i++) canvas.fire('touchmove', ev('touchmove', x + i * 25, y, t0 + HOLD_MS + 40 + i * 16)); canvas.fire('touchend', ev('touchend', x + 100, y, t0 + HOLD_MS + 200)); };

test('CARDS-TOUCH seated at a card table, the finger is the table\'s: a tap on the view (his cards), a drag (his chips), a hold-and-drag and the stick\'s half tap say nothing to the world', () => {
  const state = { mode: 'interior', cardSeat: { table: 0, seat: 2 } };
  const { said, hooks } = rig(state);
  withTouch(hooks, ({ canvas, ev }) => {
    tap(canvas, ev, 700, 300, 0);          // the right half: a still, short touch - the activate press, which stood him up
    drag(canvas, ev, 700, 400, 1000);      // a chip carried up the cloth - it turned the seated head under it
    holdDrag(canvas, ev, 700, 300, 2000);  // held, then dragged: the swing
    tap(canvas, ev, 200, 400, 3000);       // the stick's half: the lock pick
  });
  assert.deepEqual(said, { look: 0, attack: [], tap: [] }, 'nothing reaches the world while he sits');
});

test('CARDS-TOUCH standing, the finger is the world\'s as it always was - and outside a building no seat is read', () => {
  for (const state of [{ mode: 'interior', cardSeat: null }, { mode: 'exterior', cardSeat: { table: 0, seat: 0 } }]) {
    const { said, hooks } = rig(state);
    withTouch(hooks, ({ canvas, ev }) => {
      tap(canvas, ev, 700, 300, 0);
      drag(canvas, ev, 700, 400, 1000);
      holdDrag(canvas, ev, 700, 300, 2000);
      tap(canvas, ev, 200, 400, 3000);
    });
    assert.deepEqual(said.tap, ['tap', 'lock'], `${state.mode}: the tap and the stick's lock pick`);
    assert.ok(said.look > 0, `${state.mode}: the drag looks`);
    assert.deepEqual([said.attack[0], said.attack.at(-1)], [true, false], `${state.mode}: the hold-and-drag swings, and lets go`);
  }
});

test('CARDS-TOUCH a swing held as he sits down is let go once - never left held under the seat', () => {
  const state = { mode: 'interior', cardSeat: null };
  const { said, hooks } = rig(state);
  withTouch(hooks, ({ canvas, ev }) => {
    canvas.fire('touchstart', ev('touchstart', 700, 300, 0));
    canvas.fire('touchmove', ev('touchmove', 701, 300, HOLD_MS + 40));
    canvas.fire('touchmove', ev('touchmove', 730, 300, HOLD_MS + 60));
    assert.equal(said.attack.at(-1), true, 'swinging');
    state.cardSeat = { table: 0, seat: 1 };
    canvas.fire('touchmove', ev('touchmove', 760, 300, HOLD_MS + 80));
    canvas.fire('touchmove', ev('touchmove', 790, 300, HOLD_MS + 100));
    canvas.fire('touchend', ev('touchend', 790, 300, HOLD_MS + 120));
  });
  assert.equal(said.attack.filter((h) => h === false).length, 1, 'let go once');
  assert.equal(said.attack.at(-1), false);
});

test('CARDS-TOUCH by source: both hosts that enter a building through worldModes give the layer the seat; the gyro and the stick\'s tap stand down too', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    const hooks = src.slice(src.lastIndexOf('const inputHooks = {', src.indexOf('const touch = attachTouch(canvas, inputHooks);')), src.indexOf('const touch = attachTouch(canvas, inputHooks);'));
    assert.ok(hooks.includes('    cardTable: () => !!modes?.cardSeated?.(),'), `${f}: the touch layer's hooks carry the seat`);
  }
  assert.match(read('src/scenes/worldModes.js'), /\n {4}cardSeated: \(\) => mode === 'interior' && !!cardSeat,\n/);
  const touch = read('src/ui/touch.js');
  assert.ok(touch.includes("if (!(dt > 0) || dt > GYRO_MAX_DT || hooks.paused?.() || hooks.cardTable?.()) return;"), 'the gyro turns no seated head');
  assert.ok(touch.includes('if (!hooks.cardTable?.()) hooks.tap?.(stickOrigin[0], stickOrigin[1], { lockOnly: true });'), 'no lock pick from the seat');
  // the pad is untouched: it presses through its keys, and its look and swing are the hooks' own, not the layer's
  assert.equal(read('src/ui/gamepadInput.js').includes('cardTable'), false);
});
