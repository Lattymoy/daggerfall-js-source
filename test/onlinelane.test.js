// OL1 (Mac, 2026-09-14: "with online ... I definitely think I want any
// current and future enhancements/mods enabled on for online"). ONLINE
// IS THE ENHANCED LANE, WHOLE: while the page is online the skin is
// enhanced (over ?skin=classic too), every enhancement the port owns is
// on, and every vendored mod is enabled - read, not written, so the
// player's own shelf stands again offline. ONE HOME (systems/
// onlineLane.js), THREE READ PATHS (uiSkin, getPref, modSetting), and
// the FUTURE half of the sentence is the pin below that walks every
// boolean switch the port declares and fails on one the lane has neither
// forced nor left to the player by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOnlinePage, ONLINE_FORCED_PREFS, ONLINE_PLAYERS_OWN_PREFS, onlineForcedPref, onlineForcedModSetting, ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
import { uiSkin, isEnhanced } from '../src/systems/uiSkin.js';
import { PREF_DEFAULTS, getPref, setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
/** Run `fn` on a page whose URL is `search` (node has no location; the read paths read globalThis.location.search). */
const onPage = (search, fn) => { const had = globalThis.location; globalThis.location = { search }; try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; } };

test('OL1: the page is online when ?online is on the URL, and nowhere else', () => {
  assert.equal(isOnlinePage('?online=1'), true);
  assert.equal(isOnlinePage('?load=1&online=1&loadkey=3'), true);
  assert.equal(isOnlinePage('?load=1'), false);
  assert.equal(isOnlinePage(''), false);
  assert.equal(isOnlinePage(), false, 'node has no location: never online');
});

test('OL1: the skin is enhanced online, over the stored choice and over ?skin=classic alike; offline the skin law is what it was', () => {
  _resetForTests();
  assert.equal(uiSkin('?online=1'), 'enhanced');
  assert.equal(uiSkin('?online=1&skin=classic'), 'enhanced', 'a shared world has one lane - the probe door loses');
  assert.equal(isEnhanced('?online=1&skin=classic'), true);
  setPref('skin', 'classic');
  assert.equal(uiSkin(''), 'classic', 'offline: the stored choice');
  assert.equal(uiSkin('?online=1'), 'enhanced', 'online: the lane');
  _resetForTests();
});

test('OL1: every enhancement the port owns reads ON online whatever the shelf says, the shelf is not written, and the dials and the phone stay the player\'s', () => {
  _resetForTests();
  for (const k of Object.keys(ONLINE_FORCED_PREFS)) if (k !== 'skin') setPref(k, false);
  setPref('enhancedAI', false); setPref('grassDensity', 0.25); setPref('showFps', true);
  onPage('?online=1', () => {
    for (const [k, v] of Object.entries(ONLINE_FORCED_PREFS)) assert.equal(getPref(k), v, `${k} forced online`);
    assert.equal(getPref('grassDensity'), 0.25, 'a dial is the player\'s');
    assert.equal(getPref('showFps'), true, 'the FPS counter is the player\'s');
    assert.equal(getPref('enhancedAI'), true);
  });
  assert.equal(getPref('enhancedAI'), false, 'offline again: the shelf was never written');
  assert.equal(getPref('enhancedEnvironments'), false);
  _resetForTests();
});

test('MODS-ONLINE-2: a mod the player turned off is OFF online too - only the room\'s ground answers past the store, and the store is never written', () => {
  // OL1 used to read "every vendored mod is enabled online whatever the
  // store says". That half of the lane is gone (MODS-ONLINE-2, Mac:
  // "Is it possible to allow all mods to be toggled on and off for
  // online?"): the port's OWN switches are still the lane's, and a
  // mod's are the player's - except the two Basic Roads switches the
  // room's terrain heights depend on, which are the floor everyone
  // stands on rather than a rule anyone applies.
  _resetModSettings();
  for (const vendor of Object.keys(MOD_SETTINGS)) setModSetting(vendor, 'Enabled', false);
  setModSetting('dynamic-skies', 'densitySetting', 3);
  setModSetting('roads-hazelnut', 'SmoothRoads', false);
  onPage('?online=1', () => {
    for (const vendor of Object.keys(MOD_SETTINGS)) {
      const ground = Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor] ?? {}, 'Enabled');
      assert.equal(modSetting(vendor, 'Enabled'), ground, `${vendor} online is ${ground ? "the room's ground" : "the player's own off"}`);
    }
    assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), true, 'the smoothing is the room\'s floor, not a dial - it was the hole');
    assert.equal(modSetting('roads-hazelnut', 'RiversAndStreams'), false, 'and the water is paint, so it is still the player\'s');
    assert.equal(modSetting('dynamic-skies', 'densitySetting'), 3, 'a mod\'s own dial is the player\'s');
  });
  for (const vendor of Object.keys(MOD_SETTINGS)) assert.equal(modSetting(vendor, 'Enabled'), false, `${vendor}: offline again, the store as the player left it`);
  assert.equal(modSetting('roads-hazelnut', 'SmoothRoads'), false, 'offline the smoothing is the player\'s again - the lane never wrote the store');
  _resetModSettings();
});

