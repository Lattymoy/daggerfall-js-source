// U41: THE CLASSIC TRAVEL MAP WINDOW - the art window that retires
// the F-slice's keyed typeahead. These pins are
// DaggerfallTravelMapWindow.cs's own laws: the layout table, the dot
// colour switch with its four filter bands, the dots walk over
// politic + map dict + discovery, the region page's life, the find
// box's edit-distance search, the identify flash and the
// confirmation it pops, the zoom crop, and the draw's geometry
// through a recording renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TravelMapWindow, BUTTON_RECTS, FILTER_SRC, FIND_SRC, AT_SRC, REGION_RECT, REGION_W, REGION_H,
  OFFSET_LOOKUP, OUTLINE_DISPLACEMENTS, BETONY_INDEX, ZOOM_FACTOR, FIND_MAX_CHARACTERS,
  IDENTIFY_FLASH_COUNT, IDENTIFY_FLASH_COUNT_SELECTED, IDENTIFY_FLASH_INTERVAL,
  getRegionMapNames, getRegionMapScale, getPixelColorIndex, hasRegionPage,
  _setTravelMapArtForTests, setRevealUndiscoveredLocations,
} from '../src/ui/travelMapWindow.js';
import { resetTravelMapState, travelMapSaveData, setTravelMapPopUpState } from '../src/systems/travelMapState.js';
import { composeSessionState, restoreSessionState } from '../src/systems/save.js';
import { buildMapDict, locationSummaryAt, hasLocation } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { discoverLocation, restoreDiscovery } from '../src/systems/discovery.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { DFPalette } from '../src/formats/dfPalette.js';

/** PopulateRegionOffsetDict, transcribed from
 *  DaggerfallTravelMapWindow.cs:590-648. */
const EXPECTED_OFFSETS = {
  'FMAPAI00.IMG': [212, 340], 'FMAPBI00.IMG': [322, 340], 'FMAPAI01.IMG': [583, 279],
  'FMAPBI01.IMG': [680, 279], 'FMAPCI01.IMG': [583, 340], 'FMAPDI01.IMG': [680, 340],
  'FMAP0I05.IMG': [381, 4], 'FMAP0I09.IMG': [525, 114], 'FMAP0I11.IMG': [437, 340],
  'FMAPAI16.IMG': [578, 0], 'FMAPBI16.IMG': [680, 0], 'FMAPCI16.IMG': [578, 52],
  'FMAPDI16.IMG': [680, 52], 'FMAP0I17.IMG': [39, 106], 'FMAP0I18.IMG': [20, 29],
  'FMAP0I19.IMG': [80, 123], 'FMAP0I20.IMG': [217, 293], 'FMAP0I21.IMG': [263, 79],
  'FMAP0I22.IMG': [548, 219], 'FMAP0I23.IMG': [680, 146], 'FMAP0I26.IMG': [680, 80],
  'FMAP0I32.IMG': [41, 0], 'FMAP0I33.IMG': [660, 101], 'FMAP0I34.IMG': [578, 40],
  'FMAP0I35.IMG': [525, 3], 'FMAP0I36.IMG': [440, 40], 'FMAP0I37.IMG': [448, 0],
  'FMAP0I38.IMG': [366, 0], 'FMAP0I39.IMG': [300, 8], 'FMAP0I40.IMG': [202, 0],
  'FMAP0I41.IMG': [223, 6], 'FMAP0I42.IMG': [148, 76], 'FMAP0I43.IMG': [15, 340],
  'FMAP0I44.IMG': [61, 340], 'FMAP0I45.IMG': [86, 338], 'FMAP0I46.IMG': [132, 340],
  'FMAP0I47.IMG': [344, 309], 'FMAP0I48.IMG': [381, 251], 'FMAP0I49.IMG': [553, 255],
  'FMAP0I50.IMG': [661, 217], 'FMAP0I51.IMG': [672, 275], 'FMAP0I52.IMG': [680, 256],
  'FMAP0I53.IMG': [680, 340], 'FMAP0I54.IMG': [491, 340], 'FMAP0I55.IMG': [293, 340],
  'FMAP0I56.IMG': [263, 340], 'FMAP0I57.IMG': [680, 157], 'FMAP0I58.IMG': [17, 53],
  'FMAP0I59.IMG': [0, 0], 'FMAP0I60.IMG': [107, 11], 'FMAP0I61.IMG': [255, 275],
};

const DAGGERFALL = 17;                 // FMAP0I17.IMG, origin (39,106)
const ORIGIN = OFFSET_LOOKUP['FMAP0I17.IMG'];

/** A map table row at a MAP PIXEL: mapId's low 20 bits ARE the pixel
 *  id, which is the identity ContentReader.EnumerateMaps keys by. */
const row = (x, y, locationType, discovered, region = DAGGERFALL) => ({
  mapId: (region << 20) | getMapPixelID(x, y),
  longitude: x * 128, latitude: (499 - y) * 128,
  locationType, discovered, dungeonType: 255, key: 0, locationId: 0,
});

function mkRegion(index, entries) {
  const mapNames = entries.map((e) => e.name);
  const mapTable = entries.map((e) => e.row);
  const mapNameLookup = new Map();
  mapNames.forEach((n, i) => { if (!mapNameLookup.has(n)) mapNameLookup.set(n, i); });
  return {
    name: REGION_NAMES[index], locationCount: entries.length, mapNames, mapTable,
    mapNameLookup, mapIdLookup: new Map(mapTable.map((r, i) => [r.mapId, i])),
  };
}

/** Three places in Daggerfall: a city, a hidden ruin, and a temple
 *  whose name shares a prefix with the city. */
const ENTRIES = [
  { name: 'Daggerfall', row: row(50, 120, LOCATION_TYPES.TownCity, true) },
  { name: 'Dank Barrow', row: row(52, 121, LOCATION_TYPES.DungeonRuin, false) },
  { name: 'Daggerfall Chapel', row: row(54, 122, LOCATION_TYPES.ReligionTemple, true) },
];

function mkWorld(over = {}) {
  // the filters and the popup toggles outlive a window on purpose
  // (DFU keeps one instance), so every fixture starts from defaults
  resetTravelMapState();
  const regions = { [DAGGERFALL]: mkRegion(DAGGERFALL, ENTRIES) };
  const maps = {
    regionCount: 62,
    getRegion: (i) => regions[i] ?? null,
    getRegionByName: (n) => Object.values(regions).find((r) => r.name === n) ?? null,
    getRegionName: (i) => REGION_NAMES[i] ?? '',
    // Daggerfall owns the block the page covers; one pixel belongs to
    // Wayrest so the switch-region arm has somewhere to point.
    getPoliticIndex: (x, y) => (x === 60 && y === 130 ? 128 + 23 : 128 + DAGGERFALL),
    getClimateIndex: () => CLIMATES.Woodlands,
    ...over.maps,
  };
  const mapDict = buildMapDict({
    regionCount: 62,
    getRegion: (i) => regions[i] ?? null,
  });
  const traveled = [];
  const deps = {
    maps, mapDict,
    getPlayerPixel: () => ({ x: 50, y: 120 }),
    getClimateIndex: (x, y) => maps.getClimateIndex(x, y),
    gold: () => 1000,
    diseaseCount: () => 0,
    onTravel: (pick, opts, computed) => traveled.push({ pick, opts, computed }),
    ...over.deps,
  };
  return { maps, mapDict, deps, traveled, regions };
}

