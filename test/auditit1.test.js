// AUDIT IT1 (2026-10-04, the owner: "Lets audit this") - Immersive Travel 1.5 audited after its integration: five
// lenses (the laws against the IL, the classic window and popup, the enhanced sheet, the host and the online lane, the
// gate world data), every finding verified, pinned here red first and fixed. The record is
// bible/01-Overview/Audit-IT1.md; the mutants are tools/mutants/auditit1.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TravelMapWindow, OFFSET_LOOKUP, _setTravelMapArtForTests } from '../src/ui/travelMapWindow.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { buildMapDict } from '../src/systems/mapDirectory.js';
import { REGION_NAMES, LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import {
  resetTravelMapState, setTravelMapPopUpState, travelMapPopUpState, travelMapFilters, travelMapMarkedMapId,
} from '../src/systems/travelMapState.js';
import { restoreDiscovery } from '../src/systems/discovery.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { readImmersiveTravelSettings, itMapPaths, IT_POPUP, IT_TEXT, IMMERSIVE_TRAVEL_VENDOR, DOCK_PIXEL_IDS } from '../src/systems/immersiveTravel.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function settings(over = {}) {
  const all = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default])), ...over };
  return readImmersiveTravelSettings((v, k) => (v === 'roads-hazelnut' ? true : all[k]));
}

