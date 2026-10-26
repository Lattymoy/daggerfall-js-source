// IC-GRAND x THE LIVING WORLD (2026-10-26, bible/03-World/Arena-Provinces.md IC-GRAND, "The living world") - THE IMPERIAL
// CITY ONE TOWN. Profiled in the running game (tools/imperialCityProbe.mjs PROFILE): the first frame over the city's centre
// held 50-88 s of script, all of it the living world's trips (scenes/livingWorld/livingIndex.js -> systems/livingWorld/
// trips.js visitorsOf -> townTrips -> ownTrip -> roadChoices) - the city's 625 slices each a place of a populated type,
// each a city of 64 blocks, all within each other's TRIP_REACH_PX, every one's trips the others' visitors. A family
// capital's slice but its centre is a part of the city, no town of its own; the centre's place is its one town.
// PIN MOVED (IC-GRAND x WW7-11, at the merge into the TESA branch): stream I's WW7-11 had already made a capital one town
// (livingIndex.js capitalStreet - no square, area or town's list names a street, a street sends no traveller), so IC-GRAND's
// own townOf line and its capitalSliceAside retired at the merge; this pin now holds the city once among the towns near and
// a street's own record standing for a reader on it (the soundscape's and the wagon warden's townAt) - WW7-11's law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { createLivingIndex } from '../../src/scenes/livingWorld/livingIndex.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { CAPITALS, capitalPlaceId, capitalDims } from '../../src/world/tamrielCapitals.js';
import { capitalStreet } from '../../src/scenes/livingWorld/livingIndex.js';

const IC = CAPITALS.findIndex((c) => c.family);
const OTHER = CAPITALS.findIndex((c) => !c.family && capitalDims(c).w * capitalDims(c).h > 1);   // a harbour's two slices

test('IC-GRAND THE LIVING WORLD - the Imperial City one town (WW7-11 capitalStreet): its slices but its centre are streets, so its 625 slices never stand 625 cities within each other\'s trip reach; the centre\'s place the town; a street\'s own record stands for a reader on it; every other place as it was', () => {
  assert.ok(IC >= 0 && OTHER >= 0);
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 0) }), false, 'the centre the town');
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 1) }), true);
  assert.equal(capitalStreet({ mapId: capitalPlaceId(IC, 624) }), true);
  assert.equal(capitalStreet({ mapId: 1234 }), false, 'no capital\'s');
  const row = (mapId, px, py) => ({ mapId, name: `P${mapId}`, px, py, type: LOCATION_TYPES.TownCity, region: 17, w: 8, h: 8 });
  const pl = createWorldPlaces();
  const rows = [row(capitalPlaceId(IC, 0), 100, 100)];
  let so = 1;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) rows.push(row(capitalPlaceId(IC, so++), 100 + dx, 100 + dy));
  rows.push(row(7, 104, 100), row(capitalPlaceId(OTHER, 1), 106, 100));
  pl.register('bay', rows);
  const idx = createLivingIndex({ places: pl, populated: (t) => t === LOCATION_TYPES.TownCity, peopleAt: () => 0 });
  assert.equal(idx.townAt(100, 100)?.mapId, capitalPlaceId(IC, 0));
  for (const [x, y] of [[99, 99], [101, 100], [100, 101]]) assert.ok(capitalStreet(idx.townAt(x, y)), `${x},${y}: a street of the city, its own record`);
  // the city once among the towns near is WW7-11's own pin (ww7_longer.test.js, past the Bay where a capital stands - this
  // fixture's Bay pixels are no capital's side)
});
