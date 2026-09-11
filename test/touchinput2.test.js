// TI2 - THE PHONE IN HAND, TUNED (2026-09-11, Mac: "enhance the mobile
// element of DFJS in terms of camera movement, character movement and
// a more phone built feel where it doesnt seem so non-native"). The
// pure halves EXECUTE (ui/touchLook.js, the MoveAxes joystick arm);
// the layer runs against the same stub document AUDIT 62 built; the
// hosts, the pane, the manifest and the prefs are text-pinned. Every
// pin names the mutant that kills it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookNormalisation, analogAxes, gyroLookDelta, TOUCH_REF_HEIGHT, STICK_DEAD_ZONE } from '../src/ui/touchLook.js';
import { MoveAxes, MOVE_ACCELERATION_CONST } from '../src/player/moveAxes.js';
import { attachTouch } from '../src/ui/touch.js';
import { setBindings } from '../src/ui/input.js';
import { createBindings, setBinding } from '../src/systems/inputActions.js';
import { PREF_DEFAULTS, setPref, _resetForTests } from '../src/systems/uiPrefs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---------------------------------------------------------------
// the look normalisation
// ---------------------------------------------------------------
test('TI2 lookNormalisation: 1 at the reference height, the inverse of the height elsewhere, times the clamped sensitivity (mutant: raw pixels, or the ratio upside down)', () => {
  assert.equal(lookNormalisation(TOUCH_REF_HEIGHT), 1, 'the phone TI1b was tuned on feels exactly as it did');
  assert.ok(near(lookNormalisation(TOUCH_REF_HEIGHT * 2), 0.5), 'a canvas twice as tall: half the turn per pixel - the same sweep of the screen turns the same');
  assert.ok(near(lookNormalisation(TOUCH_REF_HEIGHT / 2), 2), 'half as tall: double');
  assert.ok(near(lookNormalisation(TOUCH_REF_HEIGHT, 2), 2), 'the player\'s sensitivity rides on top');
  assert.ok(near(lookNormalisation(TOUCH_REF_HEIGHT, 99), 4), 'clamped at 4');
  assert.ok(near(lookNormalisation(TOUCH_REF_HEIGHT, 0), 1), 'a zero or missing sensitivity is 1, not a dead camera');
  assert.equal(lookNormalisation(0), 1, 'a canvas with no height yet (first frame) is the reference, not Infinity');
});

// ---------------------------------------------------------------
// the analog stick
// ---------------------------------------------------------------
test('TI2 analogAxes: nothing inside the dead zone, the throw rescaled from its edge, y FORWARD for a finger pushed up (mutant: no rescale, dy unflipped, or the dead zone dropped)', () => {
  const R = 56;
  assert.deepEqual(analogAxes(0, 0, R), { x: 0, y: 0, mag: 0 });
  assert.deepEqual(analogAxes(0, -R * (STICK_DEAD_ZONE - 0.01), R), { x: 0, y: 0, mag: 0 }, 'just inside the dead zone: nothing');
  const half = analogAxes(0, -R * (STICK_DEAD_ZONE + (1 - STICK_DEAD_ZONE) / 2), R);
  assert.ok(near(half.mag, 0.5) && near(half.y, 0.5) && near(half.x, 0), `halfway from the dead zone to full throw is half speed: ${JSON.stringify(half)}`);
  const full = analogAxes(0, -R, R);
  assert.ok(near(full.mag, 1) && near(full.y, 1), 'full throw is 1');
  const over = analogAxes(0, -R * 3, R);
  assert.ok(near(over.mag, 1) && near(over.y, 1), 'past the rim clamps at 1');
  const right = analogAxes(R, 0, R);
  assert.ok(near(right.x, 1) && near(right.y, 0), 'right is +x');
  const back = analogAxes(0, R, R);
  assert.ok(near(back.y, -1), 'screen-down is BACKWARD (y forward +)');
  const diag = analogAxes(R, -R, R);
  assert.ok(near(diag.mag, 1) && near(diag.x, Math.SQRT1_2) && near(diag.y, Math.SQRT1_2), 'a diagonal keeps its direction and its unit length');
  assert.deepEqual(analogAxes(10, 10, 0), { x: 0, y: 0, mag: 0 }, 'a zero radius is not a division');
});