const img = (name, w, h) => ({ tex: `tex:${name}`, w, h });
function mountArt(over = {}) {
  const colors = new Array(14).fill(0).map((_, i) => 0xff000001 + i);
  _setTravelMapArtForTests({
    overworld: img('TRAV0I00', 320, 200),
    findAt: img('TRAV0I03', 45, 22),
    filterOn: img('TRAV01I0', 179, 22),
    filterOff: img('TRAV01I1', 179, 22),
    downArrow: img('TRAVAI05', 22, 20), upArrow: img('TRAVBI05', 22, 20),
    rightArrow: img('TRAVCI05', 22, 20), leftArrow: img('TRAVDI05', 22, 20),
    border: img('MBRD00I0', 320, 160),
    pickerBitmap: { width: 320, height: 200, data: new Uint8Array(320 * 200) },
    fmapPalette: null, textRsc: null,
    locationPixelColors: colors,
    identifyFlashColor: 0xff0f27a3,
    regionMaps: new Map([['FMAP0I17.IMG', img('FMAP0I17', 320, 160)]]),
    deps: {},
    ...over,
  });
  return colors;
}


/** The list picker refuses to open without PICK00I0, so the tests
 *  that drive it warm its module cache the way the host does. */
let _pickerWarmed = false;
async function warmPickerArt() {
  if (_pickerWarmed) return;
  const { preloadListPickerArt } = await import('../src/ui/listPicker.js');
  const palette = new DFPalette();
  await preloadListPickerArt({
    renderer: { uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} },
    palette,
    fetchBytes: async () => new Uint8Array(64000),
  });
  _pickerWarmed = true;
}

/** The recording renderer the native lane uses (audit18_ui_native). */
function recorder() {
  const quads = [];
  const uploads = [];
  return {
    quads, uploads,
    uploadTexture: (archive, record, color32) => { uploads.push({ archive, record, color32 }); return `tex:${archive}_${record}`; },
    releaseTexture: () => {},
    drawScreenQuad: (tex, rect, uv, color, opts) => quads.push({ tex, ...rect, uv, color, opts }),
  };
}
const font = (w = 4, h = 9) => ({ fnt: { fixedHeight: h, fixedWidth: w, glyphWidth: () => w } });
const canvas = { width: 1280, height: 800 };   // scale 4, no letterbox

test('U41: the layout table is DFU\'s, rect for rect', () => {
  assert.deepEqual(REGION_RECT, [0, 12, 320, 160]);
  assert.deepEqual(BUTTON_RECTS.exit, [278, 175, 39, 22]);
  assert.deepEqual(BUTTON_RECTS.find, [3, 175, 45, 11]);
  assert.deepEqual(BUTTON_RECTS.at, [3, 186, 45, 11]);
  assert.deepEqual(BUTTON_RECTS.dungeons, [50, 175, 99, 11]);
  assert.deepEqual(BUTTON_RECTS.temples, [50, 186, 99, 11]);
  assert.deepEqual(BUTTON_RECTS.homes, [149, 175, 80, 11]);
  assert.deepEqual(BUTTON_RECTS.towns, [149, 186, 80, 11]);
  assert.deepEqual(BUTTON_RECTS.horizontalArrow, [231, 176, 22, 20]);
  assert.deepEqual(BUTTON_RECTS.verticalArrow, [254, 176, 22, 20]);
  // the sheets' cutouts (DFSize 179x22 and 45x22)
  assert.deepEqual(FILTER_SRC.dungeons, [0, 0, 99, 11]);
  assert.deepEqual(FILTER_SRC.temples, [0, 11, 99, 11]);
  assert.deepEqual(FILTER_SRC.homes, [99, 0, 80, 11]);
  assert.deepEqual(FILTER_SRC.towns, [99, 11, 80, 11]);
  assert.deepEqual(FIND_SRC, [0, 0, 45, 11]);
  assert.deepEqual(AT_SRC, [0, 11, 45, 11]);
  for (const [k, r] of Object.entries(BUTTON_RECTS)) {
    assert.ok(r[0] + r[2] <= 320 && r[1] + r[3] <= 200, `${k} fits the native panel`);
  }
  // the multi-screen regions and the plain formatter
  assert.deepEqual(getRegionMapNames(0), ['FMAPAI00.IMG', 'FMAPBI00.IMG']);
  assert.deepEqual(getRegionMapNames(1), ['FMAPAI01.IMG', 'FMAPBI01.IMG', 'FMAPCI01.IMG', 'FMAPDI01.IMG']);
  assert.deepEqual(getRegionMapNames(16), ['FMAPAI16.IMG', 'FMAPBI16.IMG', 'FMAPCI16.IMG', 'FMAPDI16.IMG']);
  assert.deepEqual(getRegionMapNames(5), ['FMAP0I05.IMG']);
  assert.deepEqual(getRegionMapNames(61), ['FMAP0I61.IMG']);
  // Every page that HAS an offset; the eighteen pageless regions are
  // DFU's own hole (offsetLookup has no row, so its own draw throws).
  const pageless = [];
  for (let r = 0; r < 62; r++) {
    if (hasRegionPage(r)) continue;
    pageless.push(r);
    for (const name of getRegionMapNames(r)) assert.equal(OFFSET_LOOKUP[name], undefined);
  }
  assert.deepEqual(pageless, [2, 3, 4, 6, 7, 8, 10, 12, 13, 14, 15, 24, 25, 27, 28, 29, 30, 31],
    'the wildernesses, the two generic villages and the four coast strips');
  // PopulateRegionOffsetDict (:590-648) transcribed from the C#, row
  // for row - these 51 pairs decide whether a page's dots land on the
  // right map pixels, and nothing else in the port can catch a typo
  assert.deepEqual(OFFSET_LOOKUP, EXPECTED_OFFSETS);
  assert.equal(Object.keys(OFFSET_LOOKUP).length, 51, 'DFU lists fifty-one pages');
  assert.deepEqual(OFFSET_LOOKUP['FMAP0I19.IMG'], [80, 123], 'Betony');
  assert.deepEqual(OFFSET_LOOKUP['FMAP0I59.IMG'], [0, 0], 'Glenumbra Moors correct at 0,0');
  assert.deepEqual(OFFSET_LOOKUP['FMAP0I61.IMG'], [255, 275], 'Cybiades');
  assert.equal(getRegionMapScale(BETONY_INDEX), 4);
  assert.equal(getRegionMapScale(DAGGERFALL), 1);
  assert.equal(ZOOM_FACTOR, 2);
  assert.equal(FIND_MAX_CHARACTERS, 32);
  assert.deepEqual([IDENTIFY_FLASH_COUNT, IDENTIFY_FLASH_COUNT_SELECTED, IDENTIFY_FLASH_INTERVAL], [4, 2, 0.5]);
});

