// FT8 - ENHANCED COMBAT VISUALS, THE LAST ROW LEAVES THE ENHANCED
// CATEGORY (2026-09-14, the Features arc). ECV1's switch moves to the
// home; the Settings category it emptied becomes a POINTER to the home
// (the rail-hole law: a category that vanished would teach the player
// its switches vanished) and keeps the outdoors test door, which is a
// test door and not a switch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, checkFeature, featureForControl, featureCounts } from '../src/systems/features.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { combatVisualsOn } from '../src/systems/combatVisuals.js';
import { CATEGORIES } from '../src/ui/settingsMap.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT8: the registry row - Enhanced, over the pref, on by default, taking effect at once', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-combat-visuals');
  assert.ok(f); assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedCombatVisuals' });
  assert.equal(PREF_DEFAULTS.enhancedCombatVisuals, true);
  assert.equal(f.effect, 'Takes effect at once.', 'read once per frame by every foe host - no reload');
  assert.match(f.note, /Off keeps the 1:1 draw/); assert.match(f.note, /Nothing about the rules changes/);
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'enhancedCombatVisuals'), f);
  // the switch's law is untouched: the kill door, the skin, the pref (ECV1)
  assert.equal(combatVisualsOn('', true), true); assert.equal(combatVisualsOn('', false), false);
  assert.equal(combatVisualsOn('?combatvisuals=off', true), false); assert.equal(combatVisualsOn('?skin=classic', true), false);
  for (const h of ['src/scenes/dungeonContext.js', 'src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) assert.match(read(h), /const ecvOn = combatVisualsOn\(\);/, `${h} reads the switch once per frame`);
});

test('FT8: the Enhanced category is a pointer to the home and the test door, and its blurb says so', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const from = menu.indexOf('function portRowsEnhanced('); const body = menu.slice(from, menu.indexOf('\n}', from));
  assert.ok(!/prefRow\('|choiceRow\('/.test(body), 'no switch left in the category');
  assert.match(body, /const out = \[featuresPointerRow\(\)\];\s*\n\s*if \(!pause\) out\.push\(outdoorsTestRow\(\)\);/, 'the pointer, then the test door at boot');
  assert.match(menu, /function featuresPointerRow\(\) \{[\s\S]*?kindTags\(KIND_ORDER\)[\s\S]*?'On the Features page'|function featuresPointerRow\(\) \{[\s\S]*?main\.onclick = goFeatures;[\s\S]*?b\.onclick = goFeatures;/, 'labels, and the walk from face and control');
  const cat = CATEGORIES.find((c) => c.id === 'enhanced');
  assert.match(cat.blurb, /lives on the Features page now/);
  assert.match(cat.blurb, /keeps the outdoors test door/);
  // the home holds every switch the category ever drew
  assert.deepEqual(featureCounts(FEATURES).enhanced, 7);
});