// ── the classic window (ui/travelMapWindow.js, ui/travelPopUp.js) ─────────────────────────────────────────────────
const DAGGERFALL = 17;
const mapIdOf = (x, y) => (DAGGERFALL << 20) | getMapPixelID(x, y);
const row = (x, y, locationType) => ({ mapId: mapIdOf(x, y), longitude: x * 128, latitude: (499 - y) * 128, locationType, discovered: true, dungeonType: 255 });
const PLACES = [['Daggerfall', row(50, 120, LOCATION_TYPES.TownCity)], ['Copperfield', row(54, 122, LOCATION_TYPES.TownVillage)], ['The Old Keep', row(58, 124, LOCATION_TYPES.DungeonKeep)]];
function world(extra = {}) {
  const mapNames = PLACES.map((e) => e[0]), mapTable = PLACES.map((e) => e[1]);
  const region = { name: REGION_NAMES[DAGGERFALL], locationCount: PLACES.length, mapNames, mapTable, mapNameLookup: new Map(mapNames.map((n, i) => [n, i])), mapIdLookup: new Map(mapTable.map((r, i) => [r.mapId, i])) };
  const maps = {
    regionCount: 62, getRegion: (i) => (i === DAGGERFALL ? region : null), getRegionByName: (n) => (n === region.name ? region : null),
    getRegionName: (i) => REGION_NAMES[i] ?? '', getPoliticIndex: () => 128 + DAGGERFALL, getClimateIndex: () => CLIMATES.Woodlands,
  };
  return {
    maps, mapDict: buildMapDict(maps), getPlayerPixel: () => ({ x: 50, y: 120 }), getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 100000, goldPieces: () => 100000, diseaseCount: () => 0, onTravel: () => {},
    roads: () => ({ roads: new Uint8Array(MAP_WIDTH * MAP_HEIGHT), tracks: new Uint8Array(MAP_WIDTH * MAP_HEIGHT) }),
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
const ORIGIN = OFFSET_LOOKUP['FMAP0I17.IMG'];
const screenOf = (mx, my) => [mx - ORIGIN[0], my - ORIGIN[1] + 12];
const summary = (i) => ({ id: PLACES[i][1].mapId & 0xfffff, mapID: PLACES[i][1].mapId, regionIndex: DAGGERFALL, mapIndex: i, locationType: PLACES[i][1].locationType, discovered: true });
function classic(fn) {
  resetTravelMapState(); restoreDiscovery(null); mountArt();
  try { return fn(); } finally { _setTravelMapArtForTests(null); restoreDiscovery(null); resetTravelMapState(); }
}

test('AUDIT IT1 C2/M1: the player\'s own map while the mod is on and Travel Options off is the mod\'s CarriageMap - every pick a NEW DFU popup on Cautious / By ship / At inns (CreatePopUpWindow IL_0870-0885 nulls the persistent one), never the remembered toggles; with Travel Options on, or the mod off, the remembered three as before', () => classic(() => {
  const s = settings();
  setTravelMapPopUpState({ speedCautious: false, travelShip: false, sleepModeInn: false });
  const own = new TravelMapWindow(world({ immersiveSettings: () => s }));
  own.locationSummary = summary(1);
  own._createPopUpWindow();
  assert.equal(own.popUp.itKind, null, 'DFU\'s popup, not the mod\'s');
  assert.deepEqual([own.popUp.speedCautious, own.popUp.travelShip, own.popUp.sleepModeInn], [true, true, true]);
  // ...and what it chose is still what GetTravelMapSaveData reads (the store keeps learning)
  own.popUp.speedCautious = false;
  own._rememberPopUpState();
  assert.equal(travelMapPopUpState().speedCautious, false);
  for (const deps of [{ immersiveSettings: () => s, travelOptions: () => ({ settings: {} }) }, {}]) {
    setTravelMapPopUpState({ speedCautious: false, travelShip: false, sleepModeInn: false });
    const w = new TravelMapWindow(world(deps));
    w.locationSummary = summary(1);
    w._createPopUpWindow();
    assert.deepEqual([w.popUp.speedCautious, w.popUp.travelShip, w.popUp.sleepModeInn], [false, false, false], 'the persistent popup\'s three');
  }
}));

test('AUDIT IT1 C1: a driver\'s map is a NEW CarriageMap (CarriageTravelService IL_05a2) - its own four filters, all shown, that the player\'s map never sees, and no middle-click mark', () => classic(() => {
  travelMapFilters().towns = true;   // the player hid towns on their own map
  const w = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: settings() } }));
  assert.equal(w.filters.towns, false, 'the driver\'s towns are shown');
  w._filterButtonClick('dungeons');
  assert.deepEqual([w.filters.dungeons, travelMapFilters().dungeons, travelMapFilters().towns], [true, false, true], 'a flip on the driver\'s map is the driver\'s map\'s');
  w._openRegionPanel(DAGGERFALL);
  Object.assign(w, { locationSelected: true, mouseOverRegion: DAGGERFALL, locationSummary: summary(1) });
  w._markLocationHandler();
  assert.equal(travelMapMarkedMapId(), -1, 'CarriageMap has no MarkLocationHandler');
  // the player's own map still rides the store
  assert.equal(new TravelMapWindow(world()).filters, travelMapFilters());
}));

test('AUDIT IT1 C6: a middle click reaches the map only when the map is the top window - under the popup it neither marks nor re-aims the pick the popup will travel to', () => classic(() => {
  let pick = null;
  const w = new TravelMapWindow(world({ travelOptions: () => ({ settings: {} }), onTravel: (pk) => { pick = pk; } }));
  w._openRegionPanel(DAGGERFALL);
  const [vx, vy] = screenOf(54, 122);
  w.hover(vx, vy); w.click(vx, vy);
  assert.ok(w.popUp, 'Copperfield\'s popup');
  const [cx, cy] = screenOf(50, 120);
  w.click(cx, cy, false, true);   // the middle button over Daggerfall, the popup still up
  assert.equal(travelMapMarkedMapId(), -1);
  w.popUp.begin();
  for (let i = 0; i < 10000 && !pick; i++) w.tick(0.1);
  assert.deepEqual([pick?.name, pick?.mapId], ['Copperfield', mapIdOf(54, 122)]);
}));

