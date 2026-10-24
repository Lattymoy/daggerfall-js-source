// ETHER-OW (2026-10-13, the owner: "Also allow the player to zoom out into the overworld like in the Iliac Bay for easy
// travel. Enemies should show on the world map just like in the bay"; bible/03-World/Eltheric-Ocean.md ETHER-OW) - THE
// OVERWORLD PAST THE VEIL. The way up was the held map's Overworld door (TV1), and past the Veil the map's answer is the
// Eltheric chart, which had none - so no captain there could rise. The view's own reads held the Bay: its places were the
// Bay's dictionary's rows alone (an isle's port and ruin were bare ground to it), its load governor read every pixel off
// the map as built (the clock never held for the land), and its enemies - the roaming bands (TV7) and Warm Ashes' raiders
// (OWS3) - were born on the Bay's map alone, their chases shared in a word that dropped every place past it. Each is run
// here as the host runs it: its own code lifted out of scenes/world.js, over the sea's real ground (world/ethericSea.js).
import '../../chargenDom.mjs';
import { keydown } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostText } from '../../hostText.mjs';

import * as ES from '../../../src/world/ethericSea.js';
import { etherPlaceIsle, etherPlaceRows, etherTemplateOf, synthesizeEtherLocation, etherPlaceId, ETHER_REGION, ETHER_REGION_NAME, PLACE_KINDS } from '../../../src/world/etherPlaces.js';
import { mountEtherChartWindow } from '../../../src/ui/etherChartWindow.js';
import { TRAVEL_VIEW_BUTTON } from '../../../src/scenes/travelView.js';
import { TRAVEL_VIEW_BUTTON as HELD_MAP_BUTTON } from '../../../src/ui/heldMap.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { unbuiltAround, unbuiltCount } from '../../../src/systems/travel/travelGovernor.js';
import { farPlaces, settlementPixels, TV_FAR_RANGE } from '../../../src/systems/travel/travelFarPlaces.js';
import { nearDungeons, dungeonRows, spawnedPixels } from '../../../src/systems/travel/travelDungeons.js';
import { dungeonModelSet } from '../../../src/systems/travel/travelDungeonModels.js';
import { bandsNear, validBandWord, BAND_LIFE_MS } from '../../../src/systems/travel/travelBands.js';
import { raidersNear, raiderAt, validRaiderWord, NATIVE_PIXEL, RAIDER_LIFE_MS, RAIDER_LEG_MS } from '../../../src/systems/seaRaiders.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';
import { CLIMATES, REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { LOCATION_TYPES, getWorldClimateSettings } from '../../../src/formats/mapsFile.js';

const W = hostText('src/scenes/world.js');   // HOST-SPLIT (OW-DUNGEON-SIZE): the dungeons' models list lives in scenes/travelViewDungeonModels.js
/** A block of world.js lifted whole: its first line, to the line at its own indent that closes it. */
const lift = (head, close = '\n  }\n') => {
  const at = W.indexOf(head);
  assert.ok(at >= 0, `world.js holds ${head.trim()}`);
  return W.slice(at, W.indexOf(close, at) + close.length);
};
/** A one-line declaration of world.js lifted. */
const liftLine = (head) => { const at = W.indexOf(head); assert.ok(at >= 0, `world.js holds ${head.trim()}`); return W.slice(at, W.indexOf('\n', at)); };
const run = (env, body) => { const names = Object.keys(env); return new Function(...names, body)(...names.map((k) => env[k])); };

const H = ES.veilhaven();
/** The world's ground with the sea in it: the Bay's land a flat 60 on the map, nothing past it - composed as the host
 *  composes it (ethericSea.js etherWoods), and the host's own water law over it. */
const bayWoods = { getHeightMapValue: (x, y) => (x >= 0 && y >= 0 && x < 1000 && y < 500 ? 60 : 0), getLargeMapData: () => [] };
const woods = ES.etherWoods(bayWoods);
const tvWater = run({ woods, WATER_BYTE }, `${liftLine('  const tvWater = (px, py) =>')}\nreturn tvWater;`);
const maps = { getClimateIndex: ES.etherClimateIndex(() => 231) };

test('ETHER-OW, the door: the chart wears the held map\'s Overworld door - its words one home, shown only where the view can rise (asked at every paint), its press and its key O shutting the chart for the Overworld; hidden, O is no key of the chart\'s (mutants: never shown, the key unheard, the reason a plain close)', () => {
  assert.equal(TRAVEL_VIEW_BUTTON, 'Overworld (O)');
  assert.equal(HELD_MAP_BUTTON, TRAVEL_VIEW_BUTTON, 'the held map\'s door and the chart\'s, one word');
  let can = false;
  const exits = [];
  const host = document.createElement('div');
  const view = mountEtherChartWindow(host, { word: () => ({ px: H.px, py: H.py, yaw: 0, charted: [H.key], legends: [], stats: {} }), overworld: () => can, onExit: (r) => exits.push(r) });
  // AUDIT ETHER-OW T-15: the chart's dialog named by the sea's one name (a reader's first word of it)
  assert.equal(host.querySelectorAll('*').find((n) => n.getAttribute('role') === 'dialog')?.getAttribute('aria-label'), `A chart of ${ES.ETHER_SEA_NAME}`);
  const door = host.querySelectorAll('button').find((b) => b.textContent === TRAVEL_VIEW_BUTTON);
  assert.ok(door, 'the door stands in the chart\'s tools');
  assert.equal(door.hidden, true, 'where the view cannot rise, no door');
  const quiet = keydown('KeyO');
  assert.deepEqual([exits, quiet.defaultPrevented], [[], false], 'and its key nobody\'s');
  door.click();
  assert.deepEqual(exits, [], 'a hidden door is never taken');
  can = true;
  view.repaint();
  assert.equal(door.hidden, false, 'asked again at a paint: the door stands');
  assert.equal(door.style.minWidth, '44px', 'a finger\'s press');
  door.click();
  assert.deepEqual(exits, ['overworld'], 'pressed: the chart shuts for the Overworld');
  const key = keydown('KeyO');
  assert.deepEqual([exits, key.defaultPrevented], [['overworld', 'overworld'], true], 'and its key, O, the held map\'s');
  view.unmount();
});

test('ETHER-OW, the door, the host: the chart is handed the door where the view can rise, and the view is lifted once the chart is down - its slot empty - for that reason alone (lifted and run; mutants: the door unhanded, the view never lifted, lifted for every close)', () => {
  const src = lift('  function openEtherChart() {');
  const said = { enter: 0, slot: null, deps: null, allowed: { ok: true } };
  const env = {
    csaRuntime: null, cam: { yaw: 0 }, boatForward: () => [0, 0, 1], playerTravelPixel: () => ({ x: H.px, y: H.py }), etherHost: { chart: () => ({}) },
    createEtherChartOverlay: (deps) => { said.deps = deps; return { done: false }; }, townTalk: { showOverlay: (win, closed) => { said.slot = closed; } },
    travelView: { enter: () => { said.enter += 1; } }, travelViewAllowed: () => said.allowed,
  };
  const open = run(env, `${src}\nreturn openEtherChart;`);
  assert.equal(open(), true);
  assert.equal(said.deps.overworld(), true, 'the door handed where the view can rise');
  said.allowed = { ok: false };
  assert.equal(said.deps.overworld(), false, 'and not where it cannot (indoors, the classic lane, a body down)');
  said.deps.onClose('close');
  said.slot();
  assert.equal(said.enter, 0, 'a chart closed is a chart closed');
  open();
  said.deps.onClose('overworld');
  assert.equal(said.enter, 0, 'never while the chart still holds the slot');
  said.slot();
  assert.equal(said.enter, 1, 'the slot empty, the view rises');
});

test('ETHER-OW, the load: the governor\'s ground is the stream\'s own law - past the Veil the land it has not raised holds the clock as the Bay\'s does, and where the world streams nothing nothing is owed (the host\'s line, run over the real stream law; mutant: off the map is built)', () => {
  // PIN MOVED (OW-LEAD, test/systems/travel/ow_lead.test.js): the count's line hands the owed pixels on too (`uc.owed`)
  const line = /\n {6}uc\.n = unbuiltAround\(px, radius, (\(x, y\) => [^\n]*?)(?:, uc\.owed)?\);\n/.exec(W);
  assert.ok(line, 'the governor\'s ground');
  // PIN MOVED (LOAD-OWED, test/systems/travel/ow_loadowed.test.js): what is owed is what the STREAM holds and has not built - its own
  // books (`state.loaded`), which load nothing where the world streams nothing; so each place below is streamed (`init`)
  // as the host streams the traveller's grid, and the count asked there
  const built = new Set();
  const state = new StreamingWorldState(1);
  const isBuilt = new Function('StreamingWorldState', 'built', 'state', `return ${line[1]};`)(StreamingWorldState, built, state);
  const at = (x, y) => { state.init(x, y); return unbuiltAround({ x, y }, 1, isBuilt); };
  const was = StreamingWorldState.frames;
  try {
    StreamingWorldState.frames = [ES.etherFrame()];
    assert.equal(at(H.px, H.py), 9, 'Veilhaven\'s waters unraised: all nine owed');
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) built.add(`${H.px + dx},${H.py + dy}`);
    assert.equal(at(H.px, H.py), 0, 'raised: free');
    assert.equal(at(500, 250), 9, 'the Bay as ever');
    assert.equal(at(3000, 1500), 0, 'where the world streams nothing, nothing is owed');
    StreamingWorldState.frames = [];
    built.clear();
    assert.equal(at(H.px, H.py), 0, 'the sea switched off: nothing streams there');
  } finally {
    StreamingWorldState.frames = was;
  }
});

