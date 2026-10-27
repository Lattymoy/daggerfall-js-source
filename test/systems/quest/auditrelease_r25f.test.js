// AUDIT RELEASE R2-5f (2026-10-26, bible/01-Overview/audits/Audit-Release-R2.md R2-5; bible/06-Systems/Quest-Arc.md
// "AUDIT RELEASE R2-5", R2-5f; the owner, holding the release for "proper fixes") - THE IMPERIAL CITY'S SLICES' SITES
// INDEX. A local site the centre cannot give is the city's (R2-5c), and a remote dart may land on any of its sited slices;
// each search stood a slice and walked its blocks to learn it held no building of the kind, and the walk made every one of
// the city's own cells afresh: 154-279 s for a Mages Guild at the centre. Now a slice's sites by kind (quest/place.js
// townSitesIndex - CollectQuestSitesOfBuildingType's walk and its law, each one home: townBuildings, buildingAdmits) are
// kept a slice (scenes/quest/questProvinceSites.js), read off the slice as the build lays it before it stands
// (scenes/tamrielPlacesHost.js capitalSliceAt), and a search stands only the slices whose index admits its kind
// (siteIndexGives, Place._dartIndexGives). QUEST-FABRIC (the owner, asked whether quests may land in BLD-3's buildings:
// "Let quests use them"): the city's own generated cells are read as every block is - BLD-3 stands buildings there, with
// Daggerfall's interiors and their quest markers - where R2-5f had read them as holding none - and read as a quest reads
// them (the quest world's `questBlock`, world/imperialFabricBuildings.js fabricQuestBlock: a cell's buildings, never its
// whole fabric, which made every cell afresh again). The law on fixtures here; with ARENA2_PATH, end to end at the centre
// in auditrelease_r25_freeware.test.js.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Place, townBuildings, buildingAdmits, buildingHasQuestMarker, townSitesIndex, indexAdmits, siteIndexGives, townBlockGrid, BT_ALL_VALID, BT_ANY_HOUSE, BT_ANY_SHOP } from '../../../src/systems/quest/place.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { makeBuildingKey } from '../../../src/systems/talk/talkTopics.js';
import { createQuestProvinceSites, capitalSlicesNear, provinceRow, sliceQuestName, isUnsitedSlice, questView } from '../../../src/scenes/quest/questProvinceSites.js';
import { createProvinceWarm } from '../../../src/scenes/quest/questProvinceWarm.js';
import { createQuestWorld } from '../../../src/scenes/questWorld.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { LOCATION_TYPES, MapsFile, longitudeLatitudeToMapPixel, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CAPITALS, capitalPixel, capitalOnPixel, capitalSliceName, setCapitalsStanding, dryKinds } from '../../../src/world/tamrielCapitals.js';
import { fabricCellBuildings, FABRIC_DONORS, _resetFabricInteriors } from '../../../src/world/imperialFabricBuildings.js';
import { FABRIC_DONOR_MARKED, FABRIC_SITE_SETS, FABRIC_SLICE_SETS } from '../../../src/world/imperialFabricSites.js';
import { IMPERIAL_SPAN, imperialCell, imperialCodeCell } from '../../../src/world/imperialCity.js';
import { imperialOwnName, imperialBlockOf } from '../../../src/world/imperialBlocks.js';

