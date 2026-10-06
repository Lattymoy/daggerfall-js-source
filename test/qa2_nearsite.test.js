// QUEST-AUDIT II NEAR-SITE / NEAR-REGION (bible/01-Overview/Quest-Audit-II.md; the owner, on the audit's findings:
// "Rework so quests can work"). A town the town mods lay can hold fewer buildings of a kind than Daggerfall's quests
// ask of it - one tavern for two `local tavern`s, three houses for five, a city without the weaponsmith its Mages Guild
// quest wants - and a region can be left without a kind at all (Pothago's weaponsmiths). DFU's Place throws, and the
// questor answers "You're too late" there every time. Where the mods TOOK the kind away (AUDIT QA2: the town's own
// layout - its MAPS.BSA record over BLOCKS.BSA's blocks - held more than the mods' holds), a local site with no free
// building of its kind is taken in the NEAREST town that has one, in any region; a remote town site, in the region's own
// towns nearest first and then in the nearest town of another region, where the mods took the kind from the region.
// Everywhere else - Daggerfall's own towns, and a town or region that never held the kind - DFU's law. A person's home
// keeps Person.cs's own fallback, a house of its town, before any other town. The towns are the port's own shapes over
// the real world-data door and layout pins (test/fb1004dTowns.mjs), each with Daggerfall's own layout beside the mods'.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { configureLayoutPins, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement, bindWorldDataBlocks } from '../src/formats/worldDataReplacement.js';
import { mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, typeAtKey, mark, SPAWN, ITEM } from './fb1004dTowns.mjs';
import { fakeBlocks } from './wd3Fakes.mjs';

loadTables();
const BV = 'beautiful-villages';
const { House1, House2, House3, Tavern, GeneralStore, WeaponSmith, Library, Alchemist } = BUILDING_TYPES;

/**
 * Regions of towns on the map: `regions` is { [regionIndex]: [{ name, px: [x, y], buildings, classic, mod, dungeon }] },
 * the player in `current` ([regionIndex, locationIndex], moved with `setCurrent`). A town marked `mod` is one Beautiful
 * Villages lays (its location file on the door); `buildings` are what the town holds as it stands, `classic` what
 * Daggerfall's own layout of it held (its MAPS.BSA record and BLOCKS.BSA block - readClassicLocation, the door's bound
 * BlocksFile), the same unless given. Each town's directory (the remote pre-check's) is its buildings.
 */