/** The isles' places as the host stands them: its templates (a town of 2 x 2 blocks, a one-block ruin), its clone lifted. */
const TOWN = { name: 'Template Town', mapTableData: { mapId: 4242, locationType: LOCATION_TYPES.TownHamlet }, exterior: { exteriorData: { width: 2, height: 2 } }, politic: 1, climate: null };
const RUIN = { name: 'Template Ruin', mapTableData: { mapId: 4343, locationType: LOCATION_TYPES.DungeonRuin }, exterior: { exteriorData: { width: 1, height: 1 } }, hasDungeon: true, dungeon: { blocks: [{}] }, politic: 1, climate: null };
function placesHost({ charted = [], found = [] } = {}) {
  const ledger = createCaptainLedger();
  for (const k of charted) ledger.chartIsle(k);
  const discovered = new Set(found);
  const env = {
    etherSea: true, inEther: ES.inEther, etherPlaceIsle, locationIndex: new Map(), captainLedger: ledger, hasDiscoveredLocationId: (id) => discovered.has(id),
    etherTemplateOf, _etherTemplates: { towns: [TOWN], havens: [TOWN], ruins: [RUIN] }, synthesizeEtherLocation, ETHER_REGION, REGION_NAMES, ETHER_REGION_NAME, getWorldClimateSettings,
    wildHallAt: () => false, wildActiveNow: () => null, wildHallStand: () => null, spawnedHallMapId: () => 0, maps,
    travelLocationSummaryAt: () => null, mapDict: new Map(), travelCheckDiscovered: () => false,
  };
  const body = `${lift('  function etherPlaceClone(isle) {')}
    ${liftLine('  const tvEtherPlace = ')}
    ${liftLine('  const tvEtherKnown = ')}
    ${lift('  const tvPlaceSummary = (px, py) => {', '\n  };\n')}
    return { tvPlaceSummary, tvEtherPlace };`;
  return { ...run(env, body), env, ledger, discovered };
}
const RUIN_ISLE = ES.islesNear(H.px, H.py, 40).find((i) => i.kind === 'ruin');
const WILD_ISLE = ES.islesNear(H.px, H.py, 60).find((i) => i.kind === 'wild');

