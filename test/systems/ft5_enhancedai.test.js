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
import { FEATURES, checkFeature, featureForControl } from '../../src/systems/features.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { tierOf } from '../../src/systems/settings/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('FT5: the registry row - Enhanced only, over the pref, on by default (BAL4), sound', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.ok(f);
  assert.deepEqual(f.kinds, ['enhanced'], 'the port\'s own; DFU\'s EnhancedCombatAI is a different thing and wears no label here');
  // PIN MOVED (TELL9: the row carries the telegraph contrast as its one part - the player's, online too)
  // PIN MOVED (BAL4, bible/05-Combat/Balance-Arc.md section 6: ON by default offline, as it always was online)
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedAI', initial: true, online: true,   // RF4: the row declares its default and the lane's answer
    also: [{ store: 'prefs', key: 'telegraphContrast', initial: false, online: 'player' }], parts: [{ key: 'telegraphContrast', label: 'Telegraph contrast' }] });
  assert.equal(PREF_DEFAULTS.enhancedAI, true, 'BAL4: on by default - the classic motor one choice away');
  assert.equal(f.effect, 'Takes effect at once; pathfinding from the next dungeon you enter.');   // AUDIT TACT D7: the tactics, cover and blows read the switch live; only the navmesh waits
  assert.deepEqual(checkFeature(f), []);
  assert.equal(featureForControl('prefs', 'enhancedAI'), f);
});

test('FT5: the note says what ships and names what it is not', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.equal(f.note, 'Enemies take turns, back off when hurt, and archers keep their distance. Big attacks are marked on the '
    + 'ground: hit hard to stagger them or dodge. Red, hatched attacks can’t be stopped. Trees, rocks and crates block '
    + 'sight and missiles. Pathfinding works in dungeons only for now; towns, interiors and doors come later. Off keeps '
    + 'the classic behavior.');   // PIN MOVED (PLAIN TEXT SWEEP): the note in plain words; DFU's "Smarter Enemies" stays unrowed below
  // ...and the DFU key it names IS unavailable, in Settings, under that label
  assert.equal(tierOf('Enhancements/EnhancedCombatAI'), 'unavailable');
  assert.match(read('src/ui/settings/settingsCopy.js'), /"Enhancements\/EnhancedCombatAI": "Smarter Enemies",/);
  assert.equal(featureForControl('settings', 'Enhancements/EnhancedCombatAI'), null, 'not rowed on the home - a row for a feature the port does not run would be a lie with a switch');
});

test('FT5: "still to come" is checked against the arc, not remembered - the claim dies the day the arc ships it', () => {
  const arc = read('bible/12-Enhanced-AI/Enhanced-AI-Arc.md');
  const ahead = arc.slice(arc.indexOf('## The slices ahead'));
  const f = FEATURES.find((x) => x.id === 'enhanced-ai');
  // the note promises nothing the arc has not reached, and names as ahead only what the arc lists as ahead
  for (const [claim, slice] of [['doors', /ENHANCED AI 4b - doors and the crowd/], ['towns, interiors', /ENHANCED AI 5 - exteriors and interiors/]]) {   // TACT2/TACT3 (Tactics-Arc): 'bunch up' died - the tokens, the ring and the spacing across pools shipped it
    assert.match(f.note, new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `the note names ${claim}`);
    assert.match(ahead, slice, `and the arc still lists it ahead - if this fails, the arc shipped it and the note must change`);
  }
});

test('FT5: the Enhanced category\'s row left with its copy; the switch\'s readers are the motor, the dungeon host, the pref and the registry', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.ok(!/prefRow\('enhancedAI'/.test(menu));
  assert.ok(!/enhancedAI/.test(menu), 'the menu no longer knows the key at all (AUDIT 55\'s reach pin moved its reader to the registry)');
  assert.ok(!/function portRowsEnhanced\(/.test(menu), 'FT12: the Enhanced category is gone from the settings rail - its rows are the home\'s');
});
