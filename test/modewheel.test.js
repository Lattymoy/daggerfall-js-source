// CROUCH-SNEAK + MODE-WHEEL (2026-10-08, Port-Ledger A: "CROUCH IS SNEAK, AND A WHEEL PICKS THE INTERACTION MODE").
// The two departures, pinned: a crouch is a sneak (player/motor.js); a held Left Alt opens the mode wheel, a mouse
// flick picks a spoke and the release chooses (ui/modeWheel.js); F1-F4 and Sneak ship unbound; a v2 bindings file
// lets Left Alt go of Sneak so the wheel lands there; the three look-owning hosts hand the mouse to the wheel first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, crouchSpeed, sneakSpeed, runSpeed } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { resetToDefaults } from '../src/systems/settings.js';
import { createModeWheel, spokeOf, MODE_WHEEL_SPOKES, MODE_WHEEL_DEAD_ZONE, MODE_WHEEL_MAX_ARM, MODE_WHEEL_ACTION } from '../src/ui/modeWheel.js';
import {
  DEFAULT_BINDINGS, ACTIONS, PORT_ACTIONS, KEYBINDS_VERSION, createBindings, resetDefaults, serializeKeyBinds, loadKeyBinds,
  migrateKeyBinds, getBinding, actionForCode,
} from '../src/systems/inputActions.js';
import { TOUCH_BUTTON_ACTIONS } from '../src/ui/touchButtons.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const still = () => ({ forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false });
function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  return col;
}

test('CROUCH-SNEAK: a crouch IS a sneak - the crouched-sneak speed, the stealth half-speed gate; standing up ends it; running crouched beats it (mutants: the crouch arm dropped from the latch; running no longer beating it)', () => {
  resetToDefaults();
  const m = new PlayerMotor(floored(), { speed: 50, running: 40 });
  m.spawn(0, 0, 0);
  for (let f = 0; f < 5; f++) m.update(1 / 60, still(), 0);
  m.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m.isSneaking, false, 'standing, a walk is a walk');
  assert.equal(m.movingLessThanHalfSpeed, false);
  m.update(1 / 60, { ...still(), crouch: true }, 0);
  for (let f = 0; f < 12; f++) m.update(1 / 60, still(), 0);   // P18: the flip waits on the height clock
  assert.equal(m.crouching, true);
  m.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m.isSneaking, true, 'crouched, the walk is a sneak - no Sneak key held');
  assert.ok(near(m.speed, sneakSpeed(crouchSpeed(50))), `the crouched-sneak speed: ${m.speed}`);
  assert.equal(m.movingLessThanHalfSpeed, true, 'and it passes the P13 stealth gate');
  m.update(1 / 60, { ...still(), forward: 1, run: true }, 0);
  assert.equal(m.isSneaking, false, 'running beats it, crouched or not');
  assert.ok(near(m.speed, runSpeed(50, 40, true)), 'DFU\'s crouched run');
  m.update(1 / 60, { ...still(), crouch: true }, 0);
  for (let f = 0; f < 12; f++) m.update(1 / 60, still(), 0);
  m.update(1 / 60, { ...still(), forward: 1 }, 0);
  assert.equal(m.crouching, false);
  assert.equal(m.isSneaking, false, 'stood up, the sneak ends with the crouch');
  m.update(1 / 60, { ...still(), forward: 1, sneak: true }, 0);
  assert.equal(m.isSneaking, true, 'a player who binds Sneak still has DFU\'s standing slow walk');
});