const SKYRIM = 64, CYRODIIL = 70;
const SPAWN = 11, ITEM = 18;   // Place.cs:36-38 - the editor flat archive's two quest records
/** An editor flat (archive 199) of `record` in a building's interior, or another archive's. */
const flat = (record, archive = 199) => ({ textureArchive: archive, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
/** A building's record as BlocksFile reads a block's FLD list (and a MAPS directory entry). */
const bld = (buildingType, factionId = 0) => ({ buildingType, factionId, nameSeed: 777, locationId: 0, sector: 0, quality: 9 });
/** A Daggerfall RMB block: its FLD list and each subrecord's interior, `[building, flats]` a building; `past` more records in
 *  the list than the block has subrecords (a 32-slot header's garbage, which DFU's walk never reads). */
const rmb = (entries, past = []) => ({ rmbBlock: {
  fldHeader: { buildingDataList: [...entries.map(([b]) => b), ...past], otherNames: null },
  subRecords: entries.map(([, flats]) => ({ interior: { blockFlatObjectRecords: flats } })),
} });
/** A town of `blockNames` (a row of blocks), its MAPS directory `directory`. */
const townOf = (name, blockNames, { directory = [], regionIndex = 17, mapId = 1, px = 100, py = 100, capital = null } = {}) => {
  const ll = mapPixelToLongitudeLatitude(px, py);
  return {
    loaded: true, name, regionIndex, regionName: REGION_NAMES[regionIndex], locationIndex: mapId & 0xff,
    mapTableData: { mapId, locationType: LOCATION_TYPES.TownCity, longitude: ll.x, latitude: ll.y },
    exterior: { buildings: directory, exteriorData: { width: blockNames.length, height: 1, blockNames, locationId: mapId & 0xffff } },
    ...(capital ? { capital } : {}),
  };
};
/** The quest layer's world over `blocks` (BlocksFile's getBlockByName), MapsFile's own block-name read. */
const worldOver = (blocks, extra = {}) => ({
  maps: { getRmbBlockName: (loc, x, y) => MapsFile.prototype.getRmbBlockName.call({}, loc, x, y) },
  getBlock: (name) => blocks[name] ?? null, isHouseOwned: () => false, buildingNameOpts: () => ({}), ...extra,
});
/** A Place of Quests-Places' `p2`/`p3`, as its row would set it. */
const placeOf = (p2, p3, symbol = '_site_') => { const p = new Place(null); p.symbol = new QuestSymbol(symbol); p.p1 = 0; p.p2 = p2; p.p3 = p3; return p; };

test('R2-5f a building answers a search by CollectQuestSitesOfBuildingType\'s own test, one home (buildingAdmits): a kind its own alone; the wildcards Place.cs\'s three sets; a guild hall or a temple of the asked faction, any where the row names none, no other kind held to a faction; never the Dark Brotherhood\'s or the Thieves Guild\'s (mutants: each wildcard\'s set; the kind unchecked; the faction dropped, held everywhere, or its any; the Brotherhood; the Guild)', () => {
  const TYPES = Array.from({ length: 25 }, (_, t) => t);   // DFLocation.BuildingTypes, Alchemist (0) to Ship (24)
  const admitted = (kind, faction = 0) => TYPES.filter((t) => buildingAdmits({ buildingType: t, factionId: 0 }, kind, faction));
  // Place.cs:621-623, the literals
  assert.deepEqual(admitted(BT_ALL_VALID), [0, 2, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 17, 18, 19, 20], 'all valid');
  assert.deepEqual(admitted(BT_ANY_HOUSE), [17, 18, 19, 20], 'any house');
  assert.deepEqual(admitted(BT_ANY_SHOP), [0, 2, 5, 6, 7, 8, 9, 12, 13], 'any shop (no bank, no library)');
  for (const t of TYPES) assert.deepEqual(admitted(t), [t], `a kind its own alone (${t})`);
  // the hall's and the temple's faction (p3): the asked one, any where the row names none
  assert.equal(buildingAdmits(bld(11, 40), 11, 40), true, 'the Mages Guild\'s hall for magery');
  assert.equal(buildingAdmits(bld(11, 41), 11, 40), false, 'the Fighters Guild\'s hall is not magery\'s');
  assert.equal(buildingAdmits(bld(11, 41), 11, 0), true, 'any hall for a row that names no faction');
  assert.equal(buildingAdmits(bld(14, 82), 14, 84), false, 'another god\'s temple (STAR8 S4)');
  assert.equal(buildingAdmits(bld(14, 82), 14, 0), true, 'any temple');
  assert.equal(buildingAdmits(bld(11, 41), BT_ALL_VALID, 0), true, 'a hall to random');
  assert.equal(buildingAdmits(bld(15, 41), 15, 40), true, 'a tavern is held to no faction: p3 reads a hall\'s or a temple\'s alone');
  assert.equal(buildingAdmits(bld(9, 41), BT_ANY_SHOP, 2), true, 'nor a shop (the shop row\'s p3 is 2)');
  // never the Dark Brotherhood's (108) or the Thieves Guild's (42), even asked by their own faction
  for (const f of [108, 42]) {
    assert.equal(buildingAdmits(bld(15, f), 15, 0), false, `a tavern of faction ${f}`);
    assert.equal(buildingAdmits(bld(11, f), 11, f), false, `a hall of faction ${f}, asked by ${f}`);
    assert.equal(buildingAdmits(bld(17, f), BT_ANY_HOUSE, 1), false, `a house of faction ${f}`);
  }
  assert.equal(indexAdmits([bld(15, 108), bld(15, 0)], 15, 0), true, 'an index admits where any of it does');
  assert.equal(indexAdmits([bld(15, 108)], 15, 0), false);
  assert.equal(indexAdmits(null, 15, 0), false, 'no index admits nothing');
});

test('R2-5f a town\'s sites index: every building of its blocks a search could ever take - one with a quest marker (a spawn or an item of the editor\'s flat archive) - as its type, its faction as the walk merges it and its key, in the walk\'s order, frozen; a markerless building, another archive\'s record, a start marker and a record past the block\'s subrecords left out; the walk itself every subrecord of every block, a block read for none of a capital\'s own cells (mutants: the spawn; the item; the archive; the markerless kept; the faction; the subrecords\' count; the cells read; the cells skipped in any town)', () => {
  const blocks = {
    'MARKS0.RMB': rmb([
      [bld(15), [flat(SPAWN)]],                  // 0 a tavern - a spawn marker
      [bld(18), []],                             // 1 a House2 - none
      [bld(11), [flat(ITEM)]],                   // 2 a guild hall - an item marker; its faction the directory's (the merge)
      [bld(9), [flat(SPAWN, 200)]],              // 3 a general store - another archive's record 11
      [bld(17), [flat(10)]],                     // 4 a House1 - the editor's start marker, no quest marker
      [bld(0), [flat(ITEM), flat(SPAWN)]],       // 5 an alchemist - both
    ], [bld(15)]),                               //   and a seventh record past the six subrecords
    'MARKS1.RMB': rmb([[bld(14), [flat(SPAWN)]]]),
  };
  const town = townOf('Marksby', ['MARKS0.RMB', 'MARKS1.RMB'], { directory: [bld(11, 40)] });
  const world = worldOver(blocks);
  assert.deepEqual([...townBuildings(town, townBlockGrid(world, town))].map(({ i, b, summary, buildingKey }) => [b.x, i, summary.buildingType, buildingKey]),
    [[0, 0, 15, makeBuildingKey(0, 0, 0)], [0, 1, 18, makeBuildingKey(0, 0, 1)], [0, 2, 11, makeBuildingKey(0, 0, 2)], [0, 3, 9, makeBuildingKey(0, 0, 3)],
      [0, 4, 17, makeBuildingKey(0, 0, 4)], [0, 5, 0, makeBuildingKey(0, 0, 5)], [1, 0, 14, makeBuildingKey(1, 0, 0)]], 'every subrecord of every block, none past them');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => buildingHasQuestMarker(blocks['MARKS0.RMB'], i)), [true, false, true, false, false, true]);
  assert.equal(buildingHasQuestMarker(null, 0), false, 'no block, no marker');
  const index = townSitesIndex(world, town);
  assert.deepEqual(index, [
    { buildingType: 15, factionId: 0, buildingKey: makeBuildingKey(0, 0, 0) },
    { buildingType: 11, factionId: 40, buildingKey: makeBuildingKey(0, 0, 2) },
    { buildingType: 0, factionId: 0, buildingKey: makeBuildingKey(0, 0, 5) },
    { buildingType: 14, factionId: 0, buildingKey: makeBuildingKey(1, 0, 0) },
  ]);
  assert.ok(Object.isFrozen(index) && index.every((s) => Object.isFrozen(s)), 'frozen: the law no quest or owner changes');
  assert.deepEqual(townSitesIndex(world, { loaded: true, exterior: {} }), [], 'no layout, no sites');
  // A CAPITAL'S OWN GENERATED CELL is read as any block is - PIN MOVED (QUEST-FABRIC): BLD-3 stands buildings there, and a
  // world that still names such a block (R2-5f's `noBuildingBlock`) is not asked
  const own = imperialOwnName(10, 10);
  const asked = [];
  const read = { ...blocks, [own]: rmb([[bld(15), [flat(SPAWN)]]]) };
  const w = worldOver(read, { getBlock: (name) => { asked.push(name); return read[name] ?? null; }, noBuildingBlock: (name) => name === own });
  const slice = townOf('Slice', [own, 'MARKS1.RMB'], { capital: { k: 0, s: 1 } });
  assert.deepEqual(townBlockGrid(w, slice).map((b) => !!b.dfBlock), [true, true], 'the capital\'s own cell: its block');
  assert.deepEqual(asked, [own, 'MARKS1.RMB'], 'made and read');
  assert.deepEqual(townSitesIndex(w, slice).map((s) => s.buildingType), [15, 14], 'its fabric building a site');
  asked.length = 0;
  assert.deepEqual(townSitesIndex(w, townOf('Elsewhere', [own, 'MARKS1.RMB'])).map((s) => s.buildingType), [15, 14], 'a town that is no capital reads its every block');
  assert.deepEqual(asked, [own, 'MARKS1.RMB']);
  asked.length = 0;
  // QUEST-FABRIC: a world that reads a block as a quest does (`questBlock`) is asked first, its block the walk's; the rest
  // are made
  const viewed = [];
  const wv = { ...w, questBlock: (name) => { viewed.push(name); return name === own ? read[own] : null; } };
  assert.deepEqual(townBlockGrid(wv, slice).map((b) => b.dfBlock), [read[own], read['MARKS1.RMB']]);
  assert.deepEqual([viewed, asked], [[own, 'MARKS1.RMB'], ['MARKS1.RMB']], 'the own cell viewed, never made');
  asked.length = 0;
  assert.deepEqual(townBlockGrid(worldOver(read, { getBlock: w.getBlock }), slice).map((b) => !!b.dfBlock), [true, true], 'a world that names no such block reads them all');
});