test('U41: GetPixelColorIndex - fourteen types, one typeless, four filter bands', () => {
  const T = LOCATION_TYPES;
  const table = [
    [T.DungeonLabyrinth, 0], [T.DungeonKeep, 1], [T.DungeonRuin, 2], [T.Graveyard, 3], [T.Coven, 4],
    [T.HomeFarms, 5], [T.HomeWealthy, 6], [T.HomePoor, 7],
    [T.ReligionTemple, 8], [T.ReligionCult, 9],
    [T.Tavern, 10], [T.TownCity, 11], [T.TownHamlet, 12], [T.TownVillage, 13],
  ];
  for (const [type, index] of table) assert.equal(getPixelColorIndex(type), index, `type ${type}`);
  assert.equal(getPixelColorIndex(T.HomeYourShips), -1, 'your ships get no dot (C#\'s empty arm)');
  assert.equal(getPixelColorIndex(T.None), -1);
  // the bands: dungeons 0-4 (the GRAVEYARD and the COVEN ride the
  // dungeon button, not the towns one), homes 5-7, temples 8-9,
  // towns 10-13 - the tavern rides TOWNS
  const hidden = (filters) => table.filter(([t]) => getPixelColorIndex(t, filters) === -1).map(([, i]) => i);
  assert.deepEqual(hidden({ dungeons: true }), [0, 1, 2, 3, 4]);
  assert.deepEqual(hidden({ homes: true }), [5, 6, 7]);
  assert.deepEqual(hidden({ temples: true }), [8, 9]);
  assert.deepEqual(hidden({ towns: true }), [10, 11, 12, 13]);
});

test('U41: the map dict is ContentReader.EnumerateMaps - pixel-keyed, first wins', () => {
  const { mapDict } = mkWorld();
  assert.equal(mapDict.size, 3);
  const s = locationSummaryAt(mapDict, 50, 120);
  assert.equal(s.regionIndex, DAGGERFALL);
  assert.equal(s.mapIndex, 0);
  assert.equal(s.locationType, LOCATION_TYPES.TownCity);
  assert.equal(s.id, getMapPixelID(50, 120), 'the key IS the map pixel id (mapId & 0xfffff)');
  assert.equal(s.mapID, (DAGGERFALL << 20) | getMapPixelID(50, 120), 'the full mapId survives too');
  assert.equal(s.discovered, true);
  assert.equal(hasLocation(mapDict, 50, 120), true);
  assert.equal(hasLocation(mapDict, 51, 120), false);
  assert.equal(locationSummaryAt(mapDict, 999, 499), null);
  // Dictionary.Add throws on a colliding id and the catch sits inside
  // the per-location try, so the FIRST entry wins and the second is
  // dropped - a JS Map.set would have let the last one win
  const twin = mkRegion(DAGGERFALL, [
    { name: 'First', row: row(70, 130, LOCATION_TYPES.TownCity, true) },
    { name: 'Second', row: row(70, 130, LOCATION_TYPES.Coven, true) },
  ]);
  const collided = buildMapDict({ regionCount: 1, getRegion: () => twin });
  assert.equal(collided.size, 1);
  assert.equal(collided.get(getMapPixelID(70, 130)).mapIndex, 0, 'the first entry keeps the pixel');
  assert.equal(collided.get(getMapPixelID(70, 130)).locationType, LOCATION_TYPES.TownCity);
});

test('U41: the dots walk plots discovered places only, and the filters erase them', () => {
  restoreDiscovery(null);
  _resetForTests();
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    assert.equal(w.regionSelected, false, 'the window opens on the province map');
    w._openRegionPanel(DAGGERFALL);
    assert.equal(w.selectedRegion, DAGGERFALL);
    assert.deepEqual(w.selectedRegionMapNames, ['FMAP0I17.IMG']);

    // panel pixel = map pixel - origin; the buffer is DFU's BOTTOM-UP one
    const at = (mx, my) => {
      const x = mx - ORIGIN[0], y = my - ORIGIN[1];
      return w._dotsBuf[((REGION_H - y - 1) * REGION_W) + x];
    };
    assert.notEqual(at(50, 120), 0, 'the city is plotted');
    assert.notEqual(at(54, 122), 0, 'the temple is plotted');
    assert.equal(at(52, 121), 0, 'the UNDISCOVERED ruin is not');
    assert.notEqual(at(50, 120), at(54, 122), 'a city and a temple are different colours');

    // the runtime store reveals the ruin - the same test the find box uses
    discoverLocation((DAGGERFALL << 20) | getMapPixelID(52, 121), { locationName: 'Dank Barrow' });
    w._updateMapLocationDotsTexture();
    assert.notEqual(at(52, 121), 0, 'a discovered dungeon plots');

    // the filters erase by BAND
    w._filterButtonClick('towns');
    assert.equal(at(50, 120), 0, 'the towns filter hides the city');
    assert.notEqual(at(54, 122), 0, 'and leaves the temple');
    w._filterButtonClick('dungeons');
    assert.equal(at(52, 121), 0, 'the dungeons filter hides the barrow');
    w._filterButtonClick('towns');
    assert.notEqual(at(50, 120), 0, 'the toggle goes both ways');
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); _resetForTests(); }
});

test('U41: the outline buffer only fills when the setting says so', () => {
  restoreDiscovery(null);
  _resetForTests();
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    const idx = ((REGION_H - (120 - ORIGIN[1]) - 1) * REGION_W) + (50 - ORIGIN[0]);
    assert.equal(w._outlineBuf[idx], 0, 'TravelMapLocationsOutline ships False');
    setValue('GUI', 'TravelMapLocationsOutline', true);
    w._updateMapLocationDotsTexture();
    assert.equal(w._outlineBuf[idx] >>> 24, 128, 'the outline is half-transparent black');
    assert.equal(w._outlineBuf[idx] & 0xffffff, 0);
    assert.equal(OUTLINE_DISPLACEMENTS.length, 4);
  } finally { _setTravelMapArtForTests(null); _resetForTests(); }
});

test('U41: the region panel opens on click, switches region, and Escape backs out one level', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    // the picker bitmap answers which province the cursor is over
    const bmp = { width: 320, height: 200, data: new Uint8Array(320 * 200) };
    bmp.data[100 * 320 + 40] = 128 + DAGGERFALL;
    _setTravelMapArtForTests(null);
    mountArt({ pickerBitmap: bmp });
    w.hover(40, 100);
    assert.equal(w.mouseOverRegion, DAGGERFALL);
    assert.equal(w.regionLabelText(), 'Daggerfall');
    w.click(40, 100);
    assert.equal(w.regionSelected, true, 'a click on a province opens its page');
    // inside the page, a pixel that belongs to WAYREST offers the switch
    w.hover(60 - ORIGIN[0], 130 - ORIGIN[1] + 12);
    assert.equal(w.mouseOverRegion, 23);
    assert.equal(w.regionLabelText(), 'Switch To: Wayrest Region');
    w.input('Escape');
    assert.equal(w.regionSelected, false, 'Escape closes the PAGE first');
    assert.equal(w.done, false);
    w.input('Escape');
    assert.equal(w.done, true, 'and then the window');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: hovering a discovered location names it and arms the popup; an undiscovered one does not', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    const hoverMap = (mx, my) => w.hover(mx - ORIGIN[0], my - ORIGIN[1] + 12);
    hoverMap(50, 120);
    assert.equal(w.locationSelected, true);
    assert.equal(w.regionLabelText(), 'Daggerfall : Daggerfall');
    hoverMap(52, 121);
    assert.equal(w.locationSelected, false, 'the hidden barrow cannot be picked');
    setRevealUndiscoveredLocations(true);
    hoverMap(50, 120);   // DFU re-reads only when the cursor MOVES
    hoverMap(52, 121);
    assert.equal(w.locationSelected, true, 'map_reveallocations shows it');
    setRevealUndiscoveredLocations(false);
    // a click on a selected location opens the travel popup
    hoverMap(50, 120);
    w.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    assert.ok(w.popUp, 'the travel popup is up');
    assert.deepEqual(w.popUp.endPos, { x: 50, y: 120 });
  } finally { _setTravelMapArtForTests(null); setRevealUndiscoveredLocations(false); }
});

