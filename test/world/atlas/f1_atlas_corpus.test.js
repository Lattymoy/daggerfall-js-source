// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS ON THE PLAYER'S OWN FILES, as Daggerfall shipped them - the
// numbers the proposal "A Foundation for Scale" measured, re-taken (tools/atlasMeasure.mjs). Every name a place gives
// resolves in BLOCKS.BSA; a quarter of its exterior blocks no place names. The served world (the door, the places past
// the Bay) is f1_atlas_served.test.js: the door is one per process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorldAtlas } from '../../../tools/atlasMeasure.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F1 with ARENA2, the classic files: 15,251 places in 45 regions, 328,499 buildings, 548,618 doors, 4,232 dungeons; 45,427 exterior slots over 658 blocks, 40,263 dungeon slots over 187; every name resolves; 262 of the 920 RMB no place names (mutants: the doors\' source, the dungeon gate)', { skip: skipReal }, async () => {
  const { atlas, filled, blockNames } = await loadWorldAtlas(/** @type {string} */ (ARENA2));
  assert.deepEqual(filled.unlocated, []);
  assert.deepEqual(atlas.counts(), { places: 15251, buildings: 328499, doors: 548618, dungeons: 4232, exteriorSlots: 45427, rmb: 658, dungeonSlots: 40263, rdb: 187, regions: 45 });
  assert.deepEqual(atlas.problems(), [], 'every block a place names stands in BLOCKS.BSA');
  assert.deepEqual([atlas.unused(blockNames, 'rmb').length, blockNames.filter((n) => /\.RMB$/.test(n)).length], [262, 920]);
  assert.deepEqual(atlas.unused(blockNames, 'rdb'), []);
  const df = atlas.place(1291010263);
  assert.equal(df.place.name, 'Daggerfall');
  const names = atlas.words().map((w) => w.name);
  assert.deepEqual([df.exterior.w, df.exterior.h, df.buildings.type.length, df.doors.length, df.dungeon.blocks.length, df.dungeon.start], [8, 8, 316, 424, 16, 0], 'the city whole: its grid, its buildings and doors, its castle\'s plan');
  assert.deepEqual([...df.exterior.blocks.slice(0, 8)].map((w) => names[w]), ['WALLAA02.RMB', 'WALLAA06.RMB', 'WALLAA10.RMB', 'WALLAA06.RMB', 'WALLAA06.RMB', 'WALLAA06.RMB', 'WALLAA06.RMB', 'WALLAA03.RMB']);
  const ring = [...atlas.parts('rmb')].find((w) => w.name === 'WALLAA06.RMB');
  assert.deepEqual([ring.uses, ring.places], [1433, 410], 'the most used block: the walled cities\' ring, 410 of them');
});