test('ETHER-OW, the places: past the Veil an isle\'s place is its own summary - a port\'s town, a ruin\'s dungeon - known once its isle is charted or the place found, never a wild isle\'s nor a rock\'s, marked without being stood (lifted and run; mutants: the Bay\'s dictionary alone, known always, stood in the index)', () => {
  assert.ok(RUIN_ISLE && WILD_ISLE, 'a ruin and a wild isle about Veilhaven');
  const none = placesHost();
  assert.equal(none.tvPlaceSummary(H.px, H.py), null, 'uncharted, unfound: nothing to go to (DFU\'s own law, the sea\'s way)');
  const h = placesHost({ charted: [H.key, RUIN_ISLE.key, WILD_ISLE.key] });
  const port = h.tvPlaceSummary(H.px, H.py);
  assert.deepEqual([port.name, port.mapId, port.pixel, port.regionIndex, port.loc.ether, port.loc.etherKind], [H.name, etherPlaceId(H), { x: H.px, y: H.py }, ETHER_REGION, H.key, 'port']);
  assert.equal(port.locationIndex, port.loc.locationIndex);
  const ruin = h.tvPlaceSummary(RUIN_ISLE.px, RUIN_ISLE.py);
  assert.deepEqual([ruin.name, ruin.mapId, ruin.loc.etherKind], [RUIN_ISLE.name, etherPlaceId(RUIN_ISLE), 'ruin']);
  assert.equal(h.tvPlaceSummary(WILD_ISLE.px, WILD_ISLE.py), null, 'a wild isle stands no place');
  assert.equal(h.tvPlaceSummary(H.px + 1, H.py), null, 'an isle\'s other pixels none');
  // AUDIT ETHER-OW T-8: the place's own pixel on both axes - its column's others none
  assert.deepEqual([etherPlaceIsle(H.px, H.py + 1), etherPlaceIsle(H.px, H.py - 1), etherPlaceIsle(H.px - 1, H.py)], [null, null, null]);
  assert.equal(h.env.locationIndex.size, 0, 'marked, never stood: the build stands a place, the view never does');
  const stood = { ...port.loc, name: 'Stood' };
  h.env.locationIndex.set(`${H.px},${H.py}`, stood);
  assert.equal(h.tvPlaceSummary(H.px, H.py).loc, stood, 'the index\'s once its pixel has built');
  const found = placesHost({ found: [etherPlaceId(RUIN_ISLE)] });
  assert.equal(found.tvPlaceSummary(RUIN_ISLE.px, RUIN_ISLE.py)?.name, RUIN_ISLE.name, 'found (its door entered, or met on approach): known, charted or not');
  assert.deepEqual(PLACE_KINDS, ['port', 'ruin']);
  // AUDIT ETHER-OW T-12: a place's row is MAPS.BSA's shape in the isles' own region (the find's discovery reads its
  // region), its circle closed - a ruin exactly the reach away is within it
  const ring = etherPlaceRows({ x: RUIN_ISLE.px - 24, y: RUIN_ISLE.py }, 24, 'ruin');
  assert.deepEqual(ring.find((r) => r.isle === RUIN_ISLE), { x: RUIN_ISLE.px, y: RUIN_ISLE.py, isle: RUIN_ISLE, row: { mapID: etherPlaceId(RUIN_ISLE), regionIndex: ETHER_REGION } });
  assert.equal(etherPlaceRows({ x: RUIN_ISLE.px - 25, y: RUIN_ISLE.py }, 24, 'ruin').some((r) => r.isle === RUIN_ISLE), false, 'a pixel past it, not');
  assert.equal(etherPlaceIsle(H.px, H.py), H);
  assert.equal(etherPlaceIsle(WILD_ISLE.px, WILD_ISLE.py), null);
});

