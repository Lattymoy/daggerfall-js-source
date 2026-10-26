// AUDIT RELEASE R2-5 (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-5; the owner: "expand our world
// seamlessly. All systems should be integrated precisely") - A QUEST GIVER PAST THE BAY HAS REMOTE SITES TO GIVE: the
// quest layer's maps answer a province's region (62..70) from the places past the Bay (scenes/quest/questProvinceSites.js),
// so DFU's own draws (Place.SelectRemoteTownSite, SelectRemoteDungeonSite, SelectRemoteLocationExteriorSite) send a
// Skyrim questor's courier to another town of Skyrim and its dungeon to a lair of Skyrim. The law first, on a fixture;
// then, where ARENA2_PATH names the freeware, end to end over the world the build stands.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createQuestProvinceSites, provinceRow, machineSites, PROVINCE_LAIR_REACH, PROVINCE_LAIR_COUNT, PROVINCE_LAIR_ROLLS, isUnsitedSlice, PLAN_FILL_NAMES, capitalQuestNames, sliceQuestName, questView, capitalSlicesNear } from '../../../src/scenes/quest/questProvinceSites.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { LOCATION_TYPES, MapsFile, longitudeLatitudeToMapPixel } from '../../../src/formats/mapsFile.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { createProvinceWarm, WARM_PER_TICK } from '../../../src/scenes/quest/questProvinceWarm.js';
import { codeOnly } from '../../codeOnly.mjs';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CAPITALS, capitalPixel, capitalOnPixel, capitalSpanPixels, capitalSliceName, setCapitalsStanding } from '../../../src/world/tamrielCapitals.js';

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

