// FIELD BUGS 2026-10-20c STREETS-TAB (a player on the Discord, 2026-10-20: "citisens who mark locations on your map dont
// leave a mark").
//
// A townsperson's mark is whole (STAR-PLATE's report: %loc -> MarkKeySubjectLocationOnMap -> DiscoverBuilding, read by
// the town map) - and it is a building on the TOWN'S plan. The map a player opens most, the travel key's (the dial's Map
// opens it too), held the bay alone, so a player who looked there found no mark. The Enhanced map's tab law already
// offered a town's streets beside the bay (systems/map/mapTabs.js, EM4) and the held window already holds both sheets;
// only the travel key's door handed no streets. Now the town key's module (scenes/exteriorAutomapToggle.js, out of
// bootWorld by STAR0) builds the town the player stands in once, for either key: the M key's window as before
// (`toggleExteriorAutomap`), and the travel
// key's streets (`travelTown`, spread at scenes/world.js toggleTravelMap past its ladder) - from ONE bag
// (ui/town/townMapDoor.js townSheetBag) - the window opening on the bay, the streets one tab away.
//
// The fixture drives the real module over a host of handles (the town's bytes and the discovery record real, the rest
// the host's shapes) and opens both keys' real windows through their real doors; the ARENA2 case does it over
// Daggerfall. THE FOUR HOSTS by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createExteriorAutomapToggle } from '../../../src/scenes/exteriorAutomapToggle.js';
import { createTravelMapWindow } from '../../../src/ui/travel/travelMapDoor.js';
import { townSheetBag } from '../../../src/ui/town/townMapDoor.js';
import * as D from '../../../src/systems/discovery.js';
import { resetTravelMapState } from '../../../src/systems/travel/travelMapState.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { hostText } from '../../hostText.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
      append(...k) { n.children.push(...k); }, appendChild(k) { n.children.push(k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelector: () => null, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; }, removeAttribute() {},
      getBoundingClientRect: () => ({ width: 0, height: 0, left: 0, top: 0 }), focus() {}, blur() {},
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), createElementNS: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
/** The Enhanced skin and a document, for one case. */
function enhanced(fn) {
  resetTravelMapState(); setPref('skin', 'enhanced');
  globalThis.document = fakeDocument(); globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
  return Promise.resolve().then(fn).finally(() => { D.restoreDiscovery(null); delete globalThis.document; });
}

// A one-block town: three named shops, a stable's yard - and the wild one pixel east.
const SHOPS = [[BUILDING_TYPES.GeneralStore, 101, 40, 40], [BUILDING_TYPES.Tavern, 202, 60, 30], [BUILDING_TYPES.Armorer, 303, 30, 70]];
const block = () => ({ x: 0, y: 0, dfBlock: { rmbBlock: {
  fldHeader: { numBlockDataRecords: SHOPS.length, buildingDataList: SHOPS.map(([t, seed]) => ({ buildingType: t, nameSeed: seed, factionId: 0, quality: 10 })), autoMapData: new Uint8Array(64 * 64) },
  subRecords: SHOPS.map(([, , x, z]) => ({ xPos: x * 40, zPos: z * 40, yRotation: 0 })),
} } });
const TOWN = { regionIndex: 17, name: 'Testbury', locationIndex: 0, mapTableData: { mapId: 4242 },
  exterior: { buildings: SHOPS.map(([t, seed]) => ({ buildingType: t, nameSeed: seed, factionId: 0, quality: 10 })), exteriorData: { width: 1, height: 1 } } };
const YARD = { kind: 'stable', gx: 8, gy: 8, nx: 3, nz: 3, x: 15, z: 15, keeper: { name: 'Orla' } };
const LOC_ID = `${TOWN.regionIndex}:${TOWN.name}`;   // the talk seam's key and both maps' (systems/discovery.js)

