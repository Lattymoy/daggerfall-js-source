// DISC28-K (2026-09-28, Discord: two Mages Guild "cast the Sleep spell" jobs sent to the same house - the second showed
// the first's residence name). A residence Place rolls a fresh surname on every pick (Place.cs:1219-1224, :1298-1311),
// and discoverBuilding returned early on any building already discovered (PlayerGPS.cs:926-927) - before the live
// quest's name was read. The first job's name was never cleared: both undiscovers act at the current location only and
// only on a stored name equal to the new one. DFU does the same; the port re-stamps a stored name the live quest no
// longer gives (Port-Ledger A). Driven through the real discovery store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverBuilding, getDiscoveredBuilding, restoreDiscovery, snapshotDiscovery } from '../../src/systems/discovery.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';

const LOC = 0x400, KEY = 77;
const house = { buildingKey: KEY, name: 'Residence', buildingType: BUILDING_TYPES.House1, factionId: 0, quality: 5 };
const quest = (name, learned = true) => ({
  currentMapID: () => 111,
  isBuildingQuestResource: (mapId, key) => (mapId === 111 && key === KEY ? { isQuestResource: true, pcLearnedAboutExistence: learned, overrideBuildingName: name } : null),
});
const fresh = () => restoreDiscovery({ ...snapshotDiscovery(), buildings: {} });

test('DISC28-K: the second job\'s name displaces the first job\'s on a house already discovered', () => {
  fresh();
  assert.equal(discoverBuilding(LOC, house, null, quest('The Selvani Residence')), true);
  assert.equal(getDiscoveredBuilding(LOC, KEY).displayName, 'The Selvani Residence');
  // the first job ended in another town; the second picked the same house and rolled another name
  assert.equal(discoverBuilding(LOC, house, null, quest('The Direnni Residence')), true, 'the record is re-stamped');
  const rec = getDiscoveredBuilding(LOC, KEY);
  assert.equal(rec.displayName, 'The Direnni Residence');
  assert.equal(rec.isOverrideName, true);
  assert.equal(rec.oldDisplayName, 'Residence', 'the name the override displaced is the building\'s own, as a fresh stamp\'s');
});

test('DISC28-K: what the early return still holds - the same name, a name not yet learned, no quest at all', () => {
  fresh();
  discoverBuilding(LOC, house, null, quest('The Selvani Residence'));
  assert.equal(discoverBuilding(LOC, house, null, quest('The Selvani Residence')), false, 'the same name: nothing to do');
  assert.equal(discoverBuilding(LOC, house, null, quest('The Direnni Residence', false)), false, 'a name the player has not learned is not shown');
  assert.equal(discoverBuilding(LOC, house, null, null), false, 'no quest source');
  assert.equal(getDiscoveredBuilding(LOC, KEY).displayName, 'The Selvani Residence');
});