test('R2-5f a sites index gives a local search exactly where SetupLocalSite\'s search finds a site, and a dart exactly where its walk lands - every town row of Quests-Places over five towns: the wildcards, a kind, a hall\'s faction, a house kind\'s fallback to any house (House1 to House6, none past them), a dart after DFU\'s house fallback (mutants: siteIndexGives\' three wildcards, its fallback and its range; _dartIndexGives\' any house, random, house and the hall\'s faction)', () => {
  const S = [flat(SPAWN)], I = [flat(ITEM)], N = [];
  const TOWNS = [
    ['Fullburg', [[bld(15), S], [bld(17), S], [bld(11, 40), S], [bld(15, 108), S], [bld(9), I], [bld(18), N], [bld(11, 99), S], [bld(11, 42), S], [bld(14), S], [bld(16), I]]],
    ['Housetown', [[bld(19), S], [bld(18), N], [bld(22), N]]],
    ['Shoptown', [[bld(0), I], [bld(3), S], [bld(10), S], [bld(11, 41), S]]],
    ['Bare', [[bld(15), N], [bld(17), N]]],
    ['Dark', [[bld(11, 108), S], [bld(15, 42), S]]],
  ];
  const blocks = Object.fromEntries(TOWNS.map(([name, entries]) => [`${name}.RMB`, rmb(entries)]));
  // each town's MAPS directory lists its every building, so a dart's directory pre-check passes wherever its blocks hold the kind
  const towns = TOWNS.map(([name, entries], i) => townOf(name, [`${name}.RMB`], { directory: entries.map(([b]) => b), mapId: 10 + i }));
  const world = worldOver(blocks, { maps: { getRmbBlockName: worldOver({}).maps.getRmbBlockName, getLocation: (r, i) => towns[i] ?? null } });
  // Quests-Places' town rows (p1 0): random, house, shop, each building type, the guild halls by faction - and a faction no row names
  const ROWS = [[-1, 0], [-1, 1], [-1, 2], ...Array.from({ length: 24 }, (_, t) => (t === 11 ? [[11, 0], [11, 40], [11, 41], [11, 99]] : [[t, 0]])).flat()];
  const gives = new Map();
  towns.forEach((town, ti) => {
    const index = townSitesIndex(world, town);
    for (const [p2, p3] of ROWS) {
      const found = placeOf(p2, p3)._searchTownSites(world, town, p2, p3).found.length > 0;
      assert.equal(siteIndexGives(index, p2, p3), found, `${town.name} ${p2}/${p3}: the index gives the local search where it finds a site`);
      gives.set(`${town.name} ${p2}/${p3}`, found);
      const dart = placeOf(p2, p3);
      assert.equal(dart._dartIndexGives(index, p2), dart._tryTownLocation(world, 0, ti, p2), `${town.name} ${p2}/${p3}: the index gives a dart where it lands`);
    }
    // a dart after the 250th (SelectRemoteTownSite's house fallback): p2 -1, any house
    const fallen = placeOf(-1, 0);
    assert.equal(fallen._dartIndexGives(index, BT_ANY_HOUSE), fallen._tryTownLocation(world, 0, ti, BT_ANY_HOUSE), `${town.name}: a fallen dart's any house`);
  });
  // the outcomes the sweep covered, both ways
  assert.equal(gives.get('Housetown 18/0'), true, 'a House2 asked of a town whose House2 has no marker: any house');
  assert.equal(placeOf(18, 0)._searchTownSites(world, towns[1], 18, 0).houseFallback, true, '(the search\'s own fallback)');
  assert.equal(gives.get('Housetown 21/0'), true, 'House5: within the fallback\'s range');
  assert.equal(gives.get('Housetown 23/0'), false, 'House7: past it');
  assert.deepEqual([gives.get('Shoptown -1/0'), gives.get('Shoptown -1/1'), gives.get('Shoptown -1/2')], [true, false, true], 'a town of shops: random and shop, no house');
  assert.deepEqual([gives.get('Housetown -1/0'), gives.get('Housetown -1/1'), gives.get('Housetown -1/2')], [true, true, false], 'a town of houses: random and house, no shop');
  assert.deepEqual([gives.get('Fullburg 11/40'), gives.get('Fullburg 11/41'), gives.get('Shoptown 11/40'), gives.get('Shoptown 11/41')], [true, false, false, true], 'a hall by its faction');
  assert.ok(ROWS.every(([p2, p3]) => !gives.get(`Bare ${p2}/${p3}`) && !gives.get(`Dark ${p2}/${p3}`)), 'markerless, or the Brotherhood\'s and the Guild\'s: nothing');
  assert.ok([...gives.values()].filter(Boolean).length >= 25, 'the sweep found sites');
});