/** The host's handles, as bootWorld hands them (scenes/world.js createExteriorAutomapToggle): the player at `at`, in `mode`. */
function townHost({ dfLoc = TOWN, blocks = [block()], yards = [YARD] } = {}) {
  const h = {
    at: { x: 5, y: 5 }, shown: [], asked: [], mode: 'exterior',
    boardSplitOf: () => new Map(), built: new Map([['5,5', { locBlocks: blocks, locOrigin: [0, 0, 0], merchantYards: yards }]]),
    cam: { pos: [10, 0, 10], yaw: 0 }, cpuModels: new Map(), getGpuMesh: () => Promise.resolve(),
    locationIndex: new Map([['5,5', dfLoc]]), maps: { getRegionName: () => 'Daggerfall' },
    noticeBook: null, noticeTownOf: () => null, onlineHomes: { ensure: (mapId) => h.asked.push(mapId), homeAt: () => null, version: () => 0 },
    player: { pos: [10, 0, 10] }, playerTravelPixel: () => h.at, questBuildingSource: {},
    state: { pixelTranslation: () => [0, 0, 0] },
    townTalk: { overlayActive: false, showOverlay: (w) => h.shown.push(w), directory: [] },
    walkMode: true, weaponRig: null, activeQuestIds: () => [], hudArt: null, partyOnMaps: () => [], questBridge: null,
    topicTree: { isBuildingQuestResource: () => false }, townBoardMarks: () => [], renameMapBuilding: () => {},
    get modes() { return { mode: h.mode }; },
  };
  return h;
}
/** The travel key's window, through its real door, with the bag the host spreads into it (toggleTravelMap). */
const travelWindow = (extra) => createTravelMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 }, mapDict: new Map(),
  gold: () => 0, goldPieces: () => 0, diseaseCount: () => 0, poisonCount: () => 0, ...extra,
});
const VIEW = { ox: 0, oy: 0, scale: 4 };
/** A sheet's plates at one view, as its words and the buildings they name. */
const plates = (sheet) => sheet.platesAt(VIEW, 400, 300, null).map((r) => [r.text, r.name]).sort();

test('STREETS-TAB: standing in a town, the travel key\'s window holds the town\'s streets beside the bay and opens on the bay - the streets one press away; in the wild, indoors and in a dungeon it is the bay alone, as it was (mutants: the travel door hands no streets; no town handed; opened on the streets; no ask; no place; handed indoors)', () => enhanced(() => {
  const h = townHost();
  const town = createExteriorAutomapToggle(h);
  const bag = town.travelTown();
  assert.deepEqual(Object.keys(bag).sort(), ['openOnSheet', 'town', 'where']);
  assert.deepEqual(bag.where(), { inLocation: true }, 'a town (systems/map/mapTabs.js mapContextOf)');
  const win = travelWindow(bag);
  assert.deepEqual(win._slot.ids, ['town', 'world'], 'the town\'s two tabs, in the strip\'s order');
  assert.equal(win._slot.live, 'world', 'the travel key opens where it always has: the bay');
  assert.equal(win.isTravelMap, true, 'and it is still the travel map');
  assert.equal(win._slot.toggles, true, 'the tab key turns to the streets');
  assert.equal(win._selectSheet('town'), true, 'one press: the streets');
  assert.equal(win._sheet.id ?? win._slot.live, 'town');
  win.dispose?.();
  // the wild, one pixel east: the bay alone - the window as it always was
  h.at = { x: 6, y: 5 };
  assert.deepEqual(town.travelTown(), {}, 'no town under the player: nothing handed');
  const wild = travelWindow(town.travelTown());
  assert.deepEqual(wild._slot.ids, ['world']);
  assert.equal(wild._slot.live, 'world');
  wild.dispose?.();
  // indoors and in a dungeon (the door refuses both first - IsPlayerInside - and the module answers nothing there anyway)
  h.at = { x: 5, y: 5 };
  for (const mode of ['interior', 'dungeon']) {
    h.mode = mode;
    assert.deepEqual(town.travelTown(), {}, `${mode}: no streets`);
  }
}));

