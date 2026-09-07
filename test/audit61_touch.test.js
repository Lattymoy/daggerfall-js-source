// AUDIT 61 - THE TOUCH INPUT LANE (TI1), the six holes closed.
//
// F6  the 0.3 s click delay every finger-down armed, which ate the tap
// F7  the pause gate the finger never passed and the mouse always did
// F8  the DEFAULT key codes the layer spoke instead of the bindings
// F9  the mode-cycle button that flipped modes under an open window
// F10 the dial button drawn where Tab opens nothing
// F16/F28 the lock-on: no arm in the world hosts' modal ladders, and a
//     street lock that rode through the shop door
//
// The layer is DOM, so most of this file drives attachTouch against a
// STUB document (the shape enhancedPause.test.js uses): real listeners,
// real synthesized KeyboardEvents, real gesture recognizer, real
// binding registry. What node cannot host - the hosts' 7000-line frame
// loops - is pinned by source text, and every such pin names the
// mutant that kills it.
//
// A PIN MUST FAIL under a mutation that reverts the fix, and it pins
// the REFERENCE's value, never a restatement of the port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createActivateGate, activateFrame, setClickDelay } from '../src/systems/activateGate.js';
import { createLockOn, LOCK_BREAK_DISTANCE } from '../src/player/lockOn.js';
import { LookFilter } from '../src/player/lookFilter.js';
import { HOLD_MS } from '../src/ui/touchGestures.js';
import { attachTouch } from '../src/ui/touch.js';
import { setBindings, held } from '../src/ui/input.js';
import { createBindings, setBinding, clearBinding } from '../src/systems/inputActions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js'];

// ---------------------------------------------------------------
// A DOCUMENT, JUST ENOUGH OF ONE.
// ---------------------------------------------------------------
function stubEl() {
  const n = {
    id: '', textContent: '', children: [], _l: new Map(),
    style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
  return n;
}
/** A touch event as the layer reads it: changedTouches, timeStamp, type. */
const tev = (type, touches, t) => ({
  type, timeStamp: t, preventDefault() {}, stopPropagation() {},
  changedTouches: touches.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
});

// AUDIT 61 (review): the layer's nav-row `setInterval` is cleared by
// dispose() and by nothing else, and the stub window supplies no timer
// so touch.js takes NODE'S real one. A dispose() written as the last
// statement of a test body is SKIPPED when an assertion above it
// throws, and the live interval then holds the event loop open: the
// runner printed the failure and hung forever instead of exiting 1. A
// pin that hangs CI is worse than one that fails, so every layer this
// file attaches is registered here and torn down in a `finally`.
function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];   // every synthesized KeyboardEvent, in order
  const live = [];   // every attachTouch handle, disposed no matter how we leave
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = {
    ontouchstart: null,
    dispatchEvent: (e) => { keys.push(e); return true; },
    prompt: () => null,
  };
  const attach = (canvas, hooks) => { const h = attachTouch(canvas, hooks); live.push(h); return h; };
  try { return fn(keys, attach); } finally {
    for (const h of live) h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
  }
}
/** The default binding rows the layer's five controls stand on. */
function defaultStore() {
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'],
    ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'], ['Space', 'Jump'], ['ShiftLeft', 'Run'],
    ['KeyZ', 'ReadyWeapon'], ['Mouse0', 'ActivateCenterObject']]) setBinding(b, c, a);
  return b;
}
const btn = (h, label) => h.el.children.find((c) => c.textContent === label);
const codesOfLog = (keys, type) => keys.filter((e) => e.type === type).map((e) => e.code);

