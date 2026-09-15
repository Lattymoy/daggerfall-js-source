// FT4 - THE OUTDOORS, ONE ROW (2026-09-14, Mac's own condensing example:
// "our enhanced environments + dynamic skies ... mods/classic/enhanced
// that share commonalities").
//
// Two switches in two panes decided what the sky is: the Enhanced
// category's Enhanced environments (uiPrefs, EE1) and the Mods pane's
// Dynamic Skies `Enabled`. One row now, wearing Enhanced and Mod
// Authored, a three-way choice - Daggerfall's outdoors, the enhanced
// outdoors under the port's dome, or under Dynamic Skies' skybox - that
// reads and writes the two stores the way the host composes them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTDOORS_TIERS, OUTDOORS_DEFAULT, outdoorsRead, outdoorsWrite } from '../src/world/outdoors.js';
import { FEATURES, checkFeature, resolveControl, featureForControl, filterFeatures } from '../src/systems/features.js';
import { getPref, setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const reset = () => { _resetModSettings(); setPref('enhancedEnvironments', PREF_DEFAULTS.enhancedEnvironments); };

test('FT4: three tiers, and the default is the stores\' own defaults read back - environments on (EE1), every mod on (MO1)', () => {
  assert.deepEqual(OUTDOORS_TIERS.map(([v]) => v), ['off', 'dome', 'dynamic']);
  assert.equal(OUTDOORS_DEFAULT, 'dynamic');
  reset();
  try {
    assert.equal(PREF_DEFAULTS.enhancedEnvironments, true);
    assert.equal(modSetting('dynamic-skies', 'Enabled'), true);
    assert.equal(outdoorsRead(), OUTDOORS_DEFAULT, 'the default tier IS what the defaults read as');
  } finally { reset(); }
});

test('FT4: the read is the host\'s composition - off first, then which sky', () => {
  reset();
  try {
    setPref('enhancedEnvironments', false); setModSetting('dynamic-skies', 'Enabled', true);
    assert.equal(outdoorsRead(), 'off', 'environments off is off whatever the mod says (the mod is the enhanced lane\'s sky only)');
    setPref('enhancedEnvironments', true); setModSetting('dynamic-skies', 'Enabled', false);
    assert.equal(outdoorsRead(), 'dome');
    setModSetting('dynamic-skies', 'Enabled', true);
    assert.equal(outdoorsRead(), 'dynamic');
  } finally { reset(); }
});

test('FT4: one write, both stores - and OFF leaves the mod\'s switch as it was', () => {
  reset();
  try {
    assert.equal(outdoorsWrite('dome'), 'dome');
    assert.equal(getPref('enhancedEnvironments'), true); assert.equal(modSetting('dynamic-skies', 'Enabled'), false);
    assert.equal(outdoorsWrite('dynamic'), 'dynamic');
    assert.equal(getPref('enhancedEnvironments'), true); assert.equal(modSetting('dynamic-skies', 'Enabled'), true);
    assert.equal(outdoorsWrite('off'), 'off');
    assert.equal(getPref('enhancedEnvironments'), false);
    assert.equal(modSetting('dynamic-skies', 'Enabled'), true, 'off does not touch the mod: on again gets the sky the player had');
    assert.equal(outdoorsWrite('dome'), 'dome'); assert.equal(outdoorsWrite('off'), 'off');
    assert.equal(modSetting('dynamic-skies', 'Enabled'), false, '...either way');
    assert.equal(outdoorsWrite('nonsense'), OUTDOORS_DEFAULT, 'an unknown value is the default');
    assert.equal(getPref('enhancedEnvironments'), true); assert.equal(modSetting('dynamic-skies', 'Enabled'), true);
    // and every write reads back as itself
    for (const [v] of OUTDOORS_TIERS) { outdoorsWrite(v); assert.equal(outdoorsRead(), v); }
  } finally { reset(); }
});

test('FT4: the registry row - both labels, a condensed choice with its own default, covering the mod\'s switch and nothing else of the mod\'s', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-environments');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced', 'mod'], 'Mac\'s example: environments + Dynamic Skies wear both');
  assert.equal(f.control.store, 'prefs'); assert.equal(f.control.key, 'enhancedEnvironments');
  const c = resolveControl(f);   // RF4: the lane's fields, registered by outdoors.js
  assert.equal(f.control.lane, 'outdoors');
  assert.equal(c.tiers, OUTDOORS_TIERS); assert.equal(c.default, OUTDOORS_DEFAULT);
  assert.equal(c.read, outdoorsRead); assert.equal(c.write, outdoorsWrite);
  assert.equal(c.initial, true); assert.equal(c.online, true, 'the lane forces the outdoors on');
  assert.deepEqual(f.control.also, [{ store: 'mods', vendor: 'dynamic-skies', key: 'Enabled' }]);
  assert.match(f.note, /Off returns Daggerfall’s SKY\*\.DAT panorama/); assert.match(f.note, /BadLuckBurt and carademono/);
  // FT15 (2026-09-15): the note used to send a player to the Mods page for the mod's fog and
  // pixel-snow knobs. FT14 deleted that page - those knobs open in this row's own tile drawer
  // (MOD_CURATED['dynamic-skies']) - so the sentence was a pointer at nothing until the trim.
  assert.match(f.note, /whose own knobs open on this tile/, 'the mod\'s other knobs are the mod\'s, and the note says where they are NOW');
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('mods', 'Enabled', 'dynamic-skies'), f, 'the Mods pane\'s Enabled row is a pointer to this row');
  assert.equal(featureForControl('mods', 'densitySetting', 'dynamic-skies'), null, 'the fog knob is still the mod\'s own row');
  assert.notEqual(featureForControl('mods', 'Enabled', 'seasons-iliac-bay'), f, 'the vendor is part of the address (FT9: Seasons has its own row)');
  assert.ok(filterFeatures(FEATURES, 'enhanced').includes(f) && filterFeatures(FEATURES, 'mod').includes(f) && !filterFeatures(FEATURES, 'classic').includes(f));
});

test('FT4: the registry law - a condensed row names its own default, and it must be a tier', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-environments');
  const mut = (control) => checkFeature({ ...f, control: { ...resolveControl(f), lane: undefined, ...control } });   // RF4
  assert.deepEqual(mut({ default: 'smooth' }), ['tiers do not include the default smooth']);
  assert.deepEqual(mut({ default: undefined }), ['tiers do not include the default true'], 'without its own default the pref\'s value is asked for, and true is no tier');
  assert.deepEqual(mut({ default: 'off' }), []);
});

test('FT4: the Enhanced category\'s row left with its copy; the host\'s composition is untouched', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.ok(!/prefRow\('enhancedEnvironments'/.test(menu), 'the registry holds the words now');
  assert.ok(!/function portRowsEnhanced\(/.test(menu), 'FT12: the Enhanced category is gone from the settings rail - its rows are the home\'s');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /const enhancedLane = isEnhanced\(\) && params\.get\('sky'\) !== 'classic' && getPref\('enhancedEnvironments'\);/);
  assert.match(shared, /const dynamicOn = enhancedLane && \(skyDoor === 'dynamic' \|\| \(skyDoor === null && modSetting\('dynamic-skies', 'Enabled'\)\)\);/, 'the row writes the stores this line reads; it does not replace the line');
});