test('CROUCH-SNEAK + MODE-WHEEL defaults: Crouch keeps C and LB; Sneak and F1-F4 own no key; the wheel owns Left Alt, appended last and a port row; the touch corner offers no dead Sneak', () => {
  const by = new Map(DEFAULT_BINDINGS.map(([c, a]) => [a, c]));
  assert.equal(by.get('Crouch'), 'KeyC');
  for (const a of ['Sneak', 'StealMode', 'GrabMode', 'InfoMode', 'TalkMode']) assert.equal(by.get(a), undefined, `${a} ships unbound`);
  assert.equal(by.get(MODE_WHEEL_ACTION), 'AltLeft');
  assert.equal(ACTIONS.at(-1), MODE_WHEEL_ACTION, 'appended - a saved file resolves by position');
  assert.ok(ACTIONS.includes('Sneak') && ACTIONS.includes('StealMode'), 'the old rows stay, rebindable');
  assert.ok(PORT_ACTIONS.includes(MODE_WHEEL_ACTION), 'the classic windows yield it');
  assert.ok(!TOUCH_BUTTON_ACTIONS.some((a) => a.id === 'Sneak'));
  assert.ok(TOUCH_BUTTON_ACTIONS.some((a) => a.id === 'Crouch'));
});

test('MODE-WHEEL spokes: Talk up, Grab right, Steal down, Info left; nothing inside the dead zone (mutants: two spokes swapped; the dead zone dropped)', () => {
  assert.deepEqual(MODE_WHEEL_SPOKES.map(([m]) => m), ['dialogue', 'grab', 'steal', 'info'], 'clockwise from the top');
  assert.deepEqual([spokeOf(0, -40), spokeOf(40, 0), spokeOf(0, 40), spokeOf(-40, 0)], ['dialogue', 'grab', 'steal', 'info']);
  assert.deepEqual([spokeOf(30, -35), spokeOf(-35, 30)], ['dialogue', 'info'], 'quadrants centred on the spokes');
  assert.equal(spokeOf(MODE_WHEEL_DEAD_ZONE - 1, 0), null);
  assert.equal(spokeOf(0, 0), null);
  assert.equal(spokeOf(MODE_WHEEL_DEAD_ZONE, 0), 'grab');
  assert.ok(MODE_WHEEL_MAX_ARM > MODE_WHEEL_DEAD_ZONE);
});

test('MODE-WHEEL: press opens, the mouse steers it, the opening key\'s release chooses; no flick keeps the mode; a repeat, another key\'s release and a cancel choose nothing (mutants: release ignoring the code; a pick on cancel)', () => {
  const w = createModeWheel(null);
  const picked = [];
  const pick = (m) => picked.push(m);
  assert.equal(w.look(10, 10), false, 'closed, the mouse is the camera\'s');
  assert.equal(w.press({ code: 'AltLeft' }, pick), true);
  assert.equal(w.isOpen(), true);
  assert.equal(w.press({ code: 'AltLeft', repeat: true }, pick), false, 'the held key\'s auto-repeat is no new press');
  assert.equal(w.look(0, 5), true, 'open, the wheel eats the delta');
  assert.equal(w.spoke(), null, 'inside the dead zone');
  w.look(0, 40);
  assert.equal(w.spoke(), 'steal');
  w.look(-200, -60);   // a flick back the other way changes the choice at once - the arm is clamped
  assert.equal(w.spoke(), 'info');
  assert.equal(w.release({ code: 'KeyW' }), false, 'another key\'s release is not the wheel\'s');
  assert.equal(w.isOpen(), true);
  assert.equal(w.release({ code: 'AltLeft' }), true);
  assert.deepEqual(picked, ['info']);
  assert.equal(w.isOpen(), false);
  w.press({ code: 'AltLeft' }, pick);
  w.release({ code: 'AltLeft' });
  assert.deepEqual(picked, ['info'], 'a release with no flick keeps the mode');
  w.press({ code: 'AltLeft' }, pick);
  w.look(50, 0);
  w.cancel();
  assert.deepEqual(picked, ['info'], 'a cancel (the window losing focus) chooses nothing');
  assert.equal(w.press({ code: 'AltLeft' }, null), false, 'no host door, no wheel');
});