// ---------------------------------------------------------------
// F6 - the click delay
// ---------------------------------------------------------------
test('AUDIT 61 F6: SetClickDelay is a UI gesture, not a finger - a 0.3 s window really does eat a 120 ms tap, so the touch pointerdown must not arm one (mutant: arm it for a touch pointer)', () => {
  // DFU calls SetClickDelay from exactly two places, both
  // UserInterfaceManager.RemoveWindow's PauseGame(false) arms
  // (UserInterfaceManager.cs:206/:214 -> PlayerActivate.cs:1050-1054).
  // A world click never arms it, and a finger - which holds no pointer
  // lock to re-acquire and presses no Mouse0 - is not even a UI gesture.
  // The consequence, executed against the shipped gate: the release
  // edge is CONSUMED inside the window (`gate.down = down` runs before
  // the delay test), so the activation is destroyed, not deferred.
  const tapRun = (armAt) => {
    const gate = createActivateGate();
    if (armAt != null) setClickDelay(gate, 0.3, armAt);
    // the hosts' two-frame tap, at real seconds: the finger lands at
    // t=0.100 and the release edge falls two 60 Hz frames later.
    activateFrame(gate, { down: true, now: 0.137 });
    return activateFrame(gate, { down: false, now: 0.153 });
  };
  assert.equal(tapRun(0).activate, false, 'armed at the finger-down, a 120 ms tap is swallowed - the defect');
  assert.equal(tapRun(null).activate, true, 'unarmed, the same tap activates - what a phone must get');
  // ...and the mouse relock click the port DOES model still takes it.
  assert.equal(tapRun(0.02).activate, false, 'a click 20 ms before the tap still shuts the window');
});

