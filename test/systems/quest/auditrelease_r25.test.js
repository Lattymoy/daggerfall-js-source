// AUDIT RELEASE R2-5 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-5; the owner: "expand our world
// seamlessly. All systems should be integrated precisely") - A QUEST GIVER PAST THE BAY HAS REMOTE SITES TO GIVE: the
// quest layer's maps answer a province's region (62..70) from the places past the Bay (scenes/quest/questProvinceSites.js),
// so DFU's own draws (Place.SelectRemoteTownSite, SelectRemoteDungeonSite, SelectRemoteLocationExteriorSite) send a
// Skyrim questor's courier to another town of Skyrim and its dungeon to a lair of Skyrim. The law first, on a fixture;
// then, where ARENA2_PATH names the freeware, end to end over the world the build stands.
import '../../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createQuestProvinceSites, provinceRow, machineSites, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS, isImperialCitySlice } from '../../../src/scenes/quest/questProvinceSites.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { LOCATION_TYPES, MapsFile, longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CAPITALS, capitalPixel, setCapitalsStanding } from '../../../src/world/tamrielCapitals.js';
import { QUEST_REACH_TUNING } from '../../../src/systems/quest/questReach.js';

const SKYRIM = 64, CYRODIIL = 70;

/** A town past the Bay as the build stands it: its record, its blocks' names, its directory. */
function townAt({ name, mapId, px, py, regionIndex = SKYRIM, buildings = [], type = LOCATION_TYPES.TownCity }) {
  const ll = { x: px * 128, y: (499 - py) * 128 };
  return {
    loaded: true, name, regionIndex, regionName: REGION_NAMES[regionIndex], locationIndex: -(7000 + (mapId & 0xff)),
    mapTableData: { mapId, locationType: type, longitude: ll.x, latitude: ll.y },
    exterior: { buildings, exteriorData: { width: 1, height: 1, blockNames: ['T.RMB'], locationId: mapId & 0xffff } },
  };
}

/** The quest layer's provinces over a registry of `places` and the locations `standing` (by pixel). */
function provincesOver(places, standing, { lairs = [], origin = { x: 1700, y: -400 }, held = [], regionAt = (px) => (px > 1400 ? SKYRIM : CYRODIIL) } = {}) {
  const registry = createWorldPlaces();
  registry.register('tesa', places);
  const at = new Map(standing.map((l) => [`${longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude).x},${longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude).y}`, l]));
  let stood = 0;
  return {
    stood: () => stood,
    p: createQuestProvinceSites({
      worldPlaces: registry, regionAt,
      standAt: (px, py) => { stood++; return at.get(`${px},${py}`) ?? null; },
      lairsNear: (x, y, reach) => lairs.filter((l) => Math.max(Math.abs(l.px - x), Math.abs(l.py - y)) <= reach),
      origin: () => origin, heldSites: () => held,
    }),
  };
}