// ---------------------------------------------------------------
// the gyro
// ---------------------------------------------------------------
test('TI2 gyroLookDelta: a degree of phone is a degree of camera at 1, in the host\'s look units, mapped by orientation (mutant: a sign, an axis, or the lookScale not divided out)', () => {
  const radPerPx = 0.005;   // LOOK_BASE * the shipped sensitivity 2.0
  // landscape-primary: turning the phone LEFT is +beta (about the short
  // edge, now vertical); the camera must turn left, a negative dx.
  const d = gyroLookDelta({ alpha: 0, beta: 10, gamma: 0 }, 'landscape-primary', 0.1, radPerPx);
  const oneDegreePx = (Math.PI / 180) / radPerPx;   // 10 deg/s over 0.1 s = 1 degree
  assert.ok(near(d.dx, -oneDegreePx) && near(d.dy, 0), `turn: ${JSON.stringify(d)} vs ${-oneDegreePx}`);
  // tilting the phone's face UP is +gamma: a negative dy (the host negates screen-down)
  const t = gyroLookDelta({ alpha: 0, beta: 0, gamma: 10 }, 'landscape-primary', 0.1, radPerPx);
  assert.ok(near(t.dx, 0) && near(t.dy, -oneDegreePx), `tilt: ${JSON.stringify(t)}`);
  // sensitivity 2: two degrees of camera for one of phone
  const s2 = gyroLookDelta({ alpha: 0, beta: 10, gamma: 0 }, 'landscape-primary', 0.1, radPerPx, 2);
  assert.ok(near(s2.dx, -2 * oneDegreePx), 'sensitivity multiplies');
  // the other three orientations
  const sec = gyroLookDelta({ alpha: 0, beta: 10, gamma: 0 }, 'landscape-secondary', 0.1, radPerPx);
  assert.ok(near(sec.dx, oneDegreePx), 'landscape-secondary: the phone is upside down, the sign flips');
  const por = gyroLookDelta({ alpha: 0, beta: 0, gamma: 10 }, 'portrait-primary', 0.1, radPerPx);
  assert.ok(near(por.dx, -oneDegreePx) && near(por.dy, 0), 'portrait: the long edge is vertical, gamma is the turn');
  const porT = gyroLookDelta({ alpha: 0, beta: 10, gamma: 0 }, 'portrait-primary', 0.1, radPerPx);
  assert.ok(near(porT.dy, -oneDegreePx), 'portrait: beta is the tilt');
  // alpha (about the screen normal) is a roll: never a look
  const roll = gyroLookDelta({ alpha: 90, beta: 0, gamma: 0 }, 'landscape-primary', 0.1, radPerPx);
  assert.ok(roll.dx === 0 && roll.dy === 0, `a roll is no look: ${JSON.stringify(roll)}`);
  // the guards
  assert.deepEqual(gyroLookDelta(null, 'landscape-primary', 0.1, radPerPx), { dx: 0, dy: 0 });
  assert.deepEqual(gyroLookDelta({ beta: 10 }, 'landscape-primary', 0, radPerPx), { dx: 0, dy: 0 }, 'no interval, no integration');
  assert.deepEqual(gyroLookDelta({ beta: 10 }, 'landscape-primary', 0.1, 0), { dx: 0, dy: 0 }, 'a zero lookScale is not a division');
  // the host multiplies by lookScale: the round trip is the radians
  assert.ok(near(d.dx * radPerPx, -(Math.PI / 180)), 'lookScale puts the radians back');
});

// ---------------------------------------------------------------
// the joystick arm of MoveAxes
// ---------------------------------------------------------------
test('TI2 MoveAxes: an analog reading replaces the key impulse on its axis - the axis IS the throw without acceleration (mutant: keys summed on top, or analog ignored)', () => {
  const m = new MoveAxes();
  const off = { acceleration: false };
  assert.deepEqual(m.update(1 / 60, { forwards: true, analog: { x: 0, y: 0.5 } }, off), { forward: 0.5, strafe: 0 }, 'a half throw is half, even with the stick\'s own key down');
  assert.deepEqual(m.update(1 / 60, { forwards: true, analog: { x: -0.25, y: 0 } }, off), { forward: 1, strafe: -0.25 }, 'a zero analog component leaves that axis to the keys');
  assert.deepEqual(m.update(1 / 60, { forwards: true, analog: null }, off), { forward: 1, strafe: 0 }, 'null analog is the key path, verbatim');
  assert.deepEqual(m.update(1 / 60, { forwards: true }, off), { forward: 1, strafe: 0 }, 'and so is its absence');
  assert.deepEqual(m.update(1 / 60, { analog: { x: 2, y: -3 } }, off), { forward: -1, strafe: 1 }, 'clamped to the unit square');
});

