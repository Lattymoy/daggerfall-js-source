// FIELD BUGS 2026-10-22b (the Discord's #bug-reports, "Delivery/Courier Quest Cannot Be Completed" - Baffle: "At this
// town, cannot ask about the recipient of the delivery, checked every home, palace, and the inn for him with no luck";
// InZaNeXe: "Same issue here"). The journal in the screenshot is A0C00Y15's (The Courier: `Person _pickupregion_ face
// 232 group Local_3.0 remote`, `create npc _pickupregion_`); A0C00Y14 (The Delivery Boy) is its `local` twin.
//  - THE COURIER, END TO END, over the real parser, machine, topic tree and scene mount in a region of the port's own
//    blocks (test/fb1004dTowns.mjs): the recipient is homed in a house of another town, `create npc` puts him there - his
//    home's marker holds him, the quest holds its own link to the house, the house is the quest's (unlocked at night,
//    PlayerActivate.IsActiveQuestBuilding), the talk's Where is -> People names him in his town and not in the
//    questor's, and the house's mount stands him. The record traced every one of these on the live host too; this
//    holds them, the chain a player's courier walks.
//  - CREATE-HOME: the Settings' repair (systems/quest/questRepair.js) puts back a person `create npc` placed - it read
//    the `place` actions alone, and answered "Nothing was missing" over a recipient no marker held - and assigns him
//    where no Place is assigned him, which is what the talk's Where is reads. Never a questor or an individual, whom
//    Person.PlaceAtHome refuses.
// bible/01-Overview/bugs/Field-Bugs-2026-10-22b.md.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { addQuestResourceObjects } from '../../../src/systems/quest/sceneMount.js';
import { repairActiveQuests } from '../../../src/systems/quest/questRepair.js';
import { TopicTree } from '../../../src/systems/topicTree.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, questScript } from '../../fb1004dTowns.mjs';
import { seeded } from '../../fb1004dArena.mjs';

loadTables();
const { House1, House2, Tavern } = BUILDING_TYPES;
const OXWYCH = 7445, MOORHART = 3681;

/** The questor's town (a tavern and a house) and the recipient's (a tavern and two houses), the player in the first;
 *  `quest` started there through the machine's own door and ticked once - its start-up task's `create npc`. A talk tree
 *  hears the quest as the host's does (machine deps.addQuestTopics). */
function courier(name = 'A0C00Y15', { seed = 1 } = {}) {
  const blocks = new Map([
    ['QUESTOR.RMB', rmbBlock('QUESTOR.RMB', [{ type: Tavern }, { type: House1 }])],
    ['MANOR.RMB', rmbBlock('MANOR.RMB', [{ type: Tavern }, { type: House2 }, { type: House2 }])],
  ]);
  const oxwych = town({ name: 'Oxwych', locationIndex: 0, mapId: OXWYCH, grid: ['QUESTOR.RMB'], regionIndex: 58, regionName: 'Tulune' });
  const moorhart = town({ name: 'Moorhart Hall', locationIndex: 1, mapId: MOORHART, grid: ['MANOR.RMB'], regionIndex: 58, regionName: 'Tulune' });
  const world = worldOf({ locations: [oxwych, moorhart], blocks, current: oxwych, regionIndex: 58, regionName: 'Tulune' });
  let tree = null;
  let mapNow = OXWYCH;
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {}, addQuestTopics: (q) => tree.addQuestTopicsForQuest(q) });
  tree = new TopicTree({
    getQuest: (uid) => machine.getQuest(uid), getAllActiveQuestIds: () => [...machine.quests.keys()],
    currentMapId: () => mapNow, getBuildingList: () => [], exteriorBuildings: () => [], talkPartner: () => null,
  });
  const quest = machine.parseQuestForLists(questScript(name), 0, { rolls: seeded(seed) });
  machine.startQuestImmediate(quest);
  machine.tick();   // the start-up task: start timer, log, the picks, create npc
  const symbol = name === 'A0C00Y14' ? 'pickuplocal' : 'pickupregion';
  const person = quest.getPerson({ name: symbol });
  const home = quest.getPlace(person.homePlaceSymbol);
  /** Where is -> People, as the talk assembles it standing in the town of `mapId`. */
  const peopleIn = (mapId) => { mapNow = mapId; tree.assembleTopicListPerson(); return tree.listTopicPerson.map((i) => i.caption); };
  /** The names a building's mount stands there (GameObjectHelper.AddQuestResourceObjects over the site's links). */
  const standsIn = (mapId, buildingKey) => {
    const stood = [];
    addQuestResourceObjects(machine, { currentMapId: () => mapId, findBehaviours: () => [], standNPC: ({ person: p }) => { stood.push(p.symbol.name); return null; } }, SITE_TYPES.Building, buildingKey);
    return stood;
  };
  /** Every marker of the recipient's home that holds him. */
  const holding = () => [home.siteDetails.selectedMarker, ...(home.siteDetails.questSpawnMarkers ?? [])].filter((m) => (m?.targetResources ?? []).some((s) => s.name === symbol)).length;
  return { machine, quest, person, home, symbol, peopleIn, standsIn, holding };
}

