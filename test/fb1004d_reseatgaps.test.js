// RESEAT-GAPS (FIELD BUGS 2026-10-04d, the town-mods audit: "other re-seat gaps"). Two holes in the re-seat of a quest's
// building site whose town stands in another layout than it was chosen in (Place.reseatMovedSite, AUDIT WD3 S5):
//  - A SITE NO BUILDING OF ITS KIND STANDS FOR kept its old key, which names another building in the town as it stands
//    (a stranger's house, a shop, or none) whose interior its markers do not belong to: the quest's person or thing
//    stood at the old building's coordinates in it, `pc at` fired inside it, a house was opened to the quest's holder as
//    the quest's (IsActiveQuestBuilding), and the town's talk named it. It is UNSEATED now: no building (key 0, DFU's own
//    "none"), its record kept - its town and its building's name for the journal, its markers and what they hold, the
//    key and layout it was chosen in - and tried again at every load: seated back on its own key when its town stands in
//    that layout again, chosen again where a building of its kind stands. The town's pin still asks for that layout.
//  - SIBLINGS WERE CHECKED AGAINST EACH OTHER'S OLD KEYS: a site not chosen again yet named a stranger by its old key,
//    and that stranger was taken from the choice - two sites that both left a town's only House2 were both kept out of
//    it. A site holds a building in the choice only where its key names it (recordStands).
// Every fixture is the producer's: the quest is parsed and started by the real machine in a world of synthetic blocks
// (test/fb1004dTowns.mjs), the layouts are the real layout pins over the real world-data door, and the re-seat is the
// load's own pass (QuestMachine.reseatMovedSites).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QuestMachine } from '../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../src/systems/quest/place.js';
import { configureLayoutPins, _resetLayoutPins, layoutRecordsOf } from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, typeAtKey, mark, SPAWN } from './fb1004dTowns.mjs';
import { openTowns, seeded, SKIP, BV, BC } from './fb1004dArena.mjs';

loadTables();
const { House2, House3, Tavern, GeneralStore } = BUILDING_TYPES;
const MAP_ID = 4242, KEY = 17 + 100 * 958;
const STAMP = `${BV}@1.4.2`;

/** A village whose layout is Beautiful Villages' while the mod is on and Daggerfall's own while it is off - the door
 *  holding the mod's location file for it, the layout pins told where it is - with `classic` and `modded` its block
 *  lists (one block, VILLAGE.RMB). The quest `qbn` is taken there with the mod OFF, so its sites are stamped classic. */