/** The Imperial City's slices, standing as the fixtures below lay them. */
function icFixture() {
  setTamrielTrace(null); setTamrielFit(null); setCapitalsStanding(true);   // the authored shape and fit, as the suite runs
  const ic = capitalPixel(CAPITALS[0]);
  /** A slice of the city on (x, y) whose one block is `blockName` (its own cell's by default), its directory `directory`. */
  const slice = (x, y, blockName = imperialOwnName(x & 31, y & 31), directory = []) => {
    const s = capitalOnPixel(x, y).s;
    return { ...townOf(capitalSliceName(CAPITALS[0], s), [blockName], { directory, regionIndex: CYRODIIL, mapId: 0xa9000000 + s, px: x, py: y, capital: { k: 0, s } }), locationIndex: -(9000 + s) };
  };
  const pixelOf = (l) => { const p = longitudeLatitudeToMapPixel(l.mapTableData.longitude, l.mapTableData.latitude); return `${p.x},${p.y}`; };
  return { ic, slice, pixelOf };
}

test('R2-5f a capital\'s other slices, nearest first, pass over unstood every slice whose index does not admit the search: the slices it stands are the ones it picks, counted, in the order they had; the admit asked of each slice\'s own index; without an admit every slice read is stood and counted, as before (mutants: the admit unread; the picks uncounted)', () => {
  const { ic, slice, pixelOf } = icFixture();
  const here = slice(ic.px + 1, ic.py);
  const every = [...capitalSlicesNear(here, (x, y) => slice(x, y))].map(pixelOf);
  assert.equal(every.length, 256, 'the city\'s sited slices but its own');
  const yes = Object.freeze([{ buildingType: 15, factionId: 0, buildingKey: 1 }]), no = Object.freeze([]);
  const indexAt = (x, y) => ((x * 7 + y) % 5 === 0 ? yes : no);
  const asked = [], stood = [], count = { picked: 0 };
  const near = capitalSlicesNear(here, (x, y) => { stood.push(`${x},${y}`); return slice(x, y); }, (ix) => { asked.push(ix); return ix.length > 0; }, indexAt, count);
  const got = [];
  for (const l of near) { got.push(pixelOf(l)); if (got.length === 6) break; }
  const want = every.filter((k) => { const [x, y] = k.split(',').map(Number); return indexAt(x, y) === yes; }).slice(0, 6);
  assert.deepEqual(got, want, 'the admitted slices, in the order they had');
  assert.deepEqual(stood, want, 'stood: the slices picked, no more');
  assert.equal(count.picked, 6, 'and counted');
  assert.ok(asked.length > 6 && asked.every((ix) => ix === yes || ix === no), 'the admit asked of each slice\'s own index, the refused among them');
  // no admit (R2-5c's walk): every slice read stood and counted
  const plain = { picked: 0 };
  stood.length = 0;
  let n = 0;
  for (const l of capitalSlicesNear(here, (x, y) => { stood.push(`${x},${y}`); return slice(x, y); }, null, indexAt, plain)) { void l; if (++n === 4) break; }
  assert.deepEqual(stood, every.slice(0, 4));
  assert.equal(plain.picked, 4);
});

