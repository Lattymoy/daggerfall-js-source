// IC-GRAND x THE LIVING WORLD (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND, "The living world") - THE IMPERIAL
// CITY ONE TOWN. Profiled in the running game (tools/imperialCityProbe.mjs PROFILE): the first frame over the city's centre
// held 50-88 s of script, all of it the living world's trips (scenes/livingWorld/livingIndex.js -> systems/livingWorld/
// trips.js visitorsOf -> townTrips -> ownTrip -> roadChoices) - the city's 625 slices each a place of a populated type,
// each a city of 64 blocks, all within each other's TRIP_REACH_PX, every one's trips the others' visitors. A family
// capital's slice but its centre is a part of the city, no town of its own; the centre's place is its one town.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex } from '../../src/scenes/livingWorld/livingIndex.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { CAPITALS, capitalPlaceId, capitalSliceAside, capitalDims } from '../../src/world/tamrielCapitals.js';

const IC = CAPITALS.findIndex((c) => c.family);
const OTHER = CAPITALS.findIndex((c) => !c.family && capitalDims(c).w * capitalDims(c).h > 1);   // a harbour's two slices

test('IC-GRAND THE LIVING WORLD - the Imperial City one town: a family capital\'s slice but its centre no town of its own (capitalSliceAside), so its 625 slices never stand 625 cities within each other\'s trip reach; the centre\'s place the town; another capital\'s slices and every other place as they were (mutants: every slice a town; the centre aside too; any capital\'s slices aside)', () => {
  assert.ok(IC >= 0 && OTHER >= 0);
  assert.equal(capitalSliceAside(capitalPlaceId(IC, 0)), false, 'the centre the town');
  assert.equal(capitalSliceAside(capitalPlaceId(IC, 1)), true);
  assert.equal(capitalSliceAside(capitalPlaceId(IC, 624)), true);
  assert.equal(capitalSliceAside(capitalPlaceId(OTHER, 1)), false, 'a harbour\'s sea slice as it was');
  assert.equal(capitalSliceAside(1234), false, 'no capital\'s');
  const row = (mapId, px, py) => ({ mapId, name: `P${mapId}`, px, py, type: LOCATION_TYPES.TownCity, region: 17, w: 8, h: 8 });
  const pl = createWorldPlaces();
  const rows = [row(capitalPlaceId(IC, 0), 100, 100)];
  let so = 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) rows.push(row(capitalPlaceId(IC, so++), 100 + dx, 100 + dy));
  rows.push(row(7, 104, 100), row(capitalPlaceId(OTHER, 1), 106, 100));
  pl.register('bay', rows);
  const idx = createLivingIndex({ places: pl, populated: (t) => t === LOCATION_TYPES.TownCity, peopleAt: () => 0 });
  assert.equal(idx.townAt(100, 100)?.mapId, capitalPlaceId(IC, 0));
  for (const [x, y] of [[99, 99], [101, 100], [100, 101]]) assert.equal(idx.townAt(x, y), null, `${x},${y}: a part of the city`);
  assert.deepEqual(idx.townsNear(100, 100, 8).map((t) => t.mapId), [7, capitalPlaceId(IC, 0), capitalPlaceId(OTHER, 1)].sort((a, b) => a - b), 'the city once among the towns near');
  assert.equal(idx.towns().size, 3);
});
