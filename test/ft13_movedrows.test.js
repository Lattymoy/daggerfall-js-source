// FT13 - THE MOVED ROWS LEAVE THE SETTINGS PANE (2026-09-14, Mac:
// "Remove the now moved settings options that are now in our new
// Features pane"). FT1 drew a key whose switch lives on the Features
// home as a POINTER row on the settings pane, the Mods page and the
// pause door; Mac read those as the options still being there. A moved
// key draws nothing now: movedRow answers null, every caller appends
// only what it is handed, and every list that draws or counts keys
// filters the moved ones out first (paneKeys). The category map stays
// total - a key LIVES in its category; the pane shows the keys that
// still live on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, featureForControl } from '../src/systems/features.js';
import { CATEGORY_IDS, keysOf } from '../src/ui/settingsMap.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import '../src/world/landView.js';
import '../src/world/outdoors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT13: the moved keys are real, are many, and stay in the total category map', () => {
  const moved = CATEGORY_IDS.flatMap((c) => keysOf(c)).filter((k) => featureForControl('settings', k));
  assert.ok(moved.length >= 10, `the home carries settings keys (${moved.length})`);
  for (const k of ['Experimental/SmallerDungeons', 'Experimental/TerrainDistance', 'Video/RandomDungeonTextures', 'Enhancements/EnemyInfighting', 'Enhancements/GuildQuestListBox']) {
    assert.ok(moved.includes(k), `${k} lives on the home and in its category`);
  }
  const movedMods = Object.keys(MOD_SETTINGS).filter((v) => featureForControl('mods', 'Enabled', v));
  assert.ok(movedMods.length >= 5, `the mods with a switch on the home (${movedMods.length})`);
  assert.ok(FEATURES.some((f) => f.control.store === 'settings'));
});

test('FT13: a moved key draws nothing - the seam answers null, every caller appends only what it is handed, every list and count filters first', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /function movedRow\(_f\) \{ return null; \}/, 'the seam answers null');
  assert.match(menu, /const paneKeys = \(catId\) => keysOf\(catId\)\.filter\(\(key\) => !featureForControl\('settings', key\)\);/, 'the keys a category still shows');
  assert.match(menu, /const put = \(parent, row\) => \{ if \(row\) parent\.append\(row\); \};/);
  assert.match(menu, /const keys = paneKeys\(catId\);\s*\/\/ FT13[\s\S]*?if \(tierOf\(key\) === 'live'\) \{ const r = settingRow\(key\); if \(r\) out\.push\(r\); \}/, 'a category\'s rows');
  assert.match(menu, /const liveCount = \(catId\) => portRows\(catId\)\.length \+ paneKeys\(catId\)\.filter\(\(k\) => tierOf\(k\) === 'live'\)\.length;/, 'the rail count is what the pane shows');
  assert.match(menu, /const liveKeys = paneKeys\(cat\.id\)\.filter\(\(key\) => tierOf\(key\) === 'live'\);[\s\S]*?for \(const key of liveKeys\) put\(list, settingRow\(key\)\);/, 'the pause door\'s live list');
  assert.match(menu, /for \(const key of keys\) put\(body, settingRow\(key\)\);/, 'the folded tiers');
  assert.match(menu, /for \(const \[key, def\] of Object\.entries\(mod\.keys\)\) put\(mc, modRow\(vendor, key, def\)\);/, 'a mod\'s card');
  assert.match(menu, /put\(opts, settingRow\(key, \{ compact: true \}\)\);/, 'the new-game card');
  assert.match(menu, /put\(c, settingRow\(key\)\);/, 'DFU\'s mod switches card');
  assert.equal((menu.match(/return out\.filter\(Boolean\);/g) ?? []).length, 2, 'both port-row lists drop a null');
  for (const seam of [/function settingRow\(key[\s\S]{0,900}?if \(moved\) return movedRow\(moved\);/, /function prefRow\([^\n]*\n\s*if \(!home\) \{ const moved = featureForControl\('prefs', key\); if \(moved\) return movedRow\(moved\); \}/, /function choiceRow\([^\n]*\n\s*if \(!home\) \{ const moved = featureForControl\('prefs', key\); if \(moved\) return movedRow\(moved\); \}/, /function modRow\([^\n]*\n\s*if \(!home\) \{ const moved = featureForControl\('mods', key, vendor\); if \(moved\) return movedRow\(moved\); \}/]) {
    assert.match(menu, seam, 'every builder still asks the registry first');
  }
  assert.doesNotMatch(menu, /On the Features page\.|function goFeatures|row moved/, 'no pointer row, no walk, no class for one');
  // the home is still the ONE caller that gets the real row
  assert.match(menu, /row = settingRow\(c\.key, \{ compact: true, home: true \}\);/);
  assert.match(menu, /modRow\(c\.vendor, c\.key, MOD_SETTINGS\[c\.vendor\]\.keys\[c\.key\], \{ name: f\.title, note: f\.note, home: true \}\)/);
});