function village({ classic, modded, qbn, rolls = () => 0 }) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  registerWorldDataAsset('location-17-958.json', {}, null, { priority: 10, vendor: BV });
  let on = false;
  configureLayoutPins({ vendorOn: (v) => on && v === BV, vendorVersion: () => '1.4.2', locationKeyOfMapId: (id) => (id === MAP_ID ? KEY : null), gridOf: () => ['VILLAGE.RMB'] });
  const blocks = new Map([['VILLAGE.RMB', rmbBlock('VILLAGE.RMB', classic)]]);
  const aldleigh = town({ name: 'Aldleigh', locationIndex: 0, mapId: MAP_ID, grid: ['VILLAGE.RMB'] });
  let inside = null;
  const world = worldOf({ locations: [aldleigh], blocks, current: aldleigh, inside: () => inside });
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  const quest = machine.parseQuestForLists(['Quest: __GAPS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...qbn, 'variable _done_'], 0, { rolls });
  machine.startQuestImmediate(quest);
  machine.tick();   // the start-up task's placements
  const layout = (mod) => { on = mod; blocks.set('VILLAGE.RMB', rmbBlock('VILLAGE.RMB', mod ? modded : classic)); };
  const enter = (buildingKey) => { inside = buildingKey ? { buildingKey, buildingType: typeAtKey(world, aldleigh, buildingKey) } : null; };
  return { machine, quest, world, blocks, aldleigh, layout, enter, place: (name) => quest.getPlace({ name }) };
}
const keyOf = (place) => place.siteDetails.buildingKey;

test('RESEAT-GAPS: a site no building of its kind stands for is UNSEATED - no building is its own by the old key (nothing of the quest stands in the stranger there, `pc at` never fires in it, no house is opened to its holder), and the journal keeps its building\'s name (mutant: the old key kept)', () => {
  const v = village({
    classic: [{ type: House2 }, { type: Tavern, markers: [mark(SPAWN, 40, 0, 40)] }],
    modded: [{ type: House2 }, { type: GeneralStore }],   // the tavern's cell a general store now
    qbn: ['Item _gem_ sapphire', 'Place _inn_ local tavern', '', '\tplace item _gem_ at _inn_', ''],
  });
  const inn = v.place('inn');
  const oldKey = keyOf(inn), name = inn.siteDetails.buildingName;
  assert.equal(typeAtKey(v.world, v.aldleigh, oldKey), Tavern, 'chosen in the village\'s own tavern');
  assert.equal(v.machine.getSiteLinks(SITE_TYPES.Building, MAP_ID, oldKey).length, 1, 'its gem is placed there');
  v.layout(true);   // the village now stands in Beautiful Villages' layout: no tavern
  assert.equal(typeAtKey(v.world, v.aldleigh, oldKey), GeneralStore, 'the old key names a stranger now');
  assert.equal(v.machine.reseatMovedSites(v.world), 1, 'its record changed');
  assert.equal(keyOf(inn), 0, 'no building is its own');
  assert.deepEqual(inn.siteDetails.unseated, { buildingKey: oldKey }, 'the record keeps the key it was chosen at (classic: no stamp)');
  assert.equal(inn.siteDetails.buildingName, name, 'the journal still names the inn');
  assert.equal(inn.siteDetails.locationName, 'Aldleigh');
  assert.deepEqual(v.machine.getSiteLinks(SITE_TYPES.Building, MAP_ID, oldKey), [], 'entering the stranger stands nothing of the quest there');
  v.enter(oldKey);
  assert.equal(inn.isPlayerHere(), false, '`pc at _inn_` does not fire in the stranger');
  assert.equal(v.machine.isActiveQuestBuilding(MAP_ID, oldKey, GeneralStore, false), false, 'nor is the stranger the quest\'s building');
  assert.equal(v.machine.reseatMovedSites(v.world), 0, 'tried again at the next load, and nothing to change');
  // the town's pin still asks for the layout the site was chosen in - a pack that could not load comes back to it
  assert.deepEqual(layoutRecordsOf({ sites: v.machine.getAllActiveQuestSites() }, { locationKeyOfMapId: (id) => (id === MAP_ID ? KEY : null) }),
    [{ locationKey: KEY, stamp: undefined, kind: 'quest' }]);
});

test('RESEAT-GAPS: an unseated site is SEATED BACK on its own key the moment its town stands in the layout it was chosen in again - the gem placed there with it', () => {
  const v = village({
    classic: [{ type: House2 }, { type: Tavern, markers: [mark(SPAWN, 40, 0, 40)] }],
    modded: [{ type: House2 }, { type: GeneralStore }],
    qbn: ['Item _gem_ sapphire', 'Place _inn_ local tavern', '', '\tplace item _gem_ at _inn_', ''],
  });
  const inn = v.place('inn');
  const oldKey = keyOf(inn);
  const targets = JSON.stringify(inn.siteDetails.selectedMarker.targetResources);
  v.layout(true); v.machine.reseatMovedSites(v.world);
  assert.equal(keyOf(inn), 0);
  v.layout(false);   // the mod's pack did not load this time: Daggerfall's own village stands again
  assert.equal(v.machine.reseatMovedSites(v.world), 1);
  assert.equal(keyOf(inn), oldKey, 'its own tavern again');
  assert.equal('unseated' in inn.siteDetails, false);
  assert.equal(JSON.stringify(inn.siteDetails.selectedMarker.targetResources), targets, 'the gem still on its marker');
  assert.equal(v.machine.getSiteLinks(SITE_TYPES.Building, MAP_ID, oldKey).length, 1, 'its link follows back');
});

test('RESEAT-GAPS: an unseated site is chosen again where a building of its kind stands at a later load - what was assigned to it carried onto that building\'s own marker, stamped in the layout it stands in', () => {
  const v = village({
    classic: [{ type: House2 }, { type: Tavern, markers: [mark(SPAWN, 40, 0, 40)] }],
    modded: [{ type: House2 }, { type: GeneralStore }],
    qbn: ['Item _gem_ sapphire', 'Place _inn_ local tavern', '', '\tplace item _gem_ at _inn_', ''],
  });
  const inn = v.place('inn');
  v.layout(true); v.machine.reseatMovedSites(v.world);
  // the mod's next layout of the village (its pack updated) stands a tavern in a third building
  v.blocks.set('VILLAGE.RMB', rmbBlock('VILLAGE.RMB', [{ type: House2 }, { type: GeneralStore }, { type: Tavern, markers: [mark(SPAWN, 80, 0, 16)] }]));
  assert.equal(v.machine.reseatMovedSites(v.world), 1);
  assert.equal(typeAtKey(v.world, v.aldleigh, keyOf(inn)), Tavern, 'a tavern again');
  assert.equal('unseated' in inn.siteDetails, false);
  assert.equal(inn.siteDetails.layout, STAMP, 'stamped in the layout it stands in now');
  assert.deepEqual(inn.siteDetails.selectedMarker.flatPosition, { x: 80 * 0.025, y: -0, z: 16 * 0.025 }, 'on the new tavern\'s own marker');
  assert.deepEqual(inn.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['gem']);
});

test('RESEAT-GAPS: siblings are checked against each other only where they stand - a site not chosen again yet no longer keeps the next one out of the building its old key names, so the town\'s only House2 is chosen again (it was lost to both); and no two land in one building (mutant: the stale key compared)', () => {
  const v = village({
    classic: [{ type: House2 }, { type: House2 }, { type: Tavern }],
    modded: [{ type: House3 }, { type: House2 }, { type: House3 }],   // the House2 stands where _b_ was, alone
    qbn: ['Place _a_ local house2', 'Place _b_ local house2'],
  });
  const a = v.place('a'), b = v.place('b');
  assert.deepEqual([keyOf(a) & 0xff, keyOf(b) & 0xff], [0, 1], 'the two House2 of the village, one each');
  v.layout(true);
  assert.equal(v.machine.reseatMovedSites(v.world), 2);
  assert.equal(typeAtKey(v.world, v.aldleigh, keyOf(a)), House2, '_a_ takes the House2 _b_\'s old key names - _b_ does not hold it any more');
  assert.equal(typeAtKey(v.world, v.aldleigh, keyOf(b)), House3, '_b_ falls back to a house');
  assert.notEqual(keyOf(a), keyOf(b), 'one building each');
  // the choice for a NEW site at quest start reads the same law: a standing site keeps its building
  const c = new Place(v.quest, 'Place _c_ local house2');
  assert.equal(c.p2, -1, 'the town\'s one House2 is _a_\'s: a new house2 falls back to any house');
  assert.ok(![keyOf(a)].includes(keyOf(c)));
});

/** Every city (TownCity, MapTable LocationType 0) of the world, by its region's table - no location read to find them. */
function* everyCity(maps) {
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r); if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) if (reg.mapTable[l].locationType === 0) yield { r, l, mapId: reg.mapTable[l].mapId };
  }
}
test('RESEAT-GAPS with ARENA2: the cities Beautiful Cities lays out with no weaponsmith - a `local weaponstore` site chosen in Daggerfall\'s own city is never left on a stranger\'s key: PIN MOVED (QUEST-AUDIT II NEAR-SITE) - the mods took the city\'s weaponsmith, so it is taken in the weaponsmith of the nearest town that has one, never unseated while one stands; in the cities that keep one, it is chosen again in a weaponsmith of the city', { skip: SKIP }, async (t) => {
  const { maps, world, LP, keyOf: keyOfMap } = await openTowns({ mods: true });
  const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  let unseated = 0, smiths = 0, near = 0, cities = 0;
  const probe = new Place({ uid: 1, resources: new Map(), hooks: {}, rolls: () => 0 });
  probe.symbol = { original: '_x_', name: 'x', clone() { return this; } };
  try {
    for (const { r, l, mapId } of everyCity(maps)) {
      if (!LP.layoutModTouches(BC, r + 100 * l)) continue;
      const key = keyOfMap(mapId);
      LP.setLayoutPins(new Map([[key, { out: new Set([BV, BC]), in: new Set(), stamp: 'classic', why: 'test' }]]));   // Daggerfall's own city
      const classic = maps.getLocation(r, l);
      const loc = classic;
      if (!probe._collectQuestSitesOfBuildingType(world(classic), classic, 13, 0).length) { LP.setLayoutPins(new Map()); continue; }
      const place = new Place({ uid: 9, resources: new Map(), hooks: { world: world(classic) }, rolls: seeded(cities + 7) }, 'Place _smith_ local weaponstore');
      const oldKey = place.siteDetails.buildingKey;
      LP.setLayoutPins(new Map());   // the city as Beautiful Cities stands it
      const modded = maps.getLocation(r, l);
      const w = world(modded);
      cities++;
      assert.equal(place.reseatMovedSite(w), true, `${loc.name}: moved`);
      if (place.siteDetails.unseated) {
        unseated++;
        assert.equal(place.siteDetails.buildingKey, 0, `${loc.name}: no stranger by the old key`);
        assert.equal(place.siteDetails.unseated.buildingKey, oldKey);
      } else {
        const town = place.siteTown(w);
        if (town.mapTableData.mapId === mapId) smiths++;
        else {
          near++;
          assert.equal(probe._collectQuestSitesOfBuildingType(w, modded, 13, 0).length, 0, `${loc.name}: another town's only where the city holds none`);
        }
        const k = place.siteDetails.buildingKey;
        const tp = w.getBlock(maps.getRmbBlockName(town, (k >> 16) & 0xff, (k >> 8) & 0xff)).rmbBlock.fldHeader.buildingDataList[k & 0xff].buildingType;
        assert.equal(tp, 13, `${loc.name}: chosen again in a weaponsmith (${town.name})`);
      }
    }
  } finally { console.log = log; console.warn = warn; LP.setLayoutPins(new Map()); }
  t.diagnostic(`${cities} cities with a weaponsmith in Daggerfall's layout: ${smiths} chosen again in one of Beautiful Cities', ${near} in the nearest town's, ${unseated} unseated`);
  assert.ok(near > 0 && smiths > 0, 'both arms met');
  assert.equal(unseated, 0, 'never unseated while a weaponsmith stands');
});