test('R2-5f the quest layer\'s provinces keep a capital slice\'s index once a slice - read off the slice as the build lays it (sliceAt), under its quest name, none where no slice stands; a dart\'s row refused only where it is a slice whose kept index refuses the dart, nothing stood; the city\'s slices near a questor admitted by the kept index and the picks counted (mutants: the index not kept; every row refused; the refusal inverted; the index or the count not handed on)', () => {
  const { ic, slice } = icFixture();
  const A = { x: ic.px - 3, y: ic.py + 2 }, B = { x: ic.px + 4, y: ic.py - 1 };
  assert.ok(!isUnsitedSlice(A.x, A.y) && !isUnsitedSlice(B.x, B.y), 'two slices a site may stand in');
  const at = (p) => `${p.x},${p.y}`;
  const locs = new Map([[at(A), slice(A.x, A.y)], [at(B), slice(B.x, B.y)]]);
  const bravil = townOf('Bravil', ['B.RMB'], { regionIndex: CYRODIIL, mapId: 0xa7000003, px: ic.px + 60, py: ic.py + 20 });
  locs.set(`${ic.px + 60},${ic.py + 20}`, bravil);
  const registry = createWorldPlaces();
  registry.register('tesa', [
    { mapId: locs.get(at(A)).mapTableData.mapId, name: 'Temple District', px: A.x, py: A.y, type: LOCATION_TYPES.TownCity },
    { mapId: locs.get(at(B)).mapTableData.mapId, name: 'Arena District', px: B.x, py: B.y, type: LOCATION_TYPES.TownCity },
    { mapId: bravil.mapTableData.mapId, name: 'Bravil', px: ic.px + 60, py: ic.py + 20, type: LOCATION_TYPES.TownCity },
  ]);
  const tavern = Object.freeze([Object.freeze({ buildingType: 15, factionId: 0, buildingKey: 7 })]);
  const sliceAsked = [], indexAsked = [], stood = [];
  const p = createQuestProvinceSites({ worldPlaces: registry, regionAt: () => CYRODIIL, origin: () => ({ x: ic.px, y: ic.py }),
    standAt: (x, y) => { stood.push(`${x},${y}`); return locs.get(`${x},${y}`) ?? (capitalOnPixel(x, y) ? slice(x, y) : null); },
    sliceAt: (x, y) => { sliceAsked.push(`${x},${y}`); return capitalOnPixel(x, y) ? (locs.get(`${x},${y}`) ?? slice(x, y)) : null; },
    sitesIndexOf: (loc) => { indexAsked.push(loc.name); return loc.mapTableData.mapId === locs.get(at(B)).mapTableData.mapId ? tavern : Object.freeze([]); } });
  // kept once a slice, read off the slice as the build lays it, under its quest name
  const ixA = p.sliceIndexAt(A.x, A.y);
  assert.equal(p.sliceIndexAt(A.x, A.y), ixA, 'kept');
  assert.deepEqual(sliceAsked, [at(A)], 'the slice laid out once');
  assert.deepEqual(indexAsked, [sliceQuestName(A.x, A.y)], 'its sites read once, under its quest name (questView)');
  assert.deepEqual(p.sliceIndexAt(ic.px + 61, ic.py + 20), [], 'no slice there: no sites');
  assert.equal(indexAsked.length, 1, '(and no walk)');
  // a dart's row refused before it stands: a slice whose index refuses it; never a town, never the Bay
  const cyr = p.getRegion(CYRODIIL);
  const iA = cyr.mapNameLookup.get(sliceQuestName(A.x, A.y)), iB = cyr.mapNameLookup.get(sliceQuestName(B.x, B.y)), iBravil = cyr.mapNameLookup.get('Bravil');
  assert.ok(iA >= 0 && iB >= 0 && iBravil >= 0);
  const seen = [];
  const kind = (ix) => { seen.push(ix); return ix.length > 0; };
  assert.equal(p.siteIndexRefuses(CYRODIIL, iA, kind), true, 'a slice with none of the kind: refused');
  assert.equal(p.siteIndexRefuses(CYRODIIL, iB, kind), false, 'a slice with one: not');
  assert.deepEqual(seen, [ixA, p.sliceIndexAt(B.x, B.y)], 'each asked of the kept index');
  assert.equal(p.siteIndexRefuses(CYRODIIL, iBravil, () => false), false, 'a town is its own walk\'s to refuse');
  assert.ok(!sliceAsked.includes(`${ic.px + 60},${ic.py + 20}`), 'no index read for a town\'s row');
  assert.equal(p.siteIndexRefuses(17, 0, () => false), false, 'the Bay\'s rows are MAPS.BSA\'s');
  assert.deepEqual(stood, [], 'nothing stood to refuse a dart');
  // the city's slices near a questor: through the kept index, the picks counted
  const centre = slice(ic.px, ic.py);
  const admitted = [];
  for (const l of p.capitalSlicesNear(centre, (ix) => ix.length > 0)) admitted.push(l);
  assert.deepEqual(admitted.map((l) => l.mapTableData.mapId), [locs.get(at(B)).mapTableData.mapId], 'the one slice whose index holds the kind');
  assert.deepEqual(stood, [at(B)], 'stood alone');
  assert.equal(p.picked(), 1, 'and counted');
  assert.equal(indexAsked.filter((n) => n === sliceQuestName(A.x, A.y)).length, 1, 'a slice\'s index read once a session');
});

