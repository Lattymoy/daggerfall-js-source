// WESTHEAD-NORTH in Beautiful Cities' layout (AUDIT A2; the owner: "North in both layouts"): the packs are on by default
// and online, so most players stand in this layout. Before #1184 its shipyard stood on the north edge (cells 181, 424);
// TS7 put it on the west side. A file of its own: the packs are registered process-wide (test/bayPortGround.mjs `packs`).
// Held here: the layout's own row stands it on the north farmland nearest its old place, on today's ground and #1184's;
// Daggerfall's row would stand it 176 m inland, so a row is a layout's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { portSitesOn, portPlacesNear } from '../../src/world/portSites.js';
import { siteFits } from '../../src/world/merchantYards/merchantYardSites.js';
import { layoutsMatch } from '../../src/systems/layoutPins.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('WESTHEAD-NORTH with ARENA2, Beautiful Cities\' layout: the shipyard on the north farmland nearest its pre-#1184 place, fitting today\'s ground; without its row TS7\'s west side; Daggerfall\'s row here a place inland (mutants: the row dropped; the classic row in every layout)', { skip: skipReal, timeout: 900_000 }, async () => {
  const { bayPortGround } = await import('../bayPortGround.mjs');
  const { yl, ground, field: sea, mapId } = await bayPortGround(ARENA2, readFileSync, 'Westhead Moor', { packs: true });
  assert.match(yl.blocks.map((b) => b.blockName).join(','), /FARMAA/, 'the town in Beautiful Cities\' blocks');
  const law = portSitesOn(ground(), sea);
  assert.deepEqual(law.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 25, 109, 1], ['lighthouse', 12, 187, 0]], 'TS7\'s places: the west side');
  const row = portPlacesNear(mapId, 'beautiful-cities@0.5.0', layoutsMatch);
  const now = portSitesOn(ground(), sea, row);
  assert.deepEqual(now.map((s) => [s.kind, s.gx, s.gy, s.turn]), [['shipyard', 265, 413, 1], ['lighthouse', 25, 114, 1]]);
  assert.ok(now[0].gy > (yl.height - 1) * 64, 'on the north edge\'s blocks, as before #1184');
  assert.equal(siteFits(ground(), now[0]), true, 'on the ground the yards are placed on');
  const classic = portSitesOn(ground(), sea, portPlacesNear(mapId, 'classic', layoutsMatch));
  assert.deepEqual([classic[0].gx, classic[0].gy, classic[0].turn], [97, 409, 3], 'Daggerfall\'s cell names another place here');
});
