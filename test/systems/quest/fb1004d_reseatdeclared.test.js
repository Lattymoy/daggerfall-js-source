// RESEAT-DECLARED (FIELD BUGS 2026-10-04d, the town-mods audit: "re-seating a moved quest site turns a house into a
// tavern or shop"). A quest's building site whose town stands in another layout than it was chosen in is chosen again
// in the town as it stands (Place.reseatMovedSite, AUDIT WD3 S5) - by the place's own law. But that law was read off
// the Place's p2, and a house type that found none of its kind falls back to any house and WRITES p2 = -1 into the
// place (SetupLocalSite, Place.cs:735; SelectRemoteTownSite after 250 darts, :815) - and -1 with a p3 of 0 is
// `random`, any valid building (Quests-Places). Measured over the player's own towns: in 40 of Beautiful Villages'
// villages with no House1, `Place _mansion_ local house1` re-seated 125 times landed in House2 86, Tavern 28, House4 10
// and a general store once. The re-seat now reads the place's DECLARED P2/P3 again from Quests-Places by its name, and
// keeps the search's own house fallback (any house) - one search, the setup's and the re-seat's.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place } from '../../../src/systems/quest/place.js';
import { configureLayoutPins, _resetLayoutPins } from '../../../src/systems/layoutPins.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, typeAtKey } from '../../fb1004dTowns.mjs';
import { openTowns, everyLocation, seeded, SKIP, BV } from '../../fb1004dArena.mjs';

loadTables();
const { House1, House2, House3, House4, Tavern, GeneralStore } = BUILDING_TYPES;
const HOUSES = [House1, House2, House3, House4];
const MAP_ID = 4242, KEY = 17 + 100 * 958;

/** A village with no House1, its one house a House2 - the quest is taken there (the player stands in it, `local`) - and
 *  then the village laid out again: two houses, a tavern and a general store, still no House1. */
