// QUEST-AUDIT II NEAR-SITE / NEAR-REGION (bible/01-Overview/Quest-Audit-II.md; the owner, on the audit's findings:
// "Rework so quests can work"). A town the town mods lay can hold fewer buildings of a kind than Daggerfall's quests
// ask of it - one tavern for two `local tavern`s, three houses for five, a city without the weaponsmith its Mages Guild
// quest wants - and a region can be left without a kind at all (Pothago's weaponsmiths). DFU's Place throws, and the
// questor answers "You're too late" there every time. In a town a layout mod lays, a local site with no free building
// of its kind is taken in the NEAREST town of the region that has one; a remote town site a mod-laid region cannot
// give, in the nearest town of another region. Daggerfall's own towns keep DFU's law. The towns are the port's own
// shapes over the real world-data door and layout pins (test/fb1004dTowns.mjs).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { configureLayoutPins, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, typeAtKey, mark, SPAWN, ITEM } from './fb1004dTowns.mjs';

loadTables();
const BV = 'beautiful-villages';
const { House1, House2, House3, Tavern, GeneralStore, WeaponSmith } = BUILDING_TYPES;

/**
 * Regions of towns on the map: `regions` is { [regionIndex]: [{ name, px: [x, y], buildings, mod, dungeon }] }, the
 * player in `current` ([regionIndex, locationIndex]). A town marked `mod` is one Beautiful Villages lays (its location
 * file on the door); its buildings are what that layout holds. Each town's directory (MAPS.BSA's building list, the
 * remote pre-check's) is its buildings.
 */