test('ETHER-OW, the far places and the dungeons: a charted port past the grid is a plate at the edge - a journey there - and a ruin within the far range is TV6\'s, a lair until charted or found, a far plate once known; the Bay\'s settlements never an isle\'s (lifted and run; mutants: the ports unread, the ruins unread)', () => {
  // a captain west of Veilhaven, where two ruins and two ports lie past the grid's three pixels and within the edge's circle
  const at = { x: H.px - 6, y: H.py };
  const within = (kind) => ES.islesNear(at.x, at.y, TV_FAR_RANGE).filter((i) => i.kind === kind && Math.hypot(i.px - at.x, i.py - at.y) <= TV_FAR_RANGE && Math.max(Math.abs(i.px - at.x), Math.abs(i.py - at.y)) > 3);
  const ruinFar = within('ruin'), portFar = within('port');
  assert.ok(ruinFar.length >= 2 && portFar.length >= 2, 'two ruins and two ports past the grid, within the range');
  const h = placesHost({ charted: [portFar[0].key, ruinFar[0].key] });
  const env = {
    ...h.env, tvPlaceSummary: h.tvPlaceSummary, tvEtherPlace: h.tvEtherPlace, playerTravelPixel: () => at, state: { terrainDistance: 3 }, discoveryGeneration: () => 0,
    farPlaces, settlementPixels, etherPlaceRows, TV_FAR_RANGE, tvPlaceRect: (s) => ({ cx: s.pixel.x, cz: s.pixel.y }),
    nearDungeons, dungeonRows, spawnedPixels, tvFiledSpawns: () => [], tvSpawnKnown: () => false, tvSpawnFound: () => false, tvSpawnGone: () => false,
    locationWorldRect: (l, x, y) => ({ minX: x, maxX: x + 1, minZ: y, maxZ: y + 1 }),
  };
  const body = `let tvFar = { at: null, near: -1, list: [] }, _tvSettlements = null, tvDng = { at: null, dg: -1, list: [] }, _tvDungeonRows = null, _locIndexGen = 0;
    const _tvListsReady = true;
    ${liftLine('  const tvKnownGen = ')}
    ${lift('  function travelViewFarPlaces() {')}
    ${lift('  const tvDungeonRowsAt = (at, range = TV_FAR_RANGE) => {', '\n  };\n')}
    ${liftLine('  const tvDungeonAt = ')}
    ${lift('  function travelViewDungeons() {')}
    return { travelViewFarPlaces, travelViewDungeons };`;
  const v = run(env, body);
  const far = v.travelViewFarPlaces();
  assert.deepEqual(far.map((f) => [f.key, f.summary.name]), [[`far:${etherPlaceId(portFar[0])}`, portFar[0].name]], 'the charted port at the edge - the uncharted one not, nor a ruin (TV6\'s)');
  const dng = v.travelViewDungeons();
  const known = dng.find((g) => g.key === `dng:${etherPlaceId(ruinFar[0])}`), lair = dng.find((g) => g.key === `dng:${etherPlaceId(ruinFar[1])}`);
  assert.ok(known?.found && known.summary?.name === ruinFar[0].name, 'the charted ruin: a far plate, a journey to its door');
  assert.ok(lair && !lair.found && !lair.summary, 'the uncharted one: a lair where it lies (TV6\'s "Discover on approach")');
  assert.equal(h.env.locationIndex.size, 0, 'neither stood');
  // the Bay's settlements are gathered once from the index - never an isle's place the index happened to hold
  const index = new Map([['10,20', { name: 'Ripwych', mapTableData: { locationType: LOCATION_TYPES.TownHamlet } }], [`${H.px},${H.py}`, { name: H.name, ether: H.key, mapTableData: { locationType: LOCATION_TYPES.TownHamlet } }]]);
  const gathered = run({ settlementPixels, locationIndex: index }, `return ${/_tvSettlements \?\?= (settlementPixels\(locationIndex\)\.filter\(\(t\) => !t\.loc\.ether\))/.exec(W)[1]};`);
  assert.deepEqual(gathered.map((s) => s.loc.name), ['Ripwych']);
});

