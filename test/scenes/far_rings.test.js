// FAR-RINGS (2026-10-28, the owner: "when planning a really far away route, the game comes to a halt and really lags";
// bible/06-Systems/Travel-View.md FAR-RINGS): a route asks every pixel it crosses for its town's ring (travelRoute.js
// routeLegs), and past the Bay a place not built yet was stamped whole to read it - its blocks generated, 14.5 s of one
// 17.7 s task on Daggerfall to the Imperial City, measured in the game. Past the Bay it is rung by its footprint now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locationFootprintRect, setLocationTiles } from '../../src/world/terrain/terrainTiles.js';

test('FAR-RINGS: the host rings a place past the Bay that is not built by its footprint (off the map table, no blocks), a place on the Bay by its stamped tiles as before, a built one by its build\'s own rect (mutant: the stamp asked past the Bay)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const r = built\.get\(key\)\?\.locationRect \?\? \(onTheBay\(x, y\) \? setLocationTiles\(loc, maps, blocks, new Uint8Array\(128 \* 128\)\) : locationFootprintRect\(loc\)\);/);
  // the footprint holds every tile the stamp could (LANDFORM4), so a ring round it never cuts the town
  const loc = { exterior: { exteriorData: { width: 2, height: 3, blockNames: ['A', 'B', 'C', 'D', 'E', 'F'] } }, mapTableData: { locationType: 0 } };
  const f = locationFootprintRect(loc);
  assert.deepEqual([f.xMax - f.xMin, f.yMax - f.yMin], [2 * 16 - 1 + 6, 3 * 16 - 1 + 6], 'the whole block grid and the town\'s clearance');
  assert.equal(typeof setLocationTiles, 'function');
});
