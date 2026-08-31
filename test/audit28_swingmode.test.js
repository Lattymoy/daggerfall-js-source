import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PlayerWeapon, CLICK_ATTACK_DIRECTIONS } from '../src/combat/playerWeapon.js';
import { ATTACK_THRESHOLD } from '../src/characters/weaponStates.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { DIRECTION_TO_STRIKE } from '../src/characters/anims.js';
import { setValue, resetToDefaults, LIVE, getFloat } from '../src/systems/settings.js';
import { NUMBER_LAW, ENUM_LAW, formatValue } from '../src/ui/settingsLaw.js';

// AUDIT 28 - W11: WeaponAttackThreshold + WeaponSwingMode. The gesture
// gate is Settings.WeaponAttackThreshold (StartGameBehaviour :263 writes
// it over WeaponManager's 0.05 field default; the shipped ini is 0.005),
// so the port had demanded TEN TIMES the mouse travel DFU does before a
// swing fires. WeaponSwingMode 1 is click-to-attack, 2 click-or-hold,
// with a random direction from six of MouseDirections (:316-350).

const SABER = { name: 'Saber', templateIndex: WEAPONS.Saber, material: 0 };
const DIM = 1200;
const drawn = () => { const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 }); pw.sheathed = false; pw.update(0); return pw; };

test('AUDIT 28 W11: the gate is the setting - 0.005 shipped, not the 0.05 field default', () => {
  resetToDefaults();
  assert.equal(getFloat('Controls', 'WeaponAttackThreshold', 0.001, 1), 0.005);
  assert.equal(ATTACK_THRESHOLD, 0.05, 'the field default stays what WeaponManager.cs:54 says');
  const pw = drawn();
  // 12px of 1200 = 0.01 > 0.005: fires under the setting; under the field default it would not.
  assert.equal(pw.gesture(12, 0, true, 1 / 60, DIM), 'StrikeRight', 'DFU\'s shipped threshold');
  const strict = drawn();
  assert.equal(strict.gesture(12, 0, true, 1 / 60, DIM, { attackThreshold: ATTACK_THRESHOLD }), null, 'the field default alone would refuse it');
  setValue('Controls', 'WeaponAttackThreshold', 0.5);
  assert.equal(drawn().gesture(12, 0, true, 1 / 60, DIM), null, 'read live');
  resetToDefaults();
});

test('AUDIT 28 W11: swing mode 1 - the PRESS attacks in a random direction of the six; holding does not; release then press again does', () => {
  const pw = drawn();
  const opts = { swingMode: 1, rolls: () => 0 };
  assert.equal(pw.gesture(0, 0, true, 1 / 60, DIM, opts), DIRECTION_TO_STRIKE.UpRight, 'rolls 0 -> UpRight (index 3)');
  pw.update(1 / 60);
  for (let i = 0; i < 100; i++) { pw.update(1 / 60); assert.equal(pw.gesture(500, 500, true, 1 / 60, DIM, opts), null, 'held: no second attack, and no gesture tracked'); }
  assert.equal(pw.gesture(0, 0, false, 1 / 60, DIM, opts), null);
  for (let i = 0; i < 120; i++) pw.update(1 / 60);
  assert.equal(pw.gesture(0, 0, true, 1 / 60, DIM, { swingMode: 1, rolls: () => 0.99 }), DIRECTION_TO_STRIKE.DownRight, 'rolls .99 -> DownRight (index 8)');
  assert.deepEqual([...CLICK_ATTACK_DIRECTIONS], ['UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight'], 'Random.Range(UpRight, DownRight+1) over the enum');
});

test('AUDIT 28 W11: swing mode 2 - holding attacks again as soon as the machine is free', () => {
  const pw = drawn();
  const opts = { swingMode: 2, rolls: () => 0.5 };
  assert.ok(pw.gesture(0, 0, true, 1 / 60, DIM, opts));
  let again = 0;
  for (let i = 0; i < 300; i++) { pw.update(1 / 60); if (pw.gesture(0, 0, true, 1 / 60, DIM, opts)) again++; }
  assert.ok(again >= 1, 'a held button re-attacks after the swing completes');
});

test('AUDIT 28 W11: a bow ignores the swing mode (WeaponManager :306 - `|| bowEquipped`)', () => {
  const bow = new PlayerWeapon({ weapon: { name: 'Short Bow', templateIndex: 129, material: 0 }, liveSpeed: 50 });
  bow.sheathed = false; bow.update(0);
  assert.equal(bow.gesture(0, 0, true, 1 / 60, DIM, { swingMode: 1 }), 'StrikeDown');
});

test('AUDIT 28 W11: LIVE, and the screen shows a thousandths ratio and the three swing modes', () => {
  assert.equal(LIVE['Controls/WeaponAttackThreshold'], 'src/combat/playerWeapon.js');
  assert.equal(LIVE['Controls/WeaponSwingMode'], 'src/combat/playerWeapon.js');
  assert.equal(NUMBER_LAW['Controls/WeaponAttackThreshold'].min, 0.001);
  assert.equal(formatValue('Controls/WeaponAttackThreshold', '0.005'), '0.005', 'not rounded to "0.01"');
  assert.deepEqual([...ENUM_LAW['Controls/WeaponSwingMode'].values], ['Gesture', 'Click', 'Click or Hold']);
});
