// FIELD BUGS 2026-10-09b - HALL-STAMP, the Discord's "Yesterday i had DB's guild highlighted on map, today its not
// highlighted, but i still can enter building (prompt not showing tho, when im aiming at door). Im still in guild and
// can take quests".
//
// RevealGuildHallOnMap names a member's hall "The Dark Brotherhood" as an override (systems/guildHallReveal.js), and
// that override is the hall's plate on the town map (a House2 is a residence: only isOverrideName plates it) and its
// name at the door. Every Dark Brotherhood contract's questor stands at the hall, so the contract's questor Place IS
// the hall - named '' (a House2 has no name of its own, world/buildingNames.js). The port's own re-stamp (DISC28-K: a
// discovered building takes the live quest's name, at a door's look and at the town map's open) read that '' as a
// name and wrote it over the reveal: no plate, no prompt, the door still opening for a member. It never stamps a
// hideout now (UndiscoverBuilding's own shield), and a nameless Place names nothing. `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as discovery from '../src/systems/discovery.js';
import { revealGuildHallsOnMap } from '../src/systems/guildHallReveal.js';
import { GUILDS, joinGuild } from '../src/systems/guilds.js';
import { generateBuildingName, BUILDING_TYPES } from '../src/world/buildingNames.js';

const LOC = '17:Daggerfall', MAP = 111;
const LAIR = { buildingKey: 7003, name: '', factionId: 108, buildingType: BUILDING_TYPES.House2, quality: 40 };
const DEN = { buildingKey: 7004, name: '', factionId: 42, buildingType: BUILDING_TYPES.House2, quality: 40 };
const HOUSE = { buildingKey: 7005, name: '', factionId: 0, buildingType: BUILDING_TYPES.House2, quality: 40 };
const factionName = (id) => ({ 42: 'The Thieves Guild', 108: 'The Dark Brotherhood' })[id] ?? '';
/** The quest seam as topicTree.isBuildingQuestResource answers it: a learned quest Place at `key`, named `name` (the
 *  Place's siteDetails.buildingName - '' for a House2). */
const contract = (key, name) => ({
  currentMapID: () => MAP, ownsHouse: () => false,
  isBuildingQuestResource: (m, k) => ({ isQuestResource: m === MAP && k === key, overrideBuildingName: m === MAP && k === key ? name : '',
    pcLearnedAboutExistence: m === MAP && k === key, receivedDirectionalHints: false, locationWasMarkedOnMapByNPC: false }),
});
const rec = (key) => discovery.discoveredBuildings(LOC).find((r) => r.buildingKey === key);

test('HALL-STAMP: a member\'s revealed hall keeps its name under a live contract whose Place it is - at the door\'s look and the town map\'s open, the Dark Brotherhood\'s and the Thieves Guild\'s alike (mutants: the hideouts unshielded)', () => {
  assert.equal(generateBuildingName(777, BUILDING_TYPES.House2), '', 'the Place\'s own name for a hall: a House2 has none');
  discovery.restoreDiscovery(null);
  const book = {};
  joinGuild(book, GUILDS.DarkBrotherhood, 0);
  joinGuild(book, GUILDS.ThievesGuild, 0);
  assert.equal(revealGuildHallsOnMap(book, LOC, [LAIR, DEN], { factionName }), 2);
  for (const [hall, name] of [[LAIR, 'The Dark Brotherhood'], [DEN, 'The Thieves Guild']]) {
    // the door's look (worldModes.js's discoverBuilding with the quest source) and the map's open (restampQuestNames)
    assert.equal(discovery.discoverBuilding(LOC, hall, null, contract(hall.buildingKey, '')), false, `${name}: the door's look moves nothing`);
    assert.equal(discovery.restampQuestNames(LOC, contract(hall.buildingKey, '')), 0, `${name}: the map's open moves nothing`);
    // a named Place on a hideout (a quest's own rename) is no plate of its either - the reveal's name is the member's
    assert.equal(discovery.restampQuestNames(LOC, contract(hall.buildingKey, 'The Old Mill')), 0);
    assert.deepEqual([rec(hall.buildingKey).displayName, rec(hall.buildingKey).isOverrideName], [name, true], `${name}: plated, and named at the door`);
  }
  discovery.restoreDiscovery(null);
});

test('HALL-STAMP: a nameless Place names nothing on any building, a named one still re-stamps (DISC28-K kept); a hall already blanked heals on the next reveal (mutant: a nameless Place stamped)', () => {
  discovery.restoreDiscovery(null);
  discovery.discoverBuilding(LOC, HOUSE, null, contract(HOUSE.buildingKey, 'The Selvani Residence'));
  assert.equal(rec(HOUSE.buildingKey).displayName, 'The Selvani Residence');
  assert.equal(discovery.restampQuestNames(LOC, contract(HOUSE.buildingKey, '')), 0, 'a nameless Place: the stored name stands');
  assert.equal(rec(HOUSE.buildingKey).displayName, 'The Selvani Residence');
  assert.equal(discovery.restampQuestNames(LOC, contract(HOUSE.buildingKey, 'The Direnni Residence')), 1, 'a named one re-stamps as it did');
  assert.deepEqual([rec(HOUSE.buildingKey).displayName, rec(HOUSE.buildingKey).isOverrideName], ['The Direnni Residence', true]);
  // a save that carries the blank the bug wrote: the reveal on the next entry names it again
  discovery.restoreDiscovery({ buildings: { [LOC]: { [LAIR.buildingKey]: { buildingKey: LAIR.buildingKey, displayName: '', factionId: 108, quality: 40, buildingType: LAIR.buildingType, lastLockpickAttempt: 0, customUserDisplayName: '', isOverrideName: false, oldDisplayName: '' } } } });
  assert.deepEqual([rec(LAIR.buildingKey).displayName, rec(LAIR.buildingKey).isOverrideName], ['', false], 'the save as the bug left it');
  const book = {};
  joinGuild(book, GUILDS.DarkBrotherhood, 0);
  revealGuildHallsOnMap(book, LOC, [LAIR], { factionName });
  assert.deepEqual([rec(LAIR.buildingKey).displayName, rec(LAIR.buildingKey).isOverrideName], ['The Dark Brotherhood', true]);
  discovery.restoreDiscovery(null);
});
