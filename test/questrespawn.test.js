// B3 (AUDIT 25 blocker 3): the RESPAWN PRIMITIVE.
//
// PlayerEnterExit.RespawnPlayer + Respawner (:430-556) - the
// host-level "put the player THERE": destroy the mounted context,
// move the world to the site's coordinates, re-enter as exterior or
// dungeon. The port's halves all existed (forceExitToExterior,
// _teleportToPixel, startInDungeon) and nothing composed them, so
// every TeleportPc idled forever on its declared-pending seam.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('B3 seam gate: the respawn trio is mounted and composed from the existing halves', () => {
  const world = read('src/scenes/world.js');
  const modes = read('src/scenes/worldModes.js');
  for (const seam of ['respawnPlayerAtSite:', 'isRespawning:', 'setPlayerScenePosition:']) {
    assert.ok(world.includes(seam), `questWorld mounts ${seam}`);
  }
  // the composition is the C# order: teardown, travel, re-enter
  const i = world.indexOf('async function _respawnAtSite');
  assert.ok(i > 0, 'the respawn composer exists');
  const body = world.slice(i, i + 1400);   // BT1 widened it (the unconditional-dungeon comment)
  const tOrder = ['forceExitToExterior', '_teleportToPixel', 'startInDungeon', 'surfacePlayer'];
  let at = 0;
  for (const step of tOrder) {
    const j = body.indexOf(step, at);
    assert.ok(j > 0, `${step} in the composition, in order`);
    at = j;
  }
  // an unresolvable location answers false BEFORE any teardown
  assert.match(world, /if \(!loc\?\.loaded\) return false;/);
  // BT1: NO site-type dispatch anywhere in the host - DFU's TeleportPc
  // hardcodes insideDungeon TRUE for every place (:113-118, a partial
  // implementation by its own header), so the port's old Building
  // refusal - which idled the action forever where DFU completes it -
  // was the divergence. The dungeon attempt is UNCONDITIONAL and the
  // entrance failing IS the exterior fallback (the "all else fails"
  // arm, :561-565).
  assert.ok(!world.includes('SITE_TYPES'), 'the site type never reaches the respawn host');
  assert.match(body, /the exterior fallback\.\n    const entered = await modes\?\.startInDungeon\(\);\s*\n\s*if \(!entered\) console\.warn/,
    'insideDungeon true always - the attempt sits UNGATED against its comment, the fallback loud');
  assert.ok(!body.includes('siteType'), 'the composer takes a location alone (RespawnPlayer x, y, true, true)');
  const seam = world.slice(world.indexOf('respawnPlayerAtSite: (place)'), world.indexOf('isRespawning:'));
  assert.ok(!seam.includes('siteType'), 'and the mount reads no site type either - location resolution is the only refusal');
  // the marker landing is mode-aware - the interior parents, the rest is raw scene space
  assert.match(modes, /setPlayerScenePosition\(p\) \{/);
  assert.match(modes, /interiorCtx\.parentPt\(p\.x, p\.y, p\.z\)/);
});

test('B3: TeleportPc drives the trio two-phase (idle while respawning, land on the tick after)', () => {
  // the ACTION side already shipped in Q3; this pins the contract the
  // host now answers - the exact reads, so a rename on either side
  // breaks here and not in silence
  const actions = read('src/systems/quest/actions.js');
  assert.match(actions, /if \(world\?\.isRespawning\?\.\(\)\) return;/);
  assert.match(actions, /if \(!world\.respawnPlayerAtSite\(place\)\) return;/);
  assert.match(actions, /world\.setPlayerScenePosition\?\.\(this\.resumePosition\);/);
});