test('STREETS-TAB ONE BAG: the streets on the travel key\'s window are the M key\'s - a building a townsperson marks (DiscoverBuilding, the talk seam\'s record) stands on both, the same plates, the yard laid on both; the town\'s homes asked at either open; the M key opens nothing off a location (mutants: the travel key\'s own bag; the M key\'s own bag; the homes not asked at the travel key)', () => enhanced(() => {
  const h = townHost();
  const town = createExteriorAutomapToggle(h);
  const shops = town.travelTown().town.buildings();
  assert.equal(shops.length, 3, 'the town\'s three shops, off the real summaries walk');
  const marked = shops.find((b) => b.buildingType === BUILDING_TYPES.Tavern);
  h.asked.length = 0;
  D.restoreDiscovery(null);
  // before the mark: neither key's streets letter the tavern
  town.toggleExteriorAutomap();
  const mBefore = h.shown.pop()._sheets.get('town');
  assert.ok(!plates(mBefore).some(([, n]) => n === marked.name), 'not yet marked: no plate on the M key\'s sheet');
  // the mark, as the talk writes it (answerPipeline's MarkKeySubjectLocationOnMap -> discoverBuilding)
  D.discoverBuilding(LOC_ID, { buildingKey: marked.buildingKey, name: marked.name, buildingType: marked.buildingType, factionId: 0, quality: 10 });
  town.toggleExteriorAutomap();
  assert.equal(h.shown.length, 1, 'the M key\'s window');
  const mSheet = h.shown[0]._sheets.get('town');
  assert.deepEqual(h.shown[0]._slot.ids, ['town'], 'the M key\'s window: the streets alone (the bay is the travel key\'s - its ladder)');
  const travel = travelWindow(town.travelTown());
  const tSheet = travel._sheets.get('town');
  assert.ok(plates(mSheet).some(([, n]) => n === marked.name), 'the mark stands on the M key\'s streets');
  assert.deepEqual(plates(tSheet), plates(mSheet), 'and on the travel key\'s - the same plates');
  assert.deepEqual(tSheet.names(), mSheet.names(), 'the same names');
  const laid = (s) => JSON.stringify(s.names().filter((n) => /Orla/.test(n.text ?? n.name ?? '')));
  assert.notEqual(laid(mSheet), '[]', 'the stable laid on the M key\'s streets (YARDS-FOUND)');
  assert.equal(laid(tSheet), laid(mSheet), 'and on the travel key\'s');
  assert.deepEqual(h.asked, [4242, 4242, 4242], 'the town\'s homes asked at every open, either key (TOWN-MARKS)');
  h.shown[0].dispose?.(); travel.dispose?.();
  // the door's bag is the one home of both
  assert.deepEqual(Object.keys(townSheetBag({})).sort(), ['blocks', 'boards', 'buildings', 'discovered', 'gridH', 'gridW', 'homes', 'homesVersion', 'party', 'player', 'questBuildings', 'revealAll', 'title']);
  // the wild: the M key opens nothing, as DFU's (DaggerfallUI.cs:633-650)
  h.at = { x: 6, y: 5 };
  town.toggleExteriorAutomap();
  assert.equal(h.shown.length, 1, 'nothing opened off a location');
}));