test('ETHER-OW, the find and the models: past the Veil an uncharted ruin within a kilometre is found on approach - its row the isles\' region\'s, its place the isle\'s own - and stands as its model on the Overworld as the Bay\'s dungeons do (AUDIT ETHER-OW T-2: lifted and run; mutants: the find\'s rows the Bay\'s, its place the index\'s alone, the models\' the same, the row\'s region 0)', () => {
  const ruin = RUIN_ISLE;
  const h = placesHost();
  const env = {
    ...h.env, tvPlaceSummary: h.tvPlaceSummary, tvEtherPlace: h.tvEtherPlace, playerTravelPixel: () => ({ x: ruin.px - 2, y: ruin.py }), discoveryGeneration: () => 0,
    nearDungeons, dungeonRows, spawnedPixels, dungeonModelSet, etherPlaceRows, TV_FAR_RANGE, TV_FIND_REACH: 4, locationWorldRect: (l, x, y) => ({ minX: x, maxX: x + 1, minZ: y, maxZ: y + 1 }),
    tvFiledSpawns: () => [], tvSpawnKnown: () => false, tvSpawnFound: () => false, tvSpawnGone: () => false,
  };
  const v = run(env, `let tvFind = { at: null, dg: -1, n: -1, list: [] }, tvDngModels = { at: null, dg: -1, n: -1, list: [] }, _tvDungeonRows = null, _locIndexGen = 0;
    const host = { get tvDngModels() { return tvDngModels; }, set tvDngModels(v) { tvDngModels = v; }, get _locIndexGen() { return _locIndexGen; } };
    ${liftLine('  const tvKnownGen = ')}
    ${lift('  const tvDungeonRowsAt = (at, range = TV_FAR_RANGE) => {', '\n  };\n')}
    ${liftLine('  const tvDungeonAt = ')}
    ${lift('  function travelViewFindList() {')}
    ${lift('  function tvDungeonModelList() {')}
    return { travelViewFindList, tvDungeonModelList };`);
  const key = `dng:${etherPlaceId(ruin)}`;
  assert.deepEqual(v.travelViewFindList().filter((g) => g.key === key).map((g) => [g.loc.etherKind, g.loc.ether, g.row.regionIndex]), [['ruin', ruin.key, ETHER_REGION]], 'found on approach, in the isles\' region');
  assert.ok(v.tvDungeonModelList().some((g) => g.key === key && g.loc.etherKind === 'ruin'), 'and its model stands');
  assert.equal(h.env.locationIndex.size, 0, 'neither stood');
});

