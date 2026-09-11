// GP1 (2026-09-11): THE GAMEPAD LAYER. InputManager.cs's joystick law
// EXECUTES against its mutants - the browser pad in Unity's frame, the
// axis keys, the movement stick, the camera stick, the look rate, the
// scroll, the cursor step - and the bindings store's three joystick
// dicts round-trip through KeyBindData_v1. The poller runs against a
// fake pad and a captured dispatch; the hosts are text-pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AXIS_ACTIONS, JOYSTICK_UI_ACTIONS, DEFAULT_AXIS_BINDINGS, DEFAULT_JOYSTICK_UI, AXIS_KEY_BASE, NUM_AXES, UNITY_AXIS_DEAD,
  axisOfKey, axisKeyName, parseAxisKeyName, isAxisKeyName, axisNumber, axisKeyDown, unityAxes, unityButtons,
  movementAxes, cameraAxes, controllerLookDegrees, controllerSmoothing, cursorStep, uiScrollMovement, controllerSettings,
} from '../src/systems/gamepad.js';
import {
  createBindings, resetDefaults, serializeKeyBinds, loadKeyBinds, setBinding,
  getAxisBinding, setAxisBinding, clearAxisBinding, getJoystickUIBinding, setJoystickUIBinding, clearJoystickUIBinding,
  getAxisInversion, setAxisInversion, isUsedInAxisBinding,
} from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad, pickPad, SWING_PX_PER_SEC } from '../src/ui/gamepadInput.js';
import { controllerLook, setControllerLook, LookFilter } from '../src/player/lookFilter.js';
import { setValue, _resetForTests, LIVE, UNAVAILABLE } from '../src/systems/settings.js';
import { lookScale } from '../src/ui/lookSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('GP1 axis keys: the synthetic KeyCodes from 5000 - two per axis, even positive, odd negative, sixteen axes and no more; the names round-trip; a key polls its axis by sign (mutant: the halves swapped)', () => {
  assert.equal(axisKeyName(5000), 'JoystickAxis1Button0');
  assert.equal(axisKeyName(5001), 'JoystickAxis1Button1');
  assert.equal(axisKeyName(5030), 'JoystickAxis16Button0');
  assert.equal(axisKeyName(5032), '', 'past the sixteen');
  assert.equal(axisKeyName(4999), '', 'below the base');
  assert.equal(axisOfKey(5007), 'Axis4');
  for (let k = AXIS_KEY_BASE; k < AXIS_KEY_BASE + NUM_AXES * 2; k++) assert.equal(parseAxisKeyName(axisKeyName(k)), k);
  assert.equal(parseAxisKeyName('JoystickAxis17Button0'), null);
  assert.equal(parseAxisKeyName('JoystickButton3'), null);
  assert.ok(isAxisKeyName('JoystickAxis9Button1') && !isAxisKeyName('KeyW'));
  assert.equal(axisNumber('Axis12'), 12); assert.equal(axisNumber('Axis0'), 0); assert.equal(axisNumber('Mouse X'), 0);
  const axes = new Float32Array(NUM_AXES + 1); axes[9] = 0.7; axes[10] = -0.4;
  assert.ok(axisKeyDown(axes, 5016) && !axisKeyDown(axes, 5017), 'Axis9 positive: Button0 down, Button1 up');
  assert.ok(!axisKeyDown(axes, 5018) && axisKeyDown(axes, 5019), 'Axis10 negative: Button1 down');
  assert.ok(!axisKeyDown(axes, 5000) && !axisKeyDown(axes, 12), 'a still axis and a plain key answer false');
});