test('AUDIT 61 F6: the three combat hosts refuse the arm for a touch pointer (mutant: drop the pointerType clause at any one host)', () => {
  for (const h of HOSTS) {
    assert.match(read(h), /if \(e\.pointerType !== 'touch' && document\.pointerLockElement !== canvas\) setClickDelay\(/,
      `${h}: a finger-down must not arm RemoveWindow's click delay`);
  }
});

// ---------------------------------------------------------------
// F7 - the pause gate
// ---------------------------------------------------------------
test('AUDIT 61 F7: under a window the finger\'s look is DROPPED and its held swipe refused, and the swipe in flight is released (mutant: route look/swipe ungated, or bank the delta)', () => {
  // DFU: InputManager.cs:230-236 clears mouseX/mouseY/lookX/lookY every
  // Update and :487-505 returns before currentActions is populated while
  // paused, so no SwingWeapon is seen under a window and the paused
  // frame's delta is discarded; PlayerMouseLook.cs:238-244 returns
  // outright when the game is paused.
  withTouchDom((_keys, attach) => {
    setBindings(defaultStore());
    let paused = false;
    const looks = [], attacks = [], taps = [];
    const canvas = stubEl();
    const h = attach(canvas, {
      look: (dx, dy) => looks.push([dx, dy]),
      attack: (dx, dy, held) => attacks.push([dx, dy, held]),
      tap: (x, y) => taps.push([x, y]),
      paused: () => paused,
    });
    // a HOLD then a drag on the right half: the swipe
    canvas.fire('touchstart', tev('touchstart', [[1, 700, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 704, 301]], HOLD_MS + 20));
    canvas.fire('touchmove', tev('touchmove', [[1, 760, 300]], HOLD_MS + 60));
    assert.equal(attacks.length, 1, 'unpaused, the held swipe is delivered');
    assert.equal(attacks[0][2], true);
    // ...and now a window opens with the finger still down
    paused = true;
    canvas.fire('touchmove', tev('touchmove', [[1, 820, 310]], HOLD_MS + 90));
    canvas.fire('touchmove', tev('touchmove', [[1, 880, 320]], HOLD_MS + 120));
    assert.deepEqual(attacks.slice(1), [[0, 0, false]],
      'exactly ONE synthesized release, and no further swing under the window');
    // the RELEASE is never gated - a window opened mid-swing must let go
    canvas.fire('touchend', tev('touchend', [[1, 880, 320]], HOLD_MS + 140));
    assert.equal(attacks[attacks.length - 1][2], false, 'the finger-up release still lands');

    // a plain drag while paused is a LOOK, and it is dropped, not banked
    looks.length = 0;
    canvas.fire('touchstart', tev('touchstart', [[2, 700, 300]], 1000));
    canvas.fire('touchmove', tev('touchmove', [[2, 780, 320]], 1010));
    canvas.fire('touchmove', tev('touchmove', [[2, 860, 340]], 1020));
    canvas.fire('touchend', tev('touchend', [[2, 860, 340]], 1030));
    assert.deepEqual(looks, [], 'no look delta reaches the host under a window');
    paused = false;
    canvas.fire('touchstart', tev('touchstart', [[3, 700, 300]], 2000));
    canvas.fire('touchmove', tev('touchmove', [[3, 780, 320]], 2010));
    assert.equal(looks.length, 1, 'and the very next unpaused drag is NOT paid the banked residual - only its own delta');
    assert.deepEqual(looks[0], [80 * 2.0, 20 * 2.0], 'TOUCH_LOOK_GAIN on this drag alone');
    canvas.fire('touchend', tev('touchend', [[3, 780, 320]], 2020));

    // the TAP stays ungated on purpose: the hosts' activateGate already
    // refuses it while paused (systems/activateGate.js Fact 5).
    paused = true;
    canvas.fire('touchstart', tev('touchstart', [[4, 700, 300]], 3000));
    canvas.fire('touchend', tev('touchend', [[4, 700, 300]], 3050));
    assert.equal(taps.length, 1, 'the tap is left to the gate that already knows about the pause');
  });
});

test('AUDIT 61 F7: all three hosts hand the layer the SAME predicate their mouse arms carry (mutant: pass only townTalk.overlayActive, which cannot see the modal windows)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /paused: \(\) => gamePaused\(\),/, `${h}: gamePaused() is townTalk's slot OR modes.overlayHeld`);
  }
  assert.match(read('src/scenes/dungeon.js'), /paused: \(\) => !!ctx\.uiOverlayActive,/, 'dungeon: its own mouse predicate');
  assert.match(read('src/ui/touch.js'), /const paused = !!hooks\.paused\?\.\(\);/, 'the gate lives at the one door all three share');
});

// ---------------------------------------------------------------
// F8 - the bindings registry
// ---------------------------------------------------------------
test('AUDIT 61 F8: a touch button presses the ACTION\'s live code, not a frozen default (mutant: synthesize the literal Space/KeyZ/Escape)', () => {
  // Every consumer resolves by ACTION through the registry
  // (InputManager.GetKey's dual-dict fallthrough, :1084), so a control
  // that speaks a literal only works while the default row stands.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'KeyJ', 'Jump');          // the player moves Jump off Space
    setBinding(store, 'KeyM', 'ReadyWeapon');
    setBinding(store, 'F10', 'Escape');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {}, dial: true });
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 0));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['KeyJ'], 'the JUMP button presses whatever Jump is bound to');
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 10));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['KeyJ'], 'and lifts the SAME code');
    keys.length = 0;
    btn(h, 'Z').fire('touchstart', tev('touchstart', [], 20));
    btn(h, 'Z').fire('touchend', tev('touchend', [], 30));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['KeyM'], 'the sheathe button follows ReadyWeapon');
    keys.length = 0;
    btn(h, '≡').fire('touchstart', tev('touchstart', [], 40));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['F10'], 'the menu button follows the Escape ACTION');
    // ...and the DIAL is not an action at all: Tab stays a literal
    keys.length = 0;
    btn(h, '◆').fire('touchstart', tev('touchstart', [], 50));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['Tab'], 'Tab is in no binding table (inputActions ACTIONS), so it is spoken raw');
  });
});

test('AUDIT 61 F8: an UNBOUND action presses nothing - never the old default (mutant: fall back to the default code)', () => {
  // The unbind is deliberate (AddRemovedPrimaryAction, :795-798) and
  // the freed code very likely serves a DIFFERENT action now, so a
  // fallback would be the same defect wearing the fix's clothes.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    clearBinding(store, 'Jump');
    setBinding(store, 'Space', 'Crouch');   // exactly the theft SetBinding models (:727-758)
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 0));
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 10));
    assert.deepEqual(keys, [], 'an unbound JUMP button is inert - it must not crouch');
  });
});

test('AUDIT 61 F8: a COMBO binding is pressed as its two keys, modifier FIRST and released last (mutant: dispatch the packed "ShiftLeft+KeyJ" code)', () => {
  // comboCode packs one string (inputActions.js, GetComboCode
  // :1165-1177) and codeDown answers it only when BOTH halves are in
  // the held set, with the modifier's held-first latch up
  // (InputManager.cs:1695-1711) - so the packed string is a code no
  // host can ever match.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'ShiftLeft+KeyJ', 'Jump');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 0));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['ShiftLeft', 'KeyJ'], 'the modifier goes down first');
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 10));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['KeyJ', 'ShiftLeft'], 'and comes up last');
  });
});

test('AUDIT 61 F8: the stick holds the four move actions and Run, and a rebind mid-hold releases the code it actually pressed (mutant: hardcode KeyW/KeyA/KeyS/KeyD/ShiftLeft, or release the literal list)', () => {
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'ArrowUp', 'MoveForwards');
    setBinding(store, 'ControlLeft', 'Run');
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 220]], 20));   // 80 px up: past RUN_THROW * 56
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['ArrowUp', 'ControlLeft'],
      'forward and the 80% throw press the ACTIONS\' codes');
    // the player rebinds while the finger is still down
    keys.length = 0;
    setBinding(store, 'KeyI', 'MoveForwards');
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 221]], 40));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['ArrowUp'], 'the OLD code lets go');
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['KeyI'], 'the new one takes over - nothing is stranded down');
    keys.length = 0;
    canvas.fire('touchend', tev('touchend', [[1, 200, 221]], 60));
    assert.deepEqual(codesOfLog(keys, 'keyup').sort(), ['ControlLeft', 'KeyI'],
      'the lift releases what the stick HOLDS, not a frozen literal list');
  });
});

test('AUDIT 61 F8 (review): a held BUTTON releases only the keys the stick does not still need - Run + a combo Jump share ShiftLeft (mutant: `upCode(jumpCode)` with no keep set)', () => {
  // The synthesis invariant this layer creates and DFU never has: one
  // physical key can be wanted by two live touch controls at once,
  // because a combo binding decomposes to its two halves
  // (comboCode/GetCombo, InputManager.cs:1165-1177, :1695-1711) and one
  // of those halves is very often the same modifier Run is bound to -
  // ShiftLeft is Run's DEFAULT (InputManager.SetupDefaults). Nothing
  // flags that as a duplicate, because it is not one. Lifting the
  // button used to synthesize `keyup:ShiftLeft` out from under the
  // running stick, and `setStickKey`\'s `cur === code` early-return
  // then never pressed it again: the player walked for the rest of the
  // hold. What DFU guarantees is only that GetKey(ShiftLeft) is true
  // while the key is physically down; the port owes that same truth to
  // the keys it makes up.
  withTouchDom((keys, attach) => {
    const store = defaultStore();
    setBinding(store, 'ShiftLeft+KeyJ', 'Jump');   // Run stays on ShiftLeft
    setBindings(store);
    const canvas = stubEl();
    const h = attach(canvas, { look() {}, attack() {}, tap() {} });
    // full throw: forward + Run
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 220]], 20));
    assert.deepEqual(codesOfLog(keys, 'keydown'), ['KeyW', 'ShiftLeft'], 'the stick holds the run modifier');
    keys.length = 0;
    // ...and now the jump button, whose combo shares that modifier
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 40));
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 60));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['KeyJ'],
      'the jump release lifts its OWN key and leaves the one the stick is holding down');
    keys.length = 0;
    // the stick is still running: a further move at the same throw is a
    // no-op precisely because ShiftLeft never left the held set.
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 221]], 80));
    assert.deepEqual(keys, [], 'nothing is re-pressed, because nothing was lost');
    canvas.fire('touchend', tev('touchend', [[1, 200, 221]], 100));
    assert.deepEqual(codesOfLog(keys, 'keyup').sort(), ['KeyW', 'ShiftLeft'], 'and the lift still releases both');
    // symmetrically: the stick must not tear the key out from under a
    // button that is still held.
    keys.length = 0;
    btn(h, '↑↑').fire('touchstart', tev('touchstart', [], 120));
    canvas.fire('touchstart', tev('touchstart', [[2, 200, 300]], 140));
    canvas.fire('touchmove', tev('touchmove', [[2, 200, 220]], 160));
    keys.length = 0;
    canvas.fire('touchend', tev('touchend', [[2, 200, 220]], 180));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['KeyW'], 'the stick lifts its own axis and leaves the button\'s modifier');
    btn(h, '↑↑').fire('touchend', tev('touchend', [], 200));
    assert.deepEqual(codesOfLog(keys, 'keyup'), ['KeyW', 'KeyJ', 'ShiftLeft'], 'the last holder lets it go');
  });
});

test('AUDIT 61 F8: the tap is the ActivateCenterObject ACTION, read straight into the gate - no synthesized "Mouse0" (mutant: keys.add(\'Mouse0\') back)', () => {
  for (const h of HOSTS) {
    const s = read(h);
    assert.match(s, /down: held\(keys, 'ActivateCenterObject'\) \|\| _tapArmed > 0,/,
      `${h}: a rebind of ActivateCenterObject off Mouse0 must not kill the finger`);
    assert.ok(!/_tapArmed = 2; keys\.add\('Mouse0'\)/.test(s), `${h}: the tap no longer stuffs a literal code into the held set`);
    assert.ok(!/keys\.delete\('Mouse0'\);/.test(s), `${h}: ...and its paired delete is gone with it`);
    assert.match(s, /activateHeld: \(\) => held\(keys, 'ActivateCenterObject'\) \|\| _tapArmed > 0,/,
      `${h}: the drawn bow's un-draw still sees the finger`);
  }
});