test('R2-5 a province\'s region is its places: the theatre\'s listed towns on the politic map\'s region and its lairs in reach, each DFU\'s MapTable row (its pixel read back), its name and map id looked up; a place is the one the build stands there, another place there none (mutants: the lairs\' reach; the region filter; the stood place\'s id unchecked)', () => {
  const whiterun = townAt({ name: 'Whiterun', mapId: 0xa7000001, px: 1700, py: -420 });
  const riften = townAt({ name: 'Riften', mapId: 0xa7000002, px: 1760, py: -380 });
  const bravil = townAt({ name: 'Bravil', mapId: 0xa7000003, px: 1300, py: 600, regionIndex: CYRODIIL });
  const lair = { ...townAt({ name: 'The Barrow of Ysgramor', mapId: 0xa8000005, px: 1690, py: -450, type: LOCATION_TYPES.DungeonRuin }), hasDungeon: true };
  lair.mapTableData.dungeonType = 9;
  const far = { mapId: 0xa8000006, name: 'Far Barrow', px: 1700 + PROVINCE_LAIR_REACH + 1, py: -400, type: LOCATION_TYPES.DungeonRuin, dungeonType: 9 };
  const rows = [
    { mapId: whiterun.mapTableData.mapId, name: 'Whiterun', px: 1700, py: -420, type: LOCATION_TYPES.TownCity, region: SKYRIM, area: -1 },
    { mapId: riften.mapTableData.mapId, name: 'Riften', px: 1760, py: -380, type: LOCATION_TYPES.TownCity },
    { mapId: bravil.mapTableData.mapId, name: 'Bravil', px: 1300, py: 600, type: LOCATION_TYPES.TownCity },
    { mapId: 0xa7000004, name: 'Jehanna Ford', px: 1705, py: -425, type: LOCATION_TYPES.TownVillage },   // in Skyrim's theatre, on High Rock's politic pixel
  ];
  const regionAt = (px, py) => (px === 1705 && py === -425 ? 62 : px > 1400 ? SKYRIM : CYRODIIL);
  const { p } = provincesOver(rows, [whiterun, riften, bravil, lair], { regionAt, lairs: [{ mapId: lair.mapTableData.mapId, name: lair.name, px: 1690, py: -450, type: LOCATION_TYPES.DungeonRuin, dungeonType: 9 }, far] });
  assert.equal(p.getRegion(17), null, 'a Bay region is MAPS.BSA\'s');
  const sky = p.getRegion(SKYRIM);
  // the registry's theatre for each row comes from its pixel; the fixture's region map reads every one past x 1400 as Skyrim
  assert.equal(sky.name, 'Skyrim');
  assert.deepEqual(sky.mapNames.filter((n) => n !== 'Bravil').sort(), ['Riften', 'The Barrow of Ysgramor', 'Whiterun'], 'its towns and the lair in reach - not the lair past it');
  assert.ok(!sky.mapNames.includes('Bravil'), 'a place of another theatre is that theatre\'s');
  assert.ok(!sky.mapNames.includes('Jehanna Ford'), 'a place the politic map reads as another region is that region\'s (its clone carries that region)');
  const i = sky.mapNameLookup.get('Whiterun');
  assert.deepEqual(sky.mapTable[i], provinceRow({ mapId: whiterun.mapTableData.mapId, name: 'Whiterun', px: 1700, py: -420, type: LOCATION_TYPES.TownCity }));
  assert.deepEqual(longitudeLatitudeToMapPixel(sky.mapTable[i].longitude, sky.mapTable[i].latitude), { x: 1700, y: -420 }, 'its pixel read back (NEARBY-QUESTS measures it)');
  assert.equal(sky.mapIdLookup.get(whiterun.mapTableData.mapId), i);
  assert.equal(p.getLocation(SKYRIM, i), whiterun, 'the place the build stands there');
  assert.equal(p.locationByName('Skyrim', 'The Barrow of Ysgramor'), lair);
  assert.equal(p.locationByName('Skyrim', 'Nowhere'), null);
  assert.equal(p.locationByName('Daggerfall', 'Whiterun'), null, 'a Bay region\'s name is MAPS.BSA\'s');
  assert.equal(p.locationIndexOf(SKYRIM, riften), sky.mapNameLookup.get('Riften'), 'where the player stands, its row');
  assert.equal(p.locationIndexOf(SKYRIM, { mapTableData: { mapId: 1 } }), -1);
  // the pixel stands another place now (the trace moved): no place - the draw's dart misses
  const moved = provincesOver(rows, [{ ...riften, mapTableData: { ...riften.mapTableData, mapId: 0xa7000099 } }]);
  assert.equal(moved.p.getLocation(SKYRIM, moved.p.getRegion(SKYRIM).mapNameLookup.get('Riften')), null);
});

