// PAD-CURSOR (2026-10-08, Port-Ledger A; the player: "For controllers, where applicable, can we add a sort of
// navigatable cursor? Like destiny? For all the menus"). The controller cursor's Destiny feel - the curve, the ramp,
// the boost, the friction over a control and the pull to its centre (systems/padCursor.js) - in the game's pad layer
// on both skins (ui/gamepadInput.js) and at the front door (ui/menuPad.js); `padCursorAssist` off is DFU's linear
// cursor (test/gamepad.test.js GP3 holds that law).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAD_CURSOR, curvedThrow, createPadCursorState, stepPadCursor, linearPadCursorStep, pullTargetAmong,
  setPadCursorTargets, padCursorCanvasTargets, padCursorAssist,
} from '../src/systems/padCursor.js';
import { CURSOR_SPEED } from '../src/systems/gamepad.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { setControllerLook } from '../src/player/lookFilter.js';
import { _resetForTests } from '../src/systems/settings.js';
import { setPref, resetPrefs } from '../src/systems/uiPrefs.js';
import { padDoorCursorFrame, padDoorFrame, DOOR_CURSOR_DEADZONE } from '../src/ui/menuPad.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const run = (st, frames, opts) => { let dx = 0, dy = 0; for (let i = 0; i < frames; i++) { const s = stepPadCursor(st, opts); dx += s.dx; dy += s.dy; } return { dx, dy }; };

test('PAD-CURSOR curve: nothing inside the dead zone, the full lean is 1, a half lean is well under half (mutants: no curve; the dead zone not rescaled)', () => {
  assert.equal(curvedThrow(0.05, 0.1), 0);
  assert.equal(curvedThrow(0.1, 0.1), 0);
  assert.equal(curvedThrow(1, 0.1), 1);
  const half = curvedThrow(0.55, 0.1);   // half the throw past the dead zone
  assert.ok(near(half, Math.pow(0.5, PAD_CURSOR.CURVE)), `curved: ${half}`);
  assert.ok(half < 0.35, 'a light lean is a fine move');
});

test('PAD-CURSOR ramp, stop and boost: a flick eases in, a let-go stops dead, a long full lean climbs to the boost (mutants: no ramp; coasting after the let-go; no boost; the boost from the first frame)', () => {
  const st = createPadCursorState();
  const dt = 1 / 60, speed = 900;
  const first = stepPadCursor(st, { h: 1, v: 0, dt, deadzone: 0.1, speed });
  assert.ok(first.dx > 0 && first.dx < speed * dt * 0.5, `the first frame is a fraction of the full step: ${first.dx}`);
  run(st, 20, { h: 1, v: 0, dt, deadzone: 0.1, speed });
  const cruise = stepPadCursor(st, { h: 1, v: 0, dt, deadzone: 0.1, speed });
  assert.ok(near(cruise.dx, speed * dt, 0.5), `ramped to (all but) the full speed: ${cruise.dx}`);
  const stop = stepPadCursor(st, { h: 0, v: 0, dt, deadzone: 0.1, speed });
  assert.deepEqual([stop.dx, stop.dy], [0, 0], 'let go: it stops - nothing coasts past a button');
  const b = createPadCursorState();
  run(b, Math.ceil((PAD_CURSOR.BOOST_AFTER_S + PAD_CURSOR.BOOST_RAMP_S) / dt) + 30, { h: 0, v: 1, dt, deadzone: 0.1, speed });
  const boosted = stepPadCursor(b, { h: 0, v: 1, dt, deadzone: 0.1, speed });
  assert.ok(near(boosted.dy, -speed * PAD_CURSOR.BOOST * dt, 0.05), `held full, the boost - and up is up: ${boosted.dy}`);
});