test('R2-5b the Imperial City is a destination slice by slice: each of its 625 slices a quest name of its own (its district, and ", quarter N" by slice index where the district spans several), the same every time; every slice a row of Cyrodiil\'s table under it but the centre (no building stands there); the quest layer sees a slice\'s location under it; Solitude, one slice, its own name (mutants: the quarters unnumbered; the centre kept; every slice left out; the view unnamed)', () => {
  setTamrielTrace(null); setTamrielFit(null); setCapitalsStanding(true);   // the authored shape and fit, as the suite runs
  const ic = capitalPixel(CAPITALS[0]), sol = capitalPixel(CAPITALS[1]);
  const names = capitalQuestNames(0);
  assert.equal(names.size, 625);
  assert.equal(new Set(names.values()).size, 625, 'no two slices one name');
  assert.equal(names.get(312), 'Imperial City', 'the centre, one of its name, plain');
  const temple = [...names.entries()].filter(([, n]) => n.startsWith('Temple District, quarter '));
  assert.ok(temple.length > 1, 'a district over several slices numbered');
  assert.deepEqual(temple.map(([, n]) => Number(n.split(' ').pop())), temple.map((_, i) => i + 1), 'ranked by slice index');
  assert.equal(capitalQuestNames(0), names, 'kept');
  assert.equal(isUnsitedSlice(ic.px, ic.py), true, 'the centre');
  assert.equal(isUnsitedSlice(ic.px + 3, ic.py - 2), false, 'a district slice');
  assert.equal(isUnsitedSlice(sol.px, sol.py), false, 'a capital of one slice');
  // the plan's fills (its isle, lake and shore - imperialSliceName's last arm, read here so a rename there fails here)
  const fills = [...capitalSpanPixels(0)].filter(({ x, y }) => PLAN_FILL_NAMES.includes(capitalSliceName(CAPITALS[0], capitalOnPixel(x, y).s)));
  assert.equal(fills.length > 300 && fills.every(({ x, y }) => isUnsitedSlice(x, y)), true, `${fills.length} fill slices left out`);
  const IC_SRC = readFileSync(new URL('../../../src/world/imperialCity.js', import.meta.url), 'utf8');
  assert.match(IC_SRC, /for \(const d of \['City Isle', 'Lake Rumare', SHORE\]\)/);
  assert.match(IC_SRC, /const SHORE = 'Rumare Shore'/);
  assert.equal([...capitalSpanPixels(0)].filter(({ x, y }) => !isUnsitedSlice(x, y)).length, 257, 'the slices a site may stand in');
  assert.equal(sliceQuestName(sol.px, sol.py), null);
  const q = sliceQuestName(ic.px - 3, ic.py + 2);
  assert.ok(q && q === names.get(capitalOnPixel(ic.px - 3, ic.py + 2).s));
  const slice = { ...townAt({ name: capitalOnPixel(ic.px - 3, ic.py + 2).cap.name, mapId: 0xa9000002, px: ic.px - 3, py: ic.py + 2, regionIndex: CYRODIIL }), capital: { k: 0 } };
  slice.name = 'Temple District';
  const view = questView(slice);
  assert.equal(view.name, q, 'the quest layer reads the slice under its quest name');
  assert.equal(view.exterior, slice.exterior, 'its record the build\'s own');
  assert.equal(questView(slice), view, 'one view a location');
  assert.equal(questView(whiterunAt()), questView(whiterunAt()).valueOf(), 'any other location itself');
  const bravil = townAt({ name: 'Bravil', mapId: 0xa7000003, px: ic.px + 60, py: ic.py + 20, regionIndex: CYRODIIL });
  const registry = createWorldPlaces();
  registry.register('tesa', [
    { mapId: 0xa9000001, name: 'Imperial City', px: ic.px, py: ic.py, type: LOCATION_TYPES.TownCity },
    { mapId: 0xa9000002, name: 'Temple District', px: ic.px - 3, py: ic.py + 2, type: LOCATION_TYPES.TownCity },
    { mapId: bravil.mapTableData.mapId, name: 'Bravil', px: ic.px + 60, py: ic.py + 20, type: LOCATION_TYPES.TownCity },
    { mapId: 0xa9000003, name: 'Solitude', px: sol.px, py: sol.py, type: LOCATION_TYPES.TownCity },
  ]);
  const p = createQuestProvinceSites({ worldPlaces: registry, regionAt: (x, y) => (y < 0 ? SKYRIM : CYRODIIL), standAt: (x) => (x === ic.px - 3 ? slice : bravil), origin: () => ({ x: ic.px, y: ic.py }) });
  const cyr = p.getRegion(CYRODIIL);
  assert.deepEqual(cyr.mapNames, [q, 'Bravil'], 'Cyrodiil\'s remote places: the district slice under its quest name, not the centre');
  assert.equal(p.getLocation(CYRODIIL, 0).name, q, 'the slice as the draw reads it');
  assert.equal(p.locationByName('Cyrodiil', q).mapTableData.mapId, 0xa9000002, 'found again by its quest name');
  assert.equal(p.locationByName('Cyrodiil', 'Temple District'), null, 'the district\'s name alone names no slice');
  // a slice's site held by a quest, its row in no table: found by its pixel under its quest name
  const held = [{ regionIndex: CYRODIIL, locationName: q, mapId: 0xa9000002, worldPixel: { x: ic.px - 3, y: ic.py + 2 } }];
  const bare = createQuestProvinceSites({ worldPlaces: createWorldPlaces(), regionAt: () => CYRODIIL, standAt: (x) => (x === ic.px - 3 ? slice : null), heldSites: () => held });
  assert.equal(bare.locationByName('Cyrodiil', q)?.name, q, 'the held slice found under its quest name');
  assert.deepEqual(p.getRegion(SKYRIM).mapNames, ['Solitude']);
});
test('R2-5c a capital is one town: a slice\'s other slices, nearest first (a tie by slice index), the slices no site stands in left out, each under its quest name and stood only as the search reaches it; none for a capital of one slice or another place (mutants: the order; the own slice kept; the unsited kept)', () => {
  setTamrielTrace(null); setTamrielFit(null); setCapitalsStanding(true);
  const ic = capitalPixel(CAPITALS[0]);
  const stood = [];
  const standAt = (x, y) => { stood.push(`${x},${y}`); return { ...townAt({ name: capitalSliceName(CAPITALS[0], capitalOnPixel(x, y).s), mapId: 0xa9000000 + capitalOnPixel(x, y).s, px: x, py: y, regionIndex: CYRODIIL }), capital: { k: 0, s: capitalOnPixel(x, y).s } }; };
  const here = standAt(ic.px + 1, ic.py);
  stood.length = 0;
  const near = capitalSlicesNear(here, standAt);
  const first = [];
  for (const l of near) { first.push(l); if (first.length === 12) break; }
  assert.equal(stood.length, 12, 'stood only as far as it was read');
  const at = (l) => longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude);
  const d = (l) => Math.max(Math.abs(at(l).x - (ic.px + 1)), Math.abs(at(l).y - ic.py));
  const sOf = (l) => capitalOnPixel(at(l).x, at(l).y).s;
  for (let i = 1; i < first.length; i++) assert.ok(d(first[i - 1]) < d(first[i]) || (d(first[i - 1]) === d(first[i]) && sOf(first[i - 1]) < sOf(first[i])), 'nearest first, a tie by slice index');
  assert.ok(first.every((l) => !isUnsitedSlice(at(l).x, at(l).y)), 'none no site stands in (the centre beside it among them)');
  assert.ok(first.every((l) => !(at(l).x === ic.px + 1 && at(l).y === ic.py)), 'not its own slice');
  assert.ok(first.every((l) => l.name === capitalQuestNames(0).get(sOf(l))), 'each under its quest name');
  const sol = capitalPixel(CAPITALS[1]);
  assert.deepEqual([...capitalSlicesNear({ ...townAt({ name: 'Solitude', mapId: 1, px: sol.px, py: sol.py }), capital: { k: 1, s: 0 } }, standAt)], [], 'a capital of one slice');
  assert.deepEqual([...capitalSlicesNear(townAt({ name: 'Whiterun', mapId: 2, px: 1700, py: -420 }), standAt)], [], 'another place');
});
test('R2-5d a province\'s places made ready in idle time: each tick stands at most WARM_PER_TICK rows not stood before, nearest the questor first (a tie by row), until the table is stood; nothing on the Bay; its loop goes on while it stands something, waits after a tick that stood nothing, and ends when stopped or when another warmer starts (mutants: the count; the order; the Bay warmed; two loops)', () => {
  const rows = [5, 1, 9, 3, 7].map((x, i) => provinceRow({ mapId: 100 + i, name: `T${i}`, px: 1700 + x, py: -400, type: LOCATION_TYPES.TownCity }));
  const region = { mapTable: rows };
  let r = SKYRIM;
  const got = [];
  const provinces = { getRegion: () => region, getLocation: (q, i) => { got.push(rows[i].name); return {}; } };
  const w = createProvinceWarm({ provinces, regionNow: () => r, origin: () => ({ x: 1700, y: -400 }) });
  assert.equal(WARM_PER_TICK, 2);
  assert.equal(w.tick(), 2);
  assert.deepEqual(got, ['T1', 'T3'], 'nearest first');
  assert.equal(w.done(), false);
  assert.equal(w.tick(), 2);
  assert.equal(w.tick(), 1);
  assert.deepEqual(got, ['T1', 'T3', 'T0', 'T4', 'T2']);
  assert.equal(w.done(), true);
  assert.equal(w.tick(), 0, 'all stood: nothing more');
  r = 17;
  const bay = createProvinceWarm({ provinces, regionNow: () => r, origin: () => null });
  assert.equal(bay.tick(), 0, 'on the Bay nothing');
  // the loop: a tick in each idle period while it stands something; stopped, or another warmer started, it ends
  r = SKYRIM;
  const ticks = [];
  const fresh = () => createProvinceWarm({ provinces: { ...provinces, getLocation: () => ({}) }, regionNow: () => r, origin: () => null, schedule: (fn) => { ticks.push(fn); } });
  const loop = fresh();
  loop.start();
  assert.equal(ticks.length, 1);
  ticks.shift()();
  assert.equal(ticks.length, 1, 'it stood two: the next idle period');
  loop.stop();
  ticks.shift()();
  assert.equal(ticks.length, 0, 'stopped');
  const a = fresh(), b = fresh();
  a.start(); b.start();
  assert.equal(ticks.length, 2);
  ticks.shift()();
  assert.equal(ticks.length, 1, 'the first warmer\'s loop ended when the second started');
  // the quest layer starts one over its provinces, on the browser's idle door
  const QW = codeOnly(readFileSync(new URL('../../../src/scenes/questWorld.js', import.meta.url), 'utf8'));
  assert.match(QW, /createProvinceWarm\(\{ provinces, regionNow: \(\) => _questRegionIndex\(\), origin: \(\) => playerTravelOrigin\?\.\(\) \?\? null, schedule: provinces \? idleSchedule\(\) : null \}\)\.start\(\);/);
});
const whiterunAt = (() => { const w = townAt({ name: 'Whiterun', mapId: 0xa7000001, px: 1700, py: -420 }); return () => w; })();

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