function village() {
  _resetLayoutPins();
  configureLayoutPins({ vendorOn: () => false, locationKeyOfMapId: (id) => (id === MAP_ID ? KEY : null) });
  const blocks = new Map([['VILLAGE.RMB', rmbBlock('VILLAGE.RMB', [{ type: House2 }, { type: Tavern }, { type: GeneralStore }])]]);
  const aldleigh = town({ name: 'Aldleigh', locationIndex: 0, mapId: MAP_ID, grid: ['VILLAGE.RMB'] });
  const world = worldOf({ locations: [aldleigh], blocks, current: aldleigh });
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  const quest = machine.parseQuestForLists(['Quest: __HOUSE1', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _mansion_ local house1', 'variable _done_'], 0, { rolls: () => 0 });
  machine.startQuestImmediate(quest);
  const mansion = quest.getPlace({ name: 'mansion' });
  const moved = () => {
    blocks.set('VILLAGE.RMB', rmbBlock('VILLAGE.RMB', [{ type: Tavern }, { type: GeneralStore }, { type: House2 }, { type: House3 }]));
    mansion.siteDetails.layout = `${BV}@1.4.2`;   // chosen in Beautiful Villages' layout; the town stands in Daggerfall's own now
  };
  return { machine, quest, mansion, world, aldleigh, moved };
}

test('RESEAT-DECLARED: a `local house1` in a village with no House1 falls back to its house and writes P2 = -1 into the place (DFU\'s own law, kept) - its declared law is still house1, read again from Quests-Places by its name', () => {
  const { mansion, world, aldleigh } = village();
  assert.equal(mansion.name, 'house1');
  assert.equal(mansion.p2, -1, 'SetupLocalSite\'s fallback (Place.cs:735)');
  assert.equal(mansion.p3, 0);
  assert.equal(typeAtKey(world, aldleigh, mansion.siteDetails.buildingKey), House2, 'the village\'s one house');
  assert.deepEqual(mansion.declaredSiteLaw(), { p2: 17, p3: 0 }, 'Quests-Places: house1, 0, 17, 0');
  const byHand = new Place(null); byHand.p2 = 18; byHand.p3 = 0;
  assert.deepEqual(byHand.declaredSiteLaw(), { p2: 18, p3: 0 }, 'a place with no row of the table has only what it holds');
});

test('RESEAT-DECLARED: the moved site is chosen again by its DECLARED law - every roll lands it in a house of the village as it stands, never the tavern or the general store the -1 read as `random` offered (mutant: the re-seat reads the place\'s p2 again)', () => {
  const landed = new Map();
  for (let i = 0; i < 20; i++) {
    const { machine, quest, mansion, world, aldleigh, moved } = village();
    moved();
    quest.rolls = () => (i + 0.5) / 20;
    assert.equal(machine.reseatMovedSites(world), 1, `roll ${i}: chosen again`);
    const type = typeAtKey(world, aldleigh, mansion.siteDetails.buildingKey);
    landed.set(type, (landed.get(type) ?? 0) + 1);
    assert.ok(HOUSES.includes(type), `roll ${i}: a house, not building type ${type}`);
    assert.equal(mansion.p2, -1, 'the place itself is left as DFU left it');
  }
  assert.deepEqual([...landed.keys()].sort(), [House2, House3], 'both houses of the village drawn, as the house fallback offers them');
});

test('RESEAT-DECLARED: a type the village still has is chosen again by that type - the fallback is the house search\'s own, taken only when no building of the declared type stands', () => {
  const { machine, quest, mansion, world, aldleigh, moved } = village();
  moved();
  const blocks = world.getBlock('VILLAGE.RMB');
  blocks.rmbBlock.fldHeader.buildingDataList[3].buildingType = House1;   // the new layout's last house a House1
  quest.rolls = () => 0.99;
  machine.reseatMovedSites(world);
  assert.equal(typeAtKey(world, aldleigh, mansion.siteDetails.buildingKey), House1, 'a House1 stands: the declared house1 takes it');
});

test('RESEAT-DECLARED with ARENA2: the audit\'s measure over the player\'s own towns - in the first 40 of Beautiful Villages\' villages with no House1 (and a tavern or a shop), `Place _mansion_ local house1` re-seated five times each lands in a house every time', { skip: SKIP }, async (t) => {
  const { maps, world, LP } = await openTowns({ mods: true });
  const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  const types = new Map();
  let towns = 0, reseats = 0;
  try {
    const probe = new Place({ uid: 1, resources: new Map(), hooks: {}, rolls: () => 0 });
    for (const { r, l, loc } of everyLocation(maps)) {
      if (towns >= 40) break;
      if (!loc?.exterior?.exteriorData || loc.mapTableData.locationType !== 2) continue;
      if (!LP.layoutModTouches(BV, r + 100 * l)) continue;
      const w = world(loc);
      probe.symbol = { original: '_x_', name: 'x', clone() { return this; } };
      if (probe._collectQuestSitesOfBuildingType(w, loc, House1, 0).length) continue;
      if (!probe._collectQuestSitesOfBuildingType(w, loc, 0xfffe, 1).length) continue;
      if (!probe._collectQuestSitesOfBuildingType(w, loc, Tavern, 0).length && !probe._collectQuestSitesOfBuildingType(w, loc, GeneralStore, 0).length) continue;
      const roll = seeded(towns + 1);
      const place = new Place({ uid: 9, resources: new Map(), hooks: { world: w }, rolls: roll }, 'Place _mansion_ local house1');
      assert.equal(place.p2, -1, `${loc.name}: the house fallback ran`);
      towns++;
      place.siteDetails.layout = `${BV}@1.4.2+beautiful-cities@0.5.0`;   // a layout the village does not stand in now
      const was = structuredClone(place.siteDetails);
      for (let i = 0; i < 5; i++) {
        place.siteDetails = structuredClone(was);
        if (!place.reseatMovedSite(w)) continue;
        reseats++;
        const [x, y, rec] = [(place.siteDetails.buildingKey >> 16) & 0xff, (place.siteDetails.buildingKey >> 8) & 0xff, place.siteDetails.buildingKey & 0xff];
        const t = w.getBlock(maps.getRmbBlockName(loc, x, y)).rmbBlock.fldHeader.buildingDataList[rec].buildingType;
        types.set(t, (types.get(t) ?? 0) + 1);
      }
    }
  } finally { console.log = log; console.warn = warn; }
  assert.equal(towns, 40);
  assert.ok(reseats >= 100, `${reseats} re-seats`);
  t.diagnostic(`${reseats} re-seats in ${towns} villages: ${[...types].map(([k, n]) => `type ${k} x${n}`).join(', ')}`);
  for (const t of types.keys()) assert.ok(HOUSES.includes(t), `a re-seat landed in building type ${t}: ${JSON.stringify([...types])}`);
});
