import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W5: TOGGLE SNEAK (PlayerSpeedChanger.cs:75-78, wired from
// StartGameBehaviour :277), a default-OFF control the port stored and
// ignored: with Controls/ToggleSneak the sneak mode is
// `sneakingMode ^= ActionStarted(Sneak)` - a PRESS flips it, holding
// does nothing more, releasing keeps it - and without the setting the
// mode is the held key, as ever.

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const still = () => ({ forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false });

function floored() {
  const col = new Collider(() => 0);
  col.addMesh('floor',
    new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]),
    new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  return col;
}

const settle = (m) => { for (let f = 0; f < 5; f++) m.update(1 / 60, still(), 0); };

test('AUDIT 28 W5: held mode (the default) - sneak follows the key, exactly as before', () => {
  resetToDefaults();
  const m = new PlayerMotor(floored());
  m.spawn(0, 0.1, 0); settle(m);
  m.update(1 / 60, { ...still(), sneak: true }, 0);
  assert.equal(m.isSneaking, true);
  m.update(1 / 60, still(), 0);
  assert.equal(m.isSneaking, false, 'release ends it');
});

test('AUDIT 28 W5: ToggleSneak - the press FLIPS the mode, holding does not flip again, release keeps it, a second press ends it', () => {
  resetToDefaults();
  setValue('Controls', 'ToggleSneak', true);
  const m = new PlayerMotor(floored());
  m.spawn(0, 0.1, 0); settle(m);
  m.update(1 / 60, { ...still(), sneak: true }, 0);   // press edge
  assert.equal(m.isSneaking, true, 'the press flips it on');
  for (let f = 0; f < 5; f++) m.update(1 / 60, { ...still(), sneak: true }, 0);
  assert.equal(m.isSneaking, true, 'holding is not more presses (XOR on ActionStarted, not HasAction)');
  m.update(1 / 60, still(), 0);
  assert.equal(m.isSneaking, true, 'release keeps the mode - that is the point of the toggle');
  m.update(1 / 60, { ...still(), sneak: true }, 0);   // second press edge
  assert.equal(m.isSneaking, false, 'the second press flips it off');
  m.update(1 / 60, still(), 0);
  assert.equal(m.isSneaking, false);
  resetToDefaults();
});

test('AUDIT 28 W5 + F-C3: running beats sneaking AND clears the mode - a run ENDS a toggled sneak (ApplyInputSpeedAdjustment :121-125)', () => {
  resetToDefaults();
  setValue('Controls', 'ToggleSneak', true);
  const m = new PlayerMotor(floored());
  m.spawn(0, 0.1, 0); settle(m);
  m.update(1 / 60, { ...still(), sneak: true }, 0);
  assert.equal(m.isSneaking, true);
  m.update(1 / 60, { ...still(), run: true }, 0);
  assert.equal(m.isRunning, true);
  assert.equal(m.isSneaking, false, 'running wins while it lasts');
  m.update(1 / 60, still(), 0);
  // The first W5 pin asserted the opposite ("survives the run and comes
  // back") - a wrong assumption, caught by self-audit 3: DFU sets
  // sneakingMode = false while running.
  assert.equal(m.isSneaking, false, 'the run switched the toggled sneak OFF');
  m.update(1 / 60, { ...still(), sneak: true }, 0);
  assert.equal(m.isSneaking, true, 'a fresh press toggles it back on');
  // Held mode: re-latched from the key the frame after the run, as DFU's is.
  resetToDefaults();
  const h = new PlayerMotor(floored());
  h.spawn(0, 0.1, 0); settle(h);
  h.update(1 / 60, { ...still(), run: true, sneak: true }, 0);
  assert.equal(h.isSneaking, false);
  h.update(1 / 60, { ...still(), sneak: true }, 0);
  assert.equal(h.isSneaking, true, 'held: the key is the mode again');
  setValue('Controls', 'ToggleSneak', true);
  resetToDefaults();
  assert.equal(LIVE['Controls/ToggleSneak'], 'src/player/motor.js');
});
