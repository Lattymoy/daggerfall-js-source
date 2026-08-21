// THE SETTINGS STORE (SETT-slice): DFU's SettingsManager, 1:1 on the
// parts that have a law - the vendored defaults, the typed getters
// and their failure modes - plus the tiers, which are a CLAIM about
// this port and so are re-derived from the code on every run.
//
// This file replaces the pins written when the Ledger row still said
// "there isn't one". The row and these pins moved together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
import { LauncherWindow } from '../src/ui/launcher.js';
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

test('settings AUDIT: the tier map agrees BOTH ways - no unlisted consumer', () => {
  // The one-directional gap this audit found. The tier pin above proves
  // every LIVE key HAS a consumer; nothing proved the reverse, so
  // GUI/ShowOptionsAtStart sat tiered `stored` while main.js read it as
  // the launcher gate - and the launcher told the player it did
  // nothing. This is AUDIT 18's open-flags idiom ("agree BOTH ways")
  // applied to settings: re-derive every key READ under src/ and
  // require each to be tiered live.
  // the file list is DERIVED on every run, never checked in - a stored
  // list is the stale-second-copy shape AUDIT 17e F9 caught
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (
    d.isDirectory() ? walk(join(dir, d.name)) : (d.name.endsWith('.js') ? [join(dir, d.name)] : [])));
  const read = new Set();
  for (const f of walk(join(root, 'src'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/get(?:Bool|Int|Float|String)\('([A-Za-z]+)',\s*'([A-Za-z_]+)'/g)) {
      read.add(`${m[1]}/${m[2]}`);
    }
  }
  assert.ok(read.size > 0, 'the sweep finds real reads (a RULE, not a tautology)');
  const mistiered = [...read].filter((k) => tierOf(k) !== 'live');
  assert.deepEqual(mistiered, [],
    `settings READ in src/ but not tiered live: ${mistiered.join(', ')}`);
});

test('settings AUDIT: the launcher takes POINTER input and its controls are on-canvas', async () => {
  // The audit's severe finding: the launcher shipped keyboard-only
  // while ShowOptionsAtStart ships True, so a touch device booted into
  // a screen it could never dismiss (proven on a Pixel 5). The first
  // fix then put PLAY at a fixed offset that fell off a narrow canvas
  // - drawn where no finger could reach. Both are pinned here.
  const { LauncherWindow } = await import('../src/ui/launcher.js');
  const scene = readFileSync(join(root, 'src/scenes/launcherScene.js'), 'utf8');
  assert.ok(/canvas\.addEventListener\('pointerdown'/.test(scene),
    'the launcher host must route pointerdown - keyboard-only TRAPS a phone');
  assert.ok(/removeEventListener\('pointerdown'/.test(scene), 'and release it on exit');

  // every control lands INSIDE a narrow (phone-shaped) canvas
  const phone = { width: 393, height: 851 };
  const w = new LauncherWindow({});
  const L = w.layout(phone, 2);
  for (const [name, rect] of Object.entries({ play: L.play, prev: L.prevSection, next: L.nextSection })) {
    assert.ok(rect[0] >= 0 && rect[0] + rect[2] <= phone.width,
      `${name} must be reachable on a ${phone.width}px canvas (got x=${rect[0]}..${rect[0] + rect[2]})`);
  }
  for (const r of L.rows) {
    assert.ok(r.rect[0] + r.rect[2] <= phone.width, `row ${r.key} overruns a narrow canvas`);
  }
  // a tap on PLAY finishes; a tap on a row selects, a second changes
  let launched = 0;
  const w2 = new LauncherWindow({ onLaunch: () => launched++ });
  const L2 = w2.layout(phone, 2);
  const row = L2.rows[3];
  w2.clickAt(phone, row.rect[0] + 4, row.rect[1] + 2, 2);
  assert.equal(w2.cursor, row.index, 'a tap selects the row');
  const before = w2.layout(phone, 2).rows.find((r) => r.key === row.key).value;
  w2.clickAt(phone, row.rect[0] + 4, row.rect[1] + 2, 2);
  const after = w2.layout(phone, 2).rows.find((r) => r.key === row.key).value;
  assert.ok(before !== after || !!w2.notice, 'a second tap changes it, or says why it cannot');
  w2.clickAt(phone, L2.play[0] + 2, L2.play[1] + 2, 2);
  assert.equal(w2.done, true, 'tapping PLAY launches');
  assert.equal(launched, 1, 'and fires onLaunch exactly once');
});

test('settings AUDIT: the mouse-look settings reach ALL FOUR hosts', () => {
  // The FOUR HOSTS rule. The SETT slice wired world/exterior/dungeon
  // and missed scenes/interior.js, so sensitivity and invert were live
  // in three hosts and dead in the fourth.
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js', 'scenes/interior.js']) {
    const t = src(host);
    assert.ok(t.includes('lookScale()'), `${host} must read the shared look settings`);
    assert.ok(!/\* 0\.0025/.test(t), `${host} still carries a raw look constant`);
  }
});

test('settings AUDIT: turning ShowOptionsAtStart off WARNS about the lock-out', async () => {
  // The port has no in-game route to settings (DFU reaches them from
  // DaggerfallPauseOptionsWindow - a routed Ledger row), so switching
  // this one off hides the launcher for good. Say so at the moment of
  // the choice. Found unpinned by the audit's own mutation run.
  const { LauncherWindow } = await import('../src/ui/launcher.js');
  _resetForTests();
  const w = new LauncherWindow({});
  w.sectionIndex = w.sections.indexOf('GUI');
  w.cursor = w.keys.indexOf('ShowOptionsAtStart');
  w.input('ArrowRight');
  assert.equal(getBool('GUI', 'ShowOptionsAtStart'), false, 'it really turned off');
  assert.match(w.notice ?? '', /\?launcher/, 'and the notice names the way back');
  // turning it back ON needs no warning
  w.input('ArrowRight');
  assert.equal(getBool('GUI', 'ShowOptionsAtStart'), true);
  assert.ok(!/\?launcher/.test(w.notice ?? ''), 'no lock-out warning when it is back on');
  _resetForTests();
});

test('merge audit: the launcher volume step cannot strand the player off the fractional scale', () => {
  // stepFor read the CURRENT value's string, so the step was 0.1 only
  // while it contained a '.': stepping 0.9 up stores "1" and 0.1 down
  // stores "0", and the NEXT press stepped by ONE. A player who muted
  // SoundVolume could never reach any fraction again - 0 -> 1 -> 2 -
  // and the row displayed a 2 that getFloat clamps to 1. The step now
  // comes from the DEFAULT, which does not move.
  resetToDefaults();
  const w = new LauncherWindow();
  w.sectionIndex = w.sections.indexOf('Controls');
  w.cursor = w.keys.indexOf('SoundVolume');
  assert.equal(effectiveSettings().Controls.SoundVolume, '0.5');
  const vol = () => Number(effectiveSettings().Controls.SoundVolume);
  const press = (dir) => w.input(dir < 0 ? 'ArrowLeft' : 'ArrowRight');

  for (let i = 0; i < 5; i++) press(-1);
  assert.equal(vol(), 0, 'five presses mute it');
  press(-1);
  assert.equal(vol(), 0, 'and 0 is the floor');
  press(1);
  assert.equal(vol(), 0.1, 'ONE press back up is a TENTH, not the whole scale');
  for (let i = 0; i < 20; i++) press(1);
  assert.equal(vol(), 1, 'and the top is 1 - never a 2 the audio bus would clamp away');
  resetToDefaults();
});
