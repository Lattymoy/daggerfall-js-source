// FT6 - ENHANCED WATER, THE ROW MOVES (2026-09-14, the Features arc).
//
// WATER1's switch left the Enhanced category for the home. The audit
// found the switch's composition - the enhanced skin, the pref, the
// `?water=off` kill door - written twice, word for word, one copy per
// exterior host. ONE DFU MEMBER, ONE EXPORT is the law for DFU's
// members; the port's own laws get the same courtesy: it is
// render/waterSurface.js waterSwitchOn now, and both hosts read it.
// The two indoor hosts draw no exterior water and are named here so
// the four-hosts rule is answered: worldModes (interiors) and
// dungeonContext have no terrain grid to shade.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waterSwitchOn } from '../src/render/waterSurface.js';
import { FEATURES, checkFeature, featureForControl } from '../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT6: the switch - the enhanced skin, the pref, and ?water=off as the kill door', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedWater;
  try {
    setUiSkin('enhanced'); setPref('enhancedWater', true);
    assert.equal(waterSwitchOn(''), true, 'on by default on the enhanced skin');
    assert.equal(waterSwitchOn('?water=off'), false, 'the kill door');
    assert.equal(waterSwitchOn('?water=on'), true, 'any other value is not the door');
    setPref('enhancedWater', false);
    assert.equal(waterSwitchOn(''), false, 'the pref is the switch');
    setPref('enhancedWater', true); setUiSkin('classic');
    assert.equal(waterSwitchOn(''), false, 'the classic skin draws DFU\'s flat tile whatever the pref says');
  } finally { setUiSkin(skin); setPref('enhancedWater', pref); }
});

test('FT6: both exterior hosts read the one composition and hold no copy of it; the indoor hosts have no water to switch', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(f);
    assert.match(s, /waterSwitchOn \} from '\.\.\/render\/waterSurface\.js';/, `${f} imports the switch`);
    assert.match(s, /const waterOn = waterSwitchOn\(\)/, `${f} reads it`);
    assert.ok(!/getPref\('enhancedWater'\)/.test(s), `${f} holds no copy of the composition`);
  }
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!/enhancedWater|waterSwitchOn/.test(read(f)), `${f}: no exterior water indoors`);
  const town = read('src/scenes/exterior.js');
  assert.match(town, /const waterOn = waterSwitchOn\(\)[^\n]*\n\s*&& tilemapRectHasWater\(/, 'the town still asks whether it HAS water beside the switch - that is the town\'s question, not the switch\'s');
});

test('FT6: the registry row - Enhanced, over the pref, on by default, sound; the Enhanced category\'s row left with its copy', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-water');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedWater' });
  assert.equal(PREF_DEFAULTS.enhancedWater, true, 'on by default like the other enhanced visuals');
  assert.match(f.note, /Off returns Daggerfall’s flat water tile/);
  assert.equal(f.effect, 'Takes effect when the world next loads.');
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'enhancedWater'), f);
  const menu = read('src/ui/enhancedMenu.js');
  assert.ok(!/prefRow\('enhancedWater'/.test(menu));
  assert.ok(!/function portRowsEnhanced\(/.test(menu), 'FT12: the Enhanced category is gone from the settings rail - its rows are the home\'s');
});
