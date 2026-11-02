// IT1 (2026-10-04): IMMERSIVE TRAVEL ON THE CLASSIC WINDOW (ui/travel/travelMapWindow.js) - the mod's CarriageMap: the
// five-texel page (Travel Options' routine as the mod copied it) with its own road switches and dot sizes, a driver's
// refusals as the mod's OK box over the map, its popups never the remembered one, and the player's own map turned into
// a CarriageMap while Travel Options is off (Init IL_03bf-03d2).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TravelMapWindow, OFFSET_LOOKUP, REGION_W, REGION_H, _setTravelMapArtForTests } from '../../src/ui/travel/travelMapWindow.js';
import { DOT_SCALE } from '../../src/ui/travel/travelPathsOverlay.js';
import { buildMapDict } from '../../src/systems/map/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';
import { resetTravelMapState, setTravelMapPopUpState } from '../../src/systems/travel/travelMapState.js';
import { restoreDiscovery } from '../../src/systems/discovery.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { readImmersiveTravelSettings, IT_POPUP, IT_TEXT, IMMERSIVE_TRAVEL_VENDOR } from '../../src/systems/immersiveTravel.js';

const DAGGERFALL = 17;
const ORIGIN = OFFSET_LOOKUP['FMAP0I17.IMG'];
const mapIdOf = (x, y) => (DAGGERFALL << 20) | getMapPixelID(x, y);
const row = (x, y, locationType) => ({ mapId: mapIdOf(x, y), longitude: x * 128, latitude: (499 - y) * 128, locationType, discovered: true, dungeonType: 255 });
const PLACES = [['Daggerfall', row(50, 120, LOCATION_TYPES.TownCity)], ['Copperfield', row(54, 122, LOCATION_TYPES.TownVillage)], ['The Old Keep', row(58, 124, LOCATION_TYPES.DungeonKeep)]];
function settings(over = {}) {
  const all = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default])), ...over };
  return readImmersiveTravelSettings((v, k) => (v === 'roads-hazelnut' ? true : all[k]));
}
function world(extra = {}) {
  resetTravelMapState();
  const mapNames = PLACES.map((e) => e[0]), mapTable = PLACES.map((e) => e[1]);
  const region = { name: REGION_NAMES[DAGGERFALL], locationCount: PLACES.length, mapNames, mapTable, mapNameLookup: new Map(mapNames.map((n, i) => [n, i])), mapIdLookup: new Map(mapTable.map((r, i) => [r.mapId, i])) };
  const maps = {
    regionCount: 62, getRegion: (i) => (i === DAGGERFALL ? region : null), getRegionByName: (n) => (n === region.name ? region : null),
    getRegionName: (i) => REGION_NAMES[i] ?? '', getPoliticIndex: () => 128 + DAGGERFALL, getClimateIndex: () => CLIMATES.Woodlands,
  };
  // a road running east-west through the village's pixel (E | W, the compass bits), a track nowhere
  const roads = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  roads[122 * MAP_WIDTH + 54] = 32 | 2;
  return {
    maps, mapDict: buildMapDict(maps), getPlayerPixel: () => ({ x: 50, y: 120 }), getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 1000, goldPieces: () => 1000, diseaseCount: () => 0, onTravel: () => {},
    roads: () => ({ roads, tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT) }),
    itHere: () => ({ x: 50, y: 120, mapId: mapIdOf(50, 120), locationType: LOCATION_TYPES.TownCity, regionIndex: DAGGERFALL }),
    ...extra,
  };
}
const mountArt = () => _setTravelMapArtForTests({
  overworld: { tex: 't', w: 320, h: 200 }, findAt: { tex: 't', w: 45, h: 22 },
  filterOn: { tex: 't', w: 179, h: 22 }, filterOff: { tex: 't', w: 179, h: 22 },
  downArrow: { tex: 't', w: 22, h: 20 }, upArrow: { tex: 't', w: 22, h: 20 }, rightArrow: { tex: 't', w: 22, h: 20 }, leftArrow: { tex: 't', w: 22, h: 20 },
  border: { tex: 't', w: 320, h: 160 }, pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
  fmapPalette: null, textRsc: null, locationPixelColors: new Array(14).fill(0).map((_, i) => 0xff000001 + i),
  identifyFlashColor: 0xff0f27a3, regionMaps: new Map(), deps: {},
});
/** The 5x5 cell of map pixel (mx, my) on the five-texel page, row by row from its bottom. */
const cell = (w, mx, my) => {
  const x = mx - ORIGIN[0], y = my - ORIGIN[1], w5 = REGION_W * DOT_SCALE;
  const o = ((REGION_H - y - 1) * DOT_SCALE * w5) + (x * DOT_SCALE);
  return [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => w._dotsBuf[o + r * w5 + c]));
};
const summary = (i) => ({ id: PLACES[i][1].mapId & 0xfffff, mapID: PLACES[i][1].mapId, regionIndex: DAGGERFALL, mapIndex: i, locationType: PLACES[i][1].locationType, discovered: true });