test('R2-5 a name the table does not hold is found by the site that names it - its pixel (START3 worldPixel), the place standing there under that name and map id - so a lair drawn elsewhere resolves after a load and a relog; a site whose place is gone, or another\'s name, is none (mutants: the held sites unread; the name or id unchecked)', () => {
  const lair = { ...townAt({ name: 'Bleak Falls', mapId: 0xa8000007, px: 1900, py: -300, type: LOCATION_TYPES.DungeonLabyrinth }), hasDungeon: true };
  const held = [{ regionIndex: SKYRIM, locationName: 'Bleak Falls', mapId: lair.mapTableData.mapId, worldPixel: { x: 1900, y: -300 } }];
  const questor = { x: 1700, y: -400 };
  const { p } = provincesOver([], [lair], { held, origin: questor });
  assert.equal(p.getRegion(SKYRIM).mapNameLookup.has('Bleak Falls'), false, 'out of the questor\'s reach: not in the table');
  assert.equal(p.locationByName('Skyrim', 'Bleak Falls'), lair, 'found by its site');
  assert.equal(p.getRegion(SKYRIM).mapNameLookup.has('Bleak Falls'), true, 'and kept in the table');
  questor.x += 5;
  assert.equal(p.getRegion(SKYRIM).mapNameLookup.has('Bleak Falls'), true, 'and in the table made where the questor stands next');
  // the region's own lookup asks the held sites too (quest/place.js siteTown and fitSiteToBuild read it, not locationByName)
  const fresh = provincesOver([], [lair], { held }).p;
  const i = fresh.getRegion(SKYRIM).mapNameLookup.get('Bleak Falls');
  assert.equal(fresh.getLocation(SKYRIM, i), lair, 'the region\'s lookup finds the held site');
  const otherId = provincesOver([], [lair], { held: [{ ...held[0], mapId: 5 }] }).p;
  assert.equal(otherId.locationByName('Skyrim', 'Bleak Falls'), null, 'another place\'s id');
  assert.equal(otherId.getRegion(SKYRIM).mapNameLookup.has('Bleak Falls'), false, 'and not joined to the table');
  assert.equal(provincesOver([], [lair], { held: [{ ...held[0], locationName: 'Bleak' }] }).p.locationByName('Skyrim', 'Bleak'), null, 'another name');
  assert.equal(provincesOver([], [], { held }).p.locationByName('Skyrim', 'Bleak Falls'), null, 'nothing stands there');
  // the machine's quests' places are the held sites
  const sd = held[0];
  const machine = { quests: new Map([[1, { resources: new Map([['a', { isPlace: true, siteDetails: sd }], ['b', { isPerson: true }]]) }]]) };
  assert.deepEqual([...machineSites(machine)], [sd]);
  assert.deepEqual([...machineSites(null)], []);
});

test('R2-5 the Imperial City\'s slices are never a remote site (its own stream rebuilds them today; one city of 625 locations is one name to DFU\'s lookup) - a questor in it still draws another place of Cyrodiil; Solitude, one slice, is Skyrim\'s (mutants: the slices kept; every capital left out)', () => {
  setTamrielTrace(null); setTamrielFit(null); setCapitalsStanding(true);   // the authored shape and fit, as the suite runs
  const ic = capitalPixel(CAPITALS[0]), sol = capitalPixel(CAPITALS[1]);
  assert.equal(isImperialCitySlice(ic.px, ic.py), true);
  assert.equal(isImperialCitySlice(ic.px + 3, ic.py - 2), true, 'a slice off its centre');
  assert.equal(isImperialCitySlice(sol.px, sol.py), false);
  const bravil = townAt({ name: 'Bravil', mapId: 0xa7000003, px: ic.px + 60, py: ic.py + 20, regionIndex: CYRODIIL });
  const registry = createWorldPlaces();
  registry.register('tesa', [
    { mapId: 0xa9000001, name: 'Imperial City', px: ic.px, py: ic.py, type: LOCATION_TYPES.TownCity },
    { mapId: 0xa9000002, name: 'Temple District', px: ic.px - 3, py: ic.py + 2, type: LOCATION_TYPES.TownCity },
    { mapId: bravil.mapTableData.mapId, name: 'Bravil', px: ic.px + 60, py: ic.py + 20, type: LOCATION_TYPES.TownCity },
    { mapId: 0xa9000003, name: 'Solitude', px: sol.px, py: sol.py, type: LOCATION_TYPES.TownCity },
  ]);
  const p = createQuestProvinceSites({ worldPlaces: registry, regionAt: (x, y) => (y < 0 ? SKYRIM : CYRODIIL), standAt: () => bravil, origin: () => ({ x: ic.px, y: ic.py }) });
  assert.deepEqual(p.getRegion(CYRODIIL).mapNames, ['Bravil'], 'Cyrodiil\'s remote places: not the Imperial City\'s slices');
  assert.deepEqual(p.getRegion(SKYRIM).mapNames, ['Solitude']);
});