test('R2-5f end to end on a fixture city through the quest layer: a centre\'s local tavern taken in the nearest slice whose index holds one, that slice alone stood (picked 1), the nearer slice of a markerless tavern and the city\'s own cells passed over unstood; a dart on that nearer slice misses unstood, on the tavern\'s it lands; the city\'s own cells read - PIN MOVED (QUEST-FABRIC) - and a town\'s that is no capital (mutants: the city\'s admit dropped; the dart\'s refusal unasked; the seams - the index, the refusal, the cells)', () => {
  const { ic, slice, pixelOf } = icFixture();
  const centre = slice(ic.px, ic.py);
  const order = [...capitalSlicesNear(centre, (x, y) => slice(x, y))].map(pixelOf);
  const [first, second] = order.map((k) => k.split(',').map(Number));
  const own = (x, y) => imperialOwnName(x & 31, y & 31);
  // the city's own cells (the plan's corner, every cell of it holding no building) are read as a quest reads them, and
  // give no answer (QUEST-FABRIC: fabricQuestBlock) - a marked fabric tavern is the next test's
  _resetFabricInteriors();
  const BLOCKS = { 'TVRNFIX0.RMB': rmb([[bld(15), []]]), 'TVRNFIX1.RMB': rmb([[bld(15), [flat(SPAWN)]]]) };
  const made = [];
  const blocks = { getBlockByName: (name) => { made.push(name); return BLOCKS[name] ?? (imperialBlockOf(name) ? rmb([[bld(15), []]]) : null); } };
  const locs = new Map();
  const standing = (x, y) => {
    const k = `${x},${y}`;
    if (!locs.has(k)) locs.set(k, k === `${first[0]},${first[1]}` ? slice(x, y, 'TVRNFIX0.RMB', [bld(15)]) : k === `${second[0]},${second[1]}` ? slice(x, y, 'TVRNFIX1.RMB', [bld(15)]) : slice(x, y, own(x, y)));
    return locs.get(k);
  };
  const registry = createWorldPlaces();
  registry.register('tesa', [first, second].map(([x, y]) => ({ mapId: standing(x, y).mapTableData.mapId, name: standing(x, y).name, px: x, py: y, type: LOCATION_TYPES.TownCity })));
  const stood = [];
  const provinceQuestPlaces = { worldPlaces: registry, regionAt: () => CYRODIIL, lairsNear: () => [],
    standAt: (x, y) => { stood.push(`${x},${y}`); return capitalOnPixel(x, y) ? standing(x, y) : null; },
    sliceAt: (x, y) => (capitalOnPixel(x, y) ? standing(x, y) : null) };
  const maps = Object.create(MapsFile.prototype);
  maps.getRegion = () => null; maps.getLocation = () => null;
  const { questWorld: qw } = createQuestWorld({ maps, blocks, provinceQuestPlaces, params: new URLSearchParams(), _questRegionIndex: () => CYRODIIL, _questLoc: () => centre,
    playerTravelOrigin: () => ({ x: ic.px, y: ic.py }), placeByName: () => null, townTalk: { nameOpts: () => ({}) } });
  const viewed = [], view = qw.questBlock;
  qw.questBlock = (name) => { viewed.push(name); return view(name); };
  // the centre's local tavern: none at the centre, the nearer slice's tavern markerless - the next slice's, it alone stood
  const inn = placeOf(15, 0, '_inn_');
  inn._setupLocalSite(qw, 'Place _inn_ local tavern');
  assert.equal(inn.siteDetails.mapId, standing(...second).mapTableData.mapId, 'the nearest slice whose index holds a tavern');
  assert.equal(inn.siteDetails.locationName, sliceQuestName(...second), 'under its quest name');
  assert.equal(inn.siteDetails.nearSite, true);
  assert.deepEqual(stood, [`${second[0]},${second[1]}`], 'one slice stood: the one picked');
  assert.equal(qw.provinceSites.picked(), 1);
  assert.ok(made.includes('TVRNFIX0.RMB'), 'the nearer slice\'s block read for its index');
  assert.ok(viewed.some((n) => imperialBlockOf(n)), 'the city\'s own cells read - PIN MOVED (QUEST-FABRIC): BLD-3\'s buildings stand there');
  assert.ok(!made.some((n) => imperialBlockOf(n)), '...as a quest reads them (fabricQuestBlock), never made - the 83 s dart');
  // a dart on a slice row: refused unstood where its index holds none of the kind; landed where it holds one
  stood.length = 0;
  const cyr = qw.maps.getRegion(CYRODIIL);
  const dart = placeOf(15, 0, '_pub_');
  assert.equal(dart._tryTownLocation(qw, CYRODIIL, cyr.mapNameLookup.get(sliceQuestName(...first)), 15), false, 'no marked tavern: missed');
  assert.deepEqual(stood, [], 'unstood');
  assert.equal(dart._tryTownLocation(qw, CYRODIIL, cyr.mapNameLookup.get(sliceQuestName(...second)), 15), true, 'a marked tavern: landed');
  assert.deepEqual(stood, [`${second[0]},${second[1]}`]);
  // PIN MOVED (QUEST-FABRIC): the quest layer names no block as holding none; a town that is no capital is read whole
  assert.equal(qw.noBuildingBlock, undefined);
  made.length = 0; viewed.length = 0;
  assert.deepEqual(townBlockGrid(qw, townOf('Elsewhere', [own(3, 4)])).map((b) => !!b.dfBlock), [true]);
  assert.deepEqual([viewed, made], [[own(3, 4)], []]);
  assert.equal(questView(centre).name, 'Imperial City', '(the centre, one of its name)');
});