test('PAD-CURSOR magnetism: over a control the cursor slows to FRICTION; a light or resting stick draws it to the centre; a firm push is never pulled; a boost goes through the friction (mutants: no friction; the pull on a firm push; no pull at rest)', () => {
  const dt = 1 / 60, speed = 900;
  const free = createPadCursorState(), over = createPadCursorState();
  run(free, 20, { h: 1, v: 0, dt, deadzone: 0.1, speed });   // short of the boost
  run(over, 20, { h: 1, v: 0, dt, deadzone: 0.1, speed, over: true });
  const a = stepPadCursor(free, { h: 1, v: 0, dt, deadzone: 0.1, speed });
  const b = stepPadCursor(over, { h: 1, v: 0, dt, deadzone: 0.1, speed, over: true });
  assert.ok(near(b.dx, a.dx * PAD_CURSOR.FRICTION, 0.05), `slowed over a control: ${b.dx} vs ${a.dx}`);
  const rest = createPadCursorState();
  const pulled = stepPadCursor(rest, { h: 0, v: 0, dt, deadzone: 0.1, speed, target: { x: 110, y: 50 }, at: [100, 50] });
  assert.ok(pulled.dx > 0 && pulled.dx <= 10 && pulled.dy === 0, `at rest it settles toward the centre: ${pulled.dx}`);
  const firm = createPadCursorState();
  const pushed = stepPadCursor(firm, { h: 0, v: -0.9, dt, deadzone: 0.1, speed, target: { x: 300, y: 50 }, at: [100, 50] });
  assert.equal(pushed.dx, 0, 'a firm push down is not dragged sideways to a control');
  const boost = createPadCursorState();
  run(boost, 80, { h: 1, v: 0, dt, deadzone: 0.1, speed });
  const through = stepPadCursor(boost, { h: 1, v: 0, dt, deadzone: 0.1, speed, over: true });
  assert.ok(through.dx > speed * dt, 'a long full lean goes through');
});

test('PAD-CURSOR targets: inside a rect is its centre; within the radius the nearest; beyond, none; a canvas window\'s published buttons are read through one slot (mutants: the radius ignored; the nearest not preferred)', () => {
  const rects = [{ x: 0, y: 0, w: 40, h: 20 }, { x: 100, y: 0, w: 40, h: 20 }];
  assert.deepEqual(pullTargetAmong(rects, 10, 10), { x: 20, y: 10, inside: true });
  assert.deepEqual(pullTargetAmong(rects, 90, 10), { x: 120, y: 10, inside: false }, '10 px off the second, 50 off the first');
  assert.equal(pullTargetAmong(rects, 70, 200), null);
  setPadCursorTargets(() => [{ x: 1, y: 2, w: 3, h: 4 }]);
  try { assert.deepEqual(padCursorCanvasTargets(), [{ x: 1, y: 2, w: 3, h: 4 }], 'the window up hands its buttons'); } finally { setPadCursorTargets(null); }
  assert.deepEqual(padCursorCanvasTargets(), [], 'the slot emptied: none');
  setPadCursorTargets(() => { throw new Error('a window mid-teardown'); });
  try { assert.deepEqual(padCursorCanvasTargets(), [], 'a throwing source is no buttons, never a broken frame'); } finally { setPadCursorTargets(null); }
  assert.deepEqual(linearPadCursorStep(1, 1, 1 / 60, 1), { dx: 15, dy: -15 }, 'the switch off: DFU\'s step, y down on the screen');
});

test('PAD-CURSOR in the pad layer: on by default on the classic skin - a flick eases in rather than jumping DFU\'s full step, at rest a canvas window\'s button draws it in, and a hover move carries no held button (mutants: the assist ignored; a move reporting buttons 1)', () => {
  const prev = { w: globalThis.window, loc: globalThis.location };
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} };
  globalThis.location = { search: '?skin=classic' };
  resetPrefs();
  assert.equal(padCursorAssist(), true, 'on by default');
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const evs = [];
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }), dispatchEvent: (ev) => evs.push(ev), style: {} };
  const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  try {
    _resetForTests();
    const gp = attachGamepad(canvas, { overlayActive: () => true }, { getPads: () => [pad], dispatch: () => {}, makeEvent: (type, init) => ({ type, ...init }) });
    pad.axes[0] = 1;
    gp.tick(1 / 60);
    const [x0] = gp.cursor();
    gp.tick(1 / 60);
    const step = gp.cursor()[0] - x0;
    assert.ok(step > 0 && step < CURSOR_SPEED / 60, `eased in: ${step} < DFU's ${CURSOR_SPEED / 60}`);
    const move = evs.findLast((e) => e.type === 'pointermove');
    assert.equal(move.buttons, 0, 'a hover is no drag');
    pad.axes[0] = 0;
    const [cx, cy] = gp.cursor();
    setPadCursorTargets(() => [{ x: cx + 10, y: cy - 10, w: 20, h: 20 }]);
    for (let i = 0; i < 60; i++) gp.tick(1 / 60);
    const [ax, ay] = gp.cursor();
    assert.ok(Math.hypot(ax - (cx + 20), ay - cy) < 1, `at rest, settled on the button's centre: ${ax},${ay}`);
    gp.dispose();
  } finally { setPadCursorTargets(null); resetPrefs(); globalThis.window = prev.w; globalThis.location = prev.loc; setBindings(null); setControllerLook(false); _resetForTests(); }
});