test('U41: the find box searches by edit distance, flashes, and pops the confirmation', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps, traveled } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.input('KeyF');
    assert.equal(w.top, 'find');
    for (const c of 'Daggerfall') w.input(`Key${c.toUpperCase()}`, { key: c });
    assert.equal(w.findText, 'Daggerfall');
    w.input('Enter');
    assert.equal(w.top, null);
    assert.equal(w.locationSelected, true);
    assert.equal(w.findingLocation, true, 'the crosshair is finding');
    assert.equal(w.locationSummary.id, getMapPixelID(50, 120));
    // the flash runs twice for a selected location, then confirms
    for (let i = 0; i < 12 && w.identifying; i++) w.tick(0.6);
    assert.equal(w.identifying, false);
    assert.equal(w.top, 'confirm', 'the flash\'s END pops the travel confirmation');
    w.input('KeyY');
    assert.ok(w.popUp, 'Yes opens the travel popup');
    // B begins, and the day countdown has to empty before the trip
    w.popUp.input('KeyB');
    assert.equal(w.popUp.doFastTravel, true);
    for (let i = 0; i < 200 && w.popUp; i++) w.tick(0.06);
    assert.equal(traveled.length, 1, 'the trip ran once the countdown emptied');
    assert.deepEqual(traveled[0].pick.pixel, { x: 50, y: 120 });
    assert.equal(traveled[0].pick.name, 'Daggerfall');
    assert.equal(traveled[0].opts.speedCautious, true);
    assert.ok(traveled[0].computed.minutes >= 0);
    assert.equal(w.done, true, 'and the map closed behind it');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: a fuzzy find offers the picker; a nonsense find answers the not-found box', async () => {
  restoreDiscovery(null);
  await warmPickerArt();
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    // "daggerfal" is one deletion from the city and close to the
    // chapel - both are kept, so the picker opens
    w._handleLocationFindEvent('daggerfal');
    assert.ok(w.picker, 'two matches open the list picker');
    assert.deepEqual(w.picker.items, ['Daggerfall', 'Daggerfall Chapel']);
    // a DaggerfallPopupWindow dims NOTHING (ScreenDimColor is
    // Color.clear), so the map is still there behind the list
    const r = recorder();
    w.draw(r, canvas, font());
    const opaqueFullCanvas = r.quads.filter((q) => q.tex === null && q.w === canvas.width
      && q.h === canvas.height && (q.color?.[3] ?? 1) >= 1);
    assert.deepEqual(opaqueFullCanvas, [], 'the picker paints no black over the map');
    assert.ok(r.quads.some((q) => q.tex === 'tex:TRAV0I00'), 'the province art is still drawn');
    assert.ok(r.quads.some((q) => q.tex === 'tex:FMAP0I17'), 'and the region page under the list');
    w.handleLocationPickEvent(1, 'Daggerfall Chapel');
    assert.equal(w.picker, null);
    assert.equal(w.locationSelected, true);
    assert.equal(w.locationSummary.id, getMapPixelID(54, 122), 'the pick drives the crosshair');
    // DFU's find is a DISTANCE, not a match: with anything discovered
    // in the region the nonsense query still lands on the nearest
    // names, so the not-found box (TEXT.RSC 13) is reached only when
    // the region has nothing findable at all.
    w.findingLocation = false;
    w._handleLocationFindEvent('zzzzzzzz');
    assert.ok(w.picker || w.locationSelected, 'the fuzzy find always answers with something');
    w.picker = null;
    // the L list is the whole region, sorted, behind the filters
    w.top = null;
    w.input('KeyL');
    assert.deepEqual(w.picker.items, ['Daggerfall', 'Daggerfall Chapel', 'Dank Barrow']);
    w.picker = null;
    w._filterButtonClick('towns');
    w.input('KeyL');
    assert.deepEqual(w.picker.items, ['Daggerfall Chapel', 'Dank Barrow'], 'the list obeys the filters');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: the arrows page a four-screen region, and a pageless one refuses to open', () => {
  restoreDiscovery(null);
  const pages = ['FMAPAI01.IMG', 'FMAPBI01.IMG', 'FMAPCI01.IMG', 'FMAPDI01.IMG'];
  mountArt({ regionMaps: new Map(pages.map((n) => [n, img(n, 320, 160)])) });
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(1);   // Dragontail Mountains: A B over C D
    assert.equal(w.mapIndex, 0, 'a region always opens on its first page');
    assert.equal(w.hasMultipleMaps, true);
    assert.equal(w.hasVerticalMaps, true);
    // the horizontal arrow walks RIGHT from an even index and LEFT
    // from an odd one; the vertical one steps two, up from the
    // bottom row and down from the top
    w._arrowButtonClick('horizontal');
    assert.equal(w.mapIndex, 1);
    w._arrowButtonClick('horizontal');
    assert.equal(w.mapIndex, 0, 'and back');
    w._arrowButtonClick('vertical');
    assert.equal(w.mapIndex, 2, 'index 0 is the TOP row, so it goes down');
    w._arrowButtonClick('vertical');
    assert.equal(w.mapIndex, 0);
    w._arrowButtonClick('horizontal');
    w._arrowButtonClick('vertical');
    assert.equal(w.mapIndex, 3, 'the bottom-right page');
    w._arrowButtonClick('vertical');
    assert.equal(w.mapIndex, 1, 'index 3 is the bottom row, so it goes up');
    // a single-page region offers neither arrow
    w._closeRegionPanel();
    w._openRegionPanel(DAGGERFALL);
    assert.equal(w.hasMultipleMaps, false);
    assert.equal(w.hasVerticalMaps, false);
    w._arrowButtonClick('horizontal');
    assert.equal(w.mapIndex, 0, 'and the arrow does nothing');
    // the arrow art stretches to the 22x20 BUTTON, not to its own size
    w._closeRegionPanel();
    w._openRegionPanel(1);
    const r = recorder();
    w.draw(r, canvas, font());
    const arrowsOf = (rec) => rec.quads.filter((q) => String(q.tex).startsWith('tex:TRAV') && q.w === 22 * 4);
    assert.equal(arrowsOf(r).length, 2, 'both arrows draw for a four-page region');
    assert.deepEqual(arrowsOf(r).map((q) => [q.x / 4, q.y / 4, q.w / 4, q.h / 4]),
      [[231, 176, 22, 20], [254, 176, 22, 20]]);
    // and NEITHER paints on the province map, even when the region
    // just closed was a four-page one (:511, :519, :1111-1112)
    w._closeRegionPanel();
    const r2 = recorder();
    w.draw(r2, canvas, font());
    assert.equal(arrowsOf(r2).length, 0, 'no arrows over the province map');
    assert.equal(w.mapIndex, 0);
    w.click(231 + 11, 176 + 10);   // the dead button does not page either
    assert.equal(w.mapIndex, 0);
    // the eighteen pageless regions refuse rather than throwing the
    // way DFU's missing offsetLookup row does
    assert.equal(hasRegionPage(31), false);
    w._closeRegionPanel();
    w._openRegionPanel(31);
    assert.equal(w.regionSelected, false, 'High Rock sea coast has no page');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: the zoom crop is DFU\'s, clamped and bottom-up', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    assert.equal(w.borderEnabled, true, 'the border frames an unzoomed page');
    w.click(160, 92, true);   // right-click at the page's centre
    assert.equal(w.zoom, true);
    assert.equal(w.borderEnabled, false, 'and goes away zoomed');
    // startX = x - 80, startY = 160 + (-y - 40) + 12
    assert.deepEqual(w.zoomOffset, [80, 40]);
    const [sx, sy, sw, sh] = w._cropRect(REGION_W, REGION_H);
    assert.deepEqual([sw, sh], [160, 80], 'a 2x crop is half the page');
    assert.deepEqual([sx, sy], [80, 40], 'the bottom-up offset flips to the same rect at the centre');
    // the clamps at the corners
    w.click(0, 12, true); w.click(0, 12, true);   // off and on again at the top-left
    assert.equal(w.zoom, true);
    assert.deepEqual(w.zoomOffset, [0, 80]);
    const top = w._cropRect(REGION_W, REGION_H);
    assert.deepEqual([top[0], top[1]], [0, 0], 'the top-left crop starts at the page\'s top-left');
    w.click(319, 171, true); w.click(319, 171, true);
    assert.deepEqual(w.zoomOffset, [160, 0]);
    const bottom = w._cropRect(REGION_W, REGION_H);
    assert.deepEqual([bottom[0], bottom[1]], [160, 80], 'and the bottom-right at its bottom-right');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: shift-move pans the zoom, and the host hands the window the event', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.click(160, 92, true);
    assert.deepEqual(w.zoomOffset, [80, 40]);
    w.hover(40, 30);                       // a plain move does not pan
    assert.deepEqual(w.zoomOffset, [80, 40]);
    w.hover(200, 100, { shiftKey: true });   // shift does (:397-402)
    assert.deepEqual(w.zoomOffset, [120, 32], 'the crop follows the cursor');
    w.hover(60, 40, { shiftKey: true });
    assert.deepEqual(w.zoomOffset, [0, 80], 'and clamps at the page edge');
    // the event only reaches a window because the host passes it
    const tt = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
    assert.ok(tt.includes('overlay.hover(v ? v[0] : -1, v ? v[1] : -1, e)'),
      'townTalk\'s hover seam carries the event');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: the draw lays the page, the dots and the bar where DFU puts them', () => {
  restoreDiscovery(null);
  _resetForTests();
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    const r = recorder();
    const f = font();
    w.draw(r, canvas, f);
    // the province map fills the panel at scale 4
    const bg = r.quads.find((q) => q.tex === 'tex:TRAV0I00');
    assert.deepEqual([bg.x, bg.y, bg.w, bg.h], [0, 0, 1280, 800]);
    // the bar: I'M AT always, FIND only with a region open
    const cut = (tex) => r.quads.filter((q) => q.tex === tex);
    assert.equal(cut('tex:TRAV0I03').length, 1, 'only I\'m At on the province map');
    assert.equal(cut('tex:TRAV01I0').length, 4, 'four filter buttons, all enabled');
    assert.equal(cut('tex:TRAV01I1').length, 0);
    const atQuad = cut('tex:TRAV0I03')[0];
    assert.deepEqual([atQuad.x, atQuad.y, atQuad.w, atQuad.h], [3 * 4, 186 * 4, 45 * 4, 11 * 4]);
    assert.ok(Math.abs(atQuad.uv.v0 - 11 / 22) < 1e-9, 'the AT cutout is the sheet\'s lower half');

    // open the page: the region art, the dots, and the border
    w._openRegionPanel(DAGGERFALL);
    r.quads.length = 0;
    w.draw(r, canvas, f);
    const page = r.quads.find((q) => q.tex === 'tex:FMAP0I17');
    assert.deepEqual([page.x, page.y, page.w, page.h], [0, 12 * 4, 320 * 4, 160 * 4]);
    assert.deepEqual([page.uv.u0, page.uv.v0, page.uv.u1, page.uv.v1], [0, 0, 1, 1], 'unzoomed draws the whole page');
    const dots = r.quads.find((q) => String(q.tex).includes('travelmap_dots'));
    assert.deepEqual([dots.x, dots.y, dots.w, dots.h], [0, 12 * 4, 320 * 4, 160 * 4]);
    assert.ok(r.quads.find((q) => q.tex === 'tex:MBRD00I0'), 'the border frames it');
    assert.equal(cut('tex:TRAV0I03').length, 2, 'FIND joins I\'m At once a region is open');
    // the uploaded dots texture is TOP-DOWN: the city lands on its own row
    const up = r.uploads.filter((u) => String(u.record).startsWith('dots')).at(-1);
    assert.equal(up.color32.width, 320);
    assert.equal(up.color32.height, 160);
    assert.notEqual(up.color32.colors[(120 - ORIGIN[1]) * 320 + (50 - ORIGIN[0])], 0, 'the flip put the city back on its row');

    // zoomed: the same rect, a cropped source, no border
    w.click(160, 92, true);
    r.quads.length = 0;
    w.draw(r, canvas, f);
    const zoomed = r.quads.find((q) => q.tex === 'tex:FMAP0I17');
    assert.deepEqual([zoomed.uv.u0, zoomed.uv.u1], [80 / 320, 240 / 320]);
    assert.deepEqual([zoomed.uv.v0, zoomed.uv.v1], [40 / 160, 120 / 160]);
    assert.equal(r.quads.find((q) => q.tex === 'tex:MBRD00I0'), undefined, 'no border while zoomed');

    // the outline copies ride half a SCREEN pixel out
    setValue('GUI', 'TravelMapLocationsOutline', true);
    w.click(160, 92, true);   // back out of the zoom
    w._updateMapLocationDotsTexture();
    r.quads.length = 0;
    w.draw(r, canvas, f);
    const outlines = r.quads.filter((q) => String(q.tex).includes('travelmap_outline'));
    assert.equal(outlines.length, 4);
    assert.ok(outlines.every((q) => q.opts?.blend), 'the outline BLENDS - it is 50% black, not a cutout');
    const xs = [...new Set(outlines.map((q) => q.x))].sort((a, b) => a - b);
    assert.deepEqual(xs, [-0.5, 0, 0.5], 'half a screen pixel left, right, and none');
  } finally { _setTravelMapArtForTests(null); _resetForTests(); }
});