test('AUDIT IT1 C4: the captain\'s map with Show Only Docks hides a dockless place from the hover, the click and the find, not only from the dots (SeafarersMap.checkLocationDiscovered IL_17a0-17ee is the window\'s one visibility test)', () => classic(() => {
  assert.equal(DOCK_PIXEL_IDS.includes(summary(1).id), false);
  const sea = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.seafarer, settings: settings({ 'ShipTravel.ShowOnlyDocks': true }) } }));
  assert.equal(sea.checkLocationDiscovered(summary(1)), false);
  const all = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.seafarer, settings: settings({ 'ShipTravel.ShowOnlyDocks': false }) } }));
  assert.equal(all.checkLocationDiscovered(summary(1)), true);
}));

test('AUDIT IT1 C3/C7: under the mod\'s OK box the popup is not the top window, so its countdown waits (DFU updates the top window alone); the box\'s OK plays the button\'s click, and OnPush\'s plays the mod\'s second (IL_1bbb-1bc5)', () => classic(() => {
  let travelled = 0;
  const w = new TravelMapWindow(world({ immersive: { kind: IT_POPUP.carriage, settings: settings() }, onTravel: () => { travelled++; } }));
  w.locationSummary = summary(1);
  w._createPopUpWindow();
  const p = w.popUp;
  let clicks = 0;
  p._click = () => { clicks++; };
  p.begin();
  assert.equal(p.doFastTravel, true);
  p.input('KeyT');   // By ship under Disable Ship Travel Outside Docks: refused
  assert.equal(p.top, 'itBox');
  for (let i = 0; i < 200; i++) p.tick(1);
  assert.equal(travelled, 0, 'no trip while the box is up');
  clicks = 0;
  p.input('KeyO');
  assert.deepEqual([p.top, clicks], [null, 1], 'the message box\'s button click');
  for (let i = 0; i < 200 && !travelled; i++) p.tick(1);
  assert.equal(travelled, 1);
  // the player's own popup under Disable Normal Travel: OnPush's box, two clicks on its OK
  const own = new TravelMapWindow(world({ immersiveSettings: () => settings({ 'General.DisableNormalTravel': true }), travelOptions: () => ({ settings: {} }) }));
  own.locationSummary = summary(0);
  own._createPopUpWindow();
  let pushClicks = 0;
  own.popUp._click = () => { pushClicks++; };
  own.popUp.input('Enter');
  assert.equal(pushClicks, 2);
}));

test('AUDIT IT1 C5: I over a popup is Travel Options\' (TravelOptionsPopUp.Update) - not the mod\'s popups\', which derive from DFU\'s, and not DFU\'s own with Travel Options off', () => classic(() => {
  const asked = (deps) => {
    const w = new TravelMapWindow(world(deps));
    let n = 0;
    w._displayLocationInfo = () => { n++; };
    w.locationSummary = summary(1);
    w._createPopUpWindow();
    w.popUp.input('KeyI');
    return n;
  };
  assert.equal(asked({ immersive: { kind: IT_POPUP.carriage, settings: settings() }, travelOptions: () => null }), 0, 'a driver\'s popup');
  assert.equal(asked({}), 0, 'DFU\'s, Travel Options off');
  assert.equal(asked({ travelOptions: () => ({ settings: {} }) }), 1, 'Travel Options\' popup');
}));

// ── the enhanced sheet (ui/heldMap.js) ────────────────────────────────────────────────────────────────────────────
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function sheet(fn) {
  resetTravelMapState();
  globalThis.document = fakeDocument();
  try { return fn(); } finally { delete globalThis.document; resetTravelMapState(); }
}
const summaryOf = (x, y, locationType) => ({ id: y * 1000 + x, mapID: y * 1000 + x, regionIndex: 17, mapIndex: 3, locationType, discovered: true });
const mkSheet = (extra = {}) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Mountain,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
  gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  maps: { getPoliticIndex: () => 128 + 17 }, itHere: () => ({ x: 5, y: 5, mapId: 1, locationType: LOCATION_TYPES.TownCity, regionIndex: 17 }),
  ...extra,
});
const pickFar = (w) => { w._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 }; };