test('FB1022B THE COURIER, END TO END: A0C00Y15\'s recipient is homed in a house of ANOTHER town and `create npc` puts him there - his home\'s marker holds him, the quest holds its own link to that house, the house is the quest\'s (open at night), the talk names him in his town and not in the questor\'s, and the house\'s mount stands him (mutants: create npc places nobody; the talk names him in any town)', () => {
  for (const seed of [1, 2, 3]) {
    const c = courier('A0C00Y15', { seed });
    const sd = c.home.siteDetails;
    assert.equal(c.person.getAssignedPlaceSymbol()?.name, 'pickupregion_home', `seed ${seed}: create npc assigned him his home`);
    assert.equal(sd.siteType, SITE_TYPES.Building);
    assert.equal(sd.mapId, MOORHART, 'remote: the other town of the region');
    assert.equal(sd.locationName, 'Moorhart Hall', 'the journal\'s ___pickupregion_');
    assert.equal(c.holding(), 1, 'his home holds him on a marker');
    assert.ok(c.machine.getSiteLinks(SITE_TYPES.Building, MOORHART, sd.buildingKey).some((l) => l.questUID === c.quest.uid), 'the quest\'s own link to his house');
    assert.equal(c.machine.isActiveQuestBuilding(MOORHART, sd.buildingKey, House2), true, 'his house is the quest\'s: unlocked at any hour');
    assert.deepEqual(c.peopleIn(MOORHART), [c.person.displayName], 'Where is -> People in his town names him');
    assert.deepEqual(c.peopleIn(OXWYCH), [], 'and not in the questor\'s');
    assert.deepEqual(c.standsIn(MOORHART, sd.buildingKey), ['pickupregion'], 'his house stands him');
    assert.deepEqual(c.standsIn(OXWYCH, sd.buildingKey), [], 'the same key in another town stands nobody');
  }
});

test('FB1022B THE DELIVERY BOY: A0C00Y14\'s `local` recipient is homed in a house of the questor\'s own town - placed, held, linked, named there and stood', () => {
  const c = courier('A0C00Y14');
  const sd = c.home.siteDetails;
  assert.equal(c.person.getAssignedPlaceSymbol()?.name, 'pickuplocal_home');
  assert.equal(sd.mapId, OXWYCH, 'local: the questor\'s town');
  assert.equal(c.holding(), 1);
  assert.deepEqual(c.peopleIn(OXWYCH), [c.person.displayName]);
  assert.deepEqual(c.standsIn(OXWYCH, sd.buildingKey), ['pickuplocal']);
});

/** The fault QREPAIR answers: a site's targets taken (a partner's resync replacing the siteDetails), the action that put
 *  them there complete and never run again. */
const lose = (c) => {
  const sd = c.home.siteDetails;
  c.home.siteDetails = { ...sd, selectedMarker: { ...sd.selectedMarker, targetResources: null }, questSpawnMarkers: (sd.questSpawnMarkers ?? []).map((m) => ({ ...m, targetResources: null })) };
};

test('FB1022B CREATE-HOME: the repair puts back a recipient `create npc` placed and a fault took - at his home, held, linked and stood again; with nothing missing it says so (mutant: the repair reads the `place` actions alone)', () => {
  const c = courier();
  const fine = repairActiveQuests(c.machine);
  assert.equal(fine.people, 0, 'nothing missing: nothing put back');
  lose(c);
  assert.equal(c.holding(), 0, 'no marker holds him');
  assert.deepEqual(c.standsIn(MOORHART, c.home.siteDetails.buildingKey), [], 'and his house stands nobody - the report');
  const r = repairActiveQuests(c.machine);
  assert.equal(r.people, 1, 'the recipient put back');
  assert.equal(c.holding(), 1, 'at his home');
  assert.deepEqual(c.standsIn(MOORHART, c.home.siteDetails.buildingKey), ['pickupregion'], 'his house stands him again');
  assert.match(r.text, /put back 1 person/);
});

test('FB1022B CREATE-HOME: a recipient put back where no Place is assigned him is assigned his home - the talk\'s Where is names him again (mutant: the assignment left empty)', () => {
  const c = courier();
  lose(c);
  c.person.setAssignedPlaceSymbol(null);
  assert.deepEqual(c.peopleIn(MOORHART), [], 'unassigned, the talk names nobody - the report');
  repairActiveQuests(c.machine);
  assert.equal(c.person.getAssignedPlaceSymbol()?.name, 'pickupregion_home');
  assert.deepEqual(c.peopleIn(MOORHART), [c.person.displayName], 'Where is -> People names him again');
});

test('FB1022B CREATE-HOME: never a questor or an individual, whom Person.PlaceAtHome refuses - the repair stands neither at a home `create npc` never put them in (mutants: the questor homed; the individual homed)', () => {
  for (const flag of ['isQuestor', 'isIndividualNPC']) {
    const c = courier();
    lose(c);
    c.person[flag] = true;
    assert.equal(repairActiveQuests(c.machine).people, 0, `${flag}: nothing put back`);
    assert.equal(c.holding(), 0, `${flag}: no marker holds them`);
  }
});
