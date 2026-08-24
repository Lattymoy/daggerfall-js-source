// TV-slice, re-pinned on U41's art window: the travel map's DUNGEON
// VISIBILITY. checkLocationDiscovered (DaggerfallTravelMapWindow.cs
// :1121-1131): findable = the BAKED MapTable Discovered flag OR the
// runtime discoveredLocations store - one uniform test, no type
// distinction (towns pass because the DATA marks them). It gates
// THREE surfaces in the classic window, where the keyed stand-in had
// only one: the DOTS drawn on a region page (:702-703), the find
// box's results (:1510-1512), and whether a hovered location can be
// selected at all (:1231-1233). CanFindPlace (:1134-1146) is the
// same test through a region+name pair. The write half: entering a
// location's pixel discovers it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TravelMapWindow, OFFSET_LOOKUP, REGION_W, REGION_H, _setTravelMapArtForTests } from '../src/ui/travelMapWindow.js';
import { resetTravelMapState } from '../src/systems/travelMapState.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { discoverLocation, restoreDiscovery } from '../src/systems/discovery.js';

const DAGGERFALL = 17;
const ORIGIN = OFFSET_LOOKUP['FMAP0I17.IMG'];
const mapIdOf = (x, y) => (DAGGERFALL << 20) | getMapPixelID(x, y);

const row = (x, y, locationType, discovered) => ({
  mapId: mapIdOf(x, y), longitude: x * 128, latitude: (499 - y) * 128,
  locationType, discovered, dungeonType: 255,
});

function world() {
  resetTravelMapState();
  const entries = [
    ['Daggerfall', row(50, 120, LOCATION_TYPES.TownCity, true)],
    ['Privateers Hold', row(52, 121, LOCATION_TYPES.DungeonRuin, false)],
  ];
  const mapNames = entries.map((e) => e[0]);
  const mapTable = entries.map((e) => e[1]);
  const region = {
    name: REGION_NAMES[DAGGERFALL], locationCount: entries.length, mapNames, mapTable,
    mapNameLookup: new Map(mapNames.map((n, i) => [n, i])),
    mapIdLookup: new Map(mapTable.map((r, i) => [r.mapId, i])),
  };
  const maps = {
    regionCount: 62,
    getRegion: (i) => (i === DAGGERFALL ? region : null),
    getRegionByName: (n) => (n === region.name ? region : null),
    getRegionName: (i) => REGION_NAMES[i] ?? '',
    getPoliticIndex: () => 128 + DAGGERFALL,
    getClimateIndex: () => CLIMATES.Woodlands,
  };
  return {
    maps,
    deps: {
      maps, mapDict: buildMapDict(maps),
      getPlayerPixel: () => ({ x: 50, y: 120 }),
      getClimateIndex: () => CLIMATES.Woodlands,
      gold: () => 1000, diseaseCount: () => 0, onTravel: () => {},
    },
  };
}

const mountArt = () => _setTravelMapArtForTests({
  overworld: { tex: 't', w: 320, h: 200 },
  findAt: { tex: 't', w: 45, h: 22 },
  filterOn: { tex: 't', w: 179, h: 22 }, filterOff: { tex: 't', w: 179, h: 22 },
  downArrow: { tex: 't', w: 22, h: 20 }, upArrow: { tex: 't', w: 22, h: 20 },
  rightArrow: { tex: 't', w: 22, h: 20 }, leftArrow: { tex: 't', w: 22, h: 20 },
  border: { tex: 't', w: 320, h: 160 },
  pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
  fmapPalette: null, textRsc: null,
  locationPixelColors: new Array(14).fill(0).map((_, i) => 0xff000001 + i),
  identifyFlashColor: 0xff0f27a3, regionMaps: new Map(), deps: {},
});

test('TV: a hidden dungeon has no dot, cannot be hovered, and cannot be found', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const w = new TravelMapWindow(world().deps);
    w._openRegionPanel(DAGGERFALL);
    const dot = (mx, my) => w._dotsBuf[((REGION_H - (my - ORIGIN[1]) - 1) * REGION_W) + (mx - ORIGIN[0])];
    assert.notEqual(dot(50, 120), 0, 'the town is BAKED discovered');
    assert.equal(dot(52, 121), 0, 'the hold is not');
    // the hover gate
    w.hover(52 - ORIGIN[0], 121 - ORIGIN[1] + 12);
    assert.equal(w.locationSelected, false);
    // the find gate: the hold is not among the results at all
    assert.deepEqual(w.findLocation('Privateers Hold').map((m) => m.text), ['Daggerfall'],
      'the only findable name is the discovered one');
    assert.equal(w.canFindPlace('Daggerfall', 'Privateers Hold'), false);
    assert.equal(w.canFindPlace('Daggerfall', 'Daggerfall'), true);

    // the runtime store learns it - a guild reveal, or walking in
    discoverLocation(mapIdOf(52, 121), { regionName: 'Daggerfall', locationName: 'Privateers Hold' });
    w._updateMapLocationDotsTexture();
    assert.notEqual(dot(52, 121), 0, 'the dot appears');
    w.hover(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    w.hover(52 - ORIGIN[0], 121 - ORIGIN[1] + 12);
    assert.equal(w.locationSelected, true, 'and it can be picked');
    assert.equal(w.canFindPlace('Daggerfall', 'Privateers Hold'), true);
    assert.deepEqual(w.findLocation('Privateers Hold').map((m) => m.text), ['Privateers Hold']);
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); }
});

test('TV: the law has ONE home, and the world still writes on entry', () => {
  const tm = readFileSync(new URL('../src/ui/travelMapWindow.js', import.meta.url), 'utf8');
  assert.ok(tm.includes('hasDiscoveredLocationId(summary.id) || !!summary.discovered'),
    'checkLocationDiscovered is the store OR the baked flag, no type arm');
  // every gate goes through the one method, never through the flag
  const gates = tm.match(/this\.checkLocationDiscovered\(/g) ?? [];
  assert.ok(gates.length >= 4, `four surfaces ask the one test (found ${gates.length})`);
  const md = readFileSync(new URL('../src/systems/mapDirectory.js', import.meta.url), 'utf8');
  assert.ok(md.includes('discovered: !!mapTable.discovered'),
    'the summary carries the BAKED flag off the map TABLE');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes('discoverLocation(dfLocation.mapTableData.mapId'),
    'entering a location pixel discovers it (DiscoverCurrentLocation) - the write half');
});
