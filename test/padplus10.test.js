// PADPLUS10 (2026-09-26): the Controller bindings window's laws, the d-pad's tap/hold per direction (hold left =
// Transport, hold up = the next interaction mode) and the sticks' sensitivity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBindings, resetDefaults, getBinding, getJoystickUIBinding } from '../src/systems/inputActions.js';
import { applyPlusPadLayout, registerCrossbar, plusDpadMap, setPlusDpad, scaleStick, plusStickSens, setPlusStickSens } from '../src/ui/plusPad.js';
import { bindPlusRow, clearPlusRow, bindRefusal, rowCode, PLUS_BIND_ROWS } from '../src/ui/plusPadBinds.js';
import { setBindings } from '../src/ui/input.js';
import { attachGamepad } from '../src/ui/gamepadInput.js';
import { setInteractionMode } from '../src/player/interactionMode.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';

const plusStore = () => { const s = createBindings(); resetDefaults(s); applyPlusPadLayout(s); return s; };
const noSave = { save() {} };

test('PADPLUS10 binds: a button another row holds is SWAPPED, the B pair moves together, a keep row is never cleared', () => {
  const s = plusStore();
  const jumpWas = getBinding(s, 'Jump', false);
  const r = bindPlusRow(s, 'jump', 'JoystickButton2', noSave);   // Jump onto X (Draw / sheathe's)
  assert.equal(r.ok, true); assert.equal(r.swapped, 'Draw / sheathe');
  assert.equal(getBinding(s, 'Jump', false), 'JoystickButton2');
  assert.equal(getBinding(s, 'ReadyWeapon', false), jumpWas, 'the other row took the old button');
  bindPlusRow(s, 'inventory', 'JoystickButton3', noSave);
  assert.equal(getBinding(s, 'Inventory', false), 'JoystickButton3');
  assert.equal(getJoystickUIBinding(s, 'Back'), 'JoystickButton3', 'Inventory and Back stay on one button');
  assert.equal(clearPlusRow(s, 'attack', noSave), false, 'Attack cannot be left unbound');
  assert.equal(clearPlusRow(s, 'crouch', noSave), true);
  assert.equal(rowCode(s, PLUS_BIND_ROWS.find((x) => x.id === 'crouch')), null);
  // a keep row that would lose its button to an UNBOUND row refuses
  const out = bindPlusRow(s, 'crouch', getJoystickUIBinding(s, 'LeftClick'), noSave);
  assert.equal(out.ok, false, 'Activate is not left with nothing');
});

test('PADPLUS10 binds: the d-pad and the sticks are refused, LB/RB only without the crossbar, triggers are fine', () => {
  assert.match(bindRefusal('JoystickAxis6Button1'), /d-pad/);
  assert.match(bindRefusal('JoystickAxis1Button0'), /stick/);
  assert.match(bindRefusal('JoystickButton4', { crossbar: true }), /crossbar/);
  assert.equal(bindRefusal('JoystickButton4', { crossbar: false }), null);
  assert.equal(bindRefusal('JoystickAxis9Button0'), null);
  assert.equal(bindRefusal('JoystickButton8'), null);
});

test('PADPLUS10 sticks: the lean is scaled and held to a full lean; the multiplier is clamped', () => {
  assert.deepEqual(scaleStick(0.3, 0, 2), [0.6, 0]);
  const [x, y] = scaleStick(0.8, 0.8, 2);
  assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9, 'never past a full lean');
  resetPrefs();
  setPlusStickSens('right', 99); assert.equal(plusStickSens('right'), 2.5);
  setPlusStickSens('left', 0); assert.equal(plusStickSens('left'), 0.25);
  resetPrefs();
});

test('PADPLUS10 d-pad: hold left is Transport, a tap is the quest log; each hold of up is the NEXT interaction mode', () => {
  const prev = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = plusStore(); setBindings(store);
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const key = (a) => `keydown:${getBinding(store, a)}`;
  const hold = (i, frames) => { pad.buttons[i] = { pressed: true, value: 1 }; for (let f = 0; f < frames; f++) gp.tick(1 / 60); pad.buttons[i] = { pressed: false, value: 0 }; gp.tick(1 / 60); gp.tick(1 / 60); };
  const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
  const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {} }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
  try {
    gp.tick(1 / 60);
    assert.deepEqual(plusDpadMap().left, { tap: 'LogBook', hold: 'Transport' });
    events.length = 0; hold(14, 3);
    assert.ok(events.includes(key('LogBook')) && !events.includes(key('Transport')), `a tap of left is the quest log: ${events}`);
    events.length = 0; hold(14, 40);
    assert.equal(events.filter((e) => e === key('Transport')).length, 1, `held, left is Transport, once: ${events}`);
    assert.ok(!events.includes(key('LogBook')), 'and not also the log');
    // up: grab (the default) -> info -> talk
    setInteractionMode('grab');
    events.length = 0; hold(12, 40);
    assert.ok(events.includes(key('InfoMode')), `hold up from Grab is Info: ${events}`);
    assert.ok(!events.includes(key('SwitchHand')), 'and no hand swap');
    setInteractionMode('info');   // the host's own F3 handler would have done this
    events.length = 0; hold(12, 40);
    assert.ok(events.includes(key('TalkMode')), `the next hold is Talk: ${events}`);
    // the player's own d-pad
    setPlusDpad('right', 'hold', 'CharacterSheet');
    events.length = 0; hold(15, 40);
    assert.ok(events.includes(key('CharacterSheet')), `a set hold works: ${events}`);
  } finally { gp.dispose(); registerCrossbar(null); globalThis.window = prev; resetPrefs(); setInteractionMode('grab'); }
});