// ---------------------------------------------------------------
// F9 - the mode-cycle button
// ---------------------------------------------------------------
test('AUDIT 61 F9: nextMode refuses under a window, on the same predicate the F1-F4 ladder uses (mutant: drop the guard)', () => {
  // DFU reads the four modes through ActionStarted
  // (PlayerActivate.cs:220-228) and a paused InputManager never
  // populates currentActions (InputManager.cs:487-505), while a
  // PauseWhileOpen window pauses on AddWindow
  // (UserInterfaceManager.cs:180-185): no mode change under a window.
  const s = read('src/scenes/townTalk.js');
  const i = s.indexOf('function nextMode()');
  assert.ok(i > 0, 'nextMode exists');
  const body = s.slice(i, i + 1400);
  assert.match(body, /if \(overlay \|\| otherOverlayActive\?\.\(\)\) return getInteractionMode\(\);/,
    'both slots, exactly as the key ladder gates (:320 and otherOverlayActive)');
  assert.ok(body.indexOf('if (overlay || otherOverlayActive?.())') < body.indexOf('setMode('),
    'and the gate comes BEFORE the mode is set');
  // the touch button reads the returned mode as its label, so refusing
  // must answer the CURRENT mode rather than nothing.
  assert.match(read('src/ui/touch.js'), /modeBtn\.textContent = hooks\.cycleMode\(\)/, 'the label is the hook\'s answer');
});