test('AUDIT IT1 M1: on the sheet too - the player\'s own map under the mod with Travel Options off opens DFU\'s new popup\'s three, and with Travel Options on the remembered three', () => sheet(() => {
  const s = settings();
  setTravelMapPopUpState({ speedCautious: false, travelShip: false, sleepModeInn: false });
  const own = mkSheet({ immersiveSettings: () => s });
  pickFar(own);
  own._openPanel('travel');
  assert.deepEqual({ ...own._panelState.opts }, { speedCautious: true, travelShip: true, sleepModeInn: true });
  own.dispose();   // what it opened on is remembered as it closes, as GetTravelMapSaveData reads the last popup
  assert.deepEqual(travelMapPopUpState(), { speedCautious: true, travelShip: true, sleepModeInn: true });
  setTravelMapPopUpState({ speedCautious: false, travelShip: false, sleepModeInn: false });
  const to = mkSheet({ immersiveSettings: () => s, travelOptions: () => ({ settings: {} }) });
  pickFar(to);
  to._openPanel('travel');
  assert.deepEqual({ ...to._panelState.opts }, { speedCautious: false, travelShip: false, sleepModeInn: false });
  to.dispose();
}));

test('AUDIT IT1 H-L1: a refusal the sheet showed is gone once a later press on the same pick opens the panel', () => sheet(() => {
  let s = settings({ 'General.DisableNormalTravel': true });
  const w = mkSheet({ immersiveSettings: () => s, travelOptions: () => ({ settings: {} }) });
  pickFar(w);
  w._openPanel('travel');
  assert.equal(w._itRefusal, IT_TEXT.mustTakeCarriage);
  s = settings();
  w._openPanel('travel');
  assert.deepEqual([w._panel, w._itRefusal], ['travel', null]);
  w.dispose();
}));

test('AUDIT IT1 H-L2: a driver\'s sheet is a new CarriageMap - its own filters (roads and tracks by the mod\'s DrawRoads / DrawTracks, never the player\'s chips), and no Travel Options mark', () => sheet(() => {
  const store = travelMapFilters();
  store.towns = true; store.roads = true;   // the player hid towns and roads on their own sheet
  const s = settings({ 'General.DrawTracks': false });
  const w = mkSheet({ immersive: { kind: IT_POPUP.carriage, settings: s } });
  const [roads, tracks] = itMapPaths(s);
  assert.deepEqual([w.filters.towns, w.filters.roads, w.filters.tracks], [false, !roads, !tracks]);
  assert.notEqual(w.filters, store);
  // a middle click on a place on the paper (the sheet's own hit-tests answered)
  w._onSheet = () => true;
  w._markerAt = () => ({ mapId: 1234 });
  w._markLocationHandler(0, 0);
  assert.equal(travelMapMarkedMapId(), -1);
  w.dispose();
  const own = mkSheet();
  assert.equal(own.filters, store, 'the player\'s own sheet rides the store');
  own.dispose();
  const src = read('src/ui/heldMap.js');
  assert.match(src, /markedMapId: this\._it \? -1 : this\.markedMapId,/, 'the mod\'s maps draw no mark (CarriageMap\'s markedLocationId stays -1)');
}));

// ── the gate world data (tools/immersiveTravelPatches.mjs, world/immersiveTravelGates.js, scenes/modWorldData.js) ──
import { appendedEdit, appendedPatch, IT_GATE_BLOCKS, CLASSIC_BUILDING_SLOTS } from '../tools/immersiveTravelPatches.mjs';
import { gateAppends } from '../src/world/immersiveTravelGates.js';
import { patchJson } from '../src/formats/worldDataJson.js';
import { sha256Canonical } from '../tools/worldDataPatch.mjs';