test('TI2 MoveAxes under acceleration: the axis climbs toward the throw at 9.8/s and SETTLES there, friction leaving it alone (mutant: force() rails it to 1, or the impulse flag not raised)', () => {
  const m = new MoveAxes();
  const on = { acceleration: true };
  const dt = 1 / 60;
  let r = m.update(dt, { analog: { x: 0, y: 0.5 } }, on);
  assert.ok(near(r.forward, MOVE_ACCELERATION_CONST * dt), 'the first frame climbs one step');
  for (let i = 0; i < 120; i++) r = m.update(dt, { forwards: true, analog: { x: 0, y: 0.5 } }, on);
  assert.ok(near(r.forward, 0.5), `two seconds later it is AT the throw, not the rail: ${r.forward}`);
  // ease the throw back: it decays toward the new target, never below it
  for (let i = 0; i < 120; i++) r = m.update(dt, { forwards: true, analog: { x: 0, y: 0.2 } }, on);
  assert.ok(near(r.forward, 0.2), `a smaller throw is followed down: ${r.forward}`);
  // let go: friction takes it to 0 as a key release would
  for (let i = 0; i < 120; i++) r = m.update(dt, { analog: null }, on);
  assert.equal(r.forward, 0);
  // a negative throw raises the negative flag, so friction does not fight it
  for (let i = 0; i < 120; i++) r = m.update(dt, { analog: { x: -0.7, y: -0.3 } }, on);
  assert.ok(near(r.strafe, -0.7) && near(r.forward, -0.3), `both signs settle: ${JSON.stringify(r)}`);
});

// ---------------------------------------------------------------
// the layer, executed against AUDIT 62's stub document
// ---------------------------------------------------------------
function stubEl() {
  const n = {
    id: '', textContent: '', children: [], _l: new Map(), value: '',
    style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
  return n;
}
const tev = (type, touches, t) => ({
  type, timeStamp: t, preventDefault() {}, stopPropagation() {},
  changedTouches: touches.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
});
function withTouchDom(fn) {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  const live = [];
  const motion = [];   // devicemotion listeners added/removed on the window
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  globalThis.window = {
    ontouchstart: null,
    dispatchEvent: (e) => { keys.push(e); return true; },
    addEventListener: (t, f) => { if (t === 'devicemotion') motion.push(['add', f]); },
    removeEventListener: (t, f) => { if (t === 'devicemotion') motion.push(['remove', f]); },
  };
  _resetForTests();
  const attach = (canvas, hooks) => { const h = attachTouch(canvas, hooks); live.push(h); return h; };
  try { return fn({ keys, attach, motion }); } finally {
    for (const h of live) h?.dispose?.();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    _resetForTests();
  }
}
function defaultStore() {
  const b = createBindings();
  for (const [c, a] of [['Escape', 'Escape'], ['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'],
    ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'], ['Space', 'Jump'], ['ShiftLeft', 'Run'],
    ['KeyZ', 'ReadyWeapon'], ['Mouse0', 'ActivateCenterObject']]) setBinding(b, c, a);
  return b;
}

test('TI2 touch.js: the handle\'s axes() is the throw while the stick is engaged and the pref is on, null otherwise; the keys are still synthesized beside it (mutant: axes() without the pref gate, or the keys dropped)', () => {
  withTouchDom(({ keys, attach }) => {
    setBindings(defaultStore());
    const canvas = stubEl();
    const h = attach(canvas, { look: () => {} });
    assert.equal(h.axes(), null, 'at rest: null, so the host\'s MoveAxes takes the key path');
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 300]], 0));
    assert.deepEqual(h.axes(), { x: 0, y: 0 }, 'engaged, unmoved: a zero throw');
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 300 - 56 * 0.625]], 20));   // halfway from the dead zone to the rim
    const a = h.axes();
    assert.ok(near(a.y, 0.5) && near(a.x, 0), `half throw forward: ${JSON.stringify(a)}`);
    assert.ok(keys.some((e) => e.type === 'keydown' && e.code === 'KeyW'), 'and the W key went down for the anim and reportInput');
    canvas.fire('touchmove', tev('touchmove', [[1, 200 + 56, 300]], 40));
    const b = h.axes();
    assert.ok(near(b.x, 1) && near(b.y, 0), `full throw right: ${JSON.stringify(b)}`);
    setPref('touchAnalogStick', false);
    assert.equal(h.axes(), null, 'the pref off: null mid-hold, the host falls back to the keys it already has');
    setPref('touchAnalogStick', true);
    canvas.fire('touchend', tev('touchend', [[1, 256, 300]], 60));
    assert.equal(h.axes(), null, 'released: null');
    assert.ok(keys.some((e) => e.type === 'keyup' && e.code === 'KeyD'), 'the key lifted');
  });
});