test('QUEST-FABRIC (the owner: "Let quests use them") on a fixture city through the quest layer: a marked tavern in a fabric building of the centre\'s own cells is the centre\'s local tavern - its own site, no other slice stood, nothing picked; where R2-5f read those cells as holding none it was sent a slice away (mutants: the city\'s own cells skipped again)', () => {
  const { ic, slice } = icFixture();
  // PIN MOVED (IC-PROPS, IC-STAIRS: the plan's cells laid again - Daggerfall's blocks gone, a building across a cell's corner
  // that cell's ground): the plan's cell (34, 95) holds one tavern, its record 0 (world/imperialFabricBuildings.js fabricCellBuildings), its
  // donor TVRNBM04.RMB's record 5 - whose interior here holds a spawn marker; the fixture's other slices are the plan's
  // corner, no building
  const tavern = fabricCellBuildings(34, 95).filter((b) => b.type === 15);
  assert.deepEqual(tavern.map((b) => [b.recordIndex, FABRIC_DONORS[b.donor].block, FABRIC_DONORS[b.donor].record]), [[0, 'TVRNBM04.RMB', 5]]);
  _resetFabricInteriors();
  const centre = slice(ic.px, ic.py, imperialOwnName(34, 95));
  const made = [];
  const blocks = { getBlockByName: (name) => {
    if (imperialBlockOf(name)) made.push(name);
    return name === 'TVRNBM04.RMB' ? rmb(Array.from({ length: 6 }, (_, i) => [bld(15), i === 5 ? [flat(SPAWN)] : []])) : null;
  } };
  const stood = [];
  const provinceQuestPlaces = { worldPlaces: createWorldPlaces(), regionAt: () => CYRODIIL, lairsNear: () => [],
    standAt: (x, y) => { stood.push(`${x},${y}`); return capitalOnPixel(x, y) ? slice(x, y) : null; },
    sliceAt: (x, y) => (capitalOnPixel(x, y) ? slice(x, y) : null) };
  const maps = Object.create(MapsFile.prototype);
  maps.getRegion = () => null; maps.getLocation = () => null;
  const { questWorld: qw } = createQuestWorld({ maps, blocks, provinceQuestPlaces, params: new URLSearchParams(), _questRegionIndex: () => CYRODIIL, _questLoc: () => centre,
    playerTravelOrigin: () => ({ x: ic.px, y: ic.py }), placeByName: () => null, townTalk: { nameOpts: () => ({}) } });
  const inn = placeOf(15, 0, '_inn_');
  inn._setupLocalSite(qw, 'Place _inn_ local tavern');
  assert.equal(inn.siteDetails.mapId, centre.mapTableData.mapId, 'the centre\'s own fabric tavern');
  assert.equal(inn.siteDetails.buildingKey, makeBuildingKey(0, 0, 0), 'the plan\'s tavern, its record');
  assert.ok(inn.siteDetails.questSpawnMarkers?.length === 1, 'its donor\'s marker');
  assert.deepEqual(made, [], 'no cell made: read as a quest reads it');
  assert.ok(!inn.siteDetails.nearSite, 'a local site, not a slice away');
  assert.deepEqual(stood, [], 'no other slice stood');
  assert.equal(qw.provinceSites.picked(), 0);
});