test('OL1 - THE FUTURE HALF: every boolean switch the port declares is either forced by the lane or left to the player BY NAME, and every vendored mod carries the one key the lane forces', () => {
  const booleans = Object.entries(PREF_DEFAULTS).filter(([, v]) => typeof v === 'boolean').map(([k]) => k);
  const unanswered = booleans.filter((k) => !Object.hasOwn(ONLINE_FORCED_PREFS, k) && !ONLINE_PLAYERS_OWN_PREFS.includes(k));
  assert.deepEqual(unanswered, [], 'a new switch must say whether the online lane forces it (systems/onlineLane.js ONLINE_FORCED_PREFS) or leaves it to the player (ONLINE_PLAYERS_OWN_PREFS)');
  for (const k of Object.keys(ONLINE_FORCED_PREFS)) assert.ok(Object.hasOwn(PREF_DEFAULTS, k), `${k} is a uiPrefs key`);
  for (const k of ONLINE_PLAYERS_OWN_PREFS) assert.ok(Object.hasOwn(PREF_DEFAULTS, k), `${k} is a uiPrefs key`);
  for (const k of booleans.filter((k) => /^enhanced/.test(k))) assert.equal(ONLINE_FORCED_PREFS[k], true, `${k} is an enhancement and the lane forces it`);
  assert.equal(ONLINE_FORCED_PREFS.skin, 'enhanced');
  // MODS-ONLINE-2: the MOD half of this pin is now total and lives in
  // test/modsonline.test.js (every vendor classified, every forced key
  // a declared key at the mod's own default). What is kept here is the
  // rot check the exemption list always owed: a name that no longer
  // matches a vendored mod is a no-op nobody would notice.
  for (const vendor of ONLINE_PLAYERS_OWN_MODS) assert.ok(MOD_SETTINGS[vendor], `${vendor} is a vendored mod`);
  for (const vendor of Object.keys(ONLINE_ROOM_MOD_KEYS)) assert.ok(MOD_SETTINGS[vendor], `${vendor} is a vendored mod`);
  assert.equal(onlineForcedModSetting('world-tooltips', 'Enabled', '?online=1'), undefined,
    'a purely local readout is not the room\'s business');
  // THE CONTRAST THIS LINE EXISTS TO DRAW has been re-aimed twice, and
  // each time because the mod it named turned out not to be the room's
  // after a reading. It named `dynamic-skies` (which only PAINTS a
  // weather WORLD5 already shares), then `meanerMonsters` (whose stats
  // are minted where a foe SPAWNS, so a peer steps a puppet under the
  // owner's numbers). MODS-ONLINE-2 aims it at the one thing in the
  // whole shelf that is not a rule anybody applies but the floor
  // everybody stands on - and a floor cannot be two.
  assert.equal(onlineForcedModSetting('roads-hazelnut', 'SmoothRoads', '?online=1'), true,
    '...and the switch that moves the TERRAIN HEIGHTS is the room\'s');
  assert.equal(onlineForcedModSetting('roads-hazelnut', 'RiversAndStreams', '?online=1'), undefined,
    '...while the one beside it that only paints tiles is not');
  assert.equal(onlineForcedPref('enhancedAI', '?online=1'), true);
  assert.equal(onlineForcedPref('enhancedAI', ''), undefined);
  assert.equal(onlineForcedPref('grassDensity', '?online=1'), undefined);
  assert.equal(onlineForcedModSetting('pcaao', 'Enabled', '?online=1'), undefined,
    'MODS-ONLINE-2: the striker rolls the damage and the host applies the number - the formulas were never shared');
  assert.equal(onlineForcedModSetting('dynamic-skies', 'densitySetting', '?online=1'), undefined);
});

test('OL1 by source: the three read paths ask the one home first, the menu locks a forced switch and says why, and the Online pane says the lane', () => {
  assert.match(rd('src/systems/uiSkin.js'), /return onlineForcedPref\('skin', search\) \?\? skinOverride\(search\) \?\? clean\(getPref\('skin'\)\) \?\? DEFAULT_SKIN;/);
  assert.match(rd('src/systems/uiPrefs.js'), /export function getPref\(k\) \{\s*const forced = onlineForcedPref\(k\);[^\n]*\n\s*if \(forced !== undefined\) return forced;/);
  assert.match(rd('src/systems/modSettings.js'), /const forced = onlineForcedModSetting\(vendor, key\);[^\n]*\n\s*if \(forced !== undefined\) return forced;\s*const v = load\(\)\[vendor\]\?\.\[key\];/);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(onlineForcedPref\(key\) !== undefined\) lockOnline\(b, main\);/, 'a forced pref row is locked');
  assert.match(menu, /if \(ground !== undefined\) lockOnline\(b, null, \{ note: ONLINE_GROUND_NOTE, value: ground \}\);/, 'a forced mod row is locked, with its OWN reason');
  assert.match(menu, /function lockOnline\(b, main, \{ note = ONLINE_LOCK_NOTE, value = true \} = \{\}\) \{\s*b\.textContent = value \? 'On \(online\)' : 'Off \(online\)';/, 'the lock says so and answers nothing');
  assert.match(menu, /if \(isOnlinePage\(\)\) body\.append\(el\('p', 'meta', ONLINE_MODS_NOTE\)\);/, 'the Mods pane says it once at the top');
  assert.match(menu, /Online is the enhanced lane: every enhancement the port owns is on for everyone\./, 'the Online pane');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## OL1 \(2026-09-14\)/, 'the record');
});