test('U41: the zoomed outline displaces its CROP too, so it thickens instead of thinning', () => {
  restoreDiscovery(null);
  _resetForTests();
  mountArt();
  try {
    setValue('GUI', 'TravelMapLocationsOutline', true);
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.click(160, 92, true);            // zoom on the page's centre
    const r = recorder();
    w.draw(r, canvas, font());
    const dots = r.quads.find((q) => String(q.tex).includes('travelmap_dots'));
    const outlines = r.quads.filter((q) => String(q.tex).includes('travelmap_outline'));
    assert.equal(outlines.length, 4);
    // the DESTINATION is half a screen pixel out (as unzoomed) AND
    // the SOURCE window moves with it (:784-792), which the 2x crop
    // magnifies - the same displacement twice over
    const left = outlines.find((q) => q.x < dots.x);
    assert.ok(left, 'one copy sits left of the dots');
    assert.equal(dots.x - left.x, 0.5, 'half a screen pixel of destination');
    const srcShift = (dots.uv.u0 - left.uv.u0) * REGION_W;
    assert.ok(Math.abs(srcShift - 0.5 / 4) < 1e-9,
      `and half a screen pixel of SOURCE too (${srcShift})`);
  } finally { _setTravelMapArtForTests(null); _resetForTests(); }
});