function mapOf(regions, current, { modsOn = true } = {}) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const keyOf = (r, i) => r + 100 * i;
  const state = { modsOn };
  const byMapId = new Map(), blocks = new Map(), locations = {}, own = {}, tables = {}, classicBlocks = [];
  const directory = (list) => list.map((b) => ({ buildingType: b.type, factionId: 0, nameSeed: 1, quality: 10 }));
  for (const [r, towns] of Object.entries(regions)) {
    const region = Number(r);
    own[region] = [];
    locations[region] = towns.map((t, i) => {
      const mapId = region * 1000 + i + 1, blockName = `T${region}X${i}.RMB`, ownName = `C${region}X${i}.RMB`;
      if (t.mod) registerWorldDataAsset(`location-${region}-${i}.json`, {}, null, { priority: 10, vendor: BV });
      blocks.set(blockName, rmbBlock(blockName, t.buildings ?? []));
      classicBlocks.push(rmbBlock(ownName, t.classic ?? t.buildings ?? [], { index: classicBlocks.length + 1 }));
      const ll = mapPixelToLongitudeLatitude(t.px[0], t.px[1]);
      const lay = (grid, list) => {
        const loc = town({ name: t.name, locationIndex: i, mapId, grid, regionIndex: region, regionName: `Region ${region}` });
        Object.assign(loc.mapTableData, { longitude: ll.x, latitude: ll.y, ...(t.dungeon ? { locationType: 7, dungeonType: 0 } : {}) });
        loc.exterior.buildings = directory(list);
        return loc;
      };
      own[region][i] = lay([ownName], t.classic ?? t.buildings ?? []);
      byMapId.set(mapId, keyOf(region, i));
      return lay([blockName], t.buildings ?? []);
    });
    tables[region] = { name: `Region ${region}`, locationCount: towns.length, mapTable: locations[region].map((l) => l.mapTableData), mapNameLookup: new Map(locations[region].map((l, i) => [l.name, i])) };
  }
  const bsa = fakeBlocks(...classicBlocks);
  bindWorldDataBlocks(bsa);
  configureLayoutPins({ vendorOn: (v) => state.modsOn && v === BV, vendorVersion: () => '1.4.2', locationKeyOfMapId: (id) => byMapId.get(id) ?? null,
    gridOf: (key) => { const loc = locations[key % 100]?.[Math.floor(key / 100)]; return loc ? loc.exterior.exteriorData.blockNames : null; } });
  let [cr, ci] = current;
  const pixelOf = (loc) => ({ x: Math.trunc(loc.mapTableData.longitude / 128), y: 499 - Math.trunc(loc.mapTableData.latitude / 128) });
  const world = {
    maps: {
      regionCount: Math.max(...Object.keys(regions).map(Number)) + 1, getRegion: (r) => tables[r] ?? null, getLocation: (r, i) => locations[r]?.[i] ?? null,
      readClassicLocation: (r, i) => own[r]?.[i] ?? null,
      getLocationByName: (r, n) => locations[r]?.find((l) => l.name === n) ?? null,
      getRmbBlockName: (loc, x, y) => loc.exterior.exteriorData.blockNames[y * loc.exterior.exteriorData.width + x],
      readLocationIdFast: (r, i) => locations[r]?.[i]?.exterior.exteriorData.locationId ?? 0, getClimateIndex: () => 231,
    },
    getBlock: (name) => blocks.get(name) ?? null,
    currentLocation: () => locations[cr][ci], currentRegionIndex: () => cr, currentLocationIndex: () => ci, currentRegionName: () => `Region ${cr}`,
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => pixelOf(locations[cr][ci]), buildingNameOpts: () => ({}),
    getFactionData: (id) => ({ id, type: 2, name: `Faction ${id}`, race: -1, flat1: (182 << 7) | 1, flat2: (182 << 7) | 2 }),
    findFactionsOfType: (type) => [{ id: 201, type, name: 'People', race: -1 }],
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201, currentRegionRace: () => 3,
  };
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  return { world, machine, locations, blocks, state, setCurrent: ([r, i]) => { cr = r; ci = i; }, classicReads: () => [...bsa.reads.values()].reduce((a, b) => a + b, 0) };
}
const quest = (machine, places) => machine.parseQuestForLists(['Quest: __NEAR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...places, '', 'variable _done_'], 0, { rolls: () => 0 });
const townOf = (m, site) => Object.values(m.locations).flat().find((l) => l.mapTableData.mapId === site.mapId)?.name ?? null;
const mapIdOf = (m, name) => Object.values(m.locations).flat().find((l) => l.name === name).mapTableData.mapId;
const tavern = (x) => ({ type: Tavern, markers: [mark(SPAWN, x, 0, x)] });
const house = (type, x) => ({ type, markers: [mark(SPAWN, x, 0, x), mark(ITEM, x + 1, 0, x)] });
const shop = (type, x) => ({ type, markers: [mark(SPAWN, x, 0, x), mark(ITEM, x + 1, 0, x)] });

test('QUEST-AUDIT II NEAR-SITE: in a village Beautiful Villages lays with ONE tavern where Daggerfall\'s own had two, a quest asking two local taverns (A0C00Y12, A0C01Y13) takes the second in the NEAREST town that has one - by the travel reckoning, past a farther town with two and a dungeon holding a tavern - and starts; AUDIT QA2: where Daggerfall\'s own village held one tavern too the mods took nothing, and it throws as Place.cs does, as in Daggerfall\'s own village (mutants: the mod gate dropped, the supply unasked, the stamp unasked, the nearest unsorted, the dungeons not passed over, the fallback unread)', () => {
  const regions = (mod, classic) => ({ 17: [
    { name: 'Aldleigh', px: [100, 100], buildings: [tavern(10), house(House2, 20)], mod, classic },
    { name: 'Brindle', px: [120, 100], buildings: [tavern(10), tavern(30)] },     // 20 pixels off, two taverns
    { name: 'Crypt of Ash', px: [101, 100], buildings: [tavern(7)], dungeon: true },   // a dungeon at the gate: never a town
    { name: 'Corren', px: [104, 103], buildings: [tavern(12)] },                  // 4 pixels off, one tavern
    { name: 'Dunmoor', px: [102, 101], buildings: [house(House1, 5)] },           // 2 pixels off, no tavern
  ] });
  const TWO_TAVERNS = [tavern(10), tavern(40), house(House2, 20)];   // Daggerfall's own Aldleigh
  try {
    const m = mapOf(regions(true, TWO_TAVERNS), [17, 0]);
    const q = quest(m.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']);
    assert.ok(q, 'the quest starts');
    const inn = q.getPlace({ name: 'inn' }).siteDetails, meet = q.getPlace({ name: 'meet' }).siteDetails;
    assert.equal(townOf(m, inn), 'Aldleigh', 'the first in the village');
    assert.equal(townOf(m, meet), 'Corren', 'the second in the nearest town with a tavern');
    assert.equal(typeAtKey(m.world, m.locations[17][3], meet.buildingKey), Tavern);
    assert.equal(meet.locationName, 'Corren', 'its words name that town');
    // AUDIT QA2: the mods lay the village, but Daggerfall's own held one tavern too - nothing taken, DFU's law
    const o = mapOf(regions(true), [17, 0]);
    assert.equal(quest(o.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']), null, 'no quest, as in DFU');
    // Daggerfall's own village: DFU's law - the second throws, and the quest does not start
    const c = mapOf(regions(false), [17, 0]);
    assert.equal(quest(c.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']), null, 'no quest, as in DFU');
    // and a town no layout mod changes whose blocks are not MAPS.BSA's (the port's own edits - ARENA1's Daggerfall cell):
    // its stamp is Daggerfall's, and DFU's law stands whatever its record held
    const e = mapOf(regions(false, TWO_TAVERNS), [17, 0]);
    assert.equal(quest(e.machine, ['Place _inn_ local tavern', 'Place _meet_ local tavern']), null, 'no quest, as in DFU');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II NEAR-SITE: a Kynareth temple the mods left three houses of its six asked for five local houses (A0C00Y16) - the houses past its own are found in the nearest towns, each its own building; a named kind the mods took (N0C00Y10\'s weaponsmith) is taken where the directory has one, the town without passed over unwalked; a house of the kind asked found in the next town keeps its law, never the any-house -1 its own town\'s fallback wrote (mutants: the pre-check dropped, a house kind pre-checked, the house law lost, the -1 passed on, a house kind\'s supply its own type\'s)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Holy Altar', px: [50, 50], buildings: [house(House1, 1), house(House2, 2), house(House3, 3)], mod: true,
        classic: [house(House1, 1), house(House2, 2), house(House3, 3), house(House1, 4), house(House2, 5), house(House3, 6), shop(WeaponSmith, 9)] },
      { name: 'Eastfold', px: [53, 50], buildings: [house(House1, 4), house(House2, 5)] },
      { name: 'Smithwick', px: [60, 50], buildings: [shop(WeaponSmith, 9)] },
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
    const h = mapOf({ 17: [
      { name: 'Bare Shrine', px: [10, 10], buildings: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }], mod: true,
        classic: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }, house(House2, 3)] },
      { name: 'Hamlet', px: [12, 10], buildings: [tavern(2), house(House2, 3)] },   // a tavern first: `random` would take it
    ] }, [17, 0]);
    const hq = quest(h.machine, ['Place _h_ local house2']);
    const hs = hq.getPlace({ name: 'h' });
    assert.equal(townOf(h, hs.siteDetails), 'Hamlet');
    assert.equal(typeAtKey(h.world, h.locations[17][1], hs.siteDetails.buildingKey), House2, 'the House2, as asked');
    assert.equal(hs.p2, House2, 'the law found as asked');
    // AUDIT QA2: a house kind's supply is ANY house (its fallback takes one): the mods laying a House1 where Daggerfall
    // laid a House2 took no house, and a second house asked of the village throws as Place.cs does
    // a house kind is no named kind the directory pre-checks: the nearest town's House1, by the house fallback there
    const o = mapOf({ 17: [
      { name: 'Bare Shrine', px: [10, 10], buildings: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }], mod: true,
        classic: [{ type: GeneralStore, markers: [mark(SPAWN, 1, 0, 1)] }, house(House2, 3)] },
      { name: 'Oneroof', px: [11, 10], buildings: [house(House1, 4)] },
      { name: 'Hamlet', px: [14, 10], buildings: [house(House2, 3)] },
    ] }, [17, 0]);
    assert.equal(townOf(o, quest(o.machine, ['Place _h_ local house2']).getPlace({ name: 'h' }).siteDetails), 'Oneroof');
    const k = mapOf({ 17: [
      { name: 'Twohouse', px: [10, 10], buildings: [house(House1, 1)], mod: true, classic: [house(House2, 1)] },
      { name: 'Hamlet', px: [12, 10], buildings: [house(House2, 3)] },
    ] }, [17, 0]);
    assert.equal(quest(k.machine, ['Place _a_ local house1', 'Place _b_ local house2']), null, 'one house in either layout');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

const SMITH_QUEST = ['Quest: __NEARL', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gem_ sapphire', 'Place _smith_ local weaponstore', '', '\tplace item _gem_ at _smith_', '', 'variable _done_'];

test('QUEST-AUDIT II NEAR-SITE: a local site the load\'s re-seat must choose again where the mods took its kind from its town is taken in the town nearest THAT town (the player stands far off, beside another) - never left unseated while one stands; AUDIT QA2: its site link goes with it, town and all - the building it stands in now finds the quest\'s gem, the old town\'s building of the same key none (mutants: the re-seat\'s fallback, the link\'s town left behind, the origin the player\'s)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Aldleigh', px: [100, 100], buildings: [shop(WeaponSmith, 10)] },
      { name: 'Corren', px: [103, 100], buildings: [shop(WeaponSmith, 12)] },
      { name: 'Farport', px: [300, 300], buildings: [shop(WeaponSmith, 14)] },
      { name: 'Westwick', px: [301, 300], buildings: [house(House1, 2)] },
    ] }, [17, 0], { modsOn: false });
    const q = m.machine.parseQuestForLists(SMITH_QUEST, 0, { rolls: () => 0 });
    m.machine.startQuestImmediate(q); m.machine.tick();
    const place = q.getPlace({ name: 'smith' });
    const key = place.siteDetails.buildingKey;
    assert.equal(townOf(m, place.siteDetails), 'Aldleigh');
    assert.equal(m.machine.getSiteLinks(SITE_TYPES.Building, mapIdOf(m, 'Aldleigh'), key).length, 1, 'the gem\'s link');
    // the town mods on: Beautiful Villages lays Aldleigh without its weaponsmith, and the player has walked to Westwick
    registerWorldDataAsset('location-17-0.json', {}, null, { priority: 10, vendor: BV });
    m.state.modsOn = true;
    m.blocks.set('T17X0.RMB', rmbBlock('T17X0.RMB', [house(House1, 3)]));
    m.locations[17][0].exterior.buildings = [{ buildingType: House1, factionId: 0, nameSeed: 1, quality: 10 }];
    m.setCurrent([17, 3]);
    assert.equal(m.machine.reseatMovedSites(m.world), 1, 'the load\'s pass moves it');
    assert.equal(townOf(m, place.siteDetails), 'Corren', 'the weaponsmith nearest its town, not the player');
    assert.equal(place.siteDetails.unseated, undefined);
    const links = m.machine.siteLinks.filter((l) => l.questUID === q.uid);
    assert.deepEqual(links.map((l) => [l.mapId, l.buildingKey]), [[mapIdOf(m, 'Corren'), place.siteDetails.buildingKey]], 'one link, on the site');
    assert.equal(m.machine.getSiteLinks(SITE_TYPES.Building, mapIdOf(m, 'Corren'), place.siteDetails.buildingKey).length, 1, 'Corren\'s weaponsmith mounts the gem');
    assert.equal(m.machine.getSiteLinks(SITE_TYPES.Building, mapIdOf(m, 'Aldleigh'), key).length, 0, 'Aldleigh\'s house of the same key, nothing');
    assert.equal(m.machine.hasSiteLink(q, place.symbol), true);
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('AUDIT QA2: a site the re-seat must choose again where the mods took NOTHING of its kind - Daggerfall\'s own town held one weaponsmith and the mods\' holds one, another quest\'s now - is unseated as RESEAT-GAPS laid down, never taken in another town (mutant: the re-seat\'s gate unasked)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Aldleigh', px: [100, 100], buildings: [shop(WeaponSmith, 10)] },
      { name: 'Corren', px: [103, 100], buildings: [shop(WeaponSmith, 12)] },
    ] }, [17, 0], { modsOn: false });
    const q = m.machine.parseQuestForLists(SMITH_QUEST, 0, { rolls: () => 0 });
    m.machine.startQuestImmediate(q); m.machine.tick();
    const place = q.getPlace({ name: 'smith' });
    // the mods lay Aldleigh with its weaponsmith elsewhere in the town, and another quest takes it
    registerWorldDataAsset('location-17-0.json', {}, null, { priority: 10, vendor: BV });
    m.state.modsOn = true;
    m.blocks.set('T17X0.RMB', rmbBlock('T17X0.RMB', [house(House1, 3), shop(WeaponSmith, 20)]));
    m.locations[17][0].exterior.buildings = [House1, WeaponSmith].map((buildingType) => ({ buildingType, factionId: 0, nameSeed: 1, quality: 10 }));
    const other = m.machine.parseQuestForLists(['Quest: __OTHER', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _w_ local weaponstore', '', 'variable _done_'], 0, { rolls: () => 0 });
    m.machine.startQuestImmediate(other); m.machine.tick();
    assert.equal(townOf(m, other.getPlace({ name: 'w' }).siteDetails), 'Aldleigh', 'the other quest holds the weaponsmith');
    m.machine.reseatMovedSites(m.world);
    assert.equal(place.siteDetails.buildingKey, 0, 'unseated');
    assert.equal(townOf(m, place.siteDetails), 'Aldleigh', 'its town kept');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('AUDIT QA2: a REMOTE site the re-seat must choose again where the mods took its kind from its town is unseated, as RESEAT-GAPS laid down - NEAR-SITE is a local site\'s, never a remote one\'s (mutant: the re-seat\'s scope unasked)', () => {
  try {
    const m = mapOf({ 17: [
      { name: 'Aldleigh', px: [100, 100], buildings: [house(House1, 1)] },
      { name: 'Corren', px: [103, 100], buildings: [shop(WeaponSmith, 12)] },
      { name: 'Dunmoor', px: [104, 101], buildings: [shop(WeaponSmith, 14)] },
    ] }, [17, 0], { modsOn: false });
    const q = m.machine.parseQuestForLists(['Quest: __FAR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _far_ remote weaponstore', '', 'variable _done_'], 0, { rolls: () => 0 });
    m.machine.startQuestImmediate(q); m.machine.tick();
    const place = q.getPlace({ name: 'far' });
    const town = townOf(m, place.siteDetails), at = town === 'Corren' ? 1 : 2;
    registerWorldDataAsset(`location-17-${at}.json`, {}, null, { priority: 10, vendor: BV });
    m.state.modsOn = true;
    m.blocks.set(`T17X${at}.RMB`, rmbBlock(`T17X${at}.RMB`, [house(House1, 3)]));
    m.locations[17][at].exterior.buildings = [{ buildingType: House1, factionId: 0, nameSeed: 1, quality: 10 }];
    m.machine.reseatMovedSites(m.world);
    assert.equal(place.siteDetails.buildingKey, 0, 'unseated');
    assert.equal(townOf(m, place.siteDetails), town, 'its town kept');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('QUEST-AUDIT II NEAR-REGION: a region the mods left without a weaponsmith where Daggerfall\'s own had two (Pothago, L0B60Y10\'s `remote weaponstore`, N0C00Y10\'s local one) takes the site in the nearest town of ANOTHER region that has one; AUDIT QA2: a region whose own layout held one the mods left takes that one first, far as it is; a region whose weaponsmith the mods kept, a region that never held one - the mods laying its towns or not - and a `remote shop` no dart admits fail as DFU does (mutants: the region\'s admission not a dart\'s, the region gate, the region\'s supply unasked, its supply the directory\'s alone, the region\'s own towns not first, the nearest unsorted, the fallback unread)', () => {
  const WS = (x) => shop(WeaponSmith, x);
  const regions = ({ mod = true, taken = true, farvale = false, kept = false } = {}) => ({
    40: [
      { name: 'Pothago', px: [300, 300], buildings: [house(House2, 1)], mod, classic: taken ? [house(House2, 1), WS(3)] : undefined },
      { name: 'Menakat', px: [310, 300], buildings: [house(House2, 2)], mod, classic: taken ? [house(House2, 2), WS(4)] : undefined },
      ...(farvale ? [{ name: 'Farvale', px: [380, 330], buildings: [WS(6)] }] : []),
      ...(kept ? [{ name: 'Westreach', px: [360, 300], buildings: [WS(7)] }] : []),   // beyond NEARBY-QUESTS' reach, as Farvale
    ],
    41: [
      { name: 'Far Forge', px: [380, 300], buildings: [WS(5)] },
      { name: 'Near Forge', px: [330, 302], buildings: [WS(6)] },
    ],
  });
  try {
    const m = mapOf(regions(), [40, 0]);
    // Beautiful Cities' own shape: Pothago's and Menakat's directories still LIST their weaponsmiths, the blocks lay none
    for (const loc of m.locations[40]) loc.exterior.buildings.push({ buildingType: WeaponSmith, factionId: 0, nameSeed: 1, quality: 10 });
    const q = quest(m.machine, ['Place _shop_ remote weaponstore']);
    assert.ok(q, 'the quest starts');
    const shopSite = q.getPlace({ name: 'shop' }).siteDetails;
    assert.equal(townOf(m, shopSite), 'Near Forge', 'the nearest of the next region');
    assert.equal(shopSite.regionName, 'Region 41');
    // and a LOCAL weaponsmith (the Mages Guild's N0C00Y10) the mods took from the town: the nearest that has one
    const l = quest(m.machine, ['Place _smith_ local weaponstore']);
    assert.ok(l, 'the local quest starts');
    assert.equal(townOf(m, l.getPlace({ name: 'smith' }).siteDetails), 'Near Forge');
    // AUDIT QA2: the mods left the region one weaponsmith, Farvale's, which the darts miss - the region's own, first
    const f = mapOf(regions({ farvale: true }), [40, 0]);
    assert.equal(townOf(f, quest(f.machine, ['Place _shop_ remote weaponstore']).getPlace({ name: 'shop' }).siteDetails), 'Farvale', 'the region\'s own town, past a nearer one beyond it');
    // AUDIT QA2: a region whose one weaponsmith the mods kept (Westreach's, past the reach) - the search missing it is the
    // port's own law missing it, as in Daggerfall's layout
    const k = mapOf(regions({ taken: false, kept: true }), [40, 0]);
    assert.equal(quest(k.machine, ['Place _shop_ remote weaponstore']), null, 'the mods took nothing from the region');
    // AUDIT QA2: a region no layout of which held a weaponsmith (Isle of Balfiera's palace for the main quest's courier)
    const n = mapOf(regions({ taken: false }), [40, 0]);
    assert.equal(quest(n.machine, ['Place _shop_ remote weaponstore']), null, 'the mods took nothing: DFU\'s law');
    assert.equal(quest(n.machine, ['Place _smith_ local weaponstore']), null, 'and for the local one');
    const c = mapOf(regions({ mod: false, taken: false }), [40, 0]);
    assert.equal(quest(c.machine, ['Place _shop_ remote weaponstore']), null, 'DFU\'s law where the mods changed nothing');
    // AUDIT QA2: a `remote shop` (p2 -1, p3 2) no dart ever admits (the pre-check of type -1): it fails as DFU fails it,
    // the gate asking the region as a dart does - no town walked
    const shopAsk = mapOf(regions(), [40, 0]);
    assert.equal(quest(shopAsk.machine, ['Place _s_ remote shop']), null);
    assert.equal(shopAsk.classicReads(), 0, 'no block of Daggerfall\'s read');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('AUDIT QA2: a person\'s home keeps Person.cs\'s own chain - asked by its group\'s building (a Librarian\'s library) where the mods took the town\'s library, the house of its own town Person.cs falls back to, never another town\'s library; Daggerfall\'s own town, its library; a home chosen again by the load\'s re-seat where the library went, a house of its town; a remote home, a house of its region, never another region\'s library (mutants: the first ask\'s nearTowns unset, the re-seat\'s house rung, NEAR-REGION not barred from the first ask)', () => {
  const towns = (mod) => ({ 17: [
    { name: 'Lambrone', px: [100, 100], buildings: mod ? [house(House1, 1), tavern(5)] : [house(House1, 1), tavern(5), shop(Library, 6)], mod,
      classic: [house(House1, 1), tavern(5), shop(Library, 6)] },
    { name: 'Charton', px: [103, 100], buildings: [shop(Library, 8), house(House1, 2)] },
  ] });
  const FRIEND = ['Person _friend_ group Librarian local'];
  const homeOf = (q) => q.getPlace(q.getPerson({ name: 'friend' }).homePlaceSymbol).siteDetails;
  try {
    const m = mapOf(towns(true), [17, 0]);
    const q = quest(m.machine, FRIEND);
    assert.ok(q, 'the quest starts');
    assert.equal(townOf(m, homeOf(q)), 'Lambrone', 'a home of its own town');
    assert.equal(typeAtKey(m.world, m.locations[17][0], homeOf(q).buildingKey), House1, 'the house Person.cs falls back to');
    const c = mapOf(towns(false), [17, 0], { modsOn: false });
    const cq = quest(c.machine, FRIEND);
    assert.equal(typeAtKey(c.world, c.locations[17][0], homeOf(cq).buildingKey), Library, 'Daggerfall\'s own Lambrone: its library');
    // the load's re-seat of that home once the mods lay Lambrone without its library
    registerWorldDataAsset('location-17-0.json', {}, null, { priority: 10, vendor: BV });
    c.state.modsOn = true;
    c.blocks.set('T17X0.RMB', rmbBlock('T17X0.RMB', [house(House1, 1), tavern(5)]));
    c.locations[17][0].exterior.buildings = [{ buildingType: House1, factionId: 0, nameSeed: 1, quality: 10 }, { buildingType: Tavern, factionId: 0, nameSeed: 1, quality: 10 }];
    c.machine.startQuestImmediate(cq);
    c.machine.reseatMovedSites(c.world);
    assert.equal(townOf(c, homeOf(cq)), 'Lambrone', 'still its own town');
    assert.equal(typeAtKey(c.world, c.locations[17][0], homeOf(cq).buildingKey), House1, 'a house of it');
    // a REMOTE home: the region's library the mods took, the next region's standing - a house of the questor's region,
    // Person.cs's fallback, never another region's library (NEAR-REGION)
    const r = mapOf({
      17: [
        { name: 'Charton', px: [103, 100], buildings: [house(House1, 2)], mod: true, classic: [house(House1, 2), shop(Library, 8)] },
        { name: 'Lambrone', px: [100, 100], buildings: [house(House1, 1), tavern(5)] },
      ],
      18: [{ name: 'Libra', px: [106, 100], buildings: [shop(Library, 9)] }],
    }, [17, 1]);
    const rq = quest(r.machine, ['Person _friend_ group Librarian remote']);
    assert.ok(rq, 'the quest starts');
    assert.equal(townOf(r, homeOf(rq)), 'Charton', 'a house of the region');
    assert.equal(typeAtKey(r.world, r.locations[17][0], homeOf(rq).buildingKey), House1);
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});

test('AUDIT QA2: NEAR-SITE\'s nearest town is the nearest by the travel reckoning in ANY region - the region-first order sent a local apothecary 126 pixels off past one 6 pixels over the border (mutant: the home region first)', () => {
  try {
    const m = mapOf({
      17: [
        { name: 'Larten Plantation', px: [200, 200], buildings: [house(House1, 1)], mod: true, classic: [house(House1, 1), shop(Alchemist, 2)] },
        { name: 'Tsetoaret', px: [320, 200], buildings: [shop(Alchemist, 3)] },
      ],
      18: [{ name: 'Makaka-Ij', px: [204, 202], buildings: [shop(Alchemist, 4)] }],
    }, [17, 0]);
    const q = quest(m.machine, ['Place _chem_ local apothecary']);
    assert.equal(townOf(m, q.getPlace({ name: 'chem' }).siteDetails), 'Makaka-Ij');
  } finally { _resetLayoutPins(); _resetWorldDataReplacement(); }
});