/** An editor-written gate block: four building slots (the editor writes NumBlockDataRecords of them), a scale of 1 on
 *  every misc model, and the author's records past the header's classic counts (2 models, 1 flat). */
const editorBlock = () => ({
  Name: 'WALLAA08.RMB', Index: 5,
  RmbBlock: {
    FldHeader: {
      NumBlockDataRecords: 4, NumMisc3dObjectRecords: 2, NumMiscFlatObjectRecords: 1,
      BuildingDataList: [0, 1, 2, 3].map((i) => ({ NameSeed: i, FactionId: 0, Sector: 0, LocationId: 0, BuildingType: 'Town4', Quality: 0 })),
    },
    SubRecords: [{}, {}, {}, {}],
    Misc3dObjectRecords: [10, 11, 41214, 41209].map((m) => ({ ModelIdNum: m, XPos: m, XScale: 1, YScale: 1, ZScale: 1 })),
    MiscFlatObjectRecords: [{ TextureArchive: 210, FactionID: 0 }, { TextureArchive: 182, FactionID: 8642 }],
  },
});
/** The classic block it was written over, as the port's reader serializes it: 32 building slots, no scale keys. */
function classicOf(mod) {
  const c = JSON.parse(JSON.stringify(mod));
  const h = c.RmbBlock.FldHeader;
  for (let i = h.BuildingDataList.length; i < CLASSIC_BUILDING_SLOTS; i++) h.BuildingDataList.push({ NameSeed: 0, FactionId: 0, Sector: 0, LocationId: 0, BuildingType: 'House1', Quality: 0 });
  c.RmbBlock.Misc3dObjectRecords = c.RmbBlock.Misc3dObjectRecords.slice(0, h.NumMisc3dObjectRecords).map(({ XScale, YScale, ZScale, ...m }) => m);
  c.RmbBlock.MiscFlatObjectRecords = c.RmbBlock.MiscFlatObjectRecords.slice(0, h.NumMiscFlatObjectRecords);
  return c;
}

test('AUDIT IT1 G1: the header-count edit carries the editor\'s two round-trip changes too - BuildingDataList written at NumBlockDataRecords (the classic block reads 32) and a scale on the classic models (it has none) - so it rebuilds the author\'s file sha256 for sha256', () => {
  assert.equal(CLASSIC_BUILDING_SLOTS, 32);
  const mod = editorBlock();
  const rebuilt = patchJson(classicOf(mod), appendedEdit(mod));
  assert.equal(sha256Canonical(rebuilt), sha256Canonical(mod));
  // the vendored four: 28 slots removed, three scales on each of the two classic models, then the author's records
  for (const name of IT_GATE_BLOCKS) {
    const p = JSON.parse(read(`vendor/immersive-travel/WorldDataPatches/${name}.json`));
    assert.equal(p.ops.filter(([k, path]) => k === 'r' && path[2] === 'BuildingDataList').length, 28, name);
    assert.equal(p.ops.filter(([k, path]) => k === 's' && /^[XYZ]Scale$/.test(path[3])).length, 6, name);
  }
  assert.equal(appendedPatch(mod).sha256, sha256Canonical(mod));
});