function mapOf(regions, current, { modsOn = true } = {}) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const keyOf = (r, i) => r + 100 * i;
  const byMapId = new Map(), blocks = new Map(), locations = {}, tables = {};
  for (const [r, towns] of Object.entries(regions)) {
    const region = Number(r);
    locations[region] = towns.map((t, i) => {
      const mapId = region * 1000 + i + 1, blockName = `T${region}X${i}.RMB`;
      if (t.mod) registerWorldDataAsset(`location-${region}-${i}.json`, {}, null, { priority: 10, vendor: BV });
      blocks.set(blockName, rmbBlock(blockName, t.buildings ?? []));
      const loc = town({ name: t.name, locationIndex: i, mapId, grid: [blockName], regionIndex: region, regionName: `Region ${region}` });
      const ll = mapPixelToLongitudeLatitude(t.px[0], t.px[1]);
      Object.assign(loc.mapTableData, { longitude: ll.x, latitude: ll.y, ...(t.dungeon ? { locationType: 7, dungeonType: 0 } : {}) });
      loc.exterior.buildings = (t.buildings ?? []).map((b) => ({ buildingType: b.type, factionId: 0, nameSeed: 1, quality: 10 }));
      byMapId.set(mapId, keyOf(region, i));
      return loc;
    });
    tables[region] = { name: `Region ${region}`, locationCount: towns.length, mapTable: locations[region].map((l) => l.mapTableData), mapNameLookup: new Map(locations[region].map((l, i) => [l.name, i])) };
  }
  configureLayoutPins({ vendorOn: (v) => modsOn && v === BV, vendorVersion: () => '1.4.2', locationKeyOfMapId: (id) => byMapId.get(id) ?? null,
    gridOf: (key) => { const loc = locations[key % 100]?.[Math.floor(key / 100)]; return loc ? loc.exterior.exteriorData.blockNames : null; } });
  const [cr, ci] = current;
  const here = locations[cr][ci];
  const ll = here.mapTableData;
  const world = {
    maps: {
      regionCount: Math.max(...Object.keys(regions).map(Number)) + 1, getRegion: (r) => tables[r] ?? null, getLocation: (r, i) => locations[r]?.[i] ?? null,
      getLocationByName: (r, n) => locations[r]?.find((l) => l.name === n) ?? null,
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x],
      readLocationIdFast: (r, i) => locations[r]?.[i]?.exterior.exteriorData.locationId ?? 0, getClimateIndex: () => 231,
    },
    getBlock: (name) => blocks.get(name) ?? null,
    currentLocation: () => here, currentRegionIndex: () => cr, currentLocationIndex: () => ci, currentRegionName: () => `Region ${cr}`,
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ x: Math.trunc(ll.longitude / 128), y: 499 - Math.trunc(ll.latitude / 128) }), buildingNameOpts: () => ({}),
    getFactionData: (id) => ({ id, type: 2, name: `Faction ${id}`, race: -1, flat1: (182 << 7) | 1, flat2: (182 << 7) | 2 }),
    findFactionsOfType: (type) => [{ id: 201, type, name: 'People', race: -1 }],
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3,
  };
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  return { world, machine, locations, blocks };
}
const quest = (machine, places) => machine.parseQuestForLists(['Quest: __NEAR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...places, '', 'variable _done_'], 0, { rolls: () => 0 });
const townOf = (m, site) => Object.values(m.locations).flat().find((l) => l.mapTableData.mapId === site.mapId)?.name ?? null;
const tavern = (x) => ({ type: Tavern, markers: [mark(SPAWN, x, 0, x)] });
const house = (type, x) => ({ type, markers: [mark(SPAWN, x, 0, x), mark(ITEM, x + 1, 0, x)] });

test('QUEST-AUDIT II NEAR-SITE: in a village Beautiful Villages lays with ONE tavern, a quest asking two local taverns (A0C00Y12, A0C01Y13) takes the second in the NEAREST town that has one - by the travel reckoning, past a farther town with two - and starts; in Daggerfall\'s own village it throws as Place.cs does (mutants: the mod gate dropped, the nearest unsorted, the fallback unread)', () => {
  const regions = (mod) => ({ 17: [
    { name: 'Aldleigh', px: [100, 100], buildings: [tavern(10), house(House2, 20)], mod },
    { name: 'Brindle', px: [120, 100], buildings: [tavern(10), tavern(30)] },     // 20 pixels off, two taverns
    { name: 'Crypt of Ash', px: [101, 100], dungeon: true },                      // a dungeon at the gate: never a town
    { name: 'Corren', px: [104, 103], buildings: [tavern(12)] },                  // 4 pixels off, one tavern
    { name: 'Dunmoor', px: [102, 101], buildings: [house(House1, 5)] },           // 2 pixels off, no tavern
  ] });
  try {
    const m = mapOf(regions(true), [17, 0]);
    const q = quest(m.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']);
    assert.ok(q, 'the quest starts');
    const inn = q.getPlace({ name: 'inn' }).siteDetails, meet = q.getPlace({ name: 'meet' }).siteDetails;
    assert.equal(townOf(m, inn), 'Aldleigh', 'the first in the village');
    assert.equal(townOf(m, meet), 'Corren', 'the second in the nearest town with a tavern');
    assert.equal(typeAtKey(m.world, m.locations[17][3], meet.buildingKey), Tavern);
    assert.equal(meet.locationName, 'Corren', 'its words name that town');
    // Daggerfall's own village: DFU's law - the second throws, and the quest does not start
    const c = mapOf(regions(false), [17, 0]);
    assert.equal(quest(c.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']), null, 'no quest, as in DFU');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II NEAR-SITE: a Kynareth temple of three houses asked for five local houses (A0C00Y16) - the houses past its own are found in the nearest towns, each its own building; a named kind the town has none of (N0C00Y10\'s weaponsmith) is taken where the directory has one, the town without passed over unwalked (mutants: the pre-check dropped, the house law lost)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Holy Altar', px: [50, 50], buildings: [house(House1, 1), house(House2, 2), house(House3, 3)], mod: true },
      { name: 'Eastfold', px: [53, 50], buildings: [house(House1, 4), house(House2, 5)] },
      { name: 'Smithwick', px: [60, 50], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 9, 0, 9), mark(ITEM, 8, 0, 9)] }] },
      { name: 'Liar\'s Cross', px: [51, 50], buildings: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }] },
      { name: 'Unlisted Forge', px: [52, 51], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 7, 0, 7)] }] },
    ] }, [17, 0]);
    // the directory claims a weaponsmith the blocks do not hold: passed over by the walk, as DFU's remote pre-check
    m.locations[17][3].exterior.buildings.push({ buildingType: WeaponSmith, factionId: 0, nameSeed: 1, quality: 10 });
    // and a town whose blocks hold one its directory does not list is passed over unwalked (SelectRemoteTownSite's own)
    m.locations[17][4].exterior.buildings = [];
    const q = quest(m.machine, ['Place _a_ local house', 'Place _b_ local house', 'Place _c_ local house', 'Place _d_ local house', 'Place _e_ local house', 'Place _smith_ local weaponstore']);
    assert.ok(q, 'the quest starts');
    const sites = ['a', 'b', 'c', 'd', 'e'].map((n) => q.getPlace({ name: n }).siteDetails);
    assert.deepEqual(sites.map((s) => townOf(m, s)), ['Holy Altar', 'Holy Altar', 'Holy Altar', 'Eastfold', 'Eastfold']);
    assert.equal(new Set(sites.map((s) => `${s.mapId}:${s.buildingKey}`)).size, 5, 'five buildings');
    assert.equal(townOf(m, q.getPlace({ name: 'smith' }).siteDetails), 'Smithwick');
    // a house of the kind asked, found as asked in the next town: the place keeps its law (never the any-house -1 its
    // own town's fallback wrote)
    const h = mapOf({ 17: [
      { name: 'Bare Shrine', px: [10, 10], buildings: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }], mod: true },
      { name: 'Hamlet', px: [12, 10], buildings: [house(House2, 3)] },
    ] }, [17, 0]);
    const hq = quest(h.machine, ['Place _h_ local house2']);
    assert.equal(townOf(h, hq.getPlace({ name: 'h' }).siteDetails), 'Hamlet');
    assert.equal(hq.getPlace({ name: 'h' }).p2, House2, 'the law found as asked');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II NEAR-SITE: a local site the re-seat must choose again where its mod-laid town no longer holds its kind is taken in the nearest town that does - never left unseated while one stands (mutant: the re-seat\'s fallback)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Aldleigh', px: [100, 100], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 10, 0, 10)] }] },
      { name: 'Corren', px: [103, 100], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 12, 0, 12)] }] },
    ] }, [17, 0], { modsOn: false });
    const q = quest(m.machine, ['Place _smith_ local weaponstore']);
    const place = q.getPlace({ name: 'smith' });
    assert.equal(townOf(m, place.siteDetails), 'Aldleigh');
    // the town mods on: Beautiful Villages lays Aldleigh without its weaponsmith
    registerWorldDataAsset('location-17-0.json', {}, null, { priority: 10, vendor: BV });
    configureLayoutPins({ vendorOn: (v) => v === BV, vendorVersion: () => '1.4.2', locationKeyOfMapId: (id) => ({ 17001: 17, 17002: 117 })[id] ?? null, gridOf: (key) => (key === 17 ? ['T17X0.RMB'] : ['T17X1.RMB']) });
    m.blocks.set('T17X0.RMB', rmbBlock('T17X0.RMB', [house(House1, 3)]));
    m.locations[17][0].exterior.buildings = [{ buildingType: House1, factionId: 0, nameSeed: 1, quality: 10 }];
    assert.equal(place.reseatMovedSite(m.world), true);
    assert.equal(townOf(m, place.siteDetails), 'Corren', 'the nearest weaponsmith');
    assert.equal(place.siteDetails.unseated, undefined);
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II NEAR-REGION: a region whose towns the mods lay without a weaponsmith (Pothago, L0B60Y10\'s `remote weaponstore`, N0C00Y10\'s local one) takes the site in the nearest town of ANOTHER region that has one; a region the mods leave as Daggerfall laid it fails as DFU does (mutants: the region gate, the nearest unsorted, the fallback unread, the local\'s other regions)', () => {
  const regions = (mod) => ({
    40: [
      { name: 'Pothago', px: [300, 300], buildings: [house(House2, 1)], mod },
      { name: 'Menakat', px: [310, 300], buildings: [house(House2, 2)], mod },
    ],
    41: [
      { name: 'Far Forge', px: [380, 300], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 5, 0, 5)] }] },
      { name: 'Near Forge', px: [330, 302], buildings: [{ type: WeaponSmith, markers: [mark(SPAWN, 6, 0, 6)] }] },
    ],
  });
  try {
    const m = mapOf(regions(true), [40, 0]);
    const q = quest(m.machine, ['Place _shop_ remote weaponstore']);
    assert.ok(q, 'the quest starts');
    const shop = q.getPlace({ name: 'shop' }).siteDetails;
    assert.equal(townOf(m, shop), 'Near Forge', 'the nearest of the next region');
    assert.equal(shop.regionName, 'Region 41');
    // and a LOCAL weaponsmith (the Mages Guild's N0C00Y10) where the whole region has none: the nearest of the next region
    const l = quest(m.machine, ['Place _smith_ local weaponstore']);
    assert.ok(l, 'the local quest starts');
    assert.equal(townOf(m, l.getPlace({ name: 'smith' }).siteDetails), 'Near Forge');
    const c = mapOf(regions(false), [40, 0]);
    assert.equal(quest(c.machine, ['Place _shop_ remote weaponstore']), null, 'DFU\'s law where the mods changed nothing');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});