test('TI2 touch.js: the look is height-normalised through hooks.look (mutant: raw pixels)', () => {
  withTouchDom(({ attach }) => {
    setBindings(defaultStore());
    const looks = [];
    const canvas = stubEl();   // 600 tall against the 400 reference
    attach(canvas, { look: (dx, dy) => looks.push([dx, dy]) });
    canvas.fire('touchstart', tev('touchstart', [[1, 700, 300]], 0));
    canvas.fire('touchmove', tev('touchmove', [[1, 760, 330]], 10));
    assert.equal(looks.length, 1);
    const norm = TOUCH_REF_HEIGHT / 600;
    assert.ok(near(looks[0][0], 60 * 2.0 * norm) && near(looks[0][1], 30 * 2.0 * norm), `${looks[0]}`);
    setPref('touchLookSensitivity', 2);
    canvas.fire('touchmove', tev('touchmove', [[1, 820, 330]], 20));
    assert.ok(near(looks[1][0], 60 * 2.0 * norm * 2), 'the player\'s sensitivity, read at the move');
    canvas.fire('touchend', tev('touchend', [[1, 820, 330]], 30));
  });
});

test('TI2 touch.js: a FIXED stick answers only a finger near its centre - a far touch on the left half is the classifier\'s, a look or a tap, never a key (mutant: origin under the finger regardless, or the far touch dropped)', () => {
  withTouchDom(({ keys, attach }) => {
    setBindings(defaultStore());
    setPref('touchStickAnchor', 'fixed');
    const taps = [], looks = [];
    const canvas = stubEl();
    const h = attach(canvas, { look: (dx, dy) => looks.push([dx, dy]), tap: (x, y) => taps.push([x, y]) });
    // the fixed centre on the 1000x600 stub: (36+56, 600-36-56) = (92, 508)
    canvas.fire('touchstart', tev('touchstart', [[1, 200, 100]], 0));   // far from it
    canvas.fire('touchmove', tev('touchmove', [[1, 200, 40]], 20));
    assert.equal(keys.filter((e) => e.type === 'keydown').length, 0, 'no key: the finger is nowhere near the stick');
    assert.equal(h.axes(), null);
    assert.equal(looks.length, 1, 'the drag is a LOOK, as it would be on the right half');
    canvas.fire('touchend', tev('touchend', [[1, 200, 40]], 40));
    canvas.fire('touchstart', tev('touchstart', [[5, 300, 100]], 50));   // far, still, short: the tap TI1b promised the left half
    canvas.fire('touchend', tev('touchend', [[5, 300, 100]], 90));
    assert.deepEqual(taps, [[300, 100]], 'a foe left of centre is still lockable');
    // near it: the origin is the CENTRE, so a finger 30 px right of it is already a throw
    canvas.fire('touchstart', tev('touchstart', [[2, 122, 508]], 100));
    canvas.fire('touchmove', tev('touchmove', [[2, 123, 508]], 110));
    assert.ok(keys.some((e) => e.type === 'keydown' && e.code === 'KeyD'), 'right of the centre is MoveRight at once');
    const a = h.axes();
    assert.ok(a && a.x > 0.05 && near(a.y, 0), `the throw is the offset from the centre: ${JSON.stringify(a)}`);
    canvas.fire('touchend', tev('touchend', [[2, 123, 508]], 120));
    setPref('touchStickAnchor', 'float');
  });
});