test('PAD-CURSOR at the front door: the stick brings the cursor out and steers it (screen y down), at rest with nothing near it stays; the stick no longer walks the focus; A with the cursor out presses what it stands on (mutants: the stick still walking the focus; A pressing the focus under a cursor)', () => {
  resetPrefs();
  const cur = { pos: null, out: false, feel: { vx: 0, vy: 0, full: 0 } };
  const env = { near: () => null, bounds: { w: 800, h: 600 }, speed: 900 };
  const pad = (x, y, b = {}) => ({ axes: [x, y], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!b[i] })) });
  assert.equal(padDoorCursorFrame(pad(0, 0), cur, 1 / 60, env), false, 'untouched: no cursor');
  assert.equal(cur.out, false);
  for (let i = 0; i < 10; i++) padDoorCursorFrame(pad(0, 1), cur, 1 / 60, env);
  assert.equal(cur.out, true);
  assert.ok(cur.pos[1] > 300 && near(cur.pos[0], 400), `born in the middle, moved DOWN: ${cur.pos}`);
  assert.equal(padDoorCursorFrame(pad(DOOR_CURSOR_DEADZONE / 2, 0), cur, 1 / 60, env), false, 'at rest, nothing near: still');
  const pressed = [], focused = [];
  const ui = {
    candidates: () => [{ el: 'a', rect: { x: 0, y: 0, w: 10, h: 10 } }, { el: 'b', rect: { x: 0, y: 100, w: 10, h: 10 } }],
    active: () => 'a', connected: () => true, focus: (el) => focused.push(el), press: (el) => pressed.push(el), back() {}, step: () => false,
    cursorOut: () => cur.out, pressAtCursor: () => { pressed.push('cursor'); return true; },
  };
  const state = { confirm: false, back: false, dir: null, heldAt: 0, lastRepeat: 0, lastEl: null, lastRect: null, lostAt: null };
  padDoorFrame(pad(0, 1), ui, state, 0, { stick: false });
  assert.deepEqual(focused, [], 'the stick is the cursor\'s, not the focus walk');
  padDoorFrame(pad(0, 0, { 13: true }), ui, state, 10, { stick: false });
  assert.deepEqual(focused, ['b'], 'the d-pad still walks it');
  padDoorFrame(pad(0, 0, { 0: true }), ui, state, 20, { stick: false });
  assert.deepEqual(pressed, ['cursor'], 'A presses at the cursor');
});

test('PAD-CURSOR switch off: the door\'s cursor steps DFU\'s linear law and never drifts at rest', () => {
  setPref('padCursorAssist', false);
  try {
    const cur = { pos: [100, 100], out: true, feel: { vx: 0, vy: 0, full: 0 } };
    padDoorCursorFrame({ axes: [1, 0] }, cur, 1 / 60, { near: () => ({ x: 120, y: 90, w: 20, h: 20 }), bounds: { w: 800, h: 600 }, speed: 900 });
    assert.ok(near(cur.pos[0], 115) && near(cur.pos[1], 100), `the full step at once: ${cur.pos}`);
    assert.equal(padDoorCursorFrame({ axes: [0, 0] }, cur, 1 / 60, { near: () => ({ x: 120, y: 90, w: 20, h: 20 }), bounds: { w: 800, h: 600 } }), false, 'and no pull');
  } finally { resetPrefs(); }
});
