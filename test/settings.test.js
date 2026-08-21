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

test('settings AUDIT: the screen takes POINTER input and its controls are on-canvas', async () => {
  // The audit's severe finding, carried onto the MENU rewrite: the
  // first launcher shipped keyboard-only while ShowOptionsAtStart
  // ships True, so a touch device booted into a screen it could never
  // dismiss (proven on a Pixel 5). Its first fix then put PLAY at a
  // fixed offset that fell off a narrow canvas. Both laws survive the
  // rewrite and are pinned against the new window's ONE layout.
  const { SettingsWindow } = await import('../src/ui/settingsWindow.js');
  const scene = readFileSync(join(root, 'src/scenes/launcherScene.js'), 'utf8');
  for (const ev of ['pointerdown', 'pointerup', 'pointercancel', 'wheel']) {
    assert.ok(scene.includes(`addEventListener('${ev}'`), `the host must route ${ev} - keyboard-only TRAPS a phone`);
    assert.ok(scene.includes(`removeEventListener('${ev}'`), `and release ${ev} on exit`);
  }
  const phone = { width: 390, height: 844 };
  const w = new SettingsWindow({});
  const L = w.layout(phone);
  for (const h of L.hit) {
    assert.ok(h.rect[0] >= 0 && h.rect[0] + h.rect[2] <= L.page[2],
      `${h.id} must be reachable on a ${L.page[2]}-unit page (x ${h.rect[0]}..${h.rect[0] + h.rect[2]})`);
    assert.ok(h.rect[1] >= 0 && h.rect[1] + h.rect[3] <= L.page[3], `${h.id} runs off the page vertically`);
  }
  assert.ok(L.hit.some((h) => h.id === 'btn:play'), 'PLAY exists on a phone page');
  // a tap on PLAY launches, exactly once
  let launched = 0;
  const w2 = new SettingsWindow({ onLaunch: () => launched++ });
  const L2 = w2.layout(phone);
  const play = L2.hit.find((h) => h.id === 'btn:play').rect;
  w2.click(play[0] + 2, play[1] + 2, phone);
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

test('settings AUDIT: turning ShowOptionsAtStart off asks first', async () => {
  // The port has no in-game route to settings (a routed Ledger row),
  // so switching this off hides the screen for good. The MENU rewrite
  // promotes the old passive notice into a DECISION: a confirm that
  // names the way back. Found unpinned by an earlier mutation run.
  const { SettingsWindow } = await import('../src/ui/settingsWindow.js');
  _resetForTests();
  const canvas = { width: 1280, height: 800 };
  const w = new SettingsWindow({});
  w.category = 'interface';
  const L = w.layout(canvas);
  const idx = L.list.items.findIndex((i) => i.kind === 'row' && i.key === 'GUI/ShowOptionsAtStart');
  assert.ok(idx >= 0, 'the setting is on the Interface page');
  w.focus = idx;
  w.input('ArrowLeft', {}, canvas);
  assert.ok(w.dialog, 'a confirm opens rather than the value silently flipping');
  assert.match(w.dialog.lines.join(' '), /\?launcher/, 'and it names the way back');
  assert.equal(getBool('GUI', 'ShowOptionsAtStart'), true, 'nothing changed yet');
  w.click(0, 0, canvas);   // any click resolves the dialog's default (Turn Off)
  assert.equal(getBool('GUI', 'ShowOptionsAtStart'), false, 'confirming turns it off');
  _resetForTests();
});

test('settings MENU: Video/FieldOfView is DFU law, and reaches ALL FIVE projection hosts', async () => {
  // DFU: SettingsManager.cs:418 GetInt(sectionVideo,"FieldOfView",60,120),
  // defaults.ini ships 65. Every host drew at a hardcoded Math.PI/3 -
  // exactly 60, DFU's MINIMUM rather than its default - so wiring the
  // setting also corrects a view that shipped five degrees narrow.
  const { fieldOfView, FOV_MIN, FOV_MAX } = await import('../src/ui/viewSettings.js');
  _resetForTests();
  assert.equal(FOV_MIN, 60);
  assert.equal(FOV_MAX, 120);
  assert.equal(DEFAULTS.Video.FieldOfView, '65', "DFU's shipped default");
  assert.ok(Math.abs(fieldOfView() - (65 * Math.PI) / 180) < 1e-9, 'the default reads as 65 degrees');
  // DFU's clamp, both ends
  setValue('Video', 'FieldOfView', 200);
  assert.ok(Math.abs(fieldOfView() - (120 * Math.PI) / 180) < 1e-9, 'clamped to 120');
  setValue('Video', 'FieldOfView', 5);
  assert.ok(Math.abs(fieldOfView() - (60 * Math.PI) / 180) < 1e-9, 'clamped to 60');
  _resetForTests();

  // FIVE hosts draw a projection; none may keep a private constant.
  // The sky takes its OWN fov argument in two of them - leaving that at
  // 60 while the camera moved would tear the horizon off the world.
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeon.js',
    'scenes/interior.js', 'scenes/worldModes.js']) {
    const t = src(host);
    assert.ok(t.includes('fieldOfView()'), `${host} must read the shared field of view`);
    assert.ok(!/Math\.PI \/ 3/.test(t), `${host} still carries a hardcoded 60-degree view`);
  }
});