test('STREETS-TAB by source: bootWorld constructs the town map\'s module and hands the M key to `open`; the travel key\'s door - and that door alone - spreads `travelTown` into its window, past its whole ladder; the town key\'s door and the travel key\'s build the streets from townSheetBag; THE FOUR HOSTS (mutants: the travel door hands no streets)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const \{ toggleExteriorAutomap, travelTown \} = createExteriorAutomapToggle\(\{   \/\/ HOST-SPLIT: src\/scenes\/exteriorAutomapToggle\.js\n[^]*?\n\s+get modes\(\) \{ return modes; \},[^]*?\n\s+\}\);/, 'constructed once, the mode read live');
  assert.match(w, /toggleAutomap: \(\) => toggleExteriorAutomap\(\),/, 'the M key');
  assert.equal((w.match(/\.\.\.travelTown\(\)/g) ?? []).length, 1, 'one door spreads the streets: the teleport, the portal stone, the driver\'s map and the editor\'s jump are armed windows, not the player\'s map');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('const showQuestPlace = (find) =>'));
  const spread = door.indexOf('_travelMap = buildTravelMapWindow({ ...travelTown(), onTravel: (pick, opts, computed) => {');
  assert.ok(spread > 0, 'the travel key\'s window takes the streets');
  for (const rung of ["if ((modes?.mode ?? 'exterior') !== 'exterior') {", 'if (giveOffer()) return false;', 'const cfb = careerFastTravelBlock(playerEntity, nowMin);', 'const ftb = racialFastTravelBlock(playerEntity, nowMin);', 'if (!gotoPlace && partyTravel?.mapOffer()) return false;']) {
    const at = door.indexOf(rung);
    assert.ok(at > 0 && at < spread, `past the ladder: ${rung}`);
  }
  assert.ok(door.indexOf('areEnemiesNearby(') > 0 && door.indexOf('areEnemiesNearby(') < spread, 'past the enemies');
  const m = src('src/scenes/exteriorAutomapToggle.js');
  assert.match(m, /^\/\/ HOST-SPLIT: moved verbatim out of src\/scenes\/world\.js's bootWorld /, 'read whole with its host (test/hostText.mjs)');
  assert.ok(hostText('src/scenes/world.js').includes('const travelTown = () => {'), '...and so read');
  assert.match(m, /return \{ town: townSheetBag\(here\.deps\), where: here\.deps\.where, openOnSheet: 'world' \};/);
  assert.match(m, /if \(\(host\.modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return \{\};/);
  assert.match(m, /return \{ toggleExteriorAutomap, travelTown \};/);
  const td = src('src/ui/town/townMapDoor.js');
  assert.match(td, /town: townSheetBag\(deps\),/, 'the town key\'s door builds its streets there too');
  assert.equal((td.match(/gridW: deps\.gridW \?\? 0,/g) ?? []).length, 1, 'one bag, one home');
  // THE FOUR HOSTS. bootWorld: wired, above. bootExterior: no travel map on that route (DfTravelMapWindow is world.js's) -
  // its M key builds through the same door, so its streets are the same bag. createWorldModes, buildDungeonContext: the
  // travel key is refused indoors and in a dungeon (IsPlayerInside, the door above), and their M opens the building's
  // and the dungeon's own plans.
  const e = src('src/scenes/exterior.js');
  assert.doesNotMatch(e, /createTravelMapWindow|buildTravelMapWindow|travelTown/, 'bootExterior: no travel map');
  assert.match(e, /townTalk\.showOverlay\(createTownMapWindow\(\{/, '...its M through the one door');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(src(host), /createTravelMapWindow|createTownMapWindow|travelTown/, `${host}: no travel map, no town plan`);
  }
});

// ── THE REPORT'S TOWN KIND, on the game's own data: Daggerfall, both keys' real windows ─────────────────────────────

test('STREETS-TAB with ARENA2: in Daggerfall the building a townsperson marks stands on the travel key\'s streets as on the M key\'s plan - every plate the same (mutants: the travel key\'s own bag)', { skip: skipReal }, () => enhanced(async () => {
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { layoutLocation } = await import('../../../src/world/locationLayout.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const loc = maps.getLocationByName('Daggerfall', 'Daggerfall');
  assert.equal(loc?.name, 'Daggerfall');
  const log = console.log; console.log = () => {};   // the layout names every block it reads
  let lay;
  try { lay = layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true }); } finally { console.log = log; }
  const h = townHost({ dfLoc: loc, blocks: lay.blocks, yards: null });
  h.maps = maps;
  const town = createExteriorAutomapToggle(h);
  const shops = town.travelTown().town.buildings().filter((b) => !b.isResidence && b.name);
  assert.ok(shops.length > 100, `a city's worth of named buildings (${shops.length})`);
  const id = `${loc.regionIndex}:${loc.name}`;
  const found = (b) => D.discoverBuilding(id, { buildingKey: b.buildingKey, name: b.name, buildingType: b.buildingType, factionId: b.factionId, quality: b.quality });
  const pick = shops.find((b) => shops.filter((x) => x.name === b.name).length === 1 && b.buildingType === BUILDING_TYPES.Tavern);
  assert.ok(pick, 'a tavern of its own name');
  const at = (s) => s.platesAt({ ox: 0, oy: 0, scale: 1 }, 1600, 900, null).map((r) => [r.text, r.name, Math.round(r.x), Math.round(r.y)]).sort();
  /** Both keys' streets, opened as the player opens them: the M key's window, and the travel key's (on the bay). */
  const both = () => {
    town.toggleExteriorAutomap();
    const m = h.shown.pop();
    const travel = travelWindow(town.travelTown());
    assert.deepEqual(travel._slot.ids, ['town', 'world']);
    assert.equal(travel._slot.live, 'world');
    const out = { m: at(m._sheets.get('town')), t: at(travel._sheets.get('town')) };
    m.dispose?.(); travel.dispose?.();
    return out;
  };
  D.restoreDiscovery(null);
  for (const b of shops) if (b !== pick) found(b);   // the city known but the tavern
  const before = both();
  assert.ok(before.m.length > 100, `a city's plates (${before.m.length})`);
  assert.deepEqual(before.t, before.m, 'the travel key\'s streets are the M key\'s, every plate where it stands');
  assert.ok(!before.m.some(([, n]) => n === pick.name), `${pick.name}: not yet marked - on neither`);
  found(pick);   // a townsperson's mark (MarkKeySubjectLocationOnMap -> DiscoverBuilding)
  const after = both();
  assert.ok(after.m.some(([, n]) => n === pick.name), `${pick.name}: marked, on the M key's plan`);
  assert.deepEqual(after.t, after.m, 'and on the travel key\'s streets the same - its plate, or the solver\'s "*" for it, where the M key\'s is');
}));