test('MODE-WHEEL: a v2 bindings file lets Left Alt go of Sneak, once, so the wheel lands there; a player\'s own Alt stands and the lost wheel is told; their F1-F4 stand (mutants: the let-go run for every version; the v2 report listing every keyless default)', () => {
  assert.equal(KEYBINDS_VERSION, 3);
  const old = createBindings();
  resetDefaults(old);
  old.primary.delete('AltLeft');
  old.primary.set('AltLeft', 'Sneak');
  for (const [code, a] of [['F1', 'StealMode'], ['F2', 'GrabMode'], ['F3', 'InfoMode'], ['F4', 'TalkMode']]) old.primary.set(code, a);
  const file = { ...serializeKeyBinds(old), version: 2 };
  const s = createBindings();
  loadKeyBinds(s, file);
  const report = migrateKeyBinds(s, 2);
  resetDefaults(s, true);
  assert.deepEqual(report, { moved: ['Sneak off AltLeft'], kept: [], lost: [] });
  assert.equal(getBinding(s, MODE_WHEEL_ACTION), 'AltLeft');
  assert.equal(getBinding(s, 'Sneak'), null);
  assert.equal(actionForCode(s, 'F1'), 'StealMode', 'a saved file\'s mode keys still work beside the wheel');
  assert.deepEqual(migrateKeyBinds(s, KEYBINDS_VERSION), { moved: [], kept: [], lost: [] }, 'carried once');
  // a player who put Rest on Alt keeps it, and is told the wheel has no key
  const mine = createBindings();
  loadKeyBinds(mine, file);
  mine.primary.set('AltLeft', 'Rest');
  mine.primary.set('Digit1', 'Rest');   // QuickUse1's default spent by the player at v2 - told then, not again
  const told = migrateKeyBinds(mine, 2);
  resetDefaults(mine, true);
  assert.equal(actionForCode(mine, 'AltLeft'), 'Rest');
  assert.deepEqual(told.lost, [{ action: MODE_WHEEL_ACTION, code: 'AltLeft', holder: 'Rest' }], 'only the wheel - a v2 file was told its other losses at v2');
  // and a v2 file's E on AbortSpell is the player's own choice by then, not an old default to let go
  const e = createBindings();
  loadKeyBinds(e, file);
  e.primary.set('KeyE', 'AbortSpell');
  migrateKeyBinds(e, 2);
  assert.equal(actionForCode(e, 'KeyE'), 'AbortSpell');
});

test('MODE-WHEEL hosts: townTalk and the dungeon host open it under their gates; the three look-owning hosts hand the mouse to it before the look filter; the pad\'s unbound mode is the host\'s pickMode door', () => {
  const tt = rd('src/scenes/townTalk.js');
  assert.match(tt, /if \(actionsOf\(e, keys\)\.includes\(MODE_WHEEL_ACTION\)\) \{ e\.preventDefault\(\); modeWheel\.press\(e, \(w\) => setMode\(w\)\); \}/, 'opened and NOT consumed - the key still joins the host\'s held ring (a shared key does both)');
  assert.ok(tt.indexOf('if (otherOverlayActive?.()) return false;') < tt.indexOf('modeWheel.press('), 'after the other host\'s overlay gate');
  const d = rd('src/scenes/dungeon.js');
  assert.match(d, /if \(!ctx\.uiOverlayActive && actionsOf\(e, keys\)\.includes\(MODE_WHEEL_ACTION\)\) \{\n\s*e\.preventDefault\(\);\n\s*modeWheel\.press\(e, pickMode\);/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = rd(host);
    const wheel = s.indexOf('if (modeWheel.look(e.movementX, e.movementY)) return;');
    const look = s.indexOf('lookFilter.add(e.movementX * lookScale()');
    assert.ok(wheel > 0 && wheel < look, `${host}: the wheel takes the mouse before the camera`);
  }
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(host), /pickMode: \(m\) => townTalk\.pickMode\(m\),/);
  assert.match(rd('src/ui/gamepadInput.js'), /if \(!c && MODE_ACTIONS\[name\] && hooks\.pickMode\) \{ try \{ hooks\.pickMode\(MODE_ACTIONS\[name\]\); \}/);
});
