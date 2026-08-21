// THE SETTINGS STORE (SETT-slice): DFU's SettingsManager, 1:1 on the
// parts that have a law - the vendored defaults, the typed getters
// and their failure modes - plus the tiers, which are a CLAIM about
// this port and so are re-derived from the code on every run.
//
// This file replaces the pins written when the Ledger row still said
// "there isn't one". The row and these pins moved together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULTS, ALL_KEYS, LIVE, UNAVAILABLE, tierOf,
  getBool, getInt, getFloat, getString, setValue, resetToDefaults,
  effectiveSettings, _resetForTests,
} from '../src/systems/settings.js';
import { parseIni } from '../scripts/bakeSettings.mjs';
import { combatVoicesEnabled } from '../src/combat/combatVoices.js';
import { loiterLimitHours, cannotLoiterLines } from '../src/systems/restSession.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { lookScale, lookInvert, LOOK_BASE } from '../src/ui/lookSettings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendored = () => readFileSync(join(root, 'vendor/dfu-settings/defaults.ini.txt'), 'utf8');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

test('settings: the BAKE is the vendored file - a stale bake fails here', () => {
  // scripts/bakeSettings.mjs generates settingsDefaults.js from the
  // vendored bytes; nothing hand-edits it (AUDIT 17e F9's lesson).
  const fresh = parseIni(vendored());
  assert.deepEqual(JSON.parse(JSON.stringify(DEFAULTS)), fresh,
    'run: node scripts/bakeSettings.mjs');
  assert.equal(Object.keys(DEFAULTS).length, 13, "DFU's 13 sections");
  assert.equal(ALL_KEYS.length, 171, "DFU's 171 defaults");
  // spot-check the values the Ledger row quotes, straight off the file
  assert.equal(DEFAULTS.Enhancements.EnhancedCombatAI, 'True');
  assert.equal(DEFAULTS.Enhancements.CombatVoices, 'True');
  assert.equal(DEFAULTS.Enhancements.AdvancedClimbing, 'False');
  assert.equal(DEFAULTS.Controls.SoundVolume, '0.5');
});

test('settings: the typed getters are DFU-verbatim, FAILURE MODES included', () => {
  _resetForTests();
  // GetBool (:921-936): bool.Parse, and a value that will not parse
  // reads FALSE - not the default
  assert.equal(getBool('Enhancements', 'CombatVoices'), true, 'ships True');
  assert.equal(getBool('Enhancements', 'AdvancedClimbing'), false);
  setValue('Enhancements', 'CombatVoices', 'banana');
  assert.equal(getBool('Enhancements', 'CombatVoices'), false,
    'an unparseable bool reads False, NOT the True default');
  // GetInt(min,max) (:952-964): parse then Mathf.Clamp; MIN on failure
  setValue('Enhancements', 'LoiterLimitInHours', '99');
  assert.equal(getInt('Enhancements', 'LoiterLimitInHours', 1, 24), 24, 'clamped to max');
  setValue('Enhancements', 'LoiterLimitInHours', '0');
  assert.equal(getInt('Enhancements', 'LoiterLimitInHours', 1, 24), 1, 'clamped to min');
  setValue('Enhancements', 'LoiterLimitInHours', 'nope');
  assert.equal(getInt('Enhancements', 'LoiterLimitInHours', 1, 24), 1,
    'an unparseable clamped int reads MIN, not the default');
  // GetFloat (:971-996), the same shape
  setValue('Controls', 'SoundVolume', '5');
  assert.equal(getFloat('Controls', 'SoundVolume', 0, 1), 1);
  setValue('Controls', 'SoundVolume', 'loud');
  assert.equal(getFloat('Controls', 'SoundVolume', 0, 1), 0, 'min on failure');
  // GetString: raw, no parse, no fallback
  assert.equal(getString('Daggerfall', 'MyDaggerfallPath'), '');
  _resetForTests();
});