/** The bands' land and the raiders' sea, lifted - the host's own lines over the sea's ground. */
const bandOk = run({ onBayOrEther: ES.onBayOrEther, tvWater, _bandPlacePixels: new Set(['5,5']), etherPlaceIsle }, `${lift('  const bandOk = (x, z) => {', '\n  };\n')}\nreturn bandOk;`);
let seaFight = true;   // AUDIT ETHER-OW C2-3: past the Veil a raider is the sea fight's ship alone
const { tvRaidOpen, tvRaidSea } = run({ onBayOrEther: ES.onBayOrEther, inEther: ES.inEther, navalRaidersOn: () => seaFight, tvWater, maps, CLIMATES, RAID_NATIVE_PIXEL: NATIVE_PIXEL },
  `${lift('  const tvRaidOpen = (px, py) => {', '\n  };\n')}\n${lift('  const tvRaidSea = (x, z) => {', '\n  };\n')}\nreturn { tvRaidOpen, tvRaidSea };`);
const native = (px, py) => [(px + 0.5) * NATIVE_PIXEL, (499 - py + 0.5) * NATIVE_PIXEL];

test('ETHER-OW, the bands: an isle\'s land is a band\'s ground - its town\'s and its ruin\'s pixels never, nor the open sea, nor past the box - and the bands roam the isles about a captain as they roam the Bay (the host\'s own land test lifted; mutants: the Bay\'s map alone, an isle\'s place stood on)', () => {
  let land = null;
  for (const i of ES.islesNear(H.px, H.py, 30)) {
    for (let dy = -2; dy <= 2 && !land; dy++) for (let dx = -2; dx <= 2 && !land; dx++) {
      const x = i.px + dx, y = i.py + dy;
      if (ES.etherHeightByte(x, y) > WATER_BYTE && !etherPlaceIsle(x, y)) land = [x, y];
    }
    if (land) break;
  }
  assert.ok(land, 'an isle\'s land about Veilhaven');
  assert.equal(bandOk(...native(...land)), true, 'an isle\'s land');
  assert.equal(ES.etherHeightByte(H.px, H.py) > WATER_BYTE, true);
  assert.equal(bandOk(...native(H.px, H.py)), false, 'Veilhaven\'s own pixel - its town - never');
  const sea = [H.px - 5, H.py + 5];
  assert.equal(tvWater(...sea), true);
  assert.equal(bandOk(...native(...sea)), false, 'the open sea never');
  assert.equal(bandOk(...native(500, 250)), true, 'the Bay\'s land as ever');
  assert.equal(bandOk(...native(5, 5)), false, 'nor a place of the Bay\'s');
  assert.equal(bandOk(...native(ES.ETHER_BOX.x0 - 1, H.py)), false, 'past the box: no ground');
  // AUDIT ETHER-OW T-11: and for its ground, not its water - over the continent's land (TAMRIEL-GROUND), which the
  // water law reads as land west of the box and off the map, a band stands on neither
  const tamriel = ES.etherWoods({ isTamrielGround: true, getHeightMapValue: () => 60, getLargeMapData: () => [] });
  const landWater = run({ woods: tamriel, WATER_BYTE }, `${liftLine('  const tvWater = (px, py) =>')}\nreturn tvWater;`);
  const landOk = run({ onBayOrEther: ES.onBayOrEther, tvWater: landWater, _bandPlacePixels: new Set(), etherPlaceIsle }, `${lift('  const bandOk = (x, z) => {', '\n  };\n')}\nreturn bandOk;`);
  assert.deepEqual([landWater(-5, 250), landWater(ES.ETHER_BOX.x0 - 70, H.py)], [false, false], 'land there');
  assert.deepEqual([landOk(...native(-5, 250)), landOk(...native(ES.ETHER_BOX.x0 - 70, H.py)), landOk(...native(500, 250))], [false, false, true]);
  // the bands about a captain at Veilhaven, life by life: some there are, each on an isle's land
  let seen = 0;
  for (let life = 1000; life < 1040; life++) {
    for (const b of bandsNear({ at: { x: H.px, y: 499 - H.py }, ms: life * BAND_LIFE_MS, night: false, ok: bandOk })) {
      seen += 1;
      const px = Math.floor(b.born.x / NATIVE_PIXEL), py = 499 - Math.floor(b.born.z / NATIVE_PIXEL);
      assert.ok(ES.inEther(px, py) && !tvWater(px, py) && !etherPlaceIsle(px, py), `${b.id} born on an isle's land`);
    }
  }
  assert.ok(seen > 0, 'bands roam the isles');
});