test('U41: the identify flash is four states for a region and two for a location', () => {
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    assert.equal(w.identifying, true, 'Setup identifies the player\'s region');
    // identifyLastChangeTime is 0 against a MONOTONIC clock, so the
    // first ON state lands on the next tick rather than half a second
    // later (:1732-1743 against Time.realtimeSinceStartup)
    w.tick(0.001);
    assert.equal(w.identifyState, true, 'the shape lights up immediately');
    w.tick(0.001);
    assert.equal(w.identifyState, true, 'and then HOLDS for the interval - it does not strobe');
    let flips = 0;
    for (let i = 0; i < 40 && w.identifying; i++) { w.tick(0.6); flips++; }
    assert.equal(w.identifying, false);
    assert.ok(flips >= 8 && flips <= 10, `four ON states at 0.5s each (${flips} ticks)`);
    w._atButtonClick();
    assert.equal(w.identifying, true, 'I\'m At re-identifies');
    // DFU updates only the TOP window: a box or the picker freezes
    // the flash rather than letting it end underneath them
    w.top = 'find';
    for (let i = 0; i < 40; i++) w.tick(0.6);
    assert.equal(w.identifying, true, 'the flash is frozen under the find box');
    w.top = null;
    for (let i = 0; i < 40 && w.identifying; i++) w.tick(0.6);
    assert.equal(w.identifying, false, 'and runs out once it closes');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: the filters and the popup toggles outlive the window', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const first = new TravelMapWindow(deps);
    first._openRegionPanel(DAGGERFALL);
    first._filterButtonClick('towns');
    first._filterButtonClick('homes');
    first.closeTravelWindows(true);
    // DFU re-pushes ONE window; the port mints a new one and the
    // state it would have carried is waiting for it
    const second = new TravelMapWindow(deps);
    // ROADS 12: two more flags ride the same store, default shown (false).
    assert.deepEqual(second.filters, { dungeons: false, temples: false, homes: true, towns: true, roads: false, tracks: false, rivers: false, streams: false });   // ROADS 24
    const save = second.getTravelMapSaveData();
    assert.deepEqual(save, {
      filterDungeons: false, filterHomes: true, filterTemples: false, filterTowns: true,
      filterRoads: false, filterTracks: false,   // ROADS 12
      filterRivers: false, filterStreams: false,   // ROADS 24
      sleepInn: true, speedCautious: true, travelShip: true,
    }, 'GetTravelMapSaveData reads the live state and the struct\'s own defaults');
    // a popup's choices come back on the NEXT popup
    second._openRegionPanel(DAGGERFALL);
    second.locationSelected = true;
    second.locationSummary = locationSummaryAt(second.deps.mapDict, 50, 120);
    second._createPopUpWindow();
    second.popUp.input('KeyS');   // reckless
    second.popUp.input('KeyN');   // camp out
    second.popUp.exit();
    second._createPopUpWindow();
    assert.equal(second.popUp.speedCautious, false);
    assert.equal(second.popUp.sleepModeInn, false);
    assert.equal(second.getTravelMapSaveData().speedCautious, false);
    // a null envelope is DFU's "use the defaults" (:1344-1345)
    second.setTravelMapFromSaveData(null);
    assert.deepEqual(second.filters, { dungeons: false, temples: false, homes: false, towns: false, roads: false, tracks: false, rivers: false, streams: false });   // ROADS 12/24
    assert.equal(second.popUp.speedCautious, true);
    // and the envelope really rides the ONE composer both hosts call
    // (SaveLoadManager.cs:871 / :1479)
    second._filterButtonClick('dungeons');
    setTravelMapPopUpState({ speedCautious: false, sleepModeInn: false, travelShip: false });
    const envelope = composeSessionState({});
    assert.deepEqual(envelope.travelMap, {
      filterDungeons: true, filterTemples: false, filterHomes: false, filterTowns: false,
      filterRoads: false, filterTracks: false,   // ROADS 12
      filterRivers: false, filterStreams: false,   // ROADS 24
      sleepInn: false, speedCautious: false, travelShip: false,
    });
    restoreSessionState({ travelMap: envelope.travelMap }, {});
    assert.deepEqual(travelMapSaveData(), envelope.travelMap, 'a round trip is a fixed point');
    restoreSessionState({}, {});
    assert.deepEqual(travelMapSaveData(), {
      filterDungeons: false, filterTemples: false, filterHomes: false, filterTowns: false,
      filterRoads: false, filterTracks: false,   // ROADS 12
      filterRivers: false, filterStreams: false,   // ROADS 24
      sleepInn: true, speedCautious: true, travelShip: true,
    }, 'a pre-U41 save restores the struct\'s defaults, as DFU\'s null arm does');
  } finally { _setTravelMapArtForTests(null); resetTravelMapState(); }
});

test('U41: a window that finishes in its own tick is cleared by the host', () => {
  // the popup's countdown departs on a clock, not on a key: the
  // overlay seam has to notice `done` in frame(), the way the dungeon
  // host's tickOverlay does
  const tt = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  // U48: sliced to the FUNCTION, not to a magic 900 characters. A
  // comment added inside frame() pushed the done check past the count
  // and this pin went red without its law changing - a character
  // budget is a fragile proxy for "inside this function".
  const frame = tt.slice(tt.indexOf('function frame(dt)'), tt.indexOf('function pointerdown'));
  assert.ok(/overlay\?\.tick\?\.\(dt\)/.test(frame), 'the overlay ticks');
  assert.ok(frame.includes('if (overlay?.done)'), 'and a finished window is dropped in the same pass');
  assert.ok(frame.indexOf('overlay?.tick') < frame.indexOf('if (overlay?.done)'), 'in that order');
  // ...and the drain must FREE what it drops. The crash of 2026-08-29
  // moved that dispose into townTalk's one drain (dropOverlay), so the
  // pin follows it there rather than reading a literal this function no
  // longer contains: the call is here, and the freeing is in the seam
  // it calls. Both halves, because either alone leaks - and the seam is
  // read for its ORDER too, the slot emptied before the window is told,
  // which is the fix itself.
  const drain = frame.slice(frame.indexOf('if (overlay?.done)'), frame.indexOf('const s = hudScale'));
  assert.ok(drain.includes('dropOverlay()'), 'the drain goes through the one seam');
  const seam = tt.match(/function dropOverlay\([\s\S]*?\n {2}}/)?.[0] ?? '';
  assert.ok(seam.includes('win.dispose?.()'), 'freeing its textures');
  assert.ok(seam.indexOf('overlay = null') < seam.indexOf('win.dispose'),
    'the seam disposes before it empties the slot - the 2026-08-29 recursion is back');
});