test('AUDIT IT1 G1/G2: the layer lays only the author\'s records - a patch WD1 diffed against a real BLOCKS.BSA (removals, sets, inserts) is read for its inserts past the classic counts and never refused, so no op can stop a world loading', () => {
  const mod = editorBlock();
  const wd1 = { rebuilds: 'WALLAA08.RMB.json', ops: [
    ['r', ['RmbBlock', 'FldHeader', 'BuildingDataList', 31]],
    ['s', ['RmbBlock', 'FldHeader', 'AutoMapData', 7], 0],
    ['s', ['RmbBlock', 'Misc3dObjectRecords', 0], { ModelIdNum: 10, XScale: 1 }],
    ['i', ['RmbBlock', 'Misc3dObjectRecords', 2], mod.RmbBlock.Misc3dObjectRecords[2]],
    ['i', ['RmbBlock', 'Misc3dObjectRecords', 3], mod.RmbBlock.Misc3dObjectRecords[3]],
    ['i', ['RmbBlock', 'MiscFlatObjectRecords', 1], mod.RmbBlock.MiscFlatObjectRecords[1]],
  ] };
  const a = gateAppends(wd1, { Misc3dObjectRecords: 2, MiscFlatObjectRecords: 1 });
  assert.deepEqual(a.Misc3dObjectRecords.map((m) => m.ModelIdNum), [41214, 41209]);
  assert.deepEqual(a.MiscFlatObjectRecords.map((f) => f.FactionID), [8642]);
  // a classic record the diff re-inserted (an insert below the classic count) is the mod's own file's, not the layer's
  const low = gateAppends({ rebuilds: 'X', ops: [['i', ['RmbBlock', 'Misc3dObjectRecords', 0], { ModelIdNum: 10 }]] }, { Misc3dObjectRecords: 2, MiscFlatObjectRecords: 1 });
  assert.equal(low.Misc3dObjectRecords.length, 0);
  const src = read('src/scenes/modWorldData.js');
  assert.match(src, /try \{\s*\n?\s*installImmersiveTravelGates\(/, 'the install guarded: a world loads whatever the layer\'s patches say');
});

// ── the host and the online lane (systems/immersiveTravel.js, scenes/world.js, ui/merchantServiceDoor.js) ────────────
import { installImmersiveTravel, immersiveTravelLoaded, _resetImmersiveTravel, IT_FACTIONS, CARRIAGE_DRIVERS_FACTION_ID, SAILORS_FACTION_ID } from '../src/systems/immersiveTravel.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { customFactions, registerCustomFaction, _resetCustomFactions } from '../src/formats/factionFile.js';
import { hasCustomMerchantService, _resetMerchantServices } from '../src/systems/guildServices.js';

function init(fn) {
  _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel();
  try { return fn(); } finally { _resetModSettings(); _resetCustomFactions(); _resetMerchantServices(); _resetImmersiveTravel(); }
}

test('AUDIT IT1 W4/G3: the mod is loaded for the game - off at the start, no factions, no services and no gates though it is switched on mid-game; on at the start, all of them though it is switched off', () => {
  init(() => {
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    installImmersiveTravel();
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', true);
    assert.equal(immersiveTravelLoaded(), false);
    assert.equal(customFactions().has(CARRIAGE_DRIVERS_FACTION_ID), false);
    assert.equal(hasCustomMerchantService(CARRIAGE_DRIVERS_FACTION_ID), false, 'no driver whose click only talks');
  });
  init(() => {
    installImmersiveTravel();
    setModSetting(IMMERSIVE_TRAVEL_VENDOR, 'Enabled', false);
    assert.equal(immersiveTravelLoaded(), true);
    assert.equal(hasCustomMerchantService(SAILORS_FACTION_ID), true);
  });
  // the gates and the maps ask the same latch
  const w = read('src/scenes/world.js');
  assert.match(w, /const immersiveSettingsIfOn = \(\) => \(immersiveTravelLoaded\(\) \? readImmersiveTravelSettings\(\) : null\);/);
  assert.match(w, /if \(!immersiveTravelLoaded\(\) \|\| \(kind !== IT_POPUP\.carriage && kind !== IT_POPUP\.seafarer\)\) return null;/);
  assert.match(read('src/scenes/modWorldData.js'), /const isOn = vendor === IMMERSIVE_TRAVEL_VENDOR \? immersiveTravelLoaded : \(\) => modSetting\(vendor, 'Enabled'\) === true;/);
  assert.match(read('src/systems/features.js'), /modFeature\('immersive-travel', 'Takes effect when the game is next started \(an in-game Load keeps what it started with\); its fares and rules at the next map\.'/);
});

test('AUDIT IT1 L3: Init registers its services only once BOTH factions went in (IL_047a-050b) - a faction id already taken leaves the drivers with no service, and says so', () => {
  init(() => {
    registerCustomFaction(SAILORS_FACTION_ID, { name: 'Someone Else' });
    const warned = [];
    const warn = console.warn;
    console.warn = (m) => warned.push(String(m));
    try { installImmersiveTravel(); } finally { console.warn = warn; }
    assert.equal(customFactions().get(CARRIAGE_DRIVERS_FACTION_ID)?.name, IT_FACTIONS[0].name, 'the first went in');
    assert.equal(hasCustomMerchantService(CARRIAGE_DRIVERS_FACTION_ID), false);
    assert.deepEqual(warned, ['[ImmersiveTravel] Error: could not register custom factions!']);
  });
});

test('AUDIT IT1 W1: the enhanced skin\'s merchant popup names a registered service by its own label - the driver\'s button said "Sell"', () => {
  assert.match(read('src/ui/merchantServiceDoor.js'), /\{ label: hooks\.label \?\? merchantServiceLabel\(hooks\.service\), onClick: \(\) => \{ close\(\); hooks\.onService\?\.\(\); \} \},/);
});

test('AUDIT IT1 L1/W2/W6: the driver\'s map reads PlayerGPS\'s region (politic 64 is 31), refuses a sun-averse traveller by day ONLINE as the travel map\'s door does (no arrival clamp there), and says why when it does not open', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /function itHere\(\) \{[\s\S]*?regionIndex: maps\.getRegionIndexAt\(px\.x, px\.y\),/);
  const open = w.slice(w.indexOf('function openImmersiveMap(kind) {'), w.indexOf('function openTeleportMap() {'));
  assert.match(open, /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) \{ townTalk\.say\(CANNOT_TRAVEL_INDOORS_TEXT\); return null; \}/);
  assert.match(open, /if \(!travelMapDoorReady\(\)\) \{ townTalk\.say\('\(the travel map art is unavailable\)'\); return null; \}/);
  assert.match(open, /if \(sharedClockOn\(\)\) \{\s*\n\s*const nowMin = Math\.floor\(skyMinutes\(\)\);\s*\n\s*const cfb = careerFastTravelBlock\(playerEntity, nowMin\);[^\n]*\n\s*if \(cfb\) \{ sayWithNightfall\(cfb\.text\); if \(cfb\.hint\) townTalk\.say\(cfb\.hint\); return null; \}\s*\n\s*const ftb = racialFastTravelBlock\(playerEntity, nowMin\);\s*\n\s*if \(ftb\) \{ sayWithNightfall\(ftb\.text\); if \(ftb\.hint\) townTalk\.say\(ftb\.hint\); return null; \}/);   // PIN MOVED (HOOD-CAREER): the career rung is careerFastTravelBlock's, its hood's hint after DFU's line
  // ...and it is the clamp's own condition: the arrival clamp runs exactly where this does not
  assert.match(w, /if \(clamp > 0 && !sharedClockOn\(\)\) \{/);
});

test('AUDIT IT1 G5: every one of Beautiful Cities\' 52 composites on a gate takes the carriages - 24 farm, 24 tavern and 4 road - and nothing else does', async () => {
  const { IT_GATE_FILE } = await import('../src/world/immersiveTravelGates.js');
  for (const n of ['WALLAA08.FARMAA00', 'WALLAA09.TVRNAS02', 'WALLAA10.TVRNBS00', 'WALLAA11.ROAD', 'WALLAA08']) {
    assert.equal(IT_GATE_FILE.exec(`${n}.RMB.json`)?.[1], n.slice(0, 8), n);
  }
  for (const n of ['WALLAA07.ROAD', 'WALLAA12.TVRNAS00', 'TVRNAS00.WALLAA08']) assert.equal(IT_GATE_FILE.exec(`${n}.RMB.json`), null, n);
});