test('R2-5 the quest layer\'s maps answer a province\'s region from the provinces and every other from MAPS.BSA, unchanged: the Bay\'s region, location, classic record and name lookup as before (pinned), a province\'s none of MAPS.BSA\'s; the questor\'s own place is its row there (mutants: the province arm dropped; the Bay\'s handed to it)', () => {
  const maps = Object.create(MapsFile.prototype);
  const bayRegion = { name: 'Daggerfall', locationCount: 1, mapTable: [{ mapId: 9 }], mapNameLookup: new Map([['Daggerfall', 0]]) };
  const bayTown = { loaded: true, name: 'Daggerfall', mapTableData: { mapId: 9 } };
  maps.getRegion = (r) => (r === 17 ? bayRegion : null);
  maps.getLocation = (r, l) => (r === 17 && l === 0 ? bayTown : null);
  maps.readClassicLocation = (r, l) => (r === 17 ? { classic: l } : (() => { throw new Error('MAPS.BSA has no region ' + r); })());
  maps.getLocationByName = (rn, ln) => (rn === 'Daggerfall' && ln === 'Daggerfall' ? bayTown : null);
  const whiterun = townAt({ name: 'Whiterun', mapId: 0xa7000001, px: 1700, py: -420 });
  const registry = createWorldPlaces();
  registry.register('tesa', [{ mapId: whiterun.mapTableData.mapId, name: 'Whiterun', px: 1700, py: -420, type: LOCATION_TYPES.TownCity }]);
  let r = SKYRIM, here = whiterun;
  const provinceQuestPlaces = { worldPlaces: registry, regionAt: () => SKYRIM, standAt: (x, y) => (x === 1700 && y === -420 ? whiterun : null), lairsNear: () => [] };
  const { questWorld: qw } = createQuestWorld({ maps, provinceQuestPlaces, params: new URLSearchParams(), _questRegionIndex: () => r, _questLoc: () => here,
    playerTravelOrigin: () => ({ x: 1700, y: -420 }), placeByName: (rn, ln) => maps.getLocationByName(rn, ln) });
  assert.equal(qw.maps.getRegion(17), bayRegion, 'the Bay\'s region');
  assert.equal(qw.maps.getLocation(17, 0), bayTown, 'the Bay\'s location');
  assert.deepEqual(qw.maps.readClassicLocation(17, 3), { classic: 3 }, 'the Bay\'s classic record');
  assert.equal(qw.maps.getLocationByName('Daggerfall', 'Daggerfall'), bayTown, 'the Bay\'s name lookup');
  assert.equal(qw.maps.getRegion(SKYRIM).mapNames[0], 'Whiterun', 'a province\'s region: its places');
  assert.equal(qw.maps.getLocation(SKYRIM, 0), whiterun);
  assert.equal(qw.maps.readClassicLocation(SKYRIM, 0), null, 'no classic record past the Bay - the town mods took nothing there');
  assert.equal(qw.maps.getLocationByName('Skyrim', 'Whiterun'), whiterun, 'a province\'s place by name, never stood this session');
  assert.equal(qw.currentLocationIndex(), 0, 'the questor\'s own row');
  r = 17; here = { locationIndex: 4 };
  assert.equal(qw.currentLocationIndex(), 4, 'on the Bay its MAPS.BSA index');
  // no provinces handed in (the fixed bench): MAPS.BSA's alone, as before
  const bare = createQuestWorld({ maps, params: new URLSearchParams(), _questRegionIndex: () => SKYRIM, _questLoc: () => whiterun }).questWorld;
  assert.equal(bare.maps.getRegion(SKYRIM), null);
});

