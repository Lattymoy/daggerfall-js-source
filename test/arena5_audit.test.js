// ARENA5 (2026-10-03): THE AUDIT'S FIXES - each open item the four records left that the audit closed, driven. The
// audit itself (every slice re-read against bible/11-Multiplayer/Arena.md, the probes, the mutants) is its record there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSmallerDungeon, dungeonLocationFor } from '../src/world/smallerDungeons.js';
import { undercroftLocation, isArenaUndercroft } from '../src/world/arenaCity.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

/** Daggerfall's city as far as the undercroft's record reads it. */
const CITY = {
  regionName: 'Daggerfall', regionIndex: 17, locationIndex: 1231, politic: 0, climate: 231,
  mapTableData: { mapId: 1291010263, locationType: LOCATION_TYPES.TownCity },
  exterior: { recordElement: { header: { x: 0, y: 0 } } },
};

test('ARENA5 the undercroft never shrinks: Smaller Dungeons on, the fighters\' hall keeps Kamer\'s 32 blocks (the pit, the Keeper and the people stand by distance over them) - a keep of the same size under the setting is the five-block plus (mutant: ARENA5-UNDERCROFT-SHRINKS)', () => {
  const under = undercroftLocation(CITY);
  assert.equal(isArenaUndercroft(under), true);
  assert.equal(under.dungeon.blocks.length, 32, 'Kamer\'s 32 blocks');
  assert.equal(useSmallerDungeon(under, { setting: true }), false, 'the setting on, the hall whole');
  assert.equal(dungeonLocationFor(under, { setting: true }), under, 'the very record the host builds');
  // the same record, not the arena's: the setting's own law still runs
  const keep = { ...under, arenaUndercroft: false, mapTableData: { ...under.mapTableData, mapId: 99 } };
  assert.equal(useSmallerDungeon(keep, { setting: true }), true, 'any other keep of its size shrinks');
  assert.equal(useSmallerDungeon(keep, { setting: false }), false);
});
