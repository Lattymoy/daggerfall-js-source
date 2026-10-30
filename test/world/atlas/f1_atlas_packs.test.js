// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE TOWN PACKS VALIDATED - Beautiful Villages and Beautiful Cities on
// the door as a player who loads both serves them, every place of the served world filled into one atlas: every block
// any town names is served. A pack's town carries no location door records (formats/worldData/worldDataReplacement.js
// locationFromJson writes none; nothing in the port reads them - a door is its block's), so the door count falls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorldAtlas } from '../../../tools/atlasMeasure.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'TAMRIEL2.IMG')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F1 with ARENA2, the town packs on: the same 16,160 places, every block they name served, the packs\' towns their own grids (mutant: the door unasked)', { skip: skipReal }, async () => {
  const log = console.log;
  console.log = () => {};
  let got;
  try { got = await loadWorldAtlas(/** @type {string} */ (ARENA2), { packs: true }); } finally { console.log = log; }
  const { atlas, filled } = got;
  assert.deepEqual(filled.unlocated, []);
  assert.deepEqual(atlas.problems(), [], 'every block a pack\'s town names is served');
  const c = atlas.counts();
  assert.deepEqual([c.places, c.exteriorSlots, c.doors], [16160, 100192, 195762]);
  assert.ok(c.rmb > 1124, 'the packs name blocks of their own');
});