test('ETHER-OW, the raiders: the Eltheric Ocean\'s open sea is the raiders\' - born there with every pixel about them water and the ocean\'s climate, sailing it, and never off the box (the host\'s own lines lifted; mutants: the Bay\'s map alone, the box\'s edge the sea)', () => {
  const at = { x: H.px - 40, y: H.py };
  let seen = 0;
  for (let life = 2000; life < 2010; life++) {
    const ms = life * RAIDER_LIFE_MS;
    for (const r of raidersNear({ at, ms, open: tvRaidOpen, sea: tvRaidSea })) {
      seen += 1;
      const px = Math.floor(r.born.x / NATIVE_PIXEL), py = 499 - Math.floor(r.born.z / NATIVE_PIXEL);
      assert.ok(ES.inEther(px, py) && maps.getClimateIndex(px, py) === CLIMATES.Ocean, `${r.id} born on the box's ocean`);
      for (let t = 0; t <= RAIDER_LIFE_MS; t += RAIDER_LEG_MS / 2) {
        const p = raiderAt(r, ms + t, tvRaidSea);
        assert.ok(tvRaidSea(p.x, p.z), `${r.id} on the water at ${t} ms`);
      }
    }
  }
  assert.ok(seen > 0, 'raiders sail the Eltheric Ocean');
  assert.equal(tvRaidOpen(H.px, H.py), false, 'never on an isle');
  // AUDIT ETHER-OW C2-3: the sea fight off, none past the Veil - the mod's raid boards the Bay's "Your Ship", a teleport
  // across the Veil; the Bay's as ever
  seaFight = false;
  let off = 0;
  for (let life = 2000; life < 2010; life++) off += raidersNear({ at, ms: life * RAIDER_LIFE_MS, open: tvRaidOpen, sea: tvRaidSea }).length;
  assert.equal(off, 0, 'no raider past the Veil with the sea fight off');
  assert.ok(raidersNear({ at: { x: 30, y: 30 }, ms: 2000 * RAIDER_LIFE_MS, open: (x, y) => x >= 0 && y >= 0 && x < 60 && y < 60, sea: () => true }).length > 0, 'the seeding itself unchanged');
  seaFight = true;
  // the box's west edge: past it no ground, so no water a raider may sail
  const edge = native(ES.ETHER_BOX.x0, H.py);
  assert.equal(tvRaidSea(edge[0], edge[1]), true, 'the box\'s last pixel of open sea');
  assert.equal(tvRaidSea(edge[0] - NATIVE_PIXEL, edge[1]), false, 'past it: nothing');
  assert.equal(tvRaidOpen(ES.ETHER_BOX.x0 - 2, H.py), false);
  // the Bay's own edge stands as AUDIT OW5b S5 left it - the strip past the west and south edges floored off the map
  // (AUDIT ETHER-OW T-13: over a world all water, so the floor alone refuses it)
  const wet = run({ onBayOrEther: ES.onBayOrEther, inEther: ES.inEther, navalRaidersOn: () => true, tvWater: () => true, maps, CLIMATES, RAID_NATIVE_PIXEL: NATIVE_PIXEL },
    `${lift('  const tvRaidSea = (x, z) => {', '\n  };\n')}\nreturn tvRaidSea;`);
  assert.deepEqual([wet(0, 250 * NATIVE_PIXEL), wet(5 * NATIVE_PIXEL, 0)], [true, true], 'the Bay\'s own edge water');
  assert.equal(wet(-1, 250 * NATIVE_PIXEL), false, 'a native unit west of the Bay');
  assert.equal(wet(5 * NATIVE_PIXEL, -1), false, 'a native unit south of it');
});