// ---------------------------------------------------------------
// F10 - the dial button's skin
// ---------------------------------------------------------------
test('AUDIT 61 F10: no dial hook, no dial button - and the hosts pass the opener\'s own predicate (mutant: dial: true)', () => {
  withTouchDom((_keys, attach) => {
    setBindings(defaultStore());
    const canvas = stubEl();
    const off = attach(canvas, { look() {}, attack() {}, tap() {}, dial: false });
    assert.equal(btn(off, '◆'), undefined, 'the classic skin draws no door that opens nothing');
    assert.ok(btn(off, '≡'), 'and the menu slides into the vacated slot');
    const on = attach(canvas, { look() {}, attack() {}, tap() {}, dial: true });
    assert.ok(btn(on, '◆'), 'the enhanced skin draws it');
  });
  for (const h of HOSTS) {
    assert.match(read(h), /dial: isEnhanced\(\),/, `${h}: the hook is the OPENER's gate (pixelDial.js refuses off the enhanced skin)`);
  }
  assert.match(read('src/scenes/dungeon.js'), /import \{ isEnhanced \} from '\.\.\/systems\/uiSkin\.js';/, 'dungeon imports it');
});

// ---------------------------------------------------------------
// F16 / F28 - the lock-on
// ---------------------------------------------------------------
test('AUDIT 61 F16: a foe swept from the pool is never flagged dead, so the lock survives it - the transition must break it by hand (mutant: rely on lockOn\'s own breaks)', () => {
  const lock = createLockOn();
  const filter = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  const foe = { ai: { feet: [0, 0, 5], height: 1.8 }, dead: false };
  const pool = [foe];
  lock.lock(foe);
  pool.length = 0;                                   // destroy()/removeFoe empties the pool...
  assert.equal(foe.dead, false, '...without flagging the record dead');
  assert.ok(lock.tick(1 / 60, cam, [0, 1.7, 0], filter), 'so the death break never fires');
  assert.ok(Math.hypot(0, 5) < LOCK_BREAK_DISTANCE, 'and the distance break cannot fire either at door range');
  lock.unlock();
  assert.equal(lock.tick(1 / 60, cam, [0, 1.7, 0], filter), null, 'only an explicit unlock lets go');
  assert.equal(lock.locked, false);
});