test('IT1 the classic CarriageMap: a driver\'s map, or the player\'s own with Travel Options off, is the five-texel page - the city large, the village small (ClearerMapDots), the road drawn by the mod\'s own switch', () => {
  restoreDiscovery(null); mountArt();
  try {
    const s = settings();
    const w = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: s } }));
    assert.deepEqual([w._carriageMap, w._dotsScale], [true, DOT_SCALE]);
    w._openRegionPanel(DAGGERFALL);
    const city = cell(w, 50, 120), village = cell(w, 54, 122);
    assert.ok(city.flat().every((v) => v !== 0), 'a city fills its 5x5');
    assert.equal(village[0][0], 0, 'a village is the middle 3x3');
    assert.notEqual(village[2][2], 0);
    // the road under it: the village's own dot covers the middle, and the road's two texels each way stand at the edge
    assert.notEqual(village[2][0], 0, 'W reaches the cell\'s edge');
    assert.notEqual(village[2][4], 0, 'E reaches the cell\'s edge');
    // the mod's switch off: no road
    const bare = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: settings({ 'General.DrawRoads': false }) } }));
    bare._openRegionPanel(DAGGERFALL);
    assert.equal(cell(bare, 54, 122)[2][0], 0, 'DrawRoads off: the road is not drawn');
    // ClearerMapDots off: every place large
    const big = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: settings({ 'General.ClearerMapDots': false }) } }));
    big._openRegionPanel(DAGGERFALL);
    assert.notEqual(cell(big, 54, 122)[0][0], 0);
    // the player's own map: a CarriageMap only while Travel Options is off
    assert.equal(new TravelMapWindow(world({ immersiveSettings: () => s }))._carriageMap, true);
    assert.equal(new TravelMapWindow(world({ immersiveSettings: () => s, travelOptions: () => ({ settings: {} }) }))._carriageMap, false);
    assert.equal(new TravelMapWindow(world())._carriageMap, false, 'the mod off: DFU\'s window');
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); }
});

test('IT1 the classic CarriageMap\'s popup: a refused place is the mod\'s OK box over the map (Return or O, nothing else); an allowed one is the mod\'s own popup, never the remembered toggles; the player\'s own map under Disable Normal Travel refuses inside the popup', () => {
  restoreDiscovery(null); mountArt();
  try {
    setTravelMapPopUpState({ speedCautious: false, travelShip: true, sleepModeInn: false });
    const s = settings();
    const w = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: s } }));
    w.locationSummary = summary(2);
    w._createPopUpWindow();
    assert.deepEqual([w.top, w._itRefusal, w.popUp ?? null], ['itRefusal', IT_TEXT.wrongType, null]);
    w.input('Escape');
    assert.equal(w.top, 'itRefusal', 'Escape does not answer an OK box');
    w.input('KeyO');
    assert.equal(w.top, null);
    w.locationSummary = summary(1);
    w._createPopUpWindow();
    assert.equal(w.popUp?.itKind, IT_POPUP.carriage);
    assert.deepEqual([w.popUp.speedCautious, w.popUp.travelShip, w.popUp.sleepModeInn], [true, false, true], 'the mod\'s OnPush, not the store\'s three');
    // Disable Normal Travel, the player's own map
    const own = new TravelMapWindow(world({ immersiveSettings: () => settings({ 'General.DisableNormalTravel': true }), travelOptions: () => ({ settings: {} }) }));
    own.locationSummary = summary(0);
    own._createPopUpWindow();
    assert.deepEqual([own.popUp?.itKind, own.popUp?.top], [IT_POPUP.player, 'itPush']);
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); resetTravelMapState(); }
});
