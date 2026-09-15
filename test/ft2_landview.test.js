// FT2 - LAND VIEW DISTANCE, THE FIRST CONDENSED ROW (2026-09-14, Mac:
// "some toggles can be condensed and receive 2 labels ... mods/classic/
// enhanced that share commonalities").
//
// Two controls sat in two panes for ONE radius: the Enhanced category's
// Land view distance over uiPrefs landViewDistance (LV1, the enhanced
// lane's 1..6) and Video's Land View Distance over DFU's
// Experimental/TerrainDistance (D1, the 1:1 lane's 1..4). A player who
// set one could not see they had not moved the other. One row now,
// wearing Enhanced and DFU Classic: it SHOWS the radius the current
// lane will use and its control WRITES BOTH STORES, the pref whole and
// DFU's key capped at its own 4; the tiers span both lanes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAND_VIEW_TIERS, LAND_VIEW_DFU_MAX, LAND_VIEW_MAX, LAND_VIEW_DEFAULT, landViewRead, landViewWrite,
} from '../src/world/landView.js';
import { FEATURES, KIND_ORDER, checkFeature, resolveControl, featureForControl, featureCounts, filterFeatures } from '../src/systems/features.js';
import { getPref, setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { getInt, setValue, resetToDefaults } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const reset = () => { resetToDefaults(); setPref('landViewDistance', PREF_DEFAULTS.landViewDistance); };

test('FT2: the tiers span both lanes - DFU\'s whole 1..4 and the enhanced 5..6, the default among them', () => {
  assert.deepEqual(LAND_VIEW_TIERS.map(([v]) => v), [1, 2, 3, 4, 5, 6]);
  assert.equal(LAND_VIEW_TIERS[2][1], 'Daggerfall’s (3)', 'DFU\'s own default is named');
  assert.equal(LAND_VIEW_TIERS[5][1], 'Furthest (6)');
  assert.ok(LAND_VIEW_TIERS.some(([v]) => v === LAND_VIEW_DEFAULT));
  assert.ok(LAND_VIEW_TIERS.some(([v]) => v === LAND_VIEW_DFU_MAX) && LAND_VIEW_TIERS.some(([v]) => v === LAND_VIEW_MAX));
});

test('FT2: one write, both stores - the pref whole, DFU\'s key capped at 4', () => {
  reset();
  try {
    assert.equal(landViewWrite(6), 6);
    assert.equal(getPref('landViewDistance'), 6);
    assert.equal(getInt('Experimental', 'TerrainDistance', 1, 4), 4, 'StreamingWorld.cs [Range(1,4)] - the 1:1 lane never sees a 6');
    assert.equal(landViewWrite(2), 2);
    assert.equal(getPref('landViewDistance'), 2);
    assert.equal(getInt('Experimental', 'TerrainDistance', 1, 4), 2, 'under the cap the lanes hold the same number');
    assert.equal(landViewWrite(4), 4);
    assert.equal(getInt('Experimental', 'TerrainDistance', 1, 4), 4);
    assert.equal(landViewWrite('x'), LAND_VIEW_DEFAULT, 'a bad value is the default');
    assert.equal(getInt('Experimental', 'TerrainDistance', 1, 4), 4);
    assert.equal(landViewWrite(99), LAND_VIEW_MAX, 'clamped to the enhanced ceiling');
    assert.equal(landViewWrite(0), 1, 'and the floor');
    assert.equal(getInt('Experimental', 'TerrainDistance', 1, 4), 1);
  } finally { reset(); }
});

test('FT2: the read is the lane\'s - the pref on the enhanced outdoors, DFU\'s key on the classic', () => {
  reset();
  try {
    setPref('landViewDistance', 6);
    setValue('Experimental', 'TerrainDistance', '2');   // an imported settings.ini's own number, untouched by any write here
    assert.equal(landViewRead({ enhanced: true }), 6);
    assert.equal(landViewRead({ enhanced: false }), 2, 'the classic skin shows the number it will actually stream');
    landViewWrite(3);
    assert.equal(landViewRead({ enhanced: true }), 3);
    assert.equal(landViewRead({ enhanced: false }), 3, 'after a press the lanes agree');
  } finally { reset(); }
});

test('FT2: the registry row - both labels, over the pref, showing and writing through the module', () => {
  const f = FEATURES.find((x) => x.id === 'land-view-distance');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced', 'classic'], 'Mac: a row that condenses two origins wears both');
  assert.equal(f.control.store, 'prefs'); assert.equal(f.control.key, 'landViewDistance');
  const c = resolveControl(f);   // RF4: the lane's fields, registered by landView.js
  assert.equal(f.control.lane, 'landView');
  assert.equal(c.tiers, LAND_VIEW_TIERS);
  assert.equal(c.read, landViewRead); assert.equal(c.write, landViewWrite);
  assert.equal(c.initial, 5); assert.equal(c.online, 'player', 'a dial is the player\'s online');
  assert.match(f.note, /capped at Daggerfall Unity’s 4/); assert.match(f.effect, /world next loads/);
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'landViewDistance'), f);
  // the DFU key it condenses is COVERED: the settings pane's Video row points here instead of drawing a second switch
  assert.deepEqual(f.control.also, [{ store: 'settings', key: 'Experimental/TerrainDistance' }]);
  assert.equal(featureForControl('settings', 'Experimental/TerrainDistance'), f, 'the covered key resolves to the row that writes it');
  // ...and the filter shows the row under either label
  assert.ok(filterFeatures(FEATURES, 'enhanced').includes(f) && filterFeatures(FEATURES, 'classic').includes(f));
  // EOTB0: this was a typed tally with a comment naming every slice
  // that had ever moved it - and FT0 already pins the exact row ids,
  // in order, which is the ONE place an accidental row should be
  // caught. A second enumeration of the same fact is not a second
  // check; it is the copy that drifts, and every mod since has had to
  // edit both. So the COUNTS are derived from the rows here, and what
  // is asserted is the identity that has to hold: the total is the
  // rows, each kind's count is the rows wearing it, and a row wearing
  // two kinds is counted under both (which is why the kinds sum HIGH -
  // the outdoors row and the land-view row each wear two).
  const counts = featureCounts(FEATURES);
  assert.equal(counts.all, FEATURES.length, 'the total is the rows');
  for (const k of KIND_ORDER) {
    assert.equal(counts[k], filterFeatures(FEATURES, k).length, `${k} counts the rows wearing ${k}`);
  }
  assert.ok(counts.all > 25 && KIND_ORDER.every((k) => counts[k] > 5),
    `the home is still populated: ${JSON.stringify(counts)}`);
  assert.ok(counts.enhanced + counts.mod + counts.classic > counts.all,
    'at least one row wears two labels - this row is one of them');
});