test('settings: overrides are a DELTA, and reset drops them', () => {
  _resetForTests();
  assert.equal(getBool('Enhancements', 'CombatVoices'), true);
  setValue('Enhancements', 'CombatVoices', false);
  assert.equal(getBool('Enhancements', 'CombatVoices'), false, 'the override wins');
  assert.equal(effectiveSettings().Enhancements.CombatVoices, 'False',
    'and stringifies capitalised, as C# value.ToString() does');
  // setting a value BACK to the default drops the override rather than
  // pinning today's value - so a later DFU default reaches the player
  setValue('Enhancements', 'CombatVoices', true);
  assert.equal(getBool('Enhancements', 'CombatVoices'), true);
  setValue('Enhancements', 'CombatVoices', false);
  resetToDefaults();
  assert.equal(getBool('Enhancements', 'CombatVoices'), true, 'reset restores the shipped value');
  _resetForTests();
});

test('settings: the LIVE tier does not lie - each consumer really reads the store', () => {
  _resetForTests();
  // CombatVoices
  setValue('Enhancements', 'CombatVoices', false);
  assert.equal(combatVoicesEnabled(), false, 'the voice gate follows the setting');
  setValue('Enhancements', 'CombatVoices', true);
  assert.equal(combatVoicesEnabled(), true);
  // LoiterLimitInHours - the number AND the refusal line that quotes it
  setValue('Enhancements', 'LoiterLimitInHours', 8);
  assert.equal(loiterLimitHours(), 8);
  assert.ok(cannotLoiterLines()[1].includes('8'), 'the refusal line quotes the live cap');
  // PlayerTorchFromItems - the kit seam
  setValue('Enhancements', 'PlayerTorchFromItems', true);
  const e = { items: [], stats: {}, skills: [] };
  assignStartingGear(e, { classIndex: 0, rolls: () => 0 });
  assert.ok(e.items.some((it) => it.group === 'UselessItems2'), 'torches arrive with the setting on');
  setValue('Enhancements', 'PlayerTorchFromItems', false);
  const e2 = { items: [], stats: {}, skills: [] };
  assignStartingGear(e2, { classIndex: 0, rolls: () => 0 });
  assert.equal(e2.items.filter((it) => it.group === 'UselessItems2').length, 0, 'and not with it off');
  // MouseLookSensitivity + InvertMouseVertical
  setValue('Controls', 'MouseLookSensitivity', 1.0);
  assert.equal(lookScale(), LOOK_BASE, 'sensitivity 1.0 IS the port feel constant');
  setValue('Controls', 'MouseLookSensitivity', 2.0);
  assert.equal(lookScale(), LOOK_BASE * 2, 'and the shipped 2.0 is twice that');
  assert.equal(lookInvert(), 1);
  setValue('Controls', 'InvertMouseVertical', true);
  assert.equal(lookInvert(), -1, 'inverting flips the pitch term');
  _resetForTests();
});

test('settings: the tier map is complete and honest', () => {
  // every key has a tier, and the tiers partition the key space
  for (const k of ALL_KEYS) {
    assert.ok(['live', 'stored', 'unavailable'].includes(tierOf(k)), `${k} has a tier`);
  }
  // LIVE names a real file, and that file really imports the store
  for (const [key, file] of Object.entries(LIVE)) {
    assert.ok(ALL_KEYS.includes(key), `${key} is a real DFU setting`);
    const rel = file.replace(/^src\//, '');
    assert.ok(/from '\.\.?\/(systems\/)?settings\.js'/.test(src(rel)) || /settings\.js'/.test(src(rel)),
      `${file} must read the settings store to claim ${key} is live`);
  }
  // UNAVAILABLE keys are real settings with a stated reason
  for (const [key, why] of Object.entries(UNAVAILABLE)) {
    assert.ok(ALL_KEYS.includes(key), `${key} is a real DFU setting`);
    assert.ok(why && why.length > 10, `${key} states WHY it is unavailable`);
  }
  // the two the Ledger calls out by name are unavailable for the
  // documented reason - the port implements one side of each branch
  assert.equal(tierOf('Enhancements/EnhancedCombatAI'), 'unavailable');
  assert.equal(tierOf('Enhancements/AdvancedClimbing'), 'unavailable');
});
