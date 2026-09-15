// FT9 - THE FIVE PACKS WITH A SWITCH (2026-09-14, the Features arc; Mac:
// "Mod Authored is dedicated to ... the mods we ported 1:1 so far",
// and 2026-09-08 "place each creator's name in the mod title").
//
// One row per vendored mod on the home, Mod Authored: the mod's own
// Enabled switch, its own title with the creator's name, its own
// description as the note - one source, modSettings.js, where the
// mod's modsettings ship. Its other knobs stay under its card on the
// Mods page, whose Enabled row is a pointer here (FT2's gate). Every
// vendored mod with a switch has a row, both ways, so a mod vendored
// tomorrow without one fails here rather than sitting off the home.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, checkFeatures, featureForControl, filterFeatures } from '../src/systems/features.js';
import '../src/world/landView.js';   // RF4: the condensed rows' lanes register themselves; checkFeatures reads them
import '../src/world/outdoors.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const rows = FEATURES.filter((f) => f.control.store === 'mods');

test('FT9: every vendored mod with a switch has exactly one row over it, and every mod row is a real mod\'s - both ways', () => {
  const vendors = Object.keys(MOD_SETTINGS).filter((v) => MOD_SETTINGS[v].keys.Enabled);
  assert.ok(vendors.length >= 6, vendors.join(', '));
  for (const v of vendors) {
    const f = featureForControl('mods', 'Enabled', v);
    assert.ok(f, `${v} has a row on the home`);
    assert.ok(f.kinds.includes('mod'), `${v}'s row wears Mod Authored`);
  }
  for (const f of rows) assert.ok(MOD_SETTINGS[f.control.vendor]?.keys?.[f.control.key], `${f.id} names a real switch`);
  assert.deepEqual(checkFeatures(FEATURES), []);
  assert.equal(rows.length, 8, 'eight direct rows (Dynamic Skies rides the outdoors row through `also`; WW1 added Weapon Widget, HT1 Handheld Torches, AT0 Ambient Text)');
  // WM3: NINE wear the Mod Authored tag - the seven direct rows, the
  // outdoors row (Dynamic Skies rides it), and Windmills, whose row is
  // a PREF because the pack ships no settings file to carry an Enabled
  // key. `rows` above is the mods-STORE rows and stays seven.
  assert.equal(filterFeatures(FEATURES, 'mod').length, 10);
});

test('FT9: a mod row is the mod\'s own - the creator in the title, the modsettings description as the note, one source', () => {
  for (const f of rows) {
    const mod = MOD_SETTINGS[f.control.vendor];
    assert.equal(f.title, `${mod.title} by ${mod.author}`, `${f.id}: the creator's name in the title`);
    assert.equal(f.note, mod.keys.Enabled.description, `${f.id}: the mod's own words, not a copy`);
    assert.deepEqual(f.kinds, ['mod']);
    assert.equal(f.control.key, 'Enabled');
    assert.equal(mod.keys.Enabled.default, true, `${f.id} ships on (MO1)`);
    assert.match(f.effect, /^Takes effect /, `${f.id} says when`);
  }
  assert.deepEqual(rows.map((f) => f.id), ['mod-seasons-iliac-bay', 'mod-roads-hazelnut', 'mod-meanermonsters', 'mod-pcaao', 'mod-unleveledloot', 'mod-weapon-widget', 'mod-handheld-torches', 'mod-ambient-text'], 'the Mods pane\'s order');
});

test('FT9: when each switch lands, as the port knows it', () => {
  const effect = (v) => featureForControl('mods', 'Enabled', v).effect;
  assert.equal(effect('seasons-iliac-bay'), 'Takes effect when the world next loads.', 'read at the world host\'s mount');
  assert.equal(effect('roads-hazelnut'), 'Takes effect when the world next loads.', 'the network is built at mount (ROADS 24 / BR3)');
  assert.equal(effect('meanerMonsters'), 'Takes effect on monsters spawned after the switch.');
  assert.ok(!/Takes effect/.test(MOD_SETTINGS.meanerMonsters.keys.Enabled.description), 'the effect line left the description - one sentence, one place');
  assert.equal(effect('pcaao'), 'Takes effect at once.', 'the registered arms read the switches live (pcaao.js)');
  assert.equal(effect('unleveledLoot'), 'Takes effect on the next roll.');
  // and the rows are pointed at from the Mods pane, not doubled there: the covered vendor resolves, the mod's other knobs do not
  assert.ok(featureForControl('mods', 'Enabled', 'pcaao'));
  assert.equal(featureForControl('mods', 'armorHitFormulaRedone', 'pcaao'), null, 'the overhaul\'s modules stay the mod\'s own rows on the Mods page');
  assert.equal(featureForControl('mods', 'SmoothRoads', 'roads-hazelnut'), null);
});