test('TI2 touch.js: the gyro listener follows the pref, and dispose removes it (mutant: listener always on, or leaked)', () => {
  withTouchDom(({ attach, motion }) => {
    setBindings(defaultStore());
    const canvas = stubEl();
    const h = attach(canvas, { look: () => {} });
    assert.deepEqual(motion, [], 'off by default: no listener');
    setPref('touchGyroLook', true);
    // the pref is polled on the nav timer; the layer exposes no poke,
    // so the handle is disposed and re-attached to read it at boot.
    h.dispose();
    const h2 = attach(canvas, { look: () => {} });
    assert.equal(motion.length, 1); assert.equal(motion[0][0], 'add');
    h2.dispose();
    assert.equal(motion.length, 2); assert.equal(motion[1][0], 'remove');
    assert.equal(motion[1][1], motion[0][1], 'the same function is removed');
    setPref('touchGyroLook', false);
  });
});

// ---------------------------------------------------------------
// the text pins
// ---------------------------------------------------------------
test('TI2 pins: the layer\'s chrome - safe-area edges, the inline name field, no window.prompt, the fullscreen ask from the first touch, haptics through the pref (mutant: any one back to TI1)', () => {
  const s = read('src/ui/touch.js');
  assert.match(s, /const edge = \(side, px\) => `\$\{side\}:calc\(\$\{px\}px \+ env\(safe-area-inset-\$\{side\}, 0px\)\)`;/, 'the safe-area helper');
  assert.doesNotMatch(s, /'(left|right|top|bottom):\d+px'/, 'no control is placed by a bare pixel edge any more');
  assert.doesNotMatch(s, /window\.prompt\(/, 'the native prompt is gone');
  assert.match(s, /entry = document\.createElement\('input'\);/, 'an inline field raises the phone\'s keyboard');
  assert.match(s, /askFullscreen\(\); askMotion\(\);\s+\/\/ TI2: the first touch is the user gesture both need/, 'fullscreen and motion are asked from the canvas touchstart');
  assert.match(s, /if \(fsAsked \|\| !getPref\('touchFullscreen'\)\) return;/, 'asked once, and only under the pref');
  assert.match(s, /if \(!getPref\('touchHaptics'\)\) return;\s*\n\s*try \{ navigator\.vibrate\?\.\(ms\); \}/, 'haptics through the pref, on a platform that has them');
  assert.match(s, /if \(!swiping\) buzz\(15\);/, 'the hold that arms a swipe is felt');
  assert.match(s, /if \(dot\.style\.display !== 'block'\) buzz\(20\);/, 'the lock landing is felt, once');
  assert.match(s, /hooks\.look\?\.\(ev\.dx \* TOUCH_LOOK_GAIN \* lookNorm\(\), ev\.dy \* TOUCH_LOOK_GAIN \* lookNorm\(\)\)/, 'the drag is normalised');
  assert.match(s, /gyroLookDelta\(e\.rotationRate, globalThis\.screen\?\.orientation\?\.type \?\? 'landscape-primary', dt, lookScale\(\), getPref\('touchGyroSensitivity'\)\)/, 'the gyro divides the host\'s lookScale out');
  assert.match(s, /if \(!\(dt > 0\) \|\| dt > GYRO_MAX_DT \|\| hooks\.paused\?\.\(\)\) return;/, 'a motion sample under a window is dropped, like a drag (AUDIT 62 F7)');
  assert.match(s, /axes: \(\) => \(stickId !== null && getPref\('touchAnalogStick'\) \? \{ x: stickX, y: stickY \} : null\)/, 'the handle publishes the throw under the pref');
});

test('TI2 pins: the hosts hand the throw to MoveAxes beside the held keys, the modal frames through the host seam (mutant: a host dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.match(read(h), /const mv = moveHeld\(keys\);\s*\n\s*mv\.analog = touch\?\.axes\(\) \?\? gamepad\?\.axes\(\) \?\? null;/, `${h}: the reading rides the same bag (GP1: the pad's stick behind the finger's)`);
  }
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /stickAxes: \(\) => touch\?\.axes\(\) \?\? gamepad\?\.axes\(\) \?\? null,/, `${h}: the modal frames' seam`);
  }
  assert.match(read('src/scenes/worldModes.js'), /const mv = moveHeld\(keys\);\s*\n\s*mv\.analog = host\.stickAxes\?\.\(\) \?\? null;/, 'worldModes reads it through the host');
  const ax = read('src/player/moveAxes.js');
  assert.match(ax, /const toward = \(axis, target\) => axis \+ clamp\(target - axis, -MOVE_ACCELERATION_CONST \* dt, MOVE_ACCELERATION_CONST \* dt\);/, 'the throw is a TARGET under acceleration');
  assert.match(ax, /this\.horizontal = ax !== 0 \? ax : \(held\.right \? 1 : 0\) - \(held\.left \? 1 : 0\);/, 'and the axis itself without');
});

