// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS OF THE SERVED WORLD - the player's files through the
// world-data door with the game's own installs (scenes/modWorldData.js), and the world past the Bay as the places host
// stands it (scenes/tamrielPlacesHost.js): the capitals' slices, Arena's places, and the countryside and lairs rolled
// on their pixels. Every province's places are bundles beside the Bay's, each in its province's region, and every block
// any of them names resolves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorldAtlas } from '../../../tools/atlasMeasure.mjs';
import { fillAtlas } from '../../../src/world/atlas/atlas.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'TAMRIEL2.IMG')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F1 with ARENA2, the served world: the Bay\'s 15,251 and the 909 listed past it (the capitals\' slices and Arena\'s places), each province\'s region holding its own (62..70) and none in no province - a capital\'s harbour on the picture\'s sea its province\'s; every name resolves; a rolled countryside and its lairs by Solitude bundled the same (mutants: the region of a place past the Bay, the wall\'s carrier unstood, a harbour slice\'s province)', { skip: skipReal }, async () => {
  const log = console.log;
  console.log = () => {};
  let got;
  try { got = await loadWorldAtlas(/** @type {string} */ (ARENA2), { served: true }); } finally { console.log = log; }
  const { atlas, filled, places, tamriel } = got;
  assert.deepEqual(filled.unlocated, []);
  const c = atlas.counts();
  assert.deepEqual([c.places, c.dungeons, c.regions], [16160, 4239, 54]);
  assert.deepEqual(atlas.problems(), [], 'every block the served world names resolves, past the Bay too');
  const past = [...atlas.parts('region')].filter((r) => r.region >= 62).map((r) => [r.region, r.places]);
  assert.deepEqual(past, [[62, 29], [63, 31], [64, 33], [65, 31], [66, 33], [67, 31], [68, 32], [69, 32], [70, 657]]);
  assert.deepEqual(atlas.inRegion(-1), [], 'no place stands in no province');
  const harbours = ['Alinor Harbour', 'Torval Docks'].map((n) => places.all().find((p) => p.name === n));
  assert.deepEqual(harbours.map((p) => p?.region), [66, 68]);
  // AUDIT FOUNDATION A1: the slice the build stands is in the same province - a home's claim, a quest's place and a bank
  // read the location's region, the registry's systems the row's
  assert.deepEqual(harbours.map((p) => tamriel.provinceQuestPlaces.sliceAt(p.px, p.py)?.regionIndex), [66, 68]);
  for (const b of atlas.inRegion(64)) {
    assert.equal(b.place.theatre, 3, `${b.place.name} stands in Skyrim's theatre`);
    assert.ok(b.exterior && b.exterior.blocks.every((w) => w >= 0), `${b.place.name}: a whole grid`);
  }
  assert.ok(atlas.usersOf('TESAOPEN.RMB').some((id) => atlas.place(id).place.region >= 62), 'an open cell of a town past the Bay');
  const P = tamriel.provinceQuestPlaces, sol = places.all().find((p) => p.name === 'Solitude');
  const rows = [...P.countryNear(sol.px, sol.py, 24), ...P.lairsNear(sol.px, sol.py, 24)];
  const rolled = fillAtlas(atlas, rows.map((r) => ({ ...r, region: P.regionAt(r.px, r.py), source: 'rolled' })), (p) => P.standAt(p.px, p.py));
  assert.deepEqual([rows.length, rolled.unlocated.length, atlas.problems().length], [62, 0, 0], 'the countryside and the lairs within 24 of Solitude, every block served');
  assert.ok(rows.every((r) => atlas.place(r.mapId).place.region === 64));
});