test('U41: the preload asks for exactly the classic files, and a missing one closes the door', async () => {
  const { preloadTravelMapArt, travelMapArtLoaded } = await import('../src/ui/travelMapWindow.js');
  _setTravelMapArtForTests(null);
  try {
    const asked = [];
    // every IMG decodes as a headerless 320x200 at 64000 bytes, which
    // is all this contract test needs; the palette is a real 776-byte
    // .COL and TEXT.RSC is allowed to fail (the window guards it)
    const bytes = (n) => new Uint8Array(n);
    const renderer = { uploadTexture: () => 'tex', releaseTexture: () => {}, drawScreenQuad: () => {} };
    const palette = new DFPalette();
    const deps = {
      renderer, palette,
      fetchBytes: async (name) => {
        asked.push(name);
        if (name.endsWith('.COL')) return bytes(776);
        if (name === 'TEXT.RSC') throw new Error('no text');
        return bytes(64000);
      },
    };
    await preloadTravelMapArt(deps);
    assert.equal(travelMapArtLoaded(), true);
    assert.deepEqual(asked.filter((n) => n !== 'PICK00I0.IMG'), [
      'FMAP_PAL.COL', 'TRAV0I01.IMG',
      'TRAV0I00.IMG', 'TRAV0I03.IMG', 'TRAV01I0.IMG', 'TRAV01I1.IMG',
      'TRAVAI05.IMG', 'TRAVBI05.IMG', 'TRAVCI05.IMG', 'TRAVDI05.IMG', 'MBRD00I0.IMG',
      'TEXT.RSC', 'TRAV0I04.IMG',
      // G5: TELE00I0 joins the list. Its own loader SWALLOWS an
      // absent file where the map's rethrow closes the door, because
      // a missing teleport panel must not shut the travel map - the
      // popup falls back to a plain rect and the service still works.
      'TELE00I0.IMG',
    ], 'the constants block, file for file');
    _setTravelMapArtForTests(null);
    // a missing overworld leaves the door shut rather than opening a
    // blank map (world.js checks travelMapArtLoaded before it mounts)
    await preloadTravelMapArt({
      renderer, palette,
      fetchBytes: async (name) => {
        if (name.endsWith('.COL')) return bytes(776);
        if (name === 'TRAV0I00.IMG') throw new Error('missing');
        return bytes(64000);
      },
    }).then(() => assert.fail('a missing IMG must reject')).catch((e) => assert.match(String(e.message), /missing/));
    assert.equal(travelMapArtLoaded(), false);
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: the identify buffers carry the province shape and the crosshair', () => {
  restoreDiscovery(null);
  // a picker bitmap with one known blob of the player's own region
  const bmp = { width: 320, height: 200, data: new Uint8Array(320 * 200) };
  bmp.data[100 * 320 + 40] = 128 + DAGGERFALL;
  bmp.data[101 * 320 + 41] = 128 + 23;          // a neighbour, never lit
  mountArt({ pickerBitmap: bmp });
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    // UpdateIdentifyTextureForPlayerRegion (:811-857): the picker row
    // y lands at buffer row (height - y - diff), diff = 200-160-12+1
    const diff = bmp.height - REGION_H - 12 + 1;
    const at = (x, y) => w._identifyBuf[((bmp.height - y - diff) * bmp.width) + x];
    assert.notEqual(at(40, 100), 0, 'the province shape is filled');
    assert.equal(at(41, 101), 0, 'and only this province');
    assert.equal(w._identifyBuf[0], 0);

    // UpdateIdentifyTextureForPosition (:875-916): a full-height
    // column and a full-width row crossing on the player's pixel
    w._openRegionPanel(DAGGERFALL);
    w._updateCrosshair();
    const col = 50 - ORIGIN[0], row = 120 - ORIGIN[1];
    const px = (x, y) => w._identifyBuf[((REGION_H - y - 1) * REGION_W) + x];
    assert.notEqual(px(col, 0), 0, 'the column runs the page\'s height');
    assert.notEqual(px(col, REGION_H - 1), 0);
    assert.notEqual(px(0, row), 0, 'the row runs its width');
    assert.notEqual(px(col, row), 0, 'and they cross on the player');
    assert.equal(px(col + 1, row + 1), 0, 'nothing else is lit');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: a location can still be hovered and picked while ZOOMED', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.click(160, 92, true);
    assert.deepEqual(w.zoomOffset, [80, 40]);
    // GetCoordinates' zoom arm (:1148-1172), inverted: the city at map
    // pixel (50,120) sits at panel (11,14), which the 2x crop centred
    // at [80,40] puts off-page - so zoom somewhere that contains it
    w.click(30, 40, true); w.click(30, 40, true);   // re-zoom near the top-left
    assert.deepEqual(w.zoomOffset, [0, 80]);
    // page x = (mapX - originX - offsetX) * 2, and the zoom arm's own
    // y algebra reduces to (mapY - originY - (160 - offsetY - 80)) * 2
    const vx = (50 - ORIGIN[0] - 0) * 2;
    const vy = 12 + (120 - ORIGIN[1] - (REGION_H - 80 - 80)) * 2;
    w.hover(vx, vy);
    assert.equal(w.locationSelected, true, 'the zoomed transform still finds the city');
    assert.equal(w.regionLabelText(), 'Daggerfall : Daggerfall');
    w.click(vx, vy);
    assert.ok(w.popUp, 'and clicking it opens the popup');
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: a POISONED traveller is warned through the window\'s own popup', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld({ deps: { diseaseCount: () => 0, poisonCount: () => 3 } });
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    w.locationSelected = true;
    w.locationSummary = locationSummaryAt(deps.mapDict, 50, 120);
    w._createPopUpWindow();
    w.popUp.input('KeyB');
    assert.equal(w.popUp.top, 'diseased', 'the window forwards poisonCount to the popup');
    assert.equal(w.popUp.doFastTravel, false);
  } finally { _setTravelMapArtForTests(null); }
});

test('U41: a right-click on the map is the map\'s, never a swing', () => {
  // the travel map makes RMB a routine gesture (its zoom), so the two
  // exterior hosts need the dungeon host's gate (dungeon.js:196)
  for (const host of ['world', 'exterior']) {
    const src = readFileSync(new URL(`../src/scenes/${host}.js`, import.meta.url), 'utf8');
    const line = src.split('\n').find((l) => l.includes("addEventListener('mousedown'") && l.includes('e.button === 2'));
    assert.ok(line, `${host} binds RMB`);
    assert.ok(line.includes('!townTalk.overlayActive'), `${host}'s RMB swing is gated on the overlay`);
  }
});

test('U41: the source carries the laws it claims', () => {
  const src = readFileSync(new URL('../src/ui/travelMapWindow.js', import.meta.url), 'utf8');
  assert.ok(src.includes('hasDiscoveredLocationId(summary.id) || !!summary.discovered || _revealUndiscoveredLocations'),
    'checkLocationDiscovered is the ONE test: store OR baked flag OR the cheat');
  assert.ok(src.includes('Math.trunc((((height - y - 1) * width) + x) * this.scale)'),
    'the dots walk keeps DFU\'s offset * scale indexing');
  assert.ok(src.includes('yAdjust = regionIndex === BETONY_INDEX ? -477 : 0'), 'Betony\'s crosshair fixup');
  assert.ok(src.includes('x += 60; y += 212;'), 'Betony\'s mouse fixup');
  assert.ok(src.includes('xDiff = Math.trunc(xDiff / 4)'), 'the Cybiades quarter-scale fix');
  assert.ok(src.includes('this.identifyLastChangeTime = _clock - IDENTIFY_FLASH_INTERVAL'),
    'the flash stamp stores the DISTANCE, so the first map of a session flashes at once');
  assert.ok(/^let _clock = 0;$/m.test(src), 'against ONE monotonic clock, as realtimeSinceStartup is');
});

// ---------------------------------------------------------------
// G5: the TELEPORT arm. The map is the same map; what changes is
// which popup a pick opens and what happens when it says yes.
// ---------------------------------------------------------------