test('QUEST-FABRIC A SLICE\'S INDEX through the quest layer (scenes/questWorld.js sitesIndexOf): its Daggerfall blocks walked, its own cells read as holding none and its fabric\'s kinds baked (fabricSliceSites) - the kinds the whole walk finds there, with no own cell read and no donor opened for it; a town that is no slice of the city walked whole (mutants: the bake unread; the own cells walked)', () => {
  _resetFabricInteriors();
  // a slice whose fabric holds a Mages Guild hall, its plan's cells: its own ones the city's blocks, the rest a marked shop
  const namesOf = (s) => {
    const sx = s % IMPERIAL_SPAN, sy = Math.floor(s / IMPERIAL_SPAN), out = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const rc = imperialCodeCell(imperialCell(sy * 8 + i, sx * 8 + j)); out.push(rc ? imperialOwnName(rc[0], rc[1]) : 'MARKS1.RMB'); }
    return out;
  };
  const s = FABRIC_SLICE_SETS.findIndex((set, k) => FABRIC_SITE_SETS[set].split(' ').includes('11:40') && namesOf(k).includes('MARKS1.RMB'));
  const names = namesOf(s);
  assert.ok(names.includes('MARKS1.RMB') && names.some((n) => imperialBlockOf(n)), 'the slice holds both');
  const loc = townOf('Slice', names, { regionIndex: CYRODIIL, mapId: 0xa9000000 + s, capital: { k: 0, s } });
  // BLOCKS.BSA: each donor's interior marked as the table says, Daggerfall's MARKS1 a marked Bank (14)
  const read = [];
  const blocks = { getBlockByName: (name) => {
    read.push(name);
    if (name === 'MARKS1.RMB') return rmb([[bld(14), [flat(SPAWN)]]]);
    const at = FABRIC_DONORS.map((d, i) => [d, i]).filter(([d]) => d.block === name);
    if (!at.length) return null;
    const subs = [];
    for (const [d, i] of at) subs[d.record] = [bld(0), FABRIC_DONOR_MARKED[i] ? [flat(SPAWN)] : []];
    return rmb(Array.from({ length: subs.length }, (_, k) => subs[k] ?? [bld(0), []]));
  } };
  const provinceQuestPlaces = { worldPlaces: createWorldPlaces(), regionAt: () => CYRODIIL, lairsNear: () => [], standAt: () => null, sliceAt: () => loc };
  const maps = Object.create(MapsFile.prototype);
  maps.getRegion = () => null; maps.getLocation = () => null;
  const { questWorld: qw } = createQuestWorld({ maps, blocks, provinceQuestPlaces, params: new URLSearchParams(), _questRegionIndex: () => CYRODIIL, _questLoc: () => loc,
    playerTravelOrigin: () => ({ x: 100, y: 100 }), placeByName: () => null, townTalk: { nameOpts: () => ({}) } });
  const kinds = (index) => [...new Set(index.map((x) => `${x.buildingType}:${x.factionId}`))].sort();
  const index = qw.provinceSites.sliceIndexAt(100, 100);
  assert.deepEqual([...new Set(read)], ['MARKS1.RMB'], 'Daggerfall\'s blocks walked; no own cell read, no donor opened');
  assert.deepEqual(kinds(index), [...FABRIC_SITE_SETS[FABRIC_SLICE_SETS[s]].split(' '), '14:0'].sort(), 'its Daggerfall block\'s and its fabric\'s');
  assert.ok(kinds(index).includes('11:40'), 'the fabric\'s Mages Guild hall');
  // the whole walk, every own cell read as a quest reads it (questBlock): the same kinds
  assert.deepEqual(kinds(townSitesIndex(qw, loc)), kinds(index), 'the walk\'s own answer');
  // a town that is no slice of the city: walked whole
  read.length = 0;
  assert.deepEqual(kinds(townSitesIndex(qw, townOf('Elsewhere', ['MARKS1.RMB']))), ['14:0']);
});

test('R2-5f the warmer reads each row it warms for its capital slice\'s index, nearest first, as it stands it (mutant: unread)', () => {
  const rows = [3, 1, 2].map((x, i) => provinceRow({ mapId: 300 + i, name: `S${i}`, px: 1700 + x, py: -400, type: LOCATION_TYPES.TownCity }));
  const stood = [], read = [];
  const provinces = { getRegion: () => ({ mapTable: rows }), getLocation: (r, i) => { stood.push(rows[i].name); return {}; }, sliceIndexAt: (x, y) => { read.push(`${x},${y}`); return []; } };
  const w = createProvinceWarm({ provinces, regionNow: () => SKYRIM, origin: () => ({ x: 1700, y: -400 }) });
  w.tick(); w.tick();
  assert.deepEqual(stood, ['S1', 'S2', 'S0']);
  assert.deepEqual(read, ['1701,-400', '1702,-400', '1703,-400'], 'each row warmed, its index read');
});

test('R2-5f dryKinds kept a names list: the same list the same answer, its blocks read once; another list its own (mutant: unkept)', () => {
  const tiles = (water) => ({ rmbBlock: { fldHeader: { groundData: { groundTiles: [Array.from({ length: 16 }, (_, i) => ({ textureRecord: i < water ? 0 : 2 }))] } } } });
  let reads = 0;
  const blockOf = (name) => { reads++; return name === 'CUSTWET.RMB' ? tiles(9) : tiles(1); };
  const names = new Map([['CUST', ['CUSTWET.RMB', 'CUSTDRY.RMB']], ['RESI', ['RESIAA00.RMB']]]);
  const dry = dryKinds(names, blockOf);
  assert.deepEqual(dry.get('CUST'), ['CUSTDRY.RMB'], 'the wet block left out');
  assert.equal(reads, 2);
  assert.equal(dryKinds(names, blockOf), dry, 'the same list: the same answer');
  assert.equal(reads, 2, 'its blocks not read again');
  const other = dryKinds(new Map(names), blockOf);
  assert.notEqual(other, dry, 'another list: its own answer');
  assert.deepEqual(other.get('CUST'), ['CUSTDRY.RMB']);
});
