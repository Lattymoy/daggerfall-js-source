// The Overhauls page's bylines: a look is the original game's or ours. A feature that began as another work keeps its
// name on its own switch, never as the maker of a look (CREDITS-OUT, OWN-WORK).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERHAUL_PANELS } from '../../src/systems/overhauls.js';

test('the Sound overhaul\'s Enhanced is DFO Online\'s, as the Texture overhaul\'s Vanilla Enhanced is - its footsteps are our own clips, so no other work stands beside our name (mutants: the sound credited to Immersive Footsteps)', () => {
  const by = (id) => OVERHAUL_PANELS.find((p) => p.id === id).options.map((o) => o.by);
  assert.deepEqual(by('sound'), ['The original game', 'DFO Online']);
  assert.deepEqual(by('texture'), ['The original game', 'DFO Online']);
});
