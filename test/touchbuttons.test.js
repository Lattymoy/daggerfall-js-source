// TOUCH-BUTTONS (2026-09-27, Discord - jessman212, on Android: "I haven't been able to remap the android "buttons" on
// the bottom right of the screen. I would much rather use a button to attack rather than the touchscreen
// personally."). The corner is three slots the player fills on the Touch card - TI1's Jump and Ready Weapon by
// default - and Attack is one of the choices: a press is a swing through the swipe's own seam.
//
// The layer is DOM, so the behaviour is driven against the STUB document audit62_touch.test.js uses (real
// listeners, real synthesized KeyboardEvents, real binding registry).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOUCH_BUTTON_ACTIONS, TOUCH_BUTTON_SLOTS, TOUCH_BUTTON_DEFAULTS, touchButtonSlots, nextTouchButton, attackStroke,
  ATTACK_STROKE_PX, layoutTouchCorner, TOUCH_CORNER_MAX, touchButtonChoices,
} from '../src/ui/touchButtons.js';
import { attachTouch } from '../src/ui/touch.js';
import { setBindings } from '../src/ui/input.js';
import { createBindings, setBinding } from '../src/systems/inputActions.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { CLICK_ATTACK_DIRECTIONS, gestureDirection } from '../src/characters/weaponStates.js';
import { DIRECTION_TO_STRIKE } from '../src/characters/anims.js';

function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {},
    style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
const tev = (type, t) => ({ type, timeStamp: t, preventDefault() {}, stopPropagation() {}, changedTouches: [] });
function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  const live = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = { ontouchstart: null, dispatchEvent: (e) => { keys.push(e); return true; }, prompt: () => null };
  const attach = (canvas, hooks) => { const h = attachTouch(canvas, hooks); live.push(h); return h; };
  return Promise.resolve().then(() => fn(keys, attach)).finally(() => {
    for (const h of live) h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    _resetForTests();
  });
}
function defaultStore() {
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'], ['KeyA', 'MoveLeft'],
    ['KeyD', 'MoveRight'], ['Space', 'Jump'], ['ShiftLeft', 'Run'], ['KeyZ', 'ReadyWeapon'], ['F6', 'Inventory'],
    ['KeyC', 'Crouch'], ['Tab', 'QuickDial']]) setBinding(b, c, a);
  return b;
}
const live = (h) => h.el.children.filter((c) => !c.removed);
const btn = (h, label) => live(h).find((c) => c.textContent === label);
const codes = (keys, type) => keys.filter((e) => e.type === type).map((e) => e.code);

test('TOUCH-BUTTONS: the law - three slots, TI1\'s two by default, anything unknown reads as its slot\'s default, the choices walk and wrap', () => {
  assert.deepEqual(TOUCH_BUTTON_SLOTS, ['touchButton1', 'touchButton2', 'touchButton3']);
  for (const slot of TOUCH_BUTTON_SLOTS) assert.equal(PREF_DEFAULTS[slot], TOUCH_BUTTON_DEFAULTS[slot], `${slot}: the shelf's default is the law's`);
  assert.deepEqual(touchButtonSlots(() => undefined).map((a) => a.id), ['Jump', 'ReadyWeapon', 'none']);
  assert.deepEqual(touchButtonSlots((k) => ({ touchButton1: 'Attack', touchButton2: 'nonsense', touchButton3: 'Inventory' })[k]).map((a) => a.id),
    ['Attack', 'ReadyWeapon', 'Inventory'], 'an unknown id (an old or hand-edited shelf) is the slot\'s default');
  const ids = TOUCH_BUTTON_ACTIONS.map((a) => a.id);
  assert.ok(ids.includes('Attack') && ids.includes('none'));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(nextTouchButton('none'), ids[1]);
  assert.equal(nextTouchButton(ids.at(-1)), 'none', 'the list wraps forward');
  assert.equal(nextTouchButton('none', -1), ids.at(-1), '...and back');
  assert.deepEqual(touchButtonChoices()[0], ['none', 'None']);
  for (const a of TOUCH_BUTTON_ACTIONS) assert.ok(['none', 'hold', 'tap', 'attack'].includes(a.kind), a.id);
});