test('GP1 the pad in Unity\'s frame: sticks on 1/2 and 4/5 with Y flipped up-positive, triggers on 3 combined and 9/10 apart, the d-pad on 6/7, the asset\'s 0.19 dead zone a clip, and the face, bumpers, back/start and stick clicks as JoystickButton0-9 (mutant: a Y axis unflipped, or the dead zone rescaled)', () => {
  const pad = { axes: [0.5, -0.8, -0.3, 0.6], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  pad.buttons[6] = { pressed: true, value: 0.9 }; pad.buttons[7] = { pressed: true, value: 0.25 };
  pad.buttons[12] = { pressed: true, value: 1 }; pad.buttons[14] = { pressed: true, value: 1 };
  const a = unityAxes(pad);
  const f32 = (x, y) => near(x, y, 1e-6);   // a Float32Array
  assert.ok(f32(a[1], 0.5) && f32(a[2], 0.8) && f32(a[4], -0.3) && f32(a[5], -0.6), `sticks: ${Array.from(a.slice(1, 6))}`);
  assert.ok(f32(a[3], 0.65) && f32(a[9], 0.9) && f32(a[10], 0.25), 'triggers');
  assert.ok(f32(a[6], -1) && f32(a[7], 1), 'd-pad left and up');
  assert.equal(unityAxes({ axes: [0.18, -0.18, 0.19, 0] })[1], 0, 'inside the dead zone is nothing');
  assert.ok(near(unityAxes({ axes: [0.19, 0, 0, 0] })[1], 0.19, 1e-6), 'at the edge the value stands - Unity clips, it does not rescale');
  assert.equal(UNITY_AXIS_DEAD, 0.19);
  for (const b of [0, 1, 2, 3, 4, 5, 8, 9, 10, 11]) pad.buttons[b] = { pressed: true, value: 1 };
  assert.deepEqual([...unityButtons(pad)].sort(), ['JoystickButton0', 'JoystickButton1', 'JoystickButton2', 'JoystickButton3', 'JoystickButton4', 'JoystickButton5', 'JoystickButton6', 'JoystickButton7', 'JoystickButton8', 'JoystickButton9'].sort());
  assert.deepEqual(unityAxes(null).length, NUM_AXES + 1); assert.equal(unityButtons(null).size, 0);
});

test('GP1 the movement stick (FindInputAxisActions): null inside the radial dead zone, each axis ±dist over the threshold capped at 1 (the diagonal FULL on both), the four actions raised, backwards clearing autorun, the inversions per axis (mutant: a unit vector, or the cap dropped)', () => {
  assert.equal(movementAxes(0, 0), null);
  assert.equal(movementAxes(0.05, 0.05, { deadzone: 0.1 }), null, 'hypot 0.07 <= 0.1');
  const m = movementAxes(0.45, 0.45, { deadzone: 0.1, threshold: 0.9 });
  assert.ok(near(m.x, 0.7071067811865476, 1e-9) && near(m.y, m.x), 'dist = hypot / threshold on BOTH axes');
  assert.deepEqual(m.actions, ['MoveRight', 'MoveForwards']); assert.equal(m.clearsAutorun, false);
  const full = movementAxes(-0.9, -0.9, { deadzone: 0.1, threshold: 0.9 });
  assert.ok(full.x === -1 && full.y === -1 && full.clearsAutorun, 'capped at 1, and backwards clears the latch');
  assert.deepEqual(full.actions, ['MoveLeft', 'MoveBackwards']);
  assert.equal(movementAxes(0.3, 0, { deadzone: 0.1, threshold: 0.9, maximize: true }).x, 1, 'MaximizeJoystickMovement');
  const inv = movementAxes(0.5, 0.5, { deadzone: 0.1, threshold: 1, invertH: true, invertV: true });
  assert.deepEqual(inv.actions, ['MoveLeft', 'MoveBackwards']);
  assert.ok(near(movementAxes(0.3, 0, { threshold: 0.9 }).x, 1 / 3));
});

test('GP1 the camera stick, the look rate, the smoothing floor, the scroll and the cursor step (mutant: the mouse setting leaking into the joystick rate)', () => {
  assert.deepEqual(cameraAxes(0.05, 0.05, { deadzone: 0.1 }), { x: 0, y: 0 });
  assert.deepEqual(cameraAxes(0.5, -0.25, { deadzone: 0.1 }), { x: 0.5, y: -0.25 });
  assert.deepEqual(cameraAxes(0.5, -0.25, { deadzone: 0.1, invertH: true, invertV: true }), { x: -0.5, y: 0.25 });
  assert.ok(near(controllerLookDegrees(1, 1, 1), 120), 'a full stick at 1.0 is 120 degrees a second');
  assert.ok(near(controllerLookDegrees(0.5, 1 / 60, 2), 2), 'half a stick at 2.0 over a 60th: 2 degrees');
  assert.equal(controllerSmoothing(0.2), 0.5); assert.equal(controllerSmoothing(0.8), 0.8);
  assert.equal(uiScrollMovement(0.05, 0.05, { deadzone: 0.1 }), 0);
  assert.ok(near(uiScrollMovement(0.3, 0.6, { deadzone: 0.1 }), -0.3), 'horizontal + (-vertical): a stick tilted up scrolls up');
  const c = cursorStep(0.5, -1, 1 / 60, 2);
  assert.ok(near(c.dx, 15) && near(c.dy, -30), '2 * 900 * axis * dt');
});

test('GP1 the store: defaults (Axis1/2 movement, Axis4/5 camera, A/Y/X/B the four UI buttons, no inversions), single-bind setters that clear the action\'s old home, the autofill that fills only a missing action, and a KeyBindData_v1 round trip with an older file\'s absent blocks (mutant: a block dropped from the serializer, or an unknown action thrown on)', () => {
  const s = createBindings(); resetDefaults(s);
  assert.deepEqual([...s.axisActions], DEFAULT_AXIS_BINDINGS.map((r) => [...r]));
  assert.deepEqual([...s.joystickUI], DEFAULT_JOYSTICK_UI.map((r) => [...r]));
  for (const a of AXIS_ACTIONS) assert.equal(getAxisInversion(s, a), false);
  assert.equal(getAxisBinding(s, 'CameraVertical'), 'Axis5');
  assert.equal(getJoystickUIBinding(s, 'Back'), 'JoystickButton1');
  setAxisBinding(s, 'Axis4', 'MovementHorizontal');
  assert.equal(getAxisBinding(s, 'MovementHorizontal'), 'Axis4', 'moved');
  assert.equal(getAxisBinding(s, 'CameraHorizontal'), '', 'Axis4 was stolen from the camera');
  assert.equal(s.axisActions.has('Axis1'), false, 'and the old axis is cleared');
  setJoystickUIBinding(s, 'JoystickButton1', 'LeftClick');
  assert.equal(getJoystickUIBinding(s, 'LeftClick'), 'JoystickButton1');
  assert.equal(getJoystickUIBinding(s, 'Back'), null, 'stolen');
  setAxisInversion(s, 'CameraVertical', true);
  assert.ok(isUsedInAxisBinding(s, 'JoystickAxis4Button0') && !isUsedInAxisBinding(s, 'JoystickAxis9Button0') && !isUsedInAxisBinding(s, 'KeyW'));
  // autofill: only the MISSING actions come back - and DFU's TestSetAxisBinding
  // (:1427-1432) fills a missing action through SetAxisBinding, which
  // takes the default axis back from whoever holds it: the moved
  // MovementHorizontal LOSES Axis4 to the missing CameraHorizontal and
  // ends unbound. The quirk is the law (a player who moved a stick and
  // then updated finds the camera home and the movement gone).
  resetDefaults(s, true);
  assert.equal(getAxisBinding(s, 'CameraHorizontal'), 'Axis4', 'the missing action takes its default axis back');
  assert.equal(getAxisBinding(s, 'MovementHorizontal'), '', 'and the action that held it is unbound - DFU\'s own quirk');
  assert.equal(getJoystickUIBinding(s, 'Back'), 'JoystickButton1', 'the same on the buttons');
  assert.equal(getJoystickUIBinding(s, 'LeftClick'), null);
  assert.equal(getAxisInversion(s, 'CameraVertical'), true, 'an inversion the file said survives autofill');
  // the round trip
  const data = serializeKeyBinds(s);
  assert.deepEqual(data.axisActionKeyBinds, { Axis2: 'MovementVertical', Axis5: 'CameraVertical', Axis4: 'CameraHorizontal' });
  assert.deepEqual(data.axisActionInversions, { MovementHorizontal: 'False', MovementVertical: 'False', CameraHorizontal: 'False', CameraVertical: 'True' });
  assert.deepEqual(data.joystickUIKeyBinds, { JoystickButton3: 'RightClick', JoystickButton2: 'MiddleClick', JoystickButton1: 'Back' });
  const t = createBindings(); loadKeyBinds(t, JSON.parse(JSON.stringify(data)));
  assert.deepEqual(serializeKeyBinds(t).axisActionKeyBinds, data.axisActionKeyBinds);
  assert.deepEqual(serializeKeyBinds(t).joystickUIKeyBinds, data.joystickUIKeyBinds);
  assert.equal(getAxisInversion(t, 'CameraVertical'), true);
  // an older file: no blocks at all, then the autofill fills the defaults
  const u = createBindings(); loadKeyBinds(u, { actionKeyBinds: { KeyW: 'MoveForwards' }, secondaryActionKeyBinds: {}, removedPrimaryActions: [] });
  assert.equal(u.axisActions.size, 0); resetDefaults(u, true); assert.equal(getAxisBinding(u, 'CameraHorizontal'), 'Axis4');
  // unknown names are dropped, not thrown
  const v = createBindings(); loadKeyBinds(v, { axisActionKeyBinds: { Axis3: 'Warp' }, joystickUIKeyBinds: { JoystickButton5: 'Fly' }, axisActionInversions: { Warp: 'True' } });
  assert.equal(v.axisActions.size, 0); assert.equal(v.joystickUI.size, 0); assert.equal(v.axisInversions.size, 0);
  // a full reset brings the stolen defaults home
  resetDefaults(s); assert.equal(getAxisBinding(s, 'CameraHorizontal'), 'Axis4'); assert.equal(getAxisBinding(s, 'MovementHorizontal'), 'Axis1'); assert.equal(getJoystickUIBinding(s, 'LeftClick'), 'JoystickButton0');
  clearAxisBinding(s, 'CameraHorizontal'); assert.equal(getAxisBinding(s, 'CameraHorizontal'), '');
  clearJoystickUIBinding(s, 'Back'); assert.equal(getJoystickUIBinding(s, 'Back'), null);
});

test('GP1 the poller: buttons and bound axis keys become synthetic keys by Unity name, the movement stick presses the bound move codes and hands its throw to axes(), the UI buttons are the mouse\'s, Back is Escape only under a window, the camera stick pays the look in the hook\'s units, a swing rides the camera stick, the pad becomes the live device until the mouse moves, and everything releases when the pad goes or the setting turns off (mutant: a release dropped)', () => {
  const prev = { w: globalThis.window };
  const listeners = {};
  globalThis.window = { addEventListener: (t, f) => { (listeners[t] ??= []).push(f); }, removeEventListener: () => {}, dispatchEvent: () => {} };
  const store = createBindings(); resetDefaults(store); setBindings(store);
  setBinding(store, 'JoystickAxis10Button0', 'SwingWeapon', false);   // a trigger as a secondary swing key
  const events = []; const dispatch = (type, code) => events.push(`${type}:${code}`);
  const looks = [], attacks = []; let overlay = false;
  let pads = [];
  try {
    _resetForTests();
    const gp = attachGamepad({}, { look: (dx, dy) => looks.push([dx, dy]), attack: (dx, dy, held) => attacks.push([dx, dy, held]), overlayActive: () => overlay }, { getPads: () => pads, dispatch });
    assert.ok(gp, 'the API is there');
    gp.tick(1 / 60);
    assert.deepEqual(events, [], 'no pad, nothing');
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    pads = [pad];
    // a face button and a bumper
    pad.buttons[4].pressed = true; pad.buttons[3].pressed = true;
    gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickButton4') && events.includes('keydown:JoystickButton3'), `by Unity name: ${events}`);
    assert.ok(events.includes('keydown:Mouse1'), 'Y is RightClick is Mouse1 (SwingWeapon)');
    assert.deepEqual(attacks.at(-1), [0, 0, true], 'the swing\'s button held');
    events.length = 0;
    // the trigger past the dead zone: the bound axis key, and the swing too (it is bound to SwingWeapon)
    pad.buttons[7].value = 0.8; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickAxis10Button0'), `the axis key: ${events}`);
    events.length = 0;
    // the left stick forward-right at 3/4: MoveForwards + MoveRight pressed as KeyW/KeyD, the throw handed on
    pad.axes[0] = 0.6; pad.axes[1] = -0.6; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:KeyW') && events.includes('keydown:KeyD'), `the bound codes: ${events}`);
    const ax = gp.axes(); assert.ok(ax && near(ax.x, Math.min(1, Math.hypot(0.6, 0.6) / 0.9), 1e-6) && near(ax.y, ax.x, 1e-6), `the throw is ±dist: ${JSON.stringify(ax)}`);
    assert.equal(gp.usingController(), true, 'the stick made the pad the live device');
    assert.equal(controllerLook(), true, 'and the look filter knows');
    events.length = 0;
    // the right stick: a look in the hook's units, or a swing while Y is held
    pad.axes[2] = 0.5; pad.axes[3] = 0.25; gp.tick(1 / 60);
    assert.ok(attacks.at(-1)[2] === true && near(attacks.at(-1)[0], 0.5 * SWING_PX_PER_SEC / 60) && near(attacks.at(-1)[1], 0.25 * SWING_PX_PER_SEC / 60), 'the swing rides the camera stick while its button is down');
    assert.equal(looks.length, 0, 'and no look while swinging');
    pad.buttons[3].pressed = false; gp.tick(1 / 60);
    assert.deepEqual(attacks.at(-1), [0, 0, false], 'released');
    assert.ok(events.includes('keyup:JoystickButton3') && events.includes('keyup:Mouse1'));
    const [dx, dy] = looks.at(-1);
    const degX = controllerLookDegrees(0.5, 1 / 60, 1), degY = controllerLookDegrees(-0.25, 1 / 60, 1);   // Unity's Axis5 is the browser's axis 3 flipped
    assert.ok(near(dx, (degX * Math.PI / 180) / lookScale()) && near(dy, -(degY * Math.PI / 180) / lookScale()), `the look in the hook's units: ${dx} ${dy}`);
    // Back under a window is the Escape action's code; in the world it is nothing
    pad.axes.fill(0); events.length = 0; pad.buttons[1].pressed = true; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:JoystickButton1') && !events.includes('keydown:Escape'), 'B in the world is only its own key');
    overlay = true; gp.tick(1 / 60);
    assert.ok(events.includes('keydown:Escape'), 'B under a window is Escape');
    overlay = false; pad.buttons[1].pressed = false; gp.tick(1 / 60);
    assert.ok(events.includes('keyup:Escape') && events.includes('keyup:JoystickButton1'));
    // the mouse takes the device back
    for (const f of listeners.mousemove) f({ movementX: 3, movementY: 0 });
    gp.tick(1 / 60); assert.equal(gp.usingController(), false); assert.equal(controllerLook(), false);
    // the setting off releases everything
    pad.buttons[0].pressed = true; gp.tick(1 / 60); assert.ok(gp.held().has('JoystickButton0') && gp.held().has('Mouse0'));
    setValue('Controls', 'EnableController', false); events.length = 0; gp.tick(1 / 60);
    assert.ok(events.includes('keyup:JoystickButton0') && events.includes('keyup:Mouse0') && gp.held().size === 0, `all released: ${events}`);
    assert.equal(gp.axes(), null);
    setValue('Controls', 'EnableController', true);
    // and so does the pad going away
    pad.buttons[0].pressed = true; gp.tick(1 / 60); pads = []; events.length = 0; gp.tick(1 / 60);
    assert.ok(events.includes('keyup:JoystickButton0') && gp.held().size === 0);
    gp.dispose();
    assert.equal(pickPad([null, { connected: false, mapping: 'standard' }, { connected: true, mapping: '' }]).mapping, '', 'the first connected pad, a blank mapping allowed');
    assert.equal(pickPad([{ connected: true, mapping: 'xr-standard' }]), null);
  } finally { globalThis.window = prev.w; setBindings(null); setControllerLook(false); _resetForTests(); }
});

test('GP1 the look filter\'s controller floor: while the pad is live the fraction never drops below 0.5 (mutant: the floor dropped)', () => {
  const f = new LookFilter(); const cam = { yaw: 0, pitch: 0 };
  f.add(1, 0); f.tick(1 / 60, cam, { smoothing: 0 });
  assert.ok(near(cam.yaw, 1), 'no smoothing pays the whole look at once');
  setControllerLook(true);
  try {
    const g = new LookFilter(); const cam2 = { yaw: 0, pitch: 0 };
    g.add(1, 0); g.tick(1 / 60, cam2, { smoothing: 0 });
    assert.ok(cam2.yaw < 0.6 && cam2.yaw > 0.4, `the floor of 0.5 at a 60th: ${cam2.yaw}`);
    const h = new LookFilter(); const cam3 = { yaw: 0, pitch: 0 };
    h.add(1, 0); h.tick(1 / 60, cam3, { smoothing: 0.8 });
    assert.ok(cam3.yaw < 0.3, 'a higher setting is kept');
  } finally { setControllerLook(false); }
});

test('GP1 the hosts and the tiers: all four hosts attach the pad on the touch layer\'s own hooks and tick it before the paused gate, the three combat hosts fall through to its stick, the five Controls keys are live and read by the law, and the flag is narrowed to the window and the cursor (mutant: a host dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    const s = rd(h);
    assert.match(s, /const touch = attachTouch\(canvas, inputHooks\);\s*\n\s*const gamepad = attachGamepad\(canvas, inputHooks\);/, `${h}: the pad on the finger's hooks`);
    assert.match(s, /gamepad\?\.tick\(dt\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(!/, `${h}: ticked before the paused gate`);
  }
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) assert.match(rd(h), /mv\.analog = touch\?\.axes\(\) \?\? gamepad\?\.axes\(\) \?\? null;/, h);
  for (const k of ['Controls/EnableController', 'Controls/JoystickLookSensitivity', 'Controls/JoystickCursorSensitivity', 'Controls/JoystickMovementThreshold', 'Controls/JoystickDeadzone']) {
    assert.equal(LIVE[k], 'src/systems/gamepad.js'); assert.equal(UNAVAILABLE[k], undefined);
  }
  _resetForTests();
  const cs = controllerSettings();
  assert.deepEqual(cs, { enabled: true, deadzone: 0.1, threshold: 0.9, lookSensitivity: 1, cursorSensitivity: 1 }, 'the shipped defaults');
  assert.match(rd('src/systems/inputActions.js'), /STILL FLAGGED:\n\/\/\s+- THE JOYSTICK CONTROLS WINDOW/);
  assert.match(rd('src/ui/controlsWindow.js'), /The pad plays \(GP1\); its window is next \(Ledger\)\./);
  assert.ok(JOYSTICK_UI_ACTIONS.length === 4 && AXIS_ACTIONS.length === 4);
});