test('AUDIT 61 F16/F28: the world hosts publish the lock doors and worldModes arms BOTH modal ladders (mutant: delete either arm, the guard, or the consumption)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(h);
    assert.match(s, /lockToggle: \(foe\) => lockOn\.toggle\(foe\),/, `${h}: the toggle door`);
    assert.match(s, /unlockOn: \(\) => \{ lockOn\.unlock\(\); touch\?\.setLockDot\(null\); \},/, `${h}: the release door, dot and all`);
    assert.match(s, /reportFrame: \(proj, view\) => \{/, `${h}: the modal frame's matrices, for the ray and the dot`);
    // the tick stays UNGATED: an indoor lock must steer and must break
    assert.match(s, /lockOn\.tick\(dt, cam, cam\.pos, lookFilter\);/, `${h}: no mode clause on the tick`);
    assert.ok(!/modeNow\(\) === 'exterior'[^\n]*lockOn\.tick/.test(s), `${h}: the tick must not be gated on the mode`);
  }
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /if \(host\.activateDir\?\.\(\) && interiorCtx\) \{\s*\n\s*const f = pickFoe\(eye, dir, interiorFoePool\(\), interiorCtx\.collider, LOCK_PICK_DISTANCE\);\s*\n\s*if \(f\) \{ host\.lockToggle\?\.\(f\); return true; \}/,
    'the interior ladder locks on a finger tap, over its OWN pool and collider');
  assert.match(wm, /if \(host\.activateDir\?\.\(\) && dungeonCtx\) \{\s*\n\s*const f = pickFoe\(eye, dir, dungeonCtx\.foes, dungeonCtx\.collider, LOCK_PICK_DISTANCE\);\s*\n\s*if \(f\) \{ host\.lockToggle\?\.\(f\); return true; \}/,
    'and so does the world-hosted dungeon - the ladder the classic start runs through');
  // the arm sits AFTER the quest click, whose fall-through must survive
  for (const [arm, quest] of [[wm.indexOf('interiorFoePool(), interiorCtx.collider, LOCK_PICK_DISTANCE'), wm.indexOf('pickQuestFoe(eye, dir, interiorFoePool()')],
    [wm.indexOf('dungeonCtx.foes, dungeonCtx.collider, LOCK_PICK_DISTANCE'), wm.indexOf('pickQuestFoe(eye, dir, dungeonCtx.foes')]]) {
    assert.ok(quest > 0 && arm > quest, 'QG1\'s non-consuming quest arm still runs first');
  }
  assert.match(wm, /host\.reportFrame\?\.\(proj, view\);/, 'the modal frame reports its camera, so the tap ray and the dot stop riding the last street frame');
});

test('AUDIT 61 F8 (review): worldModes\' OWN activate gate sees the finger - its `down` expression is EXECUTED here across the tap\'s two frames (mutant: drop `|| !!host.activateDown?.()`, or stop publishing activateDown from either world host)', () => {
  // THE MACHINE THAT OWNS EVERY DOOR INDOORS. worldModes runs the
  // interior and world-hosted-dungeon activate gate - every shop, every
  // house, and the classic start into Privateer\'s Hold - off a `keys`
  // Set it destructures from its host. While the tap synthesized a
  // literal \'Mouse0\' the press arrived in that shared Set for free;
  // F8 removed the literal and gave the three STANDALONE hosts
  // `_tapArmed > 0`, which is a host-local `let` this module cannot
  // see. The gate is read out of the shipped source and run, so a
  // revert cannot hide behind a text match.
  //
  // The law being pinned is DFU\'s: ActivateCenterObject activates on
  // ActionComplete, the RELEASE edge (PlayerActivate.cs:280,
  // InputManager.cs:634-637) - so a press frame followed by a release
  // frame must produce exactly one activation, and no press frame must
  // produce none.
  const wm = read('src/scenes/worldModes.js');
  const m = /\n\s*down: (.+?),\s*\n\s*hasReadySpell:/.exec(wm);
  assert.ok(m, 'worldModes no longer builds its activate gate with a `down:` input');
  const gateDown = new Function('held', 'keys', 'host', `return (${m[1]});`);
  // the real `held` over the real registry, with NOTHING bound down:
  // the finger is the only press in the room.
  setBindings(defaultStore());
  const keys = new Set();
  // the hosts\' own two-frame countdown (`_tapArmed = 2`, decremented
  // at the top of each frame), published as `activateDown`.
  let tapArmed = 2;
  const host = { activateDown: () => tapArmed > 0 };
  const gate = createActivateGate();
  const step = () => { tapArmed = Math.max(0, tapArmed - 1); return activateFrame(gate, { down: gateDown(held, keys, host) }); };
  assert.equal(gateDown(held, keys, host), true, 'the finger IS a press to this gate');
  assert.equal(step().activate, false, 'the press frame activates nothing - ActionComplete is the release');
  assert.equal(step().activate, true, 'and the release frame fires the activation the door, the shelf and the ladder all hang off');
  assert.equal(step().activate, false, 'once, not once per frame');
  // ...and the same publication feeds the drawn bow\'s un-draw and the
  // dungeon context this machine mounts, which read the finger through
  // `activateHeld` rather than through the gate.
  assert.equal((wm.match(/held\(keys, 'ActivateCenterObject'\) \|\| !!host\.activateDown\?\.\(\)/g) ?? []).length, 3,
    'all three of worldModes\' activate reads take the finger: the gate, interiorWeapon, and the mounted dungeon context');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /activateDown: \(\) => _tapArmed > 0,/, `${h}: publishes the press beside activateDir`);
  }
});