test('TOUCH-BUTTONS: the Attack stroke is DFU\'s click-to-attack draw (AUDIT A7: CLICK_ATTACK_DIRECTIONS, six ways, each read back by the gesture as itself), long enough to clear the swing threshold on any screen (mutants: the first cut\'s eight ways)', () => {
  const seen = [];
  for (let k = 0; k < CLICK_ATTACK_DIRECTIONS.length; k++) {
    const s = attackStroke(() => (k + 0.5) / CLICK_ATTACK_DIRECTIONS.length);
    assert.ok(Math.abs(Math.hypot(s.dx, s.dy) - ATTACK_STROKE_PX) <= 1, `direction ${k}: ${JSON.stringify(s)}`);
    seen.push(DIRECTION_TO_STRIKE[gestureDirection(Math.atan2(-s.dy, s.dx) * 180 / Math.PI)]);
  }
  assert.deepEqual(seen, CLICK_ATTACK_DIRECTIONS.map((d) => DIRECTION_TO_STRIKE[d]), 'each stroke swings the strike DFU\'s click draws');
  assert.equal(seen.filter((x) => x === 'StrikeUp').length, 1, 'StrikeUp one in six, not three in eight');
  assert.ok(ATTACK_STROKE_PX >= 0.005 * 2560 * 2, 'twice the 0.005-of-the-longest-side threshold on a 2560 px screen');
  const edge = attackStroke(() => 0.999999);
  assert.ok(Number.isFinite(edge.dx) && Number.isFinite(edge.dy));
});

test('TOUCH-BUTTONS: the default corner stands where TI1\'s did - Jump at 16, F at 232, the corner ending at 280 - and the widest is bounded', () => {
  const def = layoutTouchCorner(touchButtonSlots(() => undefined), { mode: true, social: true });
  assert.deepEqual(def.slots.map((s) => [s.action.id, s.right]), [['Jump', 16], ['ReadyWeapon', 92]]);
  assert.deepEqual([def.mode, def.social, def.extent], [156, 232, 280]);
  const none = layoutTouchCorner(touchButtonSlots(() => 'none'), { mode: false, social: true });
  assert.deepEqual([none.slots.length, none.social], [0, 16], 'empty slots take no room');
  assert.ok(TOUCH_CORNER_MAX > 280 && TOUCH_CORNER_MAX <= 420, `the widest corner: ${TOUCH_CORNER_MAX}`);
});

test('TOUCH-BUTTONS: the default corner holds Jump and Ready Weapon on their LIVE codes, as TI1\'s two did', () => withTouchDom((keys, attach) => {
  setBindings(defaultStore());
  const h = attach(stubEl(), { look() {}, attack() {} });
  const jump = btn(h, '↑↑');
  assert.ok(jump && btn(h, 'Z'), 'the two default buttons are drawn');
  jump.fire('touchstart', tev('touchstart', 0));
  assert.deepEqual(codes(keys, 'keydown'), ['Space']);
  jump.fire('touchend', tev('touchend', 10));
  assert.deepEqual(codes(keys, 'keyup'), ['Space']);
  assert.equal(btn(h, '⚔'), undefined, 'no Attack button unless the player puts one there');
}));

test('TOUCH-BUTTONS: an Attack slot swings through the drag seam - pressed a stroke, lifted a release - and not under a window', () => withTouchDom((keys, attach) => {
  setBindings(defaultStore());
  setPref('touchButton1', 'Attack');
  const calls = [];
  let paused = false;
  const h = attach(stubEl(), { look() {}, attack: (dx, dy, held) => calls.push([dx, dy, held]), paused: () => paused });
  const sword = btn(h, '⚔');
  assert.ok(sword, 'the Attack slot is drawn');
  assert.equal(sword.attrs['aria-label'], 'Attack');
  sword.fire('touchstart', tev('touchstart', 0));
  assert.equal(calls.length, 1);
  const [dx, dy, held] = calls[0];
  assert.equal(held, true);
  assert.ok(Math.abs(Math.hypot(dx, dy) - ATTACK_STROKE_PX) <= 1, 'the press is a stroke past the threshold');
  sword.fire('touchend', tev('touchend', 30));
  assert.deepEqual(calls[1], [0, 0, false], 'the lift releases the swing');
  assert.deepEqual(codes(keys, 'keydown'), [], 'no key is synthesized - Mouse1 is no key the hosts read');
  paused = true;
  sword.fire('touchstart', tev('touchstart', 50));
  sword.fire('touchend', tev('touchend', 60));
  assert.equal(calls.length, 2, 'under a window the press is refused, and there is no release to send');
}));

