// FT5 - ENHANCED AI, THE ROW MOVES (2026-09-14, the Features arc).
//
// The navmesh-driven enemy motor's switch (12-Enhanced-AI) left the
// Enhanced category for the home. The audit found its words still true
// - dungeons only, the crowd and the doors ahead - and one thing to
// say that nothing said: it shares half a name with DFU's own
// Enhancements/EnhancedCombatAI ("Smarter Enemies"), which is a
// different feature the port does not run (Ledger A). Not a merge; the
// row says so, and the DFU key stays in Settings as the unavailable
// row it is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, checkFeature, featureForControl } from '../src/systems/features.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { tierOf } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT5: the registry row - Enhanced only, over the pref, off by default, sound', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced'], 'the port\'s own; DFU\'s EnhancedCombatAI is a different thing and wears no label here');
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedAI' });
  assert.equal(PREF_DEFAULTS.enhancedAI, false, 'off by default: the classic motor is the 1:1 law');
  assert.equal(f.effect, 'Takes effect on the next dungeon you enter.');
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'enhancedAI'), f);
});

test('FT5: the note says what ships and names what it is not', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.match(f.note, /Dungeons for now/);
  assert.match(f.note, /Off keeps the 1:1 classic motor/);
  assert.match(f.note, /not Daggerfall Unity’s “Smarter Enemies” setting \(EnhancedCombatAI\)/, 'the name collision, said outright');
  assert.match(f.note, /which the port does not run/);
  // ...and the DFU key it names IS unavailable, in Settings, under that label
  assert.equal(tierOf('Enhancements/EnhancedCombatAI'), 'unavailable');
  assert.match(read('src/ui/settingsCopy.js'), /"Enhancements\/EnhancedCombatAI": "Smarter Enemies",/);
  assert.equal(featureForControl('settings', 'Enhancements/EnhancedCombatAI'), null, 'not rowed on the home - a row for a feature the port does not run would be a lie with a switch');
});

test('FT5: "still to come" is checked against the arc, not remembered - the claim dies the day the arc ships it', () => {
  const arc = read('bible/12-Enhanced-AI/Enhanced-AI-Arc.md');
  const ahead = arc.slice(arc.indexOf('## The slices ahead'));
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  // the note promises nothing the arc has not reached, and names as ahead only what the arc lists as ahead
  for (const [claim, slice] of [['doors', /ENHANCED AI 4b - doors and the crowd/], ['the crowd slice', /ENHANCED AI 4b - doors and the crowd/], ['towns, interiors', /ENHANCED AI 5 - exteriors and interiors/]]) {
    assert.match(f.note, new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `the note names ${claim}`);
    assert.match(ahead, slice, `and the arc still lists it ahead - if this fails, the arc shipped it and the note must change`);
  }
});

test('FT5: the Enhanced category\'s row left with its copy; the switch\'s readers are the motor, the dungeon host, the pref and the registry', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.ok(!/prefRow\('enhancedAI'/.test(menu));
  assert.ok(!/enhancedAI/.test(menu), 'the menu no longer knows the key at all (AUDIT 55\'s reach pin moved its reader to the registry)');
  assert.match(menu, /FT5: the enemy-motor switch moved to the Features home/);
});