test('TI2 pins: the prefs shelf carries the touch knobs with their shipped answers; the Touch card mounts only where the device reports touch (mutant: a default flipped, or the card unconditional)', () => {
  assert.equal(PREF_DEFAULTS.touchLookSensitivity, 1);
  assert.equal(PREF_DEFAULTS.touchAnalogStick, true, 'analog by default: the throw is the speed');
  assert.equal(PREF_DEFAULTS.touchStickAnchor, 'float', 'TI1\'s stick, born under the finger');
  assert.equal(PREF_DEFAULTS.touchGyroLook, false, 'gyro is opt-in: it asks permission and it moves the camera on its own');
  assert.equal(PREF_DEFAULTS.touchGyroSensitivity, 1);
  assert.equal(PREF_DEFAULTS.touchHaptics, true);
  assert.equal(PREF_DEFAULTS.touchFullscreen, true);
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /import \{ isTouchDevice \} from '\.\/touch\.js';/);
  assert.match(menu, /if \(isTouchDevice\(\)\) \{\s*\n\s*const touch = el\('div', 'card'\);\s*\n\s*touch\.append\(el\('h3', null, 'Touch'\)\);/, 'the card is gated');
  for (const key of ['touchLookSensitivity', 'touchAnalogStick', 'touchStickAnchor', 'touchGyroLook', 'touchGyroSensitivity', 'touchHaptics', 'touchFullscreen']) {
    assert.ok(menu.includes(`'${key}'`), `${key} has a control`);
  }
  assert.match(menu, /onChange: \(on\) => \{ if \(on\) \{ try \{ globalThis\.DeviceMotionEvent\?\.requestPermission\?\.\(\)/, 'the gyro switch asks iOS from the click, the one gesture it accepts');
});

test('TI2 pins: the manifest makes the game page a home-screen app - fullscreen, landscape, its icons on disk; the landing page references no file (mutant: the link dropped, an icon missing, or the landing page pointing at one)', () => {
  const game = read('play/index.html');
  assert.match(game, /<link rel="manifest" href="\.\.\/manifest\.webmanifest" \/>/, 'the game page links the manifest one directory up');
  assert.match(game, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/, 'Safari\'s spelling');
  assert.match(game, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" \/>/);
  assert.match(game, /<link rel="apple-touch-icon" href="\.\.\/icons\/icon-192\.png" \/>/);
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.start_url, './play/', 'the app opens on the game, not the landing page');
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
  assert.ok(m.icons.length >= 3 && m.icons.some((i) => i.purpose === 'maskable'), 'an icon for each size and a maskable one');
  for (const i of m.icons) assert.ok(existsSync(join(root, 'public', i.src)), `${i.src} is committed`);
  const landing = read('index.html');
  assert.doesNotMatch(landing, /manifest\.webmanifest|apple-touch-icon/, 'the landing page names no file (test/landing.test.js\'s own law)');
  assert.match(landing, /<meta name="theme-color" content="#0a0c11" \/>/, 'but wears the chrome colour');
  assert.ok(existsSync(join(root, 'scripts/makeIcons.mjs')), 'the icons are reproducible');
});