test('G5: teleport mode forks the popup, and is a ONE-SHOT that the close clears', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const teleported = [];
    const { deps } = mkWorld({ deps: { onTeleport: (pick) => teleported.push(pick) } });
    const w = new TravelMapWindow(deps);
    assert.equal(w.teleportationTravel, false, 'an ordinary map is not armed');

    // ActivateTeleportationTravel (:209-212) is called BEFORE the
    // window is shown, by the guild service.
    w.activateTeleportationTravel();
    assert.equal(w.teleportationTravel, true);

    w._openRegionPanel(DAGGERFALL);
    const hoverMap = (mx, my) => w.hover(mx - ORIGIN[0], my - ORIGIN[1] + 12);
    hoverMap(50, 120);
    w.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);

    // the TELEPORT popup opens, and the TRAVEL popup does not
    assert.ok(w.telePopUp, 'the teleport popup is up');
    assert.equal(w.popUp, null, 'and the travel popup is not');
    assert.deepEqual(w.telePopUp.destination.pixel, { x: 50, y: 120 });
    assert.equal(w.telePopUp.destination.name, 'Daggerfall');

    // yes hands the whole pick back - the same shape onTravel gets,
    // minus the trip, because there is no trip
    w.telePopUp.input('KeyY');
    assert.equal(teleported.length, 1);
    assert.deepEqual(teleported[0].pixel, { x: 50, y: 120 });
    assert.equal(teleported[0].name, 'Daggerfall');
    assert.equal(teleported[0].region, 'Daggerfall');
    assert.equal(w.telePopUp, null, 'the box is dropped');
    assert.equal(w.done, true, 'and the map closes behind it');

    // THE ONE-SHOT: OnPop (:368) clears the arm. A map that closed
    // still armed would teleport the next traveller for free.
    assert.equal(w.teleportationTravel, false);
  } finally { _setTravelMapArtForTests(null); }
});

test('G5: NO leaves the map open and still armed, so another destination can be picked', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const teleported = [];
    const { deps } = mkWorld({ deps: { onTeleport: (pick) => teleported.push(pick) } });
    const w = new TravelMapWindow(deps);
    w.activateTeleportationTravel();
    w._openRegionPanel(DAGGERFALL);
    const hoverMap = (mx, my) => w.hover(mx - ORIGIN[0], my - ORIGIN[1] + 12);
    hoverMap(50, 120);
    w.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    assert.ok(w.telePopUp);

    // NoButton_OnMouseClick is CloseWindow and nothing else (:112-115)
    w.telePopUp.input('KeyN');
    assert.equal(w.telePopUp, null);
    assert.equal(teleported.length, 0);
    assert.equal(w.done, false, 'the map is still open');
    assert.equal(w.teleportationTravel, true, 'and still armed');

    // ...and picking again opens the teleport box again, not a travel one
    hoverMap(52, 121);
    hoverMap(50, 120);
    w.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    assert.ok(w.telePopUp);
    assert.equal(w.popUp, null);
  } finally { _setTravelMapArtForTests(null); }
});

test('G5: the teleport box is its OWN field, so the save envelope never reads it', () => {
  restoreDiscovery(null);
  mountArt();
  try {
    const { deps } = mkWorld();
    // DFU keeps the travel popup in the `popUp` FIELD and the teleport
    // popup in a LOCAL (:1708-1713) - it goes on the UI stack and the
    // map never holds it. The port has to hold its sub-window, so it
    // holds this one somewhere else, and this is why: the save
    // envelope reads the three travel toggles straight off `popUp`.
    const travel = new TravelMapWindow(deps);
    travel._openRegionPanel(DAGGERFALL);
    const hoverT = (mx, my) => travel.hover(mx - ORIGIN[0], my - ORIGIN[1] + 12);
    hoverT(50, 120);
    travel.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    travel.popUp.input('KeyS');   // reckless
    const withTravelBox = travel.getTravelMapSaveData();
    assert.equal(withTravelBox.speedCautious, false, 'the open travel box IS the envelope');
    assert.equal(typeof withTravelBox.sleepInn, 'boolean');

    const tele = new TravelMapWindow(deps);
    tele.activateTeleportationTravel();
    tele._openRegionPanel(DAGGERFALL);
    const hoverE = (mx, my) => tele.hover(mx - ORIGIN[0], my - ORIGIN[1] + 12);
    hoverE(50, 120);
    tele.click(50 - ORIGIN[0], 120 - ORIGIN[1] + 12);
    assert.ok(tele.telePopUp, 'the teleport box is up');
    assert.equal(tele.popUp, null);

    // a quicksave taken RIGHT NOW still records three booleans. Put
    // the teleport box in `popUp` and all three read `undefined`.
    const env = tele.getTravelMapSaveData();
    for (const key of ['sleepInn', 'speedCautious', 'travelShip']) {
      assert.equal(typeof env[key], 'boolean', `${key} survived the teleport box`);
    }

    // and the box takes input/hover/click without the map reaching
    // for a method it does not have - hover in particular, which the
    // travel popup answers and a yes/no box does not
    tele.hover(10, 10);
    assert.ok(tele.telePopUp, 'a hover over a teleport box is simply nothing');
  } finally { _setTravelMapArtForTests(null); }
});

// ROADS 13 (2026-09-02): THE CLASSIC MAP DRAWS THE NETWORK. Same loop
// as the dots, same texel-to-pixel law, same "this region only" rule,
// written UNDER the dots, gated by the shared flags the enhanced map's
// chips flip. A road pixel across the region border is not drawn - DFU
// shows the current region alone, and the network follows that.
test('ROADS 13: roads and tracks plot on the region panel, under the dots, by the shared flags', async () => {
  const { MAP_WIDTH } = await import('../src/formats/woodsFile.js');
  restoreDiscovery(null);
  _resetForTests();
  mountArt();
  try {
    const { deps } = mkWorld();
    const roads = new Uint8Array(MAP_WIDTH * 500), tracks = new Uint8Array(MAP_WIDTH * 500);
    roads[125 * MAP_WIDTH + 55] = 34;      // a road pixel inside the region
    roads[130 * MAP_WIDTH + 60] = 34;      // a road pixel in the OTHER region (politic 23)
    tracks[126 * MAP_WIDTH + 57] = 34;     // a track pixel inside
    roads[120 * MAP_WIDTH + 50] = 34;      // a road on the city's own pixel
    deps.roads = () => ({ roads, tracks });
    const w = new TravelMapWindow(deps);
    w._openRegionPanel(DAGGERFALL);
    const at = (mx, my) => w._dotsBuf[((REGION_H - (my - ORIGIN[1]) - 1) * REGION_W) + (mx - ORIGIN[0])];
    const road = at(55, 125), track = at(57, 126);
    assert.notEqual(road, 0, 'the road pixel plots');
    assert.notEqual(track, 0, 'the track pixel plots');
    assert.notEqual(road, track, 'in different colours');
    assert.equal(at(60, 130), 0, 'a road in another region does not plot on this panel');
    assert.notEqual(at(50, 120), road, 'the city\u2019s dot sits ON TOP of the road that reaches it');
    // the shared flags: hide roads, the road texel clears, the track stays
    w.filters.roads = true;
    w._updateMapLocationDotsTexture();
    assert.equal(at(55, 125), 0, 'roads off');
    assert.notEqual(at(57, 126), 0, 'tracks still on');
    w.filters.roads = false; w.filters.tracks = true;
    w._updateMapLocationDotsTexture();
    assert.notEqual(at(55, 125), 0); assert.equal(at(57, 126), 0, 'tracks off');
  } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); _resetForTests(); }
});