test('FT2: a condensed row\'s read and write are functions and come together - the registry law', () => {
  const f = FEATURES.find((x) => x.id === 'land-view-distance');
  const mut = (control) => checkFeature({ ...f, control: { ...resolveControl(f), lane: undefined, ...control } });   // RF4: over the resolved control, the lane taken out so the patch is what stands
  assert.deepEqual(mut({ read: 'landViewRead' }), ['read is not a function']);
  assert.deepEqual(mut({ write: 3 }), ['write is not a function']);
  assert.deepEqual(mut({ read: undefined }), ['read and write come together']);
  assert.deepEqual(mut({ write: undefined }), ['read and write come together']);
  assert.deepEqual(mut({ read: undefined, write: undefined }), [], 'a plain pref row has neither');
  assert.deepEqual(mut({ also: 'Experimental/TerrainDistance' }), ['also is not a list']);
  assert.deepEqual(mut({ also: [{ store: 'ini', key: 'x' }] }), ["also: unknown store 'ini'"]);
  assert.deepEqual(mut({ also: [{ store: 'settings', key: 'Experimental/TerrainDistanc' }] }), ["also: settings has no key 'Experimental/TerrainDistanc'"]);
  assert.deepEqual(mut({ also: [] }), [], 'covering nothing is allowed');
});

test('FT2: every builder asks the registry (one home per idea, every store), the home passes read/write, and the old rows are gone', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /function prefRow\(key, name, note, \{ onChange = null, home = false \} = \{\}\) \{\s*if \(!home\) \{ const moved = featureForControl\('prefs', key\); if \(moved\) return movedRow\(moved\); \}/);
  assert.match(menu, /function choiceRow\(key, name, note, tiers, \{ home = false, read = null, write = null \} = \{\}\) \{\s*if \(!home\) \{ const moved = featureForControl\('prefs', key\); if \(moved\) return movedRow\(moved\); \}/);
  assert.match(menu, /function modRow\(vendor, key, def, \{ name = null, note = null, home = false \} = \{\}\) \{\s*if \(!home\) \{ const moved = featureForControl\('mods', key, vendor\); if \(moved\) return movedRow\(moved\); \}/);
  assert.match(menu, /const cur = String\(read \? read\(\) : getPref\(key\)\);/, 'the row shows the lane\'s live value');
  assert.match(menu, /\(write \?\? \(\(v\) => setPref\(key, v\)\)\)\(tiers\[\(at \+ 1\) % tiers\.length\]\[0\]\)/, 'and writes through the row\'s own writer');
  assert.ok(!/choiceRow\('landViewDistance'/.test(menu), 'the Enhanced category\'s row left with its copy');
  assert.ok(!/LAND_VIEW_TIERS/.test(menu), 'the menu no longer knows the tiers; the registry hands them over');
  // the world host reads through the same function the row shows
  const world = read('src/scenes/world.js');
  assert.match(world, /import \{ landViewRead \} from '\.\.\/world\/landView\.js';/);
  assert.match(world, /const fogDistance = landViewRead\(\);/);
  assert.ok(!/landViewDistance\(\{/.test(world), 'no second composition of the read');
  // the DFU key stays in its category (the map is total) and its settings row is settingRow's pointer, through featureForControl
  assert.match(read('src/ui/settingsMap.js'), /"Experimental\/TerrainDistance",/);
});
