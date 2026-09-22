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
import { isOnlinePage, ONLINE_FORCED_PREFS, ONLINE_PLAYERS_OWN_PREFS, onlineForcedPref, onlineForcedModSetting, ONLINE_FORCED_MOD_KEY, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
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

test('OL1: every vendored mod is enabled online whatever the store says, its other switches are the player\'s, and the store is not written', () => {
  _resetModSettings();
  for (const vendor of Object.keys(MOD_SETTINGS)) setModSetting(vendor, 'Enabled', false);
  setModSetting('dynamic-skies', 'densitySetting', 3);
  onPage('?online=1', () => {
    for (const vendor of Object.keys(MOD_SETTINGS)) {
      // AUDIT-WH R8: ...EXCEPT a mod that only draws a READOUT on your
      // own screen. OL1's reasoning is about the WORLD - a mod that
      // moves a light, stands an object, changes a roll or writes a
      // save record is what the room has to agree on - and a crosshair
      // label stands nothing, rolls nothing, writes nothing and is not
      // on the wire. It is the same category as `chatHidden` and
      // `peerClassSprites`, which this lane already leaves alone.
      const own = ONLINE_PLAYERS_OWN_MODS.includes(vendor);
      assert.equal(modSetting(vendor, 'Enabled'), !own, `${vendor} ${own ? 'is still the player\'s' : 'enabled'} online`);
    }
    assert.equal(modSetting('dynamic-skies', 'densitySetting'), 3, 'a mod\'s own dial is the player\'s');
  });
  for (const vendor of Object.keys(MOD_SETTINGS)) assert.equal(modSetting(vendor, 'Enabled'), false, `${vendor}: offline again, the store as the player left it`);
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
  assert.equal(ONLINE_FORCED_MOD_KEY, 'Enabled');
  for (const [vendor, mod] of Object.entries(MOD_SETTINGS)) assert.ok(mod.keys.Enabled, `${vendor} has an Enabled key for the lane to force`);
  // AUDIT-WH R8: and every EXEMPTION names a mod that exists, so the
  // list cannot rot into a no-op the way a stale key would.
  for (const vendor of ONLINE_PLAYERS_OWN_MODS) assert.ok(MOD_SETTINGS[vendor], `${vendor} is a vendored mod`);
  assert.equal(onlineForcedModSetting('world-tooltips', 'Enabled', '?online=1'), undefined,
    'a purely local readout is not the room\'s business');
  // MODS-ONLINE (2026-09-22) re-aimed this contrast. It used to name
  // `dynamic-skies` as "a mod that changes the world" - the author's
  // shorthand for an obvious counterexample rather than a ruling on
  // that mod, and on a reading it does not hold: Dynamic Skies PAINTS
  // a weather WORLD5 already rolls and shares, and moves no object,
  // no roll and no save record. It is the player's now. The contrast
  // this line exists to draw is kept, on a mod nobody can argue about.
  assert.equal(onlineForcedModSetting('meanerMonsters', 'Enabled', '?online=1'), true,
    '...and a mod that changes what a foe IS still is the room\'s');
  assert.equal(onlineForcedPref('enhancedAI', '?online=1'), true);
  assert.equal(onlineForcedPref('enhancedAI', ''), undefined);
  assert.equal(onlineForcedPref('grassDensity', '?online=1'), undefined);
  assert.equal(onlineForcedModSetting('pcaao', 'Enabled', '?online=1'), true);
  assert.equal(onlineForcedModSetting('dynamic-skies', 'densitySetting', '?online=1'), undefined);
});

test('OL1 by source: the three read paths ask the one home first, the menu locks a forced switch and says why, and the Online pane says the lane', () => {
  assert.match(rd('src/systems/uiSkin.js'), /return onlineForcedPref\('skin', search\) \?\? skinOverride\(search\) \?\? clean\(getPref\('skin'\)\) \?\? DEFAULT_SKIN;/);
  assert.match(rd('src/systems/uiPrefs.js'), /export function getPref\(k\) \{\s*const forced = onlineForcedPref\(k\);[^\n]*\n\s*if \(forced !== undefined\) return forced;/);
  assert.match(rd('src/systems/modSettings.js'), /const forced = onlineForcedModSetting\(vendor, key\);[^\n]*\n\s*if \(forced !== undefined\) return forced;\s*const v = load\(\)\[vendor\]\?\.\[key\];/);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(onlineForcedPref\(key\) !== undefined\) lockOnline\(b, main\);/, 'a forced pref row is locked');
  assert.match(menu, /if \(onlineForcedModSetting\(vendor, key\) !== undefined\) lockOnline\(b, null\);/, 'a mod\'s Enabled row is locked');
  assert.match(menu, /function lockOnline\(b, main\) \{\s*b\.textContent = 'On \(online\)';\s*b\.disabled = true;/, 'the lock says so and answers nothing');
  assert.match(menu, /if \(isOnlinePage\(\)\) body\.append\(el\('p', 'meta', ONLINE_LOCK_NOTE\)\);/, 'the Mods pane says it once at the top');
  assert.match(menu, /Online is the enhanced lane, whole: every enhancement and every mod is on for everyone, and your own switches return when you play offline\./, 'the Online pane');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## OL1 \(2026-09-14\)/, 'the record');
});
