import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══ WINFOE1: THE ENEMY POOLS KEEP THEIR CLOCK UNDER A WINDOW ═══════
//
// Mac, 2026-09-17: "enemies should still be able to do damage" - a
// window (the rest window above all: RESTX2's whole point is that a
// foe can walk up and break a rest; but also the inventory, a status
// box, a quest popup) no longer zeroes the enemy pools' dt. What a
// window holds is the player's own motor. The CIVILIANS still freeze
// under the talk overlay (audit 2026-08-17: nobody walks away mid-talk)
// - that law was never about enemies, and the zip that brought this
// change dropped it without a word; it stands.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('WINFOE1: the four enemy pools drive on the frame\'s own dt under a window; the two populations still freeze under the talk overlay; the encounter roll and the interior door-opening keep their gates', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /livePersonBatches\.push\(\.\.\.cityGuards\.update\(dt,\s*\n\s*walkMode && playerSpawned \? player\.pos : cam\.pos, cam\.pos, _foeSenses\(\)\)\);/, 'world.js: the watch');
  assert.match(w, /exteriorFoes\.update\(dt, _pf, cam\.pos, _foeSenses\(\)\);/, 'world.js: the encounter pool');
  assert.match(w, /const live = p\.population\.update\(townTalk\.overlayActive \? 0 : dt, local, cam\.yaw, local, isDay,/, 'world.js: the civilians still freeze');
  assert.match(w, /if \(!townTalk\.overlayActive\) runEncounterTick\(_pf\);/, 'world.js: the frame\'s roll stays gated - under a rest the SESSION drives it, through advanceMinutes');
  const e = read('src/scenes/exterior.js');
  assert.match(e, /const guardBatches = cityGuards\.update\(dt,\s*\n\s*walkMode \? player\.pos : cam\.pos, eye, _senses\);/, 'exterior.js: the watch');
  assert.match(e, /exteriorFoes\.update\(dt,\s*\n\s*walkMode \? player\.pos : cam\.pos, eye, _senses\);/, 'exterior.js: the encounter pool');
  assert.match(e, /const popDt = townTalk\.overlayActive \? 0 : dt;/, 'exterior.js: the civilians still freeze');
  assert.match(e, /if \(!townTalk\.overlayActive\) runEncounterTick\(walkMode \? player\.pos : cam\.pos\);/, 'exterior.js: the frame\'s roll stays gated');
  const m = read('src/scenes/worldModes.js');
  assert.match(m, /interiorFoes\.update\(dt, player\.pos, cam\.pos, _interiorSenses\(\)\);/, 'worldModes.js: the interior pool');
  assert.match(m, /const _guardBatches = interiorGuards\.update\(dt, player\.pos, cam\.pos,/, 'worldModes.js: the indoor watch');
  assert.match(m, /if \(!overlayHeld\) openInteriorDoors\(interiorFoes\.foes\);/, 'worldModes.js: a foe still opens no door under a window - the door law is the mode\'s, not the pool\'s');
  for (const [name, h] of [['world.js', w], ['exterior.js', e], ['worldModes.js', m]]) {
    assert.ok(!/(?:Foes|Guards)\.update\((?:townTalk\.overlayActive|overlayHeld) \? 0 : dt/.test(h), `${name}: no enemy pool is frozen by a window any more`);
  }
});
