// TV-slice: the travel map's DUNGEON VISIBILITY (the row G8 opened).
// checkLocationDiscovered (DaggerfallTravelMapWindow.cs:1121-1131):
// findable = the BAKED MapTable Discovered flag OR the runtime
// discoveredLocations store - one uniform test, no type distinction
// (towns pass because the DATA marks them). CanFindPlace
// (:1135-1147) gates the find box, which is the port's typeahead.
// The write half: entering a location's pixel discovers it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TravelMapWindow } from '../src/ui/travelMap.js';
import { discoverLocation, restoreDiscovery } from '../src/systems/discovery.js';

const deps = { getPlayerPixel: () => ({ x: 0, y: 0 }), getClimateIndex: () => 0, gold: () => 0 };

test('TV: the typeahead hides an undiscovered dungeon until the store learns it', () => {
  restoreDiscovery(null);
  const index = [
    { name: 'Daggerfall', region: 'Daggerfall', pixel: { x: 1, y: 1 }, type: 0, mapId: 0x200001, discovered: true },
    { name: 'Dank Barrow', region: 'Daggerfall', pixel: { x: 2, y: 2 }, type: 10, mapId: 0x200002, discovered: false },
  ];
  const w = new TravelMapWindow(index, deps);
  // the town is BAKED discovered - findable from the first key
  w.search = 'da';
  w._refilter();
  assert.deepEqual(w.matches.map((e) => e.name), ['Daggerfall'], 'the hidden barrow is not in the list');
  // the runtime store learns it (a guild reveal, an entry) - findable
  discoverLocation(0x200002, { locationName: 'Dank Barrow' });
  w._refilter();
  assert.deepEqual(w.matches.map((e) => e.name).sort(), ['Daggerfall', 'Dank Barrow']);
  restoreDiscovery(null);
});

test('TV: the index carries the law inputs and the world writes on entry', () => {
  const tm = readFileSync(new URL('../src/ui/travelMap.js', import.meta.url), 'utf8');
  assert.ok(tm.includes('mapId: td.mapId, discovered: !!td.discovered'),
    'buildTravelIndex reads the BAKED flag off the map table row');
  assert.ok(tm.includes('e.discovered || hasDiscoveredLocationId(e.mapId)'),
    'the filter is checkLocationDiscovered exactly - baked OR store, no type arm');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes('discoverLocation(dfLocation.mapTableData.mapId'),
    'entering a location pixel discovers it (DiscoverCurrentLocation) - the write half');
});