test('R2-5 the lairs are bounded: the table asks the places host for the nearest PROVINCE_LAIR_COUNT within PROVINCE_LAIR_REACH and at most PROVINCE_LAIR_ROLLS first rolls - the work a quest offer adds as one task (mutants: unbounded; another bound)', () => {
  const asked = [];
  const p = createQuestProvinceSites({ worldPlaces: createWorldPlaces(), regionAt: () => SKYRIM, standAt: () => null, origin: () => ({ x: 1700, y: -400 }),
    lairsNear: (...a) => { asked.push(a); return []; } });
  p.getRegion(SKYRIM);
  assert.deepEqual(asked, [[1700, -400, 66, 16, 40]]);
  assert.deepEqual([PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS], [66, 16, 40]);
  p.getRegion(SKYRIM);
  assert.equal(asked.length, 1, 'the same questor\'s pixel: the table kept');
});

// ─── WITH ARENA2: A QUESTOR IN EACH OF THREE PROVINCES, END TO END ─────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'WOODS.WLD', 'CLIMATE.PAK', 'POLITIC.PAK', 'FACTION.TXT', 'TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));

/** The givers: each a capital's hall (the Imperial City's district slice of its kind), its quest list's quest whose sites
 *  leave town, and a Daedra summoned in each province. */
const GIVERS = [
  ['Solitude', [1569, -430], 'Skyrim', [['Fighters Guild', 'M0B00Y07', 41], ['Mages Guild', 'N0B00Y06', 40], ['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Azura)', 'T0C00Y00', 0]]],
  ['Mournhold', [3293, 550], 'Morrowind', [['Fighters Guild', 'M0B00Y07', 41], ['Mages Guild', 'N0B00Y06', 40], ['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Hircine)', 'X0C00Y00', 0]]],
  ['Imperial City, Arena District', [2074, 658], 'Cyrodiil', [['Fighters Guild', 'M0B00Y07', 41]]],
  ['Imperial City, Arcane University', [2076, 664], 'Cyrodiil', [['Mages Guild', 'N0B00Y06', 40]]],
  ['Imperial City, Temple District', [2066, 660], 'Cyrodiil', [['temple', 'C0B00Y00', 0], ['social (commoner)', 'A0C00Y00', 0], ['Daedra (Azura)', 'T0C00Y00', 0]]],
];
/** The quests whose start puts a target at a site past the Bay (a foe at a lair, an item at an inn); the others place theirs
 *  in a later task (M0B00Y07 its bear, C0B00Y00 its ghosts at the house). */
const PLACED_AT_START = /^(N0B00Y06|T0C00Y00|X0C00Y00|A0C00Y00)$/;

