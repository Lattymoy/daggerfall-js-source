// SWING-DEFAULT1 (Mac, 2026-09-22): a first-time player on Discord held
// the right button and dragged and nothing swung; The Frog's answer was
// the controls screen ("click or click and hold... it should be the
// default"). The port's default is now WeaponSwingMode 2, click or hold,
// laid over DFU's shipped 0 in PORT_DEFAULTS - the vendored table is
// never edited, an override still wins, and the drag mode stays a row
// away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORT_DEFAULTS, getInt, setValue, effectiveSettings, _resetForTests } from '../src/systems/settings.js';
import { SETTINGS_DEFAULTS } from '../src/systems/settingsDefaults.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SWING-DEFAULT1: with nothing stored, the swing mode reads 2 - click or hold - and the merged view agrees', () => {
  _resetForTests?.();
  assert.equal(PORT_DEFAULTS.Controls.WeaponSwingMode, '2');
  assert.equal(getInt('Controls', 'WeaponSwingMode', 0, 2), 2);
  assert.equal(effectiveSettings().Controls.WeaponSwingMode, '2');
  // the generated table still says what DFU ships
  assert.equal(SETTINGS_DEFAULTS.Controls.WeaponSwingMode, '0');
});

test('SWING-DEFAULT1: a player who chose the drag keeps it, and the choice set back to the default drops the override', () => {
  _resetForTests?.();
  setValue('Controls', 'WeaponSwingMode', '0');
  assert.equal(getInt('Controls', 'WeaponSwingMode', 0, 2), 0, 'the vanilla drag, by choice');
  setValue('Controls', 'WeaponSwingMode', '2');
  assert.equal(getInt('Controls', 'WeaponSwingMode', 0, 2), 2);
  _resetForTests?.();
});

test('SWING-DEFAULT1: the gesture machine still reads the setting, not a literal', () => {
  const pw = read('src/combat/playerWeapon.js');
  assert.match(pw, /swingMode = getInt\('Controls', 'WeaponSwingMode', 0, 2\)/);
  assert.match(pw, /if \(swingMode !== 0\) \{/, 'modes 1 and 2 are the click arm; 0 alone tracks the drag');
});
