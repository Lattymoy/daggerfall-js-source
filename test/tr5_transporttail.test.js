import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dismountOnTransition, TRANSPORT_MODES } from '../src/systems/transport.js';
import { CANNOT_CHANGE_INDOORS } from '../src/ui/transportWindow.js';

// TR5 - THE ARC'S TAIL: the two laws TR1 and TR3 shipped WITHOUT
// CALLERS. `dismountOnTransition` was ported and never run, so you
// could ride a horse through a shop door and stay mounted inside;
// `CANNOT_CHANGE_INDOORS` was exported and never said, so the T key
// indoors did nothing instead of refusing. Both are the dangling-door
// shape this session found three times in other people's code
// (openUseMagicItem, openTransport, audio.setLoop) and then left in
// its own.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('TR5: both interior transitions dismount, and nothing else does (HandleTransition :196-202)', () => {
  const modes = read('src/scenes/worldModes.js');
  // The helper is one place, and both entry points call it with DFU's
  // own transition names.
  assert.match(modes, /function dismountPlayer\(transition\) \{\s*\n\s*const next = dismountOnTransition\(player\.transportMode, transition\);\s*\n\s*if \(next !== player\.transportMode\) host\.setTransportMode\?\.\(next\);/);
  assert.match(modes, /dismountPlayer\('ToBuildingInterior'\);\s*\n\s*transitioning = true;/, 'the building door');
  assert.match(modes, /dismountPlayer\('ToDungeonInterior'\);   \/\/ TR5/, 'the dungeon door');
  assert.equal((modes.match(/dismountPlayer\('/g) ?? []).length, 2, 'exactly the two DFU dismounts');
  // The law itself, once more at the boundary: leaving does NOT remount.
  assert.equal(dismountOnTransition(TRANSPORT_MODES.Horse, 'ToDungeonExterior'), TRANSPORT_MODES.Horse);
});

test('TR5: the T key indoors REFUSES with the HUD line, in both interior hosts', () => {
  assert.match(read('src/scenes/worldModes.js'), /openTransport\(\) \{ townTalk\?\.say\?\.\(CANNOT_CHANGE_INDOORS\); \},/);
  assert.match(read('src/scenes/dungeonContext.js'), /openTransport\(\) \{ hudText\.add\(CANNOT_CHANGE_INDOORS\); \},/);
  assert.equal(CANNOT_CHANGE_INDOORS, 'You cannot change transportation indoors.');
});

test('TR5: ONE place changes the mode, and both the pick and the dismount take it (U53)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const setTransportModeHere = \(mode\) => \{\s*\n\s*player\.setTransportMode\(mode\);/);
  assert.match(world, /ridingAnimator\.mount\(mode\);\s*\n\s*ridingArt = null;\s*\n\s*\};/, 'the art is dropped on every change');
  assert.match(world, /onMode: \(mode\) => \{\s*\n\s*setTransportModeHere\(mode\);/, 'the T-key pick');
  assert.match(world, /setTransportMode: \(mode\) => setTransportModeHere\(mode\),/, 'and the interior hosts');
  assert.equal((world.match(/player\.setTransportMode\(/g) ?? []).length, 1, 'one motor call, not a copy per caller');
});