test('R2-5 with ARENA2: a Fighters Guild, a Mages Guild, a temple, a social giver and a Daedra in Skyrim, Morrowind and Cyrodiil each offer work that leaves town - every remote site a place the build stands in the giver\'s province, found by its name, on the held map by its pixel, its target placed when the player arrives; the quest saved, the world forgotten and loaded again on the Bay, every site the same place; and a Bay giver\'s sites the Bay\'s as before (the table printed)', { skip: HAVE ? false : 'ARENA2_PATH not set (or a file missing) - the freeware end to end skipped', timeout: 900_000 }, async () => {
  const { standWorldPastBay, questLayerAt } = await import('./r25World.mjs');
  const { loadTables, questSource } = await import('../../qlSources.mjs');
  const { addQuestResourceObjects } = await import('../../../src/systems/quest/sceneMount.js');
  const { readQuestMarks } = await import('../../../src/ui/quest/questMarks.js');
  const { tamrielFrameInBay, inBay } = await import('../../../src/world/tamriel/tamrielFrame.js');
  loadTables();
  const world = await standWorldPastBay(ARENA2);
  const { standAt, lairsNear } = world.places.provinceQuestPlaces;
  // THE BOUND, BY COUNT: at a pixel no table read before, at most PROVINCE_LAIR_ROLLS first rolls (here every one of them,
  // the lairs asked for unbounded), the nearest PROVINCE_LAIR_COUNT where that many stand, and the same cells again cost none
  const many = lairsNear(2600, 300, PROVINCE_LAIR_REACH, Infinity, PROVINCE_LAIR_ROLLS);
  assert.equal(lairsNear.rolled, PROVINCE_LAIR_ROLLS, 'the rolls bounded');
  assert.ok(many.length > PROVINCE_LAIR_COUNT && many.length <= PROVINCE_LAIR_ROLLS, `${many.length} lairs of ${PROVINCE_LAIR_ROLLS} cells`);
  const near = lairsNear(2600, 300, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS);
  assert.equal(lairsNear.rolled, 0, 'the cells kept');
  assert.equal(near.length, PROVINCE_LAIR_COUNT, 'the nearest, counted');
  // every lair a table lists stands as itself - its pixel free of the places the build stands first (IC's outskirts' towns)
  for (const l of lairsNear(2069, 658, 24)) assert.equal(standAt(l.px, l.py)?.mapTableData.mapId, l.mapId, `${l.name} @ ${l.px},${l.py} stands as the lair`);
  QUEST_REACH_TUNING.override = true;   // NEARBY-QUESTS, as the game's default has it (systems/features.js 'nearby-quests')
  after(() => { QUEST_REACH_TUNING.override = null; });
  const table = [];
  const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
  const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  /** A quest offered at `pixel` by `giver`: parsed, started, each remote site checked; answers the quest and its layer. */
  const offer = async (where, pixel, province, giver, name, factionID) => {
    const location = standAt(pixel[0], pixel[1]);
    assert.ok(location?.loaded, `${where} stands`);
    const L = await questLayerAt(world, { pixel: { x: pixel[0], y: pixel[1] }, location });
    L.machine.setLastNPCClicked({ hash: 1, mapID: location.mapTableData.mapId, nameSeed: 7, buildingKey: 0, factionID, gender: 0 });
    const t0 = Date.now();
    const quest = quiet(() => L.machine.parseQuestForLists(questSource(name, true), factionID, { rolls: seeded(name.length * 31 + pixel[0]) }));
    const ms = Date.now() - t0;
    assert.ok(quest, `${where}: the ${giver}'s ${name} is offered (it parsed: work, not "no work")`);
    quiet(() => { L.machine.startQuestImmediate(quest); quest.update(); });   // its start-up task runs at its first update
    const r = REGION_NAMES.indexOf(province);
    const remote = [...quest.resources.values()].filter((x) => x.isPlace && x.scope === 'remote');
    assert.ok(remote.length, `${name}: a site that leaves town`);
    let placed = 0;
    for (const place of remote) {
      const sd = place.siteDetails;
      const at = `${where} ${name} ${place.symbol.name} -> ${sd.locationName}`;
      assert.equal(sd.regionIndex, r, `${at}: in ${province}`);
      assert.equal(sd.regionName, province);
      assert.ok(sd.worldPixel && !inBay(sd.worldPixel.x, sd.worldPixel.y), `${at}: its own pixel past the Bay (START3)`);
      assert.equal(world.maps.getRegionIndexAt(sd.worldPixel.x, sd.worldPixel.y), r, `${at}: the politic map's ${province}`);
      const stood = standAt(sd.worldPixel.x, sd.worldPixel.y);
      assert.ok(stood?.loaded && stood.name === sd.locationName && stood.mapTableData.mapId === sd.mapId, `${at}: the place the build stands on its pixel`);
      assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData.mapId, sd.mapId, `${at}: found by its name`);
      assert.equal(readQuestMarks(() => [{ px: sd.worldPixel.x, py: sd.worldPixel.y }], { width: 1000, height: 500 }, tamrielFrameInBay()).length, 1, `${at}: its mark on the held map`);
      if (sd.siteType === SITE_TYPES.Building) assert.ok(place.siteBuilding(L.questWorld), `${at}: its building stands in the town`);
      if (sd.siteType === SITE_TYPES.Dungeon) assert.equal(place.fitSiteToBuild(L.questWorld), false, `${at}: its markers the dungeon's as the build lays it`);
      // the player arrives: the machine's links at the site stand what the quest put there
      const stands = [];
      const adapter = { currentMapId: () => sd.mapId, findBehaviours: () => [], loadInProgress: () => false,
        standNPC: (o) => { stands.push(`npc ${o.person.symbol.name}`); return {}; }, standFoe: (o) => { stands.push(`foe ${o.foe.symbol.name}`); return {}; }, standItem: (o) => { stands.push(`item ${o.item.symbol.name}`); return {}; } };
      quiet(() => addQuestResourceObjects(L.machine, adapter, sd.siteType, sd.siteType === SITE_TYPES.Building ? sd.buildingKey : 0));
      placed += stands.length;
      table.push(`| ${giver} | ${province} (${where}) | ${name} | ${place.symbol.name}: ${sd.locationName} (${['', 'town', 'dungeon', 'building'][sd.siteType]}) @ ${sd.worldPixel.x},${sd.worldPixel.y} | yes | yes | ${stands.join(', ') || '- (later in the quest)'} | ${ms} ms |`);
    }
    return { quest, L, placed };
  };
  const kept = [];
  for (const [where, pixel, province, givers] of GIVERS) {
    for (const [giver, name, factionID] of givers) {
      const { quest, L, placed } = await offer(where, pixel, province, giver, name, factionID);
      if (PLACED_AT_START.test(name)) assert.ok(placed > 0, `${where} ${name}: a target placed on arrival`);
      if (name === 'T0C00Y00' || name === 'M0B00Y07') kept.push({ where, province, data: L.machine.getSaveData(), uid: quest.uid });
    }
  }
  // the lairs' work at a new questor's pixel, bounded
  lairsNear(2600, 200, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS);
  assert.ok(lairsNear.rolled <= PROVINCE_LAIR_ROLLS, `${lairsNear.rolled} first rolls`);
  // SAVE, RELOG: nothing stood any more, the player on the Bay (Daggerfall's pixel) - every site found again by its name
  const bay = world.maps.getLocationByName('Daggerfall', 'Daggerfall');
  const bayPixel = longitudeLatitudeToMapPixel(bay.mapTableData.longitude, bay.mapTableData.latitude);
  for (const { where, data, uid } of kept) {
    world.locationIndex.clear();
    const L = await questLayerAt(world, { pixel: bayPixel, location: bay });
    quiet(() => L.machine.restoreSaveData(structuredClone(data)));
    const q = L.machine.getQuest(uid);
    assert.ok(q, `${where}: the quest loaded`);
    for (const place of [...q.resources.values()].filter((x) => x.isPlace && x.scope === 'remote')) {
      const sd = place.siteDetails;
      // the region's name lookup first, as quest/place.js siteTown and fitSiteToBuild and questRepair.js's re-lay read it
      const idx = L.questWorld.maps.getRegion(sd.regionIndex).mapNameLookup.get(sd.locationName);
      assert.equal(L.questWorld.maps.getLocation(sd.regionIndex, idx)?.mapTableData.mapId, sd.mapId, `${where} ${sd.locationName}: its region's lookup finds it after the load, from the Bay`);
      assert.equal(L.questWorld.maps.getLocationByName(sd.regionName, sd.locationName)?.mapTableData.mapId, sd.mapId, `${where} ${sd.locationName}: found again after the load, from the Bay`);
      if (sd.siteType === SITE_TYPES.Dungeon) assert.equal(place.fitSiteToBuild(L.questWorld), false, `${sd.locationName}: the same dungeon`);
      if (sd.siteType === SITE_TYPES.Building) assert.ok(place.siteBuilding(L.questWorld), `${sd.locationName}: the same building`);
    }
  }
  // THE BAY UNCHANGED: a Fighters Guild in Daggerfall draws the Bay's own places (MAPS.BSA's region, no pixel of its own)
  const L = await questLayerAt(world, { pixel: bayPixel, location: bay });
  const quest = quiet(() => L.machine.parseQuestForLists(questSource('M0B00Y07', true), 41, { rolls: seeded(7) }));
  assert.ok(quest, 'the Bay\'s guild offers work');
  for (const place of [...quest.resources.values()].filter((x) => x.isPlace)) {
    assert.ok(place.siteDetails.regionIndex < 62 && !place.siteDetails.worldPixel, `${place.symbol.name}: ${place.siteDetails.locationName} the Bay's`);
    table.push(`| Fighters Guild | the Bay (Daggerfall) | M0B00Y07 | ${place.symbol.name}: ${place.siteDetails.locationName} (${place.siteDetails.regionName}) | yes | MAPS.BSA | - | - |`);
  }
  console.log(['| giver | province | quest | site | resolves | marker | placed on arrival | parse |', '|---|---|---|---|---|---|---|---|', ...table].join('\n'));
});