test('AUDIT 61 F16/F28 (review): the modal frame renders, listens and reveals down the CAMERA, never down the tap ray (mutant: `const fwd = eyeDir();`)', () => {
  // DFU builds the activation ray off the screen point with
  // `mainCamera.ScreenPointToRay` (PlayerActivate.cs:283-309) and the
  // camera transform is untouched by it; the automap reveal probe reads
  // `Camera.main.transform.rotation * Vector3.forward` (Automap.cs
  // :1168) and the 3D listener rides the same transform. `eyeDir()`
  // answers the tap\'s ray on the release frame, so reading it for the
  // frame\'s own forward swung the view matrix, the ears and the reveal
  // probe down the finger - and, once the review\'s `reportFrame` seam
  // existed, stored that skewed view for the NEXT tap to unproject
  // through.
  const wm = read('src/scenes/worldModes.js');
  const i = wm.indexOf('  function frame(dt, now) {');
  assert.ok(i > 0, 'the modal frame exists');
  const body = wm.slice(i, wm.indexOf('host.reportFrame?.(proj, view);', i));
  assert.match(body, /const fwd = \[Math\.sin\(cam\.yaw\) \* Math\.cos\(cam\.pitch\), Math\.sin\(cam\.pitch\), Math\.cos\(cam\.yaw\) \* Math\.cos\(cam\.pitch\)\];/,
    'the frame\'s forward is built from the camera\'s own yaw/pitch');
  assert.ok(!/const fwd = eyeDir\(\);/.test(body), 'and never from the activation ray');
  // eyeDir survives - it is the ACTIVATION ladders\' ray and nothing else
  assert.match(wm, /const eyeDir = \(\) => host\.activateDir\?\.\(\) \?\?/, 'the tap ray still reaches the ladders');
  for (const use of ['audio.setListener(cam.pos, fwd)', 'automapTick?.(dt, cam.pos, fwd)']) {
    assert.ok(wm.includes(use), `${use} rides the frame's camera forward`);
  }
});

test('AUDIT 61 F16/F28: EVERY mode change releases the lock (mutant: drop the unlock at any one transition)', () => {
  const wm = read('src/scenes/worldModes.js');
  const lines = wm.split('\n');
  const flips = [];
  lines.forEach((l, i) => { if (/^\s*mode = '(exterior|interior|dungeon)';$/.test(l)) flips.push(i); });
  assert.ok(flips.length >= 5, `every mode assignment is a transition: found ${flips.length}`);
  for (const i of flips) {
    assert.match(lines[i + 1], /host\.unlockOn\?\.\(\);/,
      `the mode flip at worldModes.js:${i + 1} must let the lock go - the foe pool and the coordinate frame both change here`);
  }
  // ...and the sweeps that empty the pool without a death flag
  assert.match(read('src/scenes/world.js'), /cityGuards\.clearLive\(\);\s*\n\s*lockOn\.unlock\(\);/, 'the load/teleport sweep');
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /exteriorFoes\.removeFoe\(f\); \}[\s\S]{0,40}lockOn\.unlock\(\);/, `${h}: ClearEnemies lets the lock go too`);
  }
});