test('TOUCH-BUTTONS: a host with no attack is offered no Attack slot; a tap slot presses its action once', () => withTouchDom((keys, attach) => {
  setBindings(defaultStore());
  setPref('touchButton1', 'Attack');
  setPref('touchButton2', 'Inventory');
  const h = attach(stubEl(), { look() {} });   // the fly-cam: no attack hook
  assert.equal(btn(h, '⚔'), undefined, 'a drawn door that opens nothing is the lie');
  const pack = btn(h, 'Pack');
  assert.ok(pack);
  pack.fire('touchstart', tev('touchstart', 0));
  assert.deepEqual([codes(keys, 'keydown'), codes(keys, 'keyup')], [['F6'], ['F6']], 'one press of Inventory\'s live code');
}));

test('TOUCH-BUTTONS: the Touch card re-lays the corner while the layer is up - but never out from under a finger', () => withTouchDom(async (keys, attach) => {
  setBindings(defaultStore());
  const h = attach(stubEl(), { look() {}, attack() {} });
  const jump = btn(h, '↑↑');
  jump.fire('touchstart', tev('touchstart', 0));
  setPref('touchButton1', 'Crouch');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(btn(h, '↑↑'), 'a held button is not taken away');
  jump.fire('touchend', tev('touchend', 10));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(btn(h, '↑↑'), undefined, 'let go, the corner is re-laid');
  const crouch = btn(h, 'Crouch');
  assert.ok(crouch);
  crouch.fire('touchstart', tev('touchstart', 20));
  assert.deepEqual(codes(keys, 'keydown'), ['Space', 'KeyC'], 'the new slot holds its own action');
}));

test('TOUCH-BUTTONS: the Touch card carries the three slots, walked by the steppers', () => {
  const menu = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(menu, /TOUCH_BUTTON_SLOTS\.forEach\(\(slot, i\) => \{\s*\n\s*out\.push\(slotChoiceRow\(slot, slotNames\[i\],/);
  assert.match(menu, /b\.onclick = \(\) => \{ cur = nextTouchButton\(cur, dir\); setPref\(key, cur\); val\.textContent = labelOf\(cur\); \};/);
  const touch = readFileSync(new URL('../src/ui/touch.js', import.meta.url), 'utf8');
  assert.match(touch, /if \(!slotHeld\.size && !attacking\) layoutCorner\(\);/, 'the poll re-lays the corner, never under a finger');
});

// ─── AUDIT (the batch's audit, agent A) ────────────────────────────────────────────────────────────────────────────

test('AUDIT TOUCH-BUTTONS A1: the Attack slot\'s lift waits two frames - the rig reads the live button once a frame, so a tap lifted before the host\'s frame swung nothing - and a new press in between is its own (mutants: the lift at once; a stale lift letting the new press go)', () => withTouchDom((keys, attach) => {
  setBindings(defaultStore());
  setPref('touchButton1', 'Attack');
  const calls = [];
  const frames = [];
  const prevRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  const step = () => { for (const f of frames.splice(0)) f(); };
  try {
    const h = attach(stubEl(), { look() {}, attack: (dx, dy, held) => calls.push(held) });
    const sword = btn(h, '⚔');
    sword.fire('touchstart', tev('touchstart', 0));
    sword.fire('touchend', tev('touchend', 5));
    assert.deepEqual(calls, [true], 'lifted inside a frame: still held');
    step();
    assert.deepEqual(calls, [true], 'one frame on: the host has read the press');
    step();
    assert.deepEqual(calls, [true, false], 'two frames on: let go');
    sword.fire('touchstart', tev('touchstart', 100));
    sword.fire('touchend', tev('touchend', 105));
    step();
    sword.fire('touchstart', tev('touchstart', 120));   // pressed again before the first lift landed
    step();
    assert.deepEqual(calls, [true, false, true, true], 'the old lift lets nothing go');
    sword.fire('touchend', tev('touchend', 200));
    step(); step();
    assert.equal(calls.at(-1), false, 'and the new one\'s own lift does');
  } finally { globalThis.requestAnimationFrame = prevRaf; }
}));
