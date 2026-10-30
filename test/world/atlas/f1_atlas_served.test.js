// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS OF THE SERVED WORLD - the player's files through the
// world-data door with the port's own edits, and the places past the Bay on the player's trace. Every province's places
// are bundles beside the Bay's, each in its province's region, and every block any of them names resolves - the wall
// carrier of a walled town past the Bay among them (the host stands it, scenes/tamrielPlacesHost.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorldAtlas } from '../../../tools/atlasMeasure.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'TAMRIEL2.IMG')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('F1 with ARENA2, the served world: the Bay\'s 15,251 and the 283 past it, each province\'s region holding its own (62..70); every name resolves; a town past the Bay is its template\'s exterior opened on its outline (mutants: the region of a place past the Bay, the wall\'s carrier unstood)', { skip: skipReal }, async () => {
  const { atlas, filled } = await loadWorldAtlas(/** @type {string} */ (ARENA2), { served: true });
  assert.deepEqual(filled.unlocated, []);
  const c = atlas.counts();
  assert.deepEqual([c.places, c.dungeons, c.regions], [15534, 4232, 54]);
  assert.deepEqual(atlas.problems(), [], 'every block the served world names resolves, past the Bay too');
  const past = [...atlas.parts('region')].filter((r) => r.region >= 62).map((r) => [r.region, r.places]);
  assert.deepEqual(past, [[62, 29], [63, 31], [64, 33], [65, 31], [66, 32], [67, 31], [68, 31], [69, 32], [70, 33]]);
  for (const b of atlas.inRegion(64)) {
    assert.equal(b.place.theatre, 3, `${b.place.name} stands in Skyrim's theatre`);
    assert.ok(b.exterior && b.exterior.blocks.every((w) => w >= 0), `${b.place.name}: a whole grid`);
  }
  assert.ok(atlas.usersOf('TESAOPEN.RMB').some((id) => atlas.place(id).place.region >= 62), 'an open cell of a town past the Bay');
});