test('ETHER-OW, the word: a chase past the Veil is heard by the peers it is said to - a band\'s and a raider\'s place a pixel of the world (net/wire.js worldPixelOk), past the world\'s edge still dropped (mutant: the Bay\'s extent)', () => {
  const [x, z] = native(H.px - 3, H.py + 2).map(Math.round);
  assert.deepEqual(validBandWord([['b4030.2697.9', x, z, 1]]), [['b4030.2697.9', x, z, 1]]);
  assert.deepEqual(validRaiderWord([['r1338.-864.9', x, z, 1]]), [['r1338.-864.9', x, z, 1]]);
  assert.deepEqual(validRaiderWord([['r1338.-864.9', 9000 * NATIVE_PIXEL, z, 1]]), [], 'past the world');
  // AUDIT ETHER-OW T-3: the place a pixel of the world on both axes, by its own pixel floored, a whole native unit
  const P = NATIVE_PIXEL;
  assert.deepEqual(validBandWord([['b1.2.3', 5, (499 + 8192) * P, 1]]), [], 'north past the world (pixel row -8192)');
  assert.deepEqual(validBandWord([['b1.2.3', 5, -7693 * P, 1]]), [], 'south past it (pixel row 8192)');
  assert.deepEqual(validBandWord([['b1.2.3', 5, 2.5, 1]]), [], 'a whole native unit alone');
  assert.deepEqual(validBandWord([['b1.2.3', -8192 * P + 1, 5, 1]]), [], 'floored, not truncated: pixel -8192');
  const last = ['b1.2.3', -8191 * P, (499 + 8191) * P, 1];
  assert.deepEqual(validBandWord([last]), [last], 'the world\'s last pixel, its north-west');
});
