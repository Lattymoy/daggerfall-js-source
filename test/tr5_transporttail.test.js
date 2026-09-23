import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

test('TR5/MAC-K3: ONE place changes the mode - and it is ONE PLACE ACROSS THE PORT now, not one per host', () => {
  // MAC-K3 widened U53's "one place" from one host to the whole port.
  // It used to read `scenes/world.js`, and the law it held - one motor
  // call, the art dropped and reloaded with the mode - was true there
  // and simply ABSENT from `scenes/exterior.js`, which had no
  // transport surface at all.
  const rig = read('src/player/mountRig.js');
  assert.match(rig, /function setMode\(mode\) \{\s*\n\s*player\.setTransportMode\(mode\);/);
  assert.match(rig, /animator\.mount\(mode\);\s*\n\s*art = null;/, 'the art is dropped on every change');
  // The door ENDS on the art drop and the SPRITE's own load (HC1,
  // 2026-09-14: the one place loads the mount it just set, so a loaded
  // save, the Test Room's ride and the ship's landing draw a horse, not
  // only the T-key pick). MW-D42 once hung an enhanced-skin 3D-horse
  // load off this tail; that horse was removed whole (2026-09-04), and
  // nothing but TR2's CFA load may grow back here unnoticed.
  assert.match(rig, /art = null;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(isRiding\(mode\)\) \{\s*\n\s*loadRidingArt\(fetchBytes, palette, renderer, mode\)[\s\S]{0,400}?\n\s*\}\s*\n\s*\}/,
    'the door: the drop, the sprite load, and nothing else');
  const door = rig.slice(rig.indexOf('function setMode(mode) {'), rig.indexOf('\n  }', rig.indexOf('function setMode(mode) {')));
  assert.ok(!/pegas|mesh|rig|nif/i.test(door), 'no 3D horse hangs off it');
  // TR4 put the Ship arm in front of the mode set - it is a teleport,
  // not a mode - so the pick reaches setMode past it.
  assert.match(rig, /if \(mode === TRANSPORT_MODES\.Ship\) \{ onShip\?\.\(\); return; \}\s*\n\s*if \(rt && \(mode === TRANSPORT_MODES\.Horse \|\| mode === TRANSPORT_MODES\.Cart\)\) \{ rt\.tryUseTransport\(mode\); return; \}[^\n]*\n\s*setMode\(mode\);/, 'the T-key pick (HCC: the mod\'s TryUseTransport stands between the ship arm and the mode set, and reaches setMode through the runtime\'s transport.set)');

  // ONE MOTOR CALL IN THE WHOLE PORT, derived rather than counted in
  // one file: `player.setTransportMode(` may be spelled exactly once
  // outside the motor itself, and that once is here.
  const callers = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) {
        const src = read(`${dir}/${e.name}`);
        const n = (src.match(/player\.setTransportMode\(/g) ?? []).length;
        if (n) callers.push([`${dir}/${e.name}`, n]);
      }
    }
  };
  walk('src');
  assert.deepEqual(callers, [['src/player/mountRig.js', 1]],
    'one motor call, in one module - not a copy per host');

  // and every host that changes the mode goes through the rig
  assert.match(read('src/scenes/world.js'), /const setTransportModeHere = \(mode\) => mountRig\.setMode\(mode\);/);
  assert.match(read('src/scenes/world.js'), /setTransportMode: \(mode\) => setTransportModeHere\(mode\),/, 'and the interior hosts');
});
